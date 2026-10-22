import { Observable } from 'rxjs';

/**
 * setInterval that stops polling while the tab is hidden.
 *
 * A tab left open in the background kept polling at full rate — the auction bar every 30 s,
 * the indexer block number every 60 s — and every tick is a Supabase request (the auction bar
 * adds RPC reads on top). Nobody is looking at a hidden tab, so its ticks are skipped. When the
 * tab is shown again and a tick was skipped, `fn` runs at once and the interval restarts from
 * there, so the visitor comes back to current data without two refreshes landing together.
 *
 * Returns a function that stops it.
 */
export function visibleInterval(fn: () => void, periodMs: number): () => void {
  let id: ReturnType<typeof setInterval>;
  let missed = false;

  const tick = () => {
    if (document.hidden) { missed = true; return; }
    fn();
  };
  const start = () => { id = setInterval(tick, periodMs); };
  const onVisibility = () => {
    if (document.hidden || !missed) return;
    missed = false;
    clearInterval(id);
    fn();
    start();
  };

  start();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * Auction refresh cadence: every 60 s normally, every 10 s in an auction's last 5 minutes, when
 * late bids keep extending the end and a stale price or "ended" clock would mislead. Ticks every
 * 10 s and runs `load` only when the current cadence is due. Paused while the tab is hidden.
 */
export function auctionPoll(load: () => void, endTimeMs: () => number): () => void {
  let last = Date.now();
  return visibleInterval(() => {
    const left = endTimeMs() - Date.now();
    const period = left > 0 && left < 5 * 60_000 ? 10_000 : 60_000;
    if (Date.now() - last >= period - 500) { last = Date.now(); load(); }
  }, 10_000);
}

/** visibleInterval as an Observable: emits on each tick the visitor can see; unsubscribe to stop. */
export function visibleTimer(periodMs: number): Observable<void> {
  return new Observable<void>((subscriber) => visibleInterval(() => subscriber.next(), periodMs));
}
