// Run this in the browser console (F12) to clear all caches

console.log('🧹 Clearing all caches...');

// Clear localStorage
localStorage.clear();
console.log('✅ localStorage cleared');

// Clear sessionStorage
sessionStorage.clear();
console.log('✅ sessionStorage cleared');

// Clear IndexedDB
if (window.indexedDB) {
  indexedDB.databases().then((databases) => {
    databases.forEach((db) => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
        console.log(`✅ Deleted database: ${db.name}`);
      }
    });
  });
}

// Clear service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('✅ Service worker unregistered');
    });
  });
}

console.log('\n✨ All caches cleared! Now do a hard reload (Ctrl+Shift+R)');
