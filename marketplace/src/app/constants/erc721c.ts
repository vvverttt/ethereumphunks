/**
 * Collections that are pure on-chain ERC-721C (not ethscriptions). These are
 * identified and routed by contract + tokenId rather than by inscription hashId.
 * Add a slug -> NFT contract entry here to onboard a future ERC-721C collection.
 */
export const ERC721C_CONTRACTS: { [slug: string]: string } = {
  cryptophunksv67: '0x67b850c3c8790cc7ec76261b65fde60eFb6F1fe3',
};

export function isErc721c(slug?: string | null): boolean {
  return !!slug && !!ERC721C_CONTRACTS[slug];
}

/** Reverse lookup: NFT contract address (any case) -> collection slug. */
export function slugFromContract(contract?: string | null): string | undefined {
  if (!contract) return undefined;
  const c = contract.toLowerCase();
  return Object.keys(ERC721C_CONTRACTS).find((slug) => ERC721C_CONTRACTS[slug].toLowerCase() === c);
}

/** Positive tokenId for display/routing (some collections store negatives). */
export function displayTokenId(tokenId?: number | null): number | null {
  if (tokenId == null) return null;
  return tokenId < 0 ? -tokenId : tokenId;
}

/**
 * Router link array for an item detail page:
 *  - ERC-721C (with a tokenId) -> /details/{contractAddress}/{tokenId}  (OpenSea-style)
 *  - everything else            -> /details/{hashId}
 * Falls back to the hashId route whenever contract/tokenId aren't both present.
 */
export function itemRouterLink(item?: { slug?: string | null; hashId?: string | null; tokenId?: number | null }): any[] {
  const t = displayTokenId(item?.tokenId);
  if (item && item.slug && isErc721c(item.slug) && t != null) {
    return ['/', 'details', ERC721C_CONTRACTS[item.slug].toLowerCase(), t];
  }
  return ['/', 'details', item?.hashId];
}
