// Phunkmas: still image + separate creation animation. Local-only check with the real art: ANIM_DIR holds
// <tokenId>.gif.datauri.txt files; the still PNGs come from scripts/generated/phunksmas_items.json.
// Skipped when ANIM_DIR is not set.
import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const dir = process.env.ANIM_DIR;
const TX_CAP = 16_777_216n;                                         // Osaka per-transaction gas cap
const READ_CAP = BigInt(process.env.READ_CAP ?? 16_000_000);        // tokenURI must read under this
const PART = 30_000;                                                // max chars per upload tx / Etherscan paste

describe("Phunkmas size caps keep tokenURI readable", () => {
  it("largest allowed still + largest allowed animation reads under the cap", async () => {
    const [o] = await ethers.getSigners();
    const c: any = await (await ethers.getContractFactory("Phunkmas")).deploy("Phunkmas", "PHMAS", o.address);
    const id = 10454;
    const maxImg = Number(await c.MAX_IMAGE_BYTES()), maxAnim = Number(await c.MAX_ANIMATION_BYTES());
    const img = "data:image/png;base64," + "A".repeat(maxImg - 22);
    await c.setTokenImage(id, img);
    await expect(c.addTokenImageChunk(id, "A")).to.be.revertedWithCustomError(c, "ImageTooLarge");
    await c.ownerMint(o.address, id);
    const est = async () => ethers.provider.estimateGas({ to: await c.getAddress(), data: c.interface.encodeFunctionData("tokenURI", [id]) });
    expect(await est()).to.be.lessThan(READ_CAP);                       // no animation: still encoded twice
    const anim = "data:image/gif;base64," + "A".repeat(maxAnim - 22);
    await c.setTokenAnimation(id, anim.slice(0, PART));
    await c.addTokenAnimationChunk(id, anim.slice(PART));
    expect(await est()).to.be.lessThan(READ_CAP);                       // still + animation
  });
});

(dir ? describe : describe.skip)("Phunkmas still + animation (real art)", () => {
  const items: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, "../scripts/generated/phunksmas_items.json"), "utf8")).items;
  const anims = dir ? fs.readdirSync(dir).filter((f) => f.endsWith(".gif.datauri.txt")) : [];
  const rows: string[] = [];
  after(() => { if (rows.length) console.log("\n" + rows.join("\n")); });

  async function deploy() {
    const [owner, alice] = await ethers.getSigners();
    const c: any = await (await ethers.getContractFactory("Phunkmas")).deploy("Phunkmas", "PHMAS", owner.address);
    await c.waitForDeployment();
    return { c, owner, alice };
  }
  // upload in parts like the real sender: setTokenAnimation(first part) + addTokenAnimationChunk(rest)
  async function upload(c: any, id: number, uri: string) {
    const parts: string[] = []; for (let i = 0; i < uri.length; i += PART) parts.push(uri.slice(i, i + PART));
    const gas: bigint[] = [];
    for (const [k, p] of parts.entries()) {
      const tx = k === 0 ? await c.setTokenAnimation(id, p) : await c.addTokenAnimationChunk(id, p);
      const rc = await tx.wait(); gas.push(rc.gasUsed);
      expect(rc.gasUsed).to.be.lessThan(TX_CAP);
    }
    return gas;
  }

  for (const f of anims) {
    const id = Number(f.split(".")[0]);
    it(`#${id}: still stays the thumbnail, animation autoplays with flip`, async () => {
      const { c, alice } = await deploy();
      const item = items.find((x) => x.tokenId === id);
      const uri = fs.readFileSync(path.join(dir!, f), "utf8").trim();
      expect(uri.startsWith("data:image/gif;base64,")).to.equal(true);
      expect(uri.length).to.be.at.most(Number(await c.MAX_ANIMATION_BYTES()));

      await c.setTokenImage(id, item.image);
      await c.ownerMint(alice.address, id);
      await c.batchSetTraits([id], [item.attributes.map((a: any) => a.trait_type)], [item.attributes.map((a: any) => String(a.value))]);
      const gas = await upload(c, id, uri);

      expect(await c.tokenImage(id)).to.equal(item.image);        // still untouched
      expect(await c.tokenAnimation(id)).to.equal(uri);           // animation byte-identical
      expect(await c.hasAnimation(id)).to.equal(true);

      const readGas = await ethers.provider.estimateGas({ to: await c.getAddress(), data: c.interface.encodeFunctionData("tokenURI", [id]) });
      expect(readGas).to.be.lessThan(READ_CAP);
      const json = JSON.parse(Buffer.from((await c.tokenURI(id)).split(",")[1], "base64").toString("utf8"));
      const svg = Buffer.from(json.image.split(",")[1], "base64").toString("utf8");
      const page = Buffer.from(json.animation_url.split(",")[1], "base64").toString("utf8");
      expect(svg).to.contain(`href="${item.image}"`);             // thumbnail = the still PNG
      expect(svg).to.not.contain("data:image/gif");
      expect(page).to.contain(`src="${item.image}"`);              // viewer opens on the still...
      expect(page).to.contain(`data-a="${uri}"`);                  // ...with the GIF ready to start on click
      expect(page).to.contain('<div id=n><b></b><b></b><b></b></div>'); // view tray
      expect(page).to.contain('"url("+(k==1?A:S)+")"');              // tray: the animation thumbnail plays
      expect(page).to.not.contain("id=t");                          // no words
      expect(page).to.contain('p.src=v==1?A+"#"+(++c):S');           // MAKING OF restarts the animation
      expect(page).to.contain('p.classList.toggle("r")');          // click the picture to flip
      expect(page).to.contain(".r{transform:scaleX(-1)}");
      expect(json.attributes.length).to.equal(item.attributes.length);
      if (process.env.ANIM_OUT) {
        fs.writeFileSync(path.join(process.env.ANIM_OUT, `${id}.flip.html`), page);
        fs.writeFileSync(path.join(process.env.ANIM_OUT, `${id}.image.svg`), svg);
        const desc = process.env.DESC_FILE ? fs.readFileSync(process.env.DESC_FILE, "utf8").trim() : "";
        if (desc) await c.setDescription(desc);
        const meta = JSON.parse(Buffer.from((await c.tokenURI(id)).split(",")[1], "base64").toString("utf8"));
        fs.writeFileSync(path.join(process.env.ANIM_OUT, `${id}.meta.json`), JSON.stringify({ name: meta.name, description: meta.description,
          attributes: meta.attributes, collection: await c.name(), symbol: await c.symbol(), singleName: await c.singleName() }, null, 1));
      }
      rows.push(`      #${id} ${String(uri.length).padStart(6)} B anim | upload ${gas.length} tx (${gas.map((g) => (Number(g) / 1e6).toFixed(2) + "M").join(" + ")}) | tokenURI read ${(Number(readGas) / 1e6).toFixed(2)}M`);

      // freeze locks the animation too
      await c.freeze([id]);
      await expect(c.setTokenAnimation(id, uri.slice(0, 100))).to.be.revertedWithCustomError(c, "TokenIsFrozen");
      await expect(c.addTokenAnimationChunk(id, "AAAA")).to.be.revertedWithCustomError(c, "TokenIsFrozen");
      await expect(c.clearTokenAnimation(id)).to.be.revertedWithCustomError(c, "TokenIsFrozen");
    });
  }

  it("no animation -> plain click-to-flip on the still; clear falls back; guards", async () => {
    const { c, alice } = await deploy();
    const item = items[0]; const id = item.tokenId;
    await c.setTokenImage(id, item.image); await c.ownerMint(alice.address, id);
    const read = async () => JSON.parse(Buffer.from((await c.tokenURI(id)).split(",")[1], "base64").toString("utf8"));
    let page = Buffer.from((await read()).animation_url.split(",")[1], "base64").toString("utf8");
    expect(page).to.contain(`src="${item.image}"`);
    await c.setTokenAnimation(id, "data:image/gif;base64,R0lGODlhAQABAAAAACw=");
    page = Buffer.from((await read()).animation_url.split(",")[1], "base64").toString("utf8");
    expect(page).to.contain('data-a="data:image/gif;base64,R0lGODlhAQABAAAAACw="');
    expect(page).to.contain(`src="${item.image}"`);
    await c.clearTokenAnimation(id);
    expect(await c.hasAnimation(id)).to.equal(false);
    page = Buffer.from((await read()).animation_url.split(",")[1], "base64").toString("utf8");
    expect(page).to.contain(`src="${item.image}"`);
    expect(page).to.not.contain("data-a=");                         // plain click-to-flip again
    expect(page).to.not.contain("<div id=n>");
    // guards
    await expect(c.addTokenAnimationChunk(id, "AAAA")).to.be.revertedWithCustomError(c, "BadImage");       // must start with set
    await expect(c.setTokenAnimation(id, "notadatauri")).to.be.revertedWithCustomError(c, "BadImage");
    await expect(c.setTokenAnimation(id, 'data:image/gif;base64,"x')).to.be.revertedWithCustomError(c, "BadImage");
    await expect(c.connect(alice).setTokenAnimation(id, "data:image/gif;base64,AAAA")).to.be.reverted;      // owner only
    const max = Number(await c.MAX_ANIMATION_BYTES());
    await c.setTokenAnimation(id, "data:image/gif;base64," + "A".repeat(24_000));
    await expect(c.addTokenAnimationChunk(id, "A".repeat(max))).to.be.revertedWithCustomError(c, "ImageTooLarge");
    await expect(c.setTokenAnimation(10453, "data:image/gif;base64,AAAA")).to.be.revertedWithCustomError(c, "TokenIdOutOfRange");
  });
});
