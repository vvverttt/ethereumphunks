/**
 * Import OG collections (Missing Phunks & DystoPhunkz) into Supabase
 *
 * Steps:
 * 1. Insert collection records
 * 2. Insert attributes_new records (so indexer recognizes them)
 * 3. Fetch current ownership from ethscriptions API
 * 4. Insert ethscription records
 * 5. Rename images to {sha}.png and upload to Supabase storage
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const OG_DIR = 'C:/Users/alber/OneDrive/Desktop/market/og missing and dysto';

const COLLECTIONS = [
  {
    jsonFile: 'missing-phunks (1).json',
    imageDir: 'missing_phunks_transparent',
    slug: 'og-missing-phunks',
    name: 'OG Missing Phunks',
    singleName: 'OG Missing Phunk',
    description: 'The original Missing Phunks — CryptoPhunks #10,000-10,250, crafted as Ethscription digital artifacts.',
    supply: 250,
  },
  {
    jsonFile: 'dysto-phunks (2).json',
    imageDir: 'dystophunks',
    slug: 'og-dysto-phunks',
    name: 'OG DystoPhunkz',
    singleName: 'OG DystoPhunk',
    description: 'The original DystoPhunkz — Ethscription-crafted digital artifacts.',
    supply: 69,
  },
];

// Build a map from tokenId -> image file path
function buildImageMap(imageDir, items) {
  const files = fs.readdirSync(imageDir);
  const map = {};
  for (const item of items) {
    // Find file matching this token ID
    const match = files.find(f => {
      const parts = f.replace('.png', '').split('_');
      const fileId = parts[0]; // e.g. "10000"
      return fileId === String(item.index);
    });
    if (match) {
      map[item.sha] = path.join(imageDir, match);
    }
  }
  return map;
}

// Fetch current owner from ethscriptions API with retry
async function fetchOwnership(hashId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}`);
      if (res.status === 429) {
        // Rate limited — wait and retry
        console.log(`  Rate limited, waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) {
        console.log(`  API returned ${res.status} for ${hashId}`);
        return null;
      }
      const data = await res.json();
      return {
        creator: data.creator?.toLowerCase(),
        owner: data.current_owner?.toLowerCase(),
        prevOwner: data.previous_owner?.toLowerCase() || data.creator?.toLowerCase(),
        createdAt: data.creation_timestamp,
      };
    } catch (err) {
      console.log(`  Fetch error for ${hashId}: ${err.message}`);
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function importCollection(config) {
  console.log(`\n========== Importing ${config.name} ==========\n`);

  const json = JSON.parse(fs.readFileSync(path.join(OG_DIR, config.jsonFile), 'utf-8'));
  const items = json.collection_items;
  console.log(`Found ${items.length} items in JSON`);

  // 1. Insert collection record
  console.log('\n--- Step 1: Insert collection record ---');
  const { error: collErr } = await sb.from('collections').upsert({
    slug: config.slug,
    name: config.name,
    singleName: config.singleName,
    description: config.description,
    supply: config.supply,
    active: true,
    isMinting: false,
    mintEnabled: false,
    hasBackgrounds: false,
    notifications: false,
    standalone: false,
    image: json.logo_image || null,
    website: json.website_url || null,
    twitter: json.twitter_url || null,
    discord: json.discord_url || null,
  }, { onConflict: 'slug' });

  if (collErr) {
    console.error('Failed to insert collection:', collErr);
    return;
  }
  console.log(`Collection "${config.slug}" inserted/updated`);

  // 2. Insert attributes_new records (batch of 100)
  console.log('\n--- Step 2: Insert attributes ---');
  const attrRows = items.map(item => ({
    sha: item.sha,
    slug: config.slug,
    tokenId: item.index,
    values: item.attributes,
  }));

  for (let i = 0; i < attrRows.length; i += 100) {
    const batch = attrRows.slice(i, i + 100);
    const { error } = await sb.from('attributes_new').insert(batch);
    if (error) {
      console.error(`Attributes batch ${i} error:`, error);
    } else {
      console.log(`  Inserted attributes ${i + 1}-${Math.min(i + 100, attrRows.length)}`);
    }
  }

  // 3. Fetch ownership and insert ethscriptions
  console.log('\n--- Step 3: Fetch ownership & insert ethscriptions ---');
  const ethRows = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`\r  Fetching ownership ${i + 1}/${items.length}...`);

    const ownership = await fetchOwnership(item.id);
    ethRows.push({
      hashId: item.id.toLowerCase(),
      sha: item.sha,
      slug: config.slug,
      tokenId: item.index,
      creator: ownership?.creator || '0x0000000000000000000000000000000000000000',
      owner: ownership?.owner || '0x0000000000000000000000000000000000000000',
      prevOwner: ownership?.prevOwner || '0x0000000000000000000000000000000000000000',
      createdAt: ownership?.createdAt || new Date().toISOString(),
      locked: false,
    });

    // Small delay to avoid rate limiting
    if ((i + 1) % 10 === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  console.log('');

  // Insert ethscriptions in batches
  for (let i = 0; i < ethRows.length; i += 50) {
    const batch = ethRows.slice(i, i + 50);
    const { error } = await sb.from('ethscriptions').upsert(batch, {
      onConflict: 'hashId',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error(`Ethscriptions batch ${i} error:`, error);
    } else {
      console.log(`  Inserted ethscriptions ${i + 1}-${Math.min(i + 50, ethRows.length)}`);
    }
  }

  // 4. Upload images renamed to {sha}.png
  console.log('\n--- Step 4: Upload images ---');
  const imageDir = path.join(OG_DIR, config.imageDir);
  const imageMap = buildImageMap(imageDir, items);
  let uploaded = 0;
  let skipped = 0;

  for (const [sha, filePath] of Object.entries(imageMap)) {
    const buffer = fs.readFileSync(filePath);
    const storagePath = `images/${sha}`;

    const { error } = await sb.storage
      .from('static')
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      if (error.message?.includes('already exists') || error.statusCode === '409') {
        skipped++;
      } else {
        console.error(`  Upload error for ${sha}: ${error.message}`);
      }
    } else {
      uploaded++;
    }

    if ((uploaded + skipped) % 25 === 0) {
      process.stdout.write(`\r  Uploaded: ${uploaded}, Skipped: ${skipped}/${Object.keys(imageMap).length}`);
    }
  }
  console.log(`\n  Final: ${uploaded} uploaded, ${skipped} already existed`);

  // Check for items without images
  const missingImages = items.filter(i => !imageMap[i.sha]);
  if (missingImages.length > 0) {
    console.log(`\n  WARNING: ${missingImages.length} items had no matching image file:`);
    missingImages.slice(0, 5).forEach(i => console.log(`    - #${i.index} sha=${i.sha}`));
  }

  console.log(`\n========== Done: ${config.name} ==========\n`);
}

async function main() {
  console.log('Starting OG collections import...\n');

  for (const config of COLLECTIONS) {
    await importCollection(config);
  }

  // Also upload collection JSON to mint-data bucket
  console.log('\n--- Uploading collection JSON to mint-data ---');
  for (const config of COLLECTIONS) {
    const jsonContent = fs.readFileSync(path.join(OG_DIR, config.jsonFile), 'utf-8');
    const parsed = JSON.parse(jsonContent);
    // Update slug in the JSON to match our new slug
    parsed.slug = config.slug;

    const { error } = await sb.storage
      .from('data')
      .upload(`${config.slug}.json`, JSON.stringify(parsed), {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${config.slug}.json:`, error.message);
    } else {
      console.log(`  Uploaded ${config.slug}.json`);
    }
  }

  console.log('\nAll done! Collections should now appear in the marketplace.');
}

main().catch(console.error);
