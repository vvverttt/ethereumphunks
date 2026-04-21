import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { supabase } from '@/services/supabase';
import { getWalletClient, getChainId, reconnect } from '@wagmi/core';
import { encodePacked, keccak256, toBytes, parseAbi, type PublicClient } from 'viem';

const PHUNKQUIDITY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A' as `0x${string}`;
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

const keccakStr = (s: string): `0x${string}` => keccak256(toBytes(s));

const PHUNKQUIDITY_ABI = parseAbi([
  'function owner() view returns (address)',
  'function swapEnabled() view returns (bool)',
  'function swapFee() view returns (uint256)',
  'function nextOfferId() view returns (uint256)',
  'function collections(bytes32) view returns (uint8 collType, address contractAddress, bytes32 merkleRoot, uint256 pointValue, bool enabled, bool exists)',
  'function inputDisabled(bytes32) view returns (bool)',
  'function erc721PoolSize(bytes32 slug) view returns (uint256)',
  'function ethscPoolSize(bytes32 slug) view returns (uint256)',
  'function getERC721PoolItems(bytes32 slug, uint256 offset, uint256 limit) view returns (uint256[])',
  'function getEthscPoolItems(bytes32 slug, uint256 offset, uint256 limit) view returns (bytes32[])',
  'function swap((bytes32 slug, uint256 tokenId, bytes32 hashId, bytes32[] proof)[] inputs, (bytes32 slug, uint256 tokenId, bytes32 hashId)[] outputs) payable',
  'function createOffer((bytes32 slug, bytes32 idData)[] offering, (bytes32 slug, bytes32 idData)[] wanting, address targetUser, bytes32[][] ethscProofs) payable returns (uint256)',
  'function fulfillOffer(uint256 offerId, bytes32[][] ethscProofs) payable',
  'function cancelOffer(uint256 offerId)',
  'function getOffer(uint256 offerId) view returns (address creator, address targetUser, (bytes32 slug, bytes32 idData)[] offering, (bytes32 slug, bytes32 idData)[] wanting, bool active)',
]);

interface CollectionConfig {
  name: string;
  slug: `0x${string}`;
  slugStr: string; // for Supabase queries
  isERC721: boolean;
  contractAddress?: string;
  pointValue: number;
  poolSize: number;
  inputDisabled?: boolean;
}

interface BasketItem {
  collection: CollectionConfig;
  tokenId?: number;
  hashId?: string;
  sha?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-phunkquidity-page',
  templateUrl: './phunkquidity-page.component.html',
  styleUrls: ['./phunkquidity-page.component.scss'],
})
export class PhunkquidityPageComponent implements OnInit {
  loading = signal(true);
  contractAddress = PHUNKQUIDITY;
  swapEnabled = signal(false);
  swapFee = signal(0n);
  txPending = signal(false);
  status = signal('');

  collections = signal<CollectionConfig[]>([
    { name: 'Philip Intern',    slug: keccakStr('philip-intern'),     slugStr: 'philip-intern',     isERC721: true,  contractAddress: '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce', pointValue: 30,  poolSize: 0 },
    { name: 'V1 Phunks',        slug: keccakStr('v1-phunks'),         slugStr: 'v1-phunks',         isERC721: true,  contractAddress: '0x235d49774139c218034c0571ba8f717773edd923', pointValue: 30,  poolSize: 0 },
    { name: 'CryptoPhunksV2',   slug: keccakStr('v2-phunks'),         slugStr: 'v2-phunks',         isERC721: true,  contractAddress: '0xf07468ead8cf26c752c676e43c814fee9c8cf402', pointValue: 100, poolSize: 0 },
    { name: 'V3 Phunks',        slug: keccakStr('v3-phunks'),         slugStr: 'v3-phunks',         isERC721: true,  contractAddress: '0xb7d405bee01c70a9577316c1b9c2505f146e8842', pointValue: 3,   poolSize: 0, inputDisabled: true },
    { name: 'Pepephunks',       slug: keccakStr('pepephunks'),        slugStr: 'pepephunks',        isERC721: true,  contractAddress: '0xc00ffeb7cf191c3432ede000478901f99fd53633', pointValue: 3,   poolSize: 0, inputDisabled: true },
    { name: 'Skelephunks',      slug: keccakStr('skelephunks'),       slugStr: 'skelephunks',       isERC721: true,  contractAddress: '0x7db8cd89308a295bb2d7f809b05db6389e9a6d88', pointValue: 3,   poolSize: 0, inputDisabled: true },
    { name: 'Etherphunks',      slug: keccakStr('etherphunks'),       slugStr: 'ethereumphunks',    isERC721: false, pointValue: 20,  poolSize: 0, inputDisabled: true },
    { name: 'Missing Phunks',   slug: keccakStr('og-missing-phunks'), slugStr: 'og-missing-phunks', isERC721: false, pointValue: 60,  poolSize: 0 },
    { name: 'Dystophunks',      slug: keccakStr('og-dysto-phunks'),   slugStr: 'og-dysto-phunks',   isERC721: false, pointValue: 300, poolSize: 0 },
    { name: 'CryptoPhunksV67',  slug: keccakStr('cryptophunksv67'),   slugStr: 'cryptophunksv67',   isERC721: false, pointValue: 300, poolSize: 0 },
    { name: 'EthsRocks',        slug: keccakStr('ethsrocks'),         slugStr: 'ethsrocks',         isERC721: false, pointValue: 150, poolSize: 0, inputDisabled: true },
  ]);

  // UI state
  activeTab = signal<'swap' | 'offers' | 'create'>('swap');
  selectedInputCollection = signal<CollectionConfig | null>(null);
  selectedOutputCollection = signal<CollectionConfig | null>(null);
  ownedItems = signal<BasketItem[]>([]);
  poolItemsForOutput = signal<BasketItem[]>([]);

  inputBasket = signal<BasketItem[]>([]);
  outputBasket = signal<BasketItem[]>([]);

  // Offer state
  offers = signal<any[]>([]);
  offerOffering = signal<BasketItem[]>([]);
  offerWanting = signal<BasketItem[]>([]);
  offerTargetUser = signal<string>('');
  offerSelectedOfferingCollection = signal<CollectionConfig | null>(null);
  offerSelectedWantingCollection = signal<CollectionConfig | null>(null);

  // Owner-only deposit panel
  isOwner = signal(false);
  ownerDepositSlug = signal<string>('cryptophunksv67');
  ownerDepositHashIds = signal<string>('');

  inputPoints = computed(() => this.inputBasket().reduce((s, i) => s + i.collection.pointValue, 0));
  outputPoints = computed(() => this.outputBasket().reduce((s, i) => s + i.collection.pointValue, 0));
  v67ToV67Blocked = computed(() => {
    const hasV67In = this.inputBasket().some(i => i.collection.slugStr === 'cryptophunksv67');
    const hasV67Out = this.outputBasket().some(i => i.collection.slugStr === 'cryptophunksv67');
    return hasV67In && hasV67Out;
  });
  canSwap = computed(() => this.inputBasket().length > 0 && this.outputBasket().length > 0 && this.inputPoints() >= this.outputPoints() && !this.v67ToV67Blocked());

  private get rpcClient(): PublicClient { return this.web3Svc.l1Client; }
  private merkleTrees: Record<string, string[][]> = {};

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
  ) {}

  async ngOnInit() {
    try {
      const [enabled, fee, ownerAddr] = await Promise.all([
        this.rpcClient.readContract({ address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI, functionName: 'swapEnabled' }),
        this.rpcClient.readContract({ address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI, functionName: 'swapFee' }),
        this.rpcClient.readContract({ address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI, functionName: 'owner' }),
      ]);
      this.swapEnabled.set(enabled as boolean);
      this.swapFee.set(fee as bigint);

      const wallet = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
      if (wallet && (ownerAddr as string).toLowerCase() === wallet.toLowerCase()) {
        this.isOwner.set(true);
      }

      const cols = this.collections();
      const updated = await Promise.all(cols.map(async c => {
        try {
          const [size, collInfo, inputDis] = await Promise.all([
            this.rpcClient.readContract({
              address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
              functionName: c.isERC721 ? 'erc721PoolSize' : 'ethscPoolSize',
              args: [c.slug],
            }),
            this.rpcClient.readContract({
              address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
              functionName: 'collections',
              args: [c.slug],
            }) as Promise<readonly [number, `0x${string}`, `0x${string}`, bigint, boolean, boolean]>,
            this.rpcClient.readContract({
              address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
              functionName: 'inputDisabled',
              args: [c.slug],
            }).catch(() => false) as Promise<boolean>,
          ]);
          return { ...c, poolSize: Number(size), pointValue: Number(collInfo[3]) || c.pointValue, inputDisabled: inputDis };
        } catch {
          return c;
        }
      }));
      this.collections.set(updated);
    } catch (e) {
      console.error('Failed to load:', e);
    }
    this.loading.set(false);
  }

  // ─── Selection ─────────────────────────────────────────────

  async selectInputCollection(c: CollectionConfig) {
    this.selectedInputCollection.set(c);
    await this.loadOwnedItems(c);
  }

  async selectOutputCollection(c: CollectionConfig) {
    this.selectedOutputCollection.set(c);
    await this.loadPoolItems(c);
  }

  async onInputSelectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const idx = target.value;
    if (idx === '') {
      this.selectedInputCollection.set(null);
      this.ownedItems.set([]);
    } else {
      await this.selectInputCollection(this.collections()[+idx]);
    }
  }

  async onOutputSelectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const idx = target.value;
    if (idx === '') {
      this.selectedOutputCollection.set(null);
      this.poolItemsForOutput.set([]);
    } else {
      await this.selectOutputCollection(this.collections()[+idx]);
    }
  }

  private async loadOwnedItems(c: CollectionConfig) {
    const address = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
    if (!address) {
      this.ownedItems.set([]);
      return;
    }

    if (c.isERC721 && c.contractAddress) {
      this.ownedItems.set([]);
      this.status.set('Loading ' + c.name + ' from your wallet...');
      try {
        const erc721Abi = parseAbi([
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
        ]);

        const balance = await this.rpcClient.readContract({
          address: c.contractAddress as `0x${string}`,
          abi: erc721Abi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as bigint;

        const count = Number(balance);
        if (count === 0) {
          this.ownedItems.set([]);
          this.status.set('');
          return;
        }

        // Fetch tokenIds via tokenOfOwnerByIndex (works if contract is enumerable)
        const items: BasketItem[] = [];
        for (let i = 0; i < Math.min(count, 100); i++) {
          try {
            const tokenId = await this.rpcClient.readContract({
              address: c.contractAddress as `0x${string}`,
              abi: erc721Abi,
              functionName: 'tokenOfOwnerByIndex',
              args: [address as `0x${string}`, BigInt(i)],
            }) as bigint;
            items.push({ collection: c, tokenId: Number(tokenId) });
          } catch {
            break;
          }
        }
        this.ownedItems.set(items);
        this.status.set('');
      } catch (e) {
        console.error('Failed to load ERC-721:', e);
        this.status.set('Failed to load (contract may not support enumeration)');
      }
      return;
    }

    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId,sha,tokenId')
      .eq('slug', c.slugStr)
      .eq('owner', address.toLowerCase())
      .order('tokenId')
      .limit(200);

    this.ownedItems.set((data || []).map((d: any) => ({
      collection: c,
      hashId: d.hashId,
      sha: d.sha,
      tokenId: d.tokenId,
    })));
  }

  private async loadPoolItems(c: CollectionConfig) {
    if (c.poolSize === 0) {
      this.poolItemsForOutput.set([]);
      return;
    }

    try {
      if (c.isERC721) {
        const tokenIds = await this.rpcClient.readContract({
          address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
          functionName: 'getERC721PoolItems',
          args: [c.slug, 0n, BigInt(Math.min(c.poolSize, 200))],
        }) as bigint[];
        this.poolItemsForOutput.set(tokenIds.map(id => ({ collection: c, tokenId: Number(id) })));
      } else {
        const hashIds = await this.rpcClient.readContract({
          address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
          functionName: 'getEthscPoolItems',
          args: [c.slug, 0n, BigInt(Math.min(c.poolSize, 200))],
        }) as `0x${string}`[];

        // Look up sha+tokenId from Supabase
        const { data } = await supabase
          .from('ethscriptions')
          .select('hashId,sha,tokenId')
          .in('hashId', hashIds.map(h => h.toLowerCase()));

        const map = new Map((data || []).map((d: any) => [d.hashId, d]));
        this.poolItemsForOutput.set(hashIds.map(h => {
          const d: any = map.get(h.toLowerCase());
          return { collection: c, hashId: h, sha: d?.sha, tokenId: d?.tokenId };
        }));
      }
    } catch (e) {
      console.error('Failed to load pool:', e);
    }
  }

  toggleInput(item: BasketItem) {
    const basket = this.inputBasket();
    const idx = basket.findIndex(b => (b.hashId && b.hashId === item.hashId) || (b.tokenId !== undefined && b.tokenId === item.tokenId && b.collection.slug === item.collection.slug));
    if (idx >= 0) {
      this.inputBasket.set(basket.filter((_, i) => i !== idx));
    } else {
      this.inputBasket.set([...basket, item]);
    }
  }

  toggleOutput(item: BasketItem) {
    const basket = this.outputBasket();
    const idx = basket.findIndex(b => (b.hashId && b.hashId === item.hashId) || (b.tokenId !== undefined && b.tokenId === item.tokenId && b.collection.slug === item.collection.slug));
    if (idx >= 0) {
      this.outputBasket.set(basket.filter((_, i) => i !== idx));
    } else {
      this.outputBasket.set([...basket, item]);
    }
  }

  isInBasket(item: BasketItem, basket: 'input' | 'output'): boolean {
    const b = basket === 'input' ? this.inputBasket() : this.outputBasket();
    return b.some(x => (x.hashId && x.hashId === item.hashId) || (x.tokenId !== undefined && x.tokenId === item.tokenId && x.collection.slug === item.collection.slug));
  }

  getImageUrl(item: BasketItem): string {
    if (item.sha) return environment.staticUrl + '/static/images/' + item.sha;
    return '';
  }

  // ─── Swap Execution ────────────────────────────────────────

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

  private async ensureMerkleTree(slugStr: string): Promise<string[][]> {
    if (this.merkleTrees[slugStr]) return this.merkleTrees[slugStr];

    const hashIds: string[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId')
        .eq('slug', slugStr)
        .order('tokenId')
        .range(offset, offset + 999);
      if (!data?.length) break;
      hashIds.push(...data.map((d: any) => d.hashId.toLowerCase()));
      if (data.length < 1000) break;
      offset += 1000;
    }

    let layer = [...hashIds].sort();
    const tree = [layer];
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
      tree.push(next);
      layer = next;
    }
    this.merkleTrees[slugStr] = tree;
    return tree;
  }

  private getMerkleProof(tree: string[][], hashId: string): string[] {
    const leaf = hashId.toLowerCase();
    let idx = tree[0].indexOf(leaf);
    if (idx === -1) return [];
    const proof: string[] = [];
    for (let level = 0; level < tree.length - 1; level++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < tree[level].length) proof.push(tree[level][siblingIdx]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  async onSwap() {
    if (!this.canSwap() || this.txPending()) return;
    this.txPending.set(true);
    this.status.set('Preparing swap...');

    try {
      // 1. Build inputs with proofs
      const inputs: any[] = [];
      for (const item of this.inputBasket()) {
        let proof: string[] = [];
        if (!item.collection.isERC721 && item.hashId) {
          this.status.set('Building Merkle proof for ' + item.collection.name + '...');
          const tree = await this.ensureMerkleTree(item.collection.slugStr);
          proof = this.getMerkleProof(tree, item.hashId);
        }
        inputs.push({
          slug: item.collection.slug,
          tokenId: BigInt(item.tokenId || 0),
          hashId: (item.hashId || ZERO_BYTES32) as `0x${string}`,
          proof: proof as `0x${string}`[],
        });
      }

      // 2. Build outputs
      const outputs = this.outputBasket().map(item => ({
        slug: item.collection.slug,
        tokenId: BigInt(item.tokenId || 0),
        hashId: (item.hashId || ZERO_BYTES32) as `0x${string}`,
      }));

      // 3a. For ERC-721 inputs: ensure approval
      const erc721Inputs = this.inputBasket().filter(i => i.collection.isERC721);
      if (erc721Inputs.length > 0) {
        const erc721ApprovalAbi = parseAbi([
          'function isApprovedForAll(address owner, address operator) view returns (bool)',
          'function setApprovalForAll(address operator, bool approved)',
        ]);
        const address = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
        const walletClient = await this.getWallet();
        const uniqueContracts = [...new Set(erc721Inputs.map(i => i.collection.contractAddress!))];
        for (const contractAddr of uniqueContracts) {
          const approved = await this.rpcClient.readContract({
            address: contractAddr as `0x${string}`,
            abi: erc721ApprovalAbi,
            functionName: 'isApprovedForAll',
            args: [address as `0x${string}`, PHUNKQUIDITY],
          });
          if (!approved) {
            this.status.set('Approving ' + contractAddr.slice(0, 10) + '...');
            const tx = await walletClient.writeContract({
              address: contractAddr as `0x${string}`,
              abi: erc721ApprovalAbi,
              functionName: 'setApprovalForAll',
              args: [PHUNKQUIDITY, true],
              chain: walletClient.chain,
            });
            await this.rpcClient.waitForTransactionReceipt({ hash: tx });
          }
        }
      }

      // 3b. For ethscription inputs: user must deposit them via calldata first
      const ethscInputs = this.inputBasket().filter(i => !i.collection.isERC721);
      if (ethscInputs.length > 0) {
        this.status.set('Depositing ' + ethscInputs.length + ' ethscription(s)...');
        const walletClient = await this.getWallet();
        for (const item of ethscInputs) {
          const data = ('0x' + item.collection.slug.slice(2) + (item.hashId as string).slice(2)) as `0x${string}`;
          const tx = await walletClient.sendTransaction({
            to: PHUNKQUIDITY,
            data,
            chain: walletClient.chain,
          });
          await this.rpcClient.waitForTransactionReceipt({ hash: tx });
        }
      }

      // 4. Execute swap
      this.status.set('Executing swap...');
      const walletClient = await this.getWallet();
      const hash = await walletClient.writeContract({
        address: PHUNKQUIDITY,
        abi: PHUNKQUIDITY_ABI,
        functionName: 'swap',
        args: [inputs, outputs],
        value: this.swapFee(),
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash });

      this.status.set('Swap complete!');
      this.inputBasket.set([]);
      this.outputBasket.set([]);
      await this.ngOnInit(); // refresh
    } catch (e: any) {
      console.error('Swap failed:', e);
      this.status.set('Swap failed: ' + (e?.message?.slice(0, 100) || 'unknown error'));
    } finally {
      this.txPending.set(false);
    }
  }

  removeFromInput(idx: number) {
    this.inputBasket.set(this.inputBasket().filter((_, i) => i !== idx));
  }
  removeFromOutput(idx: number) {
    this.outputBasket.set(this.outputBasket().filter((_, i) => i !== idx));
  }

  // ─── OFFERS ─────────────────────────────────────────────────

  setTab(tab: 'swap' | 'offers' | 'create') {
    this.activeTab.set(tab);
    if (tab === 'offers') this.loadOffers();
  }

  async loadOffers() {
    try {
      const next = await this.rpcClient.readContract({
        address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI, functionName: 'nextOfferId',
      }) as bigint;
      const total = Number(next);
      if (total === 0) { this.offers.set([]); return; }

      // Load last 50 offers
      const start = Math.max(0, total - 50);
      const list: any[] = [];
      for (let i = total - 1; i >= start; i--) {
        try {
          const o = await this.rpcClient.readContract({
            address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
            functionName: 'getOffer', args: [BigInt(i)],
          }) as any;
          if (o[4]) { // active
            list.push({ id: i, creator: o[0], targetUser: o[1], offering: o[2], wanting: o[3] });
          }
        } catch {}
      }
      this.offers.set(list);
    } catch (e) {
      console.error('Failed to load offers:', e);
    }
  }

  async onOfferOfferingSelectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const idx = target.value;
    if (idx === '') {
      this.offerSelectedOfferingCollection.set(null);
      this.ownedItems.set([]);
    } else {
      const c = this.collections()[+idx];
      this.offerSelectedOfferingCollection.set(c);
      await this.loadOwnedItems(c);
    }
  }

  async onOfferWantingSelectChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const idx = target.value;
    if (idx === '') {
      this.offerSelectedWantingCollection.set(null);
    } else {
      this.offerSelectedWantingCollection.set(this.collections()[+idx]);
    }
  }

  toggleOfferOffering(item: BasketItem) {
    const basket = this.offerOffering();
    const exists = basket.findIndex(b => (b.hashId && b.hashId === item.hashId) || (b.tokenId !== undefined && b.tokenId === item.tokenId && b.collection.slug === item.collection.slug));
    if (exists >= 0) {
      this.offerOffering.set(basket.filter((_, i) => i !== exists));
    } else {
      this.offerOffering.set([...basket, item]);
    }
  }

  isInOfferOffering(item: BasketItem): boolean {
    return this.offerOffering().some(x => (x.hashId && x.hashId === item.hashId) || (x.tokenId !== undefined && x.tokenId === item.tokenId && x.collection.slug === item.collection.slug));
  }

  addWantedItem() {
    const c = this.offerSelectedWantingCollection();
    if (!c) return;
    // Just add a placeholder — wanting items don't need to be picked from a pool
    // For ERC721 user types tokenId; for ethsc user types hashId
    const tokenIdInput = (document.getElementById('wantTokenId') as HTMLInputElement)?.value;
    const hashIdInput = (document.getElementById('wantHashId') as HTMLInputElement)?.value;
    const item: BasketItem = {
      collection: c,
      tokenId: tokenIdInput ? Number(tokenIdInput) : undefined,
      hashId: hashIdInput || undefined,
    };
    this.offerWanting.set([...this.offerWanting(), item]);
    if (tokenIdInput) (document.getElementById('wantTokenId') as HTMLInputElement).value = '';
    if (hashIdInput) (document.getElementById('wantHashId') as HTMLInputElement).value = '';
  }

  removeOfferOffering(idx: number) {
    this.offerOffering.set(this.offerOffering().filter((_, i) => i !== idx));
  }

  // Owner-only deposit (loads owned items from connected wallet for selected collection)
  ownerDepositItems = signal<BasketItem[]>([]);
  ownerDepositSelected = signal<BasketItem[]>([]);

  async loadOwnerDepositItems() {
    const slugStr = this.ownerDepositSlug();
    const c = this.collections().find(x => x.slugStr === slugStr);
    if (!c || c.isERC721) { this.ownerDepositItems.set([]); return; }

    const address = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
    if (!address) return;

    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId,sha,tokenId')
      .eq('slug', slugStr)
      .eq('owner', address.toLowerCase())
      .order('tokenId')
      .limit(500);

    this.ownerDepositItems.set((data || []).map((d: any) => ({
      collection: c, hashId: d.hashId, sha: d.sha, tokenId: d.tokenId,
    })));
    this.ownerDepositSelected.set([]);
  }

  toggleOwnerDeposit(item: BasketItem) {
    const sel = this.ownerDepositSelected();
    const idx = sel.findIndex(x => x.hashId === item.hashId);
    if (idx >= 0) this.ownerDepositSelected.set(sel.filter((_, i) => i !== idx));
    else this.ownerDepositSelected.set([...sel, item]);
  }

  isInOwnerDeposit(item: BasketItem): boolean {
    return this.ownerDepositSelected().some(x => x.hashId === item.hashId);
  }

  async ownerDepositToPool() {
    const items = this.ownerDepositSelected();
    if (items.length === 0 || this.txPending()) return;
    const c = items[0].collection;

    this.txPending.set(true);
    this.status.set(`Depositing ${items.length} ${c.name}...`);

    try {
      const walletClient = await this.getWallet();
      // Build calldata: [slug(32)][hashId(32)] per item, all in one tx
      let data = '0x';
      for (const item of items) {
        data += c.slug.slice(2) + (item.hashId as string).slice(2);
      }

      const tx = await walletClient.sendTransaction({
        to: PHUNKQUIDITY,
        data: data as `0x${string}`,
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash: tx });

      this.status.set(`Deposited ${items.length} item(s) to pool!`);
      this.ownerDepositSelected.set([]);
      await this.loadOwnerDepositItems();
      await this.ngOnInit();
    } catch (e: any) {
      console.error('Owner deposit failed:', e);
      this.status.set('Deposit failed: ' + (e?.shortMessage || e?.message?.slice(0, 100) || ''));
    } finally {
      this.txPending.set(false);
    }
  }
  removeOfferWanting(idx: number) {
    this.offerWanting.set(this.offerWanting().filter((_, i) => i !== idx));
  }

  async createOffer() {
    if (this.offerOffering().length === 0 || this.offerWanting().length === 0 || this.txPending()) return;
    this.txPending.set(true);
    this.status.set('Creating offer...');

    try {
      // Build proofs for ethscription items in offering
      const ethscProofs: string[][] = [];
      for (const item of this.offerOffering()) {
        if (!item.collection.isERC721 && item.hashId) {
          const tree = await this.ensureMerkleTree(item.collection.slugStr);
          ethscProofs.push(this.getMerkleProof(tree, item.hashId));
        }
      }

      // Deposit ethscriptions first
      const ethscItems = this.offerOffering().filter(i => !i.collection.isERC721);
      if (ethscItems.length > 0) {
        const walletClient = await this.getWallet();
        for (const item of ethscItems) {
          this.status.set('Depositing ' + item.collection.name + '...');
          const data = ('0x' + item.collection.slug.slice(2) + (item.hashId as string).slice(2)) as `0x${string}`;
          const tx = await walletClient.sendTransaction({
            to: PHUNKQUIDITY,
            data,
            chain: walletClient.chain,
          });
          await this.rpcClient.waitForTransactionReceipt({ hash: tx });
        }
      }

      const offering = this.offerOffering().map(i => ({
        slug: i.collection.slug,
        idData: (i.collection.isERC721
          ? ('0x' + BigInt(i.tokenId || 0).toString(16).padStart(64, '0'))
          : (i.hashId || ZERO_BYTES32)) as `0x${string}`,
      }));

      const wanting = this.offerWanting().map(i => ({
        slug: i.collection.slug,
        idData: (i.collection.isERC721
          ? ('0x' + BigInt(i.tokenId || 0).toString(16).padStart(64, '0'))
          : (i.hashId || ZERO_BYTES32)) as `0x${string}`,
      }));

      const target = this.offerTargetUser() || '0x0000000000000000000000000000000000000000';

      this.status.set('Creating offer on-chain...');
      const walletClient = await this.getWallet();
      const hash = await walletClient.writeContract({
        address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
        functionName: 'createOffer',
        args: [offering, wanting, target as `0x${string}`, ethscProofs as `0x${string}`[][]],
        value: this.swapFee(),
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash });

      this.status.set('Offer created!');
      this.offerOffering.set([]);
      this.offerWanting.set([]);
      this.offerTargetUser.set('');
      await this.loadOffers();
    } catch (e: any) {
      console.error('Create offer failed:', e);
      this.status.set('Failed: ' + (e?.message?.slice(0, 100) || ''));
    } finally {
      this.txPending.set(false);
    }
  }

  async fulfillOffer(offer: any) {
    if (this.txPending()) return;
    if (!confirm('Fulfill this offer? You will give the wanting items and receive the offering items.')) return;
    this.txPending.set(true);
    this.status.set('Building proofs...');

    try {
      const ethscProofs: string[][] = [];
      for (const w of offer.wanting) {
        const c = this.collections().find(x => x.slug.toLowerCase() === w.slug.toLowerCase());
        if (c && !c.isERC721) {
          const tree = await this.ensureMerkleTree(c.slugStr);
          ethscProofs.push(this.getMerkleProof(tree, w.idData));
        }
      }

      // Deposit ethscriptions first (the wanted ethscriptions that user must transfer)
      const ethscWanted = offer.wanting.filter((w: any) => {
        const c = this.collections().find(x => x.slug.toLowerCase() === w.slug.toLowerCase());
        return c && !c.isERC721;
      });
      if (ethscWanted.length > 0) {
        const walletClient = await this.getWallet();
        for (const w of ethscWanted) {
          this.status.set('Depositing ethscription...');
          const tx = await walletClient.sendTransaction({
            to: PHUNKQUIDITY,
            data: w.idData as `0x${string}`,
            chain: walletClient.chain,
          });
          await this.rpcClient.waitForTransactionReceipt({ hash: tx });
        }
      }

      this.status.set('Fulfilling offer...');
      const walletClient = await this.getWallet();
      const hash = await walletClient.writeContract({
        address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
        functionName: 'fulfillOffer',
        args: [BigInt(offer.id), ethscProofs as `0x${string}`[][]],
        value: this.swapFee(),
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash });

      this.status.set('Offer fulfilled!');
      await this.loadOffers();
    } catch (e: any) {
      console.error('Fulfill failed:', e);
      this.status.set('Failed: ' + (e?.message?.slice(0, 100) || ''));
    } finally {
      this.txPending.set(false);
    }
  }

  async cancelOffer(offerId: number) {
    if (this.txPending()) return;
    if (!confirm('Cancel this offer? You will recover your offered items.')) return;
    this.txPending.set(true);
    try {
      const walletClient = await this.getWallet();
      const hash = await walletClient.writeContract({
        address: PHUNKQUIDITY, abi: PHUNKQUIDITY_ABI,
        functionName: 'cancelOffer',
        args: [BigInt(offerId)],
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash });
      this.status.set('Offer cancelled');
      await this.loadOffers();
    } catch (e: any) {
      console.error('Cancel failed:', e);
      this.status.set('Failed: ' + (e?.message?.slice(0, 100) || ''));
    } finally {
      this.txPending.set(false);
    }
  }

  getCollectionByBytes32Slug(slug: string): CollectionConfig | undefined {
    return this.collections().find(c => c.slug.toLowerCase() === slug.toLowerCase());
  }

  formatOfferItem(item: any): string {
    const c = this.getCollectionByBytes32Slug(item.slug);
    const name = c?.name || 'Unknown';
    if (c?.isERC721) {
      const tokenId = BigInt(item.idData).toString();
      return `${name} #${tokenId}`;
    }
    return `${name} ${item.idData?.slice(0, 10)}...`;
  }
}
