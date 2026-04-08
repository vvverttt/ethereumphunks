import hre from 'hardhat';

const PHUNKQUIDITY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';

// Slugs as bytes32 (keccak256 of name)
const slugs = {
  philipIntern: hre.ethers.id('philip-intern'),
  v1: hre.ethers.id('v1-phunks'),
  v3: hre.ethers.id('v3-phunks'),
  pepephunks: hre.ethers.id('pepephunks'),
  skelephunks: hre.ethers.id('skelephunks'),
  etherphunks: hre.ethers.id('etherphunks'),
  missingPhunks: hre.ethers.id('og-missing-phunks'),
  dystophunks: hre.ethers.id('og-dysto-phunks'),
  v67: hre.ethers.id('cryptophunksv67'),
  ethsrocks: hre.ethers.id('ethsrocks'),
};

const ZERO = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000';

// CollectionType enum: 0 = ERC721, 1 = Ethscription
const collections: Array<{ name: string; slug: string; collType: number; addr: string; merkleRoot: string; pointValue: number }> = [
  { name: 'Philip Intern', slug: slugs.philipIntern, collType: 0, addr: '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce', merkleRoot: ZERO_BYTES, pointValue: 30 },
  { name: 'V1 Phunks',     slug: slugs.v1,           collType: 0, addr: '0x235d49774139c218034c0571ba8f717773edd923', merkleRoot: ZERO_BYTES, pointValue: 30 },
  { name: 'V3 Phunks',     slug: slugs.v3,           collType: 0, addr: '0xb7d405bee01c70a9577316c1b9c2505f146e8842', merkleRoot: ZERO_BYTES, pointValue: 3 },
  { name: 'Pepephunks',    slug: slugs.pepephunks,   collType: 0, addr: '0xc00ffeb7cf191c3432ede000478901f99fd53633', merkleRoot: ZERO_BYTES, pointValue: 3 },
  { name: 'Skelephunks',   slug: slugs.skelephunks,  collType: 0, addr: '0x7db8cd89308a295bb2d7f809b05db6389e9a6d88', merkleRoot: ZERO_BYTES, pointValue: 3 },
  { name: 'Etherphunks',   slug: slugs.etherphunks,  collType: 1, addr: ZERO, merkleRoot: '0x7dee03e2445990482b6b9dfad8458bb7e986215fa2720dc1eefc9a25e0b040a6', pointValue: 20 },
  { name: 'Missing Phunks', slug: slugs.missingPhunks, collType: 1, addr: ZERO, merkleRoot: '0x5799886fd467d6040d2eadf4bfa485bfc3cd66acc49911f297d44eda4561c147', pointValue: 100 },
  { name: 'DystoPhunkz',   slug: slugs.dystophunks,  collType: 1, addr: ZERO, merkleRoot: '0x7169c25746249a73989c2c702632ff8ffc87b30fceba574496a9c34e9b483440', pointValue: 300 },
  { name: 'CryptoPhunksV67', slug: slugs.v67,        collType: 1, addr: ZERO, merkleRoot: '0xc52b5af6c3681ccad3e954fdb73af906f5e36ee3c4af8c88bb8f1b176e922ba6', pointValue: 300 },
  { name: 'EthsRocks',     slug: slugs.ethsrocks,    collType: 1, addr: ZERO, merkleRoot: '0x03e5fd39cd4ce93197f57bcfdc79983af39e49915ae3189e9717c82114a5c26d', pointValue: 150 },
];

async function main() {
  const contract = await hre.ethers.getContractAt('Phunkquidity', PHUNKQUIDITY);

  for (const c of collections) {
    console.log(`\nAdding ${c.name} (${c.slug.slice(0, 10)}...) — ${c.pointValue} pts...`);
    try {
      const tx = await contract.addCollection(
        c.slug,
        c.collType,
        c.addr,
        c.merkleRoot,
        c.pointValue
      );
      await tx.wait();
      console.log('  ✓ TX:', tx.hash);
    } catch (e: any) {
      console.log('  ✗ FAILED:', e?.message?.slice(0, 100));
    }
  }

  console.log('\nDone.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
