import { environment } from 'src/environments/environment';

/** Collections whose pieces can have a creation animation: Storage static/animations/{tokenId}.gif
 *  (token ids are unique across collections). Bundled into the build when staticUrl is '', so
 *  playing one costs no RPC and no Supabase egress. A piece without a GIF just shows its image. */
const ANIMATED_SLUGS = new Set(['phunksmas']);
const animCache = new Map<number, Promise<string | null>>();

/** The piece's creation-animation GIF url, or null when it has none. */
export function animationFor(phunk: { slug?: string | null; tokenId?: number | string | null }): Promise<string | null> {
  const id = phunk.tokenId;
  if (!phunk.slug || id == null || !ANIMATED_SLUGS.has(phunk.slug)) return Promise.resolve(null);
  const n = Math.abs(Number(id));
  if (!animCache.has(n)) {
    const url = `${environment.staticUrl}/static/animations/${n}.gif`;
    animCache.set(n, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return animCache.get(n)!;
}
