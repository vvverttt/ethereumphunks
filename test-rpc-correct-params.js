const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function testRPC() {
  console.log('🔍 Testing RPC with correct parameter order...\n');

  try {
    // Try the old signature without p_offset
    const { data, error } = await supabase.rpc('fetch_events', {
      p_collection_slug: 'cryptophunksv67',
      p_limit: 10,
      p_type: null
    });

    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log(`✅ Success! Returned ${data?.length || 0} events\n`);

      if (data && data.length > 0) {
        console.log('First 3 events:');
        data.slice(0, 3).forEach((e, idx) => {
          console.log(`  ${idx + 1}. Type: ${e.type}, Phunk #${e.tokenId}, ${new Date(e.blockTimestamp).toISOString().substring(0, 10)}`);
        });

        console.log('\n📊 Sort order check:');
        console.log(`  First event: ${new Date(data[0].blockTimestamp).toISOString()}`);
        console.log(`  Last event: ${new Date(data[data.length - 1].blockTimestamp).toISOString()}`);

        const isAscending = new Date(data[0].blockTimestamp) <= new Date(data[data.length - 1].blockTimestamp);
        console.log(`  Sorting: ${isAscending ? '✅ Oldest to Newest (ASC)' : '❌ Newest to Oldest (DESC)'}`);
      }
    }
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

testRPC();
