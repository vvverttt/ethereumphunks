import { Component } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';

import { combineLatest, filter, firstValueFrom, map } from 'rxjs';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterModule,
  ],
  selector: 'app-collections-dropdown',
  templateUrl: './collections-dropdown.component.html',
  styleUrl: './collections-dropdown.component.scss'
})
export class CollectionsDropdownComponent {
  // The QuantumPhunks re-issues are hidden in favour of the OG collections they came
  // from — the dropdown used to do the opposite and hide `environment.ogSlugs`.
  private readonly hiddenDropdownSlugs = new Set([
    'quantummissingphunksv67',
    'quantumdystophunkzv67',
    'ethereumphunks',
    'etherphunks',
  ]);

  collections$ = combineLatest([
    this.store.select(dataStateSelectors.selectCollections),
    this.store.select(appStateSelectors.selectConfig),
  ]).pipe(
    filter(([collections]) => !!collections),
    map(([collections, config]) => {
      const hiddenSlugs = new Set(config?.hiddenSlugs || []);
      const filtered = (collections ?? []).filter((c: any) =>
        !hiddenSlugs.has(c.slug) && !this.hiddenDropdownSlugs.has(c.slug)
      );
      const ethsRocks = filtered.filter((c: any) => c.slug === 'ethsrocks');
      const rest = filtered.filter((c: any) => c.slug !== 'ethsrocks');
      return [...ethsRocks, ...rest];
    })
  );

  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);
  dropdownActive$ = this.store.select(appStateSelectors.selectCollectionsMenuActive);

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public router: Router
  ) {}

  async toggleDropdown(): Promise<void> {
    const isActive = await firstValueFrom(
      this.store.select(appStateSelectors.selectCollectionsMenuActive)
    );
    this.store.dispatch(appStateActions.setCollectionsMenuActive({ collectionsMenuActive: !isActive }));
  }
}
