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
};
