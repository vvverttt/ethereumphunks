// Alchemy NFT API proxy: quantumphunks.com/nft/getNFTsForOwner
//
// Used by the lottery's surrender picker to list a wallet's tokens in one collection.
// The Alchemy key stays a Pages secret (RPC_ALCHEMY_URL, same one /rpc uses); only the
// handful of query parameters the picker needs are passed through.

const ORIGIN_PATTERNS = [
  /^https:\/\/quantumphunks\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?ethereumphunks\.pages\.dev$/,
  /^https:\/\/(etherphunks|quantumphunks)\.eth\.(limo|link)$/,
  /^http:\/\/localhost:9000$/,
];
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function allowedOrigin(origin) {
  return !!origin && ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function reply(status, body, origin) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (allowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') {
    if (!allowedOrigin(origin)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' },
    });
  }
  if (request.method !== 'GET') return reply(405, { error: 'Use GET' }, origin);
  // a plain GET from our own page carries no Origin when same-origin, so accept that too
  if (origin && !allowedOrigin(origin)) return reply(403, { error: 'Origin not allowed' }, origin);

  const rpc = env.RPC_ALCHEMY_URL || '';
  if (!rpc.includes('/v2/')) return reply(503, { error: 'NFT API not configured' }, origin);

  const q = new URL(request.url).searchParams;
  const owner = q.get('owner') || '';
  const contracts = q.getAll('contractAddresses[]');
  if (!ADDRESS.test(owner) || contracts.length !== 1 || !ADDRESS.test(contracts[0])) {
    return reply(400, { error: 'Need owner and exactly one contractAddresses[]' }, origin);
  }

  const url = new URL(`${rpc.replace('/v2/', '/nft/v3/')}/getNFTsForOwner`);
  url.searchParams.set('owner', owner);
  url.searchParams.append('contractAddresses[]', contracts[0]);
  url.searchParams.set('withMetadata', 'false');
  url.searchParams.set('pageSize', '100');
  const pageKey = q.get('pageKey');
  if (pageKey && pageKey.length <= 512) url.searchParams.set('pageKey', pageKey);

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
    return reply(res.ok ? 200 : 502, res.ok ? await res.text() : { error: 'Upstream NFT API error' }, origin);
  } catch {
    return reply(502, { error: 'Upstream NFT API unavailable' }, origin);
  }
}
