import { Injectable } from '@nestjs/common';
import { keccak256, encodePacked, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { l1Client } from '@/constants/ethereum';
import { StorageService } from '@/modules/storage/storage.service';

// Collection slugs for ethscription eligibility
const MISSING_PHUNK_SLUGS = ['og-missing-phunks', 'missing-phunks', 'quantummissingphunksv67'];
const QUANTUM_DYSTO_SLUG = 'quantumdystophunkzv67';
const QUANTUM_PHUNK_SLUG = 'cryptophunksv67';

// EthsRocks contract
const ETHSROCKS_ADDRESS = (process.env.ETHSROCKS_ADDRESS_MAINNET || '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8').toLowerCase() as Hex;
const CHAIN_ID = Number(process.env.CHAIN_ID) || 1;

// Signature validity: 10 minutes
const SIGNATURE_TTL_SECONDS = 600;

// Minimal ABI for on-chain usage check
const USED_ETHSCRIPTION_ABI = [{
  inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
  name: 'usedEthscription',
  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

interface EthscriptionItem {
  hashId: string;
  owner: string;
  slug: string;
}

@Injectable()
export class EthsRocksService {
  private signerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

  constructor(
    private readonly storageSvc: StorageService,
  ) {
    const pk = process.env.API_PRIVATE_KEY;
    if (pk) {
      this.signerAccount = privateKeyToAccount(`0x${pk.replace(/^0x/, '')}`);
    }
  }

  get signerAddress(): string | null {
    return this.signerAccount?.address?.toLowerCase() || null;
  }

  async authorize(
    buyerAddress: string,
    philipOrWrappedTokenId: bigint,
    usePhilipIntern: boolean,
    cryptoPhunksV2TokenId: bigint,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    signature?: string;
    missingPhunkHash?: string;
    quantumDystoHash?: string;
    quantumPhunkHash?: string;
    deadline?: number;
  }> {
    if (!this.signerAccount) {
      return { eligible: false, reason: 'Signer not configured' };
    }

    const addr = buyerAddress.toLowerCase();

    // Fetch ethscriptions owned by this address from each collection
    const [missingPhunks, quantumDystos, quantumPhunks] = await Promise.all([
      this.fetchEthscriptionsByOwner(addr, MISSING_PHUNK_SLUGS),
      this.fetchEthscriptionsByOwner(addr, [QUANTUM_DYSTO_SLUG]),
      this.fetchEthscriptionsByOwner(addr, [QUANTUM_PHUNK_SLUG]),
    ]);

    if (missingPhunks.length === 0) {
      return { eligible: false, reason: 'No MissingPhunk (OG or Quantum) found' };
    }
    if (quantumDystos.length === 0) {
      return { eligible: false, reason: 'No QuantumDystoPhunk found' };
    }
    if (quantumPhunks.length === 0) {
      return { eligible: false, reason: 'No QuantumPhunk found' };
    }

    // Pick first unused from each collection (filter out already-used on-chain)
    const missingPhunkHash = await this.findUnusedHash(missingPhunks);
    if (!missingPhunkHash) {
      return { eligible: false, reason: 'All your MissingPhunks have already been used' };
    }
    const quantumDystoHash = await this.findUnusedHash(quantumDystos);
    if (!quantumDystoHash) {
      return { eligible: false, reason: 'All your QuantumDystoPhunks have already been used' };
    }
    const quantumPhunkHash = await this.findUnusedHash(quantumPhunks);
    if (!quantumPhunkHash) {
      return { eligible: false, reason: 'All your QuantumPhunks have already been used' };
    }

    // Deadline: current time + TTL
    const deadline = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;

    // Sign: must match contract's keccak256(abi.encodePacked(buyer, hashes..., tokenIds..., deadline, chainId, contract))
    const dataHash = keccak256(encodePacked(
      ['address', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bool', 'uint256', 'uint256', 'uint256', 'address'],
      [addr as Hex, missingPhunkHash, quantumDystoHash, quantumPhunkHash, philipOrWrappedTokenId, usePhilipIntern, cryptoPhunksV2TokenId, BigInt(deadline), BigInt(CHAIN_ID), ETHSROCKS_ADDRESS]
    ));

    const signature = await this.signerAccount.signMessage({
      message: { raw: dataHash as Hex },
    });

    return {
      eligible: true,
      signature,
      missingPhunkHash,
      quantumDystoHash,
      quantumPhunkHash,
      deadline,
    };
  }

  private async findUnusedHash(items: EthscriptionItem[]): Promise<Hex | null> {
    for (const item of items) {
      const used = await this.isUsedOnChain(item.hashId as Hex);
      if (!used) return item.hashId as Hex;
    }
    return null;
  }

  private async isUsedOnChain(hashId: Hex): Promise<boolean> {
    try {
      return await l1Client.readContract({
        address: ETHSROCKS_ADDRESS,
        abi: USED_ETHSCRIPTION_ABI,
        functionName: 'usedEthscription',
        args: [hashId],
      });
    } catch {
      return false;
    }
  }

  private async fetchEthscriptionsByOwner(owner: string, slugs: string[]): Promise<EthscriptionItem[]> {
    const { data, error } = await this.storageSvc.supabase
      .from('ethscriptions')
      .select('hashId, owner, slug')
      .eq('owner', owner)
      .in('slug', slugs)
      .limit(100);

    if (error || !data) return [];
    return data as EthscriptionItem[];
  }
}
