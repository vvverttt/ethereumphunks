import { Module } from '@nestjs/common';

import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { NftService } from './nft.service';

@Module({
  imports: [
    SharedModule,
    StorageModule,
  ],
  providers: [
    NftService,
  ],
  exports: [
    NftService,
  ],
})
export class NftModule {}
