import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

export type AuctionKind = 'ethscriptions' | 'erc721';
export const AUCTION_KIND_KEY = 'auction-hub-kind';

/**
 * The Ethscriptions | ERC-721 toggle. Sits where the auction house's type tag used to be (under the
 * "Auction House" title) and looks like it: the active side is the white pill, the other side is quiet.
 */
@Component({
  selector: 'app-auction-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="switch" role="tablist" [attr.aria-label]="t('a721SwitchLabel')">
      <button type="button" role="tab" [class.on]="current() === 'ethscriptions'" [attr.aria-selected]="current() === 'ethscriptions'" (click)="go('ethscriptions')">Ethscriptions</button>
      <button type="button" role="tab" [class.on]="current() === 'erc721'" [attr.aria-selected]="current() === 'erc721'" (click)="go('erc721')">ERC-721</button>
    </div>
  `,
  styles: [`
    :host { display: block; align-self: flex-start; margin-top: .3rem; }
    .switch {
      display: inline-flex; padding: 2px; gap: 2px; border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, .45);
    }
    button {
      font-family: var(--secondary-font-stack); font-size: .78rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em; line-height: 1.2;
      padding: .12rem .55rem; border: 0; border-radius: 999px; cursor: pointer;
      background: transparent; color: rgba(255, 255, 255, .7);
      transition: background .15s, color .15s;
      &:hover:not(.on) { color: #fff; }
      &.on { background: #fff; color: rgb(var(--background)); cursor: default; }
    }
  `],
})
export class AuctionSwitchComponent {
  private readonly router = inject(Router);
  private readonly prefs = inject(PhunkPreferencesService);

  current = input<AuctionKind>('ethscriptions');

  t(key: string): string {
    return this.prefs.t(key);
  }

  go(kind: AuctionKind) {
    if (kind === this.current()) return;
    try { localStorage.setItem(AUCTION_KIND_KEY, kind); } catch {}
    this.router.navigate(['/auction'], { queryParams: { type: kind } });
  }
}
