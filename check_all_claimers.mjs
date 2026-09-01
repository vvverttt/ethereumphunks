// Verify ALL wallets with free claims — make sure none ever sold in either collection

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');

const MARKET = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';
const OLD_MARKET = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
const OG_SLUGS = ['og-missing-phunks', 'og-dysto-phunks'];

// ALL wallets that were given free claims (diamond hands + above-threshold)
const ALL_CLAIMERS = [
  // OG Missing diamond hands (55)
  '0x25f1125417aa9d9366630a62db3c75581dd657dd',
  '0xe3a24ae91bcc72c6161b8f0ddf6e81694a2eec0b',
  '0x37814f5ecf3d60f7cbb769bcd3b6b31ceb8ae106',
  '0x121e9da048d70e70caa07bf7c7548bcce906835a',
  '0x0564a06312f55b5b3dfde6129eaab29d3bec7e62',
  '0x42a18a259a7071ca0fd144b9503a93f038263e3e',
  '0x07eb6ac2b3760a3496508932167a26d7f6bcf764',
  '0x0e3282f3eaafcd808d03e5d246e2fb19a8bf101a',
  '0x2b8454f668669c9c888c8346416e10be86bb7620',
  '0x6466c91c32a6ee95c7d0660659cdfbcd2eee475d',
  '0x921a30fee34e217c17d695b4d2a1b5025374c983',
  '0xc911d23a5735a327884d684e32a8e46ccc7b0091',
  '0xee54d24f450b000eceb12ef1514c9256da9f9235',
  '0xfd0056ec2791c4665f35be37193e61753bc26808',
  '0x0f9be6c42301cc9329fac7ea08f42449dcc2f00f',
  '0x119f079871594e9ffc22d9453785c9e9364f2bce',
  '0x11c2254143310e834640f0fdafd6e44516340e40',
  '0x15719d37d81a0a490af6b143ffb3c84613d77a7b',
  '0x1b43e6b432315a8573ce8c0f2687639eddd641dd',
  '0x1bf32181e831dbc781eeb850d58f801495c4c93d',
  '0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b',
  '0x296446a719f6e72d54920c246fc66365b291c259',
  '0x2eb53af17ae7604cf833e0931e12d999b4f2676b',
  '0x3860e090239d0dba44f2b8cb37adc81b0528a96f',
  '0x38879c41f18c751d64079c4bdce7b3e092e873b9',
  '0x3e3e7d1c8cff97c3fa31e0630cb7421d4d0b5f76',
  '0x4212d149f77308a87ce9928f1095eddb894f4d68',
  '0x4267fae6ccef4cceadcc45f92f07d3c35da4711d',
  '0x43ec5640e18f7384761d8817aa55d38c9a03d855',
  '0x47cf60bdd877203264921d05ce26f81f6d36aa3e',
  '0x4ef490ba82157466b823d26cf1f8022d485387fa',
  '0x562f0daeaa5aa30d8954c5c31dd1ee3c6f17d978',
  '0x679b527c5c82f1d2a16268492850ce4be7f78bc6',
  '0x685d5f86d4f4d8cc1797d666052573a477567277',
  '0x725d0e834e161fb51ca07a49c1a6f562a60edd86',
  '0x7329b00e6e9c40507f99ad6eb56d69bc0a8f3a02',
  '0x784f65ceb819372c35248b40787f12b165cc9acc',
  '0x7d69254b25717382fe04ac82a416fdbc1c4ee410',
  '0x8020e5f53be994503fcae9a143aa36a0d2f36083',
  '0x87ff49f274c71db1c4b0b027c704c9a9088e1ac4',
  '0x8e066f69ce11aeae7b796a399ccedee14291d0b2',
  '0x916565201113cae2fb59ae84a597108ed0454443',
  '0x952d60d87b3428b49d3b6660be3712b22379c497',
  '0x9b1f5542c1a2557b12ca6bac1f369143edd08951',
  '0xa2b1db1d846d368489b7211831bedb50b94ae83d',
  '0xa83747b5c92d9c3cc55b447c15769cfcaac76385',
  '0xb1dad57e6472b80419f3baa66905df690dd61b9d',
  '0xb6e78700d808c0ac539a23088bc067095005c336',
  '0xc8b26c065806cf745e1bfc6f1777cbcd07a6ea8e',
  '0xcecce5a3da042e8ad4d1e2019b1551d4c898dd6e',
  '0xd729a94d6366a4feac4a6869c8b3573cee4701a9',
  '0xe12aceb9f6142f8f19f5188f2c76f7d02b4138d5',
  '0xebfd774c1c2008e56ce40e0a4504ebecc81b1921',
  '0xf15fe868b185fc82ddaffc805ebc37380c778c52',
  '0xf8ac72f1422b680a4b5bb69e472601f9b8be7a53',
  // OG Dysto diamond hands (21) - minus duplicates already above
  '0x474642b7f4f61c0b375c54ab2fdbb8da6c02920f',
  '0x9fd878f59e78a4da2bb2b971bcdb3cd6f75178ab',
  '0x097ffef932d06582cd63a28d70f0f6ec9a2260f2',
  '0x67159a44a0ebef5af3efd2502d6a96ddaf73fe97',
  '0x6744d79392eb4d47c49a92f03bce87885fa0f3c7',
  '0x89c7dbca26efbebda7d438d3639a2d58844cd661',
  '0xae97a8bfa58d9573aaba7b7d4339f9e027936bb7',
  '0xba0c18277a5b2fc5526365c44b1ffa16023dd09d',
  '0xba7e1ad6ef62841b057fcc4694847bb0f79a991c',
  '0xbcbe71192007b4ade74867a7f22d148a170731eb',
  '0xbfa1beefa79f73e44b91ba4412f0d6945dbe30a8',
  '0xe10c71796a367dc7355ff2f2910bcb8205245f9c',
  '0xe4fdbbb89a3ce8e96b721fd56883926035aa4cee',
  '0xfe6c5867739da4e1d28681cab7edcb0a4e06b5cc',
  // Above-threshold additions
  '0x2fdc93722c9a86fdfb4d945caf059f39cb9622be',
  '0x32f12843e7dba0e9452f5223713bb9a332313d2e',
  '0xed088bfa882e951b8627681ac0b5199bb4567f25',
];

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function main() {
  // Get all OG items
  const allItems = [];
  for (const slug of OG_SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner,slug',
      slug: `eq.${slug}`,
      limit: '10000',
    });
    allItems.push(...items);
  }
  console.log(`Total OG items: ${allItems.length}`);

  // Get ALL sale events for ALL OG items
  const batchSize = 20;
  const sellers = new Map(); // wallet -> [{slug, tokenId, price, date}]

  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);
    const hashIds = batch.map(b => b.hashId).join(',');

    const sales = await query('events', {
      select: 'hashId,from,value,type,blockTimestamp',
      hashId: `in.(${hashIds})`,
      type: `in.(PhunkBought,sale)`,
      limit: '1000',
    });

    for (const s of sales) {
      if (!s.from || !s.value) continue;
      const w = s.from.toLowerCase();
      if (!sellers.has(w)) sellers.set(w, []);
      const item = allItems.find(x => x.hashId === s.hashId);
      sellers.get(w).push({
        slug: item?.slug,
        tokenId: item?.tokenId,
        price: (Number(s.value) / 1e18).toFixed(4),
        date: s.blockTimestamp?.slice(0, 10),
      });
    }
  }

  // Check each claimer
  const unique = [...new Set(ALL_CLAIMERS)];
  console.log(`\nChecking ${unique.length} unique claimers against sale data...\n`);

  let problems = 0;
  for (const w of unique) {
    const sales = sellers.get(w);
    if (sales && sales.length > 0) {
      problems++;
      console.log(`PROBLEM: ${w} HAS SOLD:`);
      for (const s of sales) {
        console.log(`    ${s.slug} #${s.tokenId} for ${s.price} ETH (${s.date})`);
      }
    }
  }

  if (problems === 0) {
    console.log('ALL CLEAR — none of the claimers have ever sold any OG items.');
  } else {
    console.log(`\n${problems} wallet(s) have sale history!`);
  }
}

main().catch(console.error);
