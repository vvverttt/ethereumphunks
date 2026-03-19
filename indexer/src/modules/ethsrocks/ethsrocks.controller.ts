import { Controller, Get } from '@nestjs/common';
import { EthsRocksService } from './ethsrocks.service';

@Controller('ethsrocks')
export class EthsRocksController {
  constructor(
    private readonly ethsrocksSvc: EthsRocksService,
  ) {}

  @Get('state')
  async getState() {
    return this.ethsrocksSvc.getContractState();
  }
}
