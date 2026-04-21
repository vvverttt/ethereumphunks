import { createClient } from '@supabase/supabase-js';

const sb = (createClient as any)(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const MISSING_OLD_SHA: Record<number, string> = {
  10004: '416989ccbe2425fed7a906c5cdceb0b076fbc766e3a9b944950d1275d2c497c0',
  10015: 'cd3d45295adfe750bec40a3fb1fc364e3a809858ca0757c5a812e90146099a56',
  10058: 'b0b600cbe69dfe1959eb255afdd79acb85916f770aa869c7902534418a9cf03c',
  10078: 'e044291cc1bbfee048ca9acd0a857f0b54144cd7775c609460e4ef3f345e86fc',
  10093: '49487b7cdd0638f7ce6f486c89e059031c32c84cfb4e52d104d08f585a2c940d',
  10099: '7a0dab40e23889200d4674b1164481a12a2f5c386ae0fc7e1a4ad26e83192840',
  10207: 'e4ff8f8baa30fcf4fa8eff30371d2b3a28b623f562425ebae582a4a3732efa61',
  10250: '3dbd4b1ce55b88d95e7c47dae96d9b791d17fc48a7d241395abef976adedc380',
};

const DYSTO_OLD_SHA: Record<number, string> = {
  10251: '7e67362a8331bd43f91e898ed33b9ace9d22edc39e68e84c91748eb7684bfefd',
  10259: '0a6ed0db57228a5c00f19f7c37f50b5aa69533ff02ac6d8def1a51986d0fd9fc',
  10261: '8684a045aa05f17a040466ca9d56dbe1e6c93a810903c9a63ef96efe1224f97c',
  10277: 'e3aaf12de92d88c69fd6cbe8ed00d23b36352d6b5beebf92434dead91db5d198',
  10287: '701b3e21f8a16f4511cbc2bc312e6d5606563c55e1085f011b06c36c80aabc67',
  10290: '4fc401d115ac884f850d9ee301da528ebf1106c8bfb9b4e049034f455f14248b',
  10293: '0d345e40b41aacf0824786bb7fd639faf97f8a7ddf95370fe5168db79847556e',
  10295: '21e67cec9c4e15665f8c552b57a9b65506b8bb7f11911a306d565d353aa11db6',
  10298: 'f4623e6f5bc5707b4beb596b905da87dafb66876396ceb4a7da66fb2f013c8ef',
  10299: 'abb85e764f8e976f5faf06ae0c359c42f4887930e0910a88fe1d8a5502477c9f',
  10301: '3db54f75946c0d36195d08c06c3a7b45b2c3ecdb1a4d8e531e6b15f95fd9d2a8',
  10306: '1d2a8beb092caab10091b736d2e3f5456dfa85af539ac63940fe02e822105f5a',
  10307: 'e25109b74923ce8e9fe6c592f6729075703c9161b78dc42e3045271a2520daa2',
  10308: '52583a9febdd66186ba85cb79c1dd51759a1eb2276400e7d69b0d1b0a185c3a9',
  10312: 'fd60a1b85637ed985151b7a6e211e73c441cbc7fe349f500cbec65caffbab6d6',
};

async function updateAttributeFile(slug: string, oldShaByTokenId: Record<number, string>) {
  console.log(`\nProcessing ${slug}...`);
  const tokenIds = Object.keys(oldShaByTokenId).map(Number);

  const { data: fileData, error: dlErr } = await sb.storage.from('data').download(`${slug}_attributes.json`);
  if (dlErr) throw new Error(`Download failed: ${dlErr.message}`);
  const existing: Record<string, any[]> = JSON.parse(await fileData.text());
  console.log(`  Existing entries: ${Object.keys(existing).length}`);

  const { data: newEths } = await sb.from('ethscriptions').select('tokenId, sha').eq('slug', slug).in('tokenId', tokenIds);
  const newShaByTokenId: Record<number, string> = {};
  for (const e of (newEths || [])) newShaByTokenId[e.tokenId] = e.sha;

  let updated = 0, skipped = 0;
  const newFile: Record<string, any[]> = { ...existing };

  for (const tokenId of tokenIds) {
    const oldSha = oldShaByTokenId[tokenId];
    const newSha = newShaByTokenId[tokenId];
    if (!newSha) { console.log(`  WARNING #${tokenId}: no new SHA in DB`); skipped++; continue; }
    if (oldSha === newSha) { skipped++; continue; }
    const attrs = existing[oldSha];
    if (!attrs) { console.log(`  WARNING #${tokenId}: old SHA not in file`); skipped++; continue; }
    delete newFile[oldSha];
    newFile[newSha] = attrs;
    console.log(`  OK #${tokenId}: ${oldSha.slice(0,16)} -> ${newSha.slice(0,16)}`);
    updated++;
  }

  console.log(`  Updated: ${updated}, Skipped: ${skipped}`);
  if (updated === 0) return;

  const blob = new Blob([JSON.stringify(newFile)], { type: 'application/json' });
  const { error: upErr } = await sb.storage.from('data').upload(`${slug}_attributes.json`, blob, {
    upsert: true,
    contentType: 'application/json',
  });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
  console.log(`  UPLOADED ${slug}_attributes.json (${Object.keys(newFile).length} entries)`);
}

async function main() {
  await updateAttributeFile('quantummissingphunksv67', MISSING_OLD_SHA);
  await updateAttributeFile('quantumdystophunkzv67', DYSTO_OLD_SHA);
  console.log('\nDone!');
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
