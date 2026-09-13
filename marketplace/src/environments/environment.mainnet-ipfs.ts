import { environment as mainnet } from './environment.mainnet';

// Build target for the IPFS / .eth.limo deploy.
//
// Identical to mainnet except that images and collection metadata resolve to
// paths inside the pinned folder rather than to Supabase. Both are immutable —
// images are content-addressed by sha, and a collection's attributes JSON is
// static — so they can live in the snapshot alongside the app.
//
// `staticUrl` backs BOTH `/static/images/{sha}` and `/data/{slug}_attributes.json`,
// so emptying it redirects every image call site and the metadata fetch at once.
// `yarn build:ipfs` copies those files into the build; without that copy step the
// pages would 404, which is why this is a separate configuration from `mainnet`
// (Cloudflare Pages builds from source and must keep the remote URLs).
//
// Spread from mainnet deliberately: every other value stays in one place.
export const environment = {
  ...mainnet,
  staticUrl: '',
  imageCdnUrl: '',
  // Only this build ships sprite sheets (`build-sprite.mjs` runs after the bundle
  // step), so only this build should go looking for the index. Everywhere else the
  // lookup would 404 on every load and every tile would fall back anyway.
  sprites: true,
  // No service worker on the pinned build. Each re-pin is a new CID on the same
  // origin with freshly hashed filenames, so a worker from an earlier pin keeps
  // control and requests files the new pin does not have — which the catch-all
  // redirect answers with index.html, leaving a blank page and an empty console.
  // See disable-sw.mjs, which also neutralises workers already registered.
  serviceWorker: false,
};
