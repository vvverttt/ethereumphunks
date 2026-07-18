import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { selectMarketSlug } from '@/state/selectors/market-state.selectors';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { ERC721C_CONTRACT_SETS } from '@/constants/erc721c';

@Component({
  standalone: true,
  imports: [CommonModule, WalletAddressDirective],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent {

  theme$ = this.store.select(appStateSelectors.selectTheme);
  config$ = this.store.select(appStateSelectors.selectConfig);

  explorerUrl = environment.explorerUrl;

  version = environment.version;

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
        // ERC-721C collections have a single lottery — hide "Lottery 2" for them
        lottery2: o ? null : (environment as any).lottery2Address,
        auction: (environment as any).auctionAddress,
      };
    }),
  );

  constructor(
    private store: Store<GlobalState>,
    public preferences: PhunkPreferencesService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }
}
