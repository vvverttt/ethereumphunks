import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';
import { isAdminWallet } from '@/constants/admin-wallets';

import * as appStateActions from '@/state/actions/app-state.actions';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import * as marketStateSelectors from '@/state/selectors/market-state.selectors';

import { filter, map, switchMap, take, withLatestFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

import * as marketStateActions from '@/state/actions/market-state.actions';

@Injectable()
export class DataStateEffects {

  fetchCollections$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchCollections),
    switchMap(() => this.dataSvc.fetchCollections().pipe(
      map((collections) => dataStateActions.setCollections({ collections })),
    )),
  ));

  fetchDisabledCollections$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter((action) => {
      if (!action.walletAddress) return !environment.production;
      return isAdminWallet(action.walletAddress);
    }),
    switchMap(() => this.store.select(dataStateSelectors.selectCollections).pipe(
      filter((collections) => collections.length > 0),
      take(1),
      switchMap((collections) => this.dataSvc.fetchDisabledCollections().pipe(
        filter(disabledCollections => disabledCollections.length > 0),
        map((disabledCollections) => {
          // Filter out disabled collections that already exist in collections
          const newDisabledCollections = disabledCollections.filter(
            disabled => !collections.some(existing => existing.slug === disabled.slug)
          );
          return dataStateActions.setCollections({
            collections: [...collections, ...newDisabledCollections]
          });
        }),
      )),
    )),
  ));

  setActiveCollection$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.setCollections, marketStateActions.setMarketSlug),
    withLatestFrom(
      this.store.select(dataStateSelectors.selectCollections),
      this.store.select(marketStateSelectors.selectMarketSlug),
    ),
    map(([action, collections, slug]) => {
      if (!collections || collections.length === 0) return null;
      const targetSlug = slug || environment.defaultCollection;
      return collections.find((c) => c.slug === targetSlug)
        || collections.find((c) => c.slug === environment.defaultCollection)
        || collections[0]
        || null;
    }),
    filter((activeCollection) => !!activeCollection),
    map((activeCollection) => dataStateActions.setActiveCollection({ activeCollection: { ...activeCollection! } }))
  ));

  fetchLeaderboard$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchLeaderboard),
    // tap(() => console.log('fetchLeaderboard')),
    switchMap(() => this.dataSvc.fetchLeaderboard()),
    map((leaderboard) => dataStateActions.setLeaderboard({ leaderboard })),
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService
  ) {}
}
