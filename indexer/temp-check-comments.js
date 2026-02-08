const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY'
);

async function check() {
  // Get table columns by selecting with * and limit 0
  const { data: cols, error: colsErr } = await supabase
    .from('comments')
    .select('*')
    .limit(0);
  console.log('Comments table select result:', cols);
  console.log('Comments columns error:', colsErr);

  // Try comments_sepolia
  const { data: sepoliaComments, error: sepErr } = await supabase
    .from('comments_sepolia')
    .select('*')
    .limit(5);
  console.log('\ncomments_sepolia:', JSON.stringify(sepoliaComments, null, 2));
  if (sepErr) console.log('Sepolia comments error:', sepErr);

  // Check all tables that might contain comments
  // Try with the tx hash the user mentioned
  const txHash = '0x05032d5d081920f9786bd8b5723b3480c0258a3346afa67f04ca8f29baf633f6';
  
  // Try ethscriptions table
  const { data: ethscription, error: ethErr } = await supabase
    .from('ethscriptions')
    .select('*')
    .eq('hashId', txHash)
    .limit(1);
  console.log('\nethscriptions for tx:', JSON.stringify(ethscription, null, 2));
  if (ethErr) console.log('Ethscription error:', ethErr);
  
  // Check if the comments are stored differently - look at comment-related data
  // Try fetching with ilike on content
  const { data: allComments, error: allErr } = await supabase
    .from('comments')
    .select()
    .limit(20);
  console.log('\nAll comments (raw):', JSON.stringify(allComments, null, 2));
  if (allErr) console.log('All comments error:', allErr);

  // Also try the 'tic_comments' table  
  const { data: ticComments, error: ticErr } = await supabase
    .from('tic_comments')
    .select('*')
    .limit(5);
  console.log('\ntic_comments:', JSON.stringify(ticComments, null, 2));
  if (ticErr) console.log('tic_comments error:', ticErr);
}

check();
