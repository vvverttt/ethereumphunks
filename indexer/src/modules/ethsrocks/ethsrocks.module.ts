import { Module } from '@nestjs/common';

import { EthsRocksController } from './ethsrocks.controller';
import { EthsRocksService } from './ethsrocks.service';

@Module({
  controllers: [EthsRocksController],
  providers: [EthsRocksService],
  exports: [EthsRocksService],
})
export class EthsRocksModule {}
