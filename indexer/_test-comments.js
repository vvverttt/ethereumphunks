const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY'
);

async function test() {
  // 1. Test global config query (same as fetchGlobalConfig)
  console.log('=== 1. Global Config (network=1) ===');
  const { data: config, error: configErr } = await supabase
    .from('_global_config')
    .select('*')
    .eq('network', 1)
    .limit(1);
  console.log('Config:', JSON.stringify(config, null, 2));
  if (configErr) console.log('Config error:', JSON.stringify(configErr));
  console.log('comments enabled?', config?.[0]?.comments);

  // 2. Test comments query (same as fetchComments with topic = address)
  const address = '0x332d46c602e9f4f9e67b57c443f1b6ca0ee5ab35';
  console.log('\n=== 2. Comments (topic=' + address + ') ===');
  const { data: comments, error: commentsErr } = await supabase
    .from('comments')
    .select('*')
    .eq('topic', address.toLowerCase())
    .order('createdAt', { ascending: false });
  console.log('Comments:', JSON.stringify(comments, null, 2));
  if (commentsErr) console.log('Comments error:', JSON.stringify(commentsErr));

  // 3. Test ALL comments in the table
  console.log('\n=== 3. All Comments ===');
  const { data: all, error: allErr } = await supabase
    .from('comments')
    .select('*')
    .limit(10);
  console.log('All comments:', JSON.stringify(all, null, 2));
  if (allErr) console.log('All error:', JSON.stringify(allErr));
}

test();
