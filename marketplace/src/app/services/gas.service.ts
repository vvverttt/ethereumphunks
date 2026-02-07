import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, switchMap, catchError, of, tap, startWith } from 'rxjs';
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

  // Initialize with placeholder data so the UI shows immediately
  private gasSubject = new BehaviorSubject<GasData>({
    ProposeGasPrice: '...',
    FastGasPrice: '...',
    SafeGasPrice: '...',
    LastBlock: '0',
    gasUsedRatio: '0',
    suggestBaseFee: '...'
  });

  /** Observable stream of gas data */
  gas$ = this.gasSubject.asObservable();

  constructor() {
    console.log('[GasService] Initializing with Alchemy RPC:', environment.rpcHttpProvider);

    // Poll for gas prices every 15 seconds, starting immediately
    interval(15000)
      .pipe(
        startWith(0), // Emit immediately on subscribe
        switchMap(() => this.fetchGasPrice())
      )
      .subscribe(data => {
        console.log('[GasService] Emitting gas data:', data);
        this.gasSubject.next(data);
      });
  }

  private fetchGasPrice() {
    console.log('[GasService] Fetching gas price from Alchemy...');
    console.log('[GasService] RPC URL:', environment.rpcHttpProvider);

    // Use Alchemy RPC endpoint to get current gas price
    return this.http.post<any>(environment.rpcHttpProvider, {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 1
    }).pipe(
      tap(response => {
        console.log('[GasService] ✅ Response received:', response);
        console.log('[GasService] Response type:', typeof response);
        console.log('[GasService] Response result:', response?.result);
      }),
      switchMap(response => {
        if (!response?.result) {
          console.error('[GasService] ❌ Invalid response - no result field:', response);
          if (response?.error) {
            console.error('[GasService] ❌ RPC Error:', response.error);
          }
          // Return placeholder data on error
          return of({
            ProposeGasPrice: 'err',
            FastGasPrice: 'err',
            SafeGasPrice: 'err',
            LastBlock: '0',
            gasUsedRatio: '0',
            suggestBaseFee: 'err'
          });
        }

        try {
          // Convert hex gas price to Gwei
          console.log('[GasService] Parsing hex:', response.result);
          const gasPriceWei = parseInt(response.result, 16);
          console.log('[GasService] Wei:', gasPriceWei);

          // Convert to Gwei with 2 decimal places
          const gasPriceGwei = (gasPriceWei / 1e9).toFixed(2);
          console.log('[GasService] ✅ Gas price:', gasPriceGwei, 'Gwei');

          // Return in the expected format
          const gasData: GasData = {
            ProposeGasPrice: gasPriceGwei,
            FastGasPrice: (parseFloat(gasPriceGwei) * 1.2).toFixed(2),
            SafeGasPrice: (parseFloat(gasPriceGwei) * 0.8).toFixed(2),
            LastBlock: '0',
            gasUsedRatio: '0',
            suggestBaseFee: gasPriceGwei
          };

          return of(gasData);
        } catch (parseError) {
          console.error('[GasService] ❌ Error parsing gas price:', parseError);
          return of({
            ProposeGasPrice: 'err',
            FastGasPrice: 'err',
            SafeGasPrice: 'err',
            LastBlock: '0',
            gasUsedRatio: '0',
            suggestBaseFee: 'err'
          });
        }
      }),
      catchError(error => {
        console.error('[GasService] ❌ HTTP Error:', error);
        console.error('[GasService] Error status:', error.status);
        console.error('[GasService] Error message:', error.message);
        console.error('[GasService] Full error object:', error);
        // Return placeholder data on error
        return of({
          ProposeGasPrice: 'err',
          FastGasPrice: 'err',
          SafeGasPrice: 'err',
          LastBlock: '0',
          gasUsedRatio: '0',
          suggestBaseFee: 'err'
        });
      })
    );
  }

  connect(): this {
    // No-op for backwards compatibility
    return this;
  }
}
