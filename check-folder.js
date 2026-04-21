import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
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
