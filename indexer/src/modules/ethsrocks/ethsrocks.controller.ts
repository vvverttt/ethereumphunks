import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { EthsRocksService } from './ethsrocks.service';

@Controller('ethsrocks')
export class EthsRocksController {
  constructor(
    private readonly ethsrocksSvc: EthsRocksService,
  ) {}

  @Get('authorize/:address')
  async authorize(@Param('address') address: string) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new BadRequestException('Invalid address');
    }
    return this.ethsrocksSvc.authorize(address);
  }

  @Get('signer')
  async getSigner() {
    return { signerAddress: this.ethsrocksSvc.signerAddress };
  }
}
