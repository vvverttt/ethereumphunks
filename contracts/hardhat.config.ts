import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
// import 'hardhat-log-remover';

import dotenv from 'dotenv';
dotenv.config();
import path from 'path';

const WIN_TMP = process.env.TEMP || process.env.TMP || 'C:\\\\tmp';
const HH_WORKDIR = path.join(WIN_TMP, 'ethereumphunks-hardhat');

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          evmVersion: 'paris',
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ],
    overrides: {
      // Size-optimize the V67 implementation (very large contract, infrequently called)
      'contracts/V2MainnetUpgrade/ERC721PhunksV67/ERC721PhunksV67.sol': {
        version: '0.8.20',
        settings: {
          evmVersion: 'paris',
          optimizer: { enabled: true, runs: 1 },
          viaIR: true,
        },
      },
      'contracts/QuantumPhunks.sol': {
        version: '0.8.20',
        settings: {
          evmVersion: 'paris',
          optimizer: { enabled: true, runs: 1 },
          viaIR: true,
        },
      },
      'contracts/QuantumPhunksLaunch.sol': {
        version: '0.8.20',
        settings: {
          evmVersion: 'paris',
          optimizer: { enabled: true, runs: 1 },
          viaIR: true,
        },
      },
    },
  },
  paths: {
    // Compile all contracts (including new CARL core contracts under `contracts/`),
    // while keeping existing V2MainnetUpgrade paths intact.
    sources: './contracts',
    tests: './test',
    // Avoid OneDrive/Windows file-lock issues (OZ upgrades writes a validations lockfile).
    cache: path.join(HH_WORKDIR, 'cache'),
    artifacts: path.join(HH_WORKDIR, 'artifacts'),
  },
  networks: {
    // hardhat: {
    //   chainId: 1,
    //   forking: {
    //     enabled: true,
    //     url: 'https://eth-mainnet.g.alchemy.com/v2/yPJzT7r3rcFmI4ekjA9S7S1SP688b-au',
    //     blockNumber: 20452276,
    //   },
    // },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
      chainId: 1,
      from: (process.env.MAINNET_ADDRESS || undefined) as any,
      // Allow `npx hardhat compile` to run even when no deploy key is configured.
      accounts:
        process.env.MAINNET_PK && process.env.MAINNET_PK.length === 64
          ? [`0x${process.env.MAINNET_PK}`]
          : [],
      gasPrice: 500_000_000, // 0.5 gwei (well above current base fee; keeps deploy cost low)
    },
    // Frame.sh local RPC — signs via MetaMask/Ledger connected to Frame.
    // No private key ever touches this machine's disk or shell.
    // Use:  npx hardhat run scripts/deploy-quantumphunks-launch.ts --network mainnetFrame
    mainnetFrame: {
      url: 'http://127.0.0.1:1248',
      chainId: 1,
    },
    ...(process.env.TREASURY_PK ? {
      treasury: {
        url: 'https://ethereum-rpc.publicnode.com',
        chainId: 1,
        accounts: [`0x${process.env.TREASURY_PK}`],
      },
    } : {}),
    // sepolia: {
    //   url: 'http://geth.sepolia-geth.dappnode:8545',
    //   chainId: 11155111,
    //   from: process.env.SEPOLIA_ADDRESS as string,
    //   accounts: [`0x${process.env.SEPOLIA_PK}`],
    // },
    // magma: {
    //   url: 'https://turbo.magma-rpc.com',
    //   chainId: 6969696969,
    //   from: process.env.SEPOLIA_ADDRESS as string,
    //   accounts: [`0x${process.env.SEPOLIA_PK}`],
    // },
  },
  sourcify: {
    enabled: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: 'magma',
        chainId: 6969696969,
        urls: {
          apiURL: 'https://magmascan.org/api/',
          browserURL: "https://magmascan.org",
        }
      }
    ]
  },
};

export default config;
