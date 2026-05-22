import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';

const ALLOWED_RPC_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'net_version',
  'web3_clientVersion',
]);

// Per-method cache TTL (in ms). Methods not listed = not cached.
// Caching cuts CU burn dramatically when many users poll the same data simultaneously.
const CACHE_TTL_MS: Record<string, number> = {
  eth_gasPrice: 60_000,        // 60s — gwei display only, no transactional dependency
  eth_feeHistory: 60_000,      // 60s — same as above
  eth_blockNumber: 4_000,      // 4s — one block window
  eth_chainId: 86_400_000,     // 24h — never changes for a given network
  net_version: 86_400_000,     // 24h — same
  web3_clientVersion: 86_400_000, // 24h — same
  eth_getCode: 300_000,        // 5min — contract code rarely changes (only on upgrade)
};

type JsonRpcBody = {
  id?: number | string | null;
  jsonrpc?: string;
  method?: string;
  params?: unknown[];
};

type CacheEntry = { value: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheKeyFor(method: string, params: unknown[] | undefined): string {
  return `${method}:${JSON.stringify(params || [])}`;
}

function getUpstreams(): string[] {
  // Load-balance across all configured Alchemy + Ankr + fallback providers
  // instead of always hitting RPC_URL_MAINNET_SERVER_FALLBACK (one Alchemy key).
  const candidates = [
    process.env.RPC_URL_MAINNET_SERVER_FALLBACK,
    process.env.RPC_URL_MAINNET_2,
    process.env.RPC_URL_MAINNET,
    ...(process.env.RPC_URL_MAINNET_BACKUP || '').split(',').map((u) => u.trim()),
  ];
  return candidates.filter(Boolean) as string[];
}

// Round-robin cursor across upstream URLs (load balances proxy traffic across Alchemy/Ankr keys)
let upstreamCursor = 0;

async function forwardWithFallback(body: object): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const upstreams = getUpstreams();
  if (upstreams.length === 0) {
    return { ok: false, status: 503, payload: { error: { message: 'No RPC upstreams configured' } } };
  }

  // Try one round-robin upstream first; on failure, walk the list once
  const startIdx = upstreamCursor++ % upstreams.length;
  for (let i = 0; i < upstreams.length; i++) {
    const url = upstreams[(startIdx + i) % upstreams.length];
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { error: { message: text || 'Invalid RPC response' } };
      }
      // 429 / 503 / 502 → try the next upstream
      if (response.status === 429 || response.status === 502 || response.status === 503) {
        continue;
      }
      return { ok: response.ok, status: response.status, payload };
    } catch {
      // Network error → next upstream
      continue;
    }
  }
  return { ok: false, status: 503, payload: { error: { message: 'All RPC upstreams failed' } } };
}

@Controller()
export class RpcController {
  @Post('rpc')
  async proxy(@Body() body: JsonRpcBody) {
    const method = body?.method || '';
    if (!ALLOWED_RPC_METHODS.has(method)) {
      throw new HttpException('Unsupported RPC method', HttpStatus.BAD_REQUEST);
    }

    const params = body?.params;
    const ttl = CACHE_TTL_MS[method];

    // Cache check (only for methods with TTL configured)
    if (ttl) {
      const key = cacheKeyFor(method, params);
      const hit = cache.get(key);
      const now = Date.now();
      if (hit && hit.expiresAt > now) {
        // Return cached payload with the caller's id so JSON-RPC clients match the request
        return { ...(hit.value as object), id: body?.id ?? 1 };
      }
    }

    const upstreams = getUpstreams();
    if (upstreams.length === 0) {
      throw new HttpException('RPC relay unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const result = await forwardWithFallback({
      id: body?.id ?? 1,
      jsonrpc: body?.jsonrpc || '2.0',
      method,
      params: params || [],
    });

    if (!result.ok) {
      throw new HttpException(result.payload || 'RPC relay request failed', result.status);
    }

    // Store in cache only if method has TTL AND response has no error field
    if (ttl && result.payload && typeof result.payload === 'object' && !('error' in (result.payload as object))) {
      const key = cacheKeyFor(method, params);
      cache.set(key, { value: result.payload, expiresAt: Date.now() + ttl });
    }

    return result.payload;
  }
}
