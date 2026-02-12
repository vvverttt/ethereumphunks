import { appConfig } from './app';

export const environment = {
  ...appConfig,

  env: 'mainnet',
  production: true,
  chainId: 1,

  rpcHttpProvider: 'https://ethereum-rpc.publicnode.com',
  explorerUrl: 'https://etherscan.io',
  externalMarketUrl: 'https://ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  marketAddress: '0x7DDe39623aF1D78651b0EEc754622b95bbD56896'.toLowerCase(),
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  donationsAddress: '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'.toLowerCase(),
  pointsAddress: '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14'.toLowerCase(),
  bridgeAddress: ''.toLowerCase(),
  bridgeAddressL2: '0x26e8fD77346b4B006C5Df61f9706581933560F12'.toLowerCase(),
  lotteryAddress: '0x4c6569909028F11873Ba5548900d4609a436bB98'.toLowerCase(),

  relayUrl: 'https://ethereumphunks.onrender.com',
  staticUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY',
};
