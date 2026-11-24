import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

describe("Phunkmas", () => {
  async function deploy() {
    const [owner, treasury, market, alice, bob, opensea] = await ethers.getSigners();
    const F = await ethers.getContractFactory("Phunkmas");
    const c: any = await F.deploy("Phunkmas", "PHMAS", owner.address);   // plain contract, no proxy
    await c.waitForDeployment();
    return { c, owner, treasury, market, alice, bob, opensea };
  }

  it("init: cap 67, name, background", async () => {
    const { c } = await deploy();
    expect(await c.maxSupply()).to.equal(67n);
    expect(await c.singleName()).to.equal("Phunkmas");
    expect(await c.backgroundColor()).to.equal("638596");
  });

  it("tradable anywhere: any market can be approved and move it", async () => {
    const { c, alice, bob, market, opensea } = await deploy();
    expect(c.interface.getFunction("setApprovedOperator")).to.equal(null);
    expect(c.interface.getFunction("setTransferValidator")).to.equal(null);
    await c.setTokenImage(10454, "data:image/png;base64,AAAA");
    await c.ownerMint(alice.address, 10454);
    await c.connect(alice).setApprovalForAll(opensea.address, true);
    await c.connect(opensea).transferFrom(alice.address, bob.address, 10454);
    await c.connect(bob).approve(market.address, 10454);
    await c.connect(market).transferFrom(bob.address, alice.address, 10454);
    await c.connect(alice).transferFrom(alice.address, bob.address, 10454);   // wallet send
    expect(await c.ownerOf(10454)).to.equal(bob.address);
  });

  it("no royalty: royaltyInfo is (0, 0) and can't be set", async () => {
    const { c } = await deploy();
    const [r, amt] = await c.royaltyInfo(10454, ethers.parseEther("1"));
    expect(r).to.equal(ethers.ZeroAddress); expect(amt).to.equal(0n);
    expect(c.interface.getFunction("setRoyaltyRate")).to.equal(null);
    expect(c.interface.getFunction("setRoyaltyReceiver")).to.equal(null);
    expect(await c.supportsInterface("0x80ac58cd")).to.equal(true);   // ERC-721
  });

  it("cap enforced, no provenance functions", async () => {
    const { c, owner } = await deploy();
    const all = Array.from({ length: 67 }, (_, i) => 10454 + i);
    await c.setTokenImageBatch(all, all.map(() => "data:image/png;base64,AAAA"));
    await c.ownerMintBatch(owner.address, all);
    expect(await c.totalSupply()).to.equal(67n);
    await expect(c.ownerMint(owner.address, 10521)).to.be.revertedWithCustomError(c, "TokenIdOutOfRange");
    await expect(c.ownerMint(owner.address, 10453)).to.be.revertedWithCustomError(c, "TokenIdOutOfRange");
    await expect(c.ownerMint(owner.address, 10454)).to.be.reverted;   // already minted
    expect(c.interface.getFunction("tokenSha")).to.equal(null);
    expect(c.interface.getFunction("batchSetProvenance")).to.equal(null);
  });

  it("populates from the generated JSON and renders tokenURI", async () => {
    const { c, owner } = await deploy();
    const f = path.join(__dirname, "../scripts/generated/phunksmas_items.json");
    const items = JSON.parse(fs.readFileSync(f, "utf8")).items;
    const ids = items.map((i: any) => i.tokenId);
    // real order: art first (minting requires it), then mint, then traits, then freeze
    await c.setTokenImageBatch(ids, items.map((i: any) => i.image));
    await c.ownerMintBatch(owner.address, ids);
    await c.batchSetTraits(ids, items.map((i: any) => i.attributes.map((a: any) => a.trait_type)),
      items.map((i: any) => i.attributes.map((a: any) => a.value)));
    for (const it of items) {
      expect(await c.tokenImage(it.tokenId)).to.equal(it.image);
      const uri: string = await c.tokenURI(it.tokenId);
      const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
      expect(json.name).to.equal(`Phunkmas #${it.tokenId}`);
      expect(json.attributes).to.deep.equal(it.attributes);
      expect(json.animation_url.startsWith("data:text/html;base64,")).to.equal(true);
      const page = Buffer.from(json.animation_url.split(",")[1], "base64").toString("utf8");
      expect(page).to.contain("background:#638596");
      expect(page).to.contain(it.image);
      expect(page).to.contain('p.classList.toggle("r")');
    }
    await c.freeze(ids);
    for (const id of ids) expect(await c.frozen(id)).to.equal(true);
    await expect(c.setTokenImage(ids[0], "data:image/png;base64,AAAA")).to.be.revertedWithCustomError(c, "TokenIsFrozen");
  });
});
