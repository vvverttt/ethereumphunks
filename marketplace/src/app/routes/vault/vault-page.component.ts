import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { SplashComponent } from '@/components/splash/splash.component';
import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { createClient } from '@supabase/supabase-js';
import { getWalletClient, getChainId, reconnect } from '@wagmi/core';
import { createPublicClient, http, encodePacked, keccak256 } from 'viem';
import { mainnet } from 'viem/chains';

const supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

const VAULT_ADDRESS = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218' as `0x${string}`;

const VAULT_ABI = [
  { inputs: [], name: 'poolSize', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'swapEnabled', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSwapped', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'swapFee', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'sendHashId', type: 'bytes32' }, { name: 'receiveHashId', type: 'bytes32' }, { name: 'proof', type: 'bytes32[]' }], name: 'swap', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: 'hashId', type: 'bytes32' }], name: 'cancelDeposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], name: 'userEthscriptionPossiblyStored', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], name: 'blocksRemainingUntilValidTransfer', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'offset', type: 'uint256' }, { name: 'limit', type: 'uint256' }], name: 'getPoolItems', outputs: [{ type: 'bytes32[]' }], stateMutability: 'view', type: 'function' },
] as const;

interface OwnedItem {
  hashId: string;
  sha: string;
  tokenId: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SplashComponent, PhunkGridComponent],
  selector: 'app-vault-page',
  templateUrl: './vault-page.component.html',
  styleUrls: ['./vault-page.component.scss'],
})
export class VaultPageComponent implements OnInit {
  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);

  loading = signal(true);
  poolSize = signal(0);
  totalSwapped = signal(0);
  swapEnabled = signal(false);
  swapFee = signal(0n);

  ownedItems = signal<OwnedItem[]>([]);
  selectedItem = signal<OwnedItem | null>(null);
  pickedItem = signal<OwnedItem | null>(null);
  vaultItems = signal<OwnedItem[]>([]);
  showAllVault = signal(false);
  vaultLimit = 110;

  // Fake collection object for splash — uses vault pool items as previews
  vaultCollection: any = {
    slug: 'vault',
    name: 'Phunk Swap',
    previews: [],
  };

  txPending = signal(false);
  pendingDeposit = signal<OwnedItem | null>(null);
  cooldownReady = signal(false);
  cooldownMessage = signal('Waiting for confirmation...');
  swapComplete = signal(false);

  private merkleTree: string[][] = [];
  private allV67HashIds: string[] = [];
  private rpcClient = createPublicClient({ chain: mainnet, transport: http('https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO') });

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
  ) {}

  async ngOnInit() {
    await this.loadContractState();
    await this.loadVaultItems();
    this.loadOwnedItems();
    this.restorePendingDeposit();
    this.loading.set(false);
  }

  private restorePendingDeposit() {
    try {
      const saved = localStorage.getItem('vault_pending_deposit');
      if (!saved) return;
      const item = JSON.parse(saved) as OwnedItem;
      this.pendingDeposit.set(item);
      this.pollCooldown(item);
    } catch {}
  }

  private savePendingDeposit(item: OwnedItem | null) {
    if (item) {
      localStorage.setItem('vault_pending_deposit', JSON.stringify(item));
    } else {
      localStorage.removeItem('vault_pending_deposit');
    }
  }

  async loadContractState() {
    try {
      const [poolSize, totalSwapped, swapEnabled, swapFee] = await Promise.all([
        this.rpcClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'poolSize' }),
        this.rpcClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalSwapped' }),
        this.rpcClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'swapEnabled' }),
        this.rpcClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'swapFee' }),
      ]);

      this.poolSize.set(Number(poolSize));
      this.totalSwapped.set(Number(totalSwapped));
      this.swapEnabled.set(swapEnabled as boolean);
      this.swapFee.set(swapFee as bigint);
    } catch (e) {
      console.error('Failed to load vault state:', e);
    }
  }

  async loadVaultItems() {
    try {
      const size = this.poolSize();
      if (size === 0) return;

      // Get pool hashIds from contract
      const hashIds: string[] = [];
      for (let i = 0; i < size; i += 100) {
        const items = await this.rpcClient.readContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI,
          functionName: 'getPoolItems',
          args: [BigInt(i), 100n],
        });
        hashIds.push(...(items as string[]));
      }

      // Look up sha and tokenId from Supabase
      const results: OwnedItem[] = [];
      for (let i = 0; i < hashIds.length; i += 50) {
        const batch = hashIds.slice(i, i + 50);
        const { data } = await supabase
          .from('ethscriptions')
          .select('hashId,sha,tokenId')
          .in('hashId', batch);
        if (data) results.push(...data as OwnedItem[]);
      }

      results.sort((a, b) => a.tokenId - b.tokenId);
      this.vaultItems.set(results);

      // Set splash previews from vault items
      this.vaultCollection = {
        ...this.vaultCollection,
        previews: results.map(r => ({ sha: r.sha })),
      };
    } catch (e) {
      console.error('Failed to load vault items:', e);
    }
  }

  async loadOwnedItems() {
    const address = await firstValueFrom(this.walletAddress$);
    if (!address) return;

    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId,sha,tokenId')
      .eq('slug', 'cryptophunksv67')
      .eq('owner', address.toLowerCase())
      .order('tokenId')
      .limit(200);

    this.ownedItems.set(data as OwnedItem[] || []);
  }

  pickItem(item: OwnedItem) {
    this.pickedItem.set(this.pickedItem()?.hashId === item.hashId ? null : item);
  }

  onVaultItemClick(item: OwnedItem) {
    // If in step 2 (deposited), clicking vault item picks it
    if (this.pendingDeposit()) {
      this.pickItem(item);
    }
  }

  selectItem(item: OwnedItem) {
    this.selectedItem.set(this.selectedItem()?.hashId === item.hashId ? null : item);
  }

  getImageUrl(item: { sha: string }): string {
    return environment.staticUrl + '/static/images/' + item.sha;
  }

  // ─── Wallet Helper ─────────────────────────────────────────

  private async getWallet() {
    try {
      const chainId = getChainId(this.web3Svc.config);
      return await getWalletClient(this.web3Svc.config, { chainId });
    } catch {
      await reconnect(this.web3Svc.config);
      const chainId = getChainId(this.web3Svc.config);
      return await getWalletClient(this.web3Svc.config, { chainId });
    }
  }

  // ─── Swap Flow ─────────────────────────────────────────────

  async onDeposit() {
    const item = this.selectedItem();
    if (!item || this.txPending()) return;

    this.txPending.set(true);
    try {
      const walletClient = await this.getWallet();

      await walletClient.sendTransaction({
        to: VAULT_ADDRESS,
        data: item.hashId as `0x${string}`,
        chain: walletClient.chain,
      });

      this.pendingDeposit.set(item);
      this.savePendingDeposit(item);
      this.pollCooldown(item);
    } catch (e) {
      console.error('Deposit failed:', e);
    } finally {
      this.txPending.set(false);
    }
  }

  async pollCooldown(item: OwnedItem) {
    const address = await firstValueFrom(this.walletAddress$);
    if (!address) return;

    const poll = setInterval(async () => {
      try {
        const stored = await this.rpcClient.readContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI,
          functionName: 'userEthscriptionPossiblyStored',
          args: [address as `0x${string}`, item.hashId as `0x${string}`],
        });

        if (!stored) {
          this.cooldownMessage.set('Deposit not yet confirmed...');
          return;
        }

        const blocks = await this.rpcClient.readContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI,
          functionName: 'blocksRemainingUntilValidTransfer',
          args: [address as `0x${string}`, item.hashId as `0x${string}`],
        });

        if (Number(blocks) === 0) {
          this.cooldownReady.set(true);
          this.cooldownMessage.set('Ready to swap!');
          clearInterval(poll);
        } else {
          this.cooldownMessage.set(`${Number(blocks)} blocks remaining...`);
        }
      } catch (e) {
        // Not deposited yet
      }
    }, 12000);
  }

  async onCompleteSwap() {
    const item = this.pendingDeposit();
    const picked = this.pickedItem();
    if (!item || !picked || this.txPending()) return;

    this.txPending.set(true);
    try {
      await this.ensureMerkleTree();
      const proof = this.getMerkleProof(item.hashId);

      const walletClient = await this.getWallet();

      const hash = await walletClient.writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'swap',
        args: [item.hashId as `0x${string}`, picked.hashId as `0x${string}`, proof as `0x${string}`[]],
        value: this.swapFee(),
        chain: walletClient.chain,
      });

      await this.rpcClient.waitForTransactionReceipt({ hash });

      this.swapComplete.set(true);
      this.pendingDeposit.set(null);
      this.savePendingDeposit(null);
      this.selectedItem.set(null);
      await this.loadContractState();
      await this.loadVaultItems();
      await this.loadOwnedItems();
    } catch (e) {
      console.error('Swap failed:', e);
    } finally {
      this.txPending.set(false);
    }
  }

  async onCancelDeposit() {
    const item = this.pendingDeposit();
    if (!item || this.txPending()) return;

    this.txPending.set(true);
    try {
      const walletClient = await this.getWallet();

      const hash = await walletClient.writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'cancelDeposit',
        args: [item.hashId as `0x${string}`],
        chain: walletClient.chain,
      });

      await this.rpcClient.waitForTransactionReceipt({ hash });

      this.pendingDeposit.set(null);
      this.savePendingDeposit(null);
      this.cooldownReady.set(false);
    } catch (e) {
      console.error('Cancel failed:', e);
    } finally {
      this.txPending.set(false);
    }
  }

  resetAfterSwap() {
    this.swapComplete.set(false);
  }

  // ─── Merkle Tree ───────────────────────────────────────────

  private async ensureMerkleTree() {
    if (this.merkleTree.length) return;

    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId')
        .eq('slug', 'cryptophunksv67')
        .order('tokenId')
        .range(offset, offset + 999);
      if (!data?.length) break;
      this.allV67HashIds.push(...data.map((d: any) => d.hashId.toLowerCase()));
      if (data.length < 1000) break;
      offset += 1000;
    }

    this.buildMerkleTree(this.allV67HashIds);
  }

  private buildMerkleTree(leaves: string[]) {
    let layer = [...leaves].sort();
    this.merkleTree = [layer];

    while (layer.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          const [a, b] = layer[i] < layer[i + 1] ? [layer[i], layer[i + 1]] : [layer[i + 1], layer[i]];
          next.push(keccak256(encodePacked(['bytes32', 'bytes32'], [a as `0x${string}`, b as `0x${string}`])));
        } else {
          next.push(layer[i]);
        }
      }
      this.merkleTree.push(next);
      layer = next;
    }
  }

  private getMerkleProof(hashId: string): string[] {
    const leaf = hashId.toLowerCase();
    let idx = this.merkleTree[0].indexOf(leaf);
    if (idx === -1) return [];

    const proof: string[] = [];
    for (let level = 0; level < this.merkleTree.length - 1; level++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < this.merkleTree[level].length) {
        proof.push(this.merkleTree[level][siblingIdx]);
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }
}
