import { Component, effect, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { CommonModule, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { IsNumberPipe } from '@/pipes/is-number';
import { GlobalState, TraitFilter } from '@/models/global-state';

import { setActiveTraitFilters } from '@/state/actions/market-state.actions';
import { selectActiveTraitFilters } from '@/state/selectors/market-state.selectors';

import { tap } from 'rxjs';

@Component({
  selector: 'app-market-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IsNumberPipe,
    TitleCasePipe,
  ],
  templateUrl: './market-filters.component.html',
  styleUrls: ['./market-filters.component.scss']
})

export class MarketFiltersComponent {

  slug = input.required<string | undefined>();

  filterData: { [key: string]: string[] | number[] } = {};
  objectKeys = Object.keys;

  /** Selected values per trait key. Several per key = OR within that trait. */
  activeTraitFilters: TraitFilter = {};

  /** Which accordion groups are expanded. Groups with a selection open by default. */
  private openGroups = new Set<string>();

  activeTraitFilters$ = this.store.select(selectActiveTraitFilters).pipe(
    tap((filters) => {
      const newFilters = { ...filters };
      delete newFilters['address'];
      this.activeTraitFilters = { ...newFilters };
      // Keep any group that carries a selection visible after a reload / URL entry.
      Object.keys(newFilters).forEach((k) => {
        if (this.valuesFor(k).length) this.openGroups.add(k);
      });
    }),
  );

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    public preferences: PhunkPreferencesService,
  ) {
    effect(async () => {
      const slug = this.slug();
      if (!slug) return;
      const filters = await this.dataSvc.getFilters(slug);
      this.filterData = filters || {};

      // Populate DataService.rarityCache (a "Trait:Value" -> count map it builds
      // from the attributes file) so each option can show how many items carry it.
      this.dataSvc.getAttributes(slug).subscribe(() => {
        this.rarity = this.dataSvc.rarityCache.get(slug) || {};
      });
    });
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  /** Normalise a filter entry to an array — values arrive as string, string[] or null. */
  private valuesFor(key: string): string[] {
    const v = this.activeTraitFilters[key];
    if (v == null) return [];
    return Array.isArray(v) ? v.filter((x) => x != null) : [v];
  }

  isChecked(key: string, value: string): boolean {
    return this.valuesFor(key).includes(value);
  }

  countFor(key: string): number {
    return this.valuesFor(key).length;
  }

  /** How many selectable values this trait has — the number shown beside the
   *  trait name. Numeric entries are excluded to match what the list renders. */
  optionCount(key: string): number {
    return this.allOptions(key).length;
  }

  private allOptions(key: string): string[] {
    const opts = this.filterData[key] as (string | number)[] | undefined;
    if (!opts) return [];
    return opts
      .filter((o) => o !== null && o !== undefined && isNaN(Number(o)))
      .map((o) => o.toString())
      // "none" (match items lacking this trait) isn't useful here — drop it.
      .filter((o) => o.toLowerCase() !== 'none');
  }

  /** Groups past this size get a search box — this collection has traits with
   *  500+ distinct values (Character 562, Hair 507), which is unusable as a
   *  flat checkbox list. */
  readonly SEARCHABLE_AT = 12;

  groupSearch: { [key: string]: string } = {};

  /** "Trait:Value" -> how many items in the collection carry it. */
  rarity: Record<string, number> = {};

  /** How many items have this exact trait value — the rarity number per option. */
  rarityFor(key: string, value: string): number {
    return this.rarity[`${key}:${value}`] ?? 0;
  }

  searchable(key: string): boolean {
    return this.optionCount(key) > this.SEARCHABLE_AT;
  }

  /** Options to render for a group: search-filtered, but anything already
   *  checked stays visible so a selection can never be hidden by the query. */
  visibleOptions(key: string): string[] {
    const q = (this.groupSearch[key] || '').trim().toLowerCase();
    const all = this.allOptions(key);
    if (!q) return all;
    const selected = this.valuesFor(key);
    return all.filter((o) => o.toLowerCase().includes(q) || selected.includes(o));
  }

  get selectedCount(): number {
    return Object.keys(this.activeTraitFilters).reduce((n, k) => n + this.valuesFor(k).length, 0);
  }

  isOpen(key: string): boolean {
    return this.openGroups.has(key);
  }

  toggleGroup(key: string): void {
    if (this.openGroups.has(key)) this.openGroups.delete(key);
    else this.openGroups.add(key);
  }

  /** Check / uncheck one value. Multiple within a trait are kept as an array. */
  toggleValue(key: string, value: string): void {
    const current = this.valuesFor(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    const filters: TraitFilter = { ...this.activeTraitFilters };
    if (!next.length) delete filters[key];
    // Collapse a single selection back to a plain string so ?key=value URLs and
    // preset filters stay in the shape the rest of the app already expects.
    else filters[key] = next.length === 1 ? next[0] : next;

    this.activeTraitFilters = filters;
    this.commit(filters);
  }

  private commit(filters: TraitFilter): void {
    let urlParams = new HttpParams();

    // Preserve address param so owned route still works on reload
    const currentAddress = this.route.snapshot.queryParams['address'];
    if (currentAddress) urlParams = urlParams.append('address', currentAddress);

    Object.entries(filters).forEach(([key, value]) => {
      if (value == null) return;
      // Repeated params (?Animal=Turtle&Animal=Lion) — Angular parses these back
      // into an array, which round-trips straight into a multi-select.
      (Array.isArray(value) ? value : [value]).forEach((v) => {
        if (v != null) urlParams = urlParams.append(key, v);
      });
    });

    // replaceState, not go(): each toggle would otherwise push a history entry,
    // so after checking six traits it takes six Back presses to leave the page.
    // Replacing keeps the current entry in sync with the selection instead, so
    // opening an item and coming back returns to the same filtered view.
    this.location.replaceState(this.location.path().split('?')[0], urlParams.toString());
    this.store.dispatch(setActiveTraitFilters({ traitFilters: { ...filters } }));
  }

  clearFilters() {
    const activeParams = this.route.snapshot.queryParams;
    const newParams = activeParams['address'] ? { address: activeParams['address'] } : {};
    this.activeTraitFilters = {};
    this.openGroups.clear();
    this.router.navigate([], { queryParams: newParams });
  }
}
