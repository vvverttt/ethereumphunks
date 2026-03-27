import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

// Verify attribute files have new SHAs
const newShas = {
  quantummissingphunksv67: '82d87406ea7f2d7cdaebd184c2fdcbf0a98a82550409e030f416375fa46cc083', // #10004
  quantumdystophunkzv67: '20ce20cebd8f07eb29a1b6ce0c4e6481402b429232ebc35f157f973c2a7a9353', // #10251
};

for (const [slug, sha] of Object.entries(newShas)) {
  const { data } = await sb.storage.from('data').download(`${slug}_attributes.json`);
  const parsed = JSON.parse(await data.text());
  const found = sha in parsed;
  console.log(`${slug}: new SHA present=${found}, total=${Object.keys(parsed).length}`);
  if (found) console.log('  attrs:', JSON.stringify(parsed[sha]).slice(0, 100));
}
