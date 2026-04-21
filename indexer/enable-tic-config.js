const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function enableTicAndChat() {
  for (const network of [1, 11155111]) {
    console.log(`\nChecking network ${network}...`);

    const { data: current, error: readError } = await supabase
      .from('_global_config')
      .select('*')
      .eq('network', network)
      .limit(1);

    if (readError) {
      console.error(`Error reading config for network ${network}:`, readError);
      continue;
    }

    if (!current || current.length === 0) {
      console.log(`No config row found for network ${network}, skipping.`);
      continue;
    }

    console.log('Current config:', JSON.stringify(current[0], null, 2));

    const { data, error } = await supabase
      .from('_global_config')
      .update({ comments: true, chat: true })
      .eq('network', network)
      .select();

    if (error) {
      console.error(`Error updating config for network ${network}:`, error);
    } else {
      console.log(`Updated config for network ${network}:`, JSON.stringify(data[0], null, 2));
    }
  }
}

enableTicAndChat().catch(console.error);
