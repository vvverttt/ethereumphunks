import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { EthsRocksService } from '@/services/ethsrocks.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

const CRYPTO_PHUNKS_V2 = '0xf07468ead8cf26c752c676e43c814fee9c8cf402';
const PHILIP_INTERN = '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce';

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

  // Swap tab
  activeTab = signal<'ethscription' | 'cryptophunksv2' | 'philipintern'>('ethscription');

  // User's eligible items
  ogItems = signal<SwapItem[]>([]);
  v2Items = signal<SwapItem[]>([]);
  philipItems = signal<SwapItem[]>([]);
  loadingItems = signal<boolean>(false);

  // Selected items
  selectedEthscription = signal<SwapItem | null>(null);
  selectedV2 = signal<SwapItem[]>([]);
  selectedPhilip = signal<SwapItem[]>([]);

  // Pending ethscription deposit (step 1 done, waiting for step 2)
  pendingDeposit = signal<SwapItem | null>(null);

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

    this.loadPendingDeposit();
    await this.loadState();
    this.loading.set(false);

    this.address$.subscribe(async (addr) => {
      if (addr) {
        // Verify pending deposit is still valid on-chain
        const pending = this.pendingDeposit();
        if (pending?.hashId) {
          try {
            const stillDeposited = await this.ethsrocksSvc.isDepositedBy(addr as `0x${string}`, pending.hashId as `0x${string}`);
            if (!stillDeposited) this.savePendingDeposit(null);
          } catch {
            // CORS or RPC error — keep the pending deposit, user can try to complete or cancel
          }
        }
        this.loadState();
        this.loadUserItems();
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

  private savePendingDeposit(item: SwapItem | null) {
    this.pendingDeposit.set(item);
    if (item) {
      localStorage.setItem('ethsrocks_pending_deposit', JSON.stringify(item));
    } else {
      localStorage.removeItem('ethsrocks_pending_deposit');
    }
  }

  private loadPendingDeposit() {
    const stored = localStorage.getItem('ethsrocks_pending_deposit');
    if (stored) {
      try { this.pendingDeposit.set(JSON.parse(stored)); } catch {}
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
        this.successMessage.set('Rock received!');
        await this.loadState();
        await this.loadUserItems();
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

  // Cancel: get ethscription back
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
      const data = encodeFunctionData({
        abi: (await import('@/abi/EthsRocks')).EthsRocksABI,
        functionName: 'cancelSwapDeposit',
        args: [item.hashId as `0x${string}`],
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
        this.savePendingDeposit(null);
        this.successMessage.set('Phunk returned to your wallet');
        await this.loadUserItems();
      }
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
        this.successMessage.set('Rock received!');
        if (type === 'v2') this.selectedV2.set([]);
        else this.selectedPhilip.set([]);
        await this.loadState();
        await this.loadUserItems();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Swap failed');
    } finally {
      this.txPending.set(false);
    }
  }

  getImageUrl(item: SwapItem): string {
    if (item.sha) return `${staticUrl}/static/images/${item.sha}`;
    return '';
  }

  setTab(tab: 'ethscription' | 'cryptophunksv2' | 'philipintern') {
    this.activeTab.set(tab);
    this.errorMessage.set('');
    this.successMessage.set('');
  }
}
