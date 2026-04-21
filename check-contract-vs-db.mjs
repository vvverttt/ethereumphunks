import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const CONTRACT = '0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba';

// Check ethscriptions where DB says owner = contract
// vs ethscriptions where DB says owner != contract but on-chain might say contract

// Get all ethscriptions owned by contract per DB
const { data: dbInContract } = await sb
  .from('ethscriptions')
  .select('tokenId, hashId, slug, owner')
  .eq('owner', CONTRACT)
  .order('tokenId');

// Get latest transfer event per hashId to get "true" on-chain owner
// We'll check the events table for the most recent transfer for each hashId in contract

// Also check: are there any ethscriptions NOT owned by contract in DB, 
// but whose last event shows contract as recipient?

// Get all events where 'to' = contract
const { data: toContractEvents } = await sb
  .from('events')
  .select('hashId, from, to, blockNumber, transactionIndex')
  .eq('to', CONTRACT)
  .order('blockNumber', { ascending: false })
  .order('transactionIndex', { ascending: false });

// Get all events where 'from' = contract  
const { data: fromContractEvents } = await sb
  .from('events')
  .select('hashId, from, to, blockNumber, transactionIndex')
  .eq('from', CONTRACT)
  .order('blockNumber', { ascending: false })
  .order('transactionIndex', { ascending: false });

// Find tokens that went INTO contract but have no corresponding OUT event after
const inMap = {};
for (const ev of (toContractEvents || [])) {
  if (!inMap[ev.hashId] || ev.blockNumber > inMap[ev.hashId].blockNumber) {
    inMap[ev.hashId] = ev;
  }
}

const outMap = {};
for (const ev of (fromContractEvents || [])) {
  if (!outMap[ev.hashId] || ev.blockNumber > outMap[ev.hashId].blockNumber) {
    outMap[ev.hashId] = ev;
  }
}

// Tokens stuck in contract per events (last event was IN, no OUT after)
const stuckInContract = [];
for (const [hashId, inEv] of Object.entries(inMap)) {
  const outEv = outMap[hashId];
  if (!outEv || inEv.blockNumber > outEv.blockNumber || 
      (inEv.blockNumber === outEv.blockNumber && inEv.transactionIndex > outEv.transactionIndex)) {
    stuckInContract.push({ hashId, blockIn: inEv.blockNumber });
  }
}

// Now cross-reference with DB owner
const { data: stuckRows } = await sb
  .from('ethscriptions')
  .select('tokenId, hashId, slug, owner')
  .in('hashId', stuckInContract.map(x => x.hashId));

const stuckMap = {};
for (const row of (stuckRows || [])) stuckMap[row.hashId] = row;

console.log(`DB says ${dbInContract?.length} tokens owned by contract`);
console.log(`Events say ${stuckInContract.length} tokens last transferred TO contract with no exit\n`);

// Find discrepancies
const dbHashIds = new Set((dbInContract || []).map(r => r.hashId));
const eventsHashIds = new Set(stuckInContract.map(x => x.hashId));

const inEventsNotDb = stuckInContract.filter(x => !dbHashIds.has(x.hashId));
const inDbNotEvents = (dbInContract || []).filter(r => !eventsHashIds.has(r.hashId));

console.log(`=== In events (stuck) but DB says NOT in contract: ${inEventsNotDb.length} ===`);
for (const x of inEventsNotDb) {
  const row = stuckMap[x.hashId];
  console.log(`  hashId=${x.hashId.slice(0,18)}... tokenId=${row?.tokenId} dbOwner=${row?.owner?.slice(0,10)}...`);
}

console.log(`\n=== DB says in contract but events show OUT: ${inDbNotEvents.length} ===`);
for (const r of inDbNotEvents) {
  console.log(`  #${r.tokenId} ${r.hashId.slice(0,18)}... slug=${r.slug}`);
}
