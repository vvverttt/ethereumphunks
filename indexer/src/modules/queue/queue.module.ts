import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';

import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { BlockQueueService } from '@/modules/queue/services/block-queue.service';
import { EthscriptionsModule } from '@/modules/ethscriptions/ethscriptions.module';
import { BlockProcessingQueue } from '@/modules/queue/queues/block-processing.queue';
import { NotifsModule } from '@/modules/notifs/notifs.module';
import { LotteryModule } from '@/modules/lottery/lottery.module';

import { ProcessingService } from '@/services/processing.service';

import { chain } from '@/constants/ethereum';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HttpModule,
    ...(Number(process.env.QUEUE) ? [
      BullModule.forRoot({
        redis: process.env.REDIS_URL
      }),
      BullModule.registerQueue(
        {
          name: `${chain}__BlockProcessingQueue`
        }
      )
    ] : []),
    SharedModule,
    StorageModule,
    NotifsModule,
    LotteryModule,

    forwardRef(() => EthscriptionsModule),
    forwardRef(() => CommentsModule),
  ],
  providers: [
    ...(Number(process.env.QUEUE) ? [
      BlockQueueService,
      BlockProcessingQueue,
    ] : []),
    ProcessingService,
  ],
  exports: [
    ...(Number(process.env.QUEUE) ? [
      BlockProcessingQueue,
    ] : []),
  ],
})
export class QueueModule {}
