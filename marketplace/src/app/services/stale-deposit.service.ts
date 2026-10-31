import { Injectable, inject, signal } from '@angular/core';

import { environment } from 'src/environments/environment';
import { DystoLabzMarketABI as EtherPhunksMarketABI } from '@/abi/DystoLabzMarket';
import { Web3Service } from '@/services/web3.service';

const MARKET = environment.marketAddress as `0x${string}`;

/**
 * Pieces the market contract thinks a wallet deposited when it didn't: someone sent the piece's id to
 * the market while not owning it (an invalid ethscription transfer the contract can't tell apart), so
 * the market keeps a deposit, and maybe a listing, for something it never held. The piece is safe in
 * the wallet; the record just needs clearing with the market's withdraw. Read from the chain (one
 * multicall per new batch of pieces), only for pieces the connected wallet holds outside escrow.
 */
@Injectable({ providedIn: 'root' })
export class StaleDepositService {
  private web3Svc = inject(Web3Service);

  /** hashIds with a stale deposit for the wallet that holds them */
  readonly stale = signal<Set<string>>(new Set());
  private asked = new Set<string>();

  async check(address: string | null | undefined, phunks: { hashId: string; owner?: string | null; isEscrowed?: boolean; nft?: any }[]): Promise<void> {
    if (!address || !MARKET) return;
    const a = address.toLowerCase();
    const todo = phunks
      .filter(p => p?.hashId && !p.isEscrowed && !p.nft && p.owner?.toLowerCase() === a && !this.asked.has(a + p.hashId))
      .map(p => p.hashId);
    if (!todo.length) return;
    todo.forEach(h => this.asked.add(a + h));
    try {
      const res = await this.web3Svc.l1Client.multicall({
        contracts: todo.map(h => ({ address: MARKET, abi: EtherPhunksMarketABI as any, functionName: 'userEthscriptionPossiblyStored', args: [a, h] })),
        allowFailure: true,
      });
      const hits = todo.filter((_, i) => res[i]?.status === 'success' && res[i].result === true);
      if (hits.length) this.stale.update(s => new Set([...s, ...hits]));
    } catch {
      todo.forEach(h => this.asked.delete(a + h));   // try again next time
    }
  }

  has(hashId: string | null | undefined): boolean {
    return !!hashId && this.stale().has(hashId);
  }

  cleared(hashId: string) {
    this.stale.update(s => { const n = new Set(s); n.delete(hashId); return n; });
  }

  /** the market the stale record sits in (always the current one: the old market's view reverts) */
  readonly market = MARKET;
}
