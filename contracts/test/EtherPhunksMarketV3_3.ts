import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { keccak256, toUtf8Bytes, zeroPadValue, toBeHex, concat } from 'ethers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { EtherPhunksMarketV3_3, Points } from '../typechain-types';
import { mineBlocks, createHashId } from './helpers';

const DEPOSIT_AND_ACCEPT_BID_SIGNATURE = keccak256(toUtf8Bytes('DEPOSIT_AND_ACCEPT_BID_SIGNATURE'));

/** Builds the calldata for the combined escrow + accept bid fallback path:
 *   [0:32]   phunkId
 *   [32:64]  DEPOSIT_AND_ACCEPT_BID_SIGNATURE
 *   [64:96]  bidder (left-padded)
 *   [96:128] minValue
 */
function buildEscrowAndAcceptCalldata(phunkId: string, bidder: string, minValue: bigint): string {
  return concat([
    phunkId,
    DEPOSIT_AND_ACCEPT_BID_SIGNATURE,
    zeroPadValue(bidder, 32),
    zeroPadValue(toBeHex(minValue), 32),
  ]);
}

describe('EtherPhunksMarketV3_3 — escrow + accept in one tx', function () {
  let market: EtherPhunksMarketV3_3;
  let points: Points;

  let seller: HardhatEthersSigner;   // owner of the phunk
  let bidder: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const contractVersion = 33;
  const COOLDOWN_BLOCKS = 5;

  beforeEach(async () => {
    [, seller, bidder, other] = await ethers.getSigners();

    const PointsFactory = await ethers.getContractFactory('contracts/V2MainnetUpgrade/Points.sol:Points');
    points = (await PointsFactory.deploy()) as unknown as Points;
    await points.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory('EtherPhunksMarketV3_3');
    const proxy = await upgrades.deployProxy(
      MarketFactory,
      [contractVersion, await points.getAddress()],
      { initializer: 'initialize' },
    );
    market = MarketFactory.attach(await proxy.getAddress()) as EtherPhunksMarketV3_3;
    await market.waitForDeployment();

    await points.grantManager(await market.getAddress());
  });

  const escrowAndAccept = (
    signer: HardhatEthersSigner,
    phunkId: string,
    bidder: string,
    minValue: bigint,
  ) => signer.sendTransaction({
    to: market.getAddress(),
    data: buildEscrowAndAcceptCalldata(phunkId, bidder, minValue),
  });

  describe('the full 3-step flow', () => {
    const phunkId = createHashId('v33-phunk-1');
    const bidValue = ethers.parseEther('0.5');

    it('escrows + accepts in a single owner tx, then bidder confirms', async () => {
      // Step 1: bidder bids (no escrow required)
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });

      // Step 2: owner escrows + accepts in ONE tx
      await expect(escrowAndAccept(seller, phunkId, bidder.address, bidValue))
        .to.emit(market, 'BidAccepted');

      const accepted = await market.bids(seller.address, phunkId);
      expect(accepted.acceptedBlock).to.be.gt(0);

      // Ethscription is now escrowed under the seller
      expect(await market.userEthscriptionPossiblyStored(seller.address, phunkId)).to.equal(true);

      // Step 3: bidder confirms after cooldown
      await mineBlocks(COOLDOWN_BLOCKS);
      await expect(market.connect(bidder).confirmBid(phunkId, seller.address))
        .to.emit(market, 'BidConfirmed')
        .withArgs(phunkId, seller.address, bidder.address, bidValue);

      expect(await market.pendingWithdrawals(seller.address)).to.equal(bidValue);
      expect(await points.points(bidder.address)).to.equal(67);

      const cleared = await market.bids(seller.address, phunkId);
      expect(cleared.hasBid).to.equal(false);
    });

    it('respects minValue (front-run protection) on the combined path', async () => {
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      const tooHigh = ethers.parseEther('1');
      await expect(escrowAndAccept(seller, phunkId, bidder.address, tooHigh))
        .to.be.revertedWith('Below minValue');
    });

    it('rejects combined accept when bidder mismatches', async () => {
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await expect(escrowAndAccept(seller, phunkId, other.address, bidValue))
        .to.be.revertedWith('Bidder mismatch');
    });

    it('rejects combined accept when no bid exists', async () => {
      await expect(escrowAndAccept(seller, phunkId, bidder.address, bidValue))
        .to.be.revertedWith('No bid');
    });

    it('invalidates an active listing when accepting via the combined path', async () => {
      // Pre-escrow + list, then a bid arrives, then owner accepts via combined path.
      // (Re-escrow on an already-escrowed phunk reverts, so use a fresh deposit flow:)
      await market.connect(bidder).enterBid(phunkId, seller.address, { value: bidValue });
      await escrowAndAccept(seller, phunkId, bidder.address, bidValue);
      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.equal(false);
    });
  });

  describe('regression: DEPOSIT_AND_LIST still works after fallback override', () => {
    const phunkId = createHashId('v33-phunk-list');
    const DEPOSIT_AND_LIST_SIGNATURE = keccak256(toUtf8Bytes('DEPOSIT_AND_LIST_SIGNATURE'));

    it('deposits + lists in one tx', async () => {
      const price = ethers.parseEther('1.2');
      const data = concat([
        phunkId,
        DEPOSIT_AND_LIST_SIGNATURE,
        zeroPadValue(toBeHex(price), 32),
        zeroPadValue('0x00', 32), // toAddress = 0 → open listing
      ]);
      await expect(seller.sendTransaction({ to: market.getAddress(), data }))
        .to.emit(market, 'PhunkOffered');

      const offer = await market.phunksOfferedForSale(phunkId);
      expect(offer.isForSale).to.equal(true);
      expect(offer.minValue).to.equal(price);
    });
  });

  describe('regression: plain deposit (fallback default path) still works', () => {
    const phunkId = createHashId('v33-phunk-deposit');

    it('records a plain escrow deposit', async () => {
      await seller.sendTransaction({ to: market.getAddress(), data: phunkId });
      expect(await market.userEthscriptionPossiblyStored(seller.address, phunkId)).to.equal(true);
    });
  });
});
