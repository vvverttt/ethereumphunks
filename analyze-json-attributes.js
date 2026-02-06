import fs from 'fs';

const jsonData = JSON.parse(
  fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
);

console.log('🔍 Analyzing original JSON attributes...\n');

let oneOfOneCount = 0;
let itemsWithMultipleSpecial = 0;
let itemsWithMultipleSameKey = 0;
const traitTypeCounts = {};

for (const item of jsonData.collection_items) {
  const attributes = item.attributes || [];

  // Check for "One of One"
  const hasOneOfOne = attributes.some(
    attr => attr.trait_type === 'Special' && attr.value === 'One of One'
  );
  if (hasOneOfOne) oneOfOneCount++;

  // Check for multiple values with same trait_type
  const keyCounts = {};
  for (const attr of attributes) {
    keyCounts[attr.trait_type] = (keyCounts[attr.trait_type] || 0) + 1;
    traitTypeCounts[attr.trait_type] = (traitTypeCounts[attr.trait_type] || 0) + 1;
  }

  const multipleKeys = Object.values(keyCounts).some(count => count > 1);
  if (multipleKeys) {
    itemsWithMultipleSameKey++;

    // Check specifically for multiple "Special" values
    if (keyCounts['Special'] > 1) {
      itemsWithMultipleSpecial++;

      if (itemsWithMultipleSpecial <= 3) {
        console.log(`Token #${item.index} has multiple Special values:`);
        attributes
          .filter(a => a.trait_type === 'Special')
          .forEach(a => console.log(`  - ${a.value}`));
      }
    }
  }
}

console.log('\n📊 Analysis Results:');
console.log(`   Total items: ${jsonData.collection_items.length}`);
console.log(`   "One of One" count: ${oneOfOneCount}`);
console.log(`   Items with multiple values for same trait_type: ${itemsWithMultipleSameKey}`);
console.log(`   Items with multiple "Special" values: ${itemsWithMultipleSpecial}`);

console.log('\n📋 All trait_type keys found:');
Object.entries(traitTypeCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([key, count]) => {
    console.log(`   ${key}: ${count} occurrences`);
  });

// Show a sample "One of One" item
const oneOfOneItem = jsonData.collection_items.find(
  item => item.attributes?.some(attr => attr.trait_type === 'Special' && attr.value === 'One of One')
);

if (oneOfOneItem) {
  console.log('\n📝 Sample "One of One" item (Token #' + oneOfOneItem.index + '):');
  console.log(JSON.stringify(oneOfOneItem.attributes, null, 2));
}
