const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function main() {
  const { data, error } = await sb
    .from('ethscriptions')
    .select('sha,hashId')
    .eq('slug', 'og-missing-phunks')
    .eq('tokenId', 10197);

  if (error) { console.error(error); return; }
  if (!data || data.length === 0) { console.log('Not found'); return; }

  const sha = data[0].sha;
  console.log('SHA:', sha);

  const buffer = fs.readFileSync('C:/Users/alber/OneDrive/Desktop/market/og missing and dysto/missing_phunks_transparent/10197_fixed.png');
  console.log('Image size:', buffer.length, 'bytes');

  const { error: uploadErr } = await sb.storage
    .from('static')
    .upload('images/' + sha, buffer, { contentType: 'image/png', upsert: true });

  if (uploadErr) {
    console.error('Upload error:', uploadErr.message);
  } else {
    console.log('Uploaded successfully to images/' + sha);
  }
}

main().catch(console.error);
