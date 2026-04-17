import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import { environment } from 'src/environments/environment';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { supabase } from '@/services/supabase';

interface OwnerRow {
  address: string;
  count: number;
  lastActive: string;
}

interface CollectionOwners {
  slug: string;
  name: string;
  owners: OwnerRow[];
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe, WalletAddressDirective],
  selector: 'app-owners-page',
  templateUrl: './owners-page.component.html',
  styleUrls: ['./owners-page.component.scss'],
})
export class OwnersPageComponent implements OnInit {
  collections = signal<CollectionOwners[]>([]);
  loading = signal(true);
  explorerUrl = environment.explorerUrl;

  readonly contractNames: Record<string, string> = {
    '0xd3418772623be1a3cc6b6d45cb46420cedd9154a': 'EthereumPhunks Market',
    '0xa48a43186612b179c0bc68ea34b4932549a70bfa': 'QuantumPhunks Market',
    '0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba': 'Evolve',
    '0xb69d359eaf0db03372a587d9db6f75b0a92cb218': 'Phunk Swap',
    '0x29b0d38112e8e743b63eb463f3351ab0f1e15977': 'Lottery',
    '0x298771ecc338de242ada11e49e2b8224c33bf620': 'Lottery 2',
    '0xc1fa86b53e8e101c93c570f276bc5177832bd031': 'Auction House',
    '0x2132622ff3178ef2574af25d8efdf94d6b7cc630': 'Auction House 2',
    '0x6a85c501b16e8c7be34eea409dab590a5b037cb8': 'EthsRocks',
  };

  getContractName(address: string): string {
    return this.contractNames[address.toLowerCase()] || '';
  }

  readonly collectionNames: Record<string, string> = {
    'cryptophunksv67': 'CryptoPhunksV67',
    'og-missing-phunks': 'OG Missing Phunks',
    'og-dysto-phunks': 'OG DystoPhunks',
    'quantummissingphunksv67': 'Quantum Missing Phunks',
    'quantumdystophunkzv67': 'Quantum DystoPhunkz',
    'ethsrocks': 'EthsRocks',
  };

  private readonly CACHE_KEY = 'owners_cache';
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  async ngOnInit() {
    const cached = this.getCache();
    if (cached) {
      this.collections.set(cached);
      this.loading.set(false);
      return;
    }
    await this.loadOwners();
    this.loading.set(false);
  }

  private getCache(): CollectionOwners[] | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > this.CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }

  private setCache(data: CollectionOwners[]) {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  }

  private async loadOwners() {
    const excludeAddresses = new Set([
      '0x0000000000000000000000000000000000000000',
    ]);

    const slugs = Object.keys(this.collectionNames);
    const result: CollectionOwners[] = [];

    for (const slug of slugs) {
      // Get all items for this collection
      const items: { owner: string }[] = [];
      let offset = 0;
      while (true) {
        const { data } = await supabase
          .from('ethscriptions')
          .select('owner')
          .eq('slug', slug)
          .range(offset, offset + 999);
        if (!data?.length) break;
        items.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
      }

      // Count per owner
      const counts: Record<string, number> = {};
      for (const item of items) {
        const addr = item.owner?.toLowerCase();
        if (!addr || excludeAddresses.has(addr)) continue;
        counts[addr] = (counts[addr] || 0) + 1;
      }

      const rows: OwnerRow[] = Object.entries(counts)
        .map(([address, count]) => ({ address, count, lastActive: '' }))
        .sort((a, b) => b.count - a.count);

      result.push({
        slug,
        name: this.collectionNames[slug],
        owners: rows,
      });
    }

    this.collections.set(result);
    this.setCache(result);
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + ' min';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' hours';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + ' days';
    const months = Math.floor(days / 30);
    if (months < 12) return months + ' months';
    const years = Math.floor(months / 12);
    return years + ' years';
  }
}
