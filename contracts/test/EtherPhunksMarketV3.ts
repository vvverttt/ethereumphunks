import { ethers, upgrades } from 'hardhat';
import hre from 'hardhat';
import { expect } from 'chai';
import { ZeroAddress, keccak256 } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EtherPhunksMarketV3, Points } from '../typechain-types';
import { stringToBytes } from 'viem';
import { mineBlocks, createHashId } from './helpers';

const DEPOSIT_AND_LIST_SIGNATURE = keccak256(stringToBytes('DEPOSIT_AND_LIST_SIGNATURE'));

describe('EtherPhunksMarketV3', function () {
  let market: EtherPhunksMarketV3;
  let points: Points;

  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let royaltyReceiver: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const contractVersion = 3;
  const royaltyBps = 367; // 3.67%

  beforeEach(async () => {
    [owner, seller, buyer, royaltyReceiver, other] = await ethers.getSigners();

    // Deploy Points
    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    // Deploy MarketV3 proxy
    const MarketFactory = await ethers.getContractFactory('EtherPhunksMarketV3');
    const proxy = await upgrades.deployProxy(
      MarketFactory,
      [contractVersion, await points.getAddress(), royaltyBps, royaltyReceiver.address],
      { initializer: 'initialize' },
    );
    market = MarketFactory.attach(await proxy.getAddress()) as EtherPhunksMarketV3;
    await market.waitForDeployment();

    // Grant POINTS_MANAGER_ROLE to market
    await points.grantManager(await market.getAddress());
  });

  describe('Initialization', () => {
    it('Should set correct initial values', async () => {
      expect(await market.owner()).to.equal(owner.address);
      expect(await market.contractVersion()).to.equal(contractVersion);
      expect(await market.pointsAddress()).to.equal(await points.getAddress());
      expect(await market.royaltyBps()).to.equal(royaltyBps);
      expect(await market.royaltyReceiver()).to.equal(royaltyReceiver.address);
    });
  });

  describe('Deposit & List', () => {
    const phunkId = createHashId('Phunk1060');
    const price = ethers.parseEther('1');

    it('Should deposit and auto-list via DEPOSIT_AND_LIST_SIGNATURE', async () => {
      const data =
        phunkId +
        DEPOSIT_AND_LIST_SIGNATURE.slice(2) +
        price.toString(16).padStart(64, '0');

      await seller.sendTransaction({
        to: await market.getAddress(),
        data,
      });

      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.be.true;
      expect(offer.seller).to.equal(seller.address);
      expect(offer.minValue).to.equal(price);
    });

    it('Should deposit and auto-list privately', async () => {
      const data =
        phunkId +
        DEPOSIT_AND_LIST_SIGNATURE.slice(2) +
        price.toString(16).padStart(64, '0') +
        buyer.address.slice(2).padStart(64, '0');

      await seller.sendTransaction({
        to: await market.getAddress(),
        data,
      });

      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.be.true;
      expect(offer.onlySellTo).to.equal(buyer.address);
    });

    it('Should deposit without listing (plain fallback)', async () => {
      await seller.sendTransaction({
        to: await market.getAddress(),
        data: phunkId,
      });

      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.be.false;
      expect(await market.userEthscriptionPossiblyStored(seller.address, phunkId)).to.be.true;
    });
  });

  describe('Offers', () => {
    const phunkId = createHashId('offer-phunk');
    const price = ethers.parseEther('1');

    beforeEach(async () => {
      await seller.sendTransaction({
        to: await market.getAddress(),
        data: phunkId,
      });
    });

    it('Should create listing and emit PhunkOffered', async () => {
      await expect(market.connect(seller).offerPhunkForSale(phunkId, price))
        .to.emit(market, 'PhunkOffered')
        .withArgs(phunkId, price, ZeroAddress);
    });

    it('Should create private listing', async () => {
      await expect(
        market.connect(seller).offerPhunkForSaleToAddress(phunkId, price, buyer.address),
      )
        .to.emit(market, 'PhunkOffered')
        .withArgs(phunkId, price, buyer.address);

      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.onlySellTo).to.equal(buyer.address);
    });

    it('Should batch list multiple items', async () => {
      const phunkIds = [createHashId('batch-1'), createHashId('batch-2')];
      const prices = [ethers.parseEther('1'), ethers.parseEther('2')];

      for (const id of phunkIds) {
        await seller.sendTransaction({ to: await market.getAddress(), data: id });
      }

      await expect(market.connect(seller).batchOfferPhunkForSale(phunkIds, prices))
        .to.emit(market, 'PhunkOffered');
    });

    it('Should delist with phunkNoLongerForSale', async () => {
      await market.connect(seller).offerPhunkForSale(phunkId, price);
      await expect(market.connect(seller).phunkNoLongerForSale(phunkId))
        .to.emit(market, 'PhunkNoLongerForSale')
        .withArgs(phunkId);

      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.be.false;
    });

    it('Should revert if non-depositor lists', async () => {
      await expect(market.connect(buyer).offerPhunkForSale(phunkId, price))
        .to.be.revertedWithCustomError(market, 'EthscriptionNotDeposited');
    });
  });

  describe('Buying (with royalties)', () => {
    const phunkId = createHashId('buy-phunk');
    const price = ethers.parseEther('1');

    beforeEach(async () => {
      await seller.sendTransaction({
        to: await market.getAddress(),
        data: phunkId,
      });
      await market.connect(seller).offerPhunkForSale(phunkId, price);
      await mineBlocks(5);
    });

    it('Should buy and split ETH (seller + royalty)', async () => {
      await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });

      const expectedRoyalty = (price * BigInt(royaltyBps)) / 10000n;
      const expectedSeller = price - expectedRoyalty;

      expect(await market.pendingWithdrawals(seller.address)).to.equal(expectedSeller);
      expect(await market.pendingWithdrawals(royaltyReceiver.address)).to.equal(expectedRoyalty);
    });

    it('Should emit PhunkBought', async () => {
      await expect(
        market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price }),
      )
        .to.emit(market, 'PhunkBought')
        .withArgs(phunkId, price, seller.address, buyer.address);
    });

    it('Should award 100 points to buyer', async () => {
      await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });
      expect(await points.points(buyer.address)).to.equal(100);
    });

    it('Should revert with wrong ETH amount', async () => {
      await expect(
        market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price + 1n }),
      ).to.be.revertedWith('Incorrect Ether amount');
    });

    it('Should revert with insufficient ETH', async () => {
      await expect(
        market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: 0 }),
      ).to.be.revertedWith('Invalid sale conditions');
    });

    it('Should enforce private listing (onlySellTo)', async () => {
      const privatePhunk = createHashId('private-buy');
      await seller.sendTransaction({ to: await market.getAddress(), data: privatePhunk });
      await market.connect(seller).offerPhunkForSaleToAddress(privatePhunk, price, buyer.address);
      await mineBlocks(5);

      // Wrong buyer should fail
      await expect(
        market.connect(other).batchBuyPhunk([privatePhunk], [price], { value: price }),
      ).to.be.revertedWith('Invalid sale conditions');

      // Correct buyer should succeed
      await expect(
        market.connect(buyer).batchBuyPhunk([privatePhunk], [price], { value: price }),
      ).to.emit(market, 'PhunkBought');
    });

    it('Should revert buying unlisted phunk', async () => {
      const unlisted = createHashId('unlisted');
      await seller.sendTransaction({ to: await market.getAddress(), data: unlisted });
      await mineBlocks(5);

      await expect(
        market.connect(buyer).batchBuyPhunk([unlisted], [price], { value: price }),
      ).to.be.revertedWith('Invalid sale conditions');
    });

    it('Should handle batch buy with correct total', async () => {
      const phunkIds = [createHashId('batch-buy-1'), createHashId('batch-buy-2')];
      const prices = [ethers.parseEther('1'), ethers.parseEther('2')];

      for (const id of phunkIds) {
        await seller.sendTransaction({ to: await market.getAddress(), data: id });
      }
      await market.connect(seller).batchOfferPhunkForSale(phunkIds, prices);
      await mineBlocks(5);

      const total = prices[0] + prices[1];
      await expect(
        market.connect(buyer).batchBuyPhunk(phunkIds, prices, { value: total }),
      ).to.emit(market, 'PhunkBought');
    });
  });

  describe('Withdrawals', () => {
    const phunkId = createHashId('withdraw-phunk');
    const price = ethers.parseEther('1');

    beforeEach(async () => {
      await seller.sendTransaction({ to: await market.getAddress(), data: phunkId });
      await market.connect(seller).offerPhunkForSale(phunkId, price);
      await mineBlocks(5);
    });

    it('Should allow withdrawing pending funds', async () => {
      await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });

      const expectedSeller = price - (price * BigInt(royaltyBps)) / 10000n;
      const balBefore = await ethers.provider.getBalance(seller.address);
      await market.connect(seller).withdraw();
      const balAfter = await ethers.provider.getBalance(seller.address);

      expect(balAfter - balBefore).to.be.closeTo(expectedSeller, ethers.parseEther('0.01'));
    });

    it('Should revert with no pending withdrawals', async () => {
      await expect(market.connect(seller).withdraw())
        .to.be.revertedWith('No pending withdrawals');
    });

    it('Should allow withdrawPhunk (return deposited item)', async () => {
      await market.connect(seller).withdrawPhunk(phunkId);
      expect(await market.userEthscriptionPossiblyStored(seller.address, phunkId)).to.be.false;
    });

    it('Should delist when withdrawing listed phunk', async () => {
      await expect(market.connect(seller).withdrawPhunk(phunkId))
        .to.emit(market, 'PhunkNoLongerForSale')
        .withArgs(phunkId);
    });

    it('Should allow withdrawBatchPhunks', async () => {
      const ids = [createHashId('wb-1'), createHashId('wb-2')];
      for (const id of ids) {
        await seller.sendTransaction({ to: await market.getAddress(), data: id });
      }
      await mineBlocks(5);

      await market.connect(seller).withdrawBatchPhunks(ids);
      for (const id of ids) {
        expect(await market.userEthscriptionPossiblyStored(seller.address, id)).to.be.false;
      }
    });

    it('Should revert withdrawPhunk for non-depositor', async () => {
      await expect(market.connect(buyer).withdrawPhunk(phunkId))
        .to.be.revertedWithCustomError(market, 'EthscriptionNotDeposited');
    });
  });

  describe('Royalty admin', () => {
    it('Should allow owner to setRoyaltyBps', async () => {
      await expect(market.setRoyaltyBps(500))
        .to.emit(market, 'RoyaltyBpsChanged')
        .withArgs(royaltyBps, 500);
      expect(await market.royaltyBps()).to.equal(500);
    });

    it('Should revert setRoyaltyBps above 1000 (10%)', async () => {
      await expect(market.setRoyaltyBps(1001))
        .to.be.revertedWith('Max 10%');
    });

    it('Should allow owner to setRoyaltyReceiver', async () => {
      await expect(market.setRoyaltyReceiver(other.address))
        .to.emit(market, 'RoyaltyReceiverChanged')
        .withArgs(royaltyReceiver.address, other.address);
    });

    it('Should revert setRoyaltyReceiver with zero address', async () => {
      await expect(market.setRoyaltyReceiver(ethers.ZeroAddress))
        .to.be.revertedWith('Invalid receiver');
    });

    it('Should revert non-owner royalty changes', async () => {
      await expect(market.connect(seller).setRoyaltyBps(0))
        .to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');
      await expect(market.connect(seller).setRoyaltyReceiver(seller.address))
        .to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Pausable', () => {
    const phunkId = createHashId('pause-phunk');
    const price = ethers.parseEther('1');

    beforeEach(async () => {
      await seller.sendTransaction({ to: await market.getAddress(), data: phunkId });
      await market.connect(seller).offerPhunkForSale(phunkId, price);
      await mineBlocks(5);
      await market.pause();
    });

    it('Should revert buying when paused', async () => {
      await expect(
        market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price }),
      ).to.be.revertedWithCustomError(market, 'EnforcedPause');
    });

    it('Should revert listing when paused', async () => {
      const newPhunk = createHashId('new-pause-phunk');
      await market.unpause();
      await seller.sendTransaction({ to: await market.getAddress(), data: newPhunk });
      await market.pause();

      await expect(market.connect(seller).offerPhunkForSale(newPhunk, price))
        .to.be.revertedWithCustomError(market, 'EnforcedPause');
    });

    it('Should revert deposit when paused', async () => {
      const newPhunk = createHashId('deposit-pause');
      await expect(
        seller.sendTransaction({ to: await market.getAddress(), data: newPhunk }),
      ).to.be.revertedWith('Contract is paused');
    });

    it('Should allow withdraw when paused', async () => {
      // Unpause to buy, then re-pause to test withdraw
      await market.unpause();
      await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });
      await market.pause();

      await expect(market.connect(seller).withdraw()).to.not.be.reverted;
    });
  });

  describe('Admin functions', () => {
    it('Should allow owner to pause/unpause', async () => {
      await market.pause();
      expect(await market.paused()).to.be.true;
      await market.unpause();
      expect(await market.paused()).to.be.false;
    });

    it('Should allow owner to setPointsAddress', async () => {
      await expect(market.setPointsAddress(other.address))
        .to.emit(market, 'PointsAddressChanged');
    });

    it('Should revert renounceOwnership', async () => {
      await expect(market.renounceOwnership())
        .to.be.revertedWith('Cannot renounce ownership');
    });

    it('Should revert non-owner pause', async () => {
      await expect(market.connect(seller).pause())
        .to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');
    });

    it('Should revert direct ETH transfer (receive)', async () => {
      await expect(
        owner.sendTransaction({ to: await market.getAddress(), value: ethers.parseEther('1') }),
      ).to.be.revertedWith('No direct ETH transfers');
    });
  });
});
