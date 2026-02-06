import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function verifyAttributes() {
  console.log('🔍 Verifying attribute counts...\n');

  // Fetch all attributes from database
  let allAttributes = [];
  let page = 0;

  while (true) {
    const { data } = await supabase
      .from('attributes_new')
      .select('sha, values')
      .eq('slug', 'cryptophunksv67')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    allAttributes = allAttributes.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`✅ Fetched ${allAttributes.length} records\n`);

  // Count occurrences of each attribute value
  const attributeCounts = new Map();

  allAttributes.forEach(item => {
    for (const [key, value] of Object.entries(item.values)) {
      // Skip Name and Description
      if (key === 'Name' || key === 'Description') continue;

      if (!attributeCounts.has(key)) {
        attributeCounts.set(key, new Map());
      }

      const valueCounts = attributeCounts.get(key);
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
    }
  });

  // Display counts sorted by attribute
  console.log('📊 Attribute Value Counts:\n');

  const sortedKeys = Array.from(attributeCounts.keys()).sort();

  for (const key of sortedKeys) {
    console.log(`\n${key}:`);
    const valueCounts = attributeCounts.get(key);
    const sortedValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [value, count] of sortedValues) {
      console.log(`  ${value}: ${count}`);
    }
  }

  // Find "one of one" attributes (count = 1)
  console.log('\n\n🎯 One-of-One Attributes (Rare):');
  for (const key of sortedKeys) {
    const valueCounts = attributeCounts.get(key);
    const oneOfOnes = Array.from(valueCounts.entries())
      .filter(([_, count]) => count === 1);

    if (oneOfOnes.length > 0) {
      console.log(`\n${key}:`);
      for (const [value, count] of oneOfOnes) {
        console.log(`  ${value}: ${count}`);
      }
    }
  }
}

verifyAttributes().catch(console.error);
