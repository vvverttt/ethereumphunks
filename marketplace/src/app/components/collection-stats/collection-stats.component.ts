import { Component, Input, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Collection } from '@/models/data.state';
import { environment } from 'src/environments/environment';
import { supabase } from '@/services/supabase';
import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import type { AttrSection } from '@/routes/collection-attributes/collection-attributes.component';

const TYPE_TRAIT_KEYS = ['type', 'phunk type', 'punk type', 'skin type', 'gender'];
const CACHE_VERSION = 13;
const OWNER_LABEL_BY_SLUG: Record<string, string> = {
  'ethsrocks': 'EthsRocks',
  'cryptophunksv67': 'QuantumPhunks',
  'og-missing-phunks': 'Missing Phunk',
  'quantummissingphunksv67': 'MissingPhunks',
  'og-dysto-phunks': 'DystoPhunks',
  'quantumdystophunkzv67': 'DystoPhunkz',
};
const STATS_OVERRIDES_BY_SLUG: Record<string, { totalSupply?: number; uniqueTraitValues?: number; oneOfOnes?: number }> = {
  'cryptophunksv67': {
    totalSupply: 4251,
    uniqueTraitValues: 1481,
    oneOfOnes: 648,
  },
  'quantummissingphunksv67': {
    oneOfOnes: 2,
  },
  'quantumdystophunkzv67': {
    oneOfOnes: 69,
  },
};
const EXTRA_STATS_BY_SLUG: Record<string, Array<{ label: string; value: number }>> = {
  'cryptophunksv67': [
    { label: 'Lottery', value: 2367 },
    { label: 'Lottery Pro', value: 535 },
    { label: 'Swap (Locked)', value: 1003 },
    { label: 'Auction (Swap)', value: 264 },
    { label: 'Auction Pro', value: 45 },
  ],
};

function rarityTier(count: number, pct: number): string {
  if (count === 1) return 'One of One';
  if (pct <= 0.1)  return 'Mythic';
  if (pct <= 0.3)  return 'Legendary';
  if (pct <= 0.7)  return 'Epic';
  if (pct <= 2)    return 'Rare';
  if (pct <= 10)   return 'Uncommon';
  return 'Common';
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe],
  selector: 'app-collection-stats',
  templateUrl: './collection-stats.component.html',
  styleUrls: ['./collection-stats.component.scss'],
})
export class CollectionStatsComponent implements OnChanges {
  @Input() collection!: Collection;

  typeSection   = signal<AttrSection | null>(null);
  sections      = signal<AttrSection[]>([]);
  loading       = signal(true);
  collectionSlug = signal('');
  collectionSupply = signal(0);

  readonly staticUrl = environment.staticUrl;

  constructor(
    private dataSvc: DataService,
    public preferences: PhunkPreferencesService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }

  artifactTypeLabel(): string {
    return this.collectionSlug() === 'ethsrocks' ? this.t('rock') : this.t('phunk');
  }

  private readonly dynamicUniqueTraitValues = computed<number>(() =>
    (this.typeSection()?.rows.length ?? 0) +
    this.sections().reduce((s, sec) => s + sec.rows.length, 0)
  );

  private readonly dynamicOneOfOnes = computed<number>(() =>
    (this.typeSection()?.rows.filter(r => r.rarity === 'One of One').length ?? 0) +
    this.sections().reduce((s, sec) => s + sec.rows.filter(r => r.rarity === 'One of One').length, 0)
  );

  ownerLabel = computed<string>(() =>
    OWNER_LABEL_BY_SLUG[this.collectionSlug()] ?? 'Phunk'
  );

  totalSupply = computed<number>(() => {
    const override = STATS_OVERRIDES_BY_SLUG[this.collectionSlug()]?.totalSupply;
    return override ?? this.collectionSupply();
  });

  totalSupplyDisplay = computed<string>(() => {
    if (this.collectionSlug() === 'cryptophunksv67') return '4,251 / 10,000';
    return new Intl.NumberFormat('en-US').format(this.totalSupply());
  });

  uniqueTraitValues = computed<number>(() => {
    const override = STATS_OVERRIDES_BY_SLUG[this.collectionSlug()]?.uniqueTraitValues;
    return override ?? this.dynamicUniqueTraitValues();
  });

  oneOfOnes = computed<number>(() => {
    const override = STATS_OVERRIDES_BY_SLUG[this.collectionSlug()]?.oneOfOnes;
    return override ?? this.dynamicOneOfOnes();
  });

  traitTypes = computed<number>(() =>
    (this.typeSection() ? 1 : 0) + this.sections().length
  );

  extraStats = computed(() =>
    EXTRA_STATS_BY_SLUG[this.collectionSlug()] ?? []
  );

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['collection']?.currentValue) {
      this.collectionSlug.set(this.collection.slug);
      this.collectionSupply.set(this.collection.supply);
      this.loading.set(true);
      await this.loadAttrs(this.collection.slug);
      this.loading.set(false);
    }
  }

  private async loadAttrs(slug: string) {
    const cacheKey = `${slug}__attr_page`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.v === CACHE_VERSION) {
          this.typeSection.set(cached.typeSection);
          this.sections.set(cached.sections);
          return;
        }
      }
    } catch {}

    // Prefer cached/static attribute source first to minimize DB reads.
    let attrs = await this.loadAttrsFromStatic(slug);
    if (!attrs.length) {
      attrs = await this.loadAttrsFromSupabase(slug);
    }

    const total = attrs.length;
    const typeTraitMap: Record<string, { count: number; examples: string[]; shas: string[] }> = {};
    const sectionMap:  Record<string, Record<string, { count: number; examples: string[]; shas: string[] }>> = {};

    for (const item of attrs) {
      for (const [k, v] of Object.entries(item.values || {})) {
        const isType = TYPE_TRAIT_KEYS.includes(k.toLowerCase());
        const vArr = Array.isArray(v) ? v : [String(v)];
        for (const vi of vArr) {
          if (!vi || vi === 'null' || vi === 'undefined') continue;
          if (isType) {
            if (!typeTraitMap[vi]) typeTraitMap[vi] = { count: 0, examples: [], shas: [] };
            typeTraitMap[vi].count++;
          } else {
            if (!sectionMap[k]) sectionMap[k] = {};
            if (!sectionMap[k][vi]) sectionMap[k][vi] = { count: 0, examples: [], shas: [] };
            sectionMap[k][vi].count++;
          }
        }
      }
    }

    const toRow = (name: string, traitType: string, d: { count: number; examples: string[]; shas: string[] }) => {
      const pctNum = (d.count / total) * 100;
      return { name, traitType, count: d.count, pct: pctNum.toFixed(1) + '%', rarity: rarityTier(d.count, pctNum), examples: d.examples, exampleShas: d.shas };
    };

    this.typeSection.set({
      name: 'Phunk Types',
      rows: Object.entries(typeTraitMap).map(([n, d]) => toRow(n, 'Type', d)).sort((a, b) => a.count - b.count),
    });
    this.sections.set(
      Object.entries(sectionMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([traitType, valMap]) => ({
          name: traitType,
          rows: Object.entries(valMap).map(([n, d]) => toRow(n, traitType, d)).sort((a, b) => a.count - b.count),
        }))
    );
  }

  private async loadAttrsFromStatic(slug: string): Promise<{ sha: string; values: Record<string, any> }[]> {
    const attributeMap = await firstValueFrom(this.dataSvc.getAttributes(slug));
    if (!attributeMap) return [];

    return Object.entries(attributeMap).map(([sha, attrs]) => {
      const values: Record<string, any> = {};
      for (const attr of attrs || []) {
        if (!attr?.k) continue;
        const key = String(attr.k);
        const raw = (attr as any).v;
        if (raw === null || raw === undefined) continue;

        const valueArr = (Array.isArray(raw) ? raw : [raw])
          .map(v => String(v))
          .filter(v => v && v !== 'null' && v !== 'undefined');

        if (!valueArr.length) continue;
        values[key] = valueArr.length === 1 ? valueArr[0] : valueArr;
      }
      return { sha, values };
    });
  }

  private async loadAttrsFromSupabase(slug: string): Promise<{ sha: string; values: Record<string, any> }[]> {
    let attrs: { sha: string; values: Record<string, any> }[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('attributes_new')
        .select('sha, values')
        .eq('slug', slug)
        .range(offset, offset + 999);
      if (!data?.length) break;
      attrs.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }
    return attrs;
  }
}
