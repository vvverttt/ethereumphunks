import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// QuantumTurtlez is the live CryptoPhunksV67 (Flip + V2 operator controls) for turtles only:
// these check the few things that differ (name, cap) and that the copied behaviour still holds.
describe('QuantumTurtlez', function () {
  const PNG = 'data:image/png;base64,' + fs.readFileSync(
    path.join(__dirname, '../../turtle_editor/data/original/1.png')).toString('base64');

  async function deploy() {
    const [owner, holder, market, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory('QuantumTurtlez');
    const nft: any = await upgrades.deployProxy(F, ['QuantumTurtlez', 'QTURTLE', owner.address, owner.address], { kind: 'uups' });
    await nft.waitForDeployment();
    return { nft, owner, holder, market, other };
  }
  const decode = (uri: string) => JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

  it('initialises as a turtles-only v67 copy', async function () {
    const { nft, owner } = await deploy();
    expect(await nft.name()).to.equal('QuantumTurtlez');
    expect(await nft.symbol()).to.equal('QTURTLE');
    expect(await nft.singleName()).to.equal('QuantumTurtlez');
    expect(await nft.maxSupply()).to.equal(4267n);
    expect(await nft.backgroundColor()).to.equal('638596');
    expect(await nft.owner()).to.equal(owner.address);
    const [recv, amt] = await nft.royaltyInfo(1, 10000);
    expect(recv).to.equal(owner.address);
    expect(amt).to.equal(500n);
  });

  it('stores the image byte-exact and renders on-chain metadata', async function () {
    const { nft, holder } = await deploy();
    await nft.setTokenImageBatch([1], [PNG]);
    await nft.batchSetTraits([1], [['Animal', 'Type', 'Attribute Count']], [['Turtle', 'Male', '2']]);
    await nft.ownerMintBatch(holder.address, [1]);
    expect(await nft.tokenImage(1)).to.equal(PNG);
    const j = decode(await nft.tokenURI(1));
    expect(j.name).to.equal('QuantumTurtlez #1');
    expect(j.background_color).to.equal('638596');
    expect(j.attributes).to.deep.equal([
      { trait_type: 'Animal', value: 'Turtle' }, { trait_type: 'Type', value: 'Male' }, { trait_type: 'Attribute Count', value: '2' }]);
    // the SVG thumbnail embeds the exact stored PNG, and animation_url is the click-to-flip page
    expect(Buffer.from(j.image.split(',')[1], 'base64').toString()).to.contain(PNG);
    expect(j.animation_url.startsWith('data:text/html;base64,')).to.equal(true);
    expect(await nft.hasTrait(1, 'Type', 'Male')).to.equal(true);
  });

  it('caps supply at 4267 tokens', async function () {
    const { nft, holder } = await deploy();
    const ids = Array.from({ length: 4267 }, (_, i) => i + 1);
    for (let i = 0; i < ids.length; i += 500) await nft.ownerMintBatch(holder.address, ids.slice(i, i + 500));
    expect(await nft.totalSupply()).to.equal(4267n);
    await expect(nft.ownerMintBatch(holder.address, [4268])).to.be.revertedWithCustomError(nft, 'MaxSupplyExceeded');
  });

  it('blocking an operator voids approvals granted before (V2 behaviour)', async function () {
    const { nft, holder, market, other } = await deploy();
    await nft.ownerMintBatch(holder.address, [1, 2]);
    await nft.connect(holder).setApprovalForAll(market.address, true);
    await nft.connect(holder).approve(other.address, 2);
    await nft.setBlockedOperator(market.address, true);
    await nft.setBlockedOperator(other.address, true);
    expect(await nft.isApprovedForAll(holder.address, market.address)).to.equal(false);
    expect(await nft.getApproved(2)).to.equal(ethers.ZeroAddress);
    expect((await nft.operatorStatus(holder.address, market.address))[1]).to.equal('blocked');
    await expect(nft.connect(market).transferFrom(holder.address, market.address, 1)).to.be.reverted;
    await expect(nft.connect(other).transferFrom(holder.address, other.address, 2)).to.be.reverted;
    await nft.setBlockedOperator(market.address, false);
    await nft.connect(market).transferFrom(holder.address, market.address, 1);
    expect(await nft.ownerOf(1)).to.equal(market.address);
  });

  it('only the owner can write metadata, mint or upgrade', async function () {
    const { nft, other } = await deploy();
    await expect(nft.connect(other).setTokenImageBatch([1], [PNG])).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    await expect(nft.connect(other).batchSetTraits([1], [['a']], [['b']])).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    await expect(nft.connect(other).ownerMintBatch(other.address, [1])).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
    await expect(nft.connect(other).upgradeToAndCall(ethers.ZeroAddress, '0x')).to.be.revertedWithCustomError(nft, 'OwnableUnauthorizedAccount');
  });
});
