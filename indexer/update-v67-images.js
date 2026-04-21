/**
 * update-v67-images.js
 *
 * Swaps 3399 V67 QuantumPhunk images in Supabase:
 *  1. Fetches old rows from DB for all tokenIds
 *  2. Uploads new images to `static` bucket at path `images/{sha}`
 *  3. DB update (works around FK constraint on events.hashId):
 *       a. INSERT new ethscription rows (new hashId, new sha, oldHashId = old hashId)
 *       b. UPDATE events / listings / bids from old hashId → new hashId
 *       c. DELETE old ethscription rows
 *  4. Deletes old images from `static` bucket
 *
 * Run from the indexer/ directory:
 *   node update-v67-images.js
 *
 * Options (env vars):
 *   SKIP_UPLOAD=1     — skip image upload step
 *   SKIP_DB=1         — skip database update step
 *   SKIP_DELETE=1     — skip old image deletion step
 *   DRY_RUN=1         — print actions without executing them
 *   START_INDEX=N     — resume from index N (0-based)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ─── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';

const UPDATES_JSON = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\v67 updates.json';
const IMAGES_DIR   = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\v67 sha images';
const COLLECTION_SLUG = 'cryptophunksv67';
const BUCKET = 'static';
const CONCURRENCY = 5;

const SKIP_UPLOAD = process.env.SKIP_UPLOAD === '1';
const SKIP_DB     = process.env.SKIP_DB     === '1';
const SKIP_DELETE = process.env.SKIP_DELETE === '1';
const DRY_RUN     = process.env.DRY_RUN     === '1';
const START_INDEX = parseInt(process.env.START_INDEX || '0', 10);

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function runWithConcurrency(items, concurrency, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  console.log('📖 Loading updates JSON...');
  const updates = JSON.parse(fs.readFileSync(UPDATES_JSON, 'utf8'));
  console.log(`   ${updates.length} total updates`);

  const todo = updates.slice(START_INDEX);
  console.log(`   Starting from index ${START_INDEX}, processing ${todo.length} items\n`);

  if (DRY_RUN) console.log('⚠️  DRY RUN — no changes will be made\n');

  // ── Step 1: Fetch old rows ─────────────────────────────────────────────────
  console.log('🔍 Step 1: Fetching old rows from database...');
  const tokenIds = todo.map(u => u.number);
  // tokenId → full old row
  const oldRowMap = new Map();

  const PAGE_SIZE = 1000;
  for (let p = 0; p < tokenIds.length; p += PAGE_SIZE) {
    const batch = tokenIds.slice(p, p + PAGE_SIZE);
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('*')
      .eq('slug', COLLECTION_SLUG)
      .in('tokenId', batch);

    if (error) { console.error('❌ Fetch failed:', error.message); process.exit(1); }
    (data || []).forEach(row => oldRowMap.set(row.tokenId, row));
  }
  console.log(`   Found ${oldRowMap.size} existing rows\n`);

  // ── Step 2: Upload new images ──────────────────────────────────────────────
  if (!SKIP_UPLOAD) {
    console.log('📤 Step 2: Uploading new images to Supabase storage...');
    let uploaded = 0, missing = 0, failed = 0;

    await runWithConcurrency(todo, CONCURRENCY, async (update) => {
      const { sha } = update;
      const imagePath = path.join(IMAGES_DIR, `${sha}.png`);

      if (!fs.existsSync(imagePath)) {
        console.warn(`   ⚠️  Missing file sha=${sha.slice(0,8)}...`);
        missing++;
        return;
      }
      if (DRY_RUN) { uploaded++; if (uploaded % 500 === 0) console.log(`   DRY: ${uploaded}/${todo.length}`); return; }

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`images/${sha}`, fs.readFileSync(imagePath), { contentType: 'image/png', upsert: true });

      if (error) { console.error(`   ❌ sha=${sha.slice(0,8)}: ${error.message}`); failed++; }
      else { uploaded++; if (uploaded % 100 === 0) console.log(`   ✅ ${uploaded}/${todo.length}`); }
    });

    console.log(`\n   Upload done: ${uploaded} uploaded, ${missing} missing, ${failed} errors\n`);
  } else {
    console.log('⏭️  SKIP_UPLOAD — skipping\n');
  }

  // ── Step 3: DB update (insert new → re-point tx data → delete old) ─────────
  if (!SKIP_DB) {

    // 3a. INSERT new ethscription rows
    console.log('🗄️  Step 3a: Inserting new ethscription rows...');
    {
      let inserted = 0, skipped = 0, failed = 0;
      const newRows = [];

      for (const update of todo) {
        const old = oldRowMap.get(update.number);
        if (!old) { skipped++; continue; }

        const newHashId = update.transactionHash.toLowerCase();
        if (old.hashId.toLowerCase() === newHashId) { skipped++; continue; } // nothing changed

        newRows.push({
          ...old,
          hashId: newHashId,
          sha: update.sha,
          oldHashId: old.hashId.toLowerCase(),
        });
      }

      console.log(`   ${newRows.length} rows to insert (${skipped} skipped — already correct)\n`);

      if (!DRY_RUN && newRows.length > 0) {
        // Upsert in batches of 500
        const BATCH = 500;
        for (let b = 0; b < newRows.length; b += BATCH) {
          const batch = newRows.slice(b, b + BATCH);
          const { error } = await supabase
            .from('ethscriptions')
            .upsert(batch, { onConflict: 'hashId' });

          if (error) {
            console.error(`   ❌ Insert batch ${b}: ${error.message}`);
            failed += batch.length;
          } else {
            inserted += batch.length;
            console.log(`   ✅ Inserted ${inserted}/${newRows.length}`);
          }
        }
        console.log(`\n   Insert done: ${inserted} inserted, ${failed} errors\n`);
      } else if (DRY_RUN) {
        console.log(`   DRY: would insert ${newRows.length} rows\n`);
      }
    }

    // 3b. UPDATE events / listings / bids old hashId → new hashId
    console.log('🔗 Step 3b: Re-pointing events, listings, bids...');
    {
      const remap = [];
      for (const update of todo) {
        const old = oldRowMap.get(update.number);
        const newHashId = update.transactionHash.toLowerCase();
        if (old && old.hashId && old.hashId.toLowerCase() !== newHashId) {
          remap.push({ oldHashId: old.hashId.toLowerCase(), newHashId });
        }
      }
      console.log(`   ${remap.length} hashIds to re-point`);

      if (!DRY_RUN) {
        for (const table of ['events', 'listings', 'bids', 'auctions']) {
          let updated = 0, noRows = 0, failed = 0;
          await runWithConcurrency(remap, CONCURRENCY, async ({ oldHashId, newHashId }) => {
            const { data, error } = await supabase
              .from(table)
              .update({ hashId: newHashId })
              .eq('hashId', oldHashId)
              .select('hashId');

            if (error) { console.error(`   ❌ ${table} ${oldHashId.slice(0,10)}: ${error.message}`); failed++; }
            else if (!data?.length) noRows++;
            else updated++;
          });
          console.log(`   ${table}: ${updated} updated, ${noRows} had no rows, ${failed} errors`);
        }
      } else {
        console.log(`   DRY: would re-point ${remap.length} rows in events/listings/bids`);
      }
      console.log();
    }

    // 3c. DELETE old ethscription rows
    console.log('🗑️  Step 3c: Deleting old ethscription rows...');
    {
      const oldHashIds = [];
      for (const update of todo) {
        const old = oldRowMap.get(update.number);
        const newHashId = update.transactionHash.toLowerCase();
        if (old && old.hashId.toLowerCase() !== newHashId) {
          oldHashIds.push(old.hashId.toLowerCase());
        }
      }

      console.log(`   ${oldHashIds.length} old rows to delete`);

      if (!DRY_RUN && oldHashIds.length > 0) {
        let deleted = 0, failed = 0;
        // Delete one-by-one to avoid URL length limits with .in() on long hashIds
        await runWithConcurrency(oldHashIds, CONCURRENCY, async (hashId) => {
          const { error } = await supabase
            .from('ethscriptions')
            .delete()
            .eq('hashId', hashId);

          if (error) { console.error(`   ❌ ${hashId.slice(0,10)}: ${error.message}`); failed++; }
          else { deleted++; if (deleted % 100 === 0) console.log(`   ✅ Deleted ${deleted}/${oldHashIds.length}`); }
        });
        console.log(`   ✅ Deleted ${deleted}/${oldHashIds.length}`);
        console.log(`\n   Delete done: ${deleted} deleted, ${failed} errors\n`);
      } else if (DRY_RUN) {
        console.log(`   DRY: would delete ${oldHashIds.length} old rows\n`);
      }
    }

  } else {
    console.log('⏭️  SKIP_DB — skipping\n');
  }

  // ── Step 4: Delete old images from storage ────────────────────────────────
  if (!SKIP_DELETE) {
    console.log('🗑️  Step 4: Deleting old images from storage...');
    const newShaSet = new Set(todo.map(u => u.sha));
    const oldPaths = [];

    for (const update of todo) {
      const old = oldRowMap.get(update.number);
      if (!old?.sha) continue;
      if (old.sha === update.sha) continue;
      if (newShaSet.has(old.sha)) continue;
      oldPaths.push(`images/${old.sha}`);
    }

    console.log(`   ${oldPaths.length} old images to delete`);

    if (!DRY_RUN && oldPaths.length > 0) {
      let deleted = 0, failed = 0;
      const BATCH = 1000;
      for (let b = 0; b < oldPaths.length; b += BATCH) {
        const batch = oldPaths.slice(b, b + BATCH);
        const { error } = await supabase.storage.from(BUCKET).remove(batch);
        if (error) { console.error(`   ❌ ${error.message}`); failed += batch.length; }
        else { deleted += batch.length; console.log(`   ✅ Deleted ${deleted}/${oldPaths.length}`); }
      }
      console.log(`\n   Delete done: ${deleted} deleted, ${failed} errors\n`);
    } else if (DRY_RUN) {
      console.log(`   DRY: would delete ${oldPaths.length} old images\n`);
    } else {
      console.log('   Nothing to delete.\n');
    }
  } else {
    console.log('⏭️  SKIP_DELETE — skipping\n');
  }

  console.log('🎉 All done!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
