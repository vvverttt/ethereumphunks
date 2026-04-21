// Migrate all storage files from old Supabase project to new one
const OLD_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const NEW_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkxMzU1NiwiZXhwIjoyMDg5NDg5NTU2fQ.KMYkR8Yy0fSJ8WKvKq5_JsynnK-PqQdNxqrIWMAhJ7c';

const CONCURRENCY = 10;

async function listAll(bucket, prefix = '') {
  let allFiles = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${OLD_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OLD_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset })
    });
    const items = await res.json();
    if (!items.length) break;
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        allFiles.push(path);
      } else {
        const sub = await listAll(bucket, path);
        allFiles = allFiles.concat(sub);
      }
    }
    if (items.length < 1000) break;
    offset += 1000;
  }
  return allFiles;
}

async function createBucket(name) {
  const res = await fetch(`${NEW_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NEW_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: name, name, public: true })
  });
  const body = await res.json();
  if (res.ok) {
    console.log(`  Created bucket: ${name}`);
  } else if (body.message?.includes('already exists')) {
    console.log(`  Bucket exists: ${name}`);
  } else {
    console.log(`  Bucket error: ${JSON.stringify(body)}`);
  }
}

async function copyFile(bucket, filePath) {
  // Download from old
  const dlUrl = `${OLD_URL}/storage/v1/object/${bucket}/${filePath}`;
  const dlRes = await fetch(dlUrl, {
    headers: { 'Authorization': `Bearer ${OLD_KEY}` }
  });
  if (!dlRes.ok) {
    return { file: filePath, error: `download ${dlRes.status}` };
  }
  const contentType = dlRes.headers.get('content-type') || 'application/octet-stream';
  const buffer = await dlRes.arrayBuffer();

  // Upload to new
  const upUrl = `${NEW_URL}/storage/v1/object/${bucket}/${filePath}`;
  const upRes = await fetch(upUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NEW_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!upRes.ok) {
    const err = await upRes.text();
    return { file: filePath, error: `upload ${upRes.status}: ${err}` };
  }
  return { file: filePath, ok: true };
}

async function processBatch(bucket, files, startIdx) {
  const batch = files.slice(startIdx, startIdx + CONCURRENCY);
  return Promise.all(batch.map(f => copyFile(bucket, f)));
}

async function migrateBucket(bucket) {
  console.log(`\nListing ${bucket}...`);
  const files = await listAll(bucket);
  console.log(`  ${files.length} files to copy`);

  await createBucket(bucket);

  let copied = 0, errors = 0;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const results = await processBatch(bucket, files, i);
    for (const r of results) {
      if (r.ok) {
        copied++;
      } else {
        errors++;
        console.log(`  ERROR: ${r.file} - ${r.error}`);
      }
    }
    if ((copied + errors) % 100 === 0 || i + CONCURRENCY >= files.length) {
      console.log(`  Progress: ${copied}/${files.length} copied, ${errors} errors`);
    }
  }
  console.log(`  Done: ${copied} copied, ${errors} errors`);
}

async function main() {
  console.log('=== Supabase Storage Migration ===');

  for (const bucket of ['data', 'mint-images', 'static']) {
    await migrateBucket(bucket);
  }

  console.log('\n=== Migration Complete ===');
}

main().catch(e => console.error(e));
