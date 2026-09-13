// Replace the service worker in the IPFS build with Angular's safety worker.
//
//   node disable-sw.mjs --config <name>
//
// Why the bundled build must not run a service worker:
//
// Every re-pin is a new CID but the SAME origin, and each build emits different
// content-hashed filenames. A worker registered by an earlier pin keeps control of
// the origin, serves its own cached shell, and then asks for hashed files that the
// new pin does not contain. The catch-all redirect answers those with index.html at
// HTTP 200, so the worker caches a page where it expected JavaScript and the site
// renders blank with nothing in the console to explain it. eth.limo also sends
// Clear-Site-Data on some responses, which fights the worker's own storage, and the
// result is a browser that cannot recover even when the user clears the cache.
//
// On IPFS the worker buys almost nothing anyway: the content is immutable and the
// gateway already caches it.
//
// Swapping ngsw-worker.js for the safety worker is what heals browsers that are
// already stuck. The browser re-fetches the worker script on navigation, installs
// this one instead, and it unregisters itself and deletes every ngsw cache. The app
// separately stops registering a worker at all on this build.

import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const cfgIdx = process.argv.indexOf('--config');
const BUILD = cfgIdx !== -1
  ? path.join(
      HERE,
      JSON.parse(fs.readFileSync(path.join(HERE, 'angular.json'), 'utf8'))
        .projects['etherphunks-market'].architect.build.configurations[process.argv[cfgIdx + 1]].outputPath.base,
      'browser',
    )
  : process.argv[2];

if (!BUILD || !fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error('usage: node disable-sw.mjs --config <name> | <buildDir>');
  process.exit(1);
}

const worker = path.join(BUILD, 'ngsw-worker.js');
const safety = path.join(BUILD, 'safety-worker.js');

if (!fs.existsSync(safety)) {
  console.error(`safety-worker.js is missing from ${BUILD} — cannot neutralise the service worker`);
  process.exit(1);
}

fs.copyFileSync(safety, worker);
console.log('service worker: ngsw-worker.js replaced with the safety worker (unregisters and clears ngsw caches)');
