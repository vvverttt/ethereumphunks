import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_KEY'] || '';
const SLUG = 'ethereumphunks';
const JSON_PATH = 'C:/Users/alber/OneDrive/Desktop/etherphunks/ethereumphunks/ethereum-phunks (2).json';
const BATCH_SIZE = 50;
const DELAY_MS = 300; // rate limit

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOwner(hashId: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${hashId}`);
      if (!res.ok) { await sleep(1000); continue; }
      const data: any = await res.json();
      return data.current_owner?.toLowerCase() || null;
    } catch {
      await sleep(1000);
    }
  }
  return null;
}

async function main() {
  if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_KEY required');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const items: { id: string; index: number; sha: string; attributes: { trait_type: string; value: string }[] }[] = raw.collection_items;
  console.log(`Loaded ${items.length} items`);

  // Check which hashIds are already in DB
  const { data: existing } = await supabase
    .from('ethscriptions')
    .select('hashId')
    .eq('slug', SLUG);
  const existingSet = new Set((existing || []).map((r: any) => r.hashId.toLowerCase()));
  console.log(`Already in DB: ${existingSet.size}`);

  const toProcess = items.filter(i => !existingSet.has(i.id.toLowerCase()));
  console.log(`To process: ${toProcess.length}`);

  // Also track which SHAs need to go into attributes_new
  const { data: existingAttrs } = await supabase
    .from('attributes_new')
    .select('sha')
    .eq('slug', SLUG);
  const existingAttrSet = new Set((existingAttrs || []).map((r: any) => r.sha));

  let done = 0;
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    // Fetch owners in parallel
    const owners = await Promise.all(batch.map(item => fetchOwner(item.id)));

    // Upsert into ethscriptions
    const ethscRows = batch.map((item, j) => ({
      hashId: item.id.toLowerCase(),
      sha: item.sha,
      slug: SLUG,
      tokenId: item.index,
      owner: owners[j] || '0x0000000000000000000000000000000000000000',
      creator: owners[j] || '0x0000000000000000000000000000000000000000',
      prevOwner: owners[j] || '0x0000000000000000000000000000000000000000',
      createdAt: new Date().toISOString(),
    }));

    const { error: ethscErr } = await supabase
      .from('ethscriptions')
      .upsert(ethscRows, { onConflict: 'hashId' });
    if (ethscErr) console.error('ethscriptions upsert error:', ethscErr.message);

    // Upsert into attributes_new (sha → slug + tokenId)
    const attrRows = batch
      .filter(item => !existingAttrSet.has(item.sha))
      .map(item => ({
        sha: item.sha,
        slug: SLUG,
        tokenId: item.index,
        values: Object.fromEntries((item.attributes || []).map((a: any) => [a.trait_type, a.value])),
      }));

    if (attrRows.length > 0) {
      const { error: attrErr } = await supabase
        .from('attributes_new')
        .upsert(attrRows, { onConflict: 'sha' });
      if (attrErr) console.error('attributes_new upsert error:', attrErr.message);
      attrRows.forEach(r => existingAttrSet.add(r.sha));
    }

    done += batch.length;
    console.log(`${done}/${toProcess.length} processed`);

    await sleep(DELAY_MS);
  }

  console.log('Done! Setting merkle root...');

  // Now build merkle root from all hashIds
  const { data: allRows } = await supabase
    .from('ethscriptions')
    .select('hashId')
    .eq('slug', SLUG);

  const hashIds = (allRows || []).map((r: any) => r.hashId.toLowerCase()).sort();
  console.log(`Total hashIds for merkle: ${hashIds.length}`);

  // Build merkle root
  const { ethers } = await import('hardhat');
  let layer = [...hashIds];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [a, b] = layer[i] < layer[i + 1] ? [layer[i], layer[i + 1]] : [layer[i + 1], layer[i]];
        next.push(ethers.keccak256(ethers.concat([a, b])));
      } else {
        next.push(layer[i]);
      }
    }
    layer = next;
  }
  const root = layer[0];
  console.log('Merkle root:', root);

  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt(
    ['function setMerkleRoot(bytes32 slug, bytes32 root) external'],
    '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A',
    signer
  );

  const slugBytes = ethers.keccak256(ethers.toUtf8Bytes('etherphunks'));
  const tx = await contract.setMerkleRoot(slugBytes, root);
  await tx.wait();
  console.log('Merkle root set! tx:', tx.hash);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
