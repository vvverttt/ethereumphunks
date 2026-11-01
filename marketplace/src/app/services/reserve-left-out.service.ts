import { Injectable, signal } from '@angular/core';

const KEY = 'reserve-left-out';
const BASIS_KEY = 'reserve-basis';

/** what a market cap is worked out from: the floor, or the average of the cheapest 35% of the listings */
export type ReserveBasis = 'floor' | 'half';
const BASES: ReserveBasis[] = ['floor', 'half'];
/** the average the other basis reads, from the same listings read */
export interface ReserveAverages { avgLow: Record<string, number> }

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
  /** the Floor / Avg 5 switch, shared the same way */
  readonly basis = signal<ReserveBasis>(this.readBasis());

  private readBasis(): ReserveBasis {
    try { const b = localStorage.getItem(BASIS_KEY) as ReserveBasis; return BASES.includes(b) ? b : 'floor'; } catch { return 'floor'; }
  }

  setBasis(b: ReserveBasis) {
    this.basis.set(b);
    try { localStorage.setItem(BASIS_KEY, b); } catch { /* storage blocked: this visit only */ }
  }

  /** the asking price the switch picks: the floor, or the average of the cheapest 35% */
  ask(slug: string, floors: Record<string, number> | null, avgs: ReserveAverages | null): number | null {
    return (this.basis() === 'half' ? avgs?.avgLow[slug] : floors?.[slug]) ?? null;
  }

  /** the i18n key naming the basis now picked */
  label(): string {
    return { floor: 'atmFloor', half: 'atmAvgHalf' }[this.basis()];
  }

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
