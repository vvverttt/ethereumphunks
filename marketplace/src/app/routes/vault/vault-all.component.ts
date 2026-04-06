import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import { environment } from 'src/environments/environment';
import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { MarketFiltersComponent } from '@/components/market-filters/market-filters.component';
import { AttributeFilterPipe } from '@/pipes/attribute-filter';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
const VAULT_ADDRESS = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218' as `0x${string}`;


@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, PhunkGridComponent, MarketFiltersComponent, AttributeFilterPipe, DecimalPipe],
  selector: 'app-vault-all',
  templateUrl: './vault-all.component.html',
  styleUrls: ['./vault-all.component.scss'],
})
export class VaultAllComponent implements OnInit {
  items = signal<any[]>([]);
  filtersVisible = false;
  traitFilters: any = null;

  async ngOnInit() {
    const results: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId,sha,tokenId')
        .eq('slug', 'cryptophunksv67')
        .eq('owner', VAULT_ADDRESS.toLowerCase())
        .order('tokenId')
        .range(offset, offset + 999);
      if (!data?.length) break;
      results.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    this.items.set(results);
  }
}
