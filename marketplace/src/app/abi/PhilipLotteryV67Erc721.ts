/**
 * ABI for the ERC-721 QuantumPhunks mint lottery (`PhilipLotteryV67Erc721`,
 * deployed at 0x702862d4cb2E55452170814AAb9117cDE8287e61).
 *
 * Unlike the old ethscription lottery (commit/reveal, pool = hashId strings,
 * PrizeAwarded events), this one is a Chainlink-VRF mint lottery:
 *  - pool items are uint256 tokenIds
 *  - a play is a single `requestMint(quantity, surrenderCollections, surrenderTokenIds)` tx
 *  - the prize is chosen by the VRF callback and emitted as `RandomMinted`
 *  - holders may surrender other collections' NFTs for an ETH discount (`quote`)
 */
export const PhilipLotteryV67Erc721ABI = [
  // ─── Reads ───────────────────────────────────────────────
  { type: 'function', name: 'mintPrice', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'lotteryActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'poolSize', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'poolItems', stateMutability: 'view', inputs: [{ name: 'offset', type: 'uint256' }, { name: 'limit', type: 'uint256' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'maxBatchSize', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'maxPerWallet', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'lotteryMintsOf', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getVRFCost', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'treasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'nft', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'whitelistEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'whitelisted', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'discountsEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'twinWindowOpen', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'unitValue', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'collectionUnits', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'unitsForToken', stateMutability: 'view', inputs: [{ name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'discountForToken', stateMutability: 'view', inputs: [{ name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'creditFor', stateMutability: 'view', inputs: [{ name: 'player', type: 'address' }, { name: 'collections', type: 'address[]' }, { name: 'tokenIds', type: 'uint256[]' }], outputs: [{ name: 'credit', type: 'uint256' }] },
  { type: 'function', name: 'quote', stateMutability: 'view', inputs: [{ name: 'player', type: 'address' }, { name: 'quantity', type: 'uint8' }, { name: 'collections', type: 'address[]' }, { name: 'tokenIds', type: 'uint256[]' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'whitelistDiscount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'whitelistDiscountRemaining', stateMutability: 'view', inputs: [{ name: 'player', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'pendingRefunds', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalPendingRefunds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalCommittedETH', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },

  // ─── Writes ──────────────────────────────────────────────
  { type: 'function', name: 'requestMint', stateMutability: 'payable', inputs: [{ name: 'quantity', type: 'uint8' }, { name: 'surrenderCollections', type: 'address[]' }, { name: 'surrenderTokenIds', type: 'uint256[]' }], outputs: [] },
  { type: 'function', name: 'withdrawRefund', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'refundStuckSpin', stateMutability: 'nonpayable', inputs: [{ name: 'requestId', type: 'uint256' }], outputs: [] },
  // Owner
  { type: 'function', name: 'ownerSpin', stateMutability: 'payable', inputs: [{ name: 'quantity', type: 'uint8' }], outputs: [] },
  { type: 'function', name: 'addPoolTokens', stateMutability: 'nonpayable', inputs: [{ name: 'tokenIds', type: 'uint256[]' }], outputs: [] },
  { type: 'function', name: 'mintRemaining', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'maxCount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'reserveMint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setLotteryConfig', stateMutability: 'nonpayable', inputs: [{ name: 'price', type: 'uint256' }, { name: 'maxBatch', type: 'uint8' }, { name: 'active', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'withdrawSurplusETH', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'cancelPendingMint', stateMutability: 'nonpayable', inputs: [{ name: 'requestId', type: 'uint256' }], outputs: [] },

  // ─── Events ──────────────────────────────────────────────
  { type: 'event', name: 'MintRequested', inputs: [{ indexed: true, name: 'requestId', type: 'uint256' }, { indexed: true, name: 'player', type: 'address' }, { indexed: false, name: 'quantity', type: 'uint8' }, { indexed: false, name: 'mintPayment', type: 'uint256' }] },
  { type: 'event', name: 'RandomMinted', inputs: [{ indexed: true, name: 'requestId', type: 'uint256' }, { indexed: true, name: 'player', type: 'address' }, { indexed: true, name: 'tokenId', type: 'uint256' }] },
  { type: 'event', name: 'MintRequestCancelled', inputs: [{ indexed: true, name: 'requestId', type: 'uint256' }, { indexed: true, name: 'player', type: 'address' }, { indexed: false, name: 'quantity', type: 'uint8' }, { indexed: false, name: 'mintPayment', type: 'uint256' }] },
  { type: 'event', name: 'RefundEscrowed', inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }] },
] as const;
