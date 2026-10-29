import { Phunk } from '@/models/db';
import { ERC721C_CONTRACTS } from '@/constants/erc721c';

/** Unlaunched Quantum Missing / Quantum Dysto copies, and the old EtherPhunks sets the collections
 *  dropdown hides: never shown as collections. */
export const NOT_LIVE = ['quantummissingphunksv67', 'quantumdystophunkzv67', 'ethereumphunks', 'etherphunks'];

export interface CollectionLook {
  slug: string;
  name: string;
  single: string;
  logo: string | null;
  supply: number;
  /** rgb triplets from the collection's theme */
  tile: string;
  accent: string;
  bg: string;
}

export interface WalletGroup extends CollectionLook {
  items: Phunk[];
}

/** The collections a wallet can hold, in the collections dropdown's order (EthsRocks first, then the
 *  list's order), each with its theme colours. */
export function liveCollections(
  collections: any[],
  hidden: string[],
  overrides: Record<string, Record<string, string>>,
): (CollectionLook & { previews: Phunk[] })[] {
  const live = (collections || []).filter(c => !hidden.includes(c.slug) && !NOT_LIVE.includes(c.slug));
  return [...live.filter(c => c.slug === 'ethsrocks'), ...live.filter(c => c.slug !== 'ethsrocks')]
    .map(c => {
      const o = overrides[c.slug] || {};
      return {
        slug: c.slug, name: c.name, single: c.singleName || c.name, logo: c.image || null,
        supply: c.supply || 0, previews: c.previews || [],
        tile: o['--phunk-bg'] || '195, 255, 0',
        accent: o['--pink'] || (c.slug === 'cryptophunksv67' ? '103, 205, 255' : '255, 4, 180'),
        bg: o['--background'] || '17, 26, 0',
      };
    });
}

/**
 * A wallet's pieces grouped by collection, in the collections dropdown's order, each with its theme
 * colours. Shared by the menu's "Your Phunks" cards and the /my-phunks page.
 */
export function groupWalletItems(
  items: Phunk[],
  collections: any[],
  hidden: string[],
  overrides: Record<string, Record<string, string>>,
  listed = new Map<string, any>(),
): WalletGroup[] {
  const groups: WalletGroup[] = [];
  for (const { previews, ...c } of liveCollections(collections, hidden, overrides)) {
    const mine = items.filter(p => p.slug === c.slug).map(p => ({ ...p, listing: listed.get(p.hashId) ?? null }));
    if (mine.length) groups.push({ ...c, items: mine });
  }
  return groups;
}

/** v67 pieces open by contract + token id, everything else by hashId. */
export function detailsLink(p: Phunk): any[] {
  const contract = ERC721C_CONTRACTS[p.slug];
  return contract ? ['/details', contract, p.tokenId] : ['/details', p.hashId];
}
