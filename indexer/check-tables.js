const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hzpwkpjxhtpcygrwtwku.supabase.co', process.env.SUPABASE_SERVICE_ROLE);

const tables = ['events', 'phunk_events', 'market_events', 'ethscription_events', 'transfers', 'history', 'token_events'];

async function main() {
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) console.log('EXISTS:', t, JSON.stringify(data?.[0] ? Object.keys(data[0]) : []));
    else console.log('MISSING:', t);
  }
}
main();
