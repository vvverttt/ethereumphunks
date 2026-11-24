#!/usr/bin/env node
/*
  Make a throwaway deployer whose FIRST contract (nonce 0) lands on a vanity address.

    node scripts/vanity-burner.js --out ../.burner-phunksmas-v2 [--prefix 67]

  Writes { privateKey, address, vanityContractAddress } to --out (must be gitignored) and prints only the
  public addresses. Refuses to overwrite an existing file. Fund the address, then deploy as its first tx.
*/
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const out = opt("--out");
const prefix = "0x" + opt("--prefix", "67").toLowerCase().replace(/^0x/, "");
if (!out) { console.error("usage: node scripts/vanity-burner.js --out <file> [--prefix 67]"); process.exit(1); }
const file = path.resolve(out);
if (fs.existsSync(file)) { console.error(`${file} already exists; refusing to overwrite a key.`); process.exit(1); }

let tries = 0;
for (;;) {
  tries++;
  const w = ethers.Wallet.createRandom();
  const ca = ethers.getCreateAddress({ from: w.address, nonce: 0 });
  if (ca.toLowerCase().startsWith(prefix)) {
    fs.writeFileSync(file, JSON.stringify({ privateKey: w.privateKey, address: w.address, vanityContractAddress: ca }, null, 2) + "\n", { mode: 0o600 });
    console.log(`found after ${tries} tries`);
    console.log(`deployer (fund this): ${w.address}`);
    console.log(`contract (nonce 0):   ${ca}`);
    console.log(`key saved to ${file}`);
    break;
  }
}
