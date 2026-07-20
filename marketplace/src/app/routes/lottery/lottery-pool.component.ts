import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LotteryService } from '@/services/lottery.service';
import { DataService } from '@/services/data.service';
import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';

const PAGE_SIZE = 200;

@Component({
  selector: 'app-lottery-pool',
  standalone: true,
  imports: [CommonModule, RouterModule, PhunkGridComponent],
  templateUrl: './lottery-pool.component.html',
  styleUrls: ['./lottery-pool.component.scss']
})
export class LotteryPoolComponent implements OnInit {

  items = signal<any[]>([]);
  totalSize = signal(0);
  loaded = signal(false);
  loadingMore = signal(false);

  hasMore = computed(() => this.items().length < this.totalSize());

  staticUrl = environment.staticUrl;

  private allTokenIds: number[] = [];
  private attrMap: any = null;
  private slug = 'cryptophunksv67';

  constructor(
    private lotterySvc: LotteryService,
    private dataSvc: DataService
  ) {}

  async ngOnInit() {
    try {
      const size = Number(await this.lotterySvc.getPoolSize());
      this.totalSize.set(size);
      if (size === 0) { this.loaded.set(true); return; }

      // Fetch all pool tokenIds from contract in chunks (cheap RPC reads)
      const CHUNK = 100;
      for (let offset = 0; offset < size; offset += CHUNK) {
        const limit = Math.min(CHUNK, size - offset);
        const chunk = await this.lotterySvc.getPoolItems(offset, limit);
        this.allTokenIds.push(...chunk);
      }

      this.attrMap = await firstValueFrom(this.dataSvc.getAttributes(this.slug));

      // Load first page
      await this.loadPage(0, PAGE_SIZE);
    } finally {
      this.loaded.set(true);
    }
  }

  async loadMore() {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      await this.loadPage(this.items().length, PAGE_SIZE);
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async loadPage(offset: number, limit: number) {
    const batch = this.allTokenIds.slice(offset, offset + limit);
    if (!batch.length) return;

    const meta = await this.lotterySvc.getEthscriptionsByTokenIds(batch);
    const metaMap = new Map(meta.map((m: any) => [m.tokenId, m]));

    const newItems = batch.map(tokenId => {
      const m = metaMap.get(tokenId) || {};
      return {
        hashId: m.hashId || '',
        sha: m.sha || '',
        tokenId,
        slug: m.slug || 'cryptophunksv67',
        attributes: this.attrMap?.[m.sha] || [],
      };
    });

    this.items.update(existing => [...existing, ...newItems]);
  }
}
