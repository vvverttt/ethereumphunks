import { Module } from '@nestjs/common';

import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { LotteryService } from './lottery.service';

@Module({
  imports: [
    SharedModule,
    StorageModule,
  ],
  providers: [
    LotteryService,
  ],
  exports: [
    LotteryService,
  ],
})
export class LotteryModule {}
