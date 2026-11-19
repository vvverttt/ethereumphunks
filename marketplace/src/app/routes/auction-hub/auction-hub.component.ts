import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuctionPageComponent } from '@/routes/auction/auction-page.component';
import { Auction721PageComponent } from '@/routes/auction721/auction721-page.component';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

type Kind = 'ethscriptions' | 'erc721';
const KEY = 'auction-hub-kind';

/**
 * /auction: one page, two auction houses. A switch picks the Ethscriptions house (the original page,
 * unchanged) or the ERC-721 house (V67AuctionHouse). The choice is in the URL (?type=erc721) so it can
 * be linked, and remembered per browser. Only the side that is shown is created, so the hidden side
 * makes no reads at all.
 */
@Component({
  selector: 'app-auction-hub',
  standalone: true,
  imports: [RouterModule, AuctionPageComponent, Auction721PageComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <nav class="hub-switch" role="tablist" [attr.aria-label]="t('a721SwitchLabel')">
      <button role="tab" [attr.aria-selected]="kind() === 'ethscriptions'" [class.on]="kind() === 'ethscriptions'" (click)="pick('ethscriptions')">
        {{ t('a721TabEthscriptions') }}
      </button>
      <button role="tab" [attr.aria-selected]="kind() === 'erc721'" [class.on]="kind() === 'erc721'" (click)="pick('erc721')">
        {{ t('a721TabErc721') }}
      </button>
      <a class="dysto-link" routerLink="/dysto">{{ t('a721DystoLink') }}</a>
    </nav>
    @if (kind() === 'erc721') {
      <app-auction721-page mode="all" />
    } @else {
      <app-auction-page />
    }
  `,
  styles: [`
    :host { display: block; position: relative; }
    /* Floats just under the fixed header, in the empty top band both auction pages already have,
       so the original Ethscriptions page keeps its exact layout. */
    .hub-switch {
      position: absolute; top: calc(var(--header-height) + 0.75rem); left: 0; right: 0; z-index: 20;
      display: flex; justify-content: center; align-items: center; gap: 0.5rem; flex-wrap: wrap;
      padding: 0 1rem; pointer-events: none;
      > * { pointer-events: auto; }
      button {
        padding: 0.55rem 1.1rem; font: inherit; font-weight: 700; cursor: pointer; color: inherit;
        background: rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.25);
        &.on { background: var(--primary-color, #c3ff00); color: #000; border-color: var(--primary-color, #c3ff00); }
      }
      .dysto-link { margin-left: 0.5rem; font-size: 0.85rem; color: #5ee0c4; }
    }
  `],
})
export class AuctionHubComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly prefs = inject(PhunkPreferencesService);

  kind = signal<Kind>(this.initial());

  t(key: string): string {
    return this.prefs.t(key);
  }

  private initial(): Kind {
    const q = this.route.snapshot.queryParamMap.get('type');
    if (q === 'erc721' || q === 'ethscriptions') return q;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'erc721' || saved === 'ethscriptions') return saved;
    } catch {}
    return 'ethscriptions';
  }

  pick(k: Kind) {
    this.kind.set(k);
    try { localStorage.setItem(KEY, k); } catch {}
    this.router.navigate([], { relativeTo: this.route, queryParams: { type: k }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
