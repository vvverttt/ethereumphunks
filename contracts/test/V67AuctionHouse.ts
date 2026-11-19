import { expect } from 'chai';
import { ethers, upgrades, network } from 'hardhat';
import { loadFixture, time, mine } from '@nomicfoundation/hardhat-network-helpers';

// V67AuctionHouse: one random-draw auction pool for every non-turtle v67 piece.
// Follows "v67 Auction Contract: Build Spec" (Nov 14, 2026), section "Edge cases and tests".

const ETH = ethers.parseEther;
const DAY = 86_400;
const DURATION = 144_288;
const V2 = 'contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTV2.sol:CryptoPhunksV67V2';

const raise = (x: bigint) => (x * 10_500n + 9_999n) / 10_000n;

async function deployHouse(nftAddr: string, payout: string, guardian: string, owner: string) {
  const W = await ethers.getContractFactory('MockWETH9');
  const weth: any = await W.deploy();
  const F = await ethers.getContractFactory('V67AuctionHouse');
  const house: any = await upgrades.deployProxy(F, [nftAddr, await weth.getAddress(), payout, guardian, owner], {
    kind: 'uups',
    initializer: 'initialize',
  });
  await house.waitForDeployment();
  return { house, weth, F };
}

/** Mock NFT, ids 0..n-1 minted to the guardian (`dep` = guardian, deposit is guardian-only), approved, deposited. */
async function base(n = 10) {
  const [owner, guardian, payout, , a, b, c, stranger] = await ethers.getSigners();
  const dep = guardian;
  const M = await ethers.getContractFactory('MockNFT721');
  const nft: any = await M.deploy();
  await nft.mintBatch(dep.address, 0, n);
  const { house, weth, F } = await deployHouse(await nft.getAddress(), payout.address, guardian.address, owner.address);
  await nft.connect(dep).setApprovalForAll(await house.getAddress(), true);
  if (n > 0) await house.connect(dep).deposit([...Array(n).keys()]);
  return { house, weth, nft, F, owner, guardian, payout, dep, a, b, c, stranger };
}
const pool10 = () => base(10);
const pool1 = () => base(1);
const pool0 = () => base(0);

async function started10() {
  const f = await pool10();
  await f.house.connect(f.owner).start();
  return f;
}

const cur = async (house: any) => {
  const [collection, tokenId, amount, bidder, startTime, endTime, settled, fromQueue] = await house.currentAuction();
  return { collection, tokenId, amount, bidder, startTime, endTime, settled, fromQueue };
};
const toEnd = async (house: any) => time.increaseTo((await cur(house)).endTime);

describe('V67AuctionHouse', () => {
  // ------------------------------------------------------------------ setup / deposit
  describe('deploy, deposit, start', () => {
    it('initializes the fixed settings', async () => {
      const { house, nft, payout, guardian, owner } = await loadFixture(pool10);
      expect(await house.nft()).to.equal(await nft.getAddress());
      expect(await house.payout()).to.equal(payout.address);
      expect(await house.guardian()).to.equal(guardian.address);
      expect(await house.owner()).to.equal(owner.address);
      expect(await house.duration()).to.equal(DURATION);
      expect(await house.MIN_OPENING_BID()).to.equal(ETH('0.001'));
      expect(await house.MIN_RAISE_BPS()).to.equal(500);
      expect(await house.TIME_BUFFER()).to.equal(600);
      expect(await house.poolSize()).to.equal(10);
      expect(await house.started()).to.equal(false);
    });

    it('cannot be initialized twice, and the implementation is locked', async () => {
      const { house, F, nft, payout } = await loadFixture(pool10);
      await expect(house.initialize(await nft.getAddress(), payout.address, payout.address, payout.address, payout.address))
        .to.be.revertedWithCustomError(house, 'InvalidInitialization');
      const impl: any = F.attach(await upgrades.erc1967.getImplementationAddress(await house.getAddress()));
      await expect(impl.initialize(await nft.getAddress(), payout.address, payout.address, payout.address, payout.address))
        .to.be.revertedWithCustomError(impl, 'InvalidInitialization');
    });

    it('deposit is guardian-only (owner and holders cannot change the pool mix)', async () => {
      const { house, nft, owner, a } = await loadFixture(pool10);
      await nft.mintBatch(a.address, 900, 1);
      await nft.connect(a).setApprovalForAll(await house.getAddress(), true);
      await expect(house.connect(a).deposit([900])).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(owner).deposit([900])).to.be.revertedWithCustomError(house, 'NotGuardian');
    });

    it('duplicate deposit reverts', async () => {
      const { house, dep } = await loadFixture(pool10);
      await expect(house.connect(dep).deposit([3])).to.be.revertedWithCustomError(house, 'AlreadyInPool').withArgs(3);
    });

    it('deposit of another collection is impossible (pulls from the fixed NFT only)', async () => {
      const { house, guardian } = await loadFixture(pool10);
      const M = await ethers.getContractFactory('MockNFT721');
      const foreign: any = await M.deploy();
      await foreign.mintBatch(guardian.address, 500, 1);
      await foreign.connect(guardian).setApprovalForAll(await house.getAddress(), true);
      // id 500 does not exist on the v67 (mock) contract, so the pull reverts
      await expect(house.connect(guardian).deposit([500])).to.be.reverted;
      expect(await foreign.ownerOf(500)).to.equal(guardian.address);
    });

    it('a safe transfer sent directly bounces', async () => {
      const { house, nft, dep } = await loadFixture(pool0);
      await nft.mintBatch(dep.address, 50, 1);
      await expect(
        nft.connect(dep)['safeTransferFrom(address,address,uint256)'](dep.address, await house.getAddress(), 50),
      ).to.be.reverted;
    });

    it('start is owner-only and once', async () => {
      const { house, owner, stranger } = await loadFixture(pool10);
      await expect(house.connect(stranger).start()).to.be.revertedWithCustomError(house, 'OwnableUnauthorizedAccount');
      await house.connect(owner).start();
      await expect(house.connect(owner).start()).to.be.revertedWithCustomError(house, 'AlreadyStarted');
      const c = await cur(house);
      expect(c.settled).to.equal(false);
      expect(await house.auctionCount()).to.equal(1);
      expect(await house.poolSize()).to.equal(9); // live piece is out of the waiting pool
      expect(await house.inPool(c.tokenId)).to.equal(true);
      expect(c.endTime - c.startTime).to.equal(BigInt(DURATION));
    });
  });

  // ---------------------------------------------------------------------- bidding
  describe('bidding', () => {
    it('first bid below 0.001 ETH reverts; at 0.001 ETH works', async () => {
      const { house, a } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      await expect(house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('0.000999') })).to.be.revertedWithCustomError(house, 'BidTooLow');
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('0.001') });
      expect((await cur(house)).bidder).to.equal(a.address);
    });

    it('bid below 5% over the top reverts; exactly 5% (rounded up) works; old bidder refunded', async () => {
      const { house, a, b } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      const first = ETH('1.234567');
      await house.connect(a).createBid(await house.nft(), tokenId, { value: first });
      const need = raise(first);
      await expect(house.connect(b).createBid(await house.nft(), tokenId, { value: need - 1n })).to.be.revertedWithCustomError(house, 'BidTooLow').withArgs(need);
      expect(await house.minNextBid()).to.equal(need);
      await expect(house.connect(b).createBid(await house.nft(), tokenId, { value: need })).to.changeEtherBalances([a, house], [first, need - first]);
    });

    it('bid on the wrong id or after the end reverts', async () => {
      const { house, a } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      const wrong = tokenId === 0n ? 1n : 0n;
      await expect(house.connect(a).createBid(await house.nft(), wrong, { value: ETH('1') })).to.be.revertedWithCustomError(house, 'NotUpForAuction');
      await toEnd(house);
      await expect(house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('1') })).to.be.revertedWithCustomError(house, 'AuctionExpired');
    });

    it('bid in the last second extends to 10 minutes after the bid, repeatedly', async () => {
      const { house, a, b } = await loadFixture(started10);
      const { tokenId, endTime } = await cur(house);
      await time.setNextBlockTimestamp(endTime - 1n);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('0.01') });
      let c = await cur(house);
      expect(c.endTime).to.equal(endTime - 1n + 600n);
      await time.setNextBlockTimestamp(c.endTime - 5n);
      await house.connect(b).createBid(await house.nft(), tokenId, { value: ETH('0.02') });
      const c2 = await cur(house);
      expect(c2.endTime).to.equal(c.endTime - 5n + 600n);
      // a bid with more than 10 minutes left does not extend
      const { house: h2, a: a2 } = await loadFixture(started10);
      const s = await cur(h2);
      await h2.connect(a2).createBid(await h2.nft(), s.tokenId, { value: ETH('0.01') });
      expect((await cur(h2)).endTime).to.equal(s.endTime);
    });

    it('refund to a bidder that rejects ETH is paid in WETH and the new bid still goes through', async () => {
      const { house, weth, b } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      const BC = await ethers.getContractFactory('BidderContract');
      const bc: any = await BC.deploy();
      await bc.setRejectEth(true);
      await bc.bid(await house.getAddress(), tokenId, { value: ETH('1') });
      await expect(house.connect(b).createBid(await house.nft(), tokenId, { value: ETH('2') })).to.emit(house, 'SentAsWETH');
      expect(await weth.balanceOf(await bc.getAddress())).to.equal(ETH('1'));
      expect((await cur(house)).bidder).to.equal(b.address);
    });

    it('a gas-burning bidder cannot block the next bid', async () => {
      const { house, weth, b } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      // GasBurner can't bid itself; impersonate it to place the bid
      const GB = await ethers.getContractFactory('GasBurner');
      const gb: any = await GB.deploy();
      const gbAddr = await gb.getAddress();
      await network.provider.send('hardhat_setBalance', [gbAddr, '0x' + ETH('10').toString(16)]);
      await network.provider.request({ method: 'hardhat_impersonateAccount', params: [gbAddr] });
      const gbSigner = await ethers.getSigner(gbAddr);
      await house.connect(gbSigner).createBid(await house.nft(), tokenId, { value: ETH('1') });
      await house.connect(b).createBid(await house.nft(), tokenId, { value: ETH('2') });
      expect(await weth.balanceOf(gbAddr)).to.equal(ETH('1'));
    });
  });

  // --------------------------------------------------------------------- settling
  describe('settling', () => {
    it('settle before the end reverts; double settle reverts', async () => {
      const { house, guardian, a, stranger } = await loadFixture(started10);
      await house.connect(a).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('1') });
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.be.revertedWithCustomError(house, 'AuctionNotOver');
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      // a second call targets the freshly opened auction, which has not ended
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.be.revertedWithCustomError(house, 'AuctionNotOver');
      // paused: settle leaves the contract idle, and a second settle has nothing live at all
      await house.connect(guardian).pause();
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.be.revertedWithCustomError(house, 'NoLiveAuction');
    });

    it('with a winner: piece to winner, bid to payout, next piece opens, all in one tx', async () => {
      const { house, nft, a, payout, stranger } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('1.5') });
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction())
        .to.changeEtherBalances([payout, house], [ETH('1.5'), -ETH('1.5')]);
      expect(await nft.ownerOf(tokenId)).to.equal(a.address);
      expect(await house.inPool(tokenId)).to.equal(false);
      const next = await cur(house);
      expect(next.settled).to.equal(false);
      expect(next.tokenId).to.not.equal(tokenId);
      expect(await house.auctionCount()).to.equal(2);
      expect(await house.poolSize()).to.equal(8);
    });

    it('no bids: piece goes back to the end of the pool, next opens, pool size unchanged', async () => {
      const { house, stranger } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      const before = await house.poolSize();
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.emit(house, 'AuctionReturnedToPool');
      expect(await house.inPool(tokenId)).to.equal(true);
      // before = waiting pool with one live; after: returned piece added, a new one drawn out
      expect(await house.poolSize()).to.equal(before);
    });

    it('winner is a contract with no receiver hook: settle still works (transferFrom)', async () => {
      const { house, nft, stranger } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      const BC = await ethers.getContractFactory('BidderContract');
      const bc: any = await BC.deploy();
      await bc.bid(await house.getAddress(), tokenId, { value: ETH('1') });
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      expect(await nft.ownerOf(tokenId)).to.equal(await bc.getAddress());
    });

    for (const kind of ['RejectETH', 'GasBurner']) {
      it(`payout address that ${kind === 'RejectETH' ? 'reverts' : 'burns all gas'}: settle succeeds, payout gets WETH`, async () => {
        const [owner, guardian, , , a, , , stranger] = await ethers.getSigners();
        const dep = guardian;
        const M = await ethers.getContractFactory('MockNFT721');
        const nft: any = await M.deploy();
        await nft.mintBatch(dep.address, 0, 3);
        const R = await ethers.getContractFactory(kind);
        const bad: any = await R.deploy();
        const badAddr = await bad.getAddress();
        const { house, weth } = await deployHouse(await nft.getAddress(), badAddr, guardian.address, owner.address);
        await nft.connect(dep).setApprovalForAll(await house.getAddress(), true);
        await house.connect(dep).deposit([0, 1, 2]);
        await house.connect(owner).start();
        await house.connect(a).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('3') });
        await toEnd(house);
        await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.emit(house, 'SentAsWETH').withArgs(badAddr, ETH('3'));
        expect(await weth.balanceOf(badAddr)).to.equal(ETH('3'));
        expect((await cur(house)).settled).to.equal(false); // next auction still opened
      });
    }

    it('empty pool: contract idles, a deposit opens the next auction at once', async () => {
      const { house, nft, dep, a, stranger } = await loadFixture(pool1);
      await house.start();
      await house.connect(a).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('1') });
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.emit(house, 'Idle');
      expect((await cur(house)).settled).to.equal(true);
      await nft.mintBatch(dep.address, 77, 1);
      await expect(house.connect(dep).deposit([77])).to.emit(house, 'AuctionCreated');
      const c = await cur(house);
      expect(c.tokenId).to.equal(77);
      expect(c.settled).to.equal(false);
    });

    it('last piece is drawn with n = 1; with no bids it comes straight back', async () => {
      const { house, stranger } = await loadFixture(pool1);
      await house.start();
      const { tokenId } = await cur(house);
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      const c = await cur(house);
      expect(c.tokenId).to.equal(tokenId);
      expect(c.settled).to.equal(false);
      expect(await house.auctionCount()).to.equal(2);
    });

    it('start on an empty pool idles until the first deposit', async () => {
      const { house, nft, dep } = await loadFixture(pool0);
      await house.start();
      expect((await cur(house)).settled).to.equal(true);
      await nft.mintBatch(dep.address, 5, 2);
      await house.connect(dep).deposit([5, 6]);
      expect((await cur(house)).settled).to.equal(false);
      expect(await house.poolSize()).to.equal(1);
    });
  });

  // ---------------------------------------------------------------------- guardian
  describe('guardian', () => {
    it('pause stops the next opening but the live auction still takes bids and settles', async () => {
      const { house, guardian, a, b, payout, nft, stranger } = await loadFixture(started10);
      const { tokenId } = await cur(house);
      await house.connect(guardian).pause();
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('1') });
      await house.connect(b).createBid(await house.nft(), tokenId, { value: ETH('2') });
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.changeEtherBalance(payout, ETH('2'));
      expect(await nft.ownerOf(tokenId)).to.equal(b.address);
      expect((await cur(house)).settled).to.equal(true); // idle, nothing opened
    });

    it('unpause needs the 2 day schedule, is permissionless after, and opens the next auction', async () => {
      const { house, guardian, stranger } = await loadFixture(started10);
      await house.connect(guardian).pause();
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      await expect(house.connect(stranger).unpause()).to.be.revertedWithCustomError(house, 'UnpauseNotScheduled');
      await expect(house.connect(stranger).scheduleUnpause()).to.be.revertedWithCustomError(house, 'NotGuardian');
      await house.connect(guardian).scheduleUnpause();
      await time.increase(2 * DAY - 10);
      await expect(house.connect(stranger).unpause()).to.be.revertedWithCustomError(house, 'UnpauseNotReady');
      await time.increase(10);
      await expect(house.connect(stranger).unpause()).to.emit(house, 'AuctionCreated');
      expect(await house.paused()).to.equal(false);
    });

    it('pause again cancels a scheduled unpause', async () => {
      const { house, guardian, stranger } = await loadFixture(started10);
      await house.connect(guardian).pause();
      await house.connect(guardian).scheduleUnpause();
      await expect(house.connect(guardian).pause()).to.emit(house, 'UnpauseCancelled');
      await time.increase(3 * DAY);
      await expect(house.connect(stranger).unpause()).to.be.revertedWithCustomError(house, 'UnpauseNotScheduled');
    });

    it('duration: guardian only, 1 day to 7 weeks, live auction keeps its length, next uses the new one', async () => {
      const { house, guardian, stranger } = await loadFixture(started10);
      await expect(house.connect(stranger).setDuration(2 * DAY)).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(guardian).setDuration(DAY - 1)).to.be.revertedWithCustomError(house, 'DurationOutOfRange');
      await expect(house.connect(guardian).setDuration(4_233_601)).to.be.revertedWithCustomError(house, 'DurationOutOfRange');
      const live = await cur(house);
      await house.connect(guardian).setDuration(DAY);
      expect((await cur(house)).endTime).to.equal(live.endTime);
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      const next = await cur(house);
      expect(next.endTime - next.startTime).to.equal(BigInt(DAY));
      await house.connect(guardian).setDuration(4_233_600); // max is allowed
    });

    it('payout change: guardian only, 2 day wait, cancel stops it, settles pay old before and new after', async () => {
      const { house, guardian, payout, a, b, c, stranger } = await loadFixture(started10);
      await expect(house.connect(stranger).proposePayout(c.address)).to.be.revertedWithCustomError(house, 'NotGuardian');
      await house.connect(guardian).proposePayout(c.address);
      await expect(house.connect(guardian).acceptPayout()).to.be.revertedWithCustomError(house, 'PayoutNotReady');
      await house.connect(guardian).cancelPayout();
      await expect(house.connect(guardian).acceptPayout()).to.be.revertedWithCustomError(house, 'NoPendingPayout');

      await house.connect(guardian).proposePayout(c.address);
      // next auction runs 7 weeks, so it is still live after the 2 day wait
      await house.connect(guardian).setDuration(4_233_600);
      // settle before accept pays the old address
      await house.connect(a).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('1') });
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.changeEtherBalance(payout, ETH('1'));
      await time.increase(2 * DAY);
      await house.connect(guardian).acceptPayout();
      expect(await house.payout()).to.equal(c.address);
      await house.connect(b).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('2') });
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.changeEtherBalance(c, ETH('2'));
    });

    it('payout proposal lapses 7 days after it is made', async () => {
      const { house, guardian, c } = await loadFixture(started10);
      await house.connect(guardian).proposePayout(c.address);
      await time.increase(7 * DAY + 1);
      await expect(house.connect(guardian).acceptPayout()).to.be.revertedWithCustomError(house, 'PayoutExpired');
      // a fresh proposal works, accepted inside the window (day 2 to day 7)
      await house.connect(guardian).proposePayout(c.address);
      await time.increase(7 * DAY - 5);
      await house.connect(guardian).acceptPayout();
      expect(await house.payout()).to.equal(c.address);
    });

    it('guardian handover is two-step and there is no renounce', async () => {
      const { house, guardian, c, stranger } = await loadFixture(started10);
      await house.connect(guardian).transferGuardian(c.address);
      expect(await house.guardian()).to.equal(guardian.address);
      await expect(house.connect(stranger).acceptGuardian()).to.be.revertedWithCustomError(house, 'NotPendingGuardian');
      await house.connect(c).acceptGuardian();
      expect(await house.guardian()).to.equal(c.address);
      await expect(house.connect(guardian).pause()).to.be.revertedWithCustomError(house, 'NotGuardian');
      expect((house as any).renounceGuardian).to.equal(undefined);
      await expect(house.connect(c).transferGuardian(ethers.ZeroAddress)).to.be.revertedWithCustomError(house, 'ZeroAddress');
    });

    it('skip on an auction that CAN settle just settles it: the winner keeps the piece', async () => {
      const { house, nft, guardian, a, payout } = await loadFixture(started10);
      const { tokenId, endTime } = await cur(house);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('1') });
      await time.increaseTo(endTime + BigInt(3 * DAY));
      const tx = house.connect(guardian).skipStuckAuction();
      await expect(tx).to.emit(house, 'AuctionSettled').withArgs(1, await house.nft(), tokenId, a.address, ETH('1'));
      await expect(tx).to.not.emit(house, 'AuctionSkipped');
      expect(await nft.ownerOf(tokenId)).to.equal(a.address);
      expect(await house.refunds(a.address)).to.equal(0);
      expect((await cur(house)).settled).to.equal(false); // next opened
      void payout;
    });

    it('skip refuses to run with too little gas for a real settle attempt', async () => {
      const { house, nft, guardian, a } = await loadFixture(started10);
      const { tokenId, endTime } = await cur(house);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('1') });
      await nft.setFrozen(true);
      await time.increaseTo(endTime + BigInt(3 * DAY));
      await expect(house.connect(guardian).skipStuckAuction({ gasLimit: 900_000 }))
        .to.be.revertedWithCustomError(house, 'InsufficientGasForSettleAttempt');
    });

    it('settleForSkip cannot be called from outside', async () => {
      const { house, stranger } = await loadFixture(started10);
      await expect(house.connect(stranger).settleForSkip()).to.be.revertedWithCustomError(house, 'NotSelf');
    });

    it('skip stuck auction: reverts before 3 days past end, then (settle failing) credits the bidder and returns the piece', async () => {
      const { house, nft, guardian, a, stranger } = await loadFixture(started10);
      const { tokenId, endTime } = await cur(house);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('1') });
      await nft.setFrozen(true); // every transfer reverts: settle is genuinely stuck
      await time.increaseTo(endTime);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.be.reverted;
      await expect(house.connect(stranger).skipStuckAuction()).to.be.revertedWithCustomError(house, 'NotGuardian');
      await time.increaseTo(endTime + BigInt(3 * DAY) - 2n);
      await expect(house.connect(guardian).skipStuckAuction()).to.be.revertedWithCustomError(house, 'NotStuck');
      await time.increase(2);
      await expect(house.connect(guardian).skipStuckAuction()).to.emit(house, 'AuctionSkipped');
      await nft.setFrozen(false);
      expect(await house.refunds(a.address)).to.equal(ETH('1'));
      expect(await house.inPool(tokenId)).to.equal(true);
      expect((await cur(house)).settled).to.equal(false); // next opened
      // the guardian cannot take the credited refund
      await expect(house.connect(guardian).rescueETH()).to.be.revertedWithCustomError(house, 'NothingToRescue');
      await expect(house.connect(a).withdrawRefund()).to.changeEtherBalance(a, ETH('1'));
      await expect(house.connect(a).withdrawRefund()).to.be.revertedWithCustomError(house, 'NothingToWithdraw');
    });

    it('rescue ETH: only what sits above the live top bid and credited refunds, to the payout', async () => {
      const { house, guardian, a, payout } = await loadFixture(started10);
      await house.connect(a).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('1') });
      await expect(house.connect(guardian).rescueETH()).to.be.revertedWithCustomError(house, 'NothingToRescue');
      const FS = await ethers.getContractFactory('ForceSend');
      await FS.deploy(await house.getAddress(), { value: ETH('0.3') });
      await expect(house.connect(guardian).rescueETH()).to.changeEtherBalances([payout, house], [ETH('0.3'), -ETH('0.3')]);
      expect(await ethers.provider.getBalance(await house.getAddress())).to.equal(ETH('1'));
    });

    it('plain ETH sent by mistake is rejected (no receive)', async () => {
      const { house, a } = await loadFixture(started10);
      await expect(a.sendTransaction({ to: await house.getAddress(), value: ETH('1') })).to.be.reverted;
    });

    it('rescue NFTs: foreign NFT and a stray v67 piece go to payout; pool and live pieces cannot', async () => {
      const { house, nft, guardian, payout, dep } = await loadFixture(started10);
      const live = (await cur(house)).tokenId;
      const waiting = (await house.poolIds(0, 1))[0];
      await expect(house.connect(guardian).rescueERC721(await nft.getAddress(), live)).to.be.revertedWithCustomError(house, 'PoolPiece');
      await expect(house.connect(guardian).rescueERC721(await nft.getAddress(), waiting)).to.be.revertedWithCustomError(house, 'PoolPiece');
      // stray: v67 piece moved in by plain transfer
      await nft.mintBatch(dep.address, 300, 1);
      await nft.connect(dep).transferFrom(dep.address, await house.getAddress(), 300);
      expect(await house.inPool(300)).to.equal(false);
      await house.connect(guardian).rescueERC721(await nft.getAddress(), 300);
      expect(await nft.ownerOf(300)).to.equal(payout.address);
      // foreign
      const M = await ethers.getContractFactory('MockNFT721');
      const foreign: any = await M.deploy();
      await foreign.mintBatch(await house.getAddress(), 9, 1);
      await house.connect(guardian).rescueERC721(await foreign.getAddress(), 9);
      expect(await foreign.ownerOf(9)).to.equal(payout.address);
    });

    it('rescue ERC-20 goes to payout', async () => {
      const { house, weth, guardian, payout, a } = await loadFixture(started10);
      await weth.connect(a).deposit({ value: ETH('1') });
      await weth.connect(a).transfer(await house.getAddress(), ETH('1'));
      await house.connect(guardian).rescueERC20(await weth.getAddress(), ETH('1'));
      expect(await weth.balanceOf(payout.address)).to.equal(ETH('1'));
    });

    it('guardian has no setter for raise, extension or opening bid, and cannot pick the next piece', async () => {
      const { house } = await loadFixture(started10);
      for (const fn of ['setMinBidIncrementPercentage', 'setTimeBuffer', 'setReservePrice', 'setMinBid', 'setPayout', 'setNextPiece']) {
        expect((house as any)[fn]).to.equal(undefined);
      }
    });
  });

  // ------------------------------------------------------------------------ owner
  describe('owner and upgrades', () => {
    it('owner can upgrade at once; payout and auctions carry over; renounce kills upgrades for good', async () => {
      const { house, F, owner, guardian, a, payout, stranger } = await loadFixture(started10);
      await house.connect(a).createBid(await house.nft(), (await cur(house)).tokenId, { value: ETH('1') });
      await expect(upgrades.upgradeProxy(await house.getAddress(), F.connect(stranger), { kind: 'uups', redeployImplementation: 'always' }))
        .to.be.revertedWithCustomError(house, 'OwnableUnauthorizedAccount');
      const up: any = await upgrades.upgradeProxy(await house.getAddress(), F.connect(owner), { kind: 'uups', redeployImplementation: 'always' });
      expect(await up.payout()).to.equal(payout.address);
      await toEnd(up);
      await expect(up.connect(stranger).settleCurrentAndCreateNewAuction()).to.changeEtherBalance(payout, ETH('1'));

      await up.connect(owner).renounceOwnership();
      expect(await up.owner()).to.equal(ethers.ZeroAddress);
      await expect(upgrades.upgradeProxy(await up.getAddress(), F.connect(owner), { kind: 'uups', redeployImplementation: 'always' }))
        .to.be.revertedWithCustomError(up, 'OwnableUnauthorizedAccount');

      // guardian powers survive renounce
      await up.connect(guardian).setDuration(DAY);
      await up.connect(guardian).proposePayout(a.address);
      await up.connect(guardian).cancelPayout();
      await up.connect(guardian).pause();
      await up.connect(guardian).scheduleUnpause();
      const live = await cur(up);
      await time.increaseTo(live.endTime + BigInt(3 * DAY));
      await up.connect(guardian).skipStuckAuction();
    });

    it('ownership transfer is two-step', async () => {
      const { house, owner, c } = await loadFixture(pool10);
      await house.connect(owner).transferOwnership(c.address);
      expect(await house.owner()).to.equal(owner.address);
      await house.connect(c).acceptOwnership();
      expect(await house.owner()).to.equal(c.address);
    });

    it('owner has no say over the payout, guardian, bids or pool', async () => {
      const { house, owner } = await loadFixture(started10);
      await expect(house.connect(owner).proposePayout(owner.address)).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(owner).rescueETH()).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(owner).pause()).to.be.revertedWithCustomError(house, 'NotGuardian');
    });
  });

  // ------------------------------------------------------------- real v67 contract
  describe('against the real v67 V2 implementation (whitelist on, as live)', () => {
    async function v67() {
      const [owner, guardian, payout, , a, , , stranger] = await ethers.getSigners();
      const dep = guardian; // deposit is guardian-only
      const F2 = await ethers.getContractFactory(V2);
      const nft: any = await upgrades.deployProxy(F2, ['CryptoPhunksV67', 'QPHUNK', payout.address, owner.address], { kind: 'uups' });
      await nft.waitForDeployment();
      await nft.ownerMintBatch(dep.address, [10, 11, 12, 13]);
      await nft.setOperatorWhitelistEnabled(true);
      const { house } = await deployHouse(await nft.getAddress(), payout.address, guardian.address, owner.address);
      return { nft, house, owner, guardian, payout, dep, a, stranger };
    }

    it('deposit needs the auction whitelisted on v67, then a full bid/settle cycle works', async () => {
      const { nft, house, owner, dep, a, payout, stranger } = await loadFixture(v67);
      const houseAddr = await house.getAddress();
      await expect(nft.connect(dep).setApprovalForAll(houseAddr, true)).to.be.revertedWithCustomError(nft, 'OperatorNotWhitelisted');
      await nft.connect(owner).setApprovedOperator(houseAddr, true);
      await nft.connect(dep).setApprovalForAll(houseAddr, true);
      await house.connect(dep).deposit([10, 11, 12, 13]);
      expect(await house.poolSize()).to.equal(4);
      await house.connect(owner).start();
      const { tokenId } = await cur(house);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('0.5') });
      await toEnd(house);
      await expect(house.connect(stranger).settleCurrentAndCreateNewAuction()).to.changeEtherBalance(payout, ETH('0.5'));
      expect(await nft.ownerOf(tokenId)).to.equal(a.address);
    });

    it('settle still works if the auction is later removed from the v67 whitelist (moves its own tokens)', async () => {
      const { nft, house, owner, dep, a, stranger } = await loadFixture(v67);
      const houseAddr = await house.getAddress();
      await nft.connect(owner).setApprovedOperator(houseAddr, true);
      await nft.connect(dep).setApprovalForAll(houseAddr, true);
      await house.connect(dep).deposit([10, 11]);
      await house.connect(owner).start();
      await nft.connect(owner).setApprovedOperator(houseAddr, false);
      const { tokenId } = await cur(house);
      await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('0.5') });
      await toEnd(house);
      await house.connect(stranger).settleCurrentAndCreateNewAuction();
      expect(await nft.ownerOf(tokenId)).to.equal(a.address);
    });
  });

  // ------------------------------------------------------------------- gas + scale
  describe('gas and scale', () => {
    it('settle with a winner + payout push stays near 150k-180k; deposit of 250 fits a block', async () => {
      const [owner, guardian, payout, , a, , , stranger] = await ethers.getSigners();
      const dep = guardian; // deposit is guardian-only
      const F2 = await ethers.getContractFactory(V2);
      const nft: any = await upgrades.deployProxy(F2, ['CryptoPhunksV67', 'QPHUNK', payout.address, owner.address], { kind: 'uups' });
      const ids = Array.from({ length: 250 }, (_, i) => 1000 + i);
      await nft.ownerMintBatch(dep.address, ids);
      const { house } = await deployHouse(await nft.getAddress(), payout.address, guardian.address, owner.address);
      await nft.connect(dep).setApprovalForAll(await house.getAddress(), true);
      const dtx = await house.connect(dep).deposit(ids);
      const dGas = (await dtx.wait()).gasUsed;
      await house.connect(owner).start();
      const settleGas: bigint[] = [];
      const bidGas: bigint[] = [];
      for (let i = 0; i < 5; i++) {
        const { tokenId } = await cur(house);
        const b1 = await (await house.connect(a).createBid(await house.nft(), tokenId, { value: ETH('0.1') })).wait();
        const b2 = await (await house.connect(stranger).createBid(await house.nft(), tokenId, { value: ETH('0.2') })).wait();
        bidGas.push(b1.gasUsed, b2.gasUsed);
        await toEnd(house);
        const r = await (await house.connect(stranger).settleCurrentAndCreateNewAuction()).wait();
        settleGas.push(r.gasUsed);
      }
      console.log(`      deposit 250 (real v67): ${dGas} gas (${(Number(dGas) / 250).toFixed(0)}/piece)`);
      console.log(`      bids: ${bidGas.join(', ')}`);
      console.log(`      settle+open (real v67): ${settleGas.join(', ')}`);
      expect(dGas).to.be.lessThan(30_000_000n);
      for (const g of settleGas) expect(g).to.be.lessThan(200_000n);
    });

    it('full cycle: all 4,366 pieces sold exactly once; payout got every bid; draw is even', async function () {
      this.timeout(1_800_000);
      const N = 4366;
      const DYSTO = 2167; // ids 0..2166 stand in for Dysto, the rest for others
      const f = await base(0);
      const { house, nft, dep, owner, payout, a } = f;
      for (let i = 0; i < N; i += 500) await nft.mintBatch(dep.address, i, Math.min(500, N - i));
      const all = [...Array(N).keys()];
      for (let i = 0; i < N; i += 250) await house.connect(dep).deposit(all.slice(i, i + 250));
      expect(await house.poolSize()).to.equal(N);
      await network.provider.send('evm_setAutomine', [true]);
      await house.connect(owner).start();

      const payoutStart = await ethers.provider.getBalance(payout.address);
      const seen = new Set<number>();
      let total = 0n;
      let dystoFirst400 = 0;
      const bid = ETH('0.001');
      for (let k = 0; k < N; k++) {
        const c = await cur(house);
        const id = Number(c.tokenId);
        expect(seen.has(id)).to.equal(false);
        seen.add(id);
        if (k < 400 && id < DYSTO) dystoFirst400++;
        await house.connect(a).createBid(await house.nft(), id, { value: bid });
        total += bid;
        await network.provider.send('evm_setNextBlockTimestamp', [Number(c.endTime)]);
        await house.connect(a).settleCurrentAndCreateNewAuction();
      }
      expect(seen.size).to.equal(N);
      expect(await house.poolSize()).to.equal(0);
      expect((await cur(house)).settled).to.equal(true);
      expect(await nft.balanceOf(a.address)).to.equal(N);
      expect((await ethers.provider.getBalance(payout.address)) - payoutStart).to.equal(total);
      const share = dystoFirst400 / 400;
      console.log(`      Dysto share of first 400 draws: ${(share * 100).toFixed(1)}% (pool share ${(DYSTO / N * 100).toFixed(1)}%)`);
      expect(share).to.be.within(0.40, 0.60);
    });
  });

  // ------------------------------------------------------------- featured queue
  describe('featured queue (other collections, set order, own lengths)', () => {
    /** pool10 + a 67-piece "drop" collection (ids 1..67) minted to the guardian and approved. */
    async function withDrop() {
      const f = await pool10();
      const M = await ethers.getContractFactory('MockNFT721');
      const drop: any = await M.deploy();
      await drop.mintBatch(f.guardian.address, 1, 67);
      await drop.connect(f.guardian).setApprovalForAll(await f.house.getAddress(), true);
      await f.house.connect(f.guardian).setCollectionAllowed(await drop.getAddress(), true);
      return { ...f, drop, dropAddr: await drop.getAddress() };
    }
    const sellLive = async (house: any, who: any, amount = ETH('0.01')) => {
      const c = await cur(house);
      await house.connect(who).createBid(c.collection, c.tokenId, { value: amount });
      await time.increaseTo(c.endTime);
      await house.connect(who).settleCurrentAndCreateNewAuction();
      return c;
    };

    it('only the guardian approves collections and queues; unapproved collections are refused', async () => {
      const { house, guardian, stranger, owner, drop, dropAddr } = await loadFixture(withDrop);
      await expect(house.connect(stranger).setCollectionAllowed(dropAddr, true)).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(owner).queue(dropAddr, [1], [])).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(guardian).setCollectionAllowed(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(house, 'ZeroAddress');
      const M = await ethers.getContractFactory('MockNFT721');
      const other: any = await M.deploy();
      await expect(house.connect(guardian).queue(await other.getAddress(), [1], []))
        .to.be.revertedWithCustomError(house, 'CollectionNotAllowed');
      await expect(house.connect(guardian).queue(dropAddr, [1, 2], [DAY]))
        .to.be.revertedWithCustomError(house, 'LengthMismatch');
      await expect(house.connect(guardian).queue(dropAddr, [1], [3600]))
        .to.be.revertedWithCustomError(house, 'DurationOutOfRange');
      await expect(house.connect(guardian).queue(dropAddr, [1], [8 * 7 * DAY]))
        .to.be.revertedWithCustomError(house, 'DurationOutOfRange');
      await house.connect(guardian).queue(dropAddr, [1], []);
      await expect(house.connect(guardian).queue(dropAddr, [1], [])).to.be.revertedWithCustomError(house, 'AlreadyQueued');
      expect(await drop.ownerOf(1)).to.equal(await house.getAddress());
      expect(await house.queueSize()).to.equal(1);
    });

    it('queued pieces run first, in the exact order given, with their own lengths; then the v67 pool resumes', async () => {
      const { house, guardian, owner, a, payout, drop, dropAddr, nft } = await loadFixture(withDrop);
      await house.connect(guardian).setQueueEvery(1); // back to back for this test
      await house.connect(guardian).queue(dropAddr, [5, 3, 9], [2 * DAY, 0, 7 * DAY]);
      const payoutBefore = await ethers.provider.getBalance(payout.address);
      await house.connect(owner).start();
      const order: bigint[] = [];
      const lens: bigint[] = [];
      for (let k = 0; k < 3; k++) {
        const c = await cur(house);
        expect(c.collection).to.equal(dropAddr);
        expect(c.fromQueue).to.equal(true);
        order.push(c.tokenId);
        lens.push(c.endTime - c.startTime);
        await sellLive(house, a);
      }
      expect(order).to.deep.equal([5n, 3n, 9n]);
      expect(lens).to.deep.equal([BigInt(2 * DAY), BigInt(DURATION), BigInt(7 * DAY)]);
      for (const id of [5, 3, 9]) expect(await drop.ownerOf(id)).to.equal(a.address);
      expect((await ethers.provider.getBalance(payout.address)) - payoutBefore).to.equal(ETH('0.03'));
      const next = await cur(house);
      expect(next.collection).to.equal(await nft.getAddress());
      expect(next.fromQueue).to.equal(false);
      expect(await house.queueSize()).to.equal(0);
    });

    it('queueing while a pool auction is live: the queue piece goes next, the live auction is untouched', async () => {
      const { house, guardian, owner, a, dropAddr, nft } = await loadFixture(withDrop);
      await house.connect(owner).start();
      const live = await cur(house);
      await house.connect(guardian).queue(dropAddr, [42], []);
      const still = await cur(house);
      expect(still.tokenId).to.equal(live.tokenId);
      expect(still.collection).to.equal(await nft.getAddress());
      await sellLive(house, a);
      const c = await cur(house);
      expect(c.collection).to.equal(dropAddr);
      expect(c.tokenId).to.equal(42n);
    });

    it('a bid must name the live collection: same id on another collection is refused', async () => {
      const { house, guardian, owner, a, dropAddr, nft } = await loadFixture(withDrop);
      await house.connect(guardian).queue(dropAddr, [3], []);
      await house.connect(owner).start();
      await expect(house.connect(a).createBid(await nft.getAddress(), 3, { value: ETH('1') }))
        .to.be.revertedWithCustomError(house, 'NotUpForAuction');
      await house.connect(a).createBid(dropAddr, 3, { value: ETH('1') });
    });

    it('reorder: moveQueued shifts pieces; queueItems shows the run order', async () => {
      const { house, guardian, stranger, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).queue(dropAddr, [1, 2, 3, 4, 5], []);
      await house.connect(guardian).moveQueued(4, 0); // 5 to the front
      await house.connect(guardian).moveQueued(1, 3); // 1 to position 3
      const [cols, ids] = await house.queueItems(0, 100);
      expect(ids).to.deep.equal([5n, 2n, 3n, 1n, 4n]);
      expect(cols.every((x: string) => x === dropAddr)).to.equal(true);
      await expect(house.connect(guardian).moveQueued(5, 0)).to.be.revertedWithCustomError(house, 'BadPosition');
      await expect(house.connect(stranger).moveQueued(0, 1)).to.be.revertedWithCustomError(house, 'NotGuardian');
      const [, page] = await house.queueItems(3, 10);
      expect(page).to.deep.equal([1n, 4n]);
      const [, none] = await house.queueItems(9, ethers.MaxUint256);
      expect(none.length).to.equal(0);
      const [, big] = await house.queueItems(1, ethers.MaxUint256);
      expect(big.length).to.equal(4);
    });

    it('reorder after some have run: positions count from the next piece up', async () => {
      const { house, guardian, owner, a, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).setQueueEvery(1); // back to back for this test
      await house.connect(guardian).queue(dropAddr, [1, 2, 3, 4], []);
      await house.connect(owner).start(); // 1 is live
      await sellLive(house, a); // 1 sold, 2 live, waiting: 3, 4
      const [, w] = await house.queueItems(0, 10);
      expect(w).to.deep.equal([3n, 4n]);
      await house.connect(guardian).moveQueued(1, 0);
      await sellLive(house, a); // 2 sold, 4 live
      expect((await cur(house)).tokenId).to.equal(4n);
      await sellLive(house, a);
      expect((await cur(house)).tokenId).to.equal(3n);
    });

    it('per-piece length can be changed before it runs; 0 means the global length', async () => {
      const { house, guardian, owner, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).queue(dropAddr, [7], [3 * DAY]);
      await house.connect(guardian).setQueuedDuration(0, 0);
      await expect(house.connect(guardian).setQueuedDuration(0, 100)).to.be.revertedWithCustomError(house, 'DurationOutOfRange');
      await expect(house.connect(guardian).setQueuedDuration(1, DAY)).to.be.revertedWithCustomError(house, 'BadPosition');
      await house.connect(guardian).setDuration(4 * DAY);
      await house.connect(owner).start();
      const c = await cur(house);
      expect(c.endTime - c.startTime).to.equal(BigInt(4 * DAY));
    });

    it('removeQueued pulls a waiting piece out to the payout address (never to the guardian)', async () => {
      const { house, guardian, payout, drop, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).queue(dropAddr, [1, 2, 3], []);
      await expect(house.connect(guardian).removeQueued(1)).to.emit(house, 'QueueRemoved').withArgs(dropAddr, 2, payout.address);
      expect(await drop.ownerOf(2)).to.equal(payout.address);
      expect(await house.inQueue(dropAddr, 2)).to.equal(false);
      const [, ids] = await house.queueItems(0, 10);
      expect(ids).to.deep.equal([1n, 3n]);
      await expect(house.connect(guardian).removeQueued(2)).to.be.revertedWithCustomError(house, 'BadPosition');
    });

    it('no bids on a queue piece: it goes to the back of the queue, keeping its own length', async () => {
      const { house, guardian, owner, a, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).setQueueEvery(1); // back to back for this test
      await house.connect(guardian).queue(dropAddr, [1, 2], [2 * DAY, 0]);
      await house.connect(owner).start();
      const c1 = await cur(house);
      await time.increaseTo(c1.endTime);
      await expect(house.connect(a).settleCurrentAndCreateNewAuction()).to.emit(house, 'AuctionReturnedToQueue').withArgs(1, dropAddr, 1);
      expect((await cur(house)).tokenId).to.equal(2n);
      const [, ids, durs] = await house.queueItems(0, 10);
      expect(ids).to.deep.equal([1n]);
      expect(durs).to.deep.equal([BigInt(2 * DAY)]);
      expect(await house.inQueue(dropAddr, 1)).to.equal(true);
    });

    it('stuck queue piece (its collection breaks): skip refunds in full, releases it, then it can be rescued', async () => {
      const { house, guardian, owner, a, payout, drop, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).queue(dropAddr, [8], []);
      await house.connect(owner).start();
      const c = await cur(house);
      await house.connect(a).createBid(dropAddr, 8, { value: ETH('1') });
      await expect(house.connect(guardian).rescueERC721(dropAddr, 8)).to.be.revertedWithCustomError(house, 'QueuePiece');
      await drop.setFrozen(true);
      await time.increaseTo(c.endTime + BigInt(3 * DAY));
      await expect(house.connect(guardian).skipStuckAuction()).to.emit(house, 'QueueReleased').withArgs(dropAddr, 8);
      expect(await house.refunds(a.address)).to.equal(ETH('1'));
      expect(await house.inQueue(dropAddr, 8)).to.equal(false);
      expect(await house.queueSize()).to.equal(0); // not re-queued
      expect((await cur(house)).fromQueue).to.equal(false); // pool resumed
      await drop.setFrozen(false);
      await house.connect(guardian).rescueERC721(dropAddr, 8);
      expect(await drop.ownerOf(8)).to.equal(payout.address);
      await expect(house.connect(a).withdrawRefund()).to.changeEtherBalance(a, ETH('1'));
    });

    it('v67 pieces can be featured too, but never in the pool and the queue at once', async () => {
      const { house, guardian, nft, dep } = await loadFixture(withDrop);
      const v67 = await nft.getAddress();
      await house.connect(guardian).setCollectionAllowed(v67, true);
      await expect(house.connect(guardian).queue(v67, [3], [])).to.be.revertedWithCustomError(house, 'AlreadyInPool');
      await nft.mintBatch(dep.address, 100, 1);
      await house.connect(guardian).queue(v67, [100], []);
      await expect(house.connect(dep).deposit([100])).to.be.revertedWithCustomError(house, 'AlreadyQueued');
      await expect(house.connect(guardian).rescueERC721(v67, 100)).to.be.revertedWithCustomError(house, 'QueuePiece');
    });

    it('starting with only queue pieces (empty pool) works; idles after the last one; queueing while idle opens at once', async () => {
      const f = await pool0();
      const M = await ethers.getContractFactory('MockNFT721');
      const drop: any = await M.deploy();
      const dropAddr = await drop.getAddress();
      await drop.mintBatch(f.guardian.address, 1, 3);
      await drop.connect(f.guardian).setApprovalForAll(await f.house.getAddress(), true);
      await f.house.connect(f.guardian).setCollectionAllowed(dropAddr, true);
      await f.house.connect(f.guardian).queue(dropAddr, [1, 2], []);
      await f.house.connect(f.owner).start();
      await sellLive(f.house, f.a);
      const c = await cur(f.house);
      await f.house.connect(f.a).createBid(c.collection, c.tokenId, { value: ETH('0.01') });
      await time.increaseTo(c.endTime);
      await expect(f.house.connect(f.a).settleCurrentAndCreateNewAuction()).to.emit(f.house, 'Idle');
      await expect(f.house.connect(f.guardian).queue(dropAddr, [3], [])).to.emit(f.house, 'AuctionCreated');
      expect((await cur(f.house)).tokenId).to.equal(3n);
    });

    it('un-approving a collection stops new queueing but pieces already queued still run', async () => {
      const { house, guardian, owner, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).queue(dropAddr, [1], []);
      await house.connect(guardian).setCollectionAllowed(dropAddr, false);
      await expect(house.connect(guardian).queue(dropAddr, [2], [])).to.be.revertedWithCustomError(house, 'CollectionNotAllowed');
      await house.connect(owner).start();
      expect((await cur(house)).collection).to.equal(dropAddr);
    });

    it('a collection that fakes its transfer is caught (the piece must really arrive)', async () => {
      const { house, guardian } = await loadFixture(withDrop);
      const L = await ethers.getContractFactory('LyingNFT');
      const liar: any = await L.deploy();
      await house.connect(guardian).setCollectionAllowed(await liar.getAddress(), true);
      await expect(house.connect(guardian).queue(await liar.getAddress(), [1], [])).to.be.revertedWithCustomError(house, 'NotReceived');
    });

    it('queue is capped at MAX_QUEUE waiting pieces', async () => {
      const { house, guardian, drop, dropAddr } = await loadFixture(withDrop);
      await drop.mintBatch(guardian.address, 100, 450);
      const ids = [...Array(67).keys()].map((i) => i + 1).concat([...Array(433).keys()].map((i) => i + 100));
      for (let i = 0; i < ids.length; i += 100) {
        const r = await (await house.connect(guardian).queue(dropAddr, ids.slice(i, i + 100), [])).wait();
        if (i === 0) console.log(`      queue 100 pieces: ${r!.gasUsed} gas (${r!.gasUsed / 100n}/piece)`);
      }
      expect(await house.queueSize()).to.equal(500);
      await expect(house.connect(guardian).queue(dropAddr, [540], [])).to.be.revertedWithCustomError(house, 'QueueFull');
    });

    it('full 67-piece drop: every piece sold once, in order, settle gas flat (no shifting), then the pool', async function () {
      this.timeout(600_000);
      const { house, guardian, owner, a, drop, dropAddr, payout } = await loadFixture(withDrop);
      await house.connect(guardian).setQueueEvery(1); // back to back for this test
      const ids = [...Array(67).keys()].map((i) => 67 - i); // run 67..1
      await house.connect(guardian).queue(dropAddr, ids, []);
      await house.connect(owner).start();
      const payoutStart = await ethers.provider.getBalance(payout.address);
      const gas: bigint[] = [];
      for (let k = 0; k < 67; k++) {
        const c = await cur(house);
        expect(c.tokenId).to.equal(BigInt(ids[k]));
        await house.connect(a).createBid(dropAddr, c.tokenId, { value: ETH('0.001') });
        await time.increaseTo(c.endTime);
        const r = await (await house.connect(a).settleCurrentAndCreateNewAuction()).wait();
        gas.push(r!.gasUsed);
      }
      expect(await drop.balanceOf(a.address)).to.equal(67);
      expect((await ethers.provider.getBalance(payout.address)) - payoutStart).to.equal(ETH('0.067'));
      expect((await cur(house)).fromQueue).to.equal(false);
      const max = gas.reduce((x, y) => (y > x ? y : x));
      const min = gas.reduce((x, y) => (y < x ? y : x));
      console.log(`      queue settle+open gas: ${min}-${max}`);
      expect(max).to.be.lessThan(250_000n);
    });

    // ---- mixing the queue with the v67 pool
    const runs = async (house: any, who: any, k: number) => {
      const out: string[] = [];
      for (let i = 0; i < k; i++) {
        const c = await cur(house);
        out.push(c.fromQueue ? 'Q' + c.tokenId : 'P');
        await sellLive(house, who);
      }
      return out.join(' ');
    };

    it('default mix is 2: queue and v67 alternate, starting with the queue piece; v67 carries on after', async () => {
      const { house, guardian, owner, a, dropAddr } = await loadFixture(withDrop);
      expect(await house.queueEvery()).to.equal(2);
      await house.connect(guardian).queue(dropAddr, [7, 2, 5], []);
      await house.connect(owner).start();
      expect(await runs(house, a, 8)).to.equal('Q7 P Q2 P Q5 P P P');
    });

    it('mix 3: one queue piece, then two v67, repeat', async () => {
      const { house, guardian, owner, a, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).setQueueEvery(3);
      await house.connect(guardian).queue(dropAddr, [1, 2], []);
      await house.connect(owner).start();
      expect(await runs(house, a, 6)).to.equal('Q1 P P Q2 P P');
    });

    it('pieces queued mid-run go next in line, then the mix resumes', async () => {
      const { house, guardian, owner, a, dropAddr } = await loadFixture(withDrop);
      await house.connect(owner).start();
      expect(await runs(house, a, 2)).to.equal('P P'); // nothing queued yet
      await house.connect(guardian).queue(dropAddr, [30, 31], []); // during the 3rd (v67) auction
      expect(await runs(house, a, 5)).to.equal('P Q30 P Q31 P');
    });

    it('playQueueNext puts the queue head up next, whatever the mix says', async () => {
      const { house, guardian, owner, a, stranger, dropAddr } = await loadFixture(withDrop);
      await house.connect(guardian).setQueueEvery(5);
      await house.connect(guardian).queue(dropAddr, [1, 2], []);
      await house.connect(owner).start();
      expect(await runs(house, a, 2)).to.equal('Q1 P');
      await expect(house.connect(stranger).playQueueNext()).to.be.revertedWithCustomError(house, 'NotGuardian');
      await house.connect(guardian).playQueueNext();
      expect(await runs(house, a, 3)).to.equal('P Q2 P'); // the live v67 auction is untouched, then Q2
    });

    it('when the v67 pool is empty the queue runs back to back; the mix setting is guardian-only and bounded', async () => {
      const f = await pool0();
      const M = await ethers.getContractFactory('MockNFT721');
      const drop: any = await M.deploy();
      const dropAddr = await drop.getAddress();
      await drop.mintBatch(f.guardian.address, 1, 3);
      await drop.connect(f.guardian).setApprovalForAll(await f.house.getAddress(), true);
      await f.house.connect(f.guardian).setCollectionAllowed(dropAddr, true);
      await f.house.connect(f.guardian).queue(dropAddr, [1, 2, 3], []);
      await f.house.connect(f.owner).start();
      expect(await runs(f.house, f.a, 2)).to.equal('Q1 Q2');
      await expect(f.house.connect(f.a).setQueueEvery(1)).to.be.revertedWithCustomError(f.house, 'NotGuardian');
      await expect(f.house.connect(f.guardian).setQueueEvery(0)).to.be.revertedWithCustomError(f.house, 'QueueEveryOutOfRange');
      await expect(f.house.connect(f.guardian).setQueueEvery(101)).to.be.revertedWithCustomError(f.house, 'QueueEveryOutOfRange');
      await expect(f.house.connect(f.guardian).setQueueEvery(4)).to.emit(f.house, 'QueueEverySet').withArgs(4);
    });

    it('full 67-piece drop alternating with v67: 134 auctions, every drop piece sold once and in order', async function () {
      this.timeout(600_000);
      const f = await base(80);
      const M = await ethers.getContractFactory('MockNFT721');
      const drop: any = await M.deploy();
      const dropAddr = await drop.getAddress();
      await drop.mintBatch(f.guardian.address, 1, 67);
      await drop.connect(f.guardian).setApprovalForAll(await f.house.getAddress(), true);
      await f.house.connect(f.guardian).setCollectionAllowed(dropAddr, true);
      await f.house.connect(f.guardian).queue(dropAddr, [...Array(67).keys()].map((i) => i + 1), []);
      await f.house.connect(f.owner).start();
      const seq: string[] = [];
      for (let k = 0; k < 134; k++) {
        const c = await cur(f.house);
        seq.push(c.fromQueue ? 'Q' + c.tokenId : 'P');
        await sellLive(f.house, f.a, ETH('0.001'));
      }
      const expected = [...Array(67).keys()].flatMap((i) => ['Q' + (i + 1), 'P']);
      expect(seq).to.deep.equal(expected);
      expect(await drop.balanceOf(f.a.address)).to.equal(67);
      expect(await f.nft.balanceOf(f.a.address)).to.equal(67);
      expect(await f.house.poolSize()).to.equal(80 - 67 - 1);
    });
  });

  // ------------------------------------------------------------- min opening bid (reserve)
  describe('guardian-set minimum opening bid', () => {
    it('starts at 0.001 ETH; guardian-only; bounded 0.001..10 ETH', async () => {
      const { house, guardian, stranger, owner } = await loadFixture(pool10);
      expect(await house.minOpeningBid()).to.equal(ETH('0.001'));
      await expect(house.connect(stranger).setMinOpeningBid(ETH('1'))).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(owner).setMinOpeningBid(ETH('1'))).to.be.revertedWithCustomError(house, 'NotGuardian');
      await expect(house.connect(guardian).setMinOpeningBid(ETH('0.0009'))).to.be.revertedWithCustomError(house, 'OpeningBidOutOfRange');
      await expect(house.connect(guardian).setMinOpeningBid(ETH('10.000000001'))).to.be.revertedWithCustomError(house, 'OpeningBidOutOfRange');
      await expect(house.connect(guardian).setMinOpeningBid(ETH('10'))).to.emit(house, 'MinOpeningBidSet').withArgs(ETH('10'));
      await house.connect(guardian).setMinOpeningBid(ETH('0.001'));
    });

    it('a new minimum applies from the next auction; the live one keeps the minimum it opened with', async () => {
      const { house, guardian, owner, a, b } = await loadFixture(pool10);
      await house.connect(owner).start();
      const c1 = await cur(house);
      await house.connect(guardian).setMinOpeningBid(ETH('0.5'));
      expect(await house.minNextBid()).to.equal(ETH('0.001')); // live auction unchanged
      await house.connect(a).createBid(c1.collection, c1.tokenId, { value: ETH('0.001') });
      await time.increaseTo(c1.endTime);
      await house.connect(a).settleCurrentAndCreateNewAuction();
      const c2 = await cur(house);
      expect(await house.minNextBid()).to.equal(ETH('0.5'));
      await expect(house.connect(b).createBid(c2.collection, c2.tokenId, { value: ETH('0.4999') }))
        .to.be.revertedWithCustomError(house, 'BidTooLow').withArgs(ETH('0.5'));
      await house.connect(b).createBid(c2.collection, c2.tokenId, { value: ETH('0.5') });
      // after the first bid the normal 5% raise rule applies
      expect(await house.minNextBid()).to.equal(raise(ETH('0.5')));
    });

    it('nobody meets the minimum: the piece goes back to the end of its line (pool or queue)', async () => {
      const { house, guardian, owner, a } = await loadFixture(pool10);
      await house.connect(guardian).setMinOpeningBid(ETH('2'));
      await house.connect(owner).start();
      const c = await cur(house);
      await expect(house.connect(a).createBid(c.collection, c.tokenId, { value: ETH('1') })).to.be.revertedWithCustomError(house, 'BidTooLow');
      await time.increaseTo(c.endTime);
      await expect(house.connect(a).settleCurrentAndCreateNewAuction()).to.emit(house, 'AuctionReturnedToPool');
      expect(await house.inPool(c.tokenId)).to.equal(true);
    });

    it('works for queue pieces too (e.g. raise it for a drop, lower it again for v67)', async () => {
      const { house, guardian, owner, a, nft } = await loadFixture(pool10);
      const M = await ethers.getContractFactory('MockNFT721');
      const drop: any = await M.deploy();
      const dropAddr = await drop.getAddress();
      await drop.mintBatch(guardian.address, 1, 1);
      await drop.connect(guardian).setApprovalForAll(await house.getAddress(), true);
      await house.connect(guardian).setCollectionAllowed(dropAddr, true);
      await house.connect(guardian).queue(dropAddr, [1], []);
      await house.connect(guardian).setMinOpeningBid(ETH('0.25'));
      await house.connect(owner).start(); // drop #1 opens at 0.25
      expect(await house.minNextBid()).to.equal(ETH('0.25'));
      await house.connect(guardian).setMinOpeningBid(ETH('0.001')); // next (v67) back to 0.001
      const c = await cur(house);
      await house.connect(a).createBid(dropAddr, 1, { value: ETH('0.25') });
      await time.increaseTo(c.endTime);
      await house.connect(a).settleCurrentAndCreateNewAuction();
      const n = await cur(house);
      expect(n.collection).to.equal(await nft.getAddress());
      expect(await house.minNextBid()).to.equal(ETH('0.001'));
    });
  });
});
