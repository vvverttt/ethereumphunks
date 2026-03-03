import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';
import { lotteryAbi, lotteryAddressesL1 } from '@/constants/ethereum';
import { TransferEthscriptionForPreviousOwnerSignature } from '@/constants/esips';

import { TransactionReceipt, decodeEventLog, zeroAddress } from 'viem';

@Injectable()
export class LotteryService {

  constructor(
    private readonly storageSvc: StorageService,
  ) {}

  /**
   * Process lottery events from a transaction receipt.
   * Detects PrizeAwarded events and records them in Supabase.
   */
  async processLotteryEvents(
    receipt: TransactionReceipt,
    txHash: string,
    createdAt: Date
  ): Promise<void> {
    if (!lotteryAddressesL1.size) return;

    // Filter logs from any lottery contract
    const lotteryLogs = receipt.logs.filter(
      (log: any) => lotteryAddressesL1.has(log.address?.toLowerCase())
    );

    if (!lotteryLogs.length) return;

    for (const rawLog of lotteryLogs) {
      try {
        const log = rawLog as any;
        const contractAddress = log.address?.toLowerCase();
        const decoded = decodeEventLog({
          abi: lotteryAbi,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'PrizeAwarded') {
          const { playId, winner, hashId } = decoded.args as unknown as {
            playId: bigint;
            winner: string;
            hashId: string;
          };

          await this.recordWin(
            Number(playId),
            winner.toLowerCase(),
            hashId.toLowerCase(),
            txHash,
            createdAt,
            receipt,
            log.logIndex ?? 0,
            contractAddress
          );
        }
      } catch (err) {
        // Not a lottery event we care about, skip
      }
    }
  }

  /**
   * Record a lottery win in Supabase.
   */
  private async recordWin(
    playId: number,
    winner: string,
    hashId: string,
    txHash: string,
    createdAt: Date,
    receipt: TransactionReceipt,
    logIndex: number,
    contractAddress: string
  ): Promise<void> {
    const suffix = this.storageSvc.suffix;

    // Look up ethscription details (sha, collection)
    const { data: ethscription } = await this.storageSvc.supabase
      .from('ethscriptions' + suffix)
      .select('sha, tokenId, slug')
      .eq('hashId', hashId)
      .single();

    const { error } = await this.storageSvc.supabase
      .from('lottery_wins' + suffix)
      .upsert({
        contract_address: contractAddress,
        play_id: playId,
        winner,
        hash_id: hashId,
        sha: ethscription?.sha || '',
        token_id: ethscription?.tokenId,
        collection_slug: ethscription?.slug || '',
        transfer_status: 'transferred',
        tx_hash: txHash,
        created_at: createdAt,
      }, { onConflict: 'contract_address,play_id' });

    if (error) {
      Logger.error(`Failed to record lottery win: ${error.message}`, 'LotteryService');
    } else {
      Logger.log(
        `Lottery win recorded: play #${playId} -> ${winner} won ${hashId}`,
        'LotteryService'
      );

      // Update ethscription ownership: lottery contract → winner
      await this.storageSvc.updateEthscriptionOwner(hashId, contractAddress, winner);

      // Remove any stale events for this hashId in this tx (re-indexing cleanup)
      await this.storageSvc.supabase
        .from('events' + suffix)
        .delete()
        .eq('hashId', hashId)
        .eq('txHash', txHash.toLowerCase())
        .in('type', ['transfer', 'PrizeAwarded']);

      // Find the ESIP-2 transfer log to get its logIndex
      const esip2Log = receipt.logs.find(
        (log: any) => log.address?.toLowerCase() === contractAddress
          && log.topics?.[0] === TransferEthscriptionForPreviousOwnerSignature
      );
      const transferLogIndex = (esip2Log as any)?.logIndex ?? 0;

      // Insert transfer event (ethscription moved from lottery → winner)
      await this.storageSvc.supabase
        .from('events' + suffix)
        .upsert({
          txId: `${txHash.toLowerCase()}-${transferLogIndex}`,
          blockTimestamp: createdAt,
          type: 'transfer',
          value: '0',
          hashId,
          from: contractAddress,
          to: winner,
          blockNumber: Number(receipt.blockNumber),
          blockHash: receipt.blockHash?.toLowerCase() || '',
          txIndex: Number(receipt.transactionIndex),
          txHash: txHash.toLowerCase(),
        });

      // Insert PrizeAwarded event (shows as "Won" in activity)
      await this.storageSvc.supabase
        .from('events' + suffix)
        .upsert({
          txId: `${txHash.toLowerCase()}-${logIndex}`,
          blockTimestamp: createdAt,
          type: 'PrizeAwarded',
          value: '0',
          hashId,
          from: contractAddress,
          to: winner,
          blockNumber: Number(receipt.blockNumber),
          blockHash: receipt.blockHash?.toLowerCase() || '',
          txIndex: Number(receipt.transactionIndex),
          txHash: txHash.toLowerCase(),
        });
    }
  }
}
