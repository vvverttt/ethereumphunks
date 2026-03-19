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
  process.env.ALLOWED_ORIGINS = 'http://localhost:9000,http://localhost:4200,https://ethereumphunks-git-market-vvverttts-projects.vercel.app,https://etherphunks.eth.limo,https://quantumphunks.com,https://www.quantumphunks.com';
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

if (!process.env.MARKET_ADDRESS_MAINNET_L1) {
  process.env.MARKET_ADDRESS_MAINNET_L1 = '0x7DDe39623aF1D78651b0EEc754622b95bbD56896';
}
if (!process.env.OLD_MARKET_ADDRESS_MAINNET_L1) {
  process.env.OLD_MARKET_ADDRESS_MAINNET_L1 = '0xD3418772623Be1a3cc6B6D45CB46420CEdD9154a';
}

if (!process.env.POINTS_ADDRESS_MAINNET) {
  process.env.POINTS_ADDRESS_MAINNET = '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb';
}

if (!process.env.LOTTERY_ADDRESS_MAINNET) {
  process.env.LOTTERY_ADDRESS_MAINNET = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
}
if (!process.env.LOTTERY2_ADDRESS_MAINNET) {
  process.env.LOTTERY2_ADDRESS_MAINNET = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';
}

if (!process.env.EVOLVE_ADDRESS_MAINNET) {
  process.env.EVOLVE_ADDRESS_MAINNET = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
}

if (!process.env.AUCTION_ADDRESS_MAINNET) {
  process.env.AUCTION_ADDRESS_MAINNET = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
}

if (!process.env.ETHSROCKS_ADDRESS_MAINNET) {
  process.env.ETHSROCKS_ADDRESS_MAINNET = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
}

// API_PRIVATE_KEY must be set via environment variable (e.g. Render dashboard)
// Used by EthsRocks signer — do NOT hardcode here

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
