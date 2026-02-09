import { appConfig } from './app';

export const environment = {
  ...appConfig,

  env: 'dev-sepolia',
  production: false,
  chainId: 11155111,

  rpcHttpProvider: 'https://eth-sepolia.g.alchemy.com/v2/0FN3yRRyJYmfFlfvjco_d9Y8HaVBIH45',
  explorerUrl: 'https://sepolia.etherscan.io',
  externalMarketUrl: 'https://sepolia.ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  pointsAddress: '0x2a953aa14e986b0595a0c5201dd267391bf7d39d'.toLowerCase(),
  donationsAddress: '0x26e8fd77346b4b006c5df61f9706581933560f12'.toLowerCase(),
  marketAddress: '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e'.toLowerCase(),
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  bridgeAddress: '0x1565f60D2469F18bBCc96B2C29220412F2Fe98Bd'.toLowerCase(),
  bridgeAddressL2: '0x26e8fD77346b4B006C5Df61f9706581933560F12'.toLowerCase(),
  lotteryAddress: '0x4C0b9B7b3e290B793474c533C7AC90262bb69971'.toLowerCase(),

  relayUrl: 'https://relay-sepolia.ethereumphunks.com',
  staticUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.UO_fO63CHOIDCEBp1MQ4_oE0Z08m8mlz7_Z07zILBQQ',
};
