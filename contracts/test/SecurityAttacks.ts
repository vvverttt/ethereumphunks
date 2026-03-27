/**
 * Security Attack Tests
 *
 * Verifies that funds CANNOT be stolen, spoofed, or rerouted by unauthorized parties
 * across all four contracts: EtherPhunksMarketV3, PhilipLotteryV68_V2, EthsRocks, Mutation.
 *
 * Key attack vectors tested:
 *  1. Reentrancy on withdraw()
 *  2. Unauthorized redirectPendingWithdrawals / redirectPendingReturns
 *  3. Double-withdraw (draining more than entitled)
 *  4. Owner stealing committed user ETH via withdrawETH()
 *  5. Signature forgery / replay (EthsRocks)
 *  6. Contract-wallet blocked from commitPlay (tx.origin guard)
 *  7. Private-listing / depositor-ownership bypass (Market)
 *  8. Positive case: owner legitimately rescues stuck smart-contract-wallet funds
 */

import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  EtherPhunksMarketV3,
  PhilipLotteryV68_V2,
  EthsRocks,
  Mutation,
  Points,
  MockERC721,
  MockReentrancyAttacker,
} from '../typechain-types';
import { mineBlocks, createHashId, depositMultipleEthscriptions } from './helpers';
import { keccak256 } from 'ethers';
import { stringToBytes } from 'viem';

const DEPOSIT_AND_LIST_SIGNATURE = keccak256(stringToBytes('DEPOSIT_AND_LIST_SIGNATURE'));

// ============================================================
// SECTION 1: EtherPhunksMarketV3
// ============================================================
describe('Security: EtherPhunksMarketV3', function () {
  let market: EtherPhunksMarketV3;
  let points: Points;
  let attacker: MockReentrancyAttacker;

  let owner: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let royaltyReceiver: HardhatEthersSigner;
  let victim: HardhatEthersSigner;

  const royaltyBps = 367;
  const price = ethers.parseEther('1');

  beforeEach(async () => {
    [owner, seller, buyer, royaltyReceiver, victim] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory('EtherPhunksMarketV3');
    const proxy = await upgrades.deployProxy(
      MarketFactory,
      [3, await points.getAddress(), royaltyBps, royaltyReceiver.address],
      { initializer: 'initialize' },
    );
    market = MarketFactory.attach(await proxy.getAddress()) as EtherPhunksMarketV3;
    await market.waitForDeployment();
    await points.grantManager(await market.getAddress());

    const AttackerFactory = await ethers.getContractFactory('MockReentrancyAttacker');
    attacker = (await AttackerFactory.deploy()) as MockReentrancyAttacker;
    await attacker.waitForDeployment();
    await attacker.setTarget(await market.getAddress());
  });

  // ── Helper: attacker deposits + lists a phunk, buyer buys it ──────────────
  async function setupAttackerAsSeller(phunkId: string) {
    // Attacker deposits phunk (raw 32-byte hash forwarded to market fallback)
    await attacker.callTarget(phunkId);
    // Attacker lists it
    const offerData = market.interface.encodeFunctionData('offerPhunkForSale', [phunkId, price]);
    await attacker.callTarget(offerData);
    await mineBlocks(5);
    // Buyer purchases → attacker accumulates pendingWithdrawals
    await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });
  }

  it('nonReentrant blocks reentrancy on withdraw()', async () => {
    const phunkId = createHashId('market-reentrancy-phunk');
    await setupAttackerAsSeller(phunkId);

    const pending = await market.pendingWithdrawals(await attacker.getAddress());
    expect(pending).to.be.gt(0n);

    // Attacker calls withdraw(); in receive() it tries to call withdraw() again
    await attacker.attack();

    // Reentrancy must have been blocked
    expect(await attacker.reentryAttempted()).to.be.true;
    expect(await attacker.reentrySucceeded()).to.be.false;

    // Funds drained exactly once, not twice
    expect(await attacker.getBalance()).to.equal(pending);
    expect(await market.pendingWithdrawals(await attacker.getAddress())).to.equal(0n);
  });

  it('non-owner cannot call redirectPendingWithdrawals', async () => {
    await expect(
      market.connect(seller).redirectPendingWithdrawals(victim.address, seller.address),
    ).to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');
  });

  it('attacker cannot steal another users pending balance via redirect', async () => {
    // Give seller a pending balance
    const phunkId = createHashId('market-steal-phunk');
    await seller.sendTransaction({ to: await market.getAddress(), data: phunkId });
    await market.connect(seller).offerPhunkForSale(phunkId, price);
    await mineBlocks(5);
    await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });

    const sellerPending = await market.pendingWithdrawals(seller.address);
    expect(sellerPending).to.be.gt(0n);

    // Non-owner (buyer) tries to redirect seller's funds to themselves
    await expect(
      market.connect(buyer).redirectPendingWithdrawals(seller.address, buyer.address),
    ).to.be.revertedWithCustomError(market, 'OwnableUnauthorizedAccount');

    // Seller's balance must be untouched
    expect(await market.pendingWithdrawals(seller.address)).to.equal(sellerPending);
  });

  it('double-withdraw: second call reverts with no pending withdrawals', async () => {
    const phunkId = createHashId('market-double-withdraw');
    await seller.sendTransaction({ to: await market.getAddress(), data: phunkId });
    await market.connect(seller).offerPhunkForSale(phunkId, price);
    await mineBlocks(5);
    await market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price });

    await expect(market.connect(seller).withdraw()).to.not.be.reverted;
    await expect(market.connect(seller).withdraw()).to.be.revertedWith('No pending withdrawals');
  });

  it('seller cannot buy their own listing', async () => {
    const phunkId = createHashId('market-self-buy');
    await seller.sendTransaction({ to: await market.getAddress(), data: phunkId });
    await market.connect(seller).offerPhunkForSale(phunkId, price);
    await mineBlocks(5);

    await expect(
      market.connect(seller).batchBuyPhunk([phunkId], [price], { value: price }),
    ).to.be.revertedWith('Invalid sale conditions');
  });

  it('attacker cannot bypass a private listing by spoofing buyer identity', async () => {
    const phunkId = createHashId('market-private-bypass');
    await seller.sendTransaction({ to: await market.getAddress(), data: phunkId });
    // Only buyer.address is allowed to buy
    await market.connect(seller).offerPhunkForSaleToAddress(phunkId, price, buyer.address);
    await mineBlocks(5);

    // Victim (not buyer) tries to buy — must be blocked
    await expect(
      market.connect(victim).batchBuyPhunk([phunkId], [price], { value: price }),
    ).to.be.revertedWith('Invalid sale conditions');

    // Legitimate buyer can still buy
    await expect(
      market.connect(buyer).batchBuyPhunk([phunkId], [price], { value: price }),
    ).to.emit(market, 'PhunkBought');
  });

  it('non-depositor cannot list a phunk they do not own', async () => {
    const phunkId = createHashId('market-non-depositor');
    // seller never deposited phunkId
    await expect(
      market.connect(seller).offerPhunkForSale(phunkId, price),
    ).to.be.revertedWithCustomError(market, 'EthscriptionNotDeposited');
  });

  it('redirectPendingWithdrawals to zero address reverts', async () => {
    await expect(
      market.redirectPendingWithdrawals(seller.address, ethers.ZeroAddress),
    ).to.be.revertedWith('Invalid address');
  });

  it('redirectPendingWithdrawals from address with zero balance reverts', async () => {
    await expect(
      market.redirectPendingWithdrawals(seller.address, buyer.address),
    ).to.be.revertedWith('Nothing to redirect');
  });

  it('owner can legitimately redirect stuck smart-contract-wallet funds to an EOA', async () => {
    const phunkId = createHashId('market-rescue-phunk');
    const stuckWallet = await attacker.getAddress();

    await setupAttackerAsSeller(phunkId);

    const stuck = await market.pendingWithdrawals(stuckWallet);
    expect(stuck).to.be.gt(0n);

    // Owner rescues: moves funds from stuck contract wallet to victim EOA
    await market.redirectPendingWithdrawals(stuckWallet, victim.address);
    expect(await market.pendingWithdrawals(stuckWallet)).to.equal(0n);
    expect(await market.pendingWithdrawals(victim.address)).to.equal(stuck);

    // Victim can now withdraw successfully
    await expect(market.connect(victim).withdraw()).to.not.be.reverted;
  });
});


// ============================================================
// SECTION 2: PhilipLotteryV68_V2
// ============================================================
describe('Security: PhilipLotteryV68_V2', function () {
  let lottery: PhilipLotteryV68_V2;
  let points: Points;
  let attacker: MockReentrancyAttacker;

  let owner: HardhatEthersSigner;
  let player: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let victim: HardhatEthersSigner;

  const playPrice = ethers.parseEther('0.01');
  const prizes = Array.from({ length: 5 }, (_, i) => createHashId(`security-lottery-prize-${i}`));

  beforeEach(async () => {
    [owner, player, treasury, victim] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    const LotteryFactory = await ethers.getContractFactory('PhilipLotteryV68_V2');
    const proxy = await upgrades.deployProxy(
      LotteryFactory,
      [playPrice, await points.getAddress(), treasury.address],
      { initializer: 'initialize' },
    );
    lottery = LotteryFactory.attach(await proxy.getAddress()) as PhilipLotteryV68_V2;
    await lottery.waitForDeployment();
    await points.grantManager(await lottery.getAddress());
    await depositMultipleEthscriptions(owner, await lottery.getAddress(), prizes);

    const AttackerFactory = await ethers.getContractFactory('MockReentrancyAttacker');
    attacker = (await AttackerFactory.deploy()) as MockReentrancyAttacker;
    await attacker.waitForDeployment();
    await attacker.setTarget(await lottery.getAddress());
  });

  // ── Helper: route play payment through attacker (as treasury) to build pendingReturns ──
  async function buildAttackerPendingReturns(): Promise<bigint> {
    await attacker.setRejectMode(true);
    await lottery.setTreasuryAddress(await attacker.getAddress());

    await lottery.connect(player).commitPlay({ value: playPrice });
    await mineBlocks(3);
    await lottery.connect(player).revealPlay();

    const pending = await lottery.pendingReturns(await attacker.getAddress());
    expect(pending).to.equal(playPrice);

    // Restore treasury and switch attacker to accept ETH
    await lottery.setTreasuryAddress(treasury.address);
    await attacker.setRejectMode(false);
    return pending;
  }

  it('nonReentrant blocks reentrancy on withdraw()', async () => {
    const pending = await buildAttackerPendingReturns();

    // Attacker calls withdraw(); receive() tries to call withdraw() again
    await attacker.attack();

    expect(await attacker.reentryAttempted()).to.be.true;
    expect(await attacker.reentrySucceeded()).to.be.false;

    // Received exactly once
    expect(await attacker.getBalance()).to.equal(pending);
    expect(await lottery.pendingReturns(await attacker.getAddress())).to.equal(0n);
  });

  it('non-owner cannot call redirectPendingReturns', async () => {
    await expect(
      lottery.connect(player).redirectPendingReturns(victim.address, player.address),
    ).to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');
  });

  it('attacker cannot steal another users pending balance via redirect', async () => {
    // Build pendingReturns for attacker first
    await buildAttackerPendingReturns();
    const attackerBal = await lottery.pendingReturns(await attacker.getAddress());
    expect(attackerBal).to.be.gt(0n);

    // Non-owner (player) tries to redirect attacker's balance to themselves
    await expect(
      lottery.connect(player).redirectPendingReturns(await attacker.getAddress(), player.address),
    ).to.be.revertedWithCustomError(lottery, 'OwnableUnauthorizedAccount');

    // Balance unchanged
    expect(await lottery.pendingReturns(await attacker.getAddress())).to.equal(attackerBal);
  });

  it('double-withdraw: second call reverts with nothing to withdraw', async () => {
    await buildAttackerPendingReturns();
    // Redirect attacker's funds to victim so victim can call withdraw() directly
    await lottery.redirectPendingReturns(await attacker.getAddress(), victim.address);

    await expect(lottery.connect(victim).withdraw()).to.not.be.reverted;
    await expect(lottery.connect(victim).withdraw()).to.be.revertedWith('Nothing to withdraw');
  });

  it('owner cannot steal committed player ETH via withdrawETH', async () => {
    // Player commits but has not yet revealed → ETH is committed
    await lottery.connect(player).commitPlay({ value: playPrice });
    expect(await lottery.totalCommittedETH()).to.equal(playPrice);

    // Owner tries to withdraw all committed funds
    await expect(
      lottery.withdrawETH(playPrice, treasury.address),
    ).to.be.revertedWith('Exceeds available balance');

    // Even withdrawing 1 wei of committed funds must fail
    await expect(
      lottery.withdrawETH(1n, treasury.address),
    ).to.be.revertedWith('Exceeds available balance');
  });

  it('contract wallet cannot call commitPlay (tx.origin guard)', async () => {
    // msg.sender = attacker contract, tx.origin = test EOA → blocked
    const commitData = lottery.interface.encodeFunctionData('commitPlay', []);
    await expect(
      attacker.callTarget(commitData, { value: playPrice }),
    ).to.be.revertedWith('No contracts');
  });

  it('player cannot reveal someone elses commitment', async () => {
    await lottery.connect(player).commitPlay({ value: playPrice });
    await mineBlocks(3);

    // victim has no commitment
    await expect(
      lottery.connect(victim).revealPlay(),
    ).to.be.revertedWith('No commitment');
  });

  it('redirectPendingReturns to zero address reverts', async () => {
    await expect(
      lottery.redirectPendingReturns(player.address, ethers.ZeroAddress),
    ).to.be.revertedWith('Invalid address');
  });

  it('redirectPendingReturns from address with zero balance reverts', async () => {
    await expect(
      lottery.redirectPendingReturns(player.address, victim.address),
    ).to.be.revertedWith('Nothing to redirect');
  });

  it('owner can legitimately redirect stuck smart-contract-wallet funds to an EOA', async () => {
    const pending = await buildAttackerPendingReturns();
    const stuckWallet = await attacker.getAddress();

    await lottery.redirectPendingReturns(stuckWallet, victim.address);
    expect(await lottery.pendingReturns(stuckWallet)).to.equal(0n);
    expect(await lottery.pendingReturns(victim.address)).to.equal(pending);

    await expect(lottery.connect(victim).withdraw()).to.not.be.reverted;
  });
});


// ============================================================
// SECTION 3: EthsRocks
// ============================================================
describe('Security: EthsRocks', function () {
  let rocks: EthsRocks;
  let points: Points;
  let philipIntern: MockERC721;
  let wrappedV1: MockERC721;
  let cryptoPhunksV2: MockERC721;

  let owner: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;
  let signer: HardhatEthersSigner;
  let other: HardhatEthersSigner;
  let victim: HardhatEthersSigner;

  const rockHashes = Array.from({ length: 5 }, (_, i) => createHashId(`security-rock-${i}`));

  const philipTokenId = 1;
  const cryptoPhunksTokenId = 2;

  const missingPhunkHash = createHashId('sec-missing-phunk');
  const quantumDystoHash = createHashId('sec-quantum-dysto');
  const quantumPhunkHash = createHashId('sec-quantum-phunk');

  async function generateSignature(
    buyerAddr: string,
    mpHash: string,
    qdHash: string,
    qpHash: string,
    philipId: number,
    usePhilipIntern: boolean,
    cpV2Id: number,
    deadline: number,
  ): Promise<string> {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const contractAddr = await rocks.getAddress();
    const dataHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bool', 'uint256', 'uint256', 'uint256', 'address'],
        [buyerAddr, mpHash, qdHash, qpHash, philipId, usePhilipIntern, cpV2Id, deadline, chainId, contractAddr],
      ),
    );
    return await signer.signMessage(ethers.getBytes(dataHash));
  }

  async function doCommit(buyerSigner: HardhatEthersSigner, sig: string, deadline: number) {
    const price = await rocks.currentPrice();
    return rocks.connect(buyerSigner).commit(
      sig, deadline, price * 10n,
      missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      philipTokenId, true, cryptoPhunksTokenId,
      { value: price },
    );
  }

  beforeEach(async () => {
    [owner, buyer, treasury, signer, other, victim] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('Points');
    points = (await PointsFactory.deploy()) as Points;
    await points.waitForDeployment();

    const ERC721Factory = await ethers.getContractFactory('MockERC721');
    philipIntern = (await ERC721Factory.deploy('PhilipIntern', 'PI')) as MockERC721;
    wrappedV1 = (await ERC721Factory.deploy('WrappedV1', 'WV1')) as MockERC721;
    cryptoPhunksV2 = (await ERC721Factory.deploy('CryptoPhunksV2', 'CPV2')) as MockERC721;

    const RocksFactory = await ethers.getContractFactory('EthsRocks');
    const proxy = await upgrades.deployProxy(
      RocksFactory,
      [
        treasury.address,
        await points.getAddress(),
        ethers.ZeroHash,
        await philipIntern.getAddress(),
        await wrappedV1.getAddress(),
        await cryptoPhunksV2.getAddress(),
      ],
      { initializer: 'initialize' },
    );
    rocks = RocksFactory.attach(await proxy.getAddress()) as EthsRocks;
    await rocks.waitForDeployment();

    await rocks.setSignerAddress(signer.address);
    await points.grantManager(await rocks.getAddress());
    await depositMultipleEthscriptions(owner, await rocks.getAddress(), rockHashes);

    await philipIntern.mint(buyer.address, philipTokenId);
    await cryptoPhunksV2.mint(buyer.address, cryptoPhunksTokenId);
  });

  it('non-owner cannot call redirectPendingReturns', async () => {
    await expect(
      rocks.connect(buyer).redirectPendingReturns(victim.address, buyer.address),
    ).to.be.revertedWithCustomError(rocks, 'OwnableUnauthorizedAccount');
  });

  it('double-withdraw: second call reverts with nothing to withdraw', async () => {
    // Build pendingReturns by routing treasury payment through a rejecter
    const RejectFactory = await ethers.getContractFactory('MockRejectETH');
    const rejecter = await RejectFactory.deploy();
    await rejecter.waitForDeployment();
    await rocks.setTreasuryAddress(await rejecter.getAddress());

    const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
    const sig = await generateSignature(
      buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      philipTokenId, true, cryptoPhunksTokenId, deadline,
    );
    await doCommit(buyer, sig, deadline);
    await mineBlocks(3);
    await rocks.connect(buyer).reveal();

    // Rejecter now has pendingReturns; redirect to victim
    const rejecterBal = await rocks.pendingReturns(await rejecter.getAddress());
    expect(rejecterBal).to.be.gt(0n);
    await rocks.redirectPendingReturns(await rejecter.getAddress(), victim.address);

    await expect(rocks.connect(victim).withdraw()).to.not.be.reverted;
    await expect(rocks.connect(victim).withdraw()).to.be.revertedWith('Nothing to withdraw');
  });

  it('owner cannot steal committed buyer ETH via withdrawETH', async () => {
    const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
    const sig = await generateSignature(
      buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      philipTokenId, true, cryptoPhunksTokenId, deadline,
    );
    await doCommit(buyer, sig, deadline);

    const committed = await rocks.totalCommittedETH();
    expect(committed).to.be.gt(0n);

    // Owner must not be able to drain committed ETH
    await expect(
      rocks.withdrawETH(committed, treasury.address),
    ).to.be.revertedWith('Exceeds available balance');
  });

  it('forged/invalid signature is rejected', async () => {
    const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
    const price = await rocks.currentPrice();
    // Random 65-byte garbage signature
    const fakeSig = ethers.randomBytes(65);

    // ECDSA.recover() with garbage bytes throws a custom error before "Not eligible" is reached
    await expect(
      rocks.connect(buyer).commit(
        fakeSig, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      ),
    ).to.be.reverted;
  });

  it('attacker cannot use a valid signature generated for a different buyer', async () => {
    const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
    const price = await rocks.currentPrice();

    // Signature was issued to buyer.address, not other.address
    const sigForBuyer = await generateSignature(
      buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      philipTokenId, true, cryptoPhunksTokenId, deadline,
    );

    // other tries to use buyer's signature
    await expect(
      rocks.connect(other).commit(
        sigForBuyer, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        philipTokenId, true, cryptoPhunksTokenId,
        { value: price },
      ),
    ).to.be.revertedWith('Not eligible');
  });

  it('same ethscription cannot be replayed in a second commit', async () => {
    const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
    const sig = await generateSignature(
      buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      philipTokenId, true, cryptoPhunksTokenId, deadline,
    );
    await doCommit(buyer, sig, deadline);
    await mineBlocks(3);
    await rocks.connect(buyer).reveal(); // clears commitment

    // Mint fresh ERC-721 tokens to buyer so only the ethscription check triggers
    const newPhilipId = 10;
    const newCpV2Id = 20;
    await philipIntern.mint(buyer.address, newPhilipId);
    await cryptoPhunksV2.mint(buyer.address, newCpV2Id);

    // Second commit with same ethscription hashes (missingPhunkHash still used)
    const sig2 = await generateSignature(
      buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      newPhilipId, true, newCpV2Id, deadline,
    );
    const price = await rocks.currentPrice();
    await expect(
      rocks.connect(buyer).commit(
        sig2, deadline, price * 10n,
        missingPhunkHash, quantumDystoHash, quantumPhunkHash,
        newPhilipId, true, newCpV2Id,
        { value: price },
      ),
    ).to.be.revertedWith('MissingPhunk already used');
  });

  it('redirectPendingReturns to zero address reverts', async () => {
    await expect(
      rocks.redirectPendingReturns(buyer.address, ethers.ZeroAddress),
    ).to.be.revertedWith('Invalid address');
  });

  it('redirectPendingReturns from address with zero balance reverts', async () => {
    await expect(
      rocks.redirectPendingReturns(buyer.address, victim.address),
    ).to.be.revertedWith('Nothing to redirect');
  });

  it('owner can legitimately redirect stuck smart-contract-wallet funds to an EOA', async () => {
    // Build pendingReturns via rejecter treasury
    const RejectFactory = await ethers.getContractFactory('MockRejectETH');
    const rejecter = await RejectFactory.deploy();
    await rejecter.waitForDeployment();
    await rocks.setTreasuryAddress(await rejecter.getAddress());

    const deadline = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
    const sig = await generateSignature(
      buyer.address, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
      philipTokenId, true, cryptoPhunksTokenId, deadline,
    );
    await doCommit(buyer, sig, deadline);
    await mineBlocks(3);
    await rocks.connect(buyer).reveal();

    const stuck = await rocks.pendingReturns(await rejecter.getAddress());
    expect(stuck).to.be.gt(0n);

    await rocks.redirectPendingReturns(await rejecter.getAddress(), victim.address);
    expect(await rocks.pendingReturns(await rejecter.getAddress())).to.equal(0n);
    expect(await rocks.pendingReturns(victim.address)).to.equal(stuck);

    await expect(rocks.connect(victim).withdraw()).to.not.be.reverted;
  });
});


// ============================================================
// SECTION 4: EtherPhunksEvolve (Mutation)
// ============================================================
describe('Security: EtherPhunksEvolve (Mutation)', function () {
  let evolve: Mutation;
  let attacker: MockReentrancyAttacker;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let victim: HardhatEthersSigner;

  const evolveFee = ethers.parseEther('0.005');

  const ogHashes = [createHashId('sec-og-0'), createHashId('sec-og-1'), createHashId('sec-og-2')];
  const quantumHashes = [
    createHashId('sec-quantum-0'),
    createHashId('sec-quantum-1'),
    createHashId('sec-quantum-2'),
  ];

  beforeEach(async () => {
    [owner, user, victim] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('Mutation');
    const proxy = await upgrades.deployProxy(Factory, [evolveFee], { initializer: 'initialize' });
    evolve = Factory.attach(await proxy.getAddress()) as Mutation;
    await evolve.waitForDeployment();

    await evolve.registerPairs(ogHashes, quantumHashes);

    // Owner deposits all 6 ethscriptions
    const allHashes = [...ogHashes, ...quantumHashes];
    const data = '0x' + allHashes.map((h) => h.slice(2)).join('');
    await owner.sendTransaction({ to: await evolve.getAddress(), data });

    const AttackerFactory = await ethers.getContractFactory('MockReentrancyAttacker');
    attacker = (await AttackerFactory.deploy()) as MockReentrancyAttacker;
    await attacker.waitForDeployment();
    await attacker.setTarget(await evolve.getAddress());
  });

  // ── Helper: give attacker some pendingReturns via excess-ETH refund failure ──────
  async function buildAttackerPendingReturns(): Promise<bigint> {
    // Register a fresh pair specifically for the attacker
    const attackOg = createHashId('sec-attacker-og-reentrant');
    const attackQuantum = createHashId('sec-attacker-quantum-reentrant');
    await evolve.registerPairs([attackOg], [attackQuantum]);

    // Owner deposits the quantum side
    await owner.sendTransaction({ to: await evolve.getAddress(), data: attackQuantum });

    // Attacker deposits OG side with rejectMode=true so excess refund fails
    await attacker.setRejectMode(true);

    const excess = ethers.parseEther('0.01');
    // callTarget forwards the 32-byte hash as raw calldata with value = fee + excess
    // The evolve fallback auto-evolves on receiving an OG hash → sends quantum to attacker,
    // then tries to refund excess → push fails → pendingReturns[attacker] = excess
    await attacker.callTarget(attackOg, { value: evolveFee + excess });

    const pending = await evolve.pendingReturns(await attacker.getAddress());
    expect(pending).to.equal(excess);

    await attacker.setRejectMode(false);
    return pending;
  }

  it('nonReentrant blocks reentrancy on withdraw()', async () => {
    const pending = await buildAttackerPendingReturns();

    await attacker.attack();

    expect(await attacker.reentryAttempted()).to.be.true;
    expect(await attacker.reentrySucceeded()).to.be.false;

    expect(await attacker.getBalance()).to.equal(pending);
    expect(await evolve.pendingReturns(await attacker.getAddress())).to.equal(0n);
  });

  it('non-owner cannot call redirectPendingReturns', async () => {
    await expect(
      evolve.connect(user).redirectPendingReturns(victim.address, user.address),
    ).to.be.revertedWithCustomError(evolve, 'OwnableUnauthorizedAccount');
  });

  it('attacker cannot steal another users pending balance via redirect', async () => {
    const pending = await buildAttackerPendingReturns();
    const attackerAddr = await attacker.getAddress();
    expect(pending).to.be.gt(0n);

    // Non-owner (user) tries to redirect attacker's balance to themselves
    await expect(
      evolve.connect(user).redirectPendingReturns(attackerAddr, user.address),
    ).to.be.revertedWithCustomError(evolve, 'OwnableUnauthorizedAccount');

    expect(await evolve.pendingReturns(attackerAddr)).to.equal(pending);
  });

  it('double-withdraw: second call reverts with nothing to withdraw', async () => {
    const pending = await buildAttackerPendingReturns();

    // Redirect to victim so we can test with a clean EOA
    await evolve.redirectPendingReturns(await attacker.getAddress(), victim.address);
    expect(await evolve.pendingReturns(victim.address)).to.equal(pending);

    await expect(evolve.connect(victim).withdraw()).to.not.be.reverted;
    await expect(evolve.connect(victim).withdraw()).to.be.revertedWith('Nothing to withdraw');
  });

  it('non-depositor cannot evolve a phunk they did not deposit', async () => {
    // ogHashes[0] was deposited by owner, not user
    await expect(
      evolve.connect(user).evolve(ogHashes[0], { value: evolveFee }),
    ).to.be.revertedWithCustomError(evolve, 'NotDepositor');
  });

  it('non-depositor cannot devolve a quantum they did not deposit', async () => {
    // quantumHashes[0] was deposited by owner, not user
    await expect(
      evolve.connect(user).devolve(quantumHashes[0]),
    ).to.be.revertedWithCustomError(evolve, 'NotDepositor');
  });

  it('redirectPendingReturns to zero address reverts', async () => {
    await expect(
      evolve.redirectPendingReturns(user.address, ethers.ZeroAddress),
    ).to.be.revertedWith('Invalid address');
  });

  it('redirectPendingReturns from address with zero balance reverts', async () => {
    await expect(
      evolve.redirectPendingReturns(user.address, victim.address),
    ).to.be.revertedWith('Nothing to redirect');
  });

  it('owner can legitimately redirect stuck smart-contract-wallet funds to an EOA', async () => {
    const pending = await buildAttackerPendingReturns();
    const stuckWallet = await attacker.getAddress();

    await evolve.redirectPendingReturns(stuckWallet, victim.address);
    expect(await evolve.pendingReturns(stuckWallet)).to.equal(0n);
    expect(await evolve.pendingReturns(victim.address)).to.equal(pending);

    await expect(evolve.connect(victim).withdraw()).to.not.be.reverted;
  });
});
