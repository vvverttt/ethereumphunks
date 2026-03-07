import { Injectable } from '@angular/core';
import { formatEther, encodePacked } from 'viem';
import { getWalletClient, getChainId, getPublicClient } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { EtherPhunksMarketV3ABI } from '@/abi/EtherPhunksMarketV3';
import { EtherPhunksAuctionHouseV2ABI } from '@/abi/EtherPhunksAuctionHouseV2';
import { PointsABI } from '@/abi/Points';
import { PhilipLotteryV67ABI } from '@/abi/PhilipLotteryV67';
import { EtherPhunksEvolveABI } from '@/abi/EtherPhunksEvolve';
import { EthsRocksABI } from '@/abi/EthsRocks';

const marketAddress = environment.marketAddress as `0x${string}`;
const auctionAddress = (environment as any).auctionAddress as `0x${string}`;
const pointsAddress = environment.pointsAddress as `0x${string}`;
const lotteryAddress = (environment as any).lotteryAddress as `0x${string}`;
const lottery2Address = ((environment as any).lottery2Address || '') as `0x${string}`;
const evolveAddress = (environment as any).evolveAddress as `0x${string}`;
const ethsrocksAddress = ((environment as any).ethsrocksAddress || '') as `0x${string}`;

// ProxyAdmin addresses (from EIP-1967 admin slot)
const marketProxyAdmin = '0x1e0fe955ee24d5766e76ce69810496dc30a11c26' as `0x${string}`;
const auctionProxyAdmin = '0xd043f41f07e7bc140e51971f7dd3c33ab35508ad' as `0x${string}`;
const evolveProxyAdmin = '0x33d0b59ec952749bcbe0847b334b075ef47cd7dc' as `0x${string}`;
const ethsrocksProxyAdmin = '0xc57cd985436d630cd61e5e0ca1e3af28cad68b3d' as `0x${string}`;
const lotteryProxyAdmin = '0x426335fa9f974Ffb0c5Dc11313dc4cb4dd615E7d' as `0x${string}`;
const lottery2ProxyAdmin = '0x29c9Cf618A057A2AF7885f03E0F211Bf07c4D885' as `0x${string}`;

const ProxyAdminABI = [
  { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private _lotteryAddress: `0x${string}` = lotteryAddress;

  get activeLotteryAddress(): `0x${string}` { return this._lotteryAddress; }
  get hasSecondLottery(): boolean { return !!lottery2Address; }
  get standardLotteryAddress(): `0x${string}` { return lotteryAddress; }
  get premiumLotteryAddress(): `0x${string}` { return lottery2Address; }

  setLotteryAddress(address: `0x${string}`) {
    this._lotteryAddress = address;
  }

  constructor(private web3Svc: Web3Service) {}

  // =========================================================
  // Helpers
  // =========================================================

  private async getClients() {
    await this.web3Svc.switchNetwork();
    const chainId = getChainId(this.web3Svc.config);
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    if (!walletClient) throw new Error('No wallet connected');
    return { walletClient, chainId };
  }

  private async writeContract(address: `0x${string}`, abi: any, functionName: string, args?: any[]) {
    const { walletClient } = await this.getClients();
    return await walletClient.writeContract({
      address,
      abi,
      functionName,
      args,
      chain: walletClient.chain,
      account: walletClient.account,
    } as any);
  }

  // =========================================================
  // Market Reads
  // =========================================================

  async getMarketOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: marketAddress, abi: EtherPhunksMarketV3ABI, functionName: 'owner',
    });
  }

  async getMarketPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: marketAddress, abi: EtherPhunksMarketV3ABI, functionName: 'paused',
    });
  }

  async getMarketRoyaltyShares(): Promise<{ receiver: string; bps: bigint }[]> {
    return await this.web3Svc.l1Client.readContract({
      address: marketAddress, abi: EtherPhunksMarketV3ABI, functionName: 'getRoyaltyShares',
    }) as any;
  }

  async getMarketTotalRoyaltyBps(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: marketAddress, abi: EtherPhunksMarketV3ABI, functionName: 'getTotalRoyaltyBps',
    });
  }

  async getMarketPointsAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: marketAddress, abi: EtherPhunksMarketV3ABI, functionName: 'pointsAddress',
    });
  }

  // =========================================================
  // Market Writes
  // =========================================================

  marketPause() { return this.writeContract(marketAddress, EtherPhunksMarketV3ABI, 'pause'); }
  marketUnpause() { return this.writeContract(marketAddress, EtherPhunksMarketV3ABI, 'unpause'); }

  marketSetPointsAddress(addr: string) {
    return this.writeContract(marketAddress, EtherPhunksMarketV3ABI, 'setPointsAddress', [addr]);
  }
  marketSetRoyaltyShares(receivers: string[], bps: bigint[]) {
    return this.writeContract(marketAddress, EtherPhunksMarketV3ABI, 'setRoyaltyShares', [receivers, bps]);
  }
  marketTransferOwnership(addr: string) {
    return this.writeContract(marketAddress, EtherPhunksMarketV3ABI, 'transferOwnership', [addr]);
  }

  // =========================================================
  // Auction Reads
  // =========================================================

  async getAuctionOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'owner',
    });
  }

  async getAuctionPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'paused',
    });
  }

  async getAuctionDuration(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'duration',
    });
  }

  async getAuctionTimeBuffer(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'timeBuffer',
    });
  }

  async getAuctionMinBidIncrement(): Promise<number> {
    const r = await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'minBidIncrementPercentage',
    });
    return Number(r);
  }

  async getAuctionReservePrice(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'reservePrice',
    });
  }

  async getAuctionPointsAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'pointsAddress',
    });
  }

  async getAuctionTreasuryAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'treasuryAddress',
    });
  }

  async getAuctionPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'poolSize',
    });
  }

  async getAuctionBalance(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'getBalance',
    });
  }

  // =========================================================
  // Auction Writes
  // =========================================================

  auctionPause() { return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'pause'); }
  auctionUnpause() { return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'unpause'); }

  auctionSetDuration(duration: bigint) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setDuration', [duration]);
  }
  auctionSetAuctionEndTime(endTime: bigint) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setAuctionEndTime', [endTime]);
  }
  auctionSetTimeBuffer(buffer: bigint) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setTimeBuffer', [buffer]);
  }
  auctionSetMinBidIncrementPercentage(pct: number) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setMinBidIncrementPercentage', [pct]);
  }
  auctionSetReservePrice(price: bigint) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setReservePrice', [price]);
  }
  auctionSetItemReservePrices(hashIds: string[], prices: bigint[]) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setItemReservePrices', [hashIds, prices]);
  }
  auctionSetPointsAddress(addr: string) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setPointsAddress', [addr]);
  }
  auctionSetTreasuryAddress(addr: string) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'setTreasuryAddress', [addr]);
  }
  auctionWithdrawETH(amount: bigint, to: string) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'withdrawETH', [amount, to]);
  }
  auctionWithdrawFromPool(hashId: string) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'withdrawFromPool', [hashId]);
  }
  auctionWithdrawFromPoolBatch(hashIds: string[]) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'withdrawFromPoolBatch', [hashIds]);
  }
  auctionEmergencyWithdrawEthscription(hashId: string) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'emergencyWithdrawEthscription', [hashId]);
  }
  auctionTransferOwnership(addr: string) {
    return this.writeContract(auctionAddress, EtherPhunksAuctionHouseV2ABI, 'transferOwnership', [addr]);
  }

  async auctionDepositEthscriptions(hashIds: string[]) {
    const { walletClient } = await this.getClients();
    // Auction fallback expects packed hashIds (each 32 bytes) as raw calldata
    const data = encodePacked(
      hashIds.map(() => 'bytes32' as const),
      hashIds.map(id => id as `0x${string}`),
    );
    return await walletClient.sendTransaction({
      to: auctionAddress,
      data,
      chain: walletClient.chain,
      account: walletClient.account,
    } as any);
  }

  // =========================================================
  // Points Reads
  // =========================================================

  async getPointsAdmin(address: string): Promise<boolean> {
    const adminRole = '0x0000000000000000000000000000000000000000000000000000000000000000';
    return await this.web3Svc.l1Client.readContract({
      address: pointsAddress, abi: PointsABI, functionName: 'hasRole',
      args: [adminRole as `0x${string}`, address as `0x${string}`],
    });
  }

  async getPointsMultiplier(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: pointsAddress, abi: PointsABI, functionName: 'multiplier',
    });
  }

  async getPointsPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: pointsAddress, abi: PointsABI, functionName: 'paused',
    });
  }

  // =========================================================
  // Points Writes
  // =========================================================

  pointsChangeMultiplier(multiplier: bigint) {
    return this.writeContract(pointsAddress, PointsABI, 'changeMultiplier', [multiplier]);
  }
  pointsGrantManager(addr: string) {
    return this.writeContract(pointsAddress, PointsABI, 'grantManager', [addr]);
  }
  pointsRevokeManager(addr: string) {
    return this.writeContract(pointsAddress, PointsABI, 'revokeManager', [addr]);
  }
  pointsRemovePoints(user: string, amount: bigint) {
    return this.writeContract(pointsAddress, PointsABI, 'removePoints', [user, amount]);
  }
  pointsDrainPoints(user: string) {
    return this.writeContract(pointsAddress, PointsABI, 'drainPoints', [user]);
  }
  pointsAddPoints(user: string, amount: bigint) {
    return this.writeContract(pointsAddress, PointsABI, 'addPoints', [user, amount]);
  }
  pointsPause() { return this.writeContract(pointsAddress, PointsABI, 'pause'); }
  pointsUnpause() { return this.writeContract(pointsAddress, PointsABI, 'unpause'); }

  // =========================================================
  // Lottery Reads
  // =========================================================

  async getLotteryOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'owner',
    });
  }

  async getLotteryPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'paused',
    });
  }

  async getLotteryActive(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'active',
    });
  }

  async getLotteryPlayPrice(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'playPrice',
    });
  }

  async getLotteryBalance(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'getBalance',
    });
  }

  async getLotteryPointsAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'pointsAddress',
    });
  }

  async getLotteryTreasuryAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'treasuryAddress',
    });
  }

  async getLotteryPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'poolSize',
    });
  }

  async getLotteryPoolItems(offset: bigint, limit: bigint): Promise<string[]> {
    return await this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'getPoolItems', args: [offset, limit],
    }) as string[];
  }

  // =========================================================
  // Lottery Writes
  // =========================================================

  lotteryPause() { return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'pause'); }
  lotteryUnpause() { return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'unpause'); }

  lotterySetPrice(price: bigint) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'setPrice', [price]);
  }
  lotterySetActive(active: boolean) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'setActive', [active]);
  }
  lotterySetPointsAddress(addr: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'setPointsAddress', [addr]);
  }
  lotterySetTreasuryAddress(addr: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'setTreasuryAddress', [addr]);
  }
  lotteryWithdrawETH(amount: bigint, to: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'withdrawETH', [amount, to]);
  }
  lotteryWithdrawPrize(hashId: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'withdrawPrize', [hashId]);
  }
  lotteryWithdrawPrizeBatch(hashIds: string[]) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'withdrawPrizeBatch', [hashIds]);
  }
  lotteryEmergencyWithdrawEthscription(hashId: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'emergencyWithdrawEthscription', [hashId]);
  }
  lotteryRedirectPendingReturns(from: string, to: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'redirectPendingReturns', [from, to]);
  }
  lotteryGetPendingReturns(addr: string) {
    return this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'pendingReturns', args: [addr as `0x${string}`],
    }) as Promise<bigint>;
  }
  lotteryGetTotalCommittedETH() {
    return this.web3Svc.l1Client.readContract({
      address: this._lotteryAddress, abi: PhilipLotteryV67ABI, functionName: 'totalCommittedETH',
    }) as Promise<bigint>;
  }
  lotteryTransferOwnership(addr: string) {
    return this.writeContract(this._lotteryAddress, PhilipLotteryV67ABI, 'transferOwnership', [addr]);
  }

  // =========================================================
  // Evolve Reads
  // =========================================================

  async getEvolveOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: evolveAddress, abi: EtherPhunksEvolveABI, functionName: 'owner',
    });
  }

  async getEvolvePaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: evolveAddress, abi: EtherPhunksEvolveABI, functionName: 'paused',
    });
  }

  async getEvolveFee(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: evolveAddress, abi: EtherPhunksEvolveABI, functionName: 'evolveFee',
    });
  }

  async getEvolvePairCount(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: evolveAddress, abi: EtherPhunksEvolveABI, functionName: 'pairCount',
    });
  }

  // =========================================================
  // Evolve Writes
  // =========================================================

  evolvePause() { return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'pause'); }
  evolveUnpause() { return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'unpause'); }

  evolveSetFee(fee: bigint) {
    return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'setFee', [fee]);
  }
  evolveRegisterPairs(ogHashIds: string[], quantumHashIds: string[]) {
    return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'registerPairs', [ogHashIds, quantumHashIds]);
  }
  evolveWithdrawETH() {
    return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'withdrawETH');
  }
  evolveWithdrawEthscription(hashId: string, to: string) {
    return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'withdrawEthscription', [hashId, to]);
  }
  evolveTransferOwnership(addr: string) {
    return this.writeContract(evolveAddress, EtherPhunksEvolveABI, 'transferOwnership', [addr]);
  }

  // =========================================================
  // Proxy Admin Reads
  // =========================================================

  async getMarketProxyAdminOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: marketProxyAdmin, abi: ProxyAdminABI, functionName: 'owner',
    });
  }

  async getAuctionProxyAdminOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionProxyAdmin, abi: ProxyAdminABI, functionName: 'owner',
    });
  }

  async getEvolveProxyAdminOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: evolveProxyAdmin, abi: ProxyAdminABI, functionName: 'owner',
    });
  }

  // =========================================================
  // Proxy Admin Writes
  // =========================================================

  marketProxyAdminTransfer(addr: string) {
    return this.writeContract(marketProxyAdmin, ProxyAdminABI, 'transferOwnership', [addr]);
  }

  auctionProxyAdminTransfer(addr: string) {
    return this.writeContract(auctionProxyAdmin, ProxyAdminABI, 'transferOwnership', [addr]);
  }

  evolveProxyAdminTransfer(addr: string) {
    return this.writeContract(evolveProxyAdmin, ProxyAdminABI, 'transferOwnership', [addr]);
  }

  async getEthsRocksProxyAdminOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksProxyAdmin, abi: ProxyAdminABI, functionName: 'owner',
    });
  }

  ethsrocksProxyAdminTransfer(addr: string) {
    return this.writeContract(ethsrocksProxyAdmin, ProxyAdminABI, 'transferOwnership', [addr]);
  }

  async getLotteryProxyAdminOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: lotteryProxyAdmin, abi: ProxyAdminABI, functionName: 'owner',
    });
  }

  lotteryProxyAdminTransfer(addr: string) {
    return this.writeContract(lotteryProxyAdmin, ProxyAdminABI, 'transferOwnership', [addr]);
  }

  async getLottery2ProxyAdminOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: lottery2ProxyAdmin, abi: ProxyAdminABI, functionName: 'owner',
    });
  }

  lottery2ProxyAdminTransfer(addr: string) {
    return this.writeContract(lottery2ProxyAdmin, ProxyAdminABI, 'transferOwnership', [addr]);
  }

  // =========================================================
  // EthsRocks Reads
  // =========================================================

  async getEthsRocksOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'owner',
    });
  }

  async getEthsRocksPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'paused',
    });
  }

  async getEthsRocksPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'poolSize',
    });
  }

  async getEthsRocksBalance(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'getBalance',
    });
  }

  async getEthsRocksPrice(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'currentPrice',
    });
  }

  async getEthsRocksTotalRevealed(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'totalRevealed',
    });
  }

  async getEthsRocksPendingReveals(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'pendingReveals',
    });
  }

  async getEthsRocksSignerAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'signerAddress',
    });
  }

  async getEthsRocksTreasuryAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'treasuryAddress',
    });
  }

  async getEthsRocksPointsAddress(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'pointsAddress',
    });
  }

  // =========================================================
  // EthsRocks Writes
  // =========================================================

  ethsrocksPause() { return this.writeContract(ethsrocksAddress, EthsRocksABI, 'pause'); }
  ethsrocksUnpause() { return this.writeContract(ethsrocksAddress, EthsRocksABI, 'unpause'); }

  ethsrocksSetSignerAddress(addr: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'setSignerAddress', [addr]);
  }
  ethsrocksSetTreasuryAddress(addr: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'setTreasuryAddress', [addr]);
  }
  ethsrocksSetPointsAddress(addr: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'setPointsAddress', [addr]);
  }
  ethsrocksWithdrawETH(amount: bigint, to: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'withdrawETH', [amount, to]);
  }
  ethsrocksWithdrawFromPool(hashId: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'withdrawFromPool', [hashId]);
  }
  ethsrocksWithdrawFromPoolBatch(hashIds: string[]) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'withdrawFromPoolBatch', [hashIds]);
  }
  ethsrocksEmergencyWithdrawEthscription(hashId: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'emergencyWithdrawEthscription', [hashId]);
  }
  ethsrocksResetUsedERC721(nftContract: string, tokenId: bigint) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'resetUsedERC721', [nftContract, tokenId]);
  }
  ethsrocksResetUsedEthscription(hashId: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'resetUsedEthscription', [hashId]);
  }
  ethsrocksResetTotalRevealed(total: bigint) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'resetTotalRevealed', [total]);
  }
  ethsrocksTransferOwnership(addr: string) {
    return this.writeContract(ethsrocksAddress, EthsRocksABI, 'transferOwnership', [addr]);
  }

  async ethsrocksDepositEthscriptions(hashIds: string[]) {
    const { walletClient } = await this.getClients();
    const data = encodePacked(
      hashIds.map(() => 'bytes32' as const),
      hashIds.map(id => id as `0x${string}`),
    );
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      chain: walletClient.chain,
      account: walletClient.account,
    } as any);
  }

  // =========================================================
  // Points Admin Transfer (AccessControl: grant + renounce)
  // =========================================================

  pointsGrantAdminRole(addr: string) {
    return this.writeContract(pointsAddress, PointsABI, 'grantRole', [DEFAULT_ADMIN_ROLE, addr]);
  }

  pointsRevokeAdminRole(addr: string) {
    return this.writeContract(pointsAddress, PointsABI, 'revokeRole', [DEFAULT_ADMIN_ROLE, addr]);
  }
}
