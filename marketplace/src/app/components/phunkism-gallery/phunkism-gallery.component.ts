import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { TokenNumberPipe } from '@/pipes/token-number.pipe';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { detailsLink } from '@/utils/wallet-groups';
import { Phunk } from '@/models/db';

type Order = 'random' | 'chronological' | 'newest';

/** True when the only active filter is Special = Phunkism. */
export function isPhunkismFilter(filters: Record<string, unknown> | null | undefined): boolean {
  const set = Object.entries(filters || {}).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length));
  if (set.length !== 1) return false;
  const [key, value] = set[0];
  const values = Array.isArray(value) ? value : [value];
  return key.toLowerCase() === 'special' && values.length === 1 && String(values[0]).toLowerCase() === 'phunkism';
}

/**
 * The QuantumPhunks Special = Phunkism set, laid out as a tribute to Piv's Punkism gallery
 * (punkism.art): a pink wordmark, three orderings, and a gallery of borderless tiles where some
 * pieces take a double-size cell. The big cells come from the token id, so a piece keeps its size
 * across orderings and visits.
 */
@Component({
  selector: 'app-phunkism-gallery',
  standalone: true,
  imports: [RouterModule, PhunkImageComponent, TokenNumberPipe],
  templateUrl: './phunkism-gallery.component.html',
  styleUrl: './phunkism-gallery.component.scss',
})
export class PhunkismGalleryComponent {
  private prefs = inject(PhunkPreferencesService);

  items = input<Phunk[]>([]);

  order = signal<Order>('random');
  private seed = signal(Math.random());

  readonly orders: Order[] = ['random', 'chronological', 'newest'];
  readonly detailsLink = detailsLink;

  sorted = computed(() => {
    const list = [...this.items()];
    const order = this.order();
    if (order === 'chronological') return list.sort((a, b) => a.tokenId - b.tokenId);
    if (order === 'newest') return list.sort((a, b) => b.tokenId - a.tokenId);
    const s = this.seed();
    return list
      .map((p) => ({ p, k: this.hash(p.tokenId + s * 1e6) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.p);
  });

  setOrder(order: Order) {
    // pressing Random again deals a new order, like the original
    if (order === 'random') this.seed.set(Math.random());
    this.order.set(order);
  }

  /** About one piece in six takes a 2×2 cell. */
  big(p: Phunk): boolean {
    return this.hash(p.tokenId) % 6 === 0;
  }

  t(key: string, params?: Record<string, string | number>) {
    return this.prefs.t(key, params);
  }

  private hash(n: number): number {
    let h = Math.floor(n) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
}
