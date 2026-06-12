import { Module } from '@nestjs/common';

import { StorageService } from './storage.service';
import { ConsensusReconcileService } from './consensus-reconcile.service';

@Module({
  providers: [
    StorageService,
    ConsensusReconcileService,
  ],
  exports: [
    StorageService,
  ],
})
export class StorageModule {}
