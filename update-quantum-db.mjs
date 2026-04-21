import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'REDACTED_SUPABASE_SERVICE_ROLE';
const OWNER = '0xea04f65f9dc5917302532859d80fcf36a15de266';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load shas from authoritative JSONs
const missingJson = JSON.parse(readFileSync('./marketplace/src/missingand quantumupdates/quantummissingphunksv677.json', 'utf8'));
const dystoJson   = JSON.parse(readFileSync('./marketplace/src/missingand quantumupdates/quantumdystophunkszv677.json', 'utf8'));
const shaByToken = {};
for (const item of [...missingJson, ...dystoJson]) {
  shaByToken[item.number] = { sha: item.sha, newHashId: item.transactionHash };
}

const OLD_HASHIDS = [
  { tokenId: 10004, oldHashId: '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725' },
  { tokenId: 10015, oldHashId: '0xb4dd2fcae58ac4c38e6ddc4c113490d665057aa7d1c7d5bdefa3d92b81583ba9' },
  { tokenId: 10058, oldHashId: '0x7707668e833d40514b3972b017a87b48d95319606f3776e36d91afda361a5825' },
  { tokenId: 10078, oldHashId: '0x5c3eb47681fc8966a59adaba4fd85b7cd06e3b643b34a876c71ee02d163dfd7f' },
  { tokenId: 10093, oldHashId: '0x4ee9fcae83c10d7013aae58f683d173d2c05bcf19c42d922bc0d0d9b6069ee2f' },
  { tokenId: 10099, oldHashId: '0x7da0e342f53af6941b1722a5dd7df4b3c37bb7d4f434a3234e928796976af4f4' },
  { tokenId: 10207, oldHashId: '0xe1fd42dbc43925c092b7f41c66aa2916bedde4b4f035de82b301b55faf578a21' },
  { tokenId: 10250, oldHashId: '0x5ff2e0c01469b8fa37ded5a22d08683b2e7477fc4b48118dfa6def29ac9254bb' },
  { tokenId: 10251, oldHashId: '0x1dff838ac02192dbd456a209ad5b1aa7cbb8e0afcf2e091b436270ed02db78c8' },
  { tokenId: 10259, oldHashId: '0x0596074cc07975d4bdd6d6ea9e4558db95b69e628ec410329c6fafdac7432ba4' },
  { tokenId: 10261, oldHashId: '0x73594a81bb93f8a912c7173939eb417d09d64397c65f6074e322e8fd0a825fad' },
  { tokenId: 10277, oldHashId: '0x472bb9154a2a798734cbd055a530efb73939fa45d97cc4ef6fe6d9ebb18a2b4f' },
  { tokenId: 10287, oldHashId: '0x9b99836cb4fd4558d1112b53f10b80feb2a6e49eaf2efbd3bd58bc62186f14ad' },
  { tokenId: 10290, oldHashId: '0x84c6cca1cd54bd3cd90f96ef329e7a91bb537a1209cdc55284fefa5f19f3d24c' },
  { tokenId: 10293, oldHashId: '0x476f0c93ec52c4bacfb147974a48ed96e7e964fce46520bef7ed6326cba2cadf' },
  { tokenId: 10295, oldHashId: '0x8c67c4e3721efe2e23efe57623aef3facc448e96a40853e2b80b560c57f0d4a8' },
  { tokenId: 10298, oldHashId: '0xe08effaf3556b2f511246340c84cdf1e0947f896991d51e85ebd1b04d74b1e63' },
  { tokenId: 10299, oldHashId: '0x7598ec4dd273fe2620c2b3be7d1a7313554deaca71432dc9a6634e9b19f130da' },
  { tokenId: 10301, oldHashId: '0x91a2a43c4fb55a3919c42fab28011215e5031169b4502b6d82f6af840dc84441' },
  { tokenId: 10306, oldHashId: '0x70a9b1f88c9a42e59470f17fe9bdabaf03bfe6cd9d4965c083cd0bfb4daf1ff5' },
  { tokenId: 10307, oldHashId: '0x8094b0bd726e5c0b50607b36f0a0f7daea7c44c8c5e0ec8228760c670142c85b' },
  { tokenId: 10308, oldHashId: '0x46c01d736e6881a5865959488ea7cd574a6c111e2ffb41fdec16efec9a6b6439' },
  { tokenId: 10312, oldHashId: '0x820daea5a0aa206dbda20085a58083a570c388e8657bb2334bc12c017f8915b9' },
];

async function main() {
  console.log('Updating 23 tokens in DB (insert new → update events → delete old)...\n');
  let ok = 0, failed = 0;

  for (const { tokenId, oldHashId } of OLD_HASHIDS) {
    const { newHashId, sha: newSha } = shaByToken[tokenId];

    // 1. Fetch current row
    const { data: row, error: fetchErr } = await supabase
      .from('ethscriptions')
      .select('*')
      .eq('hashId', oldHashId)
      .single();

    if (fetchErr || !row) {
      // Maybe already updated
      const { data: existing } = await supabase
        .from('ethscriptions').select('hashId,owner').eq('hashId', newHashId).single();
      if (existing) {
        console.log(`#${tokenId}: already updated ✅`);
        ok++;
      } else {
        console.error(`#${tokenId}: not found by old or new hashId ❌`);
        failed++;
      }
      continue;
    }

    // 2. Insert new row with new hashId + sha + owner
    const newRow = { ...row, hashId: newHashId, sha: newSha, owner: OWNER, prevOwner: row.owner };
    delete newRow.oldHashId; // don't carry over if null
    const { error: insertErr } = await supabase.from('ethscriptions').insert(newRow);
    if (insertErr) {
      console.error(`#${tokenId}: INSERT failed: ${insertErr.message} ❌`);
      failed++;
      continue;
    }

    // 3. Update events table: change hashId references
    const { error: eventsErr } = await supabase
      .from('events')
      .update({ hashId: newHashId })
      .eq('hashId', oldHashId);
    if (eventsErr) {
      console.error(`#${tokenId}: events UPDATE failed: ${eventsErr.message} ❌`);
      // rollback: delete the new row we just inserted
      await supabase.from('ethscriptions').delete().eq('hashId', newHashId);
      failed++;
      continue;
    }

    // 4. Delete old ethscription row
    const { error: deleteErr } = await supabase
      .from('ethscriptions')
      .delete()
      .eq('hashId', oldHashId);
    if (deleteErr) {
      console.error(`#${tokenId}: DELETE old failed: ${deleteErr.message} ❌`);
      failed++;
      continue;
    }

    console.log(`#${tokenId} ✅ ${oldHashId.slice(0,14)}... → ${newHashId.slice(0,14)}... sha=${newSha.slice(0,12)}...`);
    ok++;
  }

  console.log(`\nDone: ${ok} updated, ${failed} failed`);
}

main().catch(console.error);
