import { Body, Controller, Get, HttpException, HttpStatus, Post, Optional } from '@nestjs/common';

import { ProcessingService } from '@/services/processing.service';
import { BlockProcessingQueue } from '@/modules/queue/queues/block-processing.queue';
import { StorageService } from '@/modules/storage/storage.service';
import { l1Client } from '@/constants/ethereum';

const HEALTH_BLOCK_GAP_THRESHOLD = Number(process.env.HEALTH_BLOCK_GAP_THRESHOLD || 10);
const HEALTH_CHAIN_ID = Number(process.env.CHAIN_ID);

@Controller('admin')
export class AppController {

  constructor(
    private readonly processingSvc: ProcessingService,
    private readonly storageSvc: StorageService,
    @Optional() private readonly blockQueue: BlockProcessingQueue,
  ) {}

  /**
   * Health endpoint for Render. Returns 200 when the indexer is within
   * HEALTH_BLOCK_GAP_THRESHOLD blocks of chain head, 503 otherwise so
   * Render auto-restarts a stuck indexer.
   */
  @Get('health')
  async health(): Promise<{ ok: boolean; lastIndexed: number | null; head: number; gap: number; threshold: number }> {
    let lastIndexed: number | null = null;
    let head = 0;
    try {
      const lastBlockRow = await this.storageSvc.getLastBlock(HEALTH_CHAIN_ID);
      lastIndexed = lastBlockRow === null ? null : Number(lastBlockRow) + 10;
      const chainHead = await l1Client.getBlockNumber();
      head = Number(chainHead);
    } catch (e: any) {
      throw new HttpException(
        { ok: false, error: e?.message || 'health check failed' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const gap = lastIndexed === null ? 0 : head - lastIndexed;
    const body = { ok: gap <= HEALTH_BLOCK_GAP_THRESHOLD, lastIndexed, head, gap, threshold: HEALTH_BLOCK_GAP_THRESHOLD };
    if (!body.ok) throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }

  /**
   * Reindexes a specific block.
   *
   * @param body - The request body containing the block number.
    * @returns A promise that resolves to the result of re-indexing the block.
   */
  @Post('reindex-block')
  async reindexBlock(@Body() body: { blockNumber: number }): Promise<void> {
    return await this.processingSvc.processBlock(body.blockNumber, false);
  }

  @Post('reindex-transaction')
  async reindexTransaction(@Body() body: { hash: `0x${string}` }): Promise<void> {
    return await this.processingSvc.processSingleTransaction(body.hash);
  }

  /**
   * Pauses the block queue.
   *
    * @returns A promise that resolves when the block queue is paused.
   */
  @Post('pause-block-queue')
  async pauseQueue(): Promise<void> {
    return await this.blockQueue.pauseQueue();
  }

  /**
   * Resumes the block queue.
   *
    * @returns A promise that resolves when the block queue is resumed.
   */
  @Post('resume-block-queue')
  async resumeQueue(): Promise<void> {
    return await this.blockQueue.resumeQueue();
  }
}
