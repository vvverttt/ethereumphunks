import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { environment } from 'src/environments/environment';

import { Auction } from '@/models/db';

@Component({
  standalone: true,
  imports: [
    CommonModule,

    WalletAddressDirective,
    WeiToEthPipe
  ],
  selector: 'app-bid-history',
  templateUrl: './bid-history.component.html',
  styleUrls: ['./bid-history.component.scss']
})

export class BidHistoryComponent implements OnInit {

  @Input() auction!: Auction;

  viewAllBids!: boolean;

  etherscanLink: string = `https://${environment.chainId === 11155111 ? 'sepolia' + '.' : ''}etherscan.io`;

  constructor(
    public dataSvc: DataService,
    public preferences: PhunkPreferencesService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }

  ngOnInit(): void {}

}
