import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkTokenIdRange() {
  console.log('🔍 Checking tokenId range in database...\n');

  const { data } = await supabase
    .from('attributes_new')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: false })
    .limit(10);

  console.log('Top 10 tokenIds:');
  data.forEach((row, i) => console.log(`   ${i + 1}. ${row.tokenId}`));

  const { data: bottom } = await supabase
    .from('attributes_new')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true })
    .limit(10);

  console.log('\nBottom 10 tokenIds:');
  bottom.forEach((row, i) => console.log(`   ${i + 1}. ${row.tokenId}`));

  // Get some specific tokens that should exist
  const checkTokens = [1, 100, 1000, 2000, 5000, 10000];
  console.log('\nChecking specific token IDs:');

  for (const tokenId of checkTokens) {
    const { data, count } = await supabase
      .from('attributes_new')
      .select('sha', { count: 'exact' })
      .eq('slug', 'cryptophunksv67')
      .eq('tokenId', tokenId);

    console.log(`   Token #${tokenId}: ${count > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
  }
}

checkTokenIdRange().catch(console.error);
