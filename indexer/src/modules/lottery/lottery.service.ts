import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';
import { lotteryAbi, lotteryAddressL1 } from '@/constants/ethereum';

import { Log, TransactionReceipt, decodeEventLog } from 'viem';

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
    if (!lotteryAddressL1) return;

    // Filter logs from the lottery contract
    const lotteryLogs = receipt.logs.filter(
      (log: Log) => log.address?.toLowerCase() === lotteryAddressL1
    );

    if (!lotteryLogs.length) return;

    for (const log of lotteryLogs) {
      try {
        const decoded = decodeEventLog({
          abi: lotteryAbi,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'PrizeAwarded') {
          const { playId, winner, hashId } = decoded.args as {
            playId: bigint;
            winner: string;
            hashId: string;
          };

          await this.recordWin(
            Number(playId),
            winner.toLowerCase(),
            hashId.toLowerCase(),
            txHash,
            createdAt
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
    createdAt: Date
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
        play_id: playId,
        winner,
        hash_id: hashId,
        sha: ethscription?.sha || '',
        token_id: ethscription?.tokenId,
        collection_slug: ethscription?.slug || '',
        transfer_status: 'transferred',
        tx_hash: txHash,
        created_at: createdAt,
      }, { onConflict: 'play_id' });

    if (error) {
      Logger.error(`Failed to record lottery win: ${error.message}`, 'LotteryService');
    } else {
      Logger.log(
        `Lottery win recorded: play #${playId} -> ${winner} won ${hashId}`,
        'LotteryService'
      );
    }
  }
}
