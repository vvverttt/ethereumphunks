import { appConfig } from './app';

export const environment = {
  ...appConfig,

  env: 'dev-mainnet',
  production: false,
  chainId: 1,

  rpcHttpProvider: 'https://ethereum-rpc.publicnode.com',
  // rpcHttpProvider: 'https://cloudflare-eth.com',
  // rpcHttpProvider: 'http://reth.dappnode:8545',
  explorerUrl: 'https://etherscan.io',
  externalMarketUrl: 'https://ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  marketAddress: '0x10e137E267dCB5774e42251c32305F457a6aE5Ec'.toLowerCase(),
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  donationsAddress: '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'.toLowerCase(),
  pointsAddress: '0x28AbBC0A90d10870bcbf2d14256c6cC791090E86'.toLowerCase(),
  bridgeAddress: ''.toLowerCase(),
  bridgeAddressL2: '0x26e8fD77346b4B006C5Df61f9706581933560F12'.toLowerCase(),
  lotteryAddress: '0x4C0b9B7b3e290B793474c533C7AC90262bb69971'.toLowerCase(),

  relayUrl: 'https://ethereumphunks.onrender.com',
  staticUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY',
};
