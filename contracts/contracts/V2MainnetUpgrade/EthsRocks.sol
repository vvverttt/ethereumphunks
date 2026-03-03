// SPDX-License-Identifier: PHUNKY

/****** EthsRocks **********************
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
   ∬  EthsRocks Sale Contract             ∬
   ========================================
   ∬  Commit-reveal purchase (MEV-safe)    ∬
   ∬  Escalating price per sale            ∬
   ∬  Signer + ERC-721 token-gating         ∬
   ∬  Per-token usage tracking             ∬
   ∬  67 points on purchase                ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";
import "./interfaces/IPoints.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract EthsRocks is Initializable, EthscriptionsEscrower, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    // ─── Constants ─────────────────────────────────────────────
    uint256 public constant BASE_PRICE = 0.00245 ether;
    // No per-wallet cap — limited by per-token usage (fresh set required each time)
    uint256 public constant REVEAL_DELAY = 2;
    uint256 public constant REVEAL_EXPIRY = 256;

    // ─── Commitment struct ─────────────────────────────────────
    struct Commitment {
        uint256 commitBlock;
        uint256 priceLocked;
        bytes32 missingPhunkHash;
        bytes32 quantumDystoHash;
        bytes32 quantumPhunkHash;
        address nftContract;
        uint256 philipOrWrappedId;
        uint256 cryptoPhunksV2Id;
    }

    // ─── State ─────────────────────────────────────────────────

    // Treasury + Points
    address payable public treasuryAddress;
    address public pointsAddress;
    bytes32 public merkleRoot;

    // ERC-721 token-gate addresses
    address public philipInternAddress;
    address public wrappedV1Address;
    address public cryptoPhunksV2Address;

    // Pool (swap-and-pop)
    bytes32[] private _pool;
    mapping(bytes32 => uint256) private _poolIndex;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;

    // Per-token usage tracking (one use per ethscription hash / ERC-721 tokenId)
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

    // V2: Signer-based verification (replaces merkle proof)
    address public signerAddress;

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

    // ─── Fallback: Owner deposits ethscriptions into pool ──────

    fallback() external {
        require(msg.sender == owner(), "Only owner can deposit");
        require(msg.data.length > 0 && msg.data.length % 32 == 0, "Invalid length");

        for (uint256 i = 0; i < msg.data.length / 32; i++) {
            bytes32 hashId;
            assembly {
                hashId := calldataload(mul(i, 32))
            }

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
    }

    // ─── Step 1: Commit ────────────────────────────────────────

    function commit(
        bytes calldata signature,
        uint256 deadline,
        uint256 maxPrice,
        bytes32 missingPhunkHash,
        bytes32 quantumDystoHash,
        bytes32 quantumPhunkHash,
        uint256 philipOrWrappedTokenId,
        bool usePhilipIntern,
        uint256 cryptoPhunksV2TokenId
    ) external payable nonReentrant whenNotPaused {
        require(msg.sender == tx.origin, "No contracts");
        require(commitments[msg.sender].commitBlock == 0, "Already committed");
        require(_pool.length > pendingReveals, "Sold out");

        // Signer verification: backend checks ethscription ownership and signs
        require(signerAddress != address(0), "Signer not set");
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 dataHash = keccak256(abi.encodePacked(
            msg.sender, missingPhunkHash, quantumDystoHash, quantumPhunkHash,
            philipOrWrappedTokenId, usePhilipIntern, cryptoPhunksV2TokenId,
            deadline, block.chainid, address(this)
        ));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(dataHash);
        require(ECDSA.recover(ethSignedHash, signature) == signerAddress, "Not eligible");

        // No duplicate hashes across categories
        require(
            missingPhunkHash != quantumDystoHash &&
            missingPhunkHash != quantumPhunkHash &&
            quantumDystoHash != quantumPhunkHash,
            "Duplicate hashes"
        );

        // Per-token: mark ethscription hashIds as used
        require(!usedEthscription[missingPhunkHash], "MissingPhunk already used");
        require(!usedEthscription[quantumDystoHash], "QuantumDysto already used");
        require(!usedEthscription[quantumPhunkHash], "QuantumPhunk already used");
        usedEthscription[missingPhunkHash] = true;
        usedEthscription[quantumDystoHash] = true;
        usedEthscription[quantumPhunkHash] = true;

        // ERC-721: verify ownership + mark used
        address nftContract = usePhilipIntern ? philipInternAddress : wrappedV1Address;
        require(_ownsAndMarkUsed(nftContract, philipOrWrappedTokenId, msg.sender), "Not owner or already used");
        require(_ownsAndMarkUsed(cryptoPhunksV2Address, cryptoPhunksV2TokenId, msg.sender), "Not CryptoPhunksV2 owner or already used");

        // Price check
        uint256 price = currentPrice();
        require(msg.value >= price, "Insufficient payment");
        require(price <= maxPrice, "Price exceeded max");

        // Effects
        pendingReveals++;
        commitments[msg.sender] = Commitment({
            commitBlock: block.number,
            priceLocked: price,
            missingPhunkHash: missingPhunkHash,
            quantumDystoHash: quantumDystoHash,
            quantumPhunkHash: quantumPhunkHash,
            nftContract: nftContract,
            philipOrWrappedId: philipOrWrappedTokenId,
            cryptoPhunksV2Id: cryptoPhunksV2TokenId
        });

        // Refund overpayment immediately
        if (msg.value > price) {
            (bool refundSent, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSent) { pendingReturns[msg.sender] += msg.value - price; }
        }

        emit RockCommitted(msg.sender, price, block.number);
    }

    // ─── Step 2: Reveal ────────────────────────────────────────

    function reveal() external nonReentrant whenNotPaused {
        Commitment memory c = commitments[msg.sender];
        require(c.commitBlock > 0, "No commitment");
        require(block.number > c.commitBlock + REVEAL_DELAY, "Too early");
        require(block.number <= c.commitBlock + REVEAL_EXPIRY, "Expired");

        delete commitments[msg.sender];
        pendingReveals--;
        totalRevealed++;

        // Random seed uses future blockhash unknown at commit time
        bytes32 futureBlockhash = blockhash(c.commitBlock + REVEAL_DELAY);
        require(futureBlockhash != bytes32(0), "Blockhash unavailable");

        bytes32 randomHash = keccak256(abi.encodePacked(
            _lastRandomHash,
            futureBlockhash,
            msg.sender,
            totalRevealed
        ));
        _lastRandomHash = randomHash;

        uint256 idx = uint256(randomHash) % _pool.length;
        bytes32 hashId = _pool[idx];

        // Swap-and-pop removal
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        delete _poolIndex[hashId];
        inPool[hashId] = false;

        // Transfer ethscription to buyer
        _transferEthscription(depositor[hashId], msg.sender, hashId);
        delete depositor[hashId];

        // Send funds to treasury (hybrid push/pull)
        (bool sent, ) = treasuryAddress.call{value: c.priceLocked}("");
        if (!sent) { pendingReturns[treasuryAddress] += c.priceLocked; }

        // Award 67 points
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(msg.sender, 67) {} catch {}
        }

        emit RockPurchased(hashId, msg.sender, c.priceLocked, totalRevealed);
    }

    // ─── Cancel expired commitment ─────────────────────────────

    function cancelCommitment() external nonReentrant {
        Commitment memory c = commitments[msg.sender];
        require(c.commitBlock > 0, "No commitment");
        require(block.number > c.commitBlock + REVEAL_EXPIRY, "Not expired");

        delete commitments[msg.sender];
        pendingReveals--;

        // Release used tokens
        usedEthscription[c.missingPhunkHash] = false;
        usedEthscription[c.quantumDystoHash] = false;
        usedEthscription[c.quantumPhunkHash] = false;
        usedERC721[c.nftContract][c.philipOrWrappedId] = false;
        usedERC721[cryptoPhunksV2Address][c.cryptoPhunksV2Id] = false;

        (bool sent, ) = payable(msg.sender).call{value: c.priceLocked}("");
        if (!sent) { pendingReturns[msg.sender] += c.priceLocked; }

        emit CommitmentCancelled(msg.sender);
    }

    // ─── Internal: verify ERC-721 ownership + mark used ────────

    function _ownsAndMarkUsed(address nftContract, uint256 tokenId, address user) internal returns (bool) {
        require(!usedERC721[nftContract][tokenId], "Token already used");
        try IERC721(nftContract).ownerOf(tokenId) returns (address tokenOwner) {
            if (tokenOwner != user) return false;
            usedERC721[nftContract][tokenId] = true;
            return true;
        } catch {
            return false;
        }
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

    function setSignerAddress(address _signerAddress) external onlyOwner {
        signerAddress = _signerAddress;
    }

    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function setTreasuryAddress(address payable _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        treasuryAddress = _treasuryAddress;
    }

    function setPointsAddress(address _pointsAddress) external onlyOwner {
        pointsAddress = _pointsAddress;
    }

    function setPhilipInternAddress(address _addr) external onlyOwner {
        philipInternAddress = _addr;
    }

    function setWrappedV1Address(address _addr) external onlyOwner {
        wrappedV1Address = _addr;
    }

    function setCryptoPhunksV2Address(address _addr) external onlyOwner {
        cryptoPhunksV2Address = _addr;
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
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
        // Clean pool state if item is in pool
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

    function resetUsedERC721(address nftContract, uint256 tokenId) external onlyOwner {
        usedERC721[nftContract][tokenId] = false;
    }

    function resetUsedEthscription(bytes32 hashId) external onlyOwner {
        usedEthscription[hashId] = false;
    }

    function resetTotalRevealed(uint256 _totalRevealed) external onlyOwner {
        totalRevealed = _totalRevealed;
    }

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    // ─── Storage gap for future upgrades ───────────────────────

    uint256[49] private __gap;
}
