import { ethers, upgrades } from 'hardhat';
import hre from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EthsRocks, Points, MockERC721 } from '../typechain-types';
import { mineBlocks, createHashId, depositMultipleEthscriptions } from './helpers';

describe('EthsRocks', function () {
  let rocks: EthsRocks;
  let points: Points;
  let philipIntern: MockERC721;
  let wrappedV1: MockERC721;
  let cryptoPhunksV2: MockERC721;

  let owner: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let signer: HardhatEthersSigner; // used to sign eligibility
  let other: HardhatEthersSigner;

  const merkleRoot = ethers.ZeroHash;

  // Rock pool items
  const rockHashes = Array.from({ length: 5 }, (_, i) => createHashId(`rock-${i}`));

  // Ethscription hashes for commit
  const missingPhunkHash = createHashId('missing-phunk-1');
  const quantumDystoHash = createHashId('quantum-dysto-1');
  const quantumPhunkHash = createHashId('quantum-phunk-1');

  // ERC-721 token IDs
  const philipTokenId = 1;
  const cryptoPhunksTokenId = 2;

  async function getAddr() {
    return rocks.getAddress();
  }

  async function generateSignature(
    buyerAddr: string,
    mpHash: string,
    qdHash: string,
    qpHash: string,
    philipId: number,
    usePhilipIntern: boolean,
    cpV2Id: number,
    deadline: number,
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const contractAddr = await getAddr();

    const dataHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bool', 'uint256', 'uint256', 'uint256', 'address'],
        [buyerAddr, mpHash, qdHash, qpHash, philipId, usePhilipIntern, cpV2Id, deadline, chainId, contractAddr],
      ),
    );

    const ethSignedHash = ethers.hashMessage(ethers.getBytes(dataHash));
    const sig = await signer.signMessage(ethers.getBytes(dataHash));
    return sig;
  }

  beforeEach(async () => {
    [owner, buyer, treasury, signer, other] = await ethers.getSigners();

    // Deploy Points
    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    // Deploy MockERC721s
    const ERC721Factory = await ethers.getContractFactory('MockERC721');
    philipIntern = (await ERC721Factory.deploy('PhilipIntern', 'PI')) as MockERC721;
    wrappedV1 = (await ERC721Factory.deploy('WrappedV1', 'WV1')) as MockERC721;
    cryptoPhunksV2 = (await ERC721Factory.deploy('CryptoPhunksV2', 'CPV2')) as MockERC721;

    // Deploy EthsRocks proxy
    const RocksFactory = await ethers.getContractFactory('EthsRocks');
    const proxy = await upgrades.deployProxy(
      RocksFactory,
      [
        treasury.address,
        await points.getAddress(),
        merkleRoot,
        await philipIntern.getAddress(),
        await wrappedV1.getAddress(),
        await cryptoPhunksV2.getAddress(),
      ],
      { initializer: 'initialize' },
    );
    rocks = RocksFactory.attach(await proxy.getAddress()) as EthsRocks;
    await rocks.waitForDeployment();

    // Set signer address
    await rocks.setSignerAddress(signer.address);

    // Grant POINTS_MANAGER_ROLE to rocks
    await points.grantManager(await rocks.getAddress());

    // Owner deposits 5 rocks into pool
    await depositMultipleEthscriptions(owner, await getAddr(), rockHashes);

    // Mint ERC-721 tokens to buyer
    await philipIntern.mint(buyer.address, philipTokenId);
    await cryptoPhunksV2.mint(buyer.address, cryptoPhunksTokenId);
  });

  describe('Initialization', () => {
    it('Should set owner correctly', async () => {
      expect(await rocks.owner()).to.equal(owner.address);
    });

    it('Should set treasury address', async () => {
      expect(await rocks.treasuryAddress()).to.equal(treasury.address);
    });

    it('Should set points address', async () => {
      expect(await rocks.pointsAddress()).to.equal(await points.getAddress());
    });

    it('Should set signer address', async () => {
      expect(await rocks.signerAddress()).to.equal(signer.address);
    });

    it('Should have 5 items in pool', async () => {
      expect(await rocks.poolSize()).to.equal(5);
    });

    it('Should set ERC-721 addresses', async () => {
      expect(await rocks.philipInternAddress()).to.equal(await philipIntern.getAddress());
      expect(await rocks.wrappedV1Address()).to.equal(await wrappedV1.getAddress());
      expect(await rocks.cryptoPhunksV2Address()).to.equal(await cryptoPhunksV2.getAddress());
    });
  });

  describe('commit', () => {
    it('Should commit with valid signature and tokens', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();
      const maxPrice = price * 2n;

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await expect(
        rocks.connect(buyer).commit(
          sig, deadline, maxPrice,
          missingPhunkHash, quantumDystoHash, quantumPhunkHash,
          philipTokenId, true, cryptoPhunksTokenId,
          { value: price },
        ),
      ).to.emit(rocks, 'RockCommitted');

      expect(await rocks.pendingReveals()).to.equal(1);
    });

    it('Should escalate price: first = BASE_PRICE*1, second = BASE_PRICE*2', async () => {
      const BASE_PRICE = await rocks.BASE_PRICE();
      expect(await rocks.currentPrice()).to.equal(BASE_PRICE * 1n);

      // After one pending reveal, price should be BASE_PRICE * 2
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();
      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );
      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );

      expect(await rocks.currentPrice()).to.equal(BASE_PRICE * 2n);
    });

    it('Should revert with expired deadline', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp - 1;
      const price = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await expect(
        rocks.connect(buyer).commit(
          sig, deadline, price,
          missingPhunkHash, quantumDystoHash, quantumPhunkHash,
          philipTokenId, true, cryptoPhunksTokenId,
          { value: price },
        ),
      ).to.be.revertedWith('Signature expired');
    });

    it('Should revert with insufficient ETH', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await expect(
        rocks.connect(buyer).commit(
          sig, deadline, price,
          missingPhunkHash, quantumDystoHash, quantumPhunkHash,
          philipTokenId, true, cryptoPhunksTokenId,
          { value: 0 },
        ),
      ).to.be.revertedWith('Insufficient payment');
    });

    it('Should mark ethscription hashes as used', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );

      expect(await rocks.usedEthscription(missingPhunkHash)).to.be.true;
      expect(await rocks.usedEthscription(quantumDystoHash)).to.be.true;
      expect(await rocks.usedEthscription(quantumPhunkHash)).to.be.true;
    });

    it('Should mark ERC-721 tokens as used', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );

      expect(await rocks.usedERC721(await philipIntern.getAddress(), philipTokenId)).to.be.true;
      expect(await rocks.usedERC721(await cryptoPhunksV2.getAddress(), cryptoPhunksTokenId)).to.be.true;
    });

    it('Should revert when already committed', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );

      // Try to commit again
      const newMissing = createHashId('missing-phunk-2');
      const newDysto = createHashId('quantum-dysto-2');
      const newPhunk = createHashId('quantum-phunk-2');
      await philipIntern.mint(buyer.address, 10);
      await cryptoPhunksV2.mint(buyer.address, 20);

      const sig2 = await generateSignature(
        buyer.address, newMissing, newDysto, newPhunk, 10, true, 20, deadline,
      );
      const price2 = await rocks.currentPrice();

      await expect(
        rocks.connect(buyer).commit(
          sig2, deadline, price2 * 10n,
          newMissing, newDysto, newPhunk,
          10, true, 20,
          { value: price2 },
        ),
      ).to.be.revertedWith('Already committed');
    });
  });

  describe('reveal', () => {
    beforeEach(async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );
    });

    it('Should reveal successfully after REVEAL_DELAY', async () => {
      await mineBlocks(3);

      const poolBefore = await rocks.poolSize();
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await expect(rocks.connect(buyer).reveal())
        .to.emit(rocks, 'RockPurchased');

      expect(await rocks.poolSize()).to.equal(poolBefore - 1n);
      expect(await rocks.totalRevealed()).to.equal(1);

      // Treasury received payment
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter).to.be.gt(treasuryBefore);
    });

    it('Should award 67 points to buyer', async () => {
      await mineBlocks(3);
      await rocks.connect(buyer).reveal();
      expect(await points.points(buyer.address)).to.equal(67);
    });

    it('Should clear commitment after reveal', async () => {
      await mineBlocks(3);
      await rocks.connect(buyer).reveal();
      const c = await rocks.commitments(buyer.address);
      expect(c.commitBlock).to.equal(0);
    });

    it('Should revert if too early', async () => {
      await expect(rocks.connect(buyer).reveal())
        .to.be.revertedWith('Too early');
    });

    it('Should revert if no commitment', async () => {
      await expect(rocks.connect(other).reveal())
        .to.be.revertedWith('No commitment');
    });
  });

  describe('cancelCommitment', () => {
    let lockedPrice: bigint;

    beforeEach(async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      lockedPrice = await rocks.currentPrice();

      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await rocks.connect(buyer).commit(
        sig, deadline, lockedPrice * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: lockedPrice },
      );
    });

    it('Should cancel and refund after expiry', async () => {
      await mineBlocks(257);

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await rocks.connect(buyer).cancelCommitment();
      const receipt = await tx.wait();
      const balAfter = await ethers.provider.getBalance(buyer.address);

      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      expect(balAfter - balBefore + gasUsed).to.equal(lockedPrice);
    });

    it('Should emit CommitmentCancelled', async () => {
      await mineBlocks(257);
      await expect(rocks.connect(buyer).cancelCommitment())
        .to.emit(rocks, 'CommitmentCancelled')
        .withArgs(buyer.address);
    });

    it('Should release used tokens', async () => {
      await mineBlocks(257);
      await rocks.connect(buyer).cancelCommitment();

      expect(await rocks.usedEthscription(missingPhunkHash)).to.be.false;
      expect(await rocks.usedEthscription(quantumDystoHash)).to.be.false;
      expect(await rocks.usedEthscription(quantumPhunkHash)).to.be.false;
      expect(await rocks.usedERC721(await philipIntern.getAddress(), philipTokenId)).to.be.false;
      expect(await rocks.usedERC721(await cryptoPhunksV2.getAddress(), cryptoPhunksTokenId)).to.be.false;
    });

    it('Should revert if not expired', async () => {
      await mineBlocks(100);
      await expect(rocks.connect(buyer).cancelCommitment())
        .to.be.revertedWith('Not expired');
    });

    it('Should revert if no commitment', async () => {
      await expect(rocks.connect(other).cancelCommitment())
        .to.be.revertedWith('No commitment');
    });
  });

  describe('Owner functions', () => {
    it('Should allow owner to withdrawFromPool', async () => {
      await expect(rocks.withdrawFromPool(rockHashes[0]))
        .to.emit(rocks, 'PoolWithdrawn')
        .withArgs(rockHashes[0]);
      expect(await rocks.poolSize()).to.equal(4);
    });

    it('Should allow owner to withdrawFromPoolBatch', async () => {
      await rocks.withdrawFromPoolBatch([rockHashes[0], rockHashes[1]]);
      expect(await rocks.poolSize()).to.equal(3);
    });

    it('Should allow owner to resetUsedERC721', async () => {
      // First mark it used via commit
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();
      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );
      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );

      expect(await rocks.usedERC721(await philipIntern.getAddress(), philipTokenId)).to.be.true;
      await rocks.resetUsedERC721(await philipIntern.getAddress(), philipTokenId);
      expect(await rocks.usedERC721(await philipIntern.getAddress(), philipTokenId)).to.be.false;
    });

    it('Should allow owner to resetUsedEthscription', async () => {
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();
      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );
      await rocks.connect(buyer).commit(
        sig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      );

      expect(await rocks.usedEthscription(missingPhunkHash)).to.be.true;
      await rocks.resetUsedEthscription(missingPhunkHash);
      expect(await rocks.usedEthscription(missingPhunkHash)).to.be.false;
    });

    it('Should allow owner to setSignerAddress', async () => {
      await rocks.setSignerAddress(other.address);
      expect(await rocks.signerAddress()).to.equal(other.address);
    });

    it('Should allow owner to setTreasuryAddress', async () => {
      await rocks.setTreasuryAddress(other.address);
      expect(await rocks.treasuryAddress()).to.equal(other.address);
    });

    it('Should revert setTreasuryAddress with zero', async () => {
      await expect(rocks.setTreasuryAddress(ethers.ZeroAddress))
        .to.be.revertedWith('Invalid treasury');
    });

    it('Should revert renounceOwnership', async () => {
      await expect(rocks.renounceOwnership())
        .to.be.revertedWith('Cannot renounce ownership');
    });

    it('Should revert non-owner admin calls', async () => {
      await expect(rocks.connect(buyer).setSignerAddress(buyer.address))
        .to.be.revertedWithCustomError(rocks, 'OwnableUnauthorizedAccount');
      await expect(rocks.connect(buyer).withdrawFromPool(rockHashes[0]))
        .to.be.revertedWithCustomError(rocks, 'OwnableUnauthorizedAccount');
    });
  });

  describe('View functions', () => {
    it('Should return currentPrice', async () => {
      const BASE_PRICE = await rocks.BASE_PRICE();
      // totalRevealed=0, pendingReveals=0 → price = BASE_PRICE * 1
      expect(await rocks.currentPrice()).to.equal(BASE_PRICE);
    });

    it('Should return pool items', async () => {
      const items = await rocks.getPoolItems(0, 5);
      expect(items.length).to.equal(5);
    });

    it('Should return balance', async () => {
      expect(await rocks.getBalance()).to.equal(0);
    });
  });

  describe('Pausable', () => {
    it('Should allow owner to pause/unpause', async () => {
      await rocks.pause();
      expect(await rocks.paused()).to.be.true;
      await rocks.unpause();
      expect(await rocks.paused()).to.be.false;
    });

    it('Should revert commit when paused', async () => {
      await rocks.pause();
      const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
      const price = await rocks.currentPrice();
      const sig = await generateSignature(
        buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId, deadline,
      );

      await expect(
        rocks.connect(buyer).commit(
          sig, deadline, price,
          missingPhunkHash, quantumDystoHash, quantumPhunkHash,
          philipTokenId, true, cryptoPhunksTokenId,
          { value: price },
        ),
      ).to.be.revertedWithCustomError(rocks, 'EnforcedPause');
    });
  });
});
