import { ethers, upgrades } from 'hardhat';
import hre from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EtherPhunksAuctionHouseV2, Points } from '../typechain-types';
import { mineBlocks, createHashId, depositMultipleEthscriptions } from './helpers';

describe('EtherPhunksAuctionHouseV2', function () {
  let auction: EtherPhunksAuctionHouseV2;
  let points: Points;

  let owner: HardhatEthersSigner;
  let bidder1: HardhatEthersSigner;
  let bidder2: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const duration = 3600; // 1 hour
  const timeBuffer = 300; // 5 minutes
  const minBidIncrementPercentage = 5; // 5%
  const reservePrice = ethers.parseEther('0.01');

  const poolHashes = Array.from({ length: 5 }, (_, i) => createHashId(`auction-item-${i}`));

  async function getAddr() {
    return auction.getAddress();
  }

  async function increaseTime(seconds: number) {
    await hre.network.provider.send('evm_increaseTime', [seconds]);
    await hre.network.provider.send('evm_mine');
  }

  beforeEach(async () => {
    [owner, bidder1, bidder2, treasury, other] = await ethers.getSigners();

    // Deploy Points
    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    // Deploy AuctionHouseV2 proxy
    const AuctionFactory = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
    const proxy = await upgrades.deployProxy(
      AuctionFactory,
      [duration, timeBuffer, minBidIncrementPercentage, reservePrice, await points.getAddress(), treasury.address],
      { initializer: 'initialize' },
    );
    auction = AuctionFactory.attach(await proxy.getAddress()) as EtherPhunksAuctionHouseV2;
    await auction.waitForDeployment();

    // Grant POINTS_MANAGER_ROLE to auction
    await points.grantManager(await auction.getAddress());

    // Owner deposits 5 items
    await depositMultipleEthscriptions(owner, await getAddr(), poolHashes);
  });

  describe('Initialization', () => {
    it('Should set duration', async () => {
      expect(await auction.duration()).to.equal(duration);
    });

    it('Should set timeBuffer', async () => {
      expect(await auction.timeBuffer()).to.equal(timeBuffer);
    });

    it('Should set minBidIncrementPercentage', async () => {
      expect(await auction.minBidIncrementPercentage()).to.equal(minBidIncrementPercentage);
    });

    it('Should set reservePrice', async () => {
      expect(await auction.reservePrice()).to.equal(reservePrice);
    });

    it('Should set treasury', async () => {
      expect(await auction.treasuryAddress()).to.equal(treasury.address);
    });

    it('Should have 5 items in pool', async () => {
      expect(await auction.poolSize()).to.equal(5);
    });
  });

  describe('settleAndCreate', () => {
    it('Should create first auction from pool', async () => {
      await expect(auction.settleAndCreate())
        .to.emit(auction, 'AuctionCreated');

      expect(await auction.poolSize()).to.equal(4);
      expect(await auction.auctionId()).to.equal(1);
    });

    it('Should set auction fields correctly', async () => {
      await auction.settleAndCreate();
      const a = await auction.auction();
      expect(a.startTime).to.be.gt(0);
      expect(a.endTime).to.equal(a.startTime + BigInt(duration));
      expect(a.settled).to.be.false;
      expect(a.bidder).to.equal(ethers.ZeroAddress);
      expect(a.amount).to.equal(0);
    });
  });

  describe('createBid', () => {
    beforeEach(async () => {
      await auction.settleAndCreate();
    });

    it('Should place bid above reserve', async () => {
      const a = await auction.auction();
      await expect(auction.connect(bidder1).createBid({ value: reservePrice }))
        .to.emit(auction, 'AuctionBid')
        .withArgs(a.hashId, a.auctionId, bidder1.address, reservePrice);
    });

    it('Should update auction with new bidder', async () => {
      await auction.connect(bidder1).createBid({ value: reservePrice });
      const a = await auction.auction();
      expect(a.bidder).to.equal(bidder1.address);
      expect(a.amount).to.equal(reservePrice);
    });

    it('Should outbid previous bidder and refund', async () => {
      await auction.connect(bidder1).createBid({ value: reservePrice });

      const balBefore = await ethers.provider.getBalance(bidder1.address);
      const newBid = reservePrice + (reservePrice * BigInt(minBidIncrementPercentage) / 100n);
      await auction.connect(bidder2).createBid({ value: newBid });
      const balAfter = await ethers.provider.getBalance(bidder1.address);

      // bidder1 should be refunded
      expect(balAfter - balBefore).to.equal(reservePrice);

      const a = await auction.auction();
      expect(a.bidder).to.equal(bidder2.address);
    });

    it('Should revert below reserve price', async () => {
      await expect(
        auction.connect(bidder1).createBid({ value: reservePrice / 2n }),
      ).to.be.revertedWith('Below reserve price');
    });

    it('Should revert if bid too low (below min increment)', async () => {
      await auction.connect(bidder1).createBid({ value: reservePrice });
      await expect(
        auction.connect(bidder2).createBid({ value: reservePrice }),
      ).to.be.revertedWith('Bid too low');
    });

    it('Should revert after auction ended', async () => {
      await increaseTime(duration + 1);
      await expect(
        auction.connect(bidder1).createBid({ value: reservePrice }),
      ).to.be.revertedWith('Auction expired');
    });
  });

  describe('Anti-snipe extension', () => {
    beforeEach(async () => {
      await auction.settleAndCreate();
    });

    it('Should extend endTime when bid within timeBuffer', async () => {
      const a = await auction.auction();
      const originalEnd = a.endTime;

      // Advance to just before timeBuffer of end
      await increaseTime(duration - timeBuffer + 1);

      await expect(auction.connect(bidder1).createBid({ value: reservePrice }))
        .to.emit(auction, 'AuctionExtended');

      const updated = await auction.auction();
      expect(updated.endTime).to.be.gt(originalEnd);
    });
  });

  describe('settleAuction', () => {
    beforeEach(async () => {
      await auction.settleAndCreate();
    });

    it('Should transfer item to winner and send ETH to treasury', async () => {
      await auction.connect(bidder1).createBid({ value: reservePrice });

      await increaseTime(duration + 1);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await expect(auction.settleAuction())
        .to.emit(auction, 'AuctionSettled');

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(reservePrice);
    });

    it('Should award 67 points to winner', async () => {
      await auction.connect(bidder1).createBid({ value: reservePrice });
      await increaseTime(duration + 1);
      await auction.settleAuction();

      expect(await points.points(bidder1.address)).to.equal(67);
    });

    it('Should return item to pool if no bids', async () => {
      await increaseTime(duration + 1);
      const poolBefore = await auction.poolSize();
      await auction.settleAuction();
      const poolAfter = await auction.poolSize();
      // Pool should be same or +1 (item returned)
      expect(poolAfter).to.equal(poolBefore + 1n);
    });

    it('Should revert if auction not ended', async () => {
      await expect(auction.settleAuction())
        .to.be.revertedWith('Auction not ended');
    });

    it('Should revert if already settled', async () => {
      await increaseTime(duration + 1);
      await auction.settleAuction();
      await expect(auction.settleAuction())
        .to.be.revertedWith('Already settled');
    });

    it('Should work even when paused (standalone settle)', async () => {
      await auction.connect(bidder1).createBid({ value: reservePrice });
      await increaseTime(duration + 1);
      await auction.pause();

      // settleAuction should still work when paused
      await expect(auction.settleAuction()).to.not.be.reverted;
    });
  });

  describe('Per-item reserve prices', () => {
    it('Should apply per-item reserve if set', async () => {
      await auction.settleAndCreate();
      const a = await auction.auction();
      const itemReserve = ethers.parseEther('0.1');
      await auction.setItemReservePrices([a.hashId], [itemReserve]);

      // Bid below item reserve should fail
      await expect(
        auction.connect(bidder1).createBid({ value: reservePrice }),
      ).to.be.revertedWith('Below reserve price');

      // Bid at item reserve should succeed
      await expect(
        auction.connect(bidder1).createBid({ value: itemReserve }),
      ).to.emit(auction, 'AuctionBid');
    });
  });

  describe('Owner functions', () => {
    it('Should setDuration', async () => {
      await auction.setDuration(7200);
      expect(await auction.duration()).to.equal(7200);
    });

    it('Should revert setDuration below 60', async () => {
      await expect(auction.setDuration(30))
        .to.be.revertedWith('Min 60 seconds');
    });

    it('Should setTimeBuffer', async () => {
      await auction.setTimeBuffer(600);
      expect(await auction.timeBuffer()).to.equal(600);
    });

    it('Should setReservePrice', async () => {
      const newPrice = ethers.parseEther('0.05');
      await auction.setReservePrice(newPrice);
      expect(await auction.reservePrice()).to.equal(newPrice);
    });

    it('Should setMinBidIncrementPercentage', async () => {
      await auction.setMinBidIncrementPercentage(10);
      expect(await auction.minBidIncrementPercentage()).to.equal(10);
    });

    it('Should revert setMinBidIncrementPercentage below 1', async () => {
      await expect(auction.setMinBidIncrementPercentage(0))
        .to.be.revertedWith('Min 1%');
    });

    it('Should setTreasuryAddress', async () => {
      await auction.setTreasuryAddress(other.address);
      expect(await auction.treasuryAddress()).to.equal(other.address);
    });

    it('Should revert setTreasuryAddress with zero', async () => {
      await expect(auction.setTreasuryAddress(ethers.ZeroAddress))
        .to.be.revertedWith('Invalid treasury');
    });

    it('Should withdrawFromPool', async () => {
      await expect(auction.withdrawFromPool(poolHashes[0]))
        .to.emit(auction, 'PoolWithdrawn');
      expect(await auction.poolSize()).to.equal(4);
    });

    it('Should withdrawFromPoolBatch', async () => {
      await auction.withdrawFromPoolBatch([poolHashes[0], poolHashes[1]]);
      expect(await auction.poolSize()).to.equal(3);
    });

    it('Should emergencyWithdrawEthscription during active auction', async () => {
      await auction.settleAndCreate();
      const a = await auction.auction();

      // Place a bid
      await auction.connect(bidder1).createBid({ value: reservePrice });
      const bidderBal = await ethers.provider.getBalance(bidder1.address);

      // Emergency withdraw the active auction item
      await auction.emergencyWithdrawEthscription(a.hashId);

      const updatedAuction = await auction.auction();
      expect(updatedAuction.settled).to.be.true;

      // Bidder should be refunded
      const bidderBalAfter = await ethers.provider.getBalance(bidder1.address);
      expect(bidderBalAfter - bidderBal).to.equal(reservePrice);
    });

    it('Should renounceOwnership revert', async () => {
      await expect(auction.renounceOwnership())
        .to.be.revertedWith('Cannot renounce ownership');
    });

    it('Should revert non-owner admin calls', async () => {
      await expect(auction.connect(bidder1).setDuration(100))
        .to.be.revertedWithCustomError(auction, 'OwnableUnauthorizedAccount');
      await expect(auction.connect(bidder1).setReservePrice(0))
        .to.be.revertedWithCustomError(auction, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Pausable', () => {
    it('Should allow owner to pause/unpause', async () => {
      await auction.pause();
      expect(await auction.paused()).to.be.true;
      await auction.unpause();
      expect(await auction.paused()).to.be.false;
    });

    it('Should revert settleAndCreate when paused', async () => {
      await auction.pause();
      await expect(auction.settleAndCreate())
        .to.be.revertedWithCustomError(auction, 'EnforcedPause');
    });
  });

  describe('Withdraw pendingReturns', () => {
    it('Should allow withdrawing pending returns', async () => {
      // Use MockRejectETH as treasury to force pendingReturns
      const RejectFactory = await ethers.getContractFactory('MockRejectETH');
      const rejecter = await RejectFactory.deploy();
      await rejecter.waitForDeployment();
      await auction.setTreasuryAddress(await rejecter.getAddress());

      await auction.settleAndCreate();
      await auction.connect(bidder1).createBid({ value: reservePrice });
      await increaseTime(duration + 1);
      await auction.settleAuction();

      // Treasury (rejecter) should have pending returns
      expect(await auction.pendingReturns(await rejecter.getAddress())).to.equal(reservePrice);
    });

    it('Should revert withdraw with nothing pending', async () => {
      await expect(auction.connect(bidder1).withdraw())
        .to.be.revertedWith('Nothing to withdraw');
    });
  });

  describe('View functions', () => {
    it('Should return pool items', async () => {
      const items = await auction.getPoolItems(0, 5);
      expect(items.length).to.equal(5);
    });

    it('Should return balance', async () => {
      expect(await auction.getBalance()).to.equal(0);
    });

    it('Should handle offset beyond pool', async () => {
      const items = await auction.getPoolItems(100, 5);
      expect(items.length).to.equal(0);
    });
  });
});
