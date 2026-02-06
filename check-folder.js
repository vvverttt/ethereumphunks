import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkFolder() {
  console.log('🔍 Checking mint-images/cryptophunksv67/ folder...\n');

  const { data: files, error } = await supabase.storage
    .from('mint-images')
    .list('cryptophunksv67', { limit: 10 });

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log(`📂 Found ${files.length} files (showing first 10):`);
  files.forEach(file => console.log(`   - ${file.name}`));

  // Test full URL for first file
  if (files.length > 0) {
    const testFile = files[0].name;
    const publicUrl = supabase.storage
      .from('mint-images')
      .getPublicUrl(`cryptophunksv67/${testFile}`);

    console.log('\n🌐 Example public URL:');
    console.log(`   ${publicUrl.data.publicUrl}`);
  }
}

checkFolder();
