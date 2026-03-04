import { appConfig } from './app';

export const environment = {
  ...appConfig,

  env: 'mainnet',
  production: true,
  chainId: 1,

  rpcHttpProvider: 'https://eth.llamarpc.com',
  receiptRpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO',
  explorerUrl: 'https://etherscan.io',
  externalMarketUrl: 'https://ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  marketAddress: '0xa48a43186612B179C0bc68Ea34B4932549a70BfA'.toLowerCase(),
  oldMarketAddresses: [
    '0xd3418772623be1a3cc6b6d45cb46420cedd9154a', // OG EtherPhunksMarket
  ],
  ogSlugs: ['og-missing-phunks', 'og-dysto-phunks'],
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  donationsAddress: '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'.toLowerCase(),
  pointsAddress: '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb'.toLowerCase(),
  bridgeAddress: ''.toLowerCase(),
  bridgeAddressL2: '0x26e8fD77346b4B006C5Df61f9706581933560F12'.toLowerCase(),
  lotteryAddress: '0x29b0d38112e8e743b63EB463F3351ab0F1E15977'.toLowerCase(),
  lottery2Address: '0x298771ECc338DE242ADa11e49E2B8224c33bf620'.toLowerCase(),
  auctionAddress: '0xc1fA86b53e8e101c93c570f276bC5177832bd031'.toLowerCase(),
  auctionDeployBlock: 24518451n,
  ethsrocksAddress: '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8'.toLowerCase(),
  ethsrocksDeployBlock: 24551518n,
  evolveAddress: '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA'.toLowerCase(),

  evolvePairs: {
    'og-missing-phunks': 'quantummissingphunksv67',
    'og-dysto-phunks': 'quantumdystophunkzv67',
    'quantummissingphunksv67': 'og-missing-phunks',
    'quantumdystophunkzv67': 'og-dysto-phunks',
  } as Record<string, string>,

  relayUrl: 'https://ethereumphunks.onrender.com',
  staticUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY',
};
