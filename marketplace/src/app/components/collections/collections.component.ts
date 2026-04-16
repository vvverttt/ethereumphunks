import { Component } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';

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

  collections$ = combineLatest([
    this.store.select(selectCollections),
    this.store.select(appStateSelectors.selectConfig),
  ]).pipe(
    filter(([collections]) => !!collections),
    map(([collections, config]) => {
      const hiddenSlugs = new Set(config?.hiddenSlugs || []);
      const filtered = collections.slice(1).filter(c => !hiddenSlugs.has(c.slug));
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
