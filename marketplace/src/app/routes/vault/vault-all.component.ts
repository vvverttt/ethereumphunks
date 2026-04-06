import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import { environment } from 'src/environments/environment';
import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { MarketFiltersComponent } from '@/components/market-filters/market-filters.component';
import { AttributeFilterPipe } from '@/pipes/attribute-filter';

import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
const VAULT_ADDRESS = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218' as `0x${string}`;

const VAULT_ABI = [
  { inputs: [], name: 'poolSize', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'offset', type: 'uint256' }, { name: 'limit', type: 'uint256' }], name: 'getPoolItems', outputs: [{ type: 'bytes32[]' }], stateMutability: 'view', type: 'function' },
] as const;

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

  private rpcClient = createPublicClient({ chain: mainnet, transport: http('https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO') });

  async ngOnInit() {
    const poolSize = await this.rpcClient.readContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'poolSize',
    });

    const hashIds: string[] = [];
    for (let i = 0; i < Number(poolSize); i += 100) {
      const batch = await this.rpcClient.readContract({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: 'getPoolItems', args: [BigInt(i), 100n],
      });
      hashIds.push(...(batch as string[]));
    }

    const results: any[] = [];
    for (let i = 0; i < hashIds.length; i += 50) {
      const batch = hashIds.slice(i, i + 50);
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId,sha,tokenId')
        .in('hashId', batch);
      if (data) results.push(...data);
    }

    results.sort((a, b) => a.tokenId - b.tokenId);
    this.items.set(results);
  }
}
