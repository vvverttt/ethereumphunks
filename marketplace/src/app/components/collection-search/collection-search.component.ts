import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DataService } from '@/services/data.service';
import { ERC721C_CONTRACTS } from '@/constants/erc721c';

import { Collection } from '@/models/data.state';

/**
 * "Search <collection>", under the Q&A like cryptopunks.app's "Search Punks". Plain words become
 * trait filters: "turtle and hoodie" opens the market filtered to Animal = Turtle and every Hair
 * value containing "hoodie". A number opens that piece. It reads the attributes file the site
 * already loads, so a search costs no request until the market page loads its results.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-collection-search',
  template: `
    <h3>Search {{ collection.name }}</h3>
    <form class="search" (ngSubmit)="search()">
      <input type="text" name="q" [(ngModel)]="q" [placeholder]="placeholder"
        autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" />
      <button type="submit">Search</button>
    </form>
    @if (error()) { <p class="error">{{ error() }}</p> }
  `,
  styles: [`
    :host { display: block; }
    h3 { margin: 0; padding-bottom: 2rem; font-size: 2.4rem; }
    .search {
      display: flex;
      max-width: 96rem;
      input {
        flex: 1;
        min-width: 0;
        height: 4.6rem;
        padding: 0 1.2rem;
        font: inherit;
        font-size: 1.6rem;
        color: rgba(var(--text-color), 1);
        background: transparent;
        border: .1rem solid rgba(var(--text-color), .6);
        border-right: 0;
        outline: none;
        &:focus { border-color: rgba(var(--pink), 1); }
      }
      button {
        padding: 0 3.2rem;
        font: inherit;
        font-size: 1.6rem;
        font-weight: 700;
        color: rgba(var(--white), 1);
        background: rgba(var(--pink), 1);
        border: 0;
        cursor: pointer;
      }
    }
    .error { margin: 1rem 0 0; font-size: 1.4rem; color: rgba(var(--pink), 1); }
  `],
})
export class CollectionSearchComponent implements OnChanges {
  @Input({ required: true }) collection!: Collection;

  q = '';
  readonly error = signal('');
  /** trait key -> its values, from the attributes file */
  private traits = new Map<string, Set<string>>();
  /** how many pieces carry each "key\0value" */
  private counts = new Map<string, number>();

  constructor(private dataSvc: DataService, private router: Router) {}

  get placeholder() {
    return this.collection.slug === 'cryptophunksv67'
      ? `Try things like 'turtle' or 'turtle and hoodie', or a number`
      : `Try things like 'zombie' or 'zombie and beard', or a number`;
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (!changes['collection']) return;
    this.traits.clear(); this.counts.clear(); this.error.set('');
    const attrs = await firstValueFrom(this.dataSvc.getAttributes(this.collection.slug)).catch(() => null);
    for (const list of Object.values(attrs || {})) {
      for (const a of list || []) {
        if (!a?.k) continue;
        for (const v of [].concat(a.v as any)) {
          if (v == null || v === '') continue;
          const key = String(a.k), val = String(v);
          if (!this.traits.has(key)) this.traits.set(key, new Set());
          this.traits.get(key)!.add(val);
          const id = key + '\u0000' + val;
          this.counts.set(id, (this.counts.get(id) || 0) + 1);
        }
      }
    }
  }

  async search() {
    this.error.set('');
    const q = this.q.trim().toLowerCase();
    if (!q) return;
    const slug = this.collection.slug;

    // a number: that piece
    const num = q.replace(/^#/, '');
    if (/^\d+$/.test(num)) {
      if (slug === 'cryptophunksv67') { this.router.navigate(['/details', ERC721C_CONTRACTS[slug], Number(num)]); return; }
      try {
        const j = await (await fetch(`assets/maps/${slug}.json`)).json();
        const i = (j.ids || []).indexOf(Number(num));
        if (i >= 0) { this.router.navigateByUrl(j.links[i]); return; }
      } catch {}
      this.error.set(`No ${this.collection.singleName || this.collection.name} #${num} here.`);
      return;
    }

    // words: each term becomes a trait filter; terms are joined with "and", commas or "+"
    const params: Record<string, string[]> = {};
    for (const term of q.split(/\s+and\s+|\s*[,+]\s*/).map((t) => t.trim()).filter(Boolean)) {
      const hit = this.match(term);
      if (!hit) { this.error.set(`No trait matches "${term}".`); return; }
      params[hit.key] = [...new Set([...(params[hit.key] || []), ...hit.values])];
    }
    this.router.navigate(['/', slug, 'market', 'all'], { queryParams: params });
  }

  /** The values a term means, all under the one trait key most pieces carry them in: an exact
   *  value first ("zombie"), else every value containing the term as a word ("beard"). */
  private match(term: string): { key: string; values: string[] } | null {
    const word = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    for (const exact of [true, false]) {
      let best: { key: string; values: string[]; n: number } | null = null;
      for (const [key, vals] of this.traits) {
        const values = [...vals].filter((v) => exact ? v.toLowerCase() === term : word.test(v));
        if (!values.length) continue;
        const n = values.reduce((s, v) => s + (this.counts.get(key + '\u0000' + v) || 0), 0);
        if (!best || n > best.n) best = { key, values, n };
      }
      if (best) return { key: best.key, values: best.values };
    }
    return null;
  }
}
