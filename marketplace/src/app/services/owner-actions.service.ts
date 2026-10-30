import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { GlobalState, Notification } from '@/models/global-state';
import { Phunk } from '@/models/db';
import { ERC721C_CONTRACT_SETS } from '@/constants/erc721c';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { UtilService } from '@/services/util.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { upsertNotification } from '@/state/actions/notification.actions';
import * as appStateActions from '@/state/actions/app-state.actions';

export type OwnerAction = 'sell' | 'delist' | 'escrow' | 'withdraw' | 'transfer';

/**
 * The owner's market moves for one piece (list, delist, escrow, withdraw, transfer), for the
 * Account Details terminal. Each one is the same sequence the item page runs (ItemViewComponent's
 * submitListing / phunkNoLongerForSale / sendToEscrow / withdrawPhunk / transferPhunk): the
 * consensus check, the on-chain escrow check where the indexer can lag, the right market for the
 * collection, and the wallet → pending → complete / error notifications. Keep the two in step.
 *
 * Every method resolves to the confirmed transaction hash, or throws.
 */
@Injectable({ providedIn: 'root' })
export class OwnerActionsService {
  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private dataSvc: DataService,
    private utilSvc: UtilService,
    private prefs: PhunkPreferencesService,
  ) {}

  private qpSet(phunk: Phunk) {
    return phunk.slug ? ERC721C_CONTRACT_SETS[phunk.slug] : undefined;
  }

  /** Positive tokenId for on-chain calls. */
  private posTokenId(phunk: Phunk): number {
    const t = phunk.tokenId ?? 0;
    return t < 0 ? -t : t;
  }

  private async checkConsensus(phunk: Phunk): Promise<void> {
    const res = await this.dataSvc.checkConsensus([phunk]);
    if (!res[0]?.consensus) throw new Error(this.prefs.t('itemNoConsensus'));
  }

  /** wallet → pending → complete, with the item's cooldown recorded; error notification on failure. */
  private async run(fn: Notification['function'], phunk: Phunk, send: () => Promise<string | undefined>, value?: number): Promise<string> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');
    let notification: Notification = {
      id: this.utilSvc.createIdFromString(fn + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: fn,
      hashId,
      tokenId: phunk.tokenId,
      ...(value !== undefined ? { value } : {}),
    };
    this.store.dispatch(upsertNotification({ notification }));
    try {
      const hash = await send();
      if (!hash) throw new Error(this.prefs.t('couldNotProcessTx'));
      notification = { ...notification, type: 'pending', hash };
      this.store.dispatch(upsertNotification({ notification }));
      const receipt = await this.web3Svc.pollReceipt(hash);
      notification = { ...notification, type: 'complete', hash: receipt.transactionHash };
      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) } }));
      return receipt.transactionHash;
    } catch (err) {
      notification = { ...notification, type: 'error', detail: err };
      throw err;
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /** List for `value` ETH. Ethscriptions not yet in escrow are escrowed and listed in one go. */
  sell(phunk: Phunk, value: number): Promise<string> {
    return this.run('offerPhunkForSale', phunk, async () => {
      await this.checkConsensus(phunk);
      const hashId = phunk.hashId;
      const targetMarket = this.web3Svc.resolveMarketAddress({ owner: phunk.owner, slug: phunk.slug });
      const set = this.qpSet(phunk);
      if (set) {
        // ERC-721C: approval-based listing on the QP market (no escrow).
        await this.web3Svc.qpEnsureApproval(set.nft, set.marketplace);
        return this.web3Svc.qpOfferForSale(set.marketplace, set.nft, this.posTokenId(phunk), value);
      }
      if (phunk.isEscrowed) {
        try {
          return await this.web3Svc.offerPhunkForSale(hashId, value, undefined, targetMarket);
        } catch (err: any) {
          const msg = `${err?.shortMessage || ''} ${err?.message || ''}`.toLowerCase();
          // indexed state can lag; recover by doing escrow + list
          if (msg.includes('escrow')) return this.web3Svc.escrowAndOfferPhunkForSale(hashId, value, undefined, targetMarket);
          throw err;
        }
      }
      // shown as not escrowed, but check on-chain: indexed state can lag
      return (await this.web3Svc.isInEscrow(hashId, targetMarket))
        ? this.web3Svc.offerPhunkForSale(hashId, value, undefined, targetMarket)
        : this.web3Svc.escrowAndOfferPhunkForSale(hashId, value, undefined, targetMarket);
    }, value);
  }

  delist(phunk: Phunk): Promise<string> {
    return this.run('phunkNoLongerForSale', phunk, () => {
      const set = this.qpSet(phunk);
      return set
        ? this.web3Svc.qpNoLongerForSale(set.marketplace, set.nft, this.posTokenId(phunk))
        : this.web3Svc.phunkNoLongerForSale(phunk.hashId, this.web3Svc.resolveMarketAddress({ owner: phunk.owner }));
    });
  }

  escrow(phunk: Phunk): Promise<string> {
    return this.run('sendToEscrow', phunk, async () => {
      await this.checkConsensus(phunk);
      return this.web3Svc.sendEthscriptionToContract(phunk.hashId, this.web3Svc.resolveMarketAddress({ slug: phunk.slug }));
    });
  }

  withdraw(phunk: Phunk): Promise<string> {
    return this.run('withdrawPhunk', phunk, () =>
      this.web3Svc.withdrawPhunk(phunk.hashId, this.web3Svc.resolveMarketAddress({ owner: phunk.owner })));
  }

  /** Withdraw every market's balance for the connected wallet, one transaction per contract that
   *  holds funds. Resolves to the last confirmed hash. */
  async withdrawFunds(funds: { market: string; kind: 'etherphunks' | 'quantumphunks'; wei: bigint }[]): Promise<string> {
    let last = '';
    for (const f of funds) {
      const hash = await this.web3Svc.withdrawFundsFrom(f.market, f.kind);
      if (!hash) throw new Error(this.prefs.t('couldNotProcessTx'));
      last = (await this.web3Svc.pollReceipt(hash)).transactionHash;
    }
    this.store.dispatch(appStateActions.checkHasWithdrawal());
    return last;
  }

  /** `to` may be an address or an ENS name. */
  async transfer(phunk: Phunk, to: string): Promise<string> {
    const toAddress = await this.web3Svc.verifyAddressOrEns(to);
    if (!toAddress) throw new Error(this.prefs.t('invalidAddress'));
    return this.run('transferPhunk', phunk, async () => {
      const set = this.qpSet(phunk);
      if (set) return this.web3Svc.transferNft(set.nft, this.posTokenId(phunk), toAddress);
      await this.checkConsensus(phunk);
      return this.web3Svc.transferPhunk(phunk.hashId, toAddress);
    });
  }

  // ---- several pieces at once (one collection), the market page's bulk flows
  //
  // Ethscriptions batch on the market: one transaction lists, escrows, withdraws or transfers
  // them all. Delisting has no batch call, and the QuantumPhunks market has no batch calls at
  // all, so those go one piece at a time (a wallet prompt each), stopping at the first failure.
  // Each resolves to the last confirmed hash, or throws.

  /** wallet → pending → complete for one transaction covering several pieces */
  private async runBatch(fn: Notification['function'], phunks: Phunk[], send: () => Promise<string | undefined>): Promise<string> {
    const hashIds = phunks.map(p => p.hashId);
    let notification: Notification = {
      id: this.utilSvc.createIdFromString(fn + hashIds.map(h => h.substring(2)).join('')),
      timestamp: Date.now(),
      slug: phunks[0]?.slug,
      type: 'wallet',
      function: fn,
      hashId: hashIds[0],
      hashIds,
      isBatch: true,
    };
    this.store.dispatch(upsertNotification({ notification }));
    try {
      const hash = await send();
      if (!hash) throw new Error(this.prefs.t('couldNotProcessTx'));
      notification = { ...notification, type: 'pending', hash };
      this.store.dispatch(upsertNotification({ notification }));
      const receipt = await this.web3Svc.pollReceipt(hash);
      notification = { ...notification, type: 'complete', hash: receipt.transactionHash };
      const block = Number(receipt.blockNumber);
      this.store.dispatch(appStateActions.addCooldown({ cooldown: Object.fromEntries(hashIds.map(h => [h, block])) }));
      return receipt.transactionHash;
    } catch (err) {
      notification = { ...notification, type: 'error', detail: err };
      throw err;
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /** one at a time, stopping at the first rejection or failure */
  private async eachOf(phunks: Phunk[], one: (p: Phunk) => Promise<string>): Promise<string> {
    let last = '';
    for (const p of phunks) last = await one(p);
    return last;
  }

  private async checkConsensusAll(phunks: Phunk[]): Promise<void> {
    const res = await this.dataSvc.checkConsensus(phunks);
    if (res.length !== phunks.length || res.some((r: any) => !r?.consensus)) throw new Error(this.prefs.t('itemNoConsensus'));
  }

  /** the escrow market for each piece, grouped: a market's batch call only covers its own pieces */
  private byMarket(phunks: Phunk[], key: (p: Phunk) => string): Map<string, Phunk[]> {
    const m = new Map<string, Phunk[]>();
    for (const p of phunks) {
      const k = key(p);
      m.set(k, [...(m.get(k) || []), p]);
    }
    return m;
  }

  /** List each at its own price (`prices[i]` ETH for `phunks[i]`). Ethscriptions not in escrow yet
   *  are escrowed first in one transaction, then everything is listed in one more. */
  async sellMany(phunks: Phunk[], prices: number[]): Promise<string> {
    const price = new Map(phunks.map((p, i) => [p.hashId, prices[i]]));
    if (this.qpSet(phunks[0])) return this.eachOf(phunks, p => this.sell(p, price.get(p.hashId)!));
    await this.checkConsensusAll(phunks);
    const slugMarket = this.web3Svc.resolveMarketAddress({ slug: phunks[0].slug });
    // shown as not escrowed, but check on-chain: indexed state can lag
    const toEscrow: Phunk[] = [];
    const escrowed: { p: Phunk; market: string }[] = [];
    for (const p of phunks) {
      if (p.isEscrowed) escrowed.push({ p, market: this.web3Svc.resolveMarketAddress({ owner: p.owner }) });
      else if (await this.web3Svc.isInEscrow(p.hashId, slugMarket)) escrowed.push({ p, market: slugMarket });
      else toEscrow.push(p);
    }
    if (toEscrow.length) {
      await this.runBatch('sendToEscrow', toEscrow, () =>
        this.web3Svc.transferPhunk('0x' + toEscrow.map(p => p.hashId.substring(2)).join(''), slugMarket));
      escrowed.push(...toEscrow.map(p => ({ p, market: slugMarket })));
    }
    let last = '';
    const groups = this.byMarket(escrowed.map(e => e.p), p => escrowed.find(e => e.p === p)!.market);
    for (const [market, ps] of groups) {
      last = await this.runBatch('offerPhunkForSale', ps, () =>
        this.web3Svc.batchOfferPhunkForSale(ps.map(p => p.hashId), ps.map(p => price.get(p.hashId)!), market));
    }
    return last;
  }

  delistMany(phunks: Phunk[]): Promise<string> {
    return this.eachOf(phunks, p => this.delist(p));
  }

  async escrowMany(phunks: Phunk[]): Promise<string> {
    await this.checkConsensusAll(phunks);
    const market = this.web3Svc.resolveMarketAddress({ slug: phunks[0].slug });
    return this.runBatch('sendToEscrow', phunks, () =>
      this.web3Svc.transferPhunk('0x' + phunks.map(p => p.hashId.substring(2)).join(''), market));
  }

  async withdrawMany(phunks: Phunk[]): Promise<string> {
    let last = '';
    for (const [market, ps] of this.byMarket(phunks, p => this.web3Svc.resolveMarketAddress({ owner: p.owner }))) {
      last = await this.runBatch('withdrawPhunk', ps, () => this.web3Svc.withdrawBatch(ps.map(p => p.hashId), market));
    }
    return last;
  }

  /** `to` may be an address or an ENS name. */
  async transferMany(phunks: Phunk[], to: string): Promise<string> {
    if (this.qpSet(phunks[0])) return this.eachOf(phunks, p => this.transfer(p, to));
    const toAddress = await this.web3Svc.verifyAddressOrEns(to);
    if (!toAddress) throw new Error(this.prefs.t('invalidAddress'));
    await this.checkConsensusAll(phunks);
    return this.runBatch('transferPhunk', phunks, () => this.web3Svc.batchTransferPhunks(phunks.map(p => p.hashId), toAddress));
  }
}
