import { Component, effect, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { CommonModule, Location, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { IsNumberPipe } from '@/pipes/is-number';
import { GlobalState } from '@/models/global-state';

import { setActiveTraitFilters } from '@/state/actions/market-state.actions';
import { selectActiveTraitFilters } from '@/state/selectors/market-state.selectors';

import { tap } from 'rxjs';
@Component({
  selector: 'app-market-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    IsNumberPipe,
    TitleCasePipe,
  ],
  templateUrl: './market-filters.component.html',
  styleUrls: ['./market-filters.component.scss']
})

export class MarketFiltersComponent {

  slug = input.required<string | undefined>();

  filterData: { [key: string]: string[] | number[] } = {};
  traitCount!: number;
  objectKeys = Object.keys;

  activeTraitFilters: any = {};
  activeTraitFilters$ = this.store.select(selectActiveTraitFilters).pipe(
    tap((filters) => {
      const newFilters = { ...filters };
      delete newFilters.address;
      this.activeTraitFilters = { ...newFilters };
    }),
  );

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    private location: Location,
    private router: Router,
    private route: ActivatedRoute,
    public preferences: PhunkPreferencesService,
  ) {
    effect(async () => {
      const slug = this.slug();
      if (!slug) return;
      const filters = await this.dataSvc.getFilters(slug);
      this.filterData = filters || {};
    });
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  selectFilter($event: any): void {
    const filters = { ...this.activeTraitFilters };
    let urlParams = new HttpParams();

    // Preserve address param so owned route still works on reload
    const currentAddress = this.route.snapshot.queryParams['address'];
    if (currentAddress) urlParams = urlParams.append('address', currentAddress);

    Object.keys(filters).forEach((key) => {
      if (filters[key] === null) delete filters[key];
      if (filters[key]) urlParams = urlParams.append(key, filters[key]);
    });

    this.location.go(this.location.path().split('?')[0], urlParams.toString());
    this.store.dispatch(setActiveTraitFilters({ traitFilters: { ...filters } }));
  }

  clearFilters() {
    const activeParams = this.route.snapshot.queryParams;
    const newParams = activeParams.address ? { address: activeParams.address } : {};
    this.router.navigate([], { queryParams: newParams });
  }
}
