import { ethers } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Points } from '../typechain-types';

describe('Points', function () {
  let points: Points;
  let admin: HardhatEthersSigner;
  let manager: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  let POINTS_MANAGER_ROLE: string;
  let DEFAULT_ADMIN_ROLE: string;

  beforeEach(async () => {
    [admin, manager, user1, user2] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    POINTS_MANAGER_ROLE = await points.POINTS_MANAGER_ROLE();
    DEFAULT_ADMIN_ROLE = await points.DEFAULT_ADMIN_ROLE();

    // Grant manager role to a separate account
    await points.grantManager(manager.address);
  });

  describe('Deployment', () => {
    it('Should set deployer as DEFAULT_ADMIN_ROLE', async () => {
      expect(await points.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it('Should set deployer as POINTS_MANAGER_ROLE', async () => {
      expect(await points.hasRole(POINTS_MANAGER_ROLE, admin.address)).to.be.true;
    });

    it('Should set initial multiplier to 1', async () => {
      expect(await points.multiplier()).to.equal(1);
    });
  });

  describe('addPoints', () => {
    it('Should allow manager to add points', async () => {
      await expect(points.connect(manager).addPoints(user1.address, 67))
        .to.emit(points, 'PointsAdded')
        .withArgs(user1.address, 67);

      expect(await points.points(user1.address)).to.equal(67);
    });

    it('Should apply multiplier when adding points', async () => {
      await points.changeMultiplier(3);
      await points.connect(manager).addPoints(user1.address, 67);
      expect(await points.points(user1.address)).to.equal(201); // 67 * 3
    });

    it('Should revert when non-manager calls addPoints', async () => {
      await expect(points.connect(user1).addPoints(user1.address, 67))
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });

    it('Should revert when paused', async () => {
      await points.pause();
      await expect(points.connect(manager).addPoints(user1.address, 67))
        .to.be.revertedWithCustomError(points, 'EnforcedPause');
    });
  });

  describe('removePoints', () => {
    beforeEach(async () => {
      await points.connect(manager).addPoints(user1.address, 100);
    });

    it('Should allow admin to remove points', async () => {
      await expect(points.removePoints(user1.address, 50))
        .to.emit(points, 'PointsRemoved')
        .withArgs(user1.address, 50);

      expect(await points.points(user1.address)).to.equal(50);
    });

    it('Should revert on insufficient points', async () => {
      await expect(points.removePoints(user1.address, 200))
        .to.be.revertedWith('Insufficient points');
    });

    it('Should revert when non-admin calls removePoints', async () => {
      await expect(points.connect(user1).removePoints(user1.address, 50))
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('drainPoints', () => {
    it('Should allow admin to drain points to 0', async () => {
      await points.connect(manager).addPoints(user1.address, 100);
      await points.drainPoints(user1.address);
      expect(await points.points(user1.address)).to.equal(0);
    });

    it('Should revert when non-admin calls drainPoints', async () => {
      await expect(points.connect(user1).drainPoints(user1.address))
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('transferPoints', () => {
    beforeEach(async () => {
      await points.connect(manager).addPoints(user1.address, 100);
    });

    it('Should allow user to transfer own points', async () => {
      await expect(points.connect(user1).transferPoints(user2.address, 40))
        .to.emit(points, 'PointsTransferred')
        .withArgs(user1.address, user2.address, 40);

      expect(await points.points(user1.address)).to.equal(60);
      expect(await points.points(user2.address)).to.equal(40);
    });

    it('Should revert on insufficient balance', async () => {
      await expect(points.connect(user1).transferPoints(user2.address, 200))
        .to.be.revertedWith('Insufficient points');
    });

    it('Should revert when paused', async () => {
      await points.pause();
      await expect(points.connect(user1).transferPoints(user2.address, 40))
        .to.be.revertedWithCustomError(points, 'EnforcedPause');
    });
  });

  describe('Roles', () => {
    it('Should allow admin to grant manager role', async () => {
      await points.grantManager(user1.address);
      expect(await points.hasRole(POINTS_MANAGER_ROLE, user1.address)).to.be.true;
    });

    it('Should allow admin to revoke manager role', async () => {
      await points.revokeManager(manager.address);
      expect(await points.hasRole(POINTS_MANAGER_ROLE, manager.address)).to.be.false;
    });

    it('Should not allow non-admin to grant manager role', async () => {
      await expect(points.connect(user1).grantManager(user2.address))
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });

    it('Should not allow renouncing DEFAULT_ADMIN_ROLE', async () => {
      await expect(points.renounceRole(DEFAULT_ADMIN_ROLE, admin.address))
        .to.be.revertedWith('Cannot renounce admin role');
    });

    it('Should allow renouncing POINTS_MANAGER_ROLE', async () => {
      await points.connect(manager).renounceRole(POINTS_MANAGER_ROLE, manager.address);
      expect(await points.hasRole(POINTS_MANAGER_ROLE, manager.address)).to.be.false;
    });
  });

  describe('Multiplier', () => {
    it('Should allow admin to change multiplier', async () => {
      await points.changeMultiplier(5);
      expect(await points.multiplier()).to.equal(5);
    });

    it('Should revert when non-admin changes multiplier', async () => {
      await expect(points.connect(user1).changeMultiplier(5))
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('Pausable', () => {
    it('Should allow admin to pause and unpause', async () => {
      await points.pause();
      expect(await points.paused()).to.be.true;

      await points.unpause();
      expect(await points.paused()).to.be.false;
    });

    it('Should revert when non-admin pauses', async () => {
      await expect(points.connect(user1).pause())
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });

    it('Should revert when non-admin unpauses', async () => {
      await points.pause();
      await expect(points.connect(user1).unpause())
        .to.be.revertedWithCustomError(points, 'AccessControlUnauthorizedAccount');
    });
  });
});
