import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  imports: [ CommonModule, WalletAddressDirective],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent {

  explorerUrl = environment.explorerUrl;

  version = environment.version;
  marketAddress = environment.marketAddress;
  points = environment.pointsAddress;
  lottery = (environment as any).lotteryAddress;
}
