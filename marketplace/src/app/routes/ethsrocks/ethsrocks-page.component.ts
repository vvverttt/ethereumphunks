import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { keccak256, encodePacked } from 'viem';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { EthsRocksService } from '@/services/ethsrocks.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

const CRYPTO_PHUNKS_V2 = '0xf07468ead8cf26c752c676e43c814fee9c8cf402';
const PHILIP_INTERN = '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce';
// EtherPhunks live on a different Supabase instance
const ETHERPHUNKS_SUPABASE_URL = 'https://kcbuycbhynlmsrvoegzp.supabase.co';
const ETHERPHUNKS_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY';
const ETHERPHUNKS_STATIC_URL = 'https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public';

// Minimal ERC-721 ABI for reading user's tokens
const ERC721_ABI = [
  { inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], name: 'tokenOfOwnerByIndex', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'tokenId', type: 'uint256' }], name: 'getApproved', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], name: 'isApprovedForAll', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], name: 'setApprovalForAll', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

interface SwapItem {
  type: 'ethscription' | 'erc721';
  hashId?: string;
  tokenId?: number;
  slug?: string;
  sha?: string;
  label: string;
  selected: boolean;
}

const staticUrl = (environment as any).staticUrl || '';

@Component({
  selector: 'app-ethsrocks-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ethsrocks-page.component.html',
  styleUrls: ['./ethsrocks-page.component.scss'],
})
export class EthsRocksPageComponent implements OnInit {

  connected$ = this.store.select(appStateSelectors.selectConnected);
  address$ = this.store.select(appStateSelectors.selectWalletAddress);

  // Contract state
  remaining = signal<number>(0);
  totalSwapped = signal<number>(0);
  isPaused = signal<boolean>(true);
  swapEnabled = signal<boolean>(false);
  hasContract = signal<boolean>(false);
  loading = signal<boolean>(true);
  cryptoPhunksV2Required = signal<number>(1);
  philipInternRequired = signal<number>(3);

  ethscriptionBatchRequired = signal<number>(5);

  // Swap tab
  activeTab = signal<'etherphunks' | 'missing' | 'dysto'>('etherphunks');

  // User's eligible items
  ogItems = signal<SwapItem[]>([]);
  missingItems = signal<SwapItem[]>([]);
  dystoItems = signal<SwapItem[]>([]);
  v2Items = signal<SwapItem[]>([]);
  philipItems = signal<SwapItem[]>([]);
  etherphunkItems = signal<SwapItem[]>([]);
  loadingItems = signal<boolean>(false);

  // Selected items
  selectedEthscription = signal<SwapItem | null>(null);
  selectedV2 = signal<SwapItem[]>([]);
  selectedPhilip = signal<SwapItem[]>([]);
  selectedEtherphunks = signal<SwapItem[]>([]);

  // Merkle tree for EtherPhunks
  private merkleTree: string[][] = [];
  private merkleLeaves: string[] = [];

  // Pending ethscription deposit (step 1 done, waiting for step 2)
  pendingDeposit = signal<SwapItem | null>(null);
  swapComplete = signal<boolean>(false);

  // TX state
  errorMessage = signal<string>('');
  txPending = signal<boolean>(false);
  txHash = signal<string>('');
  successMessage = signal<string>('');

  explorerUrl = (environment as any).explorerUrl || 'https://etherscan.io';
  contractAddress = (environment as any).ethsrocksAddress || '';

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private dataSvc: DataService,
    private ethsrocksSvc: EthsRocksService,
  ) {}

  async ngOnInit() {
    this.hasContract.set(this.ethsrocksSvc.hasAddress);
    if (!this.ethsrocksSvc.hasAddress) {
      this.loading.set(false);
      return;
    }

    // Load from localStorage first (immediate)
    const stored = localStorage.getItem('ethsrocks_pending_deposit');
    if (stored) {
      try { this.pendingDeposit.set(JSON.parse(stored)); } catch {}
    }

    await this.loadState();
    this.loading.set(false);

    this.address$.subscribe(async (addr) => {
      if (addr) {
        this.loadState();
        this.loadUserItems();
        // Only detect from Supabase if no localStorage pending
        if (!this.pendingDeposit()) {
          this.detectPendingDeposits(addr);
        }
      }
    });
  }

  async loadState() {
    const state = await this.ethsrocksSvc.getContractState();
    if (state) {
      this.remaining.set(state.remaining);
      this.isPaused.set(state.paused);
      this.swapEnabled.set(state.swapEnabled);
      this.totalSwapped.set(state.totalSwapped);
      this.cryptoPhunksV2Required.set(state.cryptoPhunksV2Required);
      this.philipInternRequired.set(state.philipInternRequired);
      try {
        const batchReq = await this.ethsrocksSvc.getEthscriptionBatchRequired();
        this.ethscriptionBatchRequired.set(Number(batchReq) || 5);
      } catch {}
    }
  }

  async loadUserItems() {
    const address = this.web3Svc.getCurrentAddress();
    if (!address) return;

    this.loadingItems.set(true);

    try {
      // Load OG ethscriptions from Supabase
      const [missing, dysto] = await Promise.all([
        firstValueFrom(this.dataSvc.fetchOwned(address, 'og-missing-phunks')),
        firstValueFrom(this.dataSvc.fetchOwned(address, 'og-dysto-phunks')),
      ]);

      const ogList: SwapItem[] = [];
      for (const item of [...missing, ...dysto]) {
        if (!item.hashId || item.isEscrowed) continue;
        // Check if eligible on-chain
        try {
          const eligible = await this.ethsrocksSvc.isEligibleEthscription(item.hashId as `0x${string}`);
          if (eligible) {
            ogList.push({
              type: 'ethscription',
              hashId: item.hashId,
              sha: item.sha,
              slug: item.slug,
              label: `${item.slug === 'og-missing-phunks' ? 'OG Missing' : 'OG Dysto'} #${item.tokenId}`,
              selected: false,
            });
          }
        } catch {}
      }
      this.ogItems.set(ogList);
      this.missingItems.set(ogList.filter(i => i.slug === 'og-missing-phunks'));
      this.dystoItems.set(ogList.filter(i => i.slug === 'og-dysto-phunks'));

      // Load CryptoPhunksV2 tokens
      try {
        const v2Balance = await this.web3Svc.l1Client.readContract({
          address: CRYPTO_PHUNKS_V2 as `0x${string}`,
          abi: ERC721_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        const v2List: SwapItem[] = [];
        const count = Math.min(Number(v2Balance), 50);
        for (let i = 0; i < count; i++) {
          const tokenId = await this.web3Svc.l1Client.readContract({
            address: CRYPTO_PHUNKS_V2 as `0x${string}`,
            abi: ERC721_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [address, BigInt(i)],
          });
          v2List.push({
            type: 'erc721',
            tokenId: Number(tokenId),
            label: `CryptoPhunks V2 #${Number(tokenId)}`,
            selected: false,
          });
        }
        this.v2Items.set(v2List);
      } catch { this.v2Items.set([]); }

      // Load PhilipInternProject tokens
      try {
        const philipBalance = await this.web3Svc.l1Client.readContract({
          address: PHILIP_INTERN as `0x${string}`,
          abi: ERC721_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        const philipList: SwapItem[] = [];
        const count = Math.min(Number(philipBalance), 50);
        for (let i = 0; i < count; i++) {
          const tokenId = await this.web3Svc.l1Client.readContract({
            address: PHILIP_INTERN as `0x${string}`,
            abi: ERC721_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [address, BigInt(i)],
          });
          philipList.push({
            type: 'erc721',
            tokenId: Number(tokenId),
            label: `PhilipIntern #${Number(tokenId)}`,
            selected: false,
          });
        }
        this.philipItems.set(philipList);
      } catch { this.philipItems.set([]); }

      // Load EtherPhunks from etherphunks Supabase (different database)
      try {
        const epRes = await fetch(
          `${ETHERPHUNKS_SUPABASE_URL}/rest/v1/ethscriptions?select=hashId,tokenId,sha,owner&slug=eq.ethereum-phunks&owner=eq.${address.toLowerCase()}&limit=200&order=tokenId`,
          { headers: { apikey: ETHERPHUNKS_SUPABASE_KEY, Authorization: `Bearer ${ETHERPHUNKS_SUPABASE_KEY}` } }
        );
        const epData = await epRes.json();
        const epList: SwapItem[] = [];
        for (const item of (Array.isArray(epData) ? epData : [])) {
          if (!item.hashId) continue;
          epList.push({
            type: 'ethscription',
            hashId: item.hashId,
            sha: item.sha,
            slug: 'ethereum-phunks',
            label: `EtherPhunk #${item.tokenId}`,
            selected: false,
          });
        }
        this.etherphunkItems.set(epList);
      } catch { this.etherphunkItems.set([]); }

    } catch (err) {
      console.error('Failed to load user items', err);
    } finally {
      this.loadingItems.set(false);
    }
  }

  selectEthscription(item: SwapItem) {
    const current = this.selectedEthscription();
    if (current?.hashId === item.hashId) {
      this.selectedEthscription.set(null);
    } else {
      this.selectedEthscription.set(item);
    }
  }

  toggleErc721(item: SwapItem, list: 'v2' | 'philip') {
    const selected = list === 'v2' ? this.selectedV2() : this.selectedPhilip();
    const max = list === 'v2' ? this.cryptoPhunksV2Required() : this.philipInternRequired();
    const idx = selected.findIndex(s => s.tokenId === item.tokenId);

    let updated: SwapItem[];
    if (idx >= 0) {
      updated = selected.filter((_, i) => i !== idx);
    } else if (selected.length < max) {
      updated = [...selected, item];
    } else {
      return;
    }

    if (list === 'v2') this.selectedV2.set(updated);
    else this.selectedPhilip.set(updated);
  }

  isSelected(item: SwapItem, list: 'v2' | 'philip'): boolean {
    const selected = list === 'v2' ? this.selectedV2() : this.selectedPhilip();
    return selected.some(s => s.tokenId === item.tokenId);
  }

  // ─── Swap actions ─────────────────────────────────────

  async detectPendingDeposits(address: string) {
    try {
      // Check OG ethscriptions owned by contract with prevOwner = address (our Supabase)
      const ogRes = await fetch(
        `https://kfnprbhoodmgfhqojmqp.supabase.co/rest/v1/ethscriptions?select=hashId,tokenId,slug&owner=eq.${this.contractAddress.toLowerCase()}&prevOwner=eq.${address.toLowerCase()}&slug=in.(og-missing-phunks,og-dysto-phunks)&limit=5`,
        { headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE' } }
      );
      const ogItems = await ogRes.json();
      if (Array.isArray(ogItems) && ogItems.length > 0) {
        // Single OG deposit
        const item = ogItems[0];
        this.savePendingDeposit({
          type: 'ethscription',
          hashId: item.hashId,
          slug: item.slug,
          label: `${item.slug === 'og-missing-phunks' ? 'OG Missing' : 'OG Dysto'} #${item.tokenId}`,
          selected: false,
        });
        return;
      }

      // Check EtherPhunks: find items owned by contract from this wallet
      // Check etherphunks Supabase for items with owner = contract
      const epRes = await fetch(
        `${ETHERPHUNKS_SUPABASE_URL}/rest/v1/ethscriptions?select=hashId,tokenId&slug=eq.ethereum-phunks&owner=eq.${this.contractAddress.toLowerCase()}&limit=50`,
        { headers: { apikey: ETHERPHUNKS_SUPABASE_KEY, Authorization: `Bearer ${ETHERPHUNKS_SUPABASE_KEY}` } }
      );
      const epItems = await epRes.json();
      if (Array.isArray(epItems) && epItems.length > 0) {
        // Verify on-chain which ones are deposited by this wallet
        const deposited: any[] = [];
        for (const item of epItems) {
          try {
            const isDeposited = await this.ethsrocksSvc.isDepositedBy(address as `0x${string}`, item.hashId as `0x${string}`);
            if (isDeposited) deposited.push(item);
          } catch {}
        }
        if (deposited.length > 0) {
          const hashIds = deposited.map((i: any) => i.hashId).join(',');
          this.savePendingDeposit({
            type: 'ethscription',
            hashId: hashIds,
            slug: 'ethereum-phunks',
            label: `${deposited.length} EtherPhunks`,
            selected: false,
          });
          return;
        }
      }

      // No pending deposits found — check localStorage and clear if stale
      const stored = localStorage.getItem('ethsrocks_pending_deposit');
      if (stored) this.savePendingDeposit(null);
    } catch {}
  }

  private savePendingDeposit(item: SwapItem | null) {
    this.pendingDeposit.set(item);
    if (item) {
      localStorage.setItem('ethsrocks_pending_deposit', JSON.stringify(item));
    } else {
      localStorage.removeItem('ethsrocks_pending_deposit');
    }
  }

  // Step 1: Send ethscription to contract
  async onDepositEthscription() {
    const item = this.selectedEthscription();
    if (!item?.hashId) return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const hash = await this.ethsrocksSvc.depositEthscriptionForSwap(item.hashId as `0x${string}`);
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.savePendingDeposit(item);
        this.selectedEthscription.set(null);
        this.successMessage.set('Phunk deposited! Wait ~1 min then click "Get Rock"');
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Deposit failed');
    } finally {
      this.txPending.set(false);
    }
  }

  // Step 2: Complete the swap — get a rock
  async onCompleteSwap() {
    const item = this.pendingDeposit();
    if (!item?.hashId) return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const hash = await this.ethsrocksSvc.swapEthscription(item.hashId as `0x${string}`);
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.savePendingDeposit(null);
        this.swapComplete.set(true);
        await this.loadState();
      }
    } catch (err: any) {
      if (err?.message?.includes('AdditionalCooldownRequired') || err?.shortMessage?.includes('cooldown')) {
        this.errorMessage.set('Still waiting for block confirmations. Try again in ~1 minute.');
      } else {
        this.errorMessage.set(err?.shortMessage || err?.message || 'Swap failed');
      }
    } finally {
      this.txPending.set(false);
    }
  }

  // Cancel: get ethscription(s) back
  async onCancelDeposit() {
    const item = this.pendingDeposit();
    if (!item?.hashId) return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const walletClient = await (this.ethsrocksSvc as any).getWallet();
      const { encodeFunctionData } = await import('viem');
      const abi = (await import('@/abi/EthsRocks')).EthsRocksABI;

      // Handle batch (comma-separated) or single hashId
      const hashIds = item.hashId.includes(',')
        ? item.hashId.split(',')
        : [item.hashId];

      for (const hashId of hashIds) {
        const data = encodeFunctionData({
          abi,
          functionName: 'cancelSwapDeposit',
          args: [hashId as `0x${string}`],
        });
        const hash = await walletClient.sendTransaction({
          to: this.contractAddress as `0x${string}`,
          data,
          gas: 100_000n,
        });
        if (hash) {
          this.txHash.set(hash);
          await this.web3Svc.pollReceipt(hash);
          this.txHash.set('');
        }
      }

      this.savePendingDeposit(null);
      this.successMessage.set('Returned to your wallet');
      await this.loadUserItems();
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Cancel failed');
    } finally {
      this.txPending.set(false);
    }
  }

  async onSwapErc721(type: 'v2' | 'philip') {
    const selected = type === 'v2' ? this.selectedV2() : this.selectedPhilip();
    const required = type === 'v2' ? this.cryptoPhunksV2Required() : this.philipInternRequired();
    if (selected.length !== required) return;

    const nftAddress = type === 'v2' ? CRYPTO_PHUNKS_V2 : PHILIP_INTERN;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const walletClient = await (this.ethsrocksSvc as any).getWallet();
      const address = this.web3Svc.getCurrentAddress()!;

      // Check if approved for all
      const approved = await this.web3Svc.l1Client.readContract({
        address: nftAddress as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'isApprovedForAll',
        args: [address, this.contractAddress as `0x${string}`],
      });

      if (!approved) {
        // Approve all
        const { encodeFunctionData } = await import('viem');
        const approveData = encodeFunctionData({
          abi: ERC721_ABI,
          functionName: 'setApprovalForAll',
          args: [this.contractAddress as `0x${string}`, true],
        });
        const approveHash = await walletClient.sendTransaction({
          to: nftAddress as `0x${string}`,
          data: approveData,
          gas: 100_000n,
        });
        this.txHash.set(approveHash);
        await this.web3Svc.pollReceipt(approveHash);
        this.txHash.set('');
      }

      // Swap
      const tokenIds = selected.map(s => BigInt(s.tokenId!));
      let swapHash: string;
      if (type === 'v2') {
        swapHash = await this.ethsrocksSvc.swapCryptoPhunksV2(tokenIds);
      } else {
        swapHash = await this.ethsrocksSvc.swapPhilipIntern(tokenIds);
      }

      if (swapHash) {
        this.txHash.set(swapHash);
        await this.web3Svc.pollReceipt(swapHash);
        this.txHash.set('');
        if (type === 'v2') this.selectedV2.set([]);
        else this.selectedPhilip.set([]);
        this.swapComplete.set(true);
        await this.loadState();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Swap failed');
    } finally {
      this.txPending.set(false);
    }
  }

  getImageUrl(item: SwapItem): string {
    if (!item.sha) return '';
    if (item.slug === 'ethereum-phunks') return `${ETHERPHUNKS_STATIC_URL}/static/images/${item.sha}`;
    return `${staticUrl}/static/images/${item.sha}`;
  }

  toggleEtherphunk(item: SwapItem) {
    const selected = this.selectedEtherphunks();
    const max = this.ethscriptionBatchRequired();
    const idx = selected.findIndex(s => s.hashId === item.hashId);

    if (idx >= 0) {
      this.selectedEtherphunks.set(selected.filter((_, i) => i !== idx));
    } else if (selected.length < max) {
      this.selectedEtherphunks.set([...selected, item]);
    }
  }

  isEtherphunkSelected(item: SwapItem): boolean {
    return this.selectedEtherphunks().some(s => s.hashId === item.hashId);
  }

  // Merkle proof generation
  private buildMerkleTree(leaves: string[]): void {
    let layer = leaves.map(l => l.toLowerCase()).sort();
    this.merkleLeaves = layer;
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
      layer = next;
      this.merkleTree.push(layer);
    }
  }

  private getMerkleProof(leaf: string): string[] {
    leaf = leaf.toLowerCase();
    const proof: string[] = [];
    let index = this.merkleTree[0].indexOf(leaf);
    if (index === -1) return [];

    for (let i = 0; i < this.merkleTree.length - 1; i++) {
      const layer = this.merkleTree[i];
      const siblingIndex = index % 2 === 1 ? index - 1 : index + 1;
      if (siblingIndex < layer.length) proof.push(layer[siblingIndex]);
      index = Math.floor(index / 2);
    }
    return proof;
  }

  private async ensureMerkleTree(): Promise<void> {
    if (this.merkleTree.length > 0) return;
    // Fetch all EtherPhunks hashIds from etherphunks Supabase (paginate past 1000 limit)
    const allHashIds: string[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const res = await fetch(
        `${ETHERPHUNKS_SUPABASE_URL}/rest/v1/ethscriptions?select=hashId&slug=eq.ethereum-phunks&limit=${pageSize}&offset=${offset}&order=tokenId`,
        { headers: { apikey: ETHERPHUNKS_SUPABASE_KEY, Authorization: `Bearer ${ETHERPHUNKS_SUPABASE_KEY}` } }
      );
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) break;
      allHashIds.push(...items.map((i: any) => i.hashId));
      if (items.length < pageSize) break;
      offset += pageSize;
    }
    const hashIds = allHashIds;
    this.buildMerkleTree(hashIds);
  }

  async onSwapEtherphunks() {
    const selected = this.selectedEtherphunks();
    const required = this.ethscriptionBatchRequired();
    if (selected.length !== required) return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      // Step 1: Deposit all ethscriptions in one tx
      const hashIds = selected.map(s => s.hashId as `0x${string}`);
      const depositHash = await this.ethsrocksSvc.depositEthscriptionBatchForSwap(hashIds);
      if (depositHash) {
        this.txHash.set(depositHash);
        await this.web3Svc.pollReceipt(depositHash);
        this.txHash.set('');
      }

      // Save pending batch deposit
      this.savePendingDeposit({
        type: 'ethscription',
        label: `${required} EtherPhunks`,
        hashId: hashIds.join(','), // store all hashIds comma-separated
        selected: false,
      });
      this.selectedEtherphunks.set([]);
      this.successMessage.set(`${required} EtherPhunks sent! Wait ~1 min then click "Get Rock"`);
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Deposit failed');
    } finally {
      this.txPending.set(false);
    }
  }

  async onCompleteBatchSwap() {
    const pending = this.pendingDeposit();
    if (!pending?.hashId?.includes(',')) return;

    const hashIds = pending.hashId.split(',') as `0x${string}`[];

    this.errorMessage.set('');
    this.successMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      // Build Merkle proofs
      await this.ensureMerkleTree();
      const proofs = hashIds.map(h => this.getMerkleProof(h) as `0x${string}`[]);

      // Check proofs are valid
      for (let i = 0; i < proofs.length; i++) {
        if (proofs[i].length === 0) throw new Error(`Invalid proof for ${hashIds[i].slice(0, 10)}...`);
      }

      const walletClient = await (this.ethsrocksSvc as any).getWallet();
      const { encodeFunctionData } = await import('viem');
      const data = encodeFunctionData({
        abi: (await import('@/abi/EthsRocks')).EthsRocksABI,
        functionName: 'swapEthscriptionBatch',
        args: [hashIds, proofs],
      });
      const hash = await walletClient.sendTransaction({
        to: this.contractAddress as `0x${string}`,
        data,
        gas: 1_000_000n,
      });

      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.savePendingDeposit(null);
        this.swapComplete.set(true);
        await this.loadState();
      }
    } catch (err: any) {
      if (err?.message?.includes('AdditionalCooldownRequired') || err?.shortMessage?.includes('cooldown')) {
        this.errorMessage.set('Still waiting for block confirmations. Try again in ~1 minute.');
      } else {
        this.errorMessage.set(err?.shortMessage || err?.message || 'Swap failed');
      }
    } finally {
      this.txPending.set(false);
    }
  }

  async resetAfterSwap() {
    this.swapComplete.set(false);
    this.savePendingDeposit(null);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.selectedEthscription.set(null);
    this.selectedV2.set([]);
    this.selectedPhilip.set([]);
    this.selectedEtherphunks.set([]);
    await this.loadState();
    await this.loadUserItems();
  }

  setTab(tab: 'etherphunks' | 'missing' | 'dysto') {
    this.activeTab.set(tab);
    this.errorMessage.set('');
    this.successMessage.set('');
  }
}
