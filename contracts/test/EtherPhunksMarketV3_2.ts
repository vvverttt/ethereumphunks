import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { ZeroAddress } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EtherPhunksMarketV3_2, Points } from '../typechain-types';
import { mineBlocks, createHashId } from './helpers';

describe('EtherPhunksMarketV3_2 — Bids', function () {
  let market: EtherPhunksMarketV3_2;
  let points: Points;

  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let bidder: HardhatEthersSigner;
  let otherBidder: HardhatEthersSigner;
  let royaltyReceiver: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const contractVersion = 32;
  const COOLDOWN_BLOCKS = 5;

  beforeEach(async () => {
    [owner, seller, bidder, otherBidder, royaltyReceiver, other] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('contracts/V2MainnetUpgrade/Points.sol:Points');
    points = (await PointsFactory.deploy()) as unknown as Points;
    await points.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory('EtherPhunksMarketV3_2');
    const proxy = await upgrades.deployProxy(
      MarketFactory,
      [contractVersion, await points.getAddress()],
      { initializer: 'initialize' },
    );
    market = MarketFactory.attach(await proxy.getAddress()) as EtherPhunksMarketV3_2;
    await market.waitForDeployment();

    await points.grantManager(await market.getAddress());
  });

  /** Helper: deposits an Ethscription from `signer` into the marketplace.
   * Uses the plain 32-byte fallback path (no auto-listing).
   * Then mines past the 5-block cooldown so it's usable. */
  const depositPhunk = async (signer: HardhatEthersSigner, phunkId: string) => {
    await signer.sendTransaction({
      to: await market.getAddress(),
      data: phunkId,
    });
    await mineBlocks(COOLDOWN_BLOCKS);
  };

  describe('enterBid', () => {
    const phunkId = createHashId('bid-phunk-1');
    const bidValue = ethers.parseEther('0.5');

    it('locks ETH and creates bid state', async () => {
      await expect(market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue }))
        .to.emit(market, 'BidEntered')
        .withArgs(phunkId, seller.address, bidder.address, bidValue);

      const bid = await market.bids(seller.address, phunkId);
      expect(bid.hasBid).to.equal(true);
      expect(bid.bidder).to.equal(bidder.address);
      expect(bid.value).to.equal(bidValue);
      expect(bid.acceptedBlock).to.equal(0);
    });

    it('rejects zero-value bid', async () => {
      await expect(
        market.connect(bidder).enterBid(phunkId, seller.address, { value: 0 }),
      ).to.be.revertedWith('Bid > 0');
    });

    it('rejects self-bid', async () => {
      await expect(
        market.connect(seller).enterBid(phunkId, seller.address, { value: bidValue }),
      ).to.be.revertedWith('No self-bid');
    });

    it('rejects bid against zero address owner', async () => {
      await expect(
        market.connect(bidder).enterBid(phunkId, ZeroAddress, { value: bidValue }),
      ).to.be.revertedWith('Invalid owner');
    });

    it('replaces a lower existing bid and refunds previous bidder', async () => {
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });

      const higher = ethers.parseEther('0.7');
      await expect(market.connect(otherBidder).enterBid(phunkId, seller.address, { value: higher }))
        .to.emit(market, 'BidWithdrawn')
        .withArgs(phunkId, seller.address, bidder.address, bidValue)
        .and.to.emit(market, 'BidEntered')
        .withArgs(phunkId, seller.address, otherBidder.address, higher);

      expect(await market.pendingWithdrawals(bidder.address)).to.equal(bidValue);

      const bid = await market.bids(seller.address, phunkId);
      expect(bid.bidder).to.equal(otherBidder.address);
      expect(bid.value).to.equal(higher);
    });

    it('rejects new bid not strictly higher than existing', async () => {
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await expect(
        market.connect(otherBidder).enterBid(phunkId, seller.address, { value: bidValue }),
      ).to.be.revertedWith('Must exceed existing bid');
    });

    it('rejects new bid while existing bid is accepted (locked)', async () => {
      await depositPhunk(seller, phunkId);
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await market.connect(seller).acceptBid(phunkId, bidder.address, bidValue);

      const higher = ethers.parseEther('1');
      await expect(
        market.connect(otherBidder).enterBid(phunkId, seller.address, { value: higher }),
      ).to.be.revertedWith('Bid accepted, locked');
    });
  });

  describe('withdrawBid', () => {
    const phunkId = createHashId('bid-phunk-2');
    const bidValue = ethers.parseEther('0.5');

    it('refunds bidder and clears bid', async () => {
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });

      await expect(market.connect(bidder).withdrawBid(phunkId, seller.address))
        .to.emit(market, 'BidWithdrawn')
        .withArgs(phunkId, seller.address, bidder.address, bidValue);

      const bid = await market.bids(seller.address, phunkId);
      expect(bid.hasBid).to.equal(false);
      expect(await market.pendingWithdrawals(bidder.address)).to.equal(bidValue);
    });

    it('rejects withdrawal by non-bidder', async () => {
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await expect(
        market.connect(other).withdrawBid(phunkId, seller.address),
      ).to.be.revertedWith('Not bidder');
    });

    it('rejects withdrawal after bid accepted', async () => {
      await depositPhunk(seller, phunkId);
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await market.connect(seller).acceptBid(phunkId, bidder.address, bidValue);

      await expect(
        market.connect(bidder).withdrawBid(phunkId, seller.address),
      ).to.be.revertedWith('Bid accepted, cannot withdraw');
    });

    it('rejects withdrawal when no bid exists', async () => {
      await expect(
        market.connect(bidder).withdrawBid(phunkId, seller.address),
      ).to.be.revertedWith('No bid');
    });
  });

  describe('acceptBid', () => {
    const phunkId = createHashId('bid-phunk-3');
    const bidValue = ethers.parseEther('0.5');

    beforeEach(async () => {
      await depositPhunk(seller, phunkId);
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
    });

    it('marks bid accepted at current block', async () => {
      await expect(market.connect(seller).acceptBid(phunkId, bidder.address, bidValue))
        .to.emit(market, 'BidAccepted');

      const bid = await market.bids(seller.address, phunkId);
      expect(bid.acceptedBlock).to.be.gt(0);
    });

    it('rejects if Ethscription not deposited', async () => {
      const notDeposited = createHashId('not-deposited');
      await market.connect(bidder).enterBid(notDeposited, seller.address, { value: bidValue });
      await expect(
        market.connect(seller).acceptBid(notDeposited, bidder.address, bidValue),
      ).to.be.revertedWithCustomError(market, 'EthscriptionNotDeposited');
    });

    it('rejects bidder mismatch', async () => {
      await expect(
        market.connect(seller).acceptBid(phunkId, other.address, bidValue),
      ).to.be.revertedWith('Bidder mismatch');
    });

    it('rejects if bid value below minValue (front-run protection)', async () => {
      const minValue = ethers.parseEther('1');
      await expect(
        market.connect(seller).acceptBid(phunkId, bidder.address, minValue),
      ).to.be.revertedWith('Below minValue');
    });

    it('cannot accept twice', async () => {
      await market.connect(seller).acceptBid(phunkId, bidder.address, bidValue);
      await expect(
        market.connect(seller).acceptBid(phunkId, bidder.address, bidValue),
      ).to.be.revertedWith('Already accepted');
    });

    it('invalidates active listing on accept', async () => {
      await market.connect(seller).offerPhunkForSale(phunkId, ethers.parseEther('2'));
      await market.connect(seller).acceptBid(phunkId, bidder.address, bidValue);
      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.equal(false);
    });
  });

  describe('confirmBid', () => {
    const phunkId = createHashId('bid-phunk-4');
    const bidValue = ethers.parseEther('0.5');

    beforeEach(async () => {
      await depositPhunk(seller, phunkId);
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await market.connect(seller).acceptBid(phunkId, bidder.address, bidValue);
    });

    it('rejects confirm during cooldown', async () => {
      await expect(
        market.connect(bidder).confirmBid(phunkId, seller.address),
      ).to.be.revertedWith('Cooldown active');
    });

    it('rejects confirm by non-bidder', async () => {
      await mineBlocks(COOLDOWN_BLOCKS);
      await expect(
        market.connect(other).confirmBid(phunkId, seller.address),
      ).to.be.revertedWith('Not bidder');
    });

    it('settles bid after cooldown — seller credited, bid cleared, points awarded', async () => {
      await mineBlocks(COOLDOWN_BLOCKS);

      await expect(market.connect(bidder).confirmBid(phunkId, seller.address))
        .to.emit(market, 'BidConfirmed')
        .withArgs(phunkId, seller.address, bidder.address, bidValue);

      expect(await market.pendingWithdrawals(seller.address)).to.equal(bidValue);
      expect(await points.points(bidder.address)).to.equal(67);

      const bid = await market.bids(seller.address, phunkId);
      expect(bid.hasBid).to.equal(false);
    });

    it('applies royalty when royaltyBps and receivers are set', async () => {
      await market.setRoyaltyBps(670);
      await market.setRoyaltyReceivers([royaltyReceiver.address], [10000]);

      await mineBlocks(COOLDOWN_BLOCKS);

      const balBefore = await ethers.provider.getBalance(royaltyReceiver.address);
      await market.connect(bidder).confirmBid(phunkId, seller.address);
      const balAfter = await ethers.provider.getBalance(royaltyReceiver.address);

      const expectedRoyalty = (bidValue * 670n) / 10000n;
      expect(balAfter - balBefore).to.equal(expectedRoyalty);
      expect(await market.pendingWithdrawals(seller.address)).to.equal(bidValue - expectedRoyalty);
    });

    it('defensive refund if owner withdrew Ethscription before confirm', async () => {
      await market.connect(seller).withdrawPhunk(phunkId);
      await mineBlocks(COOLDOWN_BLOCKS);

      await expect(market.connect(bidder).confirmBid(phunkId, seller.address))
        .to.emit(market, 'BidRefunded')
        .withArgs(phunkId, seller.address, bidder.address, bidValue);

      expect(await market.pendingWithdrawals(bidder.address)).to.equal(bidValue);
      expect(await market.pendingWithdrawals(seller.address)).to.equal(0);
    });

    it('rejects confirm when not accepted', async () => {
      const phunkId2 = createHashId('bid-phunk-5');
      await depositPhunk(seller, phunkId2);
      await market.connect(bidder).enterBid(phunkId2, seller.address, { value: bidValue });

      await expect(
        market.connect(bidder).confirmBid(phunkId2, seller.address),
      ).to.be.revertedWith('Not accepted yet');
    });
  });
});
