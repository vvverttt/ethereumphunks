import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap, catchError, of, startWith, filter, tap, ignoreElements, merge, share } from 'rxjs';
import { environment } from 'src/environments/environment';
import { visibleTimer } from '@/utils/visible-interval';

/** how often the gas price is read, at most */
const GAS_EVERY_MS = 15 * 60_000;

export interface GasData {
  FastGasPrice: string;
  LastBlock: string;
  ProposeGasPrice: string;
  SafeGasPrice: string;
  gasUsedRatio: string;
  suggestBaseFee: string;
}

@Injectable({
  providedIn: 'root',
})
export class GasService {
  private http = inject(HttpClient);
  private relayRpcUrl = `${environment.relayUrl}/rpc`;
  private gasRpcUrls = [
    (environment as any).receiptRpcUrl || environment.rpcHttpProvider,
    environment.rpcHttpProvider,
    this.relayRpcUrl,
    'https://rpc.ankr.com/eth/545e600765426a4f17b1d59db878210f81e6fecbe581c0a745a7068c62fc1eb8',
  ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

  private gasSubject = new BehaviorSubject<GasData>({
    ProposeGasPrice: '...',
    FastGasPrice: '...',
    SafeGasPrice: '...',
    LastBlock: '0',
    gasUsedRatio: '0',
    suggestBaseFee: '...'
  });

  private lastFetch = 0;

  /** the last reading, kept in the browser so a reload or another tab within 15 minutes reuses it */
  private static readonly CACHE_KEY = 'gas-price';
  constructor() {
    try {
      const c = JSON.parse(localStorage.getItem(GasService.CACHE_KEY) || 'null');
      if (c?.data && Date.now() - c.at < GAS_EVERY_MS) { this.lastFetch = c.at; this.gasSubject.next(c.data); }
    } catch { /* storage blocked: read live */ }
  }

  // Polls only while something is showing the price — the status bar, which lives in the menu
  // and is rendered only while the menu is open — at most once every 15 minutes, and not in a
  // hidden tab. The number is informational (wallets price their own transactions) and the first
  // RPC tried is a keyed Alchemy one. Opening the menu shows the last price at once and refreshes
  // it only if it is more than 15 minutes old, so opening and closing it never refetches,
  // and nor do reloads or other tabs (the reading is kept in the browser).
  private poll$ = visibleTimer(GAS_EVERY_MS).pipe(
    startWith(undefined),
    filter(() => Date.now() - this.lastFetch > GAS_EVERY_MS),
    switchMap(() => this.fetchGasPrice()),
    // a failed read isn't counted, so the next menu open tries again
    tap((data) => {
      if (data.ProposeGasPrice !== 'err') {
        this.lastFetch = Date.now();
        try { localStorage.setItem(GasService.CACHE_KEY, JSON.stringify({ at: this.lastFetch, data })); } catch {}
      }
      this.gasSubject.next(data);
    }),
    ignoreElements(),
  );

  gas$ = merge(this.gasSubject, this.poll$).pipe(share());

  private fetchGasPrice(): Observable<GasData> {
    return this.fetchGasPriceFromRpc(0);
  }

  private fetchGasPriceFromRpc(index: number): Observable<GasData> {
    const rpcUrl = this.gasRpcUrls[index];
    if (!rpcUrl) {
      return of(this.errorData());
    }

    return this.http.post<any>(rpcUrl, {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 1
    }).pipe(
      switchMap(response => {
        if (!response?.result) {
          return index < this.gasRpcUrls.length - 1
            ? this.fetchGasPriceFromRpc(index + 1)
            : of(this.errorData());
        }

        try {
          const gasPriceWei = parseInt(response.result, 16);
          const gasPriceGwei = (gasPriceWei / 1e9).toFixed(2);

          const gasData: GasData = {
            ProposeGasPrice: gasPriceGwei,
            FastGasPrice: (parseFloat(gasPriceGwei) * 1.2).toFixed(2),
            SafeGasPrice: (parseFloat(gasPriceGwei) * 0.8).toFixed(2),
            LastBlock: '0',
            gasUsedRatio: '0',
            suggestBaseFee: gasPriceGwei
          };

          return of(gasData);
        } catch {
          return index < this.gasRpcUrls.length - 1
            ? this.fetchGasPriceFromRpc(index + 1)
            : of(this.errorData());
        }
      }),
      catchError(() => (
        index < this.gasRpcUrls.length - 1
          ? this.fetchGasPriceFromRpc(index + 1)
          : of(this.errorData())
      ))
    );
  }

  private errorData(): GasData {
    return {
      ProposeGasPrice: 'err',
      FastGasPrice: 'err',
      SafeGasPrice: 'err',
      LastBlock: '0',
      gasUsedRatio: '0',
      suggestBaseFee: 'err'
    };
  }

  connect(): this {
    return this;
  }
}
