// JSON-RPC proxy for the browser: quantumphunks.com/rpc
//
// The Alchemy and Ankr keys used to sit in the JS bundle, and the .eth.limo build pins
// that bundle to IPFS where it stays public forever, so anyone could lift them and run
// down our quota. They live here now as Pages secrets (Settings -> Variables and
// Secrets, Production):
//
//   RPC_ALCHEMY_URL     https://eth-mainnet.g.alchemy.com/v2/<key>
//   RPC_ALCHEMY_URL_2   https://eth-mainnet.g.alchemy.com/v2/<second key>   (optional)
//   RPC_ANKR_URL        https://rpc.ankr.com/eth/<key>                       (optional)
//
// The endpoint is still public, so it only forwards read methods, caps request size,
// caps eth_getLogs ranges, answers cross-origin requests only from our own sites, and
// caches the values every visitor asks for at the edge. If this function is down or
// over its daily quota, the frontend falls through to keyless public RPCs.

const ALLOWED_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'net_version',
  'web3_clientVersion',
]);

// seconds each answer may be shared between visitors at the edge
const CACHE_TTL_S = {
  eth_chainId: 86_400,
  net_version: 86_400,
  web3_clientVersion: 86_400,
  eth_getCode: 300,
  eth_gasPrice: 15,
  eth_maxPriorityFeePerGas: 15,
  eth_feeHistory: 15,
  eth_blockNumber: 4,
};

const MAX_BODY_BYTES = 128 * 1024;
const MAX_BATCH = 10;
const MAX_LOG_RANGE = 2_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

const ORIGIN_PATTERNS = [
  /^https:\/\/quantumphunks\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?ethereumphunks\.pages\.dev$/,
  /^https:\/\/(etherphunks|quantumphunks)\.eth\.(limo|link)$/,
  /^http:\/\/localhost:9000$/,
];

function allowedOrigin(origin) {
  return !!origin && ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function corsHeaders(origin) {
  const h = { 'Vary': 'Origin' };
  if (allowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function reply(status, body, origin, extra = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
      ...extra,
    },
  });
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

const HEX = /^0x[0-9a-f]+$/i;

// a getLogs filter bounded to a short numeric block range (or one block by hash)
function logRangeOk(filter) {
  if (!filter || typeof filter !== 'object') return false;
  if (filter.blockHash) return true;
  const { fromBlock, toBlock } = filter;
  if (typeof fromBlock !== 'string' || !HEX.test(fromBlock)) return false;
  if (typeof toBlock !== 'string' || !HEX.test(toBlock)) return false;
  const range = parseInt(toBlock, 16) - parseInt(fromBlock, 16);
  return range >= 0 && range <= MAX_LOG_RANGE;
}

function validate(call) {
  if (!call || typeof call !== 'object' || Array.isArray(call)) return 'Invalid request';
  if (typeof call.method !== 'string' || !ALLOWED_METHODS.has(call.method)) return 'Method not allowed';
  if (call.params !== undefined && !Array.isArray(call.params)) return 'Invalid params';
  if (call.method === 'eth_getLogs' && !logRangeOk(call.params?.[0])) {
    return `eth_getLogs needs numeric fromBlock/toBlock at most ${MAX_LOG_RANGE} blocks apart`;
  }
  return null;
}

// Ankr takes wide getLogs ranges (Alchemy Free stops at 10 blocks); everything else
// spreads across the two Alchemy keys, which share the per-second throughput cap.
function upstreams(env, calls) {
  const a1 = env.RPC_ALCHEMY_URL, a2 = env.RPC_ALCHEMY_URL_2, ankr = env.RPC_ANKR_URL;
  const alchemy = [a1, a2].filter(Boolean);
  if (alchemy.length === 2 && Math.random() < 0.5) alchemy.reverse();
  const order = calls.some((c) => c.method === 'eth_getLogs') ? [ankr, ...alchemy] : [...alchemy, ankr];
  return [...new Set(order.filter(Boolean))];
}

async function forward(urls, body) {
  let last = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      // rate limited or broken upstream: try the next one
      if (res.status === 429 || res.status >= 500) { last = res.status; continue; }
      const text = await res.text();
      if (!res.ok) { last = res.status; continue; }
      return { ok: true, text };
    } catch (e) {
      last = e?.name || 'fetch failed';
    }
  }
  return { ok: false, last };
}

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function handleOptions(request) {
  const origin = request.headers.get('Origin');
  if (!allowedOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function handlePost(request, env, waitUntil) {
  const origin = request.headers.get('Origin');
  // browsers always send Origin on these POSTs; other sites get nothing
  if (!allowedOrigin(origin)) return reply(403, { error: 'Origin not allowed' }, origin);

  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large' }, origin);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large' }, origin);

  let payload;
  try { payload = JSON.parse(raw); } catch { return reply(400, rpcError(null, -32700, 'Parse error'), origin); }

  const batch = Array.isArray(payload);
  const calls = batch ? payload : [payload];
  if (!calls.length || calls.length > MAX_BATCH) {
    return reply(400, rpcError(null, -32600, `Batch must hold 1-${MAX_BATCH} calls`), origin);
  }
  for (const call of calls) {
    const problem = validate(call);
    if (problem) return reply(400, rpcError(call?.id, -32601, problem), origin);
  }

  const urls = upstreams(env, calls);
  if (!urls.length) return reply(503, rpcError(calls[0].id, -32000, 'RPC not configured'), origin);

  // single cacheable call: answer from the edge cache when we can
  const ttl = !batch ? CACHE_TTL_S[calls[0].method] : undefined;
  let cacheKey = null;
  if (ttl) {
    const digest = await sha256Hex(JSON.stringify([calls[0].method, calls[0].params ?? []]));
    cacheKey = new Request(`${new URL(request.url).origin}/__rpc_cache/${digest}`);
    const hit = await caches.default.match(cacheKey);
    if (hit) {
      const cached = await hit.json();
      return reply(200, { jsonrpc: '2.0', id: calls[0].id ?? null, result: cached.result }, origin, { 'X-RPC-Cache': 'hit' });
    }
  }

  const result = await forward(urls, raw);
  if (!result.ok) return reply(502, rpcError(calls[0].id, -32000, 'Upstream RPC unavailable'), origin);

  if (cacheKey) {
    try {
      const parsed = JSON.parse(result.text);
      if (parsed && parsed.result !== undefined && !parsed.error) {
        waitUntil(caches.default.put(cacheKey, new Response(JSON.stringify({ result: parsed.result }), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` },
        })));
      }
    } catch { /* not cacheable */ }
  }

  return reply(200, result.text, origin);
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method === 'OPTIONS') return handleOptions(request);
  if (request.method === 'POST') return handlePost(request, env, waitUntil);
  return reply(405, { error: 'Use POST' }, request.headers.get('Origin'));
}
