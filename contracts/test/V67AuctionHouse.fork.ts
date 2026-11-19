import { expect } from 'chai';
import { ethers, upgrades, network } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

// Mainnet-fork test of V67AuctionHouse against the REAL deployed v67 proxy and the REAL lottery
// (their real owner, whitelist state and token holders). Local fork only, nothing is broadcast.
// Follows the launch order: lottery.reserveMintBatch -> guardian, whitelist, approve, deposit, start.
// Run: FORK_URL=<rpc> npx hardhat test test/V67AuctionHouse.fork.ts   (defaults to eth.drpc.org)

const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const QP_ETH = '0x19d57A31b982d3d75c16358795A4D19c803e4A72'; // quantumphunks.eth: v67 owner, lottery owner
const LOTTERY = '0x702862d4cb2E55452170814AAb9117cDE8287e61';
const V66 = '0x988D066A0fad76a89DDc87bBF16e92E1187A477c'; // PhilipLotteryV66 "non-turtle" proxy, owner quantumphunks.eth
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const FORK_BLOCK = 26437484;
const ETH = ethers.parseEther;

const V67_ABI = [
  'function owner() view returns (address)',
  'function ownerOf(uint256) view returns (address)',
  'function operatorWhitelistEnabled() view returns (bool)',
  'function approvedOperators(address) view returns (bool)',
  'function setApprovedOperator(address,bool)',
  'function setApprovalForAll(address,bool)',
];
const LOTTERY_ABI = ['function owner() view returns (address)', 'function reserveMintBatch(address,uint256[])'];

async function impersonate(addr: string) {
  await network.provider.request({ method: 'hardhat_impersonateAccount', params: [addr] });
  await network.provider.send('hardhat_setBalance', [addr, '0x' + ETH('100').toString(16)]);
  return ethers.getSigner(addr);
}

describe('V67AuctionHouse on a mainnet fork (real v67 + real lottery)', function () {
  this.timeout(900_000);

  before(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [{ forking: { jsonRpcUrl: process.env.FORK_URL || 'https://eth.drpc.org', blockNumber: FORK_BLOCK } }],
    });
  });
  after(async () => {
    await network.provider.request({ method: 'hardhat_reset', params: [] });
  });

  it('lottery -> guardian -> deposit -> bid/settle/payout; de-whitelisting only blocks deposits', async () => {
    const [deployer, payout, alice, bob] = await ethers.getSigners();
    const v67 = new ethers.Contract(V67, V67_ABI, ethers.provider);
    const lottery = new ethers.Contract(LOTTERY, LOTTERY_ABI, ethers.provider);
    expect(await v67.owner()).to.equal(QP_ETH);
    expect(await lottery.owner()).to.equal(QP_ETH);
    expect(await v67.operatorWhitelistEnabled()).to.equal(true);

    const qp = await impersonate(QP_ETH); // guardian here, as in the launch order
    const F = await ethers.getContractFactory('V67AuctionHouse');
    const house: any = await upgrades.deployProxy(F, [V67, WETH, payout.address, QP_ETH, deployer.address], { kind: 'uups' });
    const houseAddr = await house.getAddress();

    // 1. both lotteries send pool pieces to the guardian, via their real release functions.
    //    0x7028 (PhilipLotteryV67Erc721) holds non-turtle, non-Dysto pieces: reserveMintBatch.
    //    0x988D (PhilipLotteryV66, "non-turtle") holds Dysto + non-Dysto pieces: withdrawItems.
    const fromErc721Lottery = [4, 11, 16, 24, 36, 45, 47, 49, 57, 63, 71, 77, 78, 86, 92];
    const fromV66 = [3, 5, 6, 7, 10, 13, 14, 21, 23, 25]; // Dysto
    for (const id of fromErc721Lottery) expect(await v67.ownerOf(id)).to.equal(LOTTERY);
    for (const id of fromV66) expect(await v67.ownerOf(id)).to.equal(V66);
    const r = await (await (lottery.connect(qp) as any).reserveMintBatch(QP_ETH, fromErc721Lottery)).wait();
    const v66 = new ethers.Contract(V66, ['function withdrawItems(address,uint256[])'], qp);
    const w = await (await (v66 as any).withdrawItems(QP_ETH, fromV66)).wait();
    console.log(`      0x7028 reserveMintBatch x${fromErc721Lottery.length}: ${r.gasUsed} gas (${(Number(r.gasUsed) / fromErc721Lottery.length).toFixed(0)}/piece)`);
    console.log(`      0x988D withdrawItems x${fromV66.length}: ${w.gasUsed} gas (${(Number(w.gasUsed) / fromV66.length).toFixed(0)}/piece)`);
    const ids = [...fromErc721Lottery, ...fromV66];
    for (const id of ids) expect(await v67.ownerOf(id)).to.equal(QP_ETH);

    // 2. without the whitelist entry the real v67 refuses the approval
    await expect((v67.connect(qp) as any).setApprovalForAll(houseAddr, true)).to.be.reverted;
    await (v67.connect(qp) as any).setApprovedOperator(houseAddr, true);
    await (v67.connect(qp) as any).setApprovalForAll(houseAddr, true);

    // 3. guardian deposits; nobody else can
    await expect(house.connect(alice).deposit([2])).to.be.revertedWithCustomError(house, 'NotGuardian');
    const d = await (await house.connect(qp).deposit(ids)).wait();
    console.log(`      deposit x${ids.length}: ${d.gasUsed} gas (${(Number(d.gasUsed) / ids.length).toFixed(0)}/piece)`);
    expect(await house.poolSize()).to.equal(ids.length);

    // 4. start, bid, settle
    await house.connect(deployer).start();
    let [, tokenId, , , , endTime] = await house.currentAuction();
    await house.connect(alice).createBid(await house.nft(), tokenId, { value: ETH('0.01') });
    await house.connect(bob).createBid(await house.nft(), tokenId, { value: ETH('0.02') });
    await time.increaseTo(endTime);
    const before = await ethers.provider.getBalance(payout.address);
    const s = await (await house.connect(alice).settleCurrentAndCreateNewAuction()).wait();
    expect((await ethers.provider.getBalance(payout.address)) - before).to.equal(ETH('0.02'));
    expect(await v67.ownerOf(tokenId)).to.equal(bob.address);
    console.log(`      settle+open on real v67: ${s.gasUsed} gas`);

    // 5. de-whitelist: settling is unaffected, deposits stop
    await (v67.connect(qp) as any).setApprovedOperator(houseAddr, false);
    [, tokenId, , , , endTime] = await house.currentAuction();
    await house.connect(alice).createBid(await house.nft(), tokenId, { value: ETH('0.05') });
    await time.increaseTo(endTime);
    await house.connect(bob).settleCurrentAndCreateNewAuction();
    expect(await v67.ownerOf(tokenId)).to.equal(alice.address);
    await (v66 as any).withdrawItems(QP_ETH, [98]); // #98 sits in the V66 lottery
    expect(await v67.ownerOf(98)).to.equal(QP_ETH);
    await expect(house.connect(qp).deposit([98])).to.be.reverted;
  });
});
