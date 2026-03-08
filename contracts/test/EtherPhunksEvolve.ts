import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Mutation } from '../typechain-types';
import { createHashId } from './helpers';

describe('EtherPhunksEvolve (Mutation)', function () {
  let evolve: Mutation;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const evolveFee = ethers.parseEther('0.005');

  // 3 pairs: OG ↔ Quantum
  const ogHashes = [createHashId('og-0'), createHashId('og-1'), createHashId('og-2')];
  const quantumHashes = [createHashId('quantum-0'), createHashId('quantum-1'), createHashId('quantum-2')];

  async function getAddr() {
    return evolve.getAddress();
  }

  async function ownerDepositAll() {
    // Owner deposits all 6 ethscriptions (3 OG + 3 Quantum)
    const allHashes = [...ogHashes, ...quantumHashes];
    const data = '0x' + allHashes.map((h) => h.slice(2)).join('');
    await owner.sendTransaction({ to: await getAddr(), data });
  }

  beforeEach(async () => {
    [owner, user, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('Mutation');
    const proxy = await upgrades.deployProxy(Factory, [evolveFee], { initializer: 'initialize' });
    evolve = Factory.attach(await proxy.getAddress()) as Mutation;
    await evolve.waitForDeployment();

    // Register 3 pairs
    await evolve.registerPairs(ogHashes, quantumHashes);

    // Owner deposits all ethscriptions
    await ownerDepositAll();
  });

  describe('Initialization', () => {
    it('Should set owner correctly', async () => {
      expect(await evolve.owner()).to.equal(owner.address);
    });

    it('Should set evolveFee', async () => {
      expect(await evolve.evolveFee()).to.equal(evolveFee);
    });

    it('Should have pairCount = 3', async () => {
      expect(await evolve.pairCount()).to.equal(3);
    });
  });

  describe('registerPairs', () => {
    it('Should register pairs and emit PairsRegistered', async () => {
      const newOg = [createHashId('new-og-0')];
      const newQ = [createHashId('new-quantum-0')];

      await expect(evolve.registerPairs(newOg, newQ))
        .to.emit(evolve, 'PairsRegistered')
        .withArgs(3, 1);

      expect(await evolve.pairCount()).to.equal(4);
    });

    it('Should set reverse lookups correctly', async () => {
      // pairIdOf
      expect(await evolve.pairIdOf(ogHashes[0])).to.equal(0);
      expect(await evolve.pairIdOf(quantumHashes[0])).to.equal(0);
      expect(await evolve.pairIdOf(ogHashes[2])).to.equal(2);

      // isOg
      expect(await evolve.isOg(ogHashes[0])).to.be.true;
      expect(await evolve.isOg(quantumHashes[0])).to.be.false;
    });

    it('Should revert on duplicate OG registration', async () => {
      await expect(evolve.registerPairs([ogHashes[0]], [createHashId('dup-q')]))
        .to.be.revertedWith('OG already registered');
    });

    it('Should revert on duplicate Quantum registration', async () => {
      await expect(evolve.registerPairs([createHashId('dup-og')], [quantumHashes[0]]))
        .to.be.revertedWith('Quantum already registered');
    });

    it('Should revert from non-owner', async () => {
      await expect(evolve.connect(user).registerPairs([createHashId('x')], [createHashId('y')]))
        .to.be.revertedWithCustomError(evolve, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Evolve (OG → Quantum)', () => {
    it('Should evolve via fallback: user deposits OG → receives quantum', async () => {
      // User deposits OG hash
      const tx = await user.sendTransaction({
        to: await getAddr(),
        data: ogHashes[0],
        value: evolveFee,
      });

      await expect(tx)
        .to.emit(evolve, 'Evolved')
        .withArgs(user.address, 0, ogHashes[0], quantumHashes[0]);

      // quantum depositor should be cleared
      expect(await evolve.depositor(quantumHashes[0])).to.equal(ethers.ZeroAddress);
    });

    it('Should charge fee on first evolve of pair', async () => {
      const balBefore = await ethers.provider.getBalance(await getAddr());
      await user.sendTransaction({
        to: await getAddr(),
        data: ogHashes[0],
        value: evolveFee,
      });
      const balAfter = await ethers.provider.getBalance(await getAddr());
      expect(balAfter - balBefore).to.equal(evolveFee);
    });

    it('Should be free on subsequent evolves (feePaid=true)', async () => {
      // First evolve pays fee
      await user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: evolveFee });

      // Owner re-deposits quantum so user can evolve again
      await owner.sendTransaction({ to: await getAddr(), data: quantumHashes[0] });

      // User re-deposits OG (simulating returning it)
      // The depositor is set by the fallback
      // Now evolve again — should be free
      await user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: 0 });
      expect(await evolve.feePaid(0)).to.be.true;
    });

    it('Should refund excess ETH', async () => {
      const excess = evolveFee + ethers.parseEther('0.01');
      const balBefore = await ethers.provider.getBalance(user.address);
      const tx = await user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: excess });
      const receipt = await tx.wait();
      const balAfter = await ethers.provider.getBalance(user.address);

      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const spent = balBefore - balAfter - gasUsed;
      expect(spent).to.be.closeTo(evolveFee, ethers.parseEther('0.0001'));
    });

    it('Should revert with insufficient fee', async () => {
      await expect(
        user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: evolveFee / 2n }),
      ).to.be.revertedWithCustomError(evolve, 'InsufficientFee');
    });
  });

  describe('Devolve (Quantum → OG)', () => {
    it('Should devolve via fallback: user deposits quantum → receives OG', async () => {
      const tx = await user.sendTransaction({
        to: await getAddr(),
        data: quantumHashes[1],
        value: 0,
      });

      await expect(tx)
        .to.emit(evolve, 'Devolved')
        .withArgs(user.address, 1, quantumHashes[1], ogHashes[1]);
    });

    it('Should be free (refunds any ETH sent)', async () => {
      const balBefore = await ethers.provider.getBalance(user.address);
      const tx = await user.sendTransaction({
        to: await getAddr(),
        data: quantumHashes[0],
        value: ethers.parseEther('0.01'),
      });
      const receipt = await tx.wait();
      const balAfter = await ethers.provider.getBalance(user.address);

      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const spent = balBefore - balAfter - gasUsed;
      // Should be ~0 (only gas, ETH refunded)
      expect(spent).to.be.closeTo(0n, ethers.parseEther('0.0001'));
    });
  });

  describe('Edge cases', () => {
    it('Should revert on unknown ethscription', async () => {
      const unknownHash = createHashId('unknown');
      await expect(
        user.sendTransaction({ to: await getAddr(), data: unknownHash }),
      ).to.be.revertedWithCustomError(evolve, 'UnknownEthscription');
    });

    it('Should revert when partner not deposited', async () => {
      // Evolve once to consume the quantum
      await user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: evolveFee });
      // Now the quantum is gone, another user tries to evolve same pair via fallback
      // The fallback auto-evolves, which should fail with PartnerNotAvailable
      await expect(
        other.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: evolveFee }),
      ).to.be.revertedWithCustomError(evolve, 'PartnerNotAvailable');
    });

    it('Should revert on invalid data length', async () => {
      await expect(
        user.sendTransaction({ to: await getAddr(), data: '0x1234' }),
      ).to.be.revertedWithCustomError(evolve, 'InvalidDataLength');
    });

    it('Should revert on direct ETH transfer (receive)', async () => {
      await expect(
        user.sendTransaction({ to: await getAddr(), value: ethers.parseEther('1') }),
      ).to.be.revertedWith('No direct ETH transfers');
    });

    it('Non-owner cannot batch-deposit', async () => {
      const data = '0x' + ogHashes[0].slice(2) + quantumHashes[0].slice(2);
      await expect(
        user.sendTransaction({ to: await getAddr(), data }),
      ).to.be.revertedWithCustomError(evolve, 'InvalidDataLength');
    });
  });

  describe('Explicit evolve/devolve functions', () => {
    it('Should evolve via explicit function (owner as depositor)', async () => {
      // Owner already deposited ogHashes[0] in beforeEach, so depositor is owner
      await expect(evolve.connect(owner).evolve(ogHashes[0], { value: evolveFee }))
        .to.emit(evolve, 'Evolved');
    });

    it('Should devolve via explicit function (owner as depositor)', async () => {
      // Owner already deposited quantumHashes[0] in beforeEach
      await expect(evolve.connect(owner).devolve(quantumHashes[0]))
        .to.emit(evolve, 'Devolved');
    });

    it('Should revert evolve if not depositor', async () => {
      await expect(evolve.connect(user).evolve(ogHashes[0], { value: evolveFee }))
        .to.be.revertedWithCustomError(evolve, 'NotDepositor');
    });

    it('Should revert evolve with quantum hash (NotOg)', async () => {
      // Owner is depositor of quantumHashes[0]
      await expect(evolve.connect(owner).evolve(quantumHashes[0], { value: evolveFee }))
        .to.be.revertedWithCustomError(evolve, 'NotOg');
    });

    it('Should revert devolve with OG hash (NotQuantum)', async () => {
      // Owner is depositor of ogHashes[0]
      await expect(evolve.connect(owner).devolve(ogHashes[0]))
        .to.be.revertedWithCustomError(evolve, 'NotQuantum');
    });
  });

  describe('Admin functions', () => {
    it('Should allow owner to setFee', async () => {
      const newFee = ethers.parseEther('0.01');
      await evolve.setFee(newFee);
      expect(await evolve.evolveFee()).to.equal(newFee);
    });

    it('Should allow owner to pause/unpause', async () => {
      await evolve.pause();
      expect(await evolve.paused()).to.be.true;
      await evolve.unpause();
      expect(await evolve.paused()).to.be.false;
    });

    it('Should revert user operations when paused', async () => {
      await evolve.pause();
      await expect(
        user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: evolveFee }),
      ).to.be.revertedWith('Pausable: paused');
    });

    it('Should allow owner to withdrawETH', async () => {
      // Send some ETH via evolve fee
      await user.sendTransaction({ to: await getAddr(), data: ogHashes[0], value: evolveFee });
      const balBefore = await ethers.provider.getBalance(owner.address);
      await evolve.withdrawETH();
      const balAfter = await ethers.provider.getBalance(owner.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it('Should allow owner to withdrawEthscription', async () => {
      await expect(evolve.withdrawEthscription(ogHashes[0], owner.address))
        .to.emit(evolve, 'ethscriptions_protocol_TransferEthscriptionForPreviousOwner')
        .withArgs(owner.address, owner.address, ogHashes[0]);
    });

    it('Should revert renounceOwnership', async () => {
      await expect(evolve.renounceOwnership())
        .to.be.revertedWith('Cannot renounce ownership');
    });

    it('Should revert admin functions from non-owner', async () => {
      await expect(evolve.connect(user).setFee(0))
        .to.be.revertedWithCustomError(evolve, 'OwnableUnauthorizedAccount');
      await expect(evolve.connect(user).pause())
        .to.be.revertedWithCustomError(evolve, 'OwnableUnauthorizedAccount');
    });
  });
});
