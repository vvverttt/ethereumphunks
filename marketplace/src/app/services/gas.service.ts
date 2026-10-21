import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap, catchError, of, startWith } from 'rxjs';
import { environment } from 'src/environments/environment';
import { visibleTimer } from '@/utils/visible-interval';

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
    'https://rpc.ankr.com/eth/229b890a1dea15c5330378688e793eb0c44185c264c00144c928240d7cb0ec3f',
  ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

  private gasSubject = new BehaviorSubject<GasData>({
    ProposeGasPrice: '...',
    FastGasPrice: '...',
    SafeGasPrice: '...',
    LastBlock: '0',
    gasUsedRatio: '0',
    suggestBaseFee: '...'
  });

  gas$ = this.gasSubject.asObservable();

  constructor() {
    // Every 2 minutes while the tab is visible — the number is informational (wallets price
    // their own transactions) and the first RPC tried is a keyed Alchemy one. Hidden tabs make
    // no calls, and coming back to the tab refreshes it straight away.
    visibleTimer(120_000)
      .pipe(
        startWith(undefined),
        switchMap(() => this.fetchGasPrice())
      )
      .subscribe(data => {
        this.gasSubject.next(data);
      });
  }

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
