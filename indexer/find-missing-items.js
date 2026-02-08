const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function findMissingItems() {
  console.log('📊 Finding missing items...\n');

  // Get all SHAs from attributes_new
  console.log('Fetching all SHAs from attributes_new...');
  const allAttributeShas = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('attributes_new')
      .select('sha, tokenId')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allAttributeShas.push(...data);
    hasMore = data.length === pageSize;
    page++;
  }

  console.log(`✅ Found ${allAttributeShas.length} items in attributes_new\n`);

  // Get all SHAs from ethscriptions
  console.log('Fetching all SHAs from ethscriptions...');
  const indexedShas = new Set();
  page = 0;
  hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('sha')
      .eq('slug', 'cryptophunksv67')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    data.forEach(item => indexedShas.add(item.sha));
    hasMore = data.length === pageSize;
    page++;
  }

  console.log(`✅ Found ${indexedShas.size} items indexed in ethscriptions\n`);

  // Find missing
  const missing = allAttributeShas.filter(item => !indexedShas.has(item.sha));

  console.log(`📊 Missing items: ${missing.length}\n`);

  if (missing.length > 0 && missing.length <= 20) {
    console.log('Missing tokenIds:');
    missing.forEach(item => {
      console.log(`   TokenId ${item.tokenId}, SHA: ${item.sha.substring(0, 16)}...`);
    });
  } else if (missing.length > 20) {
    console.log('Sample of missing tokenIds (first 20):');
    missing.slice(0, 20).forEach(item => {
      console.log(`   TokenId ${item.tokenId}, SHA: ${item.sha.substring(0, 16)}...`);
    });
  }

  console.log(`\n💡 To index missing items, you need to find their transaction hashes and call reindex-transaction endpoint.`);
  console.log(`   You can query the Ethscriptions API to find transactions by SHA.`);
}

findMissingItems().catch(console.error);
