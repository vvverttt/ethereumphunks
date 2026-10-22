import { Component, inject } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { tokenNumber } from '@/pipes/token-number.pipe';

import { PhunkGridComponent } from '../phunk-grid/phunk-grid.component';
import { selectCollections } from '@/state/selectors/data-state.selectors';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { combineLatest, filter, map } from 'rxjs';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterLink,

    PhunkGridComponent
  ],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.scss'
})
export class CollectionsComponent {
  // The heading was hardcoded English while the menu entry for the same page used
  // t('curatedCollections'), so the two could say different things. Both read the key now.
  private readonly preferences = inject(PhunkPreferencesService);

  t(key: string): string {
    return this.preferences.t(key);
  }

  private readonly permanentlyHiddenSlugs = new Set([
    'ethereumphunks',
    'etherphunks',
    // Superseded by the OG collections they were re-issued from, which are listed
    // instead. Hidden here as well as in the dropdown so the two agree.
    'quantummissingphunksv67',
    'quantumdystophunkzv67',
  ]);

  /**
   * Where each collection sits in the CryptoPhunksV67 numbering. Shown in place of its name, and
   * the list follows it: EthsRocks count down from 0, QuantumPhunks run from 1, and each drop
   * after them carries on from the last. A collection not listed here shows its name, last.
   */
  private readonly numbering: Record<string, [number, number]> = {
    ethsrocks: [0, -105],
    cryptophunksv67: [1, 10000],
    'missing-phunks': [10000, 10250],
    'dysto-phunks': [10251, 10319],
    phikings: [10320, 10386],
    phunklloween: [10387, 10453],
  };

  collections$ = combineLatest([
    this.store.select(selectCollections),
    this.store.select(appStateSelectors.selectConfig),
  ]).pipe(
    filter(([collections]) => !!collections),
    map(([collections, config]) => {
      const hiddenSlugs = new Set(config?.hiddenSlugs || []);
      const order = Object.keys(this.numbering);
      const rank = (slug: string) => {
        const i = order.indexOf(slug);
        return i < 0 ? order.length : i;
      };
      return collections
        .filter(c => !this.permanentlyHiddenSlugs.has(c.slug) && !hiddenSlugs.has(c.slug))
        .sort((a, b) => rank(a.slug) - rank(b.slug))
        .map(c => ({ ...c, label: this.label(c.slug, c.name) }));
    })
  )

  private label(slug: string, name: string): string {
    const range = this.numbering[slug];
    return range ? `#${tokenNumber(range[0], slug)} – #${tokenNumber(range[1], slug)}` : name;
  }

  constructor(
    private dataSvc: DataService,
    private store: Store<GlobalState>
  ) {}

}
