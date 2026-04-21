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
  auctionAddress: '',
  oldMarketAddresses: [] as string[],
  ogSlugs: ['og-missing-phunks', 'og-dysto-phunks'],
  evolveAddress: '',
  evolvePairs: {
    'og-missing-phunks': 'quantummissingphunksv67',
    'og-dysto-phunks': 'quantumdystophunkzv67',
    'quantummissingphunksv67': 'og-missing-phunks',
    'quantumdystophunkzv67': 'og-dysto-phunks',
  } as Record<string, string>,

  relayUrl: 'https://relay-sepolia.ethereumphunks.com',
  staticUrl: 'https://kfnprbhoodmgfhqojmqp.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://kfnprbhoodmgfhqojmqp.supabase.co',
  supabaseKey: 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe',
};
