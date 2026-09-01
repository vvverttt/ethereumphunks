// Show which collections each of the 72 eligible wallets holds
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');
const MARKET_ADDRESS = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';

const SLUGS = [
  'og-missing-phunks',
  'og-dysto-phunks',
  'quantummissingphunksv67',
  'quantumdystophunkzv67',
];

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

const blocked = new Set([
  "0x048446ace835465fdc39e4a3835e8c9a4ed6fc20","0x048f90e479d5300c42937daa890ce1b4b670563d","0x0a105422135127f548ac9a6c9c6f0f2c46c8e1bf","0x0b90c9a9fddbd99524f0a3ceaccbf2b81e8945f5","0x0ba0b26aacc567e586aa3c720d3a63e698119b02","0x0dae6e01a88826b4e77d717d9639b64f749c0152","0x0e3c3b32c96dccd70404cae4e15eb3c974db8d99","0x0f9ef34d0ad4b248742f5b4d2880ccef0415c3a8","0x12aa7ed8fa4282b73f2521e0e80996bd39a67d5a","0x1ba0558b8fac9c6c29dbc84ceaa654b9021937cb","0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b","0x26cda2b332432abf0639bba5e8b31a95cdc987d9","0x282a3aa7e14dd629376523ab8a0cb9e3da3326fc","0x283c4c08df792484f0417564bf14be0629b4fbf7","0x292a3ea62fc9a2c0da00e433189f02fb30e00991","0x29626719799ab35e9c6c4e4cc338e3feb45eee54","0x2f7ce32e35f33faf369f92ab20d3db22d689196d","0x2fdc93722c9a86fdfb4d945caf059f39cb9622be","0x3024a1e64c5fc4251e6eef43493b8195f4ba1b85","0x32f12843e7dba0e9452f5223713bb9a332313d2e","0x37ea53fa97a03f1f0a9c46fe653a04a9c658e282","0x38012eaf414bfe674d6dd071d854e0bca4e39b1c","0x380c6b58b66b88210ab2dcefe913e34588327f83","0x383c3191c1e5a1b962f1df313df9daa6f65ca44f","0x3c80df0a3050e2741630d80dd6e3af5611e3685a","0x3e638e84f675e2810f3bf05562f931d8a22de034","0x40242de312f4f9b8ce28beabffe9db6549dfd8b2","0x4212d149f77308a87ce9928f1095eddb894f4d68","0x42c28bacf31393bc5f4fff7a9ffccda1d8b50a82","0x436196ab0550e73aeedd1a494c2420daca7fe0ca","0x477ea7a022e51b6eb0dcb6d802fb5f0cfc3b4a81","0x56523ef0d8c5df96241f7eca093d4caf341a7ae6","0x5829a477fc052fe2ee823a9713dc71c3a1f3cae4","0x5aef8479acc56b016b2285c59a3bcd43c2952bb6","0x5eb838cfc0c90602de1eef6a6915a52824004b70","0x66fc46e39f11762eb1372f51fff003ca450acc2e","0x684f45dd4a0d50ce2ba618868ef0e7f28eec8773","0x6acdfb227d9cb801800a01732f4216bdcf4a0c4f","0x6cd65836f6df0e15bc22bae3f42ce8dee152e533","0x6d9e1f98fd9249b05cfda3d97dadb3629b694dcf","0x7155d5a59f836b3031524a9d7e418dc99e95de9d","0x78d3aaf8e3cd4b350635c79b7021bd76144c582c","0x7fde4c7c2ba79cde980917f6ba0e99841431eada","0x802b23db67daa6fa76386d63ac6e022fcdded299","0x80e6a99079e4407df210e07a734d82eb3ea84ed1","0x85609031898916ef64bde9ab4f72ef78ac94d58e","0x8ab38f84cf339a28e25be1098a4c842e7bf3d3f5","0x8cc43237c9a8595a6326f244008bad2eed615597","0x8dddb14068bbd7b2fcbfa24527353582209141ee","0x95e37edb087b00f04db2efcc8a78974575e6f35a","0x96c0ec3a80298d495a919e41c9965895cfcdc23c","0x9d67aea659097259b8d4d408dd11df8ca7a2e33f","0xa1076d93c3c0840922cb63287080939bd2fc4510","0xa2f52aff3b31f8decfe50404442d040e71920cb6","0xb04a0314abc2f6fb3a734d29e9d6b7668e171e8a","0xb078b7db743103a17a1bad664c8172cac9bef4f3","0xb1c1fb2400102b9a70a59025a3806bbfc31c34cf","0xbded72add80598afd9e2ec3c5e5fe6aab48b0f89","0xc1eae33998ab8cef2bc51b15daec021bfe881749","0xc2315ab70054d4ba1420476c2902ce91f52be905","0xc3d777903325ce9ab8f11e1a9fd27b9f471f238e","0xc7a2dd73362345b3188932a9214fe82eb22035b5","0xdfa68a54ff345a23da01e9ef66e3e89dd199acd3","0xe01b4d6cb62261ea6febd0800a9c0666309e1dbd","0xe4b3c60c08c986b42cb43ec0a5efc5b36e780ebd","0xed4d252909017999204d4eb4f1b02b467bb40fba","0xef809f79917e69b99a52cf78f2aa05bf9cfb8c7f","0xf1927e1482ee5b317602bfdb79b606f2dbe10bea","0xf1aa941d56041d47a9a18e99609a047707fe96c7","0xf87b06e886e3028d4e21684134005905f60c0140","0xf8c15eba793794fa016400e76c7e06baee186d16","0xf8c80d5aa79cb3d078d37f580c92df6cec60777e","0xfc000a4dab3bcc69e58e4332953d2d58848f5f81","0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f"
]);

async function main() {
  // Build wallet -> collections map
  const walletCollections = {};

  for (const slug of SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner',
      slug: `eq.${slug}`,
      limit: '1000',
    });

    for (const item of items) {
      let owner = item.owner?.toLowerCase();
      if (owner === MARKET_ADDRESS && item.prevOwner) {
        owner = item.prevOwner.toLowerCase();
      }
      if (!owner || owner === '0x0000000000000000000000000000000000000000') continue;
      if (blocked.has(owner)) continue; // skip blocked

      if (!walletCollections[owner]) walletCollections[owner] = {};
      if (!walletCollections[owner][slug]) walletCollections[owner][slug] = 0;
      walletCollections[owner][slug]++;
    }
  }

  // Count per collection
  const collectionCounts = {};
  for (const slug of SLUGS) collectionCounts[slug] = 0;

  const sorted = Object.entries(walletCollections).sort(([a], [b]) => a.localeCompare(b));

  console.log(`\n=== ${sorted.length} ELIGIBLE WALLETS ===\n`);
  for (const [wallet, cols] of sorted) {
    const parts = SLUGS.filter(s => cols[s]).map(s => {
      const short = s.replace('og-', '').replace('quantum', 'Q-').replace('v67', '');
      collectionCounts[s] += cols[s];
      return `${short}: ${cols[s]}`;
    });
    console.log(`${wallet}  ${parts.join(', ')}`);
  }

  console.log(`\n=== TOTALS ===\n`);
  for (const slug of SLUGS) {
    console.log(`${slug}: ${collectionCounts[slug]} items held by eligible wallets`);
  }

  // How many hold only 1 collection vs multiple
  let onlyMissing = 0, onlyDysto = 0, onlyQMissing = 0, onlyQDysto = 0, multi = 0;
  for (const [, cols] of sorted) {
    const slugsHeld = SLUGS.filter(s => cols[s]);
    if (slugsHeld.length > 1) multi++;
    else if (slugsHeld[0] === 'og-missing-phunks') onlyMissing++;
    else if (slugsHeld[0] === 'og-dysto-phunks') onlyDysto++;
    else if (slugsHeld[0] === 'quantummissingphunksv67') onlyQMissing++;
    else if (slugsHeld[0] === 'quantumdystophunkzv67') onlyQDysto++;
  }
  console.log(`\nOnly OG Missing Phunks: ${onlyMissing}`);
  console.log(`Only OG DystoPhunks: ${onlyDysto}`);
  console.log(`Only Quantum Missing: ${onlyQMissing}`);
  console.log(`Only Quantum Dysto: ${onlyQDysto}`);
  console.log(`Multiple collections: ${multi}`);
}

main().catch(console.error);
