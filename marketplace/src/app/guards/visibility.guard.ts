import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, of, take, timeout } from 'rxjs';

import { GlobalState, GlobalConfig } from '@/models/global-state';
import { selectConfig } from '@/state/selectors/app-state.selectors';

/**
 * Route guards that enforce the admin visibility flags at the ROUTE level, not just
 * in the nav. Hiding a feature/collection in config previously only removed its links
 * — the route (/lottery, /auction, /:slug/market/...) still loaded from a direct URL.
 *
 * Both guards wait for the REAL config: the initial store default has network === null,
 * and Supabase fills it with the chainId on load. A short timeout keeps a slow/failed
 * config fetch from hanging navigation — features fail CLOSED (stay hidden), collection
 * pages fail OPEN (the main site never gets stuck behind a config outage).
 *
 * Admins with admin_preview on are unaffected: DataService already forces every flag on
 * and clears hiddenSlugs for them, so this reads through to "allow".
 */
type FeatureFlag = 'showLottery' | 'showAuction' | 'showPhunkSwap' | 'showMutate' | 'showDevolve';

const CONFIG_WAIT_MS = 3000;

/** Guard factory: allow only when the given visibility flag is on. */
export function featureVisibleGuard(flag: FeatureFlag): CanActivateFn {
  return () => {
    const store = inject(Store<GlobalState>);
    const router = inject(Router);
    const home = router.createUrlTree(['/']);
    return store.select(selectConfig).pipe(
      filter((c): c is GlobalConfig => !!c && c.network !== null),
      take(1),
      timeout({ first: CONFIG_WAIT_MS, with: () => of(null) }),
      map((c) => (c && c[flag]) ? true : home), // unknown → hide (fail closed)
    );
  };
}

/** Guard: block the route when its :slug is in hiddenSlugs. */
export const hiddenSlugGuard: CanActivateFn = (route) => {
  const store = inject(Store<GlobalState>);
  const router = inject(Router);
  const slug = route.paramMap.get('slug');
  return store.select(selectConfig).pipe(
    filter((c): c is GlobalConfig => !!c && c.network !== null),
    take(1),
    timeout({ first: CONFIG_WAIT_MS, with: () => of(null) }),
    map((c) => {
      if (!c) return true; // unknown → don't strand the main site (fail open)
      return (slug && (c.hiddenSlugs || []).includes(slug))
        ? router.createUrlTree(['/'])
        : true;
    }),
  );
};
