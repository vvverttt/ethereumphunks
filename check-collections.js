const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkCollections() {
  console.log('🔍 Checking curated collections...\n');

  // Check collections table
  const { data: collections, error } = await supabase
    .from('collections')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error fetching collections:', error);
    return;
  }

  console.log(`Found ${collections?.length || 0} collections:\n`);

  if (collections && collections.length > 0) {
    collections.forEach((col, idx) => {
      console.log(`${idx + 1}. ${col.name}`);
      console.log(`   Slug: ${col.slug}`);
      console.log(`   Contract: ${col.contract || 'N/A'}`);
      console.log(`   Featured: ${col.featured ? 'Yes' : 'No'}`);
      console.log(`   Hidden: ${col.hidden ? 'Yes' : 'No'}`);
      console.log();
    });
  } else {
    console.log('⚠️  No collections found!\n');
  }

  // Check how many ethscriptions per collection
  console.log('\n📊 Ethscriptions per collection:\n');

  for (const col of collections || []) {
    const { count } = await supabase
      .from('ethscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('slug', col.slug);

    console.log(`${col.name}: ${count || 0} ethscriptions`);
  }

  // Check global config for default collection
  console.log('\n\n🔍 Checking default collection setting...\n');

  const { data: config } = await supabase
    .from('_global_config')
    .select('*')
    .eq('network', 1)
    .single();

  if (config) {
    console.log(`Default Collection: ${config.defaultCollection || 'Not set'}`);
    console.log(`Network: ${config.network}`);
    console.log(`Last Block: ${config.lastBlock}`);
  }
}

checkCollections();
