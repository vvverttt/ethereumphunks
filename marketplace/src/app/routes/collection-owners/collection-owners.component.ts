import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { environment } from 'src/environments/environment';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { supabase } from '@/services/supabase';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

interface OwnerRow {
  address: string;
  count: number;
}

const CONTRACT_NAMES: Record<string, string> = {
  '0xd3418772623be1a3cc6b6d45cb46420cedd9154a': 'EtherPhunks Market',
  '0xa48a43186612b179c0bc68ea34b4932549a70bfa': 'QuantumPhunks Market',
  '0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba': 'Evolve',
  '0xb69d359eaf0db03372a587d9db6f75b0a92cb218': 'Phunk Swap (discontinued)',
  '0x29b0d38112e8e743b63eb463f3351ab0f1e15977': 'Lottery',
  '0x298771ecc338de242ada11e49e2b8224c33bf620': 'Lottery 2',
  '0xc1fa86b53e8e101c93c570f276bc5177832bd031': 'Auction House',
  '0x2132622ff3178ef2574af25d8efdf94d6b7cc630': 'Auction House 2',
  '0x6a85c501b16e8c7be34eea409dab590a5b037cb8': 'EthsRocks',
};

const OWNER_LABEL_BY_SLUG: Record<string, string> = {
  'ethsrocks': 'EthsRocks',
  'cryptophunksv67': 'QuantumPhunks',
  'og-missing-phunks': 'Missing Phunk',
  'quantummissingphunksv67': 'MissingPhunks',
  'og-dysto-phunks': 'DystoPhunks',
  'quantumdystophunkzv67': 'DystoPhunkz',
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe, WalletAddressDirective],
  selector: 'app-collection-owners',
  templateUrl: './collection-owners.component.html',
  styleUrls: ['./collection-owners.component.scss'],
})
export class CollectionOwnersComponent implements OnInit {
  owners = signal<OwnerRow[]>([]);
  loading = signal(true);
  viewable = signal(true);
  collectionName = signal('');
  ownerLabel = signal('Phunk');
  slug = '';
  explorerUrl = environment.explorerUrl;

  constructor(
    private store: Store<GlobalState>,
    private route: ActivatedRoute,
    public preferences: PhunkPreferencesService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }

  getContractName(address: string): string {
    return CONTRACT_NAMES[address.toLowerCase()] || '';
  }

  async ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') || 'cryptophunksv67';
      void this.loadOwners(slug);
    });
  }

  private async loadOwners(slug: string) {
    this.loading.set(true);
    this.slug = slug;

    this.ownerLabel.set(OWNER_LABEL_BY_SLUG[this.slug] || 'Phunk');
    const collections = await firstValueFrom(this.store.select(dataStateSelectors.selectCollections));
    const col = collections?.find(c => c.slug === this.slug);
    this.collectionName.set(col?.name || this.slug);

    // Owners list is only viewable for ethsrocks for now; never fetch the
    // breakdown for other collections so the data is not exposed client-side.
    if (this.slug !== 'ethsrocks') {
      this.viewable.set(false);
      this.owners.set([]);
      this.loading.set(false);
      return;
    }
    this.viewable.set(true);

    const items: { owner: string }[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('owner')
        .eq('slug', this.slug)
        .range(offset, offset + 999);
      if (!data?.length) break;
      items.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    const counts: Record<string, number> = {};
    for (const item of items) {
      const addr = item.owner?.toLowerCase();
      if (!addr || addr === '0x0000000000000000000000000000000000000000') continue;
      counts[addr] = (counts[addr] || 0) + 1;
    }

    this.owners.set(
      Object.entries(counts)
        .map(([address, count]) => ({ address, count }))
        .sort((a, b) => b.count - a.count)
    );
    this.loading.set(false);
  }
}
