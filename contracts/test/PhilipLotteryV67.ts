import { ethers, upgrades } from 'hardhat';
import hre from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { PhilipLotteryV67, Points } from '../typechain-types';
import { mineBlocks, createHashId, depositEthscription, depositMultipleEthscriptions } from './helpers';

describe('PhilipLotteryV67', function () {
  let lottery: PhilipLotteryV67;
  let points: Points;

  let owner: HardhatEthersSigner;
  let player: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const playPrice = ethers.parseEther('0.01');

  // Prize hash IDs
  const prizes = Array.from({ length: 5 }, (_, i) => createHashId(`prize-${i}`));

  beforeEach(async () => {
    [owner, player, treasury, other] = await ethers.getSigners();

    // Deploy Points
    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    // Deploy Lottery proxy
    const LotteryFactory = await ethers.getContractFactory('PhilipLotteryV67');
    const proxy = await upgrades.deployProxy(
      LotteryFactory,
      [playPrice, await points.getAddress(), treasury.address],
      { initializer: 'initialize' },
    );
    lottery = LotteryFactory.attach(await proxy.getAddress()) as PhilipLotteryV67;
    await lottery.waitForDeployment();

    // Grant POINTS_MANAGER_ROLE to lottery
    await points.grantManager(await lottery.getAddress());

    // Owner deposits 5 prizes into pool
    await depositMultipleEthscriptions(owner, await lottery.getAddress(), prizes);
  });

  describe('Initialization', () => {
    it('Should set owner correctly', async () => {
      expect(await lottery.owner()).to.equal(owner.address);
    });

    it('Should set playPrice', async () => {
      expect(await lottery.playPrice()).to.equal(playPrice);
    });

    it('Should set treasury address', async () => {
      expect(await lottery.treasuryAddress()).to.equal(treasury.address);
    });

    it('Should set points address', async () => {
      expect(await lottery.pointsAddress()).to.equal(await points.getAddress());
    });

    it('Should be active by default', async () => {
      expect(await lottery.active()).to.be.true;
    });

    it('Should have 5 items in pool after deposits', async () => {
      expect(await lottery.poolSize()).to.equal(5);
    });

    it('Should mark deposited items in pool', async () => {
      for (const prize of prizes) {
        expect(await lottery.inPool(prize)).to.be.true;
      }
    });
  });

  describe('commitPlay', () => {
    it('Should commit with correct payment', async () => {
      await expect(lottery.connect(player).commitPlay({ value: playPrice }))
        .to.emit(lottery, 'PlayCommitted');
    });

    it('Should record commitment correctly', async () => {
      await lottery.connect(player).commitPlay({ value: playPrice });
      const [commitBlock, priceLocked] = await lottery.getCommitment(player.address);
      expect(commitBlock).to.be.gt(0);
      expect(priceLocked).to.equal(playPrice);
    });

    it('Should increment pendingReveals', async () => {
      await lottery.connect(player).commitPlay({ value: playPrice });
      expect(await lottery.pendingReveals()).to.equal(1);
    });

    it('Should revert with insufficient ETH', async () => {
      await expect(
        lottery.connect(player).commitPlay({ value: ethers.parseEther('0.001') }),
      ).to.be.revertedWith('Insufficient payment');
    });

    it('Should revert when already committed', async () => {
      await lottery.connect(player).commitPlay({ value: playPrice });
      await expect(
        lottery.connect(player).commitPlay({ value: playPrice }),
      ).to.be.revertedWith('Already committed');
    });

    it('Should revert when paused', async () => {
      await lottery.pause();
      await expect(
        lottery.connect(player).commitPlay({ value: playPrice }),
      ).to.be.revertedWithCustomError(lottery, 'EnforcedPause');
    });

    it('Should revert when inactive', async () => {
      await lottery.setActive(false);
      await expect(
        lottery.connect(player).commitPlay({ value: playPrice }),
      ).to.be.revertedWith('Lottery inactive');
    });

    it('Should refund overpayment', async () => {
      const overpay = playPrice + ethers.parseEther('0.05');
      const balBefore = await ethers.provider.getBalance(player.address);
      const tx = await lottery.connect(player).commitPlay({ value: overpay });
      const receipt = await tx.wait();
      const balAfter = await ethers.provider.getBalance(player.address);

      // Player should have spent approximately playPrice + gas (not the overpay)
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const spent = balBefore - balAfter - gasUsed;
      expect(spent).to.be.closeTo(playPrice, ethers.parseEther('0.001'));
    });

    it('Should revert when pool is empty (minus pending)', async () => {
      // Commit 5 players to exhaust available pool
      const signers = await ethers.getSigners();
      for (let i = 0; i < 5; i++) {
        await lottery.connect(signers[i + 4]).commitPlay({ value: playPrice });
      }
      // 6th commit should fail (5 pool items - 5 pending = 0 available)
      await expect(
        lottery.connect(player).commitPlay({ value: playPrice }),
      ).to.be.revertedWith('No prizes available');
    });
  });

  describe('revealPlay', () => {
    beforeEach(async () => {
      await lottery.connect(player).commitPlay({ value: playPrice });
    });

    it('Should complete full happy path: commit → mine → reveal', async () => {
      await mineBlocks(3);

      const poolBefore = await lottery.poolSize();
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const tx = await lottery.connect(player).revealPlay();
      await tx.wait();

      // Pool decreased
      expect(await lottery.poolSize()).to.equal(poolBefore - 1n);

      // Treasury received payment
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(playPrice);

      // totalPlays incremented
      expect(await lottery.totalPlays()).to.equal(1);
      expect(await lottery.totalRevealed()).to.equal(1);
    });

    it('Should emit PrizeAwarded event', async () => {
      await mineBlocks(3);
      await expect(lottery.connect(player).revealPlay())
        .to.emit(lottery, 'PrizeAwarded');
    });

    it('Should award 67 points to winner', async () => {
      await mineBlocks(3);
      await lottery.connect(player).revealPlay();
      expect(await points.points(player.address)).to.equal(67);
    });

    it('Should increment playerPlays', async () => {
      await mineBlocks(3);
      await lottery.connect(player).revealPlay();
      expect(await lottery.playerPlays(player.address)).to.equal(1);
    });

    it('Should clear commitment after reveal', async () => {
      await mineBlocks(3);
      await lottery.connect(player).revealPlay();
      const [commitBlock] = await lottery.getCommitment(player.address);
      expect(commitBlock).to.equal(0);
    });

    it('Should revert if too early (< REVEAL_DELAY blocks)', async () => {
      await expect(lottery.connect(player).revealPlay())
        .to.be.revertedWith('Too early');
    });

    it('Should revert if no commitment exists', async () => {
      await expect(lottery.connect(other).revealPlay())
        .to.be.revertedWith('No commitment');
    });
  });

  describe('cancelPlay', () => {
    beforeEach(async () => {
      await lottery.connect(player).commitPlay({ value: playPrice });
    });

    it('Should refund after expiry', async () => {
      await mineBlocks(257);
      const balBefore = await ethers.provider.getBalance(player.address);
      const tx = await lottery.connect(player).cancelPlay();
      const receipt = await tx.wait();
      const balAfter = await ethers.provider.getBalance(player.address);

      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      expect(balAfter - balBefore + gasUsed).to.equal(playPrice);
    });

    it('Should emit PlayCancelled', async () => {
      await mineBlocks(257);
      await expect(lottery.connect(player).cancelPlay())
        .to.emit(lottery, 'PlayCancelled')
        .withArgs(player.address);
    });

    it('Should decrement pendingReveals', async () => {
      await mineBlocks(257);
      expect(await lottery.pendingReveals()).to.equal(1);
      await lottery.connect(player).cancelPlay();
      expect(await lottery.pendingReveals()).to.equal(0);
    });

    it('Should revert if not expired yet', async () => {
      await mineBlocks(100);
      await expect(lottery.connect(player).cancelPlay())
        .to.be.revertedWith('Not expired');
    });

    it('Should revert if no commitment exists', async () => {
      await expect(lottery.connect(other).cancelPlay())
        .to.be.revertedWith('No commitment');
    });

    it('Should allow player to commitPlay again after cancel', async () => {
      await mineBlocks(257);
      await lottery.connect(player).cancelPlay();
      await expect(lottery.connect(player).commitPlay({ value: playPrice }))
        .to.emit(lottery, 'PlayCommitted');
    });
  });

  describe('Pool management (owner)', () => {
    it('Should allow owner to deposit ethscriptions via fallback', async () => {
      const newHash = createHashId('new-prize');
      await depositEthscription(owner, await lottery.getAddress(), newHash);
      expect(await lottery.inPool(newHash)).to.be.true;
      expect(await lottery.poolSize()).to.equal(6);
    });

    it('Should revert deposit from non-owner', async () => {
      const newHash = createHashId('non-owner-prize');
      await expect(
        depositEthscription(player, await lottery.getAddress(), newHash),
      ).to.be.revertedWith('Only owner can deposit');
    });

    it('Should allow owner to withdrawPrize', async () => {
      await expect(lottery.withdrawPrize(prizes[0]))
        .to.emit(lottery, 'PrizeWithdrawn')
        .withArgs(prizes[0]);
      expect(await lottery.inPool(prizes[0])).to.be.false;
      expect(await lottery.poolSize()).to.equal(4);
    });

    it('Should allow owner to withdrawPrizeBatch', async () => {
      const batch = [prizes[0], prizes[1]];
      await lottery.withdrawPrizeBatch(batch);
      expect(await lottery.poolSize()).to.equal(3);
    });

    it('Should allow owner to emergencyWithdrawEthscription', async () => {
      await lottery.emergencyWithdrawEthscription(prizes[0]);
      expect(await lottery.inPool(prizes[0])).to.be.false;
    });

    it('Should not allow withdrawPrize if would strand pending reveals', async () => {
      // Commit 5 players to exhaust pool
      const signers = await ethers.getSigners();
      for (let i = 0; i < 5; i++) {
        await lottery.connect(signers[i + 4]).commitPlay({ value: playPrice });
      }
      await expect(lottery.withdrawPrize(prizes[0]))
        .to.be.revertedWith('Reserved for pending reveals');
    });
  });

  describe('Admin functions', () => {
    it('Should allow owner to setPrice', async () => {
      const newPrice = ethers.parseEther('0.02');
      await expect(lottery.setPrice(newPrice))
        .to.emit(lottery, 'PriceSet')
        .withArgs(newPrice);
      expect(await lottery.playPrice()).to.equal(newPrice);
    });

    it('Should revert setPrice with 0', async () => {
      await expect(lottery.setPrice(0))
        .to.be.revertedWith('Price must be > 0');
    });

    it('Should allow owner to setActive', async () => {
      await expect(lottery.setActive(false))
        .to.emit(lottery, 'ActiveToggled')
        .withArgs(false);
      expect(await lottery.active()).to.be.false;
    });

    it('Should allow owner to setTreasuryAddress', async () => {
      await expect(lottery.setTreasuryAddress(other.address))
        .to.emit(lottery, 'TreasuryAddressChanged')
        .withArgs(treasury.address, other.address);
    });

    it('Should revert setTreasuryAddress with zero address', async () => {
      await expect(lottery.setTreasuryAddress(ethers.ZeroAddress))
        .to.be.revertedWith('Invalid treasury');
    });

    it('Should allow owner to setPointsAddress', async () => {
      await expect(lottery.setPointsAddress(other.address))
        .to.emit(lottery, 'PointsAddressChanged');
    });

    it('Should revert renounceOwnership', async () => {
      await expect(lottery.renounceOwnership())
        .to.be.revertedWith('Cannot renounce ownership');
    });

    it('Should revert admin functions from non-owner', async () => {
      await expect(lottery.connect(player).setPrice(1))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
      await expect(lottery.connect(player).setActive(false))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
      await expect(lottery.connect(player).setTreasuryAddress(player.address))
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Hybrid refunds (push/pull)', () => {
    it('Should accumulate pendingReturns if push refund fails', async () => {
      // Set treasury to a contract that rejects ETH
      const RejectFactory = await ethers.getContractFactory('MockRejectETH');
      const treasuryRejecter = await RejectFactory.deploy();
      await treasuryRejecter.waitForDeployment();
      await lottery.setTreasuryAddress(await treasuryRejecter.getAddress());

      // Commit and reveal — treasury can't receive ETH, should go to pendingReturns
      await lottery.connect(player).commitPlay({ value: playPrice });
      await mineBlocks(3);
      await lottery.connect(player).revealPlay();

      expect(await lottery.pendingReturns(await treasuryRejecter.getAddress())).to.equal(playPrice);
    });
  });

  describe('View functions', () => {
    it('Should return pool items with getPoolItems', async () => {
      const items = await lottery.getPoolItems(0, 5);
      expect(items.length).to.equal(5);
    });

    it('Should return balance with getBalance', async () => {
      await lottery.connect(player).commitPlay({ value: playPrice });
      expect(await lottery.getBalance()).to.equal(playPrice);
    });

    it('Should handle getPoolItems with offset beyond pool', async () => {
      const items = await lottery.getPoolItems(100, 5);
      expect(items.length).to.equal(0);
    });
  });

  describe('Pausable', () => {
    it('Should allow owner to pause and unpause', async () => {
      await lottery.pause();
      expect(await lottery.paused()).to.be.true;

      await lottery.unpause();
      expect(await lottery.paused()).to.be.false;
    });

    it('Should revert non-owner pause', async () => {
      await expect(lottery.connect(player).pause())
        .to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
    });
  });
});
