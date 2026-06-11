// Production defaults (used when .env is not available, e.g., on Render free tier)
// IMPORTANT: Set env vars BEFORE any imports to ensure constants/ethereum.ts uses correct values
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
if (!process.env.MODE) process.env.MODE = 'poll';

// Enable indexer and queue now that production build is stable
// Queue is required for indexer to function (uses external Redis, minimal memory impact)
if (!process.env.INDEXER) process.env.INDEXER = '1';
if (!process.env.QUEUE) process.env.QUEUE = '1';
if (!process.env.DISCORD) process.env.DISCORD = '0';
if (!process.env.TWITTER) process.env.TWITTER = '0';
if (!process.env.TX_POOL) process.env.TX_POOL = '0';
if (!process.env.MINT) process.env.MINT = '0';

if (!process.env.CHAIN_ID) process.env.CHAIN_ID = '1';
if (!process.env.PORT) process.env.PORT = '3069';

if (!process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS = 'http://localhost:9000,http://localhost:4200,https://ethereumphunks.pages.dev,https://etherphunks.eth.limo,https://quantumphunks.com,https://www.quantumphunks.com';
}

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://:5VuaxZYlQ6IyRN9VQEnpHpObEhAtobql@redis-13048.c17.us-east-1-4.ec2.cloud.redislabs.com:13048';
}

if (!process.env.ETHSCRIPTIONS_API_URL) {
  process.env.ETHSCRIPTIONS_API_URL = 'https://api.ethscriptions.com/v2';
}

if (!process.env.RPC_URL_MAINNET) {
  process.env.RPC_URL_MAINNET = 'https://ethereum-rpc.publicnode.com';
}
if (!process.env.RPC_URL_MAINNET_BACKUP) {
  process.env.RPC_URL_MAINNET_BACKUP = 'https://rpc.mevblocker.io,https://1rpc.io/eth';
}

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
}
if (!process.env.SUPABASE_SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE env var is required');
}

const requiredMainnetContractEnvs = [
  'MARKET_ADDRESS_MAINNET_L1',
  'OLD_MARKET_ADDRESS_MAINNET_L1',
  'POINTS_ADDRESS_MAINNET',
  'LOTTERY_ADDRESS_MAINNET',
  'LOTTERY2_ADDRESS_MAINNET',
  'AUCTION_ADDRESS_MAINNET',
  // AUCTION2_ADDRESS_MAINNET and EVOLVE_ADDRESS_MAINNET are optional — the indexer
  // already filters out missing/empty addresses (Set([...]).filter(Boolean)), so a
  // retired auction2/evolve contract simply isn't watched instead of crashing boot.
] as const;

for (const envName of requiredMainnetContractEnvs) {
  if (!process.env[envName]) {
    throw new Error(`${envName} env var is required`);
  }
}



import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from '@/app.module';

import { CustomLogger } from '@/modules/shared/services/logger.service';

// Global safety net: a long-running indexer must never be killed by a single stray
// promise rejection / async throw (Node 22 exits the process on unhandled rejections by
// default — that was the recurring "Exited with status 1" restart loop on Render). Log and
// keep going; the block watcher is idempotent and will continue with the next block.
process.on('unhandledRejection', (reason: any) => {
  Logger.error(
    `Unhandled promise rejection: ${reason?.stack || reason?.message || JSON.stringify(reason)}`,
    'Process',
  );
});
process.on('uncaughtException', (err: any) => {
  Logger.error(`Uncaught exception: ${err?.stack || err?.message || err}`, 'Process');
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
      callback(null, allowedOrigins.includes(origin) ? origin : false);
    },
    methods: ['GET', 'POST']
  });

  const customLogger = app.get(CustomLogger);
  app.useLogger(customLogger);

  await app.listen(Number(process.env.PORT));
  Logger.debug(`Server running on http://localhost:${process.env.PORT}`, 'Bootstrap');
}

bootstrap();
