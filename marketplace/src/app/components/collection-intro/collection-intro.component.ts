import { Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { CollectionMapComponent } from '@/components/collection-map/collection-map.component';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { InternalLinksDirective } from '@/directives/internal-links.directive';
import { ERC721C_CONTRACTS } from '@/constants/erc721c';

import { Collection } from '@/models/data.state';
import { WORDMARK_PATHS } from './wordmarks';
import { Phunk } from '@/models/db';

/** Wordmark sizes (px at the design size) from scripts/make-wordmark-svg.py, for a shared scale. */
const WORDMARKS: Record<string, [number, number]> = {
  'cryptophunksv67': [3436, 358], 'missing-phunks': [3106, 389], 'dysto-phunks': [2638, 377],
  'ethsrocks': [2048, 299], 'phikings': [1703, 389], 'phunklloween': [2837, 299],
};
/** One scale for every wordmark so their letters are the same size: QuantumPhunks at 560px. */
const WORDMARK_SCALE = 560 / 3436;

const PLURALS: Record<string, string> = {
  Trex: 'T-Rexes', Triceratops: 'Triceratops', Stegosaurus: 'Stegosauruses', Rhino: 'Rhinos',
};
/** Type names that describe rather than name (Frankish, Undead): they read right unchanged. */
const AS_IS = /(ish|ic|ed|ead)$/;

/** "6 Infinity Stones", "2 Witches", "1 Mummy", "2 Frankish": a count reads as English. */
function plural(name: string, count: number): string {
  if (count === 1 || AS_IS.test(name)) return name;
  if (PLURALS[name]) return PLURALS[name];
  if (/[^s]s$/.test(name)) return name;              // already plural: Cyber Residents
  if (/(ss|x|ch|sh)$/.test(name)) return name + 'es';
  if (/[^aeiou]y$/.test(name)) return name.slice(0, -1) + 'ies';
  return name + 's';
}

interface Count { name: string; label: string; count: number }
interface MapInfo { src: string; cols: number; rows: number; smooth?: boolean; tile?: number; links: string[] | null; ids: number[] | null }
interface BandItem { sha: string; link: any[] | string | null; label: string }

/**
 * A collection's opening, laid out like cryptopunks.app: the wordmark in the collection's accent,
 * a few paragraphs about it, a full-width band of random pieces, its breakdown by type (each a
 * link), more about it, and the map of the whole collection. The text, band and breakdown come
 * from the attributes file the site already loads and the bundled sprite sheets; the map is one
 * pre-built image (scripts/build-v67-map.py, scripts/build-collection-maps.py).
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, PhunkImageComponent, CollectionMapComponent, InternalLinksDirective],
  selector: 'app-collection-intro',
  templateUrl: './collection-intro.component.html',
  styleUrls: ['./collection-intro.component.scss'],
})
export class CollectionIntroComponent implements OnChanges {
  @Input({ required: true }) collection!: Collection;
  /** The page's listings and bids, to colour the map like cryptopunks.app (no extra requests). */
  @Input() listings: Phunk[] | null = null;
  @Input() bids: Phunk[] | null = null;

  private bandShas = signal<string[]>([]);
  /** Map position (0-based) of each piece, by the first 8 characters of its sha. */
  private place = signal<Map<string, number>>(new Map());
  private listingsSig = signal<Phunk[]>([]);
  private bidsSig = signal<Phunk[]>([]);

  /** The band: each piece linked to its page and labelled with its number on hover. */
  readonly band = computed<BandItem[]>(() => this.bandShas().map((sha) => {
    const i = this.place().get(sha.slice(0, 8));
    if (i === undefined) return { sha, link: null, label: '' };
    const id = this.isV67 ? i + 1 : this.map()?.ids?.[i];
    return { sha, link: this.mapLink(i + 1), label: id != null ? `${this.collection.singleName || this.collection.name} #${id}` : '' };
  }));

  /** Map tiles to colour: red for listed, purple for an active bid (listed wins). */
  readonly marks = computed(() => {
    const place = this.place(), out = new Map<number, 'listed' | 'bid'>();
    const at = (p: Phunk) => (p.sha ? place.get(p.sha.slice(0, 8)) : undefined);
    for (const p of this.bidsSig()) { const i = at(p); if (i !== undefined) out.set(i, 'bid'); }
    for (const p of this.listingsSig()) { const i = at(p); if (i !== undefined) out.set(i, 'listed'); }
    return [...out].map(([i, kind]) => ({ i, kind }));
  });
  readonly counts = signal<Count[]>([]);
  readonly total = signal(0);
  readonly map = signal<MapInfo | null>(null);

  constructor(private dataSvc: DataService, public prefs: PhunkPreferencesService) {}

  get slug() { return this.collection.slug; }

  /** Names for the status colours (scss/abstracts/_variables.scss): the same for every
   *  collection, only the not-for-sale tile differs (v67 blue, the Ethscriptions lime). */
  get colours() {
    const t = (k: string) => this.prefs.t(k);
    return { base: t(this.isV67 ? 'colourBlue' : 'colourLime'), listed: t('colourAqua'), bid: t('colourViolet'), escrow: t('colourYellow') };
  }

  // ---- translated copy (i18n/content.<lang>.ts), rendered with [innerHTML] + appInternalLinks ----

  private fill(html: string) {
    return html.split('{total}').join(this.num(this.total())).split('{name}').join(this.collection?.name ?? '');
  }
  private num(n: number) { return n.toLocaleString(this.prefs.currentLanguage()); }
  private link(path: string, query: Record<string, string>, label: string) {
    const q = new URLSearchParams(query).toString();
    return `<a class="highlight" href="${path}${q ? '?' + q : ''}">${label}</a>`;
  }
  private list(items: string[]) {
    try { return new Intl.ListFormat(this.prefs.currentLanguage(), { type: 'conjunction' }).format(items); }
    catch { return items.join(', '); }
  }

  /** Paragraphs before the band; null when this collection has no written intro. */
  lead(): string[] | null {
    const c = this.prefs.content().intro[this.slug];
    return c ? c.lead.map((p) => this.fill(p)) : null;
  }

  /** Paragraphs after the type breakdown. */
  more(): string[] {
    const c = this.prefs.content();
    const own = c.intro[this.slug];
    return own ? own.more.map((p) => this.fill(p)) : [c.introCommon.tradeDefault];
  }

  /** "At the centre of the collection are the N Turtles…" (v67) or "Across the collection: …". */
  countsHtml(): string {
    const common = this.prefs.content().introCommon;
    const market = `/${this.slug}/market/all`;
    if (this.isV67) {
      const others = this.others.map((a) => this.link(market, { Animal: a.name }, `${this.num(a.count)} ${a.label}`));
      return common.turtles
        .replace('{turtles}', this.link(market, { Animal: 'Turtle' }, `${this.num(this.turtles)} ${this.prefs.t('turtles')}`))
        .replace('{others}', this.list(others));
    }
    const all = this.counts().map((a) => this.link(market, { [this.countKeyName()]: a.name }, `${this.num(a.count)} ${a.label}`));
    return common.across.replace('{list}', this.list(all));
  }

  etherphunksNote(): string {
    return this.fill(this.prefs.content().introCommon.etherphunksNote);
  }

  legend(): string {
    const c = this.colours;
    const sw = (cls: string, label: string) => `<span class="swatch ${cls}">${label}</span>`;
    return this.prefs.content().introCommon.legend
      .replace('{base}', sw('base', c.base)).replace('{listed}', sw('listed', c.listed))
      .replace('{bid}', sw('bid', c.bid)).replace('{escrow}', sw('escrow', c.escrow));
  }
  get isV67() { return this.slug === 'cryptophunksv67'; }
  /** Listed on the EtherPhunks Market contract (the rest trade on our own market contract). */
  get onEtherPhunksMarket() { return ['missing-phunks', 'dysto-phunks', 'phikings'].includes(this.slug); }

  /** The wordmark as inline SVG (wordmarks.ts), so it is there on the first frame with the text. */
  wordmark(): { vb: string; d: string; w: number; ratio: string } | null {
    const s = WORDMARKS[this.slug], p = WORDMARK_PATHS[this.slug];
    return s && p ? { vb: p.vb, d: p.d, w: Math.round(s[0] * WORDMARK_SCALE), ratio: `${s[0]} / ${s[1]}` } : null;
  }

  /** v67 counts by Animal (turtles first); everything else by its type trait. Collections name
   *  it differently (Missing and Dysto use Sex), so of the type-like keys the one most pieces
   *  carry is used. */
  private static readonly TYPE_KEYS = ['sex', 'type', 'phunk type', 'punk type', 'skin type', 'gender'];
  private pickCountKey(attrs: Record<string, any[]>): string {
    if (this.isV67) return 'Animal';
    const seen = new globalThis.Map<string, number>();
    for (const list of Object.values(attrs))
      for (const x of list || [])
        if (x?.k && CollectionIntroComponent.TYPE_KEYS.includes(String(x.k).toLowerCase()))
          seen.set(String(x.k), (seen.get(String(x.k)) || 0) + 1);
    return [...seen].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Type';
  }
  /** The query key a type filters on, as the attribute is named in this collection. */
  readonly countKeyName = signal('Type');
  typeQuery(value: string) { return { [this.countKeyName()]: value }; }
  get turtles() { return this.counts().find((c) => c.name === 'Turtle')?.count ?? 0; }
  get others() { return this.counts().filter((c) => c.name !== 'Turtle'); }

  readonly mapLink = (n: number) => {
    const m = this.map();
    if (this.isV67) return ['/details', ERC721C_CONTRACTS['cryptophunksv67'], n];
    return m?.links?.[n - 1] ?? null;
  };

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['listings']) this.listingsSig.set(this.listings || []);
    if (changes['bids']) this.bidsSig.set(this.bids || []);
    if (!changes['collection'] || !this.collection) return;
    const slug = this.slug;
    this.bandShas.set([]); this.counts.set([]); this.map.set(null); this.place.set(new Map());

    const attrs = await firstValueFrom(this.dataSvc.getAttributes(slug)).catch(() => null);
    if (attrs && slug === this.slug) {
      const by = new globalThis.Map<string, number>();
      const pool: string[] = [];
      const key = this.pickCountKey(attrs as any);
      this.countKeyName.set(key);
      for (const [sha, list] of Object.entries(attrs)) {
        // every value counts: a piece can carry two (a turtle that is also a dog)
        const vals: string[] = [];
        for (const x of list || []) {
          if (x?.k !== key) continue;
          for (const v of [].concat(x.v as any)) if (v != null && v !== '') vals.push(String(v));
        }
        for (const v of vals) by.set(v, (by.get(v) || 0) + 1);
        // v67's band is turtles; every other collection's band is the whole set
        if (!this.isV67 || vals.includes('Turtle')) pool.push(sha);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.bandShas.set(pool.slice(0, 48));
      this.total.set(Object.keys(attrs).length);
      this.counts.set([...by].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        .map(([name, count]) => ({ name, count, label: plural(name, count) })));
    }

    // the map and its position list (scripts/build-v67-map.py, scripts/build-collection-maps.py)
    try {
      const r = await fetch(`assets/maps/${slug}.json`);
      if (r.ok && slug === this.slug) {
        const j = await r.json();
        const place = new Map<string, number>();
        for (let i = 0; i * 8 < (j.shas || '').length; i++) place.set(j.shas.slice(i * 8, i * 8 + 8), i);
        this.map.set({ src: `assets/maps/${slug}.webp`, cols: j.cols, rows: j.rows, smooth: !!j.smooth, tile: j.tile, links: j.links ?? null, ids: j.ids ?? null });
        this.place.set(place);
      }
    } catch {}
  }
}
