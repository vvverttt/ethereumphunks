import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { supabase } from './supabase';
import { SocketService } from './socket.service';

export interface ServiceStatus {
  label: string;
  ok: boolean | null;
}

const POLL_INTERVAL = 60_000;

const frontendBackupRpcUrl = (environment as any).frontendBackupRpcUrl || '';
const receiptRpcUrl = (environment as any).receiptRpcUrl || environment.rpcHttpProvider;

const RPCS: { label: string; url: string }[] = [
  { label: 'Ankr A',    url: 'https://rpc.ankr.com/eth/545e600765426a4f17b1d59db878210f81e6fecbe581c0a745a7068c62fc1eb8' },
  { label: 'Ankr B',    url: 'https://rpc.ankr.com/eth/229b890a1dea15c5330378688e793eb0c44185c264c00144c928240d7cb0ec3f' },
  { label: 'Alchemy A', url: frontendBackupRpcUrl },
  { label: 'Alchemy B', url: receiptRpcUrl },
  { label: 'Relay',     url: `${environment.relayUrl}/rpc` },
].filter(r => r.url);

@Injectable({ providedIn: 'root' })
export class RpcHealthService implements OnDestroy {

  private _status$ = new BehaviorSubject<ServiceStatus[]>([
    ...RPCS.map(r => ({ label: r.label, ok: null as null })),
    { label: 'Supabase', ok: null },
    { label: 'Socket',   ok: null },
  ]);
  status$ = this._status$.asObservable();

  private timer: any;

  constructor(private socketSvc: SocketService) {
    this.check();
    this.timer = setInterval(() => this.check(), POLL_INTERVAL);
  }

  private async check() {
    const [rpcResults, supabaseOk, socketOk] = await Promise.all([
      this.checkRpcs(),
      this.checkSupabase(),
      this.checkSocket(),
    ]);

    this._status$.next([
      ...rpcResults,
      { label: 'Supabase', ok: supabaseOk },
      { label: 'Socket',   ok: socketOk },
    ]);
  }

  private async checkRpcs(): Promise<ServiceStatus[]> {
    return Promise.all(
      RPCS.map(async (r) => {
        try {
          const res = await fetch(r.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
            signal: AbortSignal.timeout(5_000),
          });
          const json = await res.json();
          return { label: r.label, ok: !!json?.result };
        } catch {
          return { label: r.label, ok: false };
        }
      })
    );
  }

  private async checkSupabase(): Promise<boolean> {
    try {
      const { error } = await supabase.from('collections').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  private checkSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socketSvc.ioSocket.connected) {
        resolve(true);
        return;
      }
      const timeout = setTimeout(() => resolve(false), 4_000);
      this.socketSvc.ioSocket.once('connect', () => {
        clearTimeout(timeout);
        resolve(true);
      });
      this.socketSvc.ioSocket.once('connect_error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      if (!this.socketSvc.ioSocket.connected) {
        this.socketSvc.ioSocket.connect();
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
