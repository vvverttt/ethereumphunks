import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, firstValueFrom, of, take, timeout } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import { supabase } from '@/services/supabase';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { environment } from 'src/environments/environment';

const EXAMPLES = 10;
const TYPE_TRAIT_KEYS = ['type', 'phunk type', 'punk type', 'skin type', 'gender', 'sex'];
const ATTR_COUNT_EXCLUDE_EXTRA = ['animal', 'species', 'special'];
// Bumped 30 to rebuild tables that 6.8.6 computed from a stale attributes file: a browser
// could store the old file under the new ETag (fixed in data.service fetchAttributes), and
// this table was then built from it and cached. 29 was Phunklloween's third batch (14 -> 23). This cache is cache-first in
// localStorage and does NOT consult the attributes file's ETag, so a returning visitor keeps
// the old trait table until the version moves — a deploy alone is not enough.
const CACHE_VERSION = 32;

/** Pseudo-tab that stacks every section on one page instead of showing one at a time. */
const ALL_TAB = 'All';

const COMBINED_SLUGS = ['cryptophunksv67', 'ethsrocks', 'quantummissingphunksv67', 'quantumdystophunkzv67'];

// Types always use fixed count-based tiers (based on combined ecosystem counts)
const RARITY_OVERRIDES: Record<string, string> = {
  'one of one':    'Epic',
  'character':     'Elite',  // label stays Elite, color overridden via [class.character-trait]
  'zombie':        'Elite',
  'infinity stone':'Ancient',
  'alien':         'Legendary',
  'cyborg':        'Ultra',
  'ethsrock':      'Uncommon',
  'mythic':        'God',
};

function rarityTier(count: number, pct: number, isType = false, name = ''): string {
  const override = RARITY_OVERRIDES[name.toLowerCase().trim()];
  if (override) return override;

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
  if (count === 1)   return 'One of One';
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

/** A section plus its own totals, for the stacked All view. */
export interface AllSection extends AttrSection {
  /** Distinct values this trait type has. */
  values: number;
  /** Times this trait type is applied across the collection. */
  uses: number;
}

export interface CountRow {
  numTraits: number;
  count: number;
  pct: string;
  rarity: string;
  examples: string[];
  exampleShas: string[];
}

/** One stacked section of the page, cryptopunks.app style. */
export interface StackRow {
  key: string;
  name: string;
  /** Trait key to filter the market by; empty for attribute-count rows. */
  traitType: string;
  count: number;
  pct: string;
  rarity: string;
  exampleShas: string[];
}
export interface StackSection { id: string; name: string; isCount: boolean; rows: StackRow[]; }

const COUNT_SECTION = 'Attribute Counts';

interface CacheEntry {
  v: number;
  total: number;
  typeSection: AttrSection;
  sections: AttrSection[];
  countRows: CountRow[];
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe, PhunkImageComponent],
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
    const names: string[] = [ALL_TAB];
    if (this.activeTypeSection()) names.push(this.activeTypeSection()!.name);
    names.push(...this.activeSections().map(s => s.name));
    if (this.activeCountRows().length) names.push('Attribute Count');
    return names;
  });

  /** True when the single-page view is selected. */
  showAll = computed<boolean>(() => this.activeTab() === ALL_TAB);

  /**
   * Every section in tab order, for the "All" view, each carrying its own totals.
   * Rendering them stacked means the whole trait breakdown is readable in one scroll
   * instead of one tab at a time — the only way to compare rarity across trait types.
   *
   * `values` is how many distinct values that trait type has; `uses` is how many times
   * it is applied across the collection. They differ, and both matter: Character has 562
   * values but is worn by relatively few tokens, while Animal has 23 values covering
   * nearly every token. `uses` can exceed the collection size for multi-value traits,
   * where one token carries several values of the same type.
   */
  allSections = computed<AllSection[]>(() => {
    const raw: AttrSection[] = [];
    const type = this.activeTypeSection();
    if (type) raw.push(type);
    raw.push(...this.activeSections());

    return raw.map(s => ({
      name: s.name,
      rows: s.rows,
      values: s.rows.length,
      uses: s.rows.reduce((sum, r) => sum + r.count, 0),
    }));
  });

  /**
   * The same sections ranked by how heavily each is used, for the breakdown under the
   * summary. Ranking by `uses` rather than alphabetically shows at a glance which trait
   * types actually cover the collection — Hair leads on 11,835 while Artist has 1.
   */
  allSectionsByUse = computed<AllSection[]>(() =>
    [...this.allSections()].sort((a, b) => b.uses - a.uses)
  );

  /** Distinct trait values across every section — the All view's summary line. */
  allValueCount = computed<number>(() =>
    this.allSections().reduce((sum, s) => sum + s.values, 0)
  );

  /** Every trait application across the collection, summed over all sections. */
  allUseCount = computed<number>(() =>
    this.allSections().reduce((sum, s) => sum + s.uses, 0)
  );

  /** Average trait values carried per token — uses divided by collection size. */
  avgTraitsPerItem = computed<string>(() => {
    const total = this.activeTotalItems();
    if (!total) return '0';
    return (this.allUseCount() / total).toFixed(1);
  });

  /** Every section stacked on one page: types, each trait type, then attribute counts. */
  stacked = computed<StackSection[]>(() => {
    const out: StackSection[] = this.allSections().map(s => ({
      id: this.anchor(s.name),
      name: s.name,
      isCount: false,
      rows: s.rows.map(r => ({ key: `${s.name}|${r.name}`, name: r.name, traitType: r.traitType === 'Type' ? this.typeKey() : r.traitType, count: r.count, pct: r.pct, rarity: r.rarity, exampleShas: r.exampleShas })),
    }));
    // Character (hundreds of one-off names) reads best after the regular traits: right after Weapon
    const ci = out.findIndex(s => s.name === 'Character');
    if (ci >= 0 && out.some(s => s.name === 'Weapon')) {
      const [character] = out.splice(ci, 1);
      out.splice(out.findIndex(s => s.name === 'Weapon') + 1, 0, character);
    }
    // then Skin Tone right after Character
    const si = out.findIndex(s => s.name === 'Skin Tone');
    if (si >= 0 && out.some(s => s.name === 'Character')) {
      const [skin] = out.splice(si, 1);
      out.splice(out.findIndex(s => s.name === 'Character') + 1, 0, skin);
    }
    const counts = this.activeCountRows();
    if (counts.length) out.push({
      id: this.anchor(COUNT_SECTION),
      name: COUNT_SECTION,
      isCount: true,
      rows: counts.map(r => ({ key: `#|${r.numTraits}`, name: r.numTraits === 1 ? this.preferences.t('oneAttribute') : this.preferences.t('nAttributes', { n: r.numTraits }), traitType: '', count: r.count, pct: r.pct, rarity: r.rarity, exampleShas: r.exampleShas })),
    });
    return out;
  });

  /** Listed pieces, so their example tiles take the listed colour like cryptopunks.app's. */
  listedShas = signal<Set<string>>(new Set());

  /** The collection's own key for its type trait (e.g. "Sex", "Phunk Type"), for the type rows' filter link. */
  private typeKey = signal('Type');

  activeSection = computed<AttrSection | null>(() => {
    const tab = this.activeTab();
    if (!tab || tab === ALL_TAB) return null;
    if (this.activeTypeSection()?.name === tab) return this.activeTypeSection();
    return this.activeSections().find(s => s.name === tab) ?? null;
  });

  constructor(
    private store: Store<GlobalState>,
    private route: ActivatedRoute,
    private router: Router,
    private dataSvc: DataService,
    public preferences: PhunkPreferencesService,
  ) {}

  /** Section headings: the two fixed sections translate; trait types are data and stay as named. */
  sectionLabel(name: string): string {
    if (name === 'Phunk Types') return this.t('phunkTypes');
    if (name === COUNT_SECTION) return this.t('attributeCounts');
    return name;
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  tabLabel(tab: string): string {
    return tab === 'Attribute Count' ? this.t('attributeCount') : tab;
  }

  rarityLabel(rarity: string): string {
    const keyByRarity: Record<string, string> = {
      'One of One': 'oneOfOne',
      Common: 'common',
      Uncommon: 'uncommon',
      Rare: 'rare',
      Elite: 'elite',
      Epic: 'epic',
      Ultra: 'ultra',
      Legendary: 'legendary',
      Exotic: 'exotic',
      Mythic: 'mythic',
      God: 'god',
      Ancient: 'ancient',
    };
    return this.t(keyByRarity[rarity] || rarity);
  }

  async ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') || 'cryptophunksv67';

    // wait for the collections list, or the breadcrumb falls back to the bare slug
    const collections = await firstValueFrom(this.store.select(dataStateSelectors.selectCollections).pipe(
      filter(c => !!c?.length), take(1), timeout({ first: 8000, with: () => of([]) }),
    )).catch(() => []);
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
          const allTabs = [ALL_TAB, cached.typeSection?.name, ...cached.sections.map((s: AttrSection) => s.name), 'Attribute Count'];
          // Land on the stacked view by default; an explicit ?tab= still wins.
          const initialTab = tabParam && allTabs.includes(tabParam) ? tabParam : ALL_TAB;
          this.activeTab.set(initialTab);
          this.loading.set(false);
          this.afterLoad(initialTab);
          return;
        }
      }
    } catch {}

    // Load individual collection attrs for sections/attribute count
    let attrs = await this.loadAttrsFromStatic(this.slug);
    if (!attrs.length) attrs = await this.loadAttrsFromSupabase(this.slug);

    // Types come from THIS collection only. Merging the sibling collections here leaked
    // their values in (EthsRock, Infinity Stone) and computed every percentage against a
    // different total than the one shown, so the numbers never matched the collection.
    const combinedTypeAttrs = attrs;

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
        rarity: rarityTier(d.count, pctNum, isType, name),
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
    const allTabs = [ALL_TAB, typeSection.name, ...sections.map(s => s.name), 'Attribute Count'];
    const initialTab = tabParam && allTabs.includes(tabParam) ? tabParam : ALL_TAB;
    this.activeTab.set(initialTab);
    this.loading.set(false);
    this.afterLoad(initialTab);

    try {
      const entry: CacheEntry = { v: CACHE_VERSION, total, typeSection, sections, countRows };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {}
  }

  private anchor(name: string) {
    return 'attr-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  /** Scroll to an old ?tab= link's section, then fill in the market columns. */
  private afterLoad(tab: string) {
    if (tab && tab !== ALL_TAB) {
      const id = this.anchor(tab === 'Attribute Count' ? COUNT_SECTION : tab);
      setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300);
    }
    this.loadMarket();
  }

  jump(ev: MouseEvent, id: string) {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Listed pieces, so their example tiles take the listed colour, and each collection's own key
   * for its type trait. Listings come from the store (the route's slug already loaded them), so
   * this adds no request.
   */
  private async loadMarket() {
    const attrs = await this.loadAttrsFromStatic(this.slug);
    for (const item of attrs) {
      const k = Object.keys(item.values || {}).find(key => TYPE_TRAIT_KEYS.includes(key.toLowerCase()));
      if (k) { this.typeKey.set(k); break; }
    }
    const listings = await firstValueFrom(this.store.select(marketStateSelectors.selectListings).pipe(
      filter(l => !!l?.length), take(1),
      // a collection with nothing listed never emits a non-empty list
      timeout({ first: 8000, with: () => of([]) }),
    )).catch(() => []);
    this.listedShas.set(new Set((listings || []).filter(p => p?.sha && p.listing?.minValue).map(p => p.sha)));
  }

  /** The whole table as CSV, like their Download CSV link. */
  downloadCsv() {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Section', 'Attribute', 'Count', 'Percent', 'Rarity'].map(q).join(',')];
    for (const s of this.stacked()) {
      for (const r of s.rows) lines.push([s.name, r.name, r.count, r.pct, r.rarity].map(q).join(','));
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.slug}-attributes.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      return { name, traitType, count: d.count, pct: pctNum.toFixed(1) + '%', rarity: rarityTier(d.count, pctNum, isType, name), examples: d.examples, exampleShas: d.shas };
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
