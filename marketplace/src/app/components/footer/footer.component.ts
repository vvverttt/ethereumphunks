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

  explorerUrl = environment.explorerUrl;

  version = environment.version;
  marketAddress = environment.marketAddress;
  points = environment.pointsAddress;
  lottery = (environment as any).lotteryAddress;

  constructor(private store: Store<GlobalState>) {}
}
