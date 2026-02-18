import { Component } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';

import { PhunkGridComponent } from '../phunk-grid/phunk-grid.component';
import { selectCollections } from '@/state/selectors/data-state.selectors';
import { filter, map } from 'rxjs';

const HIDDEN_SLUGS = new Set(['og-missing-phunks', 'og-dysto-phunks']);

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

  collections$ = this.store.select(selectCollections).pipe(
    filter(collections => !!collections),
    map(collections => {
      return collections.slice(1).filter(c => !HIDDEN_SLUGS.has(c.slug));
    })
  )

  constructor(
    private dataSvc: DataService,
    private store: Store<GlobalState>
  ) {

  }

}
