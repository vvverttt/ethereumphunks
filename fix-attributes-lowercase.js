import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function fixAttributesLowercase() {
  console.log('🔧 Fixing attributes to lowercase format...\n');

  // 1. Fetch all attributes
  let allAttributes = [];
  let page = 0;

  while (true) {
    const { data } = await supabase
      .from('attributes_new')
      .select('sha, values')
      .eq('slug', 'cryptophunksv67')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    allAttributes = allAttributes.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`✅ Fetched ${allAttributes.length} attribute records\n`);

  // 2. Convert to correct format with lowercase keys
  const attributesMap = {};
  allAttributes.forEach(item => {
    const attrArray = [];

    for (const [key, value] of Object.entries(item.values)) {
      attrArray.push({
        k: key.toLowerCase(),
        v: value
      });
    }

    attributesMap[item.sha] = attrArray;
  });

  console.log('✅ Converted keys to lowercase\n');

  // 3. Upload
  const jsonContent = JSON.stringify(attributesMap);
  const jsonBuffer = Buffer.from(jsonContent);

  const { error } = await supabase.storage
    .from('data')
    .upload('cryptophunksv67_attributes.json', jsonBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log('✅ Uploaded with lowercase keys');
  console.log('🌐 URL: https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/cryptophunksv67_attributes.json');
}

fixAttributesLowercase().catch(console.error);
