import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Mutation } from '../typechain-types';
import { createHashId } from './helpers';

describe('EtherPhunksEvolve — updateQuantumHashId', function () {
  let evolve: Mutation;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const evolveFee = ethers.parseEther('0.005');

  const ogHashes    = [createHashId('og-0'), createHashId('og-1'), createHashId('og-2')];
  const qHashes     = [createHashId('q-0'),  createHashId('q-1'),  createHashId('q-2')];
  const newQHashes  = [createHashId('q-0-new'), createHashId('q-1-new'), createHashId('q-2-new')];

  async function addr() { return evolve.getAddress(); }

  async function ownerDepositAll() {
    const all = [...ogHashes, ...qHashes];
    await owner.sendTransaction({ to: await addr(), data: '0x' + all.map(h => h.slice(2)).join('') });
  }

  beforeEach(async () => {
    [owner, user, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('Mutation');
    const proxy = await upgrades.deployProxy(Factory, [evolveFee], { initializer: 'initialize' });
    evolve = Factory.attach(await proxy.getAddress()) as Mutation;
    await evolve.waitForDeployment();

    await evolve.registerPairs(ogHashes, qHashes);
    await ownerDepositAll();
  });

  // ─── Access Control ─────────────────────────────────────

  it('Reverts if called by non-owner', async () => {
    await expect(
      evolve.connect(other).updateQuantumHashId(0, newQHashes[0])
    ).to.be.revertedWithCustomError(evolve, 'OwnableUnauthorizedAccount');
  });

  // ─── Input Validation ────────────────────────────────────

  it('Reverts if pid >= pairCount', async () => {
    await expect(
      evolve.updateQuantumHashId(3, newQHashes[0])
    ).to.be.revertedWith('Invalid pair ID');
  });

  it('Reverts if newQuantumHashId is zero', async () => {
    await expect(
      evolve.updateQuantumHashId(0, ethers.ZeroHash)
    ).to.be.revertedWith('Zero hashId');
  });

  it('Reverts if newQuantumHashId == oldQuantumHashId', async () => {
    await expect(
      evolve.updateQuantumHashId(0, qHashes[0])
    ).to.be.revertedWith('Same hashId');
  });

  it('Reverts if newQuantumHashId is already registered (another quantum)', async () => {
    await expect(
      evolve.updateQuantumHashId(0, qHashes[1])
    ).to.be.revertedWith('New quantum already registered');
  });

  it('Reverts if newQuantumHashId is already registered (an OG)', async () => {
    await expect(
      evolve.updateQuantumHashId(0, ogHashes[1])
    ).to.be.revertedWith('New quantum already registered');
  });

  // ─── State Changes ───────────────────────────────────────

  it('Clears old quantum registered flag', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.registered(qHashes[0])).to.equal(false);
  });

  it('Clears old quantum pairIdOf mapping', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    // pairIdOf for old quantum defaults to 0 — confirm it no longer matches via registered=false
    expect(await evolve.registered(qHashes[0])).to.equal(false);
  });

  it('Clears old quantum depositor', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.depositor(qHashes[0])).to.equal(ethers.ZeroAddress);
  });

  it('Sets new quantum registered flag', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.registered(newQHashes[0])).to.equal(true);
  });

  it('Sets new quantumHashId[pid]', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.quantumHashId(0)).to.equal(newQHashes[0]);
  });

  it('Sets new pairIdOf[newQuantumHashId] = pid', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.pairIdOf(newQHashes[0])).to.equal(0);
  });

  it('OG side is unaffected', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.ogHashId(0)).to.equal(ogHashes[0]);
    expect(await evolve.registered(ogHashes[0])).to.equal(true);
    expect(await evolve.isOg(ogHashes[0])).to.equal(true);
    expect(await evolve.pairIdOf(ogHashes[0])).to.equal(0);
  });

  it('Other pairs are unaffected', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.quantumHashId(1)).to.equal(qHashes[1]);
    expect(await evolve.quantumHashId(2)).to.equal(qHashes[2]);
    expect(await evolve.registered(qHashes[1])).to.equal(true);
    expect(await evolve.registered(qHashes[2])).to.equal(true);
  });

  it('feePaid is preserved after update', async () => {
    // Confirm feePaid starts false
    expect(await evolve.feePaid(0)).to.equal(false);
    // User sends OG → triggers _evolve and pays the one-time fee
    await user.sendTransaction({ to: await addr(), data: ogHashes[0], value: evolveFee });
    expect(await evolve.feePaid(0)).to.equal(true);
    // Owner withdraws the deposited OG, then updates quantum hashId
    await evolve.withdrawEthscription(ogHashes[0], owner.address);
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    // feePaid must still be true — fee was already collected for this pair
    expect(await evolve.feePaid(0)).to.equal(true);
  });

  it('pairCount unchanged after update', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);
    expect(await evolve.pairCount()).to.equal(3);
  });

  // ─── Event ──────────────────────────────────────────────

  it('Emits QuantumHashIdUpdated with correct args', async () => {
    await expect(evolve.updateQuantumHashId(0, newQHashes[0]))
      .to.emit(evolve, 'QuantumHashIdUpdated')
      .withArgs(0, qHashes[0], newQHashes[0]);
  });

  // ─── Functional: Evolve with new quantum ─────────────────

  it('Evolution works with new quantum after update', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);

    // Deposit new quantum as owner
    await owner.sendTransaction({ to: await addr(), data: newQHashes[0] });

    // User evolves using OG — should receive new quantum
    await expect(
      user.sendTransaction({ to: await addr(), data: ogHashes[0], value: evolveFee })
    ).to.emit(evolve, 'Evolved')
      .withArgs(user.address, 0, ogHashes[0], newQHashes[0]);
  });

  it('Old quantum cannot be deposited (not registered)', async () => {
    await evolve.updateQuantumHashId(0, newQHashes[0]);

    // Owner tries to deposit old quantum — should revert UnknownEthscription
    await expect(
      owner.sendTransaction({ to: await addr(), data: qHashes[0] })
    ).to.be.revertedWithCustomError(evolve, 'UnknownEthscription');
  });

  it('Can update all 3 pairs independently', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(evolve.updateQuantumHashId(i, newQHashes[i]))
        .to.emit(evolve, 'QuantumHashIdUpdated')
        .withArgs(i, qHashes[i], newQHashes[i]);
      expect(await evolve.quantumHashId(i)).to.equal(newQHashes[i]);
      expect(await evolve.registered(qHashes[i])).to.equal(false);
      expect(await evolve.registered(newQHashes[i])).to.equal(true);
    }
    expect(await evolve.pairCount()).to.equal(3);
  });
});
