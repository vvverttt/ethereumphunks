import { Component, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DataService } from '@/services/data.service';

/**
 * Compact one-line collection stats: floor, items, listed, sales, volume.
 *
 * Desktop only by design — there is no room for five figures beside the search
 * field on a phone, so the whole bar is display:none below the breakpoint
 * rather than wrapping or truncating.
 */
@Component({
  selector: 'app-collection-stat-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collection-stat-bar.component.html',
  styleUrls: ['./collection-stat-bar.component.scss'],
})
export class CollectionStatBarComponent {

  slug = input.required<string | undefined>();

  /** 'header' is the tighter treatment for the top bar; 'section' is roomier. */
  variant = input<'header' | 'section'>('header');

  floor = signal<number | null>(null);
  listed = signal<number>(0);
  sales = signal<number>(0);
  volume = signal<number>(0);
  supply = signal<number>(0);
  loaded = signal<boolean>(false);

  constructor(public dataSvc: DataService) {
    effect((onCleanup) => {
      const slug = this.slug();
      if (!slug) return;
      this.loaded.set(false);

      const sub = this.dataSvc.fetchCollectionStatSummary(slug).subscribe({
        next: (s) => {
          this.floor.set(s.floor);
          this.listed.set(s.listed);
          this.sales.set(s.sales);
          this.volume.set(s.volume);
          this.supply.set(s.supply);
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true),
      });

      onCleanup(() => sub.unsubscribe());
    });
  }

  /** Big ETH numbers are noise at 4dp; small ones lose meaning without them. */
  eth(v: number | null): string {
    if (v === null) return '—';
    if (v >= 1000) return `${Math.round(v).toLocaleString()}`;
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(3);
  }
}
