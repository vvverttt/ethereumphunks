export const EthsRocksABI = [
  // ─── Constants ────────────────────────────────────────────
  {
    inputs: [],
    name: 'BASE_PRICE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'REVEAL_DELAY',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'REVEAL_EXPIRY',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── View: State ──────────────────────────────────────────
  {
    inputs: [],
    name: 'currentPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'poolSize',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalRevealed',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pendingReveals',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'merkleRoot',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── View: Commitments ────────────────────────────────────
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'commitments',
    outputs: [
      { internalType: 'uint256', name: 'commitBlock', type: 'uint256' },
      { internalType: 'uint256', name: 'priceLocked', type: 'uint256' },
      { internalType: 'bytes32', name: 'missingPhunkHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'quantumDystoHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'quantumPhunkHash', type: 'bytes32' },
      { internalType: 'address', name: 'nftContract', type: 'address' },
      { internalType: 'uint256', name: 'philipOrWrappedId', type: 'uint256' },
      { internalType: 'uint256', name: 'cryptoPhunksV2Id', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'pendingReturns',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── View: Usage tracking ─────────────────────────────────
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'usedEthscription',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '', type: 'address' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    name: 'usedERC721',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── View: Pool ───────────────────────────────────────────
  {
    inputs: [
      { internalType: 'uint256', name: 'offset', type: 'uint256' },
      { internalType: 'uint256', name: 'limit', type: 'uint256' },
    ],
    name: 'getPoolItems',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── View: Addresses ──────────────────────────────────────
  {
    inputs: [],
    name: 'philipInternAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'wrappedV1Address',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cryptoPhunksV2Address',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── Write: Purchase ──────────────────────────────────────
  {
    inputs: [
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
      { internalType: 'uint256', name: 'maxPrice', type: 'uint256' },
      { internalType: 'bytes32', name: 'missingPhunkHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'quantumDystoHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'quantumPhunkHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'philipOrWrappedTokenId', type: 'uint256' },
      { internalType: 'bool', name: 'usePhilipIntern', type: 'bool' },
      { internalType: 'uint256', name: 'cryptoPhunksV2TokenId', type: 'uint256' },
    ],
    name: 'commit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'reveal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cancelCommitment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ─── View: Admin ─────────────────────────────────────────
  {
    inputs: [],
    name: 'signerAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'treasuryAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pointsAddress',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'inPool',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ─── Write: Admin ──────────────────────────────────────────
  {
    inputs: [{ internalType: 'address', name: '_signer', type: 'address' }],
    name: 'setSignerAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address payable', name: '_treasury', type: 'address' }],
    name: 'setTreasuryAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_points', type: 'address' }],
    name: 'setPointsAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address payable', name: 'to', type: 'address' },
    ],
    name: 'withdrawETH',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'hashId', type: 'bytes32' }],
    name: 'withdrawFromPool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32[]', name: 'hashIds', type: 'bytes32[]' }],
    name: 'withdrawFromPoolBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'hashId', type: 'bytes32' }],
    name: 'emergencyWithdrawEthscription',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'nftContract', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'resetUsedERC721',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'hashId', type: 'bytes32' }],
    name: 'resetUsedEthscription',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_totalRevealed', type: 'uint256' }],
    name: 'resetTotalRevealed',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ─── Events ───────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'hashId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'price', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'saleNumber', type: 'uint256' },
    ],
    name: 'RockPurchased',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'price', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'commitBlock', type: 'uint256' },
    ],
    name: 'RockCommitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
    ],
    name: 'CommitmentCancelled',
    type: 'event',
  },
] as const;
