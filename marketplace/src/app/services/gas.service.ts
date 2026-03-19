import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, switchMap, catchError, of, startWith } from 'rxjs';
import { environment } from 'src/environments/environment';

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
    interval(15000)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchGasPrice())
      )
      .subscribe(data => {
        this.gasSubject.next(data);
      });
  }

  private fetchGasPrice() {
    return this.http.post<any>(environment.rpcHttpProvider, {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 1
    }).pipe(
      switchMap(response => {
        if (!response?.result) {
          return of(this.errorData());
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
          return of(this.errorData());
        }
      }),
      catchError(() => of(this.errorData()))
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
