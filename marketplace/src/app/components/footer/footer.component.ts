import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { selectMarketSlug } from '@/state/selectors/market-state.selectors';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { filter, map, startWith } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { ThemeService } from '@/services/theme.service';
import { ERC721C_CONTRACT_SETS } from '@/constants/erc721c';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, WalletAddressDirective],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent {

  theme$ = this.store.select(appStateSelectors.selectTheme);

  private router = inject(Router);

  /** Pages painted with their collection's glow (collection pages and item pages): the logo
   *  strip takes the same glow so it continues the page instead of showing as a flat band. */
  glowPage = toSignal(this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    startWith(null),
    map(() => {
      let r = this.router.routerState.snapshot.root;
      while (r.firstChild) r = r.firstChild;
      return [':slug', 'details/:hashId', 'details/:contract/:tokenId'].includes(r.routeConfig?.path || '');
    }),
  ), { initialValue: false });
  config$ = this.store.select(appStateSelectors.selectConfig);
  slug$ = this.store.select(selectMarketSlug);
  collection$ = this.store.select(dataStateSelectors.selectActiveCollection);
  // from the first Missing Phunk (Sep 2023), the earliest work now under DystoLabz
  year = `2023–${new Date().getFullYear()}`;

  explorerUrl = environment.explorerUrl;

  version = environment.version;

  // Stamped by prebuild.js at build time. A version alone could not tell a stale
  // cached shell from a fresh deploy; the date makes that obvious at a glance.
  buildDate = (environment as any).buildDate;

  // Contract set shown in the footer — overridden per ERC-721C collection (e.g. cryptophunksv67
  // shows the QuantumPhunks market/lottery + the NFT contract) based on the current collection.
  contracts$ = this.store.select(selectMarketSlug).pipe(
    map((slug) => {
      const o = ERC721C_CONTRACT_SETS[slug || ''];
      return {
        nft: o?.nft || null,
        marketplace: o?.marketplace || environment.marketAddress,
        points: environment.pointsAddress,
        lottery: o?.lottery || (environment as any).lotteryAddress,
        auction: (environment as any).auctionAddress,
      };
    }),
  );

  constructor(
    private store: Store<GlobalState>,
    public preferences: PhunkPreferencesService,
    public themeSvc: ThemeService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }
}
