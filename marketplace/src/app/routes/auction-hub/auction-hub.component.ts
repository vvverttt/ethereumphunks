import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { AuctionPageComponent } from '@/routes/auction/auction-page.component';
import { Auction721PageComponent } from '@/routes/auction721/auction721-page.component';
import { AUCTION_KIND_KEY, AuctionKind } from '@/components/auction/auction-switch/auction-switch.component';
import { AUCTIONS_LIVE } from '@/services/auction.service';

function remembered(): AuctionKind {
  // While the Ethscriptions auction house is idle, /auction opens on the ERC-721 (Phunkmas) side;
  // ?type=ethscriptions still shows the other one.
  if (!AUCTIONS_LIVE) return 'erc721';
  try {
    const v = localStorage.getItem(AUCTION_KIND_KEY);
    if (v === 'erc721' || v === 'ethscriptions') return v;
  } catch {}
  return 'ethscriptions';
}

/**
 * /auction: two auction houses on one page. The Ethscriptions | ERC-721 toggle lives inside each
 * page's title block (app-auction-switch) and sets ?type=; this just shows the matching page. Only the
 * shown side exists, so the hidden side makes no reads.
 */
@Component({
  selector: 'app-auction-hub',
  standalone: true,
  imports: [AuctionPageComponent, Auction721PageComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (kind() === 'erc721') {
      <app-auction721-page mode="all" />
    } @else {
      <app-auction-page />
    }
  `,
})
export class AuctionHubComponent {
  private readonly route = inject(ActivatedRoute);

  kind = toSignal(
    this.route.queryParamMap.pipe(map((q) => {
      const t = q.get('type');
      return t === 'erc721' || t === 'ethscriptions' ? (t as AuctionKind) : remembered();
    })),
    { initialValue: remembered() },
  );
}
