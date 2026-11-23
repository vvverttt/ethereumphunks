import { Injectable, Logger } from '@nestjs/common';

import {
  Transaction,
  TransactionReceipt,
  decodeEventLog,
  zeroAddress,
} from 'viem';

import { StorageService } from '@/modules/storage/storage.service';

import {
  erc721Collections,
  qpMarketAbi,
  qpMarketAddress,
  v67NftAbi,
} from '@/constants/ethereum';

import { Event, EventType } from '@/modules/storage/models/db';

/**
 * Indexes the on-chain ERC-721 collections in `erc721Collections` (cryptophunksv67, phunksmas):
 *   • ownership   ← each NFT contract's `Transfer` logs (standard ERC-721 event, so the v67 ABI
 *                   decodes every collection's Transfer)
 *   • market      ← QuantumPhunksMarketMulti logs (`qpMarketAddress`), filtered
 *                   to events whose `collection` is one of those contracts.
 *
 * Runs inside the existing indexer via ProcessingService.processTransaction.
 * No-ops entirely when the addresses are not configured (env unset), so it is
 * safe to ship before the Render env vars are set.
 */
@Injectable()
export class NftService {
  constructor(private readonly storageSvc: StorageService) {}

  /** Whether this tx has any log from a contract we care about. */
  private relevant(receipt: TransactionReceipt): boolean {
    if (!erc721Collections.size && !qpMarketAddress) return false;
    return receipt.logs?.some((l) => {
      const a = l.address?.toLowerCase();
      return (!!a && erc721Collections.has(a)) || a === qpMarketAddress;
    });
  }

  async processNftEvents(
    transaction: Transaction,
    receipt: TransactionReceipt,
    createdAt: Date,
  ): Promise<Event[]> {
    if (!this.relevant(receipt)) return [];

    const events: Event[] = [];

    // Pre-scan the market logs so a PhunkNoLongerForSale that precedes a
    // PhunkBought for the same token in the same tx can be skipped (mirrors the
    // ethscriptions market path).
    // Keyed "collection:tokenId", so the same id in two collections can't be confused.
    const boughtTokenIds = new Set<string>();
    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== qpMarketAddress) continue;
      try {
        const d: any = decodeEventLog({ abi: qpMarketAbi as any, data: log.data, topics: (log as any).topics });
        const a = d.args as any;
        if (
          (d.eventName === 'PhunkBought' || d.eventName === 'CollectionBidAccepted' || d.eventName === 'TraitBidAccepted') &&
          this.slugOf(a?.collection)
        ) {
          boughtTokenIds.add(this.tokenKey(a.collection, a.tokenId));
        }
      } catch { /* not our event */ }
    }

    for (const log of receipt.logs) {
      const addr = log.address?.toLowerCase();
      try {
        if (addr && erc721Collections.has(addr)) {
          const e = await this.handleNftLog(transaction, createdAt, log, erc721Collections.get(addr)!);
          if (e) events.push(e);
        } else if (addr === qpMarketAddress) {
          const e = await this.handleMarketLog(transaction, createdAt, log, boughtTokenIds);
          if (e) events.push(e);
        }
      } catch (error) {
        Logger.error('❌', `nft log ${transaction.hash}#${log.logIndex}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return events;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Site slug for a tracked NFT contract, or undefined when we don't follow it. */
  private slugOf(collection: string | undefined): string | undefined {
    return collection ? erc721Collections.get(String(collection).toLowerCase()) : undefined;
  }

  private tokenKey(collection: string, tokenId: bigint | string): string {
    return `${String(collection).toLowerCase()}:${tokenId.toString()}`;
  }

  /** Resolve (slug, tokenId) → its ethscriptions row (hashId keeps the events FK valid). */
  private async rowForToken(slug: string, tokenId: bigint | string) {
    return this.storageSvc.getEthscriptionBySlugAndTokenId(slug, Number(tokenId));
  }

  private buildEvent(
    txn: Transaction,
    createdAt: Date,
    log: any,
    type: EventType,
    hashId: string,
    from: string,
    to: string,
    value: bigint | string = BigInt(0),
  ): Event {
    return {
      txId: txn.hash + log.logIndex,
      type,
      hashId: hashId.toLowerCase(),
      from: (from || zeroAddress).toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: value.toString(),
    };
  }

  // ── ERC-721C ownership ──────────────────────────────────────────────────────

  private async handleNftLog(txn: Transaction, createdAt: Date, log: any, slug: string): Promise<Event | null> {
    let decoded: any;
    try {
      decoded = decodeEventLog({ abi: v67NftAbi as any, data: log.data, topics: log.topics });
    } catch { return null; }

    if (decoded.eventName !== 'Transfer') return null;
    const { from, to, tokenId } = decoded.args as any;

    const row = await this.rowForToken(slug, tokenId);
    if (!row) return null; // not one of our tracked tokens (e.g. a piece whose row isn't added yet)

    const fromAddr = (from as string).toLowerCase();
    const toAddr = (to as string).toLowerCase();

    if (fromAddr === zeroAddress) {
      // Mint → creation. Set owner and emit a `created` event (from == to).
      await this.storageSvc.updateEthscriptionOwner(row.hashId, row.owner || zeroAddress, toAddr);
      return this.buildEvent(txn, createdAt, log, 'created', row.hashId, toAddr, toAddr);
    }

    await this.storageSvc.updateEthscriptionOwner(row.hashId, fromAddr, toAddr);
    return this.buildEvent(txn, createdAt, log, 'transfer', row.hashId, fromAddr, toAddr);
  }

  // ── QuantumPhunks market ─────────────────────────────────────────────────────

  private async handleMarketLog(
    txn: Transaction,
    createdAt: Date,
    log: any,
    boughtTokenIds: Set<string>,
  ): Promise<Event | null> {
    let decoded: any;
    try {
      decoded = decodeEventLog({ abi: qpMarketAbi as any, data: log.data, topics: log.topics });
    } catch { return null; }

    const { eventName } = decoded;
    const a = decoded.args as any;
    const slug = this.slugOf(a?.collection);
    if (!eventName || !slug) return null;

    const row = await this.rowForToken(slug, a.tokenId);
    if (!row) return null;
    const hashId = row.hashId;

    switch (eventName) {
      case 'PhunkOffered': {
        // args: collection, tokenId, minValue, toAddress
        await this.storageSvc.createListing(txn, createdAt, hashId, a.toAddress, a.minValue);
        return this.buildEvent(txn, createdAt, log, 'PhunkOffered', hashId, txn.from, a.toAddress, a.minValue);
      }
      case 'PhunkNoLongerForSale': {
        if (boughtTokenIds.has(this.tokenKey(a.collection, a.tokenId))) return null; // buy follows; skip redundant delist
        const removed = await this.storageSvc.removeListing(hashId);
        if (!removed) return null;
        return this.buildEvent(txn, createdAt, log, 'PhunkNoLongerForSale', hashId, txn.from, zeroAddress);
      }
      case 'PhunkBought': {
        // args: collection, tokenId, value, seller, buyer
        await this.storageSvc.removeListing(hashId);
        return this.buildEvent(txn, createdAt, log, 'PhunkBought', hashId, a.seller, a.buyer, a.value);
      }
      case 'PhunkBidEntered': {
        // args: collection, tokenId, value, bidder
        await this.storageSvc.createBid(txn, createdAt, hashId, a.bidder, a.value, row.owner);
        return this.buildEvent(txn, createdAt, log, 'BidEntered', hashId, a.bidder, row.owner || zeroAddress, a.value);
      }
      case 'PhunkBidWithdrawn': {
        await this.storageSvc.removeBid(hashId);
        return this.buildEvent(txn, createdAt, log, 'BidWithdrawn', hashId, a.bidder, row.owner || zeroAddress, a.value);
      }
      case 'CollectionBidAccepted':
      case 'TraitBidAccepted': {
        // args include: collection, tokenId, pricePerItem, seller, bidder
        await this.storageSvc.removeBid(hashId);
        return this.buildEvent(txn, createdAt, log, 'BidAccepted', hashId, a.seller, a.bidder, a.pricePerItem);
      }
      // CollectionBid / TraitBid enter+withdraw are not per-token; not indexed here yet.
      default:
        return null;
    }
  }
}
