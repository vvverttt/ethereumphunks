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
  process.env.ALLOWED_ORIGINS = 'http://localhost:9000,http://localhost:4200,https://ethereumphunks-git-market-vvverttts-projects.vercel.app,https://etherphunks.eth.limo';
}

if (!process.env.BRIDGE_L1_BLOCK_DELAY) process.env.BRIDGE_L1_BLOCK_DELAY = '10';

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://redis-13048.c17.us-east-1-4.ec2.cloud.redislabs.com:13048';
}

if (!process.env.ETHSCRIPTIONS_API_URL) {
  process.env.ETHSCRIPTIONS_API_URL = 'https://api.ethscriptions.com/v2';
}

if (!process.env.RPC_URL_MAINNET) {
  process.env.RPC_URL_MAINNET = 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO';
}
if (!process.env.RPC_URL_MAINNET_BACKUP) {
  process.env.RPC_URL_MAINNET_BACKUP = 'https://eth.llamarpc.com,https://rpc.ankr.com/eth,https://eth.drpc.org';
}

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
}
if (!process.env.SUPABASE_SERVICE_ROLE) {
  process.env.SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
}

if (!process.env.MARKET_ADDRESS_MAINNET_L1) {
  process.env.MARKET_ADDRESS_MAINNET_L1 = '0xD3418772623Be1a3cc6B6D45CB46420CEdD9154a';
}
if (!process.env.MARKET_ADDRESS_MAINNET_L2) {
  process.env.MARKET_ADDRESS_MAINNET_L2 = '0x3Dfbc8C62d3cE0059BDaf21787EC24d5d116fe1e';
}

if (!process.env.POINTS_ADDRESS_MAINNET) {
  process.env.POINTS_ADDRESS_MAINNET = '0x24d667C5195a767819C9313D6ceEC09D0Dc06Cfd';
}
if (!process.env.DONATIONS_ADDRESS_MAINNET) {
  process.env.DONATIONS_ADDRESS_MAINNET = '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de';
}

if (!process.env.BRIDGE_ADDRESS_MAINNET_L1) {
  process.env.BRIDGE_ADDRESS_MAINNET_L1 = '';
}
if (!process.env.BRIDGE_ADDRESS_MAINNET_L2) {
  process.env.BRIDGE_ADDRESS_MAINNET_L2 = '0x26e8fD77346b4B006C5Df61f9706581933560F12';
}

if (!process.env.API_PRIVATE_KEY) {
  process.env.API_PRIVATE_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';
}

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from '@/app.module';

import { CustomLogger } from '@/modules/shared/services/logger.service';

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
