import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { createHashId, depositMultipleEthscriptions } from './helpers';

describe('Proxy Upgrades', function () {
  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, other, treasury] = await ethers.getSigners();
  });

  describe('PhilipLotteryV67 Proxy', () => {
    it('Should deploy behind proxy and initialize once', async () => {
      const Factory = await ethers.getContractFactory('PhilipLotteryV67');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [ethers.parseEther('0.01'), await points.getAddress(), treasury.address],
        { initializer: 'initialize' },
      );
      const lottery = Factory.attach(await proxy.getAddress());

      expect(await lottery.owner()).to.equal(owner.address);
      expect(await lottery.playPrice()).to.equal(ethers.parseEther('0.01'));
    });

    it('Should block re-initialization', async () => {
      const Factory = await ethers.getContractFactory('PhilipLotteryV67');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [ethers.parseEther('0.01'), await points.getAddress(), treasury.address],
        { initializer: 'initialize' },
      );
      const lottery = Factory.attach(await proxy.getAddress());

      await expect(
        lottery.initialize(ethers.parseEther('0.02'), await points.getAddress(), treasury.address),
      ).to.be.revertedWithCustomError(lottery, 'InvalidInitialization');
    });

    it('Should preserve storage after upgrade', async () => {
      const Factory = await ethers.getContractFactory('PhilipLotteryV67');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [ethers.parseEther('0.01'), await points.getAddress(), treasury.address],
        { initializer: 'initialize' },
      );
      const lottery = Factory.attach(await proxy.getAddress());

      // Set some state
      await lottery.setPrice(ethers.parseEther('0.05'));
      await lottery.setActive(false);

      // Deposit a prize
      const prize = createHashId('upgrade-prize');
      await owner.sendTransaction({ to: await proxy.getAddress(), data: prize });

      // Upgrade to same implementation (simulates upgrade)
      const FactoryV2 = await ethers.getContractFactory('PhilipLotteryV67');
      const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2);

      // Verify storage preserved
      expect(await upgraded.playPrice()).to.equal(ethers.parseEther('0.05'));
      expect(await upgraded.active()).to.be.false;
      expect(await upgraded.owner()).to.equal(owner.address);
      expect(await upgraded.poolSize()).to.equal(1);
      expect(await upgraded.inPool(prize)).to.be.true;
    });
  });

  describe('EthsRocks Proxy', () => {
    it('Should deploy behind proxy and initialize once', async () => {
      const Factory = await ethers.getContractFactory('EthsRocks');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();
      const ERC721Factory = await ethers.getContractFactory('MockERC721');
      const nft1 = await ERC721Factory.deploy('A', 'A');
      const nft2 = await ERC721Factory.deploy('B', 'B');
      const nft3 = await ERC721Factory.deploy('C', 'C');

      const proxy = await upgrades.deployProxy(
        Factory,
        [treasury.address, await points.getAddress(), ethers.ZeroHash, await nft1.getAddress(), await nft2.getAddress(), await nft3.getAddress()],
        { initializer: 'initialize' },
      );
      const rocks = Factory.attach(await proxy.getAddress());

      expect(await rocks.owner()).to.equal(owner.address);
      expect(await rocks.treasuryAddress()).to.equal(treasury.address);
    });

    it('Should block re-initialization', async () => {
      const Factory = await ethers.getContractFactory('EthsRocks');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();
      const ERC721Factory = await ethers.getContractFactory('MockERC721');
      const nft1 = await ERC721Factory.deploy('A', 'A');
      const nft2 = await ERC721Factory.deploy('B', 'B');
      const nft3 = await ERC721Factory.deploy('C', 'C');

      const proxy = await upgrades.deployProxy(
        Factory,
        [treasury.address, await points.getAddress(), ethers.ZeroHash, await nft1.getAddress(), await nft2.getAddress(), await nft3.getAddress()],
        { initializer: 'initialize' },
      );
      const rocks = Factory.attach(await proxy.getAddress());

      await expect(
        rocks.initialize(treasury.address, await points.getAddress(), ethers.ZeroHash, await nft1.getAddress(), await nft2.getAddress(), await nft3.getAddress()),
      ).to.be.revertedWithCustomError(rocks, 'InvalidInitialization');
    });

    it('Should preserve storage after upgrade', async () => {
      const Factory = await ethers.getContractFactory('EthsRocks');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();
      const ERC721Factory = await ethers.getContractFactory('MockERC721');
      const nft1 = await ERC721Factory.deploy('A', 'A');
      const nft2 = await ERC721Factory.deploy('B', 'B');
      const nft3 = await ERC721Factory.deploy('C', 'C');

      const proxy = await upgrades.deployProxy(
        Factory,
        [treasury.address, await points.getAddress(), ethers.ZeroHash, await nft1.getAddress(), await nft2.getAddress(), await nft3.getAddress()],
        { initializer: 'initialize' },
      );
      const rocks = Factory.attach(await proxy.getAddress());

      // Set state
      await rocks.setSignerAddress(other.address);
      const rockHash = createHashId('upgrade-rock');
      await owner.sendTransaction({ to: await proxy.getAddress(), data: rockHash });

      // Upgrade
      const FactoryV2 = await ethers.getContractFactory('EthsRocks');
      const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2);

      expect(await upgraded.signerAddress()).to.equal(other.address);
      expect(await upgraded.poolSize()).to.equal(1);
      expect(await upgraded.owner()).to.equal(owner.address);
      expect(await upgraded.treasuryAddress()).to.equal(treasury.address);
    });
  });

  describe('EtherPhunksEvolve (Mutation) Proxy', () => {
    it('Should deploy behind proxy and initialize once', async () => {
      const Factory = await ethers.getContractFactory('Mutation');
      const proxy = await upgrades.deployProxy(Factory, [ethers.parseEther('0.005')], { initializer: 'initialize' });
      const evolve = Factory.attach(await proxy.getAddress());

      expect(await evolve.owner()).to.equal(owner.address);
      expect(await evolve.evolveFee()).to.equal(ethers.parseEther('0.005'));
    });

    it('Should block re-initialization', async () => {
      const Factory = await ethers.getContractFactory('Mutation');
      const proxy = await upgrades.deployProxy(Factory, [ethers.parseEther('0.005')], { initializer: 'initialize' });
      const evolve = Factory.attach(await proxy.getAddress());

      await expect(
        evolve.initialize(ethers.parseEther('0.01')),
      ).to.be.revertedWithCustomError(evolve, 'InvalidInitialization');
    });

    it('Should preserve storage after upgrade', async () => {
      const Factory = await ethers.getContractFactory('Mutation');
      const proxy = await upgrades.deployProxy(Factory, [ethers.parseEther('0.005')], { initializer: 'initialize' });
      const evolve = Factory.attach(await proxy.getAddress());

      // Register pairs and set fee
      const og = [createHashId('up-og-0')];
      const q = [createHashId('up-q-0')];
      await evolve.registerPairs(og, q);
      await evolve.setFee(ethers.parseEther('0.01'));

      // Upgrade
      const FactoryV2 = await ethers.getContractFactory('Mutation');
      const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2);

      expect(await upgraded.evolveFee()).to.equal(ethers.parseEther('0.01'));
      expect(await upgraded.pairCount()).to.equal(1);
      expect(await upgraded.owner()).to.equal(owner.address);
      expect(await upgraded.isOg(og[0])).to.be.true;
      expect(await upgraded.registered(q[0])).to.be.true;
    });
  });

  describe('EtherPhunksAuctionHouseV2 Proxy', () => {
    it('Should deploy behind proxy and initialize once', async () => {
      const Factory = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [3600, 300, 5, ethers.parseEther('0.01'), await points.getAddress(), treasury.address],
        { initializer: 'initialize' },
      );
      const auction = Factory.attach(await proxy.getAddress());

      expect(await auction.owner()).to.equal(owner.address);
      expect(await auction.duration()).to.equal(3600);
    });

    it('Should block re-initialization', async () => {
      const Factory = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [3600, 300, 5, ethers.parseEther('0.01'), await points.getAddress(), treasury.address],
        { initializer: 'initialize' },
      );
      const auction = Factory.attach(await proxy.getAddress());

      await expect(
        auction.initialize(7200, 600, 10, ethers.parseEther('0.02'), await points.getAddress(), treasury.address),
      ).to.be.revertedWithCustomError(auction, 'InvalidInitialization');
    });

    it('Should preserve storage after upgrade', async () => {
      const Factory = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [3600, 300, 5, ethers.parseEther('0.01'), await points.getAddress(), treasury.address],
        { initializer: 'initialize' },
      );
      const auction = Factory.attach(await proxy.getAddress());

      // Set state
      await auction.setDuration(7200);
      await auction.setReservePrice(ethers.parseEther('0.05'));
      const item = createHashId('auction-upgrade');
      await owner.sendTransaction({ to: await proxy.getAddress(), data: item });

      // Upgrade
      const FactoryV2 = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
      const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2);

      expect(await upgraded.duration()).to.equal(7200);
      expect(await upgraded.reservePrice()).to.equal(ethers.parseEther('0.05'));
      expect(await upgraded.poolSize()).to.equal(1);
      expect(await upgraded.owner()).to.equal(owner.address);
    });
  });

  describe('EtherPhunksMarketV3 Proxy', () => {
    it('Should deploy behind proxy and initialize once', async () => {
      const Factory = await ethers.getContractFactory('EtherPhunksMarketV3');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [3, await points.getAddress(), 367, treasury.address],
        { initializer: 'initialize' },
      );
      const market = Factory.attach(await proxy.getAddress());

      expect(await market.owner()).to.equal(owner.address);
      expect(await market.contractVersion()).to.equal(3);
      expect(await market.royaltyBps()).to.equal(367);
    });

    it('Should block re-initialization', async () => {
      const Factory = await ethers.getContractFactory('EtherPhunksMarketV3');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [3, await points.getAddress(), 367, treasury.address],
        { initializer: 'initialize' },
      );
      const market = Factory.attach(await proxy.getAddress());

      await expect(
        market.initialize(4, await points.getAddress(), 500, treasury.address),
      ).to.be.revertedWithCustomError(market, 'InvalidInitialization');
    });

    it('Should preserve storage after upgrade', async () => {
      const Factory = await ethers.getContractFactory('EtherPhunksMarketV3');
      const PointsFactory = await ethers.getContractFactory('Points');
      const points = await PointsFactory.deploy();

      const proxy = await upgrades.deployProxy(
        Factory,
        [3, await points.getAddress(), 367, treasury.address],
        { initializer: 'initialize' },
      );
      const market = Factory.attach(await proxy.getAddress());

      // Set state
      await market.setRoyaltyBps(500);
      await market.setRoyaltyReceiver(other.address);

      // Deposit a phunk
      const phunkId = createHashId('upgrade-phunk');
      await owner.sendTransaction({ to: await proxy.getAddress(), data: phunkId });

      // Upgrade
      const FactoryV2 = await ethers.getContractFactory('EtherPhunksMarketV3');
      const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2);

      expect(await upgraded.royaltyBps()).to.equal(500);
      expect(await upgraded.royaltyReceiver()).to.equal(other.address);
      expect(await upgraded.owner()).to.equal(owner.address);
      expect(await upgraded.contractVersion()).to.equal(3);
      expect(await upgraded.userEthscriptionPossiblyStored(owner.address, phunkId)).to.be.true;
    });
  });
});
