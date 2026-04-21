import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function fixAttributesFormat() {
  console.log('🔧 Fixing attributes format...\n');

  // 1. Fetch all attributes
  let allAttributes = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('attributes_new')
      .select('sha, values')
      .eq('slug', 'cryptophunksv67')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    allAttributes = allAttributes.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`✅ Fetched ${allAttributes.length} attribute records\n`);

  // 2. Convert to correct format: array of {k, v} objects
  const attributesMap = {};
  allAttributes.forEach(item => {
    const attrArray = [];

    // Convert {key: value} to [{k: key, v: value}]
    for (const [key, value] of Object.entries(item.values)) {
      attrArray.push({ k: key, v: value });
    }

    attributesMap[item.sha] = attrArray;
  });

  console.log('✅ Converted to correct format\n');

  // 3. Upload to data/cryptophunksv67_attributes.json
  const jsonContent = JSON.stringify(attributesMap);
  const jsonBuffer = Buffer.from(jsonContent);

  const { error: uploadError } = await supabase.storage
    .from('data')
    .upload('cryptophunksv67_attributes.json', jsonBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    console.log('❌ Error:', uploadError);
    return;
  }

  console.log('✅ Uploaded with correct format');
  console.log('🌐 URL: https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/cryptophunksv67_attributes.json');
}

fixAttributesFormat().catch(console.error);
