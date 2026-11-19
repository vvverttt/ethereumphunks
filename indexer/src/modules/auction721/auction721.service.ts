import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';
import { auction721AddressL1 } from '@/constants/ethereum';

import { TransactionReceipt, decodeEventLog } from 'viem';

/**
 * V67AuctionHouse (ERC-721) events -> Supabase `auctions721` + `auctionBids721`.
 *
 * Piece ownership (v67 or any queued collection moving in/out of the auction) is NOT handled here:
 * the NFT module already follows ERC-721 Transfer events. This module only keeps auction history,
 * so the site can always show it without any RPC calls.
 *
 * Transactions in a block are processed in parallel, so every write is order-independent:
 * - a bid is its own row (unique txHash+logIndex); the top bid is the highest row;
 * - AuctionExtended only ever moves endTime later;
 * - the settle outcome comes from the settle event itself (winner + amount are in it).
 */
const AUCTION721_EVENTS = [
  {
    type: 'event', name: 'AuctionCreated', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'collection', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'startTime', type: 'uint256' },
      { indexed: false, name: 'endTime', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AuctionBid', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'collection', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'bidder', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'extended', type: 'bool' },
    ],
  },
  {
    type: 'event', name: 'AuctionExtended', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'collection', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'endTime', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AuctionSettled', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'collection', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'winner', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AuctionReturnedToPool', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AuctionReturnedToQueue', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'collection', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
  {
    type: 'event', name: 'AuctionSkipped', inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'collection', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: false, name: 'bidder', type: 'address' },
      { indexed: false, name: 'refunded', type: 'uint256' },
    ],
  },
] as const;

@Injectable()
export class Auction721Service {

  constructor(private readonly storageSvc: StorageService) {}

  private get auctions() { return 'auctions721' + this.storageSvc.suffix; }
  private get bids() { return 'auctionBids721' + this.storageSvc.suffix; }

  async processAuction721Events(receipt: TransactionReceipt, txHash: string, createdAt: Date): Promise<void> {
    if (!auction721AddressL1) return;
    const logs = receipt.logs.filter((l: any) => l.address?.toLowerCase() === auction721AddressL1);
    if (!logs.length) return;

    for (const rawLog of logs) {
      const log = rawLog as any;
      let decoded: { eventName: string; args: any };
      try {
        decoded = decodeEventLog({ abi: AUCTION721_EVENTS as any, data: log.data, topics: log.topics }) as any;
      } catch {
        continue; // admin events (Queued, Paused, ...) are not part of the history
      }
      try {
        await this.handle(decoded.eventName, decoded.args, txHash, Number(log.logIndex), createdAt);
      } catch (error) {
        Logger.error('❌', `auction721 ${decoded.eventName} failed for tx ${txHash}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async handle(eventName: string, a: any, txHash: string, logIndex: number, createdAt: Date) {
    const db = this.storageSvc.supabase;
    const auctionId = Number(a.auctionId);
    const iso = (s: bigint) => new Date(Number(s) * 1000).toISOString();

    if (eventName === 'AuctionCreated') {
      const { error } = await db.from(this.auctions).upsert({
        auctionId,
        collection: String(a.collection).toLowerCase(),
        tokenId: a.tokenId.toString(),
        startTime: iso(a.startTime),
        endTime: iso(a.endTime),
        createdTx: txHash,
        createdAt: createdAt.toISOString(),
      }, { onConflict: 'auctionId', ignoreDuplicates: true });
      if (error) throw error;
      Logger.log(`auction721 #${auctionId} created: ${a.collection} #${a.tokenId}`);
      return;
    }

    if (eventName === 'AuctionBid') {
      const { error } = await db.from(this.bids).upsert({
        auctionId,
        collection: String(a.collection).toLowerCase(),
        tokenId: a.tokenId.toString(),
        bidder: String(a.bidder).toLowerCase(),
        amount: a.amount.toString(),
        extended: Boolean(a.extended),
        txHash,
        logIndex,
        createdAt: createdAt.toISOString(),
      }, { onConflict: 'txHash,logIndex', ignoreDuplicates: true });
      if (error) throw error;
      return;
    }

    if (eventName === 'AuctionExtended') {
      const end = iso(a.endTime);
      const { error } = await db.from(this.auctions).update({ endTime: end }).eq('auctionId', auctionId).lt('endTime', end);
      if (error) throw error;
      return;
    }

    const settle = async (fields: Record<string, unknown>) => {
      const { error } = await db.from(this.auctions)
        .update({ settled: true, settledTx: txHash, settledAt: createdAt.toISOString(), ...fields })
        .eq('auctionId', auctionId);
      if (error) throw error;
    };

    if (eventName === 'AuctionSettled') {
      await settle({ outcome: 'sold', winner: String(a.winner).toLowerCase(), amount: a.amount.toString() });
      Logger.log(`auction721 #${auctionId} sold to ${a.winner} for ${a.amount} wei`);
    } else if (eventName === 'AuctionReturnedToPool' || eventName === 'AuctionReturnedToQueue') {
      await settle({ outcome: 'returned' });
    } else if (eventName === 'AuctionSkipped') {
      await settle({ outcome: 'skipped', amount: a.refunded.toString(), winner: null });
    }
  }
}
