import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { StorageModule } from '@/modules/storage/storage.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { SharedModule } from '@/modules/shared/shared.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { NotifsModule } from '@/modules/notifs/notifs.module';
import { EthscriptionsModule } from '@/modules/ethscriptions/ethscriptions.module';
import { LotteryModule } from '@/modules/lottery/lottery.module';
import { TxPoolModule } from '@/modules/tx-pool/tx-pool.module';
import { MintModule } from '@/modules/mint/mint.module';

import { AppService } from '@/app.service';
import { AppController } from '@/app.controller';
import { AppGateway } from '@/app.gateway';

import { DataService } from '@/services/data.service';
import { ProcessingService } from '@/services/processing.service';

import { ApiKeyMiddleware } from '@/middleware/api-key.middleware';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HttpModule,

    EthscriptionsModule,
    LotteryModule,
    QueueModule,

    NotifsModule,
    SharedModule,
    ...(Number(process.env.TX_POOL) ? [TxPoolModule] : []),
    ...(Number(process.env.MINT) ? [MintModule] : []),

    CommentsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppGateway,
    ProcessingService,
    DataService,
  ],
})

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware)
      .forRoutes({
        path: '/admin/*',
        method: RequestMethod.ALL
      },
      {
        path: '/ethscriptions/*',
        method: RequestMethod.POST
      },
      {
        path: '/notifications/*',
        method: RequestMethod.POST
      });
  }
}
