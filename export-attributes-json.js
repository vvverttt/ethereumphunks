import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function exportAttributes() {
  console.log('🔄 Fetching all attributes from database...\n');

  // Fetch all attributes in batches
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
    console.log(`   Fetched page ${page + 1}: ${data.length} items (Total: ${allAttributes.length})`);

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n✅ Fetched ${allAttributes.length} items total\n`);

  // Convert to frontend format: { [sha: string]: Attribute[] }
  // where Attribute = { k: string, v: string }
  // IMPORTANT: When a trait has multiple values (array), expand into separate objects
  const attributesJson = {};

  for (const item of allAttributes) {
    const sha = item.sha;
    const values = item.values;

    // Convert values object to array of { k, v } objects
    const attributes = [];

    for (const [key, value] of Object.entries(values)) {
      // If value is an array, create separate objects for each value
      if (Array.isArray(value)) {
        for (const v of value) {
          attributes.push({
            k: key,
            v: v // Individual string value
          });
        }
      } else {
        // Single value
        attributes.push({
          k: key,
          v: value
        });
      }
    }

    attributesJson[sha] = attributes;
  }

  // Save to file
  const outputPath = 'cryptophunksv67_attributes.json';
  fs.writeFileSync(outputPath, JSON.stringify(attributesJson, null, 2));

  console.log(`✨ Exported attributes to: ${outputPath}\n`);

  // Show sample
  const sampleSha = Object.keys(attributesJson)[0];
  console.log('Sample attributes:');
  console.log(JSON.stringify(attributesJson[sampleSha], null, 2));

  // Count "One of One" items
  let oneOfOneCount = 0;
  for (const attrs of Object.values(attributesJson)) {
    const hasOneOfOne = attrs.some(attr =>
      attr.k === 'Special' && attr.v === 'One of One'
    );
    if (hasOneOfOne) oneOfOneCount++;
  }

  console.log(`\n📊 Verification:`);
  console.log(`   Total items: ${Object.keys(attributesJson).length}`);
  console.log(`   "One of One" count: ${oneOfOneCount} (should be 719)`);
}

exportAttributes().catch(console.error);
