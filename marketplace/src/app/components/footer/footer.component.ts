import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  imports: [ CommonModule, WalletAddressDirective],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent {

  theme$ = this.store.select(appStateSelectors.selectTheme);
  config$ = this.store.select(appStateSelectors.selectConfig);

  explorerUrl = environment.explorerUrl;

  version = environment.version;
  marketAddress = environment.marketAddress;
  points = environment.pointsAddress;
  lottery = (environment as any).lotteryAddress;
  lottery2 = (environment as any).lottery2Address;
  auction = (environment as any).auctionAddress;
  mutation = (environment as any).evolveAddress;
  ethsrocks = (environment as any).ethsrocksAddress;
  auction2 = '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630';
  vault = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218';
  phunkquidity = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';

  constructor(private store: Store<GlobalState>) {}
}
