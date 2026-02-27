import { Module } from '@nestjs/common';

import { StorageModule } from '@/modules/storage/storage.module';

import { EthsRocksController } from './ethsrocks.controller';
import { EthsRocksService } from './ethsrocks.service';

@Module({
  imports: [StorageModule],
  controllers: [EthsRocksController],
  providers: [EthsRocksService],
  exports: [EthsRocksService],
})
export class EthsRocksModule {}
