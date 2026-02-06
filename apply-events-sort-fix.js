const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function applyMigration() {
  console.log('🔄 Applying events sort order fix to database...\n');

  const sql = fs.readFileSync('./supabase/migrations/20260205000000_fix_events_sort_order.sql', 'utf8');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error('❌ Error applying migration:', error);

      // If exec_sql doesn't exist, try direct execution
      console.log('\nTrying direct execution...\n');

      // Extract just the function creation part
      const result = await supabase.rpc('fetch_events', {
        p_limit: 1,
        p_type: null,
        p_collection_slug: 'cryptophunksv67',
        p_offset: 0
      });

      if (result.error) {
        console.error('❌ Database access error:', result.error);
        console.log('\n⚠️  Please run the SQL migration manually:');
        console.log('   1. Open Supabase Dashboard > SQL Editor');
        console.log('   2. Copy the SQL from: supabase/migrations/20260205000000_fix_events_sort_order.sql');
        console.log('   3. Execute the SQL');
      } else {
        console.log('⚠️  Migration needs to be applied manually.');
        console.log('   Current function is still using DESC order.');
        console.log('\nTo apply:');
        console.log('   1. Open Supabase Dashboard > SQL Editor');
        console.log('   2. Run the SQL from: supabase/migrations/20260205000000_fix_events_sort_order.sql');
      }
    } else {
      console.log('✅ Migration applied successfully!');
      console.log('   Events will now sort oldest to newest (ascending)');
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.log('\n📝 Manual migration required:');
    console.log('   1. Open Supabase Dashboard: https://supabase.com/dashboard/project/hzpwkpjxhtpcygrwtwku');
    console.log('   2. Go to SQL Editor');
    console.log('   3. Copy and run: supabase/migrations/20260205000000_fix_events_sort_order.sql');
  }
}

applyMigration();
