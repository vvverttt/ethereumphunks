import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function verifyOneOfOne() {
  console.log('🔍 Verifying "One of One" count (fetching ALL rows)...\n');

  // Fetch ALL rows (override default 1000 limit)
  let allData = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('attributes_new')
      .select('tokenId, sha, values')
      .eq('slug', 'cryptophunksv67')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.log('❌ Error:', error.message);
      break;
    }

    allData.push(...data);
    console.log(`   Fetched page ${page + 1}: ${data.length} rows (total: ${allData.length})`);

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n✅ Total rows fetched: ${allData.length}\n`);

  // Count "One of One"
  let oneOfOneCount = 0;
  const oneOfOneTokens = [];

  for (const item of allData) {
    const special = item.values?.Special;

    // Check if Special contains "One of One" (string or array)
    const hasOneOfOne =
      special === 'One of One' ||
      (Array.isArray(special) && special.includes('One of One'));

    if (hasOneOfOne) {
      oneOfOneCount++;
      oneOfOneTokens.push(item.tokenId);
    }
  }

  console.log(`📊 "One of One" count: ${oneOfOneCount} (should be 719)`);

  if (oneOfOneCount === 719) {
    console.log(`✅ Perfect match!\n`);
  } else {
    console.log(`⚠️  Count mismatch! Difference: ${719 - oneOfOneCount}\n`);
  }

  // Show token ID ranges
  if (oneOfOneTokens.length > 0) {
    oneOfOneTokens.sort((a, b) => a - b);
    console.log(`Token ID range: ${oneOfOneTokens[0]} to ${oneOfOneTokens[oneOfOneTokens.length - 1]}`);
    console.log(`First 10: ${oneOfOneTokens.slice(0, 10).join(', ')}`);
    console.log(`Last 10: ${oneOfOneTokens.slice(-10).join(', ')}`);
  }
}

verifyOneOfOne().catch(console.error);
