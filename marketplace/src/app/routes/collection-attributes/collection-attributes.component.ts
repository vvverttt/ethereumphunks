import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { supabase } from '@/services/supabase';
import { DataService } from '@/services/data.service';
import { environment } from 'src/environments/environment';

const EXAMPLES = 10;
const TYPE_TRAIT_KEYS = ['type', 'phunk type', 'punk type', 'skin type', 'gender', 'sex'];
const ATTR_COUNT_EXCLUDE_EXTRA = ['animal', 'species', 'special'];
const CACHE_VERSION = 25;

const COMBINED_SLUGS = ['cryptophunksv67', 'ethsrocks', 'quantummissingphunksv67', 'quantumdystophunkzv67'];

// Types always use fixed count-based tiers (based on combined ecosystem counts)
function rarityTier(count: number, pct: number, isType = false): string {
  if (isType) {
    if (count <= 6)   return 'Ancient';
    if (count <= 12)  return 'God';
    if (count <= 14)  return 'Mythic';
    if (count <= 15)  return 'Exotic';
    if (count <= 16)  return 'Legendary';
    if (count <= 29)  return 'Ultra';
    if (count <= 32)  return 'Epic';
    if (count <= 49)  return 'Elite';
    if (count <= 79)  return 'Rare';
    if (count <= 100) return 'Uncommon';
    return 'Common';
  }
  // Non-type attributes: count-based for better distribution and 1-of-1 support
  if (count === 1)   return 'God Tier';
  if (count <= 8)    return 'Mythic';
  if (count <= 20)   return 'Exotic';
  if (count <= 40)   return 'Legendary';
  if (count <= 70)   return 'Ultra';
  if (count <= 120)  return 'Epic';
  if (count <= 200)  return 'Elite';
  if (count <= 350)  return 'Rare';
  if (count <= 600)  return 'Uncommon';
  return 'Common';
}

export interface AttrRow {
  name: string;
  traitType: string;
  count: number;
  pct: string;
  rarity: string;
  examples: string[]; // image URLs (sha-based)
  exampleShas: string[]; // parallel array for navigation
}

export interface AttrSection {
  name: string;
  rows: AttrRow[];
}

export interface CountRow {
  numTraits: number;
  count: number;
  pct: string;
  rarity: string;
  examples: string[];
  exampleShas: string[];
}

interface CacheEntry {
  v: number;
  total: number;
  typeSection: AttrSection;
  sections: AttrSection[];
  countRows: CountRow[];
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe],
  selector: 'app-collection-attributes',
  templateUrl: './collection-attributes.component.html',
  styleUrls: ['./collection-attributes.component.scss'],
})
export class CollectionAttributesComponent implements OnInit {
  typeSection  = signal<AttrSection | null>(null);
  sections     = signal<AttrSection[]>([]);
  countRows    = signal<CountRow[]>([]);
  loading      = signal(true);
  totalItems   = signal(0);
  collectionName = signal('');
  activeTab    = signal<string>('');
  slug = '';

  showCombined = signal(false);
  combinedLoading = signal(false);
  combinedTypeSection = signal<AttrSection | null>(null);
  combinedSections = signal<AttrSection[]>([]);
  combinedCountRows = signal<CountRow[]>([]);
  combinedTotal = signal(0);

  get isCombinableSlug() { return this.slug === 'cryptophunksv67'; }

  activeTypeSection  = computed(() => this.showCombined() ? this.combinedTypeSection() : this.typeSection());
  activeSections     = computed(() => this.showCombined() ? this.combinedSections() : this.sections());
  activeCountRows    = computed(() => this.showCombined() ? this.combinedCountRows() : this.countRows());
  activeTotalItems   = computed(() => this.showCombined() ? this.combinedTotal() : this.totalItems());

  readonly staticUrl = environment.staticUrl;

  tabs = computed<string[]>(() => {
    const names: string[] = [];
    if (this.activeTypeSection()) names.push(this.activeTypeSection()!.name);
    names.push(...this.activeSections().map(s => s.name));
    if (this.activeCountRows().length) names.push('Attribute Count');
    return names;
  });

  activeSection = computed<AttrSection | null>(() => {
    const tab = this.activeTab();
    if (!tab) return null;
    if (this.activeTypeSection()?.name === tab) return this.activeTypeSection();
    return this.activeSections().find(s => s.name === tab) ?? null;
  });

  constructor(
    private store: Store<GlobalState>,
    private route: ActivatedRoute,
    private router: Router,
    private dataSvc: DataService,
  ) {}

  async ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') || 'cryptophunksv67';

    const collections = await firstValueFrom(this.store.select(dataStateSelectors.selectCollections));
    const col = collections?.find(c => c.slug === this.slug);
    this.collectionName.set(col?.name || this.slug);

    const cacheKey = `${this.slug}__attr_page`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached: CacheEntry = JSON.parse(raw);
        if (cached.v === CACHE_VERSION) {
          this.totalItems.set(cached.total);
          this.typeSection.set(cached.typeSection);
          this.sections.set(cached.sections);
          this.countRows.set(cached.countRows);
          const tabParam = this.route.snapshot.queryParamMap.get('tab');
          const allTabs = [cached.typeSection?.name, ...cached.sections.map((s: AttrSection) => s.name), 'Attribute Count'];
          const initialTab = tabParam && allTabs.includes(tabParam) ? tabParam : (cached.typeSection?.name || cached.sections[0]?.name || '');
          this.activeTab.set(initialTab);
          this.loading.set(false);
          return;
        }
      }
    } catch {}

    // Load individual collection attrs for sections/attribute count
    let attrs = await this.loadAttrsFromStatic(this.slug);
    if (!attrs.length) attrs = await this.loadAttrsFromSupabase(this.slug);

    // Always load combined attrs for type section (consistent across all pages)
    const combinedTypeAttrs: { sha: string; values: Record<string, any> }[] = [];
    for (const slug of COMBINED_SLUGS) {
      let a = await this.loadAttrsFromStatic(slug);
      if (!a.length) a = await this.loadAttrsFromSupabase(slug);
      combinedTypeAttrs.push(...a);
    }

    const total = attrs.length;
    this.totalItems.set(total);

    const typeTraitMap: Record<string, { count: number; examples: string[]; shas: string[] }> = {};
    const sectionMap: Record<string, Record<string, { count: number; examples: string[]; shas: string[] }>> = {};
    const attrCountMap: Record<number, { count: number; examples: string[]; shas: string[] }> = {};

    // Build typeTraitMap from COMBINED data (always consistent)
    for (const item of combinedTypeAttrs) {
      const vals = item.values || {};
      for (const [k, v] of Object.entries(vals)) {
        if (!TYPE_TRAIT_KEYS.includes(k.toLowerCase())) continue;
        const vArr = Array.isArray(v) ? v : [String(v)];
        for (const vi of vArr) {
          if (!vi || vi === 'null' || vi === 'undefined') continue;
          if (!typeTraitMap[vi]) typeTraitMap[vi] = { count: 0, examples: [], shas: [] };
          typeTraitMap[vi].count++;
          if (typeTraitMap[vi].examples.length < EXAMPLES) {
            typeTraitMap[vi].examples.push(`${this.staticUrl}/static/images/${item.sha}`);
            typeTraitMap[vi].shas.push(item.sha);
          }
        }
      }
    }

    // Build sectionMap and attrCountMap from individual collection
    for (const item of attrs) {
      const vals = item.values || {};
      let numAttrs = 0;

      for (const [k, v] of Object.entries(vals)) {
        const isType = TYPE_TRAIT_KEYS.includes(k.toLowerCase());
        const vArr = Array.isArray(v) ? v : [String(v)];

        for (const vi of vArr) {
          if (!vi || vi === 'null' || vi === 'undefined') continue;
          if (!isType && !ATTR_COUNT_EXCLUDE_EXTRA.includes(k.toLowerCase())) numAttrs++;

          if (!isType) {
            if (!sectionMap[k]) sectionMap[k] = {};
            if (!sectionMap[k][vi]) sectionMap[k][vi] = { count: 0, examples: [], shas: [] };
            sectionMap[k][vi].count++;
            if (sectionMap[k][vi].examples.length < EXAMPLES) {
              sectionMap[k][vi].examples.push(`${this.staticUrl}/static/images/${item.sha}`);
              sectionMap[k][vi].shas.push(item.sha);
            }
          }
        }
      }

      if (!attrCountMap[numAttrs]) attrCountMap[numAttrs] = { count: 0, examples: [], shas: [] };
      attrCountMap[numAttrs].count++;
      if (attrCountMap[numAttrs].examples.length < EXAMPLES) {
        attrCountMap[numAttrs].examples.push(`${this.staticUrl}/static/images/${item.sha}`);
        attrCountMap[numAttrs].shas.push(item.sha);
      }
    }

    const toRow = (name: string, traitType: string, d: { count: number; examples: string[]; shas: string[] }, isType = false): AttrRow => {
      const pctNum = (d.count / total) * 100;
      return {
        name,
        traitType,
        count: d.count,
        pct: pctNum.toFixed(1) + '%',
        rarity: rarityTier(d.count, pctNum, isType),
        examples: d.examples,
        exampleShas: d.shas,
      };
    };

    const typeSection: AttrSection = {
      name: 'Phunk Types',
      rows: Object.entries(typeTraitMap)
        .map(([name, d]) => toRow(name, 'Type', d, true))
        .sort((a, b) => a.count - b.count),
    };

    const sections: AttrSection[] = Object.entries(sectionMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([traitType, valMap]) => ({
        name: traitType,
        rows: Object.entries(valMap)
          .map(([name, d]) => toRow(name, traitType, d))
          .sort((a, b) => a.count - b.count),
      }));

    const countRows: CountRow[] = Object.entries(attrCountMap)
      .map(([n, d]) => {
        const pctNum = (d.count / total) * 100;
        return {
          numTraits: +n,
          count: d.count,
          pct: pctNum.toFixed(1) + '%',
          rarity: rarityTier(d.count, pctNum),
          examples: d.examples,
          exampleShas: d.shas,
        };
      })
      .sort((a, b) => a.numTraits - b.numTraits);

    this.typeSection.set(typeSection);
    this.sections.set(sections);
    this.countRows.set(countRows);
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    const allTabs = [typeSection.name, ...sections.map(s => s.name), 'Attribute Count'];
    const initialTab = tabParam && allTabs.includes(tabParam) ? tabParam : typeSection.name;
    this.activeTab.set(initialTab);
    this.loading.set(false);

    try {
      const entry: CacheEntry = { v: CACHE_VERSION, total, typeSection, sections, countRows };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {}
  }

  setTab(tab: string) {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
  }

  async goToPhunk(sha: string) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId')
      .eq('sha', sha)
      .single();
    if (data?.hashId) this.router.navigate(['/details', data.hashId]);
  }

  goToAttribute(traitType: string, value: string) {
    this.router.navigate(['/' + this.slug + '/market/all'], {
      queryParams: { [traitType]: value },
    });
  }

  async toggleCombined() {
    this.showCombined.update(v => !v);
    if (this.showCombined() && !this.combinedTotal()) {
      this.combinedLoading.set(true);
      const allAttrs: { sha: string; values: Record<string, any> }[] = [];
      for (const slug of COMBINED_SLUGS) {
        let attrs = await this.loadAttrsFromStatic(slug);
        if (!attrs.length) attrs = await this.loadAttrsFromSupabase(slug);
        allAttrs.push(...attrs);
      }
      const { typeSection, sections, countRows } = this.buildSections(allAttrs);
      this.combinedTotal.set(allAttrs.length);
      this.combinedTypeSection.set(typeSection);
      this.combinedSections.set(sections);
      this.combinedCountRows.set(countRows);
      this.combinedLoading.set(false);
    }
    const firstTab = this.activeTypeSection()?.name || this.activeSections()[0]?.name || '';
    this.activeTab.set(firstTab);
  }

  private buildSections(attrs: { sha: string; values: Record<string, any> }[]) {
    const total = attrs.length;
    const typeTraitMap: Record<string, { count: number; examples: string[]; shas: string[] }> = {};
    const sectionMap: Record<string, Record<string, { count: number; examples: string[]; shas: string[] }>> = {};
    const attrCountMap: Record<number, { count: number; examples: string[]; shas: string[] }> = {};

    for (const item of attrs) {
      const vals = item.values || {};
      let numAttrs = 0;
      for (const [k, v] of Object.entries(vals)) {
        const isType = TYPE_TRAIT_KEYS.includes(k.toLowerCase());
        const vArr = Array.isArray(v) ? v : [String(v)];
        for (const vi of vArr) {
          if (!vi || vi === 'null' || vi === 'undefined') continue;
          if (!isType && !ATTR_COUNT_EXCLUDE_EXTRA.includes(k.toLowerCase())) numAttrs++;
          if (isType) {
            if (!typeTraitMap[vi]) typeTraitMap[vi] = { count: 0, examples: [], shas: [] };
            typeTraitMap[vi].count++;
            if (typeTraitMap[vi].examples.length < EXAMPLES) { typeTraitMap[vi].examples.push(`${this.staticUrl}/static/images/${item.sha}`); typeTraitMap[vi].shas.push(item.sha); }
          } else {
            if (!sectionMap[k]) sectionMap[k] = {};
            if (!sectionMap[k][vi]) sectionMap[k][vi] = { count: 0, examples: [], shas: [] };
            sectionMap[k][vi].count++;
            if (sectionMap[k][vi].examples.length < EXAMPLES) { sectionMap[k][vi].examples.push(`${this.staticUrl}/static/images/${item.sha}`); sectionMap[k][vi].shas.push(item.sha); }
          }
        }
      }
      if (!attrCountMap[numAttrs]) attrCountMap[numAttrs] = { count: 0, examples: [], shas: [] };
      attrCountMap[numAttrs].count++;
      if (attrCountMap[numAttrs].examples.length < EXAMPLES) { attrCountMap[numAttrs].examples.push(`${this.staticUrl}/static/images/${item.sha}`); attrCountMap[numAttrs].shas.push(item.sha); }
    }

    const toRow = (name: string, traitType: string, d: { count: number; examples: string[]; shas: string[] }, isType = false) => {
      const pctNum = (d.count / total) * 100;
      return { name, traitType, count: d.count, pct: pctNum.toFixed(1) + '%', rarity: rarityTier(d.count, pctNum, isType), examples: d.examples, exampleShas: d.shas };
    };

    const typeSection: AttrSection = { name: 'Phunk Types', rows: Object.entries(typeTraitMap).map(([n, d]) => toRow(n, 'Type', d, true)).sort((a, b) => a.count - b.count) };
    const sections: AttrSection[] = Object.entries(sectionMap).sort(([a], [b]) => a.localeCompare(b)).map(([traitType, valMap]) => ({ name: traitType, rows: Object.entries(valMap).map(([n, d]) => toRow(n, traitType, d)).sort((a, b) => a.count - b.count) }));
    const countRows: CountRow[] = Object.entries(attrCountMap).map(([n, d]) => { const pctNum = (d.count / total) * 100; return { numTraits: +n, count: d.count, pct: pctNum.toFixed(1) + '%', rarity: rarityTier(d.count, pctNum), examples: d.examples, exampleShas: d.shas }; }).sort((a, b) => a.numTraits - b.numTraits);

    return { typeSection, sections, countRows };
  }

  private async loadAttrsFromStatic(slug: string): Promise<{ sha: string; values: Record<string, any> }[]> {
    const attributeMap = await firstValueFrom(this.dataSvc.getAttributes(slug));
    if (!attributeMap) return [];

    return Object.entries(attributeMap).map(([sha, attrs]) => {
      const accumulated: Record<string, string[]> = {};
      for (const attr of attrs || []) {
        if (!attr?.k) continue;
        const key = String(attr.k);
        const raw = (attr as any).v;
        if (raw === null || raw === undefined) continue;
        const valueArr = (Array.isArray(raw) ? raw : [raw])
          .map(v => String(v))
          .filter(v => v && v !== 'null' && v !== 'undefined');
        if (!valueArr.length) continue;
        if (!accumulated[key]) accumulated[key] = [];
        accumulated[key].push(...valueArr);
      }
      const values: Record<string, any> = {};
      for (const [k, arr] of Object.entries(accumulated)) {
        values[k] = arr.length === 1 ? arr[0] : arr;
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
