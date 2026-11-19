import { Module } from '@nestjs/common';

import { SharedModule } from '@/modules/shared/shared.module';
import { StorageModule } from '@/modules/storage/storage.module';

import { Auction721Service } from './auction721.service';

@Module({
  imports: [
    SharedModule,
    StorageModule,
  ],
  providers: [
    Auction721Service,
  ],
  exports: [
    Auction721Service,
  ],
})
export class Auction721Module {}
