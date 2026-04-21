import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envPath = './indexer/.env';
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
    .filter(([k]) => k.startsWith('SUPABASE'))
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const missing = [
  '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d',
  '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0',
  '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919',
];

for (const hashId of missing) {
  const { data, error } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId, owner, slug, sha')
    .eq('hashId', hashId)
    .single();
  if (error) {
    console.log(`${hashId}: NOT IN SUPABASE (${error.message})`);
  } else {
    console.log(`${hashId}:`);
    console.log(`  tokenId: ${data.tokenId}`);
    console.log(`  owner:   ${data.owner}`);
    console.log(`  slug:    ${data.slug}`);
    console.log(`  sha:     ${data.sha}`);
  }
}
