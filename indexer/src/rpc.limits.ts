// Guards for the public /rpc relay: it is open to the browser on purpose (the site's gas readout
// and fallback reads use it), so what it must not do is let a stranger spend the provider quota
// or grow without bound.

import type { Request } from 'express';

// per client: 120 requests a minute covers a few open tabs polling gas and block number
export const PER_IP_LIMIT = 120;
export const PER_IP_WINDOW_MS = 60_000;

// all clients together: calls that miss the cache and reach a provider
export const GLOBAL_UPSTREAM_LIMIT = 1_500;

export const MAX_PARAMS_CHARS = 4_000;
export const MAX_CACHE_ENTRIES = 500;
export const UPSTREAM_TIMEOUT_MS = 8_000;
// a wide eth_getLogs range is the costliest call a provider bills for
export const MAX_LOG_RANGE = 2_000;

type Bucket = { count: number; resetAt: number };

export class FixedWindow {
  private buckets = new Map<string, Bucket>();

  constructor(private limit: number, private windowMs: number, private maxKeys = 10_000) {}

  // true while the caller is under the limit; counts the call
  take(key: string, now = Date.now()): boolean {
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.sweep(now);
      // still full of live buckets: refuse new keys rather than grow
      if (this.buckets.size >= this.maxKeys) return false;
      b = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, b);
    }
    b.count++;
    return b.count <= this.limit;
  }

  private sweep(now: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

// Behind Render's proxy the socket address is the proxy, so the client is the last hop it added
// to X-Forwarded-For (earlier entries are whatever the caller sent).
export function clientIp(req: Pick<Request, 'headers' | 'ip'>): string {
  const xff = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[xff.length - 1] : xff;
  const last = raw?.split(',').pop()?.trim();
  return last || req.ip || 'unknown';
}

// an eth_getLogs filter that is bounded to a short numeric block range
export function logRangeOk(filter: any): boolean {
  if (!filter || typeof filter !== 'object') return false;
  if (filter.blockHash) return true;
  const from = filter.fromBlock, to = filter.toBlock;
  if (typeof from !== 'string' || !/^0x[0-9a-f]+$/i.test(from)) return false;
  // both ends numeric: with "latest" as the end there is no way to bound the range here
  if (typeof to !== 'string' || !/^0x[0-9a-f]+$/i.test(to)) return false;
  return parseInt(to, 16) - parseInt(from, 16) <= MAX_LOG_RANGE;
}

// ids and message sizes for the websocket 'accounts' message
export const MAX_ACCOUNTS = 10;
export const MAX_ACCOUNTS_MESSAGE_CHARS = 1_000;
export const ACCOUNTS_MIN_GAP_MS = 2_000;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// the parsed list of wallet addresses, or null when the payload is anything else
export function parseAccounts(message: unknown): string[] | null {
  if (typeof message !== 'string' || message.length > MAX_ACCOUNTS_MESSAGE_CHARS) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(message); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_ACCOUNTS) return null;
  if (!parsed.every((a) => typeof a === 'string' && ADDRESS.test(a))) return null;
  return parsed.map((a: string) => a.toLowerCase());
}
