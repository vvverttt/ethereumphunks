/**
 * Generate and upload _attributes.json files for OG collections
 * These files are needed by the frontend's getAttributes() method
 * Format: { sha: [{k: "Type", v: "Male"}, ...], ... }
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const OG_DIR = 'C:/Users/alber/OneDrive/Desktop/market/og missing and dysto';

const COLLECTIONS = [
  {
    jsonFile: 'missing-phunks (1).json',
    slug: 'og-missing-phunks',
  },
  {
    jsonFile: 'dysto-phunks (2).json',
    slug: 'og-dysto-phunks',
  },
];

async function main() {
  for (const config of COLLECTIONS) {
    console.log(`\nProcessing ${config.slug}...`);

    const json = JSON.parse(fs.readFileSync(path.join(OG_DIR, config.jsonFile), 'utf-8'));
    const items = json.collection_items;

    // Build attributes map: { sha: [{k, v}, ...] }
    const attributesMap = {};
    for (const item of items) {
      const attrs = (item.attributes || []).map(a => ({
        k: a.trait_type,
        v: a.value,
      }));
      attributesMap[item.sha] = attrs;
    }

    console.log(`  Built attributes for ${Object.keys(attributesMap).length} items`);
    console.log(`  Sample:`, JSON.stringify(Object.entries(attributesMap)[0]).slice(0, 200));

    // Upload to Supabase storage as {slug}_attributes.json
    const fileName = `${config.slug}_attributes.json`;
    const content = JSON.stringify(attributesMap);

    const { error } = await sb.storage
      .from('data')
      .upload(fileName, content, {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) {
      console.error(`  Failed to upload ${fileName}:`, error.message);
    } else {
      console.log(`  Uploaded ${fileName} (${(content.length / 1024).toFixed(1)} KB)`);
    }

    // Verify it's accessible
    const url = `${SUPABASE_URL}/storage/v1/object/public/data/${fileName}`;
    const res = await fetch(url);
    console.log(`  Verify: ${url} -> ${res.status}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
