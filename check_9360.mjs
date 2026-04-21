import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const hashId = '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0';

const { data: eth } = await sb.from('ethscriptions').select('*').eq('hashId', hashId).single();
console.log('Supabase ethscription:', JSON.stringify(eth, null, 2));

// Check recent activity
const { data: activity } = await sb.from('activity').select('*').eq('hashId', hashId).order('createdAt', { ascending: false }).limit(10);
console.log('\nRecent activity:', JSON.stringify(activity, null, 2));
