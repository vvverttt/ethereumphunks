import { Injectable, signal } from '@angular/core';

const KEY = 'reserve-left-out';

/**
 * Collections The Phederal Reserve values at their highest sale, not their floor: a thin market
 * whose only listings are joke prices (EthsRocks' Ξ8,008,135 rock). Pinned here so it costs no
 * read; update it when a rock sells higher.
 */
export const VALUED_AT_TOP_SALE: Record<string, number> = {
  ethsrocks: 0.0888888888,   // auction settled 2026-05-20
};

/** the price a collection's market cap is worked out from: its top sale when pinned, else its floor */
export function reservePrice(slug: string, floor: number | null | undefined): number | null {
  return VALUED_AT_TOP_SALE[slug] ?? floor ?? null;
}

/**
 * The collections someone has left out of The Phederal Reserve's totals, by tapping a collection's
 * picture (e.g. EthsRocks and its joke floor, so the rest shows its true value). Shared by the
 * header's Reserve drop-down and the bank's Reserve screen, and remembered on this device.
 */
@Injectable({ providedIn: 'root' })
export class ReserveLeftOutService {
  readonly left = signal<Set<string>>(this.read());

  private read(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
  }

  has(slug: string): boolean {
    return this.left().has(slug);
  }

  toggle(slug: string) {
    const next = new Set(this.left());
    next.has(slug) ? next.delete(slug) : next.add(slug);
    this.left.set(next);
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* storage blocked: this visit only */ }
  }
}
