import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { EthsRocksService } from './ethsrocks.service';

@Controller('ethsrocks')
export class EthsRocksController {
  constructor(
    private readonly ethsrocksSvc: EthsRocksService,
  ) {}

  @Get('authorize/:address')
  async authorize(
    @Param('address') address: string,
    @Query('philipOrWrappedTokenId') philipOrWrappedTokenId?: string,
    @Query('usePhilipIntern') usePhilipIntern?: string,
    @Query('cryptoPhunksV2TokenId') cryptoPhunksV2TokenId?: string,
  ) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new BadRequestException('Invalid address');
    }
    if (!philipOrWrappedTokenId || !cryptoPhunksV2TokenId || usePhilipIntern === undefined) {
      throw new BadRequestException('Missing token IDs (philipOrWrappedTokenId, usePhilipIntern, cryptoPhunksV2TokenId)');
    }
    return this.ethsrocksSvc.authorize(
      address,
      BigInt(philipOrWrappedTokenId),
      usePhilipIntern === 'true',
      BigInt(cryptoPhunksV2TokenId),
    );
  }

  @Get('signer')
  async getSigner() {
    return { signerAddress: this.ethsrocksSvc.signerAddress };
  }
}
