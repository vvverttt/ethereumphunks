const { createClient } = require('@supabase/supabase-js');
const updates = require('C:/Users/alber/OneDrive/Desktop/market/v67 updates.json');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

const IMAGES_DIR = 'C:/Users/alber/OneDrive/Desktop/market/v67 sha images';
const CONCURRENCY = 8;

async function runWithConcurrency(items, concurrency, fn) {
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; await fn(items[idx]); } }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function run() {
  console.log('Uploading', updates.length, 'images to mint-images/cryptophunksv67/{number}.png...');
  let uploaded = 0, missing = 0, failed = 0;

  await runWithConcurrency(updates, CONCURRENCY, async (u) => {
    const imgPath = path.join(IMAGES_DIR, u.sha + '.png');
    if (!fs.existsSync(imgPath)) { missing++; return; }
    const buf = fs.readFileSync(imgPath);
    const { error } = await supabase.storage
      .from('mint-images')
      .upload('cryptophunksv67/' + u.number + '.png', buf, { contentType: 'image/png', upsert: true });
    if (error) { console.error('❌ ' + u.number, error.message); failed++; }
    else { uploaded++; if (uploaded % 200 === 0) console.log('  ✅', uploaded, '/', updates.length); }
  });

  console.log('Done: uploaded=' + uploaded + ' missing=' + missing + ' failed=' + failed);
}

run().catch(console.error);
