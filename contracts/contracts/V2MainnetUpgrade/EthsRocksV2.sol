// SPDX-License-Identifier: PHUNKY

/****** EthsRocks V2 **********************
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░████░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░██░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
****************************************/

/* ========================================
   ∬  EthsRocks V2 Sale Contract          ∬
   ========================================
   ∬  Open sale — no token gating          ∬
   ∬  Commit-reveal purchase (MEV-safe)    ∬
   ∬  Escalating price per sale            ∬
   ∬  67 points on purchase                ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";
import "./interfaces/IPoints.sol";

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract EthsRocksV2 is Initializable, EthscriptionsEscrower, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    // ─── Constants ─────────────────────────────────────────────
    uint256 public constant BASE_PRICE = 0.001 ether;
    uint256 public constant REVEAL_DELAY = 2;
    uint256 public constant REVEAL_EXPIRY = 256;

    // ─── Commitment struct (V1 layout preserved for storage compatibility) ──
    struct Commitment {
        uint256 commitBlock;
        uint256 priceLocked;
        bytes32 missingPhunkHash;       // unused in V2, kept for storage layout
        bytes32 quantumDystoHash;       // unused in V2, kept for storage layout
        bytes32 quantumPhunkHash;       // unused in V2, kept for storage layout
        address nftContract;            // unused in V2, kept for storage layout
        uint256 philipOrWrappedId;      // unused in V2, kept for storage layout
        uint256 cryptoPhunksV2Id;       // unused in V2, kept for storage layout
    }

    // ─── State (V1 layout — DO NOT reorder) ──────────────────

    // Treasury + Points
    address payable public treasuryAddress;
    address public pointsAddress;
    bytes32 public merkleRoot;

    // ERC-721 token-gate addresses (unused in V2, kept for storage layout)
    address public philipInternAddress;
    address public wrappedV1Address;
    address public cryptoPhunksV2Address;

    // Pool (swap-and-pop)
    bytes32[] private _pool;
    mapping(bytes32 => uint256) private _poolIndex;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;

    // Per-token usage tracking (unused in V2, kept for storage layout)
    mapping(bytes32 => bool) public usedEthscription;
    mapping(address => mapping(uint256 => bool)) public usedERC721;

    // Commit-reveal
    mapping(address => Commitment) public commitments;
    uint256 public totalRevealed;
    uint256 public pendingReveals;

    // Randomness
    bytes32 private _lastRandomHash;

    // Hybrid refunds
    mapping(address => uint256) public pendingReturns;

    // Signer (unused in V2, kept for storage layout)
    address public signerAddress;

    // Committed ETH protection
    uint256 public totalCommittedETH;

    // ─── V2 additions (new storage slots — append only) ──────
    address public __deprecated_priceFeed;   // was IAggregatorV3, kept for storage layout
    uint256 public __deprecated_usdPerSale;  // was USD per sale, kept for storage layout
    uint256 public __deprecated_maxStaleness;// was oracle staleness, kept for storage layout
    mapping(address => bool) public blocked; // Wallets blocked from purchasing
    mapping(address => bool) public allowed; // Wallets allowed to purchase (OG holders)
    bool public allowlistEnabled;            // Toggle allowlist check

    // ─── V3 additions (free claim + swap) ──────────────────────
    mapping(address => uint256) public freeClaims; // Number of free claims remaining per wallet
    uint256 public totalFreeClaimed;
    uint256 public totalSwapped;
    bool public swapEnabled;
    mapping(bytes32 => bool) public eligibleEthscription; // valid OG hashIds for swap
    uint256 public cryptoPhunksV2Required;  // default 1
    uint256 public philipInternRequired;    // default 3
    bytes32 public batchSwapMerkleRoot; // Merkle root for batch-eligible hashIds (e.g. EtherPhunks)
    uint256 public ethscriptionBatchRequired; // how many needed for batch swap (default 5)
    mapping(bytes32 => bool) public usedBatchEthscription; // prevent reuse

    // ─── Events ────────────────────────────────────────────────

    event RockPurchased(bytes32 indexed hashId, address indexed buyer, uint256 price, uint256 saleNumber);
    event RockCommitted(address indexed buyer, uint256 price, uint256 commitBlock);
    event CommitmentCancelled(address indexed buyer);
    event PoolDeposited(bytes32 indexed hashId);
    event PoolWithdrawn(bytes32 indexed hashId);

    // ─── Constructor ───────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address payable _treasuryAddress,
        address _pointsAddress,
        bytes32 _merkleRoot,
        address _philipInternAddress,
        address _wrappedV1Address,
        address _cryptoPhunksV2Address
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_treasuryAddress != address(0), "Invalid treasury");
        treasuryAddress = _treasuryAddress;
        pointsAddress = _pointsAddress;
        merkleRoot = _merkleRoot;
        philipInternAddress = _philipInternAddress;
        wrappedV1Address = _wrappedV1Address;
        cryptoPhunksV2Address = _cryptoPhunksV2Address;

        _lastRandomHash = keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, msg.sender
        ));
    }

    // ─── Fallback: receives ethscriptions ──────────────────────
    //  Owner: deposits into pool
    //  Anyone else: holds for swap (must call swapEthscription after)

    fallback() external {
        require(msg.data.length > 0 && msg.data.length % 32 == 0, "Invalid length");

        if (msg.sender == owner()) {
            // Owner deposit into pool
            for (uint256 i = 0; i < msg.data.length / 32; i++) {
                bytes32 hashId;
                assembly { hashId := calldataload(mul(i, 32)) }

                require(hashId != bytes32(0), "Invalid hashId");
                require(!inPool[hashId], "Already in pool");

                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                    msg.sender
                ][hashId] = 1;

                _poolIndex[hashId] = _pool.length;
                _pool.push(hashId);
                inPool[hashId] = true;
                depositor[hashId] = msg.sender;

                emit PoolDeposited(hashId);
            }
        } else {
            // User deposit for swap — track receipt for each ethscription
            for (uint256 i = 0; i < msg.data.length / 32; i++) {
                bytes32 hashId;
                assembly { hashId := calldataload(mul(i, 32)) }
                require(hashId != bytes32(0), "Invalid hashId");

                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                    msg.sender
                ][hashId] = block.number;
            }
        }
    }

    // ─── Commit/Reveal (DISABLED — swap only now) ──────────────

    function commit(uint256) external payable {
        revert("Disabled");
    }

    function reveal() external {
        revert("Disabled");
    }

    function cancelCommitment() external nonReentrant {
        Commitment memory c = commitments[msg.sender];
        require(c.commitBlock > 0, "No commitment");
        require(block.number > c.commitBlock + REVEAL_EXPIRY, "Not expired");

        delete commitments[msg.sender];
        pendingReveals--;
        totalCommittedETH -= c.priceLocked;

        (bool sent, ) = payable(msg.sender).call{value: c.priceLocked}("");
        if (!sent) { pendingReturns[msg.sender] += c.priceLocked; }

        emit CommitmentCancelled(msg.sender);
    }

    // ─── Free Claim (for diamond hands) ────────────────────────

    event RockFreeClaimed(bytes32 indexed hashId, address indexed claimer, uint256 claimNumber);

    function freeClaim() external {
        revert("Disabled");
    }

    // ─── Swap: ERC-721 for Rock ────────────────────────────────

    event RockSwapped(bytes32 indexed hashId, address indexed swapper, address nftContract, uint256[] tokenIds, uint256 swapNumber);
    event RockSwappedEthscription(bytes32 indexed rockHashId, address indexed swapper, bytes32 ethscriptionHashId, uint256 swapNumber);

    /// @notice Swap CryptoPhunksV2 for 1 random EthsRock (amount configurable)
    function swapCryptoPhunksV2(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        require(swapEnabled, "Swaps disabled");
        require(cryptoPhunksV2Address != address(0), "CryptoPhunksV2 not set");
        uint256 required = cryptoPhunksV2Required > 0 ? cryptoPhunksV2Required : 1;
        require(tokenIds.length == required, "Wrong amount");
        require(_pool.length > pendingReveals, "Sold out");

        for (uint256 i = 0; i < required; i++) {
            IERC721(cryptoPhunksV2Address).transferFrom(msg.sender, treasuryAddress, tokenIds[i]);
        }

        _giveRandomRock(msg.sender, cryptoPhunksV2Address, tokenIds);
    }

    /// @notice Swap PhilipInternProject for 1 random EthsRock (amount configurable)
    function swapPhilipIntern(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        require(swapEnabled, "Swaps disabled");
        require(philipInternAddress != address(0), "PhilipIntern not set");
        uint256 required = philipInternRequired > 0 ? philipInternRequired : 3;
        require(tokenIds.length == required, "Wrong amount");
        require(_pool.length > pendingReveals, "Sold out");

        for (uint256 i = 0; i < required; i++) {
            IERC721(philipInternAddress).transferFrom(msg.sender, treasuryAddress, tokenIds[i]);
        }

        _giveRandomRock(msg.sender, philipInternAddress, tokenIds);
    }

    /// @notice Swap 1 OG ethscription for 1 random EthsRock (user sends ethscription via fallback first)
    function swapEthscription(bytes32 ethscriptionHashId) external nonReentrant whenNotPaused {
        require(swapEnabled, "Swaps disabled");
        require(_pool.length > pendingReveals, "Sold out");
        require(eligibleEthscription[ethscriptionHashId], "Not eligible");

        // Verify the ethscription was deposited by this sender
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][ethscriptionHashId] > 0,
            "Ethscription not deposited"
        );

        // Mark as used so it can't be swapped again
        eligibleEthscription[ethscriptionHashId] = false;

        // Transfer the deposited ethscription to treasury
        _transferEthscription(msg.sender, treasuryAddress, ethscriptionHashId);

        // Give random rock
        _giveRandomRockEthscription(msg.sender, ethscriptionHashId);
    }

    /// @notice Cancel a pending ethscription swap deposit and get it back
    function cancelSwapDeposit(bytes32 ethscriptionHashId) external nonReentrant {
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][ethscriptionHashId] > 0,
            "No deposit found"
        );

        // Return ethscription to sender
        _transferEthscription(msg.sender, msg.sender, ethscriptionHashId);
    }

    /// @notice Swap multiple ethscriptions for 1 random EthsRock (e.g. 5 EtherPhunks)
    /// @param hashIds The ethscription hashIds to swap
    /// @param proofs Merkle proofs for each hashId (one proof per hashId)
    function swapEthscriptionBatch(
        bytes32[] calldata hashIds,
        bytes32[][] calldata proofs
    ) external nonReentrant whenNotPaused {
        require(swapEnabled, "Swaps disabled");
        require(_pool.length > pendingReveals, "Sold out");
        require(batchSwapMerkleRoot != bytes32(0), "Merkle root not set");
        uint256 required = ethscriptionBatchRequired > 0 ? ethscriptionBatchRequired : 5;
        require(hashIds.length == required, "Wrong amount");
        require(proofs.length == required, "Wrong proof count");

        for (uint256 i = 0; i < required; i++) {
            require(!usedBatchEthscription[hashIds[i]], "Already used");
            require(_verifyMerkle(proofs[i], batchSwapMerkleRoot, hashIds[i]), "Invalid proof");
            require(
                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][hashIds[i]] > 0,
                "Ethscription not deposited"
            );

            usedBatchEthscription[hashIds[i]] = true;
            _transferEthscription(msg.sender, treasuryAddress, hashIds[i]);
        }

        _giveRandomRockEthscription(msg.sender, hashIds[0]);
    }

    function _verifyMerkle(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 hash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            if (hash < proof[i]) {
                hash = keccak256(abi.encodePacked(hash, proof[i]));
            } else {
                hash = keccak256(abi.encodePacked(proof[i], hash));
            }
        }
        return hash == root;
    }

    function _giveRandomRockEthscription(address recipient, bytes32 ethscriptionHashId) private {
        totalSwapped++;

        bytes32 randomHash = keccak256(abi.encodePacked(
            _lastRandomHash, block.prevrandao, block.timestamp, recipient, totalSwapped
        ));
        _lastRandomHash = randomHash;

        uint256 idx = uint256(randomHash) % _pool.length;
        bytes32 hashId = _pool[idx];

        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        delete _poolIndex[hashId];
        inPool[hashId] = false;

        _transferEthscription(depositor[hashId], recipient, hashId);
        delete depositor[hashId];

        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(recipient, 67) {} catch {}
        }

        emit RockSwappedEthscription(hashId, recipient, ethscriptionHashId, totalSwapped);
    }

    function _giveRandomRock(address recipient, address nftContract, uint256[] calldata tokenIds) private {
        totalSwapped++;

        bytes32 randomHash = keccak256(abi.encodePacked(
            _lastRandomHash,
            block.prevrandao,
            block.timestamp,
            recipient,
            totalSwapped
        ));
        _lastRandomHash = randomHash;

        uint256 idx = uint256(randomHash) % _pool.length;
        bytes32 hashId = _pool[idx];

        // Swap-and-pop
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        delete _poolIndex[hashId];
        inPool[hashId] = false;

        // Transfer rock to recipient
        _transferEthscription(depositor[hashId], recipient, hashId);
        delete depositor[hashId];

        // Award 67 points
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(recipient, 67) {} catch {}
        }

        emit RockSwapped(hashId, recipient, nftContract, tokenIds, totalSwapped);
    }

    // ─── View functions ────────────────────────────────────────

    function currentPrice() public view returns (uint256) {
        return BASE_PRICE * (totalRevealed + pendingReveals + 1);
    }

    function poolSize() external view returns (uint256) {
        return _pool.length;
    }

    function getPoolItems(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        uint256 end = offset + limit;
        if (end > _pool.length) end = _pool.length;
        if (offset >= _pool.length) return new bytes32[](0);

        bytes32[] memory items = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            items[i - offset] = _pool[i];
        }
        return items;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Withdraw pending returns ──────────────────────────────

    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
    }

    // ─── Owner functions ───────────────────────────────────────

    function setTreasuryAddress(address payable _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        treasuryAddress = _treasuryAddress;
    }

    function setPointsAddress(address _pointsAddress) external onlyOwner {
        pointsAddress = _pointsAddress;
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance - totalCommittedETH, "Exceeds available balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    function withdrawFromPool(bytes32 hashId) external onlyOwner nonReentrant {
        require(inPool[hashId], "Not in pool");
        require(_pool.length > pendingReveals, "Would strand pending reveals");

        uint256 idx = _poolIndex[hashId];
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();

        inPool[hashId] = false;
        delete _poolIndex[hashId];
        delete depositor[hashId];

        _transferEthscription(owner(), owner(), hashId);

        emit PoolWithdrawn(hashId);
    }

    function withdrawFromPoolBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        require(_pool.length >= hashIds.length + pendingReveals, "Would strand pending reveals");
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            require(inPool[hashId], "Not in pool");

            uint256 idx = _poolIndex[hashId];
            bytes32 lastHash = _pool[_pool.length - 1];
            _pool[idx] = lastHash;
            _poolIndex[lastHash] = idx;
            _pool.pop();

            inPool[hashId] = false;
            delete _poolIndex[hashId];
            delete depositor[hashId];

            _transferEthscription(owner(), owner(), hashId);

            emit PoolWithdrawn(hashId);
        }
    }

    function emergencyWithdrawEthscription(bytes32 hashId) external onlyOwner nonReentrant {
        if (inPool[hashId]) {
            require(_pool.length > pendingReveals, "Would strand pending reveals");
            uint256 idx = _poolIndex[hashId];
            bytes32 lastHash = _pool[_pool.length - 1];
            _pool[idx] = lastHash;
            _poolIndex[lastHash] = idx;
            _pool.pop();
            inPool[hashId] = false;
            delete _poolIndex[hashId];
            delete depositor[hashId];
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            owner()
        ][hashId] = 1;
        _transferEthscription(owner(), owner(), hashId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function resetTotalRevealed(uint256 _totalRevealed) external onlyOwner {
        totalRevealed = _totalRevealed;
    }

    function redirectPendingReturns(address from, address payable to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 amount = pendingReturns[from];
        require(amount > 0, "Nothing to redirect");
        pendingReturns[from] = 0;
        pendingReturns[to] += amount;
    }

function setBlocked(address wallet, bool isBlocked) external onlyOwner {
        require(wallet != address(0), "Invalid address");
        blocked[wallet] = isBlocked;
    }

    function setBlockedBatch(address[] calldata wallets, bool isBlocked) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "Invalid address");
            blocked[wallets[i]] = isBlocked;
        }
    }

    function setAllowed(address wallet, bool isAllowed) external onlyOwner {
        require(wallet != address(0), "Invalid address");
        allowed[wallet] = isAllowed;
    }

    function setAllowedBatch(address[] calldata wallets, bool isAllowed) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "Invalid address");
            allowed[wallets[i]] = isAllowed;
        }
    }

    function setAllowlistEnabled(bool _enabled) external onlyOwner {
        allowlistEnabled = _enabled;
    }

    function setFreeClaims(address wallet, uint256 amount) external onlyOwner {
        require(wallet != address(0), "Invalid address");
        freeClaims[wallet] = amount;
    }

    function setFreeClaimsBatch(address[] calldata wallets, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "Invalid address");
            freeClaims[wallets[i]] = amount;
        }
    }

    function addFreeClaimsBatch(address[] calldata wallets, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "Invalid address");
            freeClaims[wallets[i]] += amount;
        }
    }

    function setSwapEnabled(bool _enabled) external onlyOwner {
        swapEnabled = _enabled;
    }

    function setPhilipInternAddress(address _addr) external onlyOwner {
        philipInternAddress = _addr;
    }

    function setCryptoPhunksV2Address(address _addr) external onlyOwner {
        cryptoPhunksV2Address = _addr;
    }

    function setCryptoPhunksV2Required(uint256 _amount) external onlyOwner {
        cryptoPhunksV2Required = _amount;
    }

    function setPhilipInternRequired(uint256 _amount) external onlyOwner {
        philipInternRequired = _amount;
    }

    function setEligibleEthscriptionsBatch(bytes32[] calldata hashIds, bool eligible) external onlyOwner {
        for (uint256 i = 0; i < hashIds.length; i++) {
            eligibleEthscription[hashIds[i]] = eligible;
        }
    }

    function setBatchSwapMerkleRoot(bytes32 _root) external onlyOwner {
        batchSwapMerkleRoot = _root;
    }

    function setEthscriptionBatchRequired(uint256 _amount) external onlyOwner {
        ethscriptionBatchRequired = _amount;
    }

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    // ─── Storage gap (48 − 16 new slots = 32) ─────────────────

    uint256[32] private __gap;
}
