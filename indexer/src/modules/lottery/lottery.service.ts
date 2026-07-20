import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';
import { lotteryAbi, lotteryAddressesL1, erc721LotteryAddressL1 } from '@/constants/ethereum';
import { TransferEthscriptionForPreviousOwnerSignature } from '@/constants/esips';

import { TransactionReceipt, decodeEventLog, zeroAddress } from 'viem';

// The ERC-721 QuantumPhunks mint lottery emits RandomMinted(requestId, player, tokenId)
// from the Chainlink VRF callback tx — one per won token.
const ERC721_LOTTERY_EVENTS = [
  {
    type: 'event',
    name: 'RandomMinted',
    inputs: [
      { indexed: true, name: 'requestId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
  },
] as const;

const PRIZE_SLUG = 'cryptophunksv67';

@Injectable()
export class LotteryService {

  constructor(
    private readonly storageSvc: StorageService,
  ) {}

  /**
   * Process lottery events from a transaction receipt.
   * Detects PrizeAwarded (ethscription lottery) and RandomMinted (ERC-721 lottery)
   * events and records them in Supabase.
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
      const log = rawLog as any;
      const contractAddress = log.address?.toLowerCase();

      // ─── ERC-721 mint lottery: RandomMinted → one win row per won tokenId ───
      if (erc721LotteryAddressL1 && contractAddress === erc721LotteryAddressL1) {
        try {
          const decoded = decodeEventLog({ abi: ERC721_LOTTERY_EVENTS as any, data: log.data, topics: log.topics }) as { eventName: string; args: any };
          if (decoded.eventName === 'RandomMinted') {
            const { player, tokenId } = decoded.args as { requestId: bigint; player: string; tokenId: bigint };
            await this.recordErc721Win(Number(tokenId), player.toLowerCase(), txHash, createdAt, contractAddress);
          }
        } catch (err) {
          // Not a RandomMinted log, skip
        }
        continue;
      }

      // ─── Ethscription lottery: PrizeAwarded ───
      try {
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
   * Record an ERC-721 mint-lottery win. Each won token is unique, so we key the
   * row on (contract_address, play_id = tokenId). The image/hashId are resolved
   * from the QuantumPhunks ethscriptions row for that tokenId.
   */
  private async recordErc721Win(
    tokenId: number,
    winner: string,
    txHash: string,
    createdAt: Date,
    contractAddress: string
  ): Promise<void> {
    const suffix = this.storageSvc.suffix;

    const { data: ethscription } = await this.storageSvc.supabase
      .from('ethscriptions' + suffix)
      .select('sha, hashId, tokenId, slug')
      .eq('slug', PRIZE_SLUG)
      .eq('tokenId', tokenId)
      .maybeSingle();

    const { error } = await this.storageSvc.supabase
      .from('lottery_wins' + suffix)
      .upsert({
        contract_address: contractAddress,
        play_id: tokenId,               // each QuantumPhunk is minted once → unique per contract
        winner,
        hash_id: ethscription?.hashId || '',
        sha: ethscription?.sha || '',
        token_id: tokenId,
        collection_slug: ethscription?.slug || PRIZE_SLUG,
        transfer_status: 'transferred',
        tx_hash: txHash,
        created_at: createdAt,
      }, { onConflict: 'contract_address,play_id' });

    if (error) {
      Logger.error(`Failed to record ERC-721 lottery win: ${error.message}`, 'LotteryService');
    } else {
      Logger.log(`ERC-721 lottery win recorded: token #${tokenId} -> ${winner}`, 'LotteryService');
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
