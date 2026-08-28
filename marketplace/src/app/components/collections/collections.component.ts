import { Component, inject } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

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
    'cryptophunksv67',
    'ethereumphunks',
    'etherphunks',
    // Superseded by the OG collections they were re-issued from, which are listed
    // instead. Hidden here as well as in the dropdown so the two agree.
    'quantummissingphunksv67',
    'quantumdystophunkzv67',
  ]);

  collections$ = combineLatest([
    this.store.select(selectCollections),
    this.store.select(appStateSelectors.selectConfig),
  ]).pipe(
    filter(([collections]) => !!collections),
    map(([collections, config]) => {
      const hiddenSlugs = new Set(config?.hiddenSlugs || []);
      const filtered = collections.filter(c =>
        !this.permanentlyHiddenSlugs.has(c.slug) && !hiddenSlugs.has(c.slug)
      );
      const ethsRocks = filtered.filter(c => c.slug === 'ethsrocks');
      const rest = filtered.filter(c => c.slug !== 'ethsrocks');
      return [...ethsRocks, ...rest];
    })
  )

  constructor(
    private dataSvc: DataService,
    private store: Store<GlobalState>
  ) {}

}
