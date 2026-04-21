const LOTTERY = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';

// Try current_owner param
const url = `https://api.ethscriptions.com/api/ethscriptions?current_owner=${LOTTERY}&page=1&per_page=5`;
const res = await fetch(url);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.result ?? []);
console.log('Count:', items.length);
if (items[0]) {
  console.log('First item current_owner:', items[0].current_owner);
  console.log('First item tx_hash:', items[0].transaction_hash);
}

// Also check pagination header
console.log('\nHeaders:', Object.fromEntries([...res.headers.entries()].filter(([k]) => k.includes('total') || k.includes('page') || k.includes('count'))));
