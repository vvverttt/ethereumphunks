import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';

import { environment } from 'src/environments/environment';
import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { MarketFiltersComponent } from '@/components/market-filters/market-filters.component';
import { AttributeFilterPipe } from '@/pipes/attribute-filter';

import { DataService } from '@/services/data.service';
import { GlobalState, TraitFilter } from '@/models/global-state';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import * as marketStateActions from '@/state/actions/market-state.actions';

import { Subscription, combineLatest, map } from 'rxjs';
import { supabase } from '@/services/supabase';

const VAULT_ADDRESS = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218' as `0x${string}`;

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, PhunkGridComponent, MarketFiltersComponent, AttributeFilterPipe, DecimalPipe],
  selector: 'app-vault-all',
  templateUrl: './vault-all.component.html',
  styleUrls: ['./vault-all.component.scss'],
})
export class VaultAllComponent implements OnInit, OnDestroy {
  items = signal<any[]>([]);
  filtersVisible = false;
  traitFilters: TraitFilter | null = null;

  objectKeys = Object.keys;

  private sub = new Subscription();

  constructor(
    private store: Store<GlobalState>,
    private dataSvc: DataService,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit() {
    // Load all vault items
    const results: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId,sha,tokenId')
        .eq('slug', 'cryptophunksv67')
        .eq('owner', VAULT_ADDRESS.toLowerCase())
        .order('tokenId', { ascending: false })
        .range(offset, offset + 999);
      if (!data?.length) break;
      results.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // Load attributes and merge with items
    this.dataSvc.getAttributes('cryptophunksv67').subscribe(attrMap => {
      const withAttrs = results.map(item => ({
        ...item,
        attributes: attrMap?.[item.sha] || [],
      }));
      this.items.set(withAttrs);
    });

    // Dispatch initial query params as trait filters so MarketFiltersComponent shows active state
    const queryParams = this.route.snapshot.queryParams;
    const initialFilters: any = {};
    Object.keys(queryParams).forEach(k => { initialFilters[k] = queryParams[k]; });
    this.store.dispatch(marketStateActions.setActiveTraitFilters({ traitFilters: initialFilters }));

    // Subscribe to trait filter changes + globalConfig preset, merge them
    this.sub.add(
      combineLatest([
        this.store.select(marketStateSelectors.selectActiveTraitFilters),
        this.store.select(appStateSelectors.selectConfig),
      ]).pipe(
        map(([filters, config]) => {
          const f: any = { ...filters };
          delete f['address'];
          const userFilters = Object.keys(f).length ? f as TraitFilter : null;
          const preset = config?.collectionTraitFilters?.['cryptophunksv67'] ?? {};
          if (!Object.keys(preset).length) return userFilters;
          return { ...preset, ...userFilters } as TraitFilter;
        })
      ).subscribe(filters => {
        this.traitFilters = filters;
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
