import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function createAttributesJson() {
  console.log('📝 Creating attributes JSON file...\n');

  // 1. Fetch all attributes
  console.log('1️⃣ Fetching attributes from database...');
  let allAttributes = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('attributes_new')
      .select('sha, values')
      .eq('slug', 'cryptophunksv67')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('   ❌ Error:', error);
      return;
    }

    if (!data || data.length === 0) break;
    allAttributes = allAttributes.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`   ✅ Fetched ${allAttributes.length} attribute records`);

  // 2. Convert to the format the frontend expects: { sha: values }
  const attributesMap = {};
  allAttributes.forEach(item => {
    attributesMap[item.sha] = item.values;
  });

  console.log('\n2️⃣ Creating JSON file...');
  const jsonContent = JSON.stringify(attributesMap, null, 2);
  const jsonBuffer = Buffer.from(jsonContent);

  // 3. Upload to static/data/cryptophunksv67_attributes.json
  const { error: uploadError } = await supabase.storage
    .from('static')
    .upload('data/cryptophunksv67_attributes.json', jsonBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    console.log('   ❌ Error:', uploadError);
    return;
  }

  console.log('   ✅ Uploaded cryptophunksv67_attributes.json');

  // 4. Get public URL
  const { data: publicUrl } = supabase.storage
    .from('static')
    .getPublicUrl('data/cryptophunksv67_attributes.json');

  console.log('\n✨ Complete!');
  console.log('🌐 Attributes JSON URL:');
  console.log(`   ${publicUrl.publicUrl}`);
  console.log('\n📊 File contains attributes for', allAttributes.length, 'items');
}

createAttributesJson().catch(console.error);
