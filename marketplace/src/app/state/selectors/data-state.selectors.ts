import { DataState } from '@/models/data.state';
import { GlobalState } from '@/models/global-state';
import { createSelector } from '@ngrx/store';

import { selectConfig } from './app-state.selectors';

export const selectDataState = (state: GlobalState) => state.dataState;

export const selectUsd = createSelector(
  selectDataState,
  (appState: DataState) => appState.usd
);

// USD value used for display — null when the admin has hidden USD site-wide,
// so templates can collapse to ETH-only (no "$0") via `@if (usd$ | async; as usd)`.
export const selectDisplayUsd = createSelector(
  selectUsd,
  selectConfig,
  (usd, config) => (config?.hideUsd ? null : usd)
);

export const selectEvents = createSelector(
  selectDataState,
  (appState: DataState) => appState.events
);

// export const selectUserOpenBids = createSelector(
//   selectDataState,
//   (appState: DataState) => appState.userOpenBids
// );

export const selectLeaderboard = createSelector(
  selectDataState,
  (appState: DataState) => appState.leaderboard
);

export const selectCollections = createSelector(
  selectDataState,
  (appState: DataState) => appState.collections
);

export const selectActiveCollection = createSelector(
  selectDataState,
  (appState: DataState) => appState.activeCollection
);
