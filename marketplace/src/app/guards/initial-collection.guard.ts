import { Component, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
@Component({
  standalone: true,
  template: '',
})
export class InitialCollectionGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    const marketType = route.paramMap.get('marketType');

    return of(
      marketType
        ? this.router.createUrlTree(['/ethsrocks/market', marketType])
        : this.router.createUrlTree(['/ethsrocks'])
    );
  }
}
