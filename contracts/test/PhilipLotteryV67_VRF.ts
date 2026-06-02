import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { createHashId, depositMultipleEthscriptions } from './helpers';

describe('PhilipLotteryV67_VRF — VRF upgrade over live V67', function () {
  let lottery: any;
  let points: any;
  let vrf: any;

  let owner: HardhatEthersSigner;
  let player: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const playPrice = ethers.parseEther('0.067');
  const vrfCost = ethers.parseEther('0.002');
  const CALLBACK_GAS = 500_000;
  const CONFIRMATIONS = 3;
  const prizes = Array.from({ length: 5 }, (_, i) => createHashId(`vrf-prize-${i}`));

  beforeEach(async () => {
    [owner, player, treasury, other] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('contracts/V2MainnetUpgrade/Points.sol:Points');
    points = await PointsFactory.deploy();
    await points.waitForDeployment();

    // 1. Deploy the LIVE contract (V67) and deposit prizes — mirrors production
    const V67 = await ethers.getContractFactory('PhilipLotteryV67');
    const proxy = await upgrades.deployProxy(
      V67,
      [playPrice, await points.getAddress(), treasury.address],
      { initializer: 'initialize' },
    );
    await proxy.waitForDeployment();
    await points.grantManager(await proxy.getAddress());
    await depositMultipleEthscriptions(owner, await proxy.getAddress(), prizes);

    // 2. Upgrade V67 -> V67_VRF (the actual migration we'll run on mainnet)
    const VRF = await ethers.getContractFactory('PhilipLotteryV67_VRF');
    lottery = await upgrades.upgradeProxy(await proxy.getAddress(), VRF);

    // 3. Wire the (mock) VRF wrapper
    const Mock = await ethers.getContractFactory('MockVRFWrapper');
    vrf = await Mock.deploy(vrfCost);
    await vrf.waitForDeployment();
    await lottery.setVRFConfig(await vrf.getAddress(), CALLBACK_GAS, CONFIRMATIONS);
  });

  describe('State preserved across the upgrade', () => {
    it('keeps owner, playPrice, treasury, pool', async () => {
      expect(await lottery.owner()).to.equal(owner.address);
      expect(await lottery.playPrice()).to.equal(playPrice);
      expect(await lottery.treasuryAddress()).to.equal(treasury.address);
      expect(await lottery.poolSize()).to.equal(5);
      for (const p of prizes) expect(await lottery.inPool(p)).to.equal(true);
    });
  });

  describe('VRF config', () => {
    it('reports VRF cost and rejects non-owner config', async () => {
      expect(await lottery.getVRFCost()).to.equal(vrfCost);
      await expect(lottery.connect(player).setVRFConfig(await vrf.getAddress(), CALLBACK_GAS, CONFIRMATIONS))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
    });
  });

  describe('play()', () => {
    it('requests VRF, holds the play price, refunds overpayment', async () => {
      const over = ethers.parseEther('0.01');
      const bal0 = await ethers.provider.getBalance(await lottery.getAddress());
      await expect(lottery.connect(player).play({ value: playPrice + vrfCost + over }))
        .to.emit(lottery, 'SpinRequested');
      // contract holds exactly the play price (vrfCost forwarded to wrapper, overpay refunded)
      const bal1 = await ethers.provider.getBalance(await lottery.getAddress());
      expect(bal1 - bal0).to.equal(playPrice);
      expect(await lottery.totalCommittedETH()).to.equal(playPrice);
    });

    it('rejects insufficient payment', async () => {
      await expect(lottery.connect(player).play({ value: playPrice }))
        .to.be.revertedWith('Insufficient payment');
    });

    it('rejects when inactive', async () => {
      await lottery.setActive(false);
      await expect(lottery.connect(player).play({ value: playPrice + vrfCost }))
        .to.be.revertedWith('Lottery inactive');
    });

    it('has NO cancel / commit path (cherry-pick removed)', () => {
      expect(lottery.cancelPlay).to.equal(undefined);
      expect(lottery.commitPlay).to.equal(undefined);
      expect(lottery.revealPlay).to.equal(undefined);
    });
  });

  describe('full settle via VRF callback', () => {
    it('awards a prize, pays treasury, awards points, shrinks pool', async () => {
      const tBal0 = await ethers.provider.getBalance(treasury.address);

      await lottery.connect(player).play({ value: playPrice + vrfCost });
      const reqId = await vrf.lastRequestId();

      await expect(vrf.fulfill(reqId, 12345))
        .to.emit(lottery, 'PrizeAwarded')
        .and.to.emit(lottery, 'LotteryPlayed');

      // pool shrank, treasury paid, points awarded, committed cleared
      expect(await lottery.poolSize()).to.equal(4);
      const tBal1 = await ethers.provider.getBalance(treasury.address);
      expect(tBal1 - tBal0).to.equal(playPrice);
      expect(await points.points(player.address)).to.equal(67);
      expect(await lottery.totalCommittedETH()).to.equal(0);
      expect(await lottery.playerPlays(player.address)).to.equal(1);
    });

    it('only the VRF wrapper can fulfill', async () => {
      await lottery.connect(player).play({ value: playPrice + vrfCost });
      const reqId = await vrf.lastRequestId();
      await expect(lottery.connect(other).rawFulfillRandomWords(reqId, [1]))
        .to.be.revertedWith('Only VRF wrapper');
    });

    it('defensive refund if pool emptied before callback', async () => {
      // play first (locks a request against a non-empty pool)
      await lottery.connect(player).play({ value: playPrice + vrfCost });
      const reqId = await vrf.lastRequestId();
      // owner drains the pool before the callback lands
      await lottery.withdrawPrizeBatch(prizes);
      expect(await lottery.poolSize()).to.equal(0);

      const pBal0 = await ethers.provider.getBalance(player.address);
      await vrf.fulfill(reqId, 999); // callback with empty pool → refund player
      const pBal1 = await ethers.provider.getBalance(player.address);
      expect(pBal1 - pBal0).to.equal(playPrice);
      expect(await lottery.totalCommittedETH()).to.equal(0);
    });
  });

  describe('owner withdrawETH respects in-flight play funds', () => {
    it('cannot withdraw ETH committed to a pending spin', async () => {
      await lottery.connect(player).play({ value: playPrice + vrfCost });
      // contract holds playPrice, all of it committed → nothing withdrawable
      await expect(lottery.withdrawETH(playPrice, owner.address))
        .to.be.revertedWith('Exceeds available balance');
    });
  });

  describe('access control', () => {
    it('prize + ETH withdrawals are owner-only', async () => {
      await expect(lottery.connect(player).withdrawPrize(prizes[0]))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
      await expect(lottery.connect(player).withdrawETH(0, player.address))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
      await expect(lottery.connect(player).emergencyWithdrawEthscription(prizes[0]))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
    });
  });
});
