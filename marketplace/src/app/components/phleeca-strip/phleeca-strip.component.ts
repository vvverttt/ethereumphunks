import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import { GlobalState } from '@/models/global-state';
import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { FiatPipe } from '@/pipes/fiat.pipe';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

/**
 * Phleeca Bank's banner on a collection's owned page: the bank's logo on white, then the account
 * bar: whose pieces, how many, the collection's floor and their value at it. The floor comes from
 * the same shared read as the bank's.
 */
@Component({
  standalone: true,
  imports: [CommonModule, WalletAddressDirective, FiatPipe],
  selector: 'app-phleeca-strip',
  templateUrl: './phleeca-strip.component.html',
  styleUrls: ['./phleeca-strip.component.scss'],
})
export class PhleecaStripComponent implements OnChanges {
  private dataSvc = inject(DataService);
  private prefs = inject(PhunkPreferencesService);
  private store = inject(Store<GlobalState>);

  /** the wallet whose pieces the page shows */
  @Input() address = '';
  /** the collection */
  @Input() slug = '';
  /** how many of its pieces the wallet holds */
  @Input() count: number | null = 0;

  floor = signal<number | null>(null);
  usd = toSignal(this.store.select(dataStateSelectors.selectDisplayUsd));

  async ngOnChanges() {
    try { this.floor.set((await this.dataSvc.fetchFloorStats()).floors[this.slug] ?? null); } catch { this.floor.set(null); }
  }

  value(): number | null {
    const f = this.floor();
    return f && this.count !== null ? f * this.count : null;
  }

  eth(v: number | null): string {
    return v === null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 4 });
  }

  t(key: string, params?: Record<string, string | number>) {
    return this.prefs.t(key, params);
  }
}
