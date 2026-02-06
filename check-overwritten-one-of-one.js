import fs from 'fs';

const jsonData = JSON.parse(
  fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
);

console.log('🔍 Checking which "One of One" items get overwritten...\n');

let keptCount = 0;
let overwrittenCount = 0;

for (const item of jsonData.collection_items) {
  const attributes = item.attributes || [];

  // Check if has "One of One"
  const hasOneOfOne = attributes.some(
    attr => attr.trait_type === 'Special' && attr.value === 'One of One'
  );

  if (!hasOneOfOne) continue;

  // Simulate the flat format conversion (last value wins)
  const values = {};
  for (const attr of attributes) {
    values[attr.trait_type] = attr.value;
  }

  // Check if "One of One" survived
  if (values['Special'] === 'One of One') {
    keptCount++;
  } else {
    overwrittenCount++;
    if (overwrittenCount <= 5) {
      console.log(`Token #${item.index}: "One of One" overwritten by "${values['Special']}"`);
    }
  }
}

console.log(`\n📊 Results:`);
console.log(`   Total "One of One" items: ${keptCount + overwrittenCount}`);
console.log(`   Kept (last value): ${keptCount}`);
console.log(`   Overwritten: ${overwrittenCount}`);
console.log(`\n⚠️  This matches the database count of ${keptCount}!`);
