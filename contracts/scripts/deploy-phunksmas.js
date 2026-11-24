#!/usr/bin/env node
/*
  Phunksmas deploy + populate + mint, using a throwaway deployer key file.

    node scripts/deploy-phunksmas.js --rpc <url> [--burner ../.burner-phunksmas-v2] [--tag v2]
                                     [--anim-dir scripts/generated/phunksmas_animations] [--only <ids>]
                                     [--contract Phunkmas] [--desc scripts/generated/phunkmas_description.txt]
                                     [--freeze] [--handoff] [--yes]

  --tag keeps a separate state file per deployment (phunksmas_deploy_state.<tag>.<chainId>.json), so a new
  deploy never picks up an earlier one's address. The first deploy (0x676F…10d5) used no tag.

  Steps (each is skipped if already done, so the script can be re-run after a failure):
    1. deploy Phunksmas("Phunksmas", "PHMAS", deployer)      deployer owns it while populating
    2. setTokenImageBatch   (art first: minting requires an image)
    2b. animations (--anim-dir/<tokenId>.txt): setTokenAnimation(first ≤30 KB) + addTokenAnimationChunk(rest)
    3. batchSetTraits
    4. ownerMintBatch -> quantumphunks.eth
    5. --freeze   : freeze() every populated token (image + traits locked forever)
    6. --handoff  : transferOwnership(quantumphunks.eth) — two-step: quantumphunks.eth must then call
                    acceptOwnership() itself (Etherscan "Write Contract") before it becomes owner.

  Without --yes it only prints the plan + gas estimate and sends nothing.
  Plain ethers (not hardhat-ethers): see the creation-tx bug note in project memory.
  State is kept in scripts/generated/phunksmas_deploy_state.[<tag>.]<chainId>.json.
*/
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const QUANTUMPHUNKS_ETH = "0x19d57A31b982d3d75c16358795A4D19c803e4A72";
const BATCH = 6;   // images per tx (each ~2 KB image ≈ 0.5M gas)
const ANIM_PART = 30_000;           // chars per animation tx (~9.8M gas) — also a sane Etherscan paste size
const TX_GAS_CAP = 16_500_000n;     // under the 16,777,216 per-transaction protocol cap

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
// --contract Phunkmas : the renamed redeploy (contract, collection name and token titles all "Phunkmas")
const NAME = opt("--contract") || "Phunksmas", SYMBOL = "PHMAS";
const MAX_GWEI = opt("--max-gwei");   // e.g. 0.2: wait while gas is above it; no tx ever pays more
const RPC = opt("--rpc");
if (!RPC) { console.error("usage: node scripts/deploy-phunksmas.js --rpc <url> [--freeze] [--handoff] [--yes]"); process.exit(1); }

const keyFile = path.resolve(opt("--burner") || path.join(__dirname, "..", "..", ".burner-phunksmas"));
const TAG = opt("--tag");
const ANIM_DIR = path.resolve(opt("--anim-dir") || path.join(__dirname, "generated", "phunksmas_animations"));
const { privateKey, address: keyAddr, vanityContractAddress } = JSON.parse(fs.readFileSync(keyFile, "utf8"));
// hardhat writes artifacts to %TEMP%\ethereumphunks-hardhat (see hardhat.config.ts HH_WORKDIR)
const HH_WORKDIR = path.join(process.env.TEMP || process.env.TMP || "C:\\tmp", "ethereumphunks-hardhat");
const art = JSON.parse(fs.readFileSync(path.join(HH_WORKDIR,
  `artifacts/contracts/V2MainnetUpgrade/QuantumCollections/${NAME}.sol/${NAME}.json`), "utf8"));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "generated", "phunksmas_items.json"), "utf8"));
// --only 10454,10455 : populate + mint just these (e.g. one test piece first); re-run without it for the rest
const ONLY = opt("--only") ? new Set(opt("--only").split(",").map(Number)) : null;
const items = ONLY ? data.items.filter((i) => ONLY.has(i.tokenId)) : data.items;
if (ONLY && items.length !== ONLY.size) { console.error(`--only: unknown token id(s) in ${opt("--only")}`); process.exit(1); }

function chunks(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

(async () => {
  // cacheTimeout -1: ethers otherwise caches identical calls for 250 ms, so back-to-back nonce reads go stale
  const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  const net = await provider.getNetwork();
  const wallet = new ethers.Wallet(privateKey, provider);
  if (wallet.address !== keyAddr) throw new Error("key file address mismatch");
  const stateFile = path.join(__dirname, "generated", `phunksmas_deploy_state.${TAG ? TAG + "." : ""}${net.chainId}.json`);
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");

  const fee = await provider.getFeeData();
  const bal = await provider.getBalance(wallet.address);
  console.log(`chain ${net.chainId} | deployer ${wallet.address} | balance ${ethers.formatEther(bal)} ETH | gas ${ethers.formatUnits(fee.gasPrice, "gwei")} gwei`);
  console.log(`items: ${items.length} (${items.map((i) => i.tokenId).join(", ")}) -> mint to quantumphunks.eth ${QUANTUMPHUNKS_ETH}`);
  const live = flag("--yes");
  if (!live) console.log("DRY PLAN ONLY (no --yes): nothing will be sent.\n");

  let total = 0n;
  const send = async (label, txReq) => {
    let g;
    try {
      g = await provider.estimateGas({ ...txReq, from: wallet.address });
    } catch (e) {
      // Some estimators start their search above the 16.7M per-tx cap and give up on big-calldata txs
      // that actually use far less. Prove the tx doesn't revert at the cap, then send with the cap as limit
      // (unused gas is not charged).
      await provider.call({ ...txReq, from: wallet.address, gasLimit: TX_GAS_CAP });
      g = (TX_GAS_CAP * 10n) / 12n;
      console.log(`  ${label}: estimate failed (${(e.shortMessage || e.message).slice(0, 60)}); dry run at the cap OK`);
    }
    total += g;
    console.log(`  ${label}: ~${g.toLocaleString()} gas`);
    if (!live) return null;
    const nonce = await provider.getTransactionCount(wallet.address, "pending");   // fresh every send
    let gasLimit = (g * 12n) / 10n;
    if (gasLimit > TX_GAS_CAP) gasLimit = g < TX_GAS_CAP ? TX_GAS_CAP : (() => { throw new Error(`${label}: needs ${g} gas, over the per-tx cap`); })();
    const fees = {};
    if (MAX_GWEI) {
      // --max-gwei: never pay more than the cap. Wait for gas to come down and for enough balance to
      // cover gasLimit x cap (what the network requires up front); the tx's max fee IS the cap.
      const cap = ethers.parseUnits(MAX_GWEI, "gwei");
      for (let waited = 0; ; waited++) {
        const fd = await provider.getFeeData();
        const blk = await provider.getBlock("latest");
        const bal = await provider.getBalance(wallet.address);
        const okGas = blk.baseFeePerGas + (fd.maxPriorityFeePerGas ?? 0n) <= cap;
        const okBal = bal >= gasLimit * cap;
        if (okGas && okBal) {
          fees.maxFeePerGas = cap;
          fees.maxPriorityFeePerGas = (fd.maxPriorityFeePerGas ?? 0n) < cap - blk.baseFeePerGas ? (fd.maxPriorityFeePerGas ?? 0n) : 0n;
          fees.type = 2;
          break;
        }
        if (waited % 5 === 0) console.log(`    waiting: base ${ethers.formatUnits(blk.baseFeePerGas, "gwei")} gwei (cap ${MAX_GWEI})` +
          (okBal ? "" : ` | balance ${ethers.formatEther(bal)} < ${ethers.formatEther(gasLimit * cap)} needed up front — top up the deployer`));
        await new Promise((r) => setTimeout(r, 60_000));
      }
    }
    const tx = await wallet.sendTransaction({ ...txReq, nonce, gasLimit, ...fees });
    console.log(`    tx ${tx.hash}`);
    const r = await tx.wait();
    if (r.status !== 1) throw new Error(`${label} reverted`);
    return r;
  };

  // 1. deploy
  const F = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  if (!state.address) {
    // vanity guard: the contract address is fixed by (deployer, nonce). The deploy MUST be nonce 0.
    const nonce = await provider.getTransactionCount(wallet.address);
    const predicted = ethers.getCreateAddress({ from: wallet.address, nonce });
    console.log(`  deployer nonce ${nonce} -> contract will be ${predicted}`);
    if (vanityContractAddress && predicted.toLowerCase() !== vanityContractAddress.toLowerCase())
      throw new Error(`deployer already used (nonce ${nonce}); would deploy at ${predicted}, not the vanity ${vanityContractAddress}. Aborting.`);
    const dtx = await F.getDeployTransaction(NAME, SYMBOL, wallet.address);
    const r = await send("deploy", dtx);
    if (!live) {
      console.log(`\n  (the remaining steps need the deployed contract; run with --yes, or use a fork for a full dry run)`);
      console.log(`  deploy cost @ current gas: ${ethers.formatEther(total * fee.gasPrice)} ETH`);
      return;
    }
    state.address = r.contractAddress; save();
    console.log(`  ${NAME} deployed at ${state.address}`);
  }
  const c = new ethers.Contract(state.address, art.abi, wallet);

  // 2. images
  for (const group of chunks(items, BATCH)) {
    const ids = group.map((i) => i.tokenId);
    const todo = [];
    for (const it of group) if (!(await c.isImageSet(it.tokenId)) || (await c.tokenImage(it.tokenId)) !== it.image) todo.push(it);
    if (!todo.length) continue;
    await send(`images ${todo.map((i) => i.tokenId).join(",")}`,
      await c.setTokenImageBatch.populateTransaction(todo.map((i) => i.tokenId), todo.map((i) => i.image)));
    void ids;
  }
  // 2b. animations (separate from the still image; uploaded in parts)
  const anims = {};
  for (const it of items) {
    const f = path.join(ANIM_DIR, `${it.tokenId}.txt`);
    if (fs.existsSync(f)) anims[it.tokenId] = fs.readFileSync(f, "utf8").trim();
  }
  console.log(`animations: ${Object.keys(anims).length} found in ${ANIM_DIR}`);
  for (const it of items) {
    const uri = anims[it.tokenId];
    if (!uri) continue;
    if ((await c.tokenAnimation(it.tokenId)) === uri) continue;
    const parts = []; for (let i = 0; i < uri.length; i += ANIM_PART) parts.push(uri.slice(i, i + ANIM_PART));
    for (const [k, part] of parts.entries()) {
      await send(`animation ${it.tokenId} part ${k + 1}/${parts.length} (${part.length} B)`, k === 0
        ? await c.setTokenAnimation.populateTransaction(it.tokenId, part)
        : await c.addTokenAnimationChunk.populateTransaction(it.tokenId, part));
    }
  }
  // 3. traits
  const traitTodo = [];
  for (const it of items) {
    const a = it.attributes;
    if (!(a.length && (await c.hasTrait(it.tokenId, a[a.length - 1].trait_type, a[a.length - 1].value)))) traitTodo.push(it);
  }
  for (const group of chunks(traitTodo, 17)) {
    await send(`traits ${group.length} tokens`, await c.batchSetTraits.populateTransaction(
      group.map((i) => i.tokenId),
      group.map((i) => i.attributes.map((a) => a.trait_type)),
      group.map((i) => i.attributes.map((a) => a.value))));
  }
  // 3b. description (one text for every token, like v67) from scripts/generated/phunksmas_description.txt
  const descFile = path.resolve(opt("--desc") || path.join(__dirname, "generated", "phunksmas_description.txt"));
  if (fs.existsSync(descFile)) {
    const desc = fs.readFileSync(descFile, "utf8").trim();
    if ((await c.description()) !== desc) await send(`description (${desc.length} chars)`, await c.setDescription.populateTransaction(desc));
  }
  // 4. mint to quantumphunks.eth
  const mintTodo = [];
  for (const it of items) if ((await c.ownerOfRaw(it.tokenId)) === ethers.ZeroAddress) mintTodo.push(it.tokenId);
  if (mintTodo.length) await send(`mint ${mintTodo.length} -> quantumphunks.eth`, await c.ownerMintBatch.populateTransaction(QUANTUMPHUNKS_ETH, mintTodo));
  // 5. freeze
  if (flag("--freeze")) {
    const fz = [];
    for (const it of items) if (!(await c.frozen(it.tokenId))) fz.push(it.tokenId);
    if (fz.length) await send(`freeze ${fz.length}`, await c.freeze.populateTransaction(fz));
  }
  // 6. hand off ownership (two-step)
  if (flag("--handoff") && (await c.pendingOwner()) !== QUANTUMPHUNKS_ETH && (await c.owner()) !== QUANTUMPHUNKS_ETH) {
    await send("transferOwnership -> quantumphunks.eth (pending)", await c.transferOwnership.populateTransaction(QUANTUMPHUNKS_ETH));
  }

  console.log(`\ntotal ~${total.toLocaleString()} gas ≈ ${ethers.formatEther(total * fee.gasPrice)} ETH @ ${ethers.formatUnits(fee.gasPrice, "gwei")} gwei`);
  // verify
  for (const it of items) {
    const ok = (await c.ownerOf(it.tokenId)) === QUANTUMPHUNKS_ETH && (await c.tokenImage(it.tokenId)) === it.image
      && (!anims[it.tokenId] || (await c.tokenAnimation(it.tokenId)) === anims[it.tokenId]);
    if (!ok) throw new Error(`verify failed for ${it.tokenId}`);
  }
  console.log(`verified: all ${items.length} owned by quantumphunks.eth with exact still images` +
    ` and ${Object.keys(anims).length} exact animations`);
  console.log(`owner ${await c.owner()} | pendingOwner ${await c.pendingOwner()}`);
  if ((await c.pendingOwner()) === QUANTUMPHUNKS_ETH) console.log("NEXT: from quantumphunks.eth call acceptOwnership() on the contract.");
})().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });
