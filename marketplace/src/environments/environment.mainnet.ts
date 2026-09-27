import { appConfig } from './app';

export const environment = {
  ...appConfig,

  env: 'mainnet',
  production: true,
  chainId: 1,

  rpcHttpProvider: 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO',
  receiptRpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO',
  frontendBackupRpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/jjWbKkRb85Zf4w1MmRTSR',
  explorerUrl: 'https://etherscan.io',
  externalMarketUrl: 'https://ethscriptions.com',

  magmaRpcHttpProvider: 'https://turbo.magma-rpc.com',

  marketAddress: '0xa48a43186612B179C0bc68Ea34B4932549a70BfA'.toLowerCase(),
  oldMarketAddresses: [
    '0xd3418772623be1a3cc6b6d45cb46420cedd9154a', // OG EtherPhunksMarket
  ],
  ogSlugs: ['missing-phunks', 'dysto-phunks'],
  marketAddressL2: '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e'.toLowerCase(),
  donationsAddress: '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'.toLowerCase(),
  pointsAddress: '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb'.toLowerCase(),
  bridgeAddress: '',
  bridgeAddressL2: '',
  // ERC-721 QuantumPhunks mint lottery (PhilipLotteryV67Erc721). Replaces the old
  // ethscription lottery + the second "Pro" lottery, both retired.
  lotteryAddress: '0x702862d4cb2E55452170814AAb9117cDE8287e61'.toLowerCase(),
  // Collections a holder can SURRENDER for an ETH discount (only offered when the
  // lottery's discountsEnabled() is on). Eligibility + per-token value are still
  // read on-chain (collectionUnits / discountForToken); this just lists which
  // collections to show + fetch the wallet's holdings for.
  lotterySurrenderCollections: [
    { address: '0xf07468ead8cf26c752c676e43c814fee9c8cf402', label: 'CryptoPhunks V2' },
    { address: '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce', label: 'Philip' },
  ],
  auctionAddress: '0xc1fA86b53e8e101c93c570f276bC5177832bd031'.toLowerCase(),
  auction2Address: '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630'.toLowerCase(),
  auctionDeployBlock: 24650288n,
  ethsrocksAddress: '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8'.toLowerCase(),
  evolveAddress: '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA'.toLowerCase(),
  erc721PhunksAddress: '0x9833b60234424e1DAAC8883D3F52c16093563BBF' as `0x${string}`,

  evolvePairs: {
    'missing-phunks': 'quantummissingphunksv67',
    'dysto-phunks': 'quantumdystophunkzv67',
    'quantummissingphunksv67': 'missing-phunks',
    'quantumdystophunkzv67': 'dysto-phunks',
  } as Record<string, string>,

  relayUrl: 'https://ethereumphunks.onrender.com',
  // MUST be an absolute origin that actually holds the objects. Empty means same-origin,
  // which only works if the deployed build contains /static and /data — and Cloudflare
  // rebuilds this project from git with a command that does NOT run bundle-static-assets.mjs
  // or build-sprite.mjs. Those steps only run under `yarn build:mainnet`, so every auto-build
  // shipped the app without its assets and the site broke SITEWIDE: images and, worse, every
  // collection's attributes, because data.service.ts fetches
  // `${staticUrl}/data/{slug}_attributes.json` and got Cloudflare's SPA fallback HTML back.
  //
  // The failure is invisible to a status check — the fallback returns HTTP 200, sometimes even
  // labelled image/png. Identify it by the bytes: identical response size across unrelated
  // shas, starting `<!doctype html>`.
  //
  // The quota fix does not need same-origin hosting. The saving comes from the SHEETS (one
  // request per ~512 tiles instead of one per tile), not from who serves them — so the sheets
  // live in Supabase's `static` bucket alongside the images, which is what this URL points at.
  // See upload-sprites-to-supabase.mjs.
  staticUrl: 'https://kfnprbhoodmgfhqojmqp.supabase.co/storage/v1/object/public',
  // Grid/thumbnail images are served from here (imageUrlPipe). Immutable (sha-addressed), so it
  // belongs on a CDN. Point this at the Cloudflare R2 custom domain once images are uploaded
  // (scripts/upload-images-to-r2.js) to get edge caching + escape Supabase's single-host throttle.
  // Falls back to staticUrl while unset. Objects must live under `/static/images/{sha}`.
  imageCdnUrl: 'https://kfnprbhoodmgfhqojmqp.supabase.co/storage/v1/object/public',

  supabaseUrl: 'https://kfnprbhoodmgfhqojmqp.supabase.co',
  supabaseKey: 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe',
};
