import { appConfig } from './app';

export const environment = {
  ...appConfig,

  env: 'dev-mainnet',
  production: false,
  chainId: 1,

  // rpcHttpProvider: 'https://eth-mainnet.g.alchemy.com/v2/19IQKn99eagaaRKD-uSOCE1aYEHLSnmL',
  rpcHttpProvider: 'http://reth.dappnode:8545',
  // rpcHttpProvider: 'https://eth-mainnet.g.alchemy.com/v2/19IQKn99eagaaRKD-uSOCE1aYEHLSnmL',
  explorerUrl: 'https://etherscan.io',
  externalMarketUrl: 'https://ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  marketAddress: '0xD3418772623Be1a3cc6B6D45CB46420CEdD9154a'.toLowerCase(),
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  donationsAddress: '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'.toLowerCase(),
  pointsAddress: '0x24d667C5195a767819C9313D6ceEC09D0Dc06Cfd'.toLowerCase(),
  bridgeAddress: ''.toLowerCase(),
  bridgeAddressL2: '0x26e8fD77346b4B006C5Df61f9706581933560F12'.toLowerCase(),

  relayUrl: 'http://localhost:3069',
  staticUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY',
};
