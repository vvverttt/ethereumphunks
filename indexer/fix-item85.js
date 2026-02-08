const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const INDEXER_URL = 'https://ethereumphunks.onrender.com/admin';
const API_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';
const IMAGES_DIR = 'C:/Users/alber/OneDrive/Desktop/market/ether_rocks_original';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const hash = '0x4514f438aaa0912691c3ed435ffa951a4727e831e295946eeb0cdb783c619ad8';
const sha = 'bf4ff78b5ed51da1baf6f391903546a9532ce6c635195d8a279040b75ff197a5';

async function main() {
  // Step 1: Reindex the transaction
  console.log('1. Reindexing transaction for item #85...');
  try {
    await axios.post(INDEXER_URL + '/reindex-transaction', { hash }, {
      headers: { 'x-api-key': API_KEY }, timeout: 30000
    });
    console.log('   Reindexed successfully');
  } catch (e) {
    console.error('   Reindex error:', e.message);
  }

  // Check if it's in ethscriptions now
  const { data: check } = await supabase.from('ethscriptions').select('hashId').eq('hashId', hash);
  console.log('   In ethscriptions now:', check && check.length > 0 ? 'YES' : 'NO');

  // Step 2: Upload image (85.webp)
  console.log('\n2. Uploading image...');
  let imgPath = path.join(IMAGES_DIR, '85.png');
  let contentType = 'image/png';
  if (!fs.existsSync(imgPath)) {
    imgPath = path.join(IMAGES_DIR, '85.webp');
    contentType = 'image/webp';
  }
  if (fs.existsSync(imgPath)) {
    const imgBuffer = fs.readFileSync(imgPath);
    const { error: uploadError } = await supabase.storage
      .from('static')
      .upload('images/' + sha, imgBuffer, { contentType, upsert: true });
    console.log(uploadError ? '   Upload error: ' + uploadError.message : '   Image uploaded (' + contentType + ')');
  } else {
    console.log('   Image file not found!');
  }

  // Step 3: Update supply to 106
  console.log('\n3. Updating supply to 106...');
  const { error: supError } = await supabase.from('collections').update({ supply: 106 }).eq('slug', 'ethsrock');
  console.log(supError ? '   Error: ' + supError.message : '   Supply updated to 106');

  // Step 4: Update ownership from ethscriptions API
  console.log('\n4. Updating ownership...');
  try {
    const res = await axios.get('https://api.ethscriptions.com/v2/ethscriptions/' + hash);
    const d = res.data.result || res.data;
    const currentOwner = d.current_owner ? d.current_owner.toLowerCase() : null;
    const prevOwner = d.previous_owner ? d.previous_owner.toLowerCase() : null;
    const creator = d.creator ? d.creator.toLowerCase() : null;
    if (currentOwner) {
      await supabase.from('ethscriptions').update({
        owner: currentOwner,
        prevOwner: prevOwner || creator,
      }).eq('hashId', hash);
      console.log('   Owner:', currentOwner.slice(0, 12) + '...');
    }
  } catch (e) {
    console.error('   Ownership error:', e.message);
  }

  // Step 5: Add transfer events
  console.log('\n5. Adding transfer events...');
  try {
    const res = await axios.get('https://api.ethscriptions.com/v2/ethscription_transfers', {
      params: { ethscription_transaction_hash: hash }
    });
    const transfers = res.data.result || [];
    const events = [];
    for (const t of transfers) {
      if (t.transaction_hash.toLowerCase() === hash.toLowerCase()) continue;
      events.push({
        txId: t.transaction_hash.toLowerCase() + '-' + t.transaction_index + '-' + (t.transfer_index || 0),
        type: 'transfer',
        hashId: hash.toLowerCase(),
        from: t.from_address.toLowerCase(),
        to: t.to_address.toLowerCase(),
        blockHash: t.block_blockhash ? t.block_blockhash.toLowerCase() : null,
        txIndex: parseInt(t.transaction_index) || 0,
        txHash: t.transaction_hash.toLowerCase(),
        blockNumber: parseInt(t.block_number) || null,
        blockTimestamp: t.block_timestamp ? new Date(parseInt(t.block_timestamp) * 1000).toISOString() : null,
        value: '0',
      });
    }
    if (events.length) {
      const { error: evtErr } = await supabase.from('events').upsert(events, { ignoreDuplicates: true });
      console.log(evtErr ? '   Events error: ' + evtErr.message : '   Added ' + events.length + ' transfer events');
    } else {
      console.log('   No transfers found');
    }
  } catch (e) {
    console.error('   Events error:', e.message);
  }

  // Step 6: Update attributes JSON with all 106 items
  console.log('\n6. Updating ethsrock_attributes.json...');
  const json = JSON.parse(fs.readFileSync('C:/Users/alber/OneDrive/Desktop/market/EthsRock-with-sha.json', 'utf8'));
  const attributesJson = {};
  json.collection_items.forEach(item => {
    attributesJson[item.sha] = item.attributes.map(attr => ({ k: attr.trait_type, v: attr.value }));
  });
  const jsonBuffer = Buffer.from(JSON.stringify(attributesJson), 'utf8');
  const { error: jsonError } = await supabase.storage
    .from('data')
    .upload('ethsrock_attributes.json', jsonBuffer, { contentType: 'application/json', upsert: true });
  console.log(jsonError ? '   JSON error: ' + jsonError.message : '   Attributes JSON updated (106 items)');

  // Final check
  const { data: finalCount } = await supabase.from('ethscriptions').select('tokenId').eq('slug', 'ethsrock');
  console.log('\nFinal ethsrock count:', finalCount ? finalCount.length : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
