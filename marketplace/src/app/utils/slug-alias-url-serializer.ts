import { Injectable } from '@angular/core';
import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/**
 * Collections whose public URL differs from their internal slug (the slug in Supabase, the
 * indexer and the theme). Phunkmas was named Phunksmas at first; its data stays under
 * `phunksmas`, but the address bar reads /phunkmas.
 *
 * Every router link is serialized through here, so links everywhere come out as the public
 * name, and both the public name and the old one parse back to the internal slug.
 */
const PUBLIC_BY_SLUG: Record<string, string> = { phunksmas: 'phunkmas' };
const SLUG_BY_PUBLIC: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLIC_BY_SLUG).map(([slug, pub]) => [pub, slug]),
);

/** Swap whole path segments only (never inside query strings, fragments or longer names). */
function swapSegments(url: string, map: Record<string, string>): string {
  const cut = url.search(/[?#]/);
  const path = cut === -1 ? url : url.slice(0, cut);
  const rest = cut === -1 ? '' : url.slice(cut);
  return path.split('/').map((seg) => map[seg] ?? seg).join('/') + rest;
}

@Injectable()
export class SlugAliasUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    return super.parse(swapSegments(url, SLUG_BY_PUBLIC));
  }

  override serialize(tree: UrlTree): string {
    return swapSegments(super.serialize(tree), PUBLIC_BY_SLUG);
  }
}
