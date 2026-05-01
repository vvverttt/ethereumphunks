import { PinataSDK } from 'pinata';
import { fileURLToPath } from 'url';

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

import dotenv from 'dotenv';
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const configArg = args.find(arg => arg.startsWith('--configuration='));
const config = configArg ? configArg.split('=')[1] : null;

if (!config || !['mainnet', 'sepolia'].includes(config)) {
  logError('Please specify a valid configuration: --configuration=mainnet or --configuration=sepolia');
  process.exit(1);
}

const ensGatewayByConfig = {
  mainnet: 'etherphunks.eth.limo',
  sepolia: 'sepolia.etherphunks.eth.limo',
};

// IPFS configuration
const pinataJwt = process.env.PINATA_JWT;
const pinataGatewayDomain = (process.env.PINATA_GATEWAY_DOMAIN || 'gateway.pinata.cloud')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

// Common IPFS options for consistent hashing
const ipfsOptions = {
  cidVersion: 1,
  hashAlg: 'sha2-256',
  wrapWithDirectory: true
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryOperation(operation, retries = MAX_RETRIES) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(chalk.yellow(`Attempt ${i + 1} failed, retrying in ${RETRY_DELAY/1000} seconds...`));
      await sleep(RETRY_DELAY);
    }
  }
  throw lastError;
}

function logSection(title) {
  console.log(chalk.blue('\n' + '='.repeat(50)));
  console.log(chalk.blue.bold(` ${title} `));
  console.log(chalk.blue('='.repeat(50) + '\n'));
}

function logSuccess(message) {
  console.log(chalk.green('✓ ' + message));
}

function logError(message) {
  console.log(chalk.red('✗ ' + message));
}

function logInfo(message) {
  console.log(chalk.cyan('ℹ ' + message));
}

function logUrl(url) {
  console.log(chalk.hex('#00BFFF').underline(url));
}

function getBuildDirectory(config) {
  const angularJsonPath = path.join(__dirname, 'angular.json');
  const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
  const outputBase = angularJson?.projects?.['etherphunks-market']?.architect?.build?.configurations?.[config]?.outputPath?.base;

  if (!outputBase) {
    throw new Error(`Could not resolve outputPath.base for Angular build configuration "${config}"`);
  }

  const browserDir = path.join(__dirname, outputBase, 'browser');
  if (fs.existsSync(browserDir)) {
    return browserDir;
  }

  const baseDir = path.join(__dirname, outputBase);
  if (fs.existsSync(baseDir)) {
    return baseDir;
  }

  throw new Error(`Build directory not found for configuration "${config}". Checked: ${browserDir} and ${baseDir}`);
}

async function deployToIPFS() {
  try {
    if (!pinataJwt) {
      throw new Error('Missing PINATA_JWT environment variable');
    }

    const pinata = new PinataSDK({ pinataJwt });

    logSection(`Deploying ${config.toUpperCase()} Build`);

    const buildDir = getBuildDirectory(config);

    logInfo(`Build directory: ${buildDir}`);

    // Read all files in the build directory recursively and sort them
    const files = [];
    function readDir(dir, relativePath = '') {
      const items = fs.readdirSync(dir).sort(); // Sort files for consistent order
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relPath = relativePath ? `${relativePath}/${item}` : item;
        if (fs.statSync(fullPath).isDirectory()) {
          readDir(fullPath, relPath);
        } else {
          files.push({ fullPath, relPath });
        }
      }
    }
    readDir(buildDir);

    let rootHash;

    try {
      logInfo('Uploading to Pinata...');
      const fileObjects = files.map(({ fullPath, relPath }) => {
        const buffer = fs.readFileSync(fullPath);
        return new File([buffer], relPath);
      });
      const result = await retryOperation(() => pinata.upload.public.fileArray(fileObjects));
      rootHash = result.cid;
      logSuccess(`IPFS Hash: ${rootHash}`);
      logSuccess('Pinned to Pinata');
    } catch (error) {
      logError(`Failed to upload to Pinata: ${error.message}`);
      throw error;
    }

    logSection(`${config.toUpperCase()} Deployment Complete`);
    logSuccess(`IPFS Hash: ${rootHash}`);
    logInfo('Temporary Pinata gateway URL:');
    logUrl(`https://${pinataGatewayDomain}/ipfs/${rootHash}`);
    logInfo('Set your ENS content hash to:');
    logUrl(`ipfs://${rootHash}`);
    logInfo('Live ENS gateway URL after content hash update:');
    logUrl(`https://${ensGatewayByConfig[config]}`);

  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

deployToIPFS();
