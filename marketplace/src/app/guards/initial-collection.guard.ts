import { Component, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { Observable, filter, map, take } from 'rxjs';
import { Store } from '@ngrx/store';

import { selectConfig } from '@/state/selectors/app-state.selectors';
import { GlobalState } from '@/models/global-state';

@Injectable({
  providedIn: 'root'
})
@Component({
  standalone: true,
  template: '',
})
export class InitialCollectionGuard implements CanActivate {

  constructor(
    private store: Store<GlobalState>,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.store.select(selectConfig).pipe(
      filter(config => !!config),
      take(1),
      map(config => {
        const hiddenSlugs = new Set(config.hiddenSlugs || []);
        const defaultSlug = hiddenSlugs.has('cryptophunksv67')
          ? 'ethsrocks'
          : (config.defaultCollection || 'cryptophunksv67');
        const marketType = route.paramMap.get('marketType');

        return marketType
          ? this.router.createUrlTree([`/${defaultSlug}/market/${marketType}`])
          : this.router.createUrlTree([`/${defaultSlug}`]);
      })
    );
  }
}
