// SPDX-License-Identifier: PHUNKY

/*********** Phunkquidity ******************
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
****************************************/

/* ========================================
   ∬  Phunkquidity                        ∬
   ========================================
   ∬  Multi-collection swap pool          ∬
   ∬  Supports ERC-721 + Ethscriptions    ∬
   ∬  Owner-set point values per coll     ∬
   ∬  User picks which item to receive    ∬
   ∬  Upgradeable proxy                   ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract Phunkquidity is
    Initializable,
    EthscriptionsEscrower,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ─── Collection types ────────────────────────────────────
    enum CollectionType { ERC721, Ethscription }

    struct Collection {
        CollectionType collType;
        address contractAddress;       // ERC-721 contract address (zero for ethscriptions)
        bytes32 merkleRoot;            // For ethscription validation
        uint256 pointValue;            // Points per item from this collection
        bool enabled;
        bool exists;                   // True once added (prevents re-adding)
    }

    uint256 public constant MAX_ITEMS_PER_SWAP = 50;

    // ─── State ───────────────────────────────────────────────

    // Collection registry — slug => config
    mapping(bytes32 => Collection) public collections;
    bytes32[] public collectionSlugs;

    // ERC-721 pools: slug => array of tokenIds held by contract
    mapping(bytes32 => uint256[]) private _erc721Pool;
    mapping(bytes32 => mapping(uint256 => uint256)) private _erc721PoolIndex; // slug => tokenId => index+1
    mapping(bytes32 => mapping(uint256 => bool)) public erc721InPool; // slug => tokenId => bool

    // Ethscription pools: slug => array of hashIds held by contract
    mapping(bytes32 => bytes32[]) private _ethscPool;
    mapping(bytes32 => mapping(bytes32 => uint256)) private _ethscPoolIndex; // slug => hashId => index+1
    mapping(bytes32 => mapping(bytes32 => bool)) public ethscInPool;
    mapping(bytes32 => mapping(bytes32 => address)) public ethscDepositor;

    bool public swapEnabled;
    uint256 public swapFee;
    uint256 public totalSwaps;
    address payable public treasuryAddress;

    // ─── Events ──────────────────────────────────────────────
    event CollectionAdded(bytes32 indexed slug, CollectionType collType, address contractAddress, uint256 pointValue);
    event CollectionUpdated(bytes32 indexed slug, uint256 pointValue, bool enabled);
    event ERC721PoolDeposited(bytes32 indexed slug, uint256 tokenId, address indexed depositor);
    event EthscPoolDeposited(bytes32 indexed slug, bytes32 hashId, address indexed depositor);
    event Swapped(address indexed swapper, uint256 inputPoints, uint256 outputPoints, uint256 swapNumber);

    // ─── Constructor & Init ──────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address payable _treasuryAddress) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        treasuryAddress = _treasuryAddress;
        swapEnabled = true;
    }

    // ─── Collection Management (Owner) ───────────────────────

    function addCollection(
        bytes32 slug,
        CollectionType collType,
        address contractAddress,
        bytes32 merkleRoot,
        uint256 pointValue
    ) external onlyOwner {
        require(!collections[slug].exists, "Collection exists");
        require(pointValue > 0, "Point value must be > 0");
        collections[slug] = Collection({
            collType: collType,
            contractAddress: contractAddress,
            merkleRoot: merkleRoot,
            pointValue: pointValue,
            enabled: true,
            exists: true
        });
        collectionSlugs.push(slug);
        emit CollectionAdded(slug, collType, contractAddress, pointValue);
    }

    function updateCollection(bytes32 slug, uint256 pointValue, bool enabled) external onlyOwner {
        require(collections[slug].exists, "Unknown collection");
        require(pointValue > 0, "Point value must be > 0");
        collections[slug].pointValue = pointValue;
        collections[slug].enabled = enabled;
        emit CollectionUpdated(slug, pointValue, enabled);
    }

    function setMerkleRoot(bytes32 slug, bytes32 root) external onlyOwner {
        collections[slug].merkleRoot = root;
    }

    // ─── Owner Pool Deposits ─────────────────────────────────

    function depositERC721(bytes32 slug, uint256[] calldata tokenIds) external onlyOwner {
        Collection memory c = collections[slug];
        require(c.collType == CollectionType.ERC721, "Wrong type");
        require(c.contractAddress != address(0), "No contract");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            IERC721(c.contractAddress).transferFrom(msg.sender, address(this), tokenId);
            _erc721Pool[slug].push(tokenId);
            _erc721PoolIndex[slug][tokenId] = _erc721Pool[slug].length;
            erc721InPool[slug][tokenId] = true;
            emit ERC721PoolDeposited(slug, tokenId, msg.sender);
        }
    }

    // Owner deposits ethscriptions via fallback (calldata transfer)
    fallback() external {
        require(msg.sender == owner(), "Only owner can deposit");
        require(msg.data.length > 0 && msg.data.length % 64 == 0, "Invalid length");

        // Format: [slug(32)][hashId(32)] per item
        for (uint256 i = 0; i < msg.data.length / 64; i++) {
            bytes32 slug;
            bytes32 hashId;
            assembly {
                slug := calldataload(mul(i, 64))
                hashId := calldataload(add(mul(i, 64), 32))
            }
            require(collections[slug].collType == CollectionType.Ethscription, "Not ethsc collection");

            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                msg.sender
            ][hashId] = 1;

            _ethscPool[slug].push(hashId);
            _ethscPoolIndex[slug][hashId] = _ethscPool[slug].length;
            ethscInPool[slug][hashId] = true;
            ethscDepositor[slug][hashId] = msg.sender;

            emit EthscPoolDeposited(slug, hashId, msg.sender);
        }
    }

    // ─── User Swap (single function for any → any) ───────────

    struct InputItem {
        bytes32 slug;
        uint256 tokenId;          // For ERC-721 (0 if ethscription)
        bytes32 hashId;           // For ethscription (zero if ERC-721)
        bytes32[] proof;          // Merkle proof for ethscription validation
    }

    struct OutputItem {
        bytes32 slug;
        uint256 tokenId;          // For ERC-721 (0 if ethscription)
        bytes32 hashId;           // For ethscription (zero if ERC-721)
    }

    function swap(InputItem[] calldata inputs, OutputItem[] calldata outputs)
        external payable nonReentrant whenNotPaused
    {
        require(swapEnabled, "Swaps disabled");
        require(msg.value >= swapFee, "Insufficient fee");
        require(inputs.length > 0 && outputs.length > 0, "Empty swap");
        require(inputs.length <= MAX_ITEMS_PER_SWAP && outputs.length <= MAX_ITEMS_PER_SWAP, "Too many items");

        // 1. Calculate total input points + validate inputs
        uint256 inputPoints = 0;
        for (uint256 i = 0; i < inputs.length; i++) {
            Collection memory c = collections[inputs[i].slug];
            require(c.enabled, "Input disabled");
            inputPoints += c.pointValue;
        }

        // 2. Calculate total output points + validate outputs in pool
        uint256 outputPoints = 0;
        for (uint256 i = 0; i < outputs.length; i++) {
            Collection memory c = collections[outputs[i].slug];
            require(c.enabled, "Output disabled");
            outputPoints += c.pointValue;

            if (c.collType == CollectionType.ERC721) {
                require(erc721InPool[outputs[i].slug][outputs[i].tokenId], "Output not in pool");
            } else {
                require(ethscInPool[outputs[i].slug][outputs[i].hashId], "Output not in pool");
            }
        }

        require(inputPoints >= outputPoints, "Insufficient input value");

        // 3. Take inputs from user
        for (uint256 i = 0; i < inputs.length; i++) {
            Collection memory c = collections[inputs[i].slug];
            if (c.collType == CollectionType.ERC721) {
                IERC721(c.contractAddress).transferFrom(msg.sender, address(this), inputs[i].tokenId);
                _erc721Pool[inputs[i].slug].push(inputs[i].tokenId);
                _erc721PoolIndex[inputs[i].slug][inputs[i].tokenId] = _erc721Pool[inputs[i].slug].length;
                erc721InPool[inputs[i].slug][inputs[i].tokenId] = true;
            } else {
                require(c.merkleRoot != bytes32(0), "Merkle root not set");
                require(_verifyMerkle(inputs[i].proof, c.merkleRoot, inputs[i].hashId), "Invalid proof");
                require(
                    EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][inputs[i].hashId] > 0,
                    "Ethscription not deposited"
                );
                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                    owner()
                ][inputs[i].hashId] = 1;
                delete EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                    msg.sender
                ][inputs[i].hashId];
                _ethscPool[inputs[i].slug].push(inputs[i].hashId);
                _ethscPoolIndex[inputs[i].slug][inputs[i].hashId] = _ethscPool[inputs[i].slug].length;
                ethscInPool[inputs[i].slug][inputs[i].hashId] = true;
                ethscDepositor[inputs[i].slug][inputs[i].hashId] = owner();
            }
        }

        // 4. Send outputs to user
        for (uint256 i = 0; i < outputs.length; i++) {
            Collection memory c = collections[outputs[i].slug];
            if (c.collType == CollectionType.ERC721) {
                _removeERC721FromPool(outputs[i].slug, outputs[i].tokenId);
                IERC721(c.contractAddress).transferFrom(address(this), msg.sender, outputs[i].tokenId);
            } else {
                address dep = ethscDepositor[outputs[i].slug][outputs[i].hashId];
                _removeEthscFromPool(outputs[i].slug, outputs[i].hashId);
                _transferEthscription(dep, msg.sender, outputs[i].hashId);
            }
        }

        // 5. Send fee to treasury
        if (msg.value > 0 && treasuryAddress != address(0)) {
            (bool sent, ) = treasuryAddress.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        totalSwaps++;
        emit Swapped(msg.sender, inputPoints, outputPoints, totalSwaps);
    }

    // ─── Cancel ethscription deposit (recover stuck items) ──

    function cancelEthscDeposit(bytes32 hashId) external nonReentrant {
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][hashId] > 0,
            "Not deposited"
        );
        // Make sure not in any pool
        for (uint256 i = 0; i < collectionSlugs.length; i++) {
            require(!ethscInPool[collectionSlugs[i]][hashId], "In pool");
        }
        _transferEthscription(msg.sender, msg.sender, hashId);
    }

    // ─── View Functions ──────────────────────────────────────

    function erc721PoolSize(bytes32 slug) external view returns (uint256) {
        return _erc721Pool[slug].length;
    }

    function ethscPoolSize(bytes32 slug) external view returns (uint256) {
        return _ethscPool[slug].length;
    }

    function getERC721PoolItems(bytes32 slug, uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256[] storage pool = _erc721Pool[slug];
        uint256 end = offset + limit;
        if (end > pool.length) end = pool.length;
        if (offset >= pool.length) return new uint256[](0);
        uint256[] memory items = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) items[i - offset] = pool[i];
        return items;
    }

    function getEthscPoolItems(bytes32 slug, uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        bytes32[] storage pool = _ethscPool[slug];
        uint256 end = offset + limit;
        if (end > pool.length) end = pool.length;
        if (offset >= pool.length) return new bytes32[](0);
        bytes32[] memory items = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) items[i - offset] = pool[i];
        return items;
    }

    function getCollectionSlugs() external view returns (bytes32[] memory) {
        return collectionSlugs;
    }

    // ─── Owner Withdrawals ───────────────────────────────────

    function withdrawERC721Batch(bytes32 slug, uint256[] calldata tokenIds) external onlyOwner nonReentrant {
        Collection memory c = collections[slug];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(erc721InPool[slug][tokenIds[i]], "Not in pool");
            _removeERC721FromPool(slug, tokenIds[i]);
            IERC721(c.contractAddress).transferFrom(address(this), owner(), tokenIds[i]);
        }
    }

    function withdrawEthscBatch(bytes32 slug, bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            require(ethscInPool[slug][hashIds[i]], "Not in pool");
            address dep = ethscDepositor[slug][hashIds[i]];
            _removeEthscFromPool(slug, hashIds[i]);
            _transferEthscription(dep, owner(), hashIds[i]);
        }
    }

    // ─── Owner Settings ──────────────────────────────────────

    function setSwapEnabled(bool _enabled) external onlyOwner { swapEnabled = _enabled; }
    function setSwapFee(uint256 _fee) external onlyOwner { swapFee = _fee; }
    function setTreasuryAddress(address payable _addr) external onlyOwner {
        require(_addr != address(0), "Invalid");
        treasuryAddress = _addr;
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    // ─── Internal ────────────────────────────────────────────

    function _removeERC721FromPool(bytes32 slug, uint256 tokenId) internal {
        uint256 idx = _erc721PoolIndex[slug][tokenId];
        require(idx > 0, "Not in pool");
        idx--;
        uint256[] storage pool = _erc721Pool[slug];
        uint256 lastTokenId = pool[pool.length - 1];
        pool[idx] = lastTokenId;
        _erc721PoolIndex[slug][lastTokenId] = idx + 1;
        pool.pop();
        delete _erc721PoolIndex[slug][tokenId];
        erc721InPool[slug][tokenId] = false;
    }

    function _removeEthscFromPool(bytes32 slug, bytes32 hashId) internal {
        uint256 idx = _ethscPoolIndex[slug][hashId];
        require(idx > 0, "Not in pool");
        idx--;
        bytes32[] storage pool = _ethscPool[slug];
        bytes32 lastHash = pool[pool.length - 1];
        pool[idx] = lastHash;
        _ethscPoolIndex[slug][lastHash] = idx + 1;
        pool.pop();
        delete _ethscPoolIndex[slug][hashId];
        ethscInPool[slug][hashId] = false;
        delete ethscDepositor[slug][hashId];
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

    // =========================================================
    // PHASE 2: Trade Offers
    // =========================================================

    struct OfferItem {
        bytes32 slug;
        uint256 tokenId;       // For ERC-721
        bytes32 hashId;        // For ethscription
    }

    struct TradeOffer {
        address creator;
        address targetUser;    // address(0) = open to anyone, otherwise direct offer
        OfferItem[] offering;  // What creator deposited
        OfferItem[] wanting;   // What creator wants in return
        bool active;
    }

    uint256 public nextOfferId;
    mapping(uint256 => TradeOffer) public offers;

    event OfferCreated(uint256 indexed offerId, address indexed creator, address indexed targetUser);
    event OfferCancelled(uint256 indexed offerId);
    event OfferFulfilled(uint256 indexed offerId, address indexed filler);

    function _processOfferingItems(
        TradeOffer storage offer,
        OfferItem[] calldata offering,
        bytes32[][] calldata ethscProofs
    ) internal {
        uint256 ethscIdx = 0;
        for (uint256 i = 0; i < offering.length; i++) {
            if (collections[offering[i].slug].collType == CollectionType.Ethscription) {
                _depositOfferItem(offering[i], ethscProofs[ethscIdx]);
                ethscIdx++;
            } else {
                _depositOfferItem(offering[i], ethscProofs.length > 0 ? ethscProofs[0] : ethscProofs[0]);
            }
            offer.offering.push(offering[i]);
        }
    }

    function _depositOfferItem(OfferItem calldata item, bytes32[] calldata proof) internal {
        Collection memory c = collections[item.slug];
        require(c.exists && c.enabled, "Collection disabled");

        if (c.collType == CollectionType.ERC721) {
            IERC721(c.contractAddress).transferFrom(msg.sender, address(this), item.tokenId);
        } else {
            require(c.merkleRoot != bytes32(0), "Merkle root not set");
            require(_verifyMerkle(proof, c.merkleRoot, item.hashId), "Invalid proof");
            require(
                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][item.hashId] > 0,
                "Ethscription not deposited"
            );
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[address(this)][item.hashId] = 1;
            delete EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][item.hashId];
        }
    }

    /// Create a trade offer. Creator must own and have approved/deposited the offered items.
    function createOffer(
        OfferItem[] calldata offering,
        OfferItem[] calldata wanting,
        address targetUser,
        bytes32[][] calldata ethscProofs
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(swapEnabled, "Swaps disabled");
        require(msg.value >= swapFee, "Insufficient fee");
        require(offering.length > 0 && wanting.length > 0, "Empty offer");
        require(offering.length <= MAX_ITEMS_PER_SWAP && wanting.length <= MAX_ITEMS_PER_SWAP, "Too many items");

        uint256 offerId = nextOfferId++;
        TradeOffer storage offer = offers[offerId];
        offer.creator = msg.sender;
        offer.targetUser = targetUser;
        offer.active = true;

        _processOfferingItems(offer, offering, ethscProofs);

        for (uint256 i = 0; i < wanting.length; i++) {
            require(collections[wanting[i].slug].exists, "Unknown wanted collection");
            offer.wanting.push(wanting[i]);
        }

        if (msg.value > 0 && treasuryAddress != address(0)) {
            (bool sent, ) = treasuryAddress.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        emit OfferCreated(offerId, msg.sender, targetUser);
        return offerId;
    }

    function _processFulfillment(TradeOffer storage offer, bytes32[][] calldata ethscProofs) internal {
        address creator = offer.creator;
        uint256 ethscIdx = 0;

        for (uint256 i = 0; i < offer.wanting.length; i++) {
            if (collections[offer.wanting[i].slug].collType == CollectionType.Ethscription) {
                _transferWantedItem(offer.wanting[i], creator, ethscProofs[ethscIdx]);
                ethscIdx++;
            } else {
                _transferWantedItem(offer.wanting[i], creator, ethscProofs.length > 0 ? ethscProofs[0] : ethscProofs[0]);
            }
        }

        for (uint256 i = 0; i < offer.offering.length; i++) {
            _sendOfferedItem(offer.offering[i], msg.sender);
        }
    }

    function _transferWantedItem(OfferItem memory item, address creator, bytes32[] calldata proof) internal {
        Collection memory c = collections[item.slug];
        require(c.enabled, "Collection disabled");

        if (c.collType == CollectionType.ERC721) {
            IERC721(c.contractAddress).transferFrom(msg.sender, creator, item.tokenId);
        } else {
            require(c.merkleRoot != bytes32(0), "Merkle root not set");
            require(_verifyMerkle(proof, c.merkleRoot, item.hashId), "Invalid proof");
            require(
                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][item.hashId] > 0,
                "Ethscription not deposited"
            );
            _transferEthscription(msg.sender, creator, item.hashId);
        }
    }

    function _sendOfferedItem(OfferItem memory item, address to) internal {
        Collection memory c = collections[item.slug];
        if (c.collType == CollectionType.ERC721) {
            IERC721(c.contractAddress).transferFrom(address(this), to, item.tokenId);
        } else {
            _transferEthscription(address(this), to, item.hashId);
        }
    }

    /// Fulfill a trade offer by providing the wanted items
    function fulfillOffer(uint256 offerId, bytes32[][] calldata ethscProofs)
        external payable nonReentrant whenNotPaused
    {
        TradeOffer storage offer = offers[offerId];
        require(offer.active, "Offer inactive");
        require(swapEnabled, "Swaps disabled");
        require(msg.value >= swapFee, "Insufficient fee");
        if (offer.targetUser != address(0)) {
            require(msg.sender == offer.targetUser, "Not target user");
        }

        offer.active = false;
        _processFulfillment(offer, ethscProofs);

        if (msg.value > 0 && treasuryAddress != address(0)) {
            (bool sent, ) = treasuryAddress.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        emit OfferFulfilled(offerId, msg.sender);
    }

    /// Cancel an open offer and recover offered items (creator only)
    function cancelOffer(uint256 offerId) external nonReentrant {
        TradeOffer storage offer = offers[offerId];
        require(offer.active, "Offer inactive");
        require(msg.sender == offer.creator, "Not creator");

        offer.active = false;

        for (uint256 i = 0; i < offer.offering.length; i++) {
            Collection memory c = collections[offer.offering[i].slug];
            if (c.collType == CollectionType.ERC721) {
                IERC721(c.contractAddress).transferFrom(address(this), offer.creator, offer.offering[i].tokenId);
            } else {
                _transferEthscription(address(this), offer.creator, offer.offering[i].hashId);
            }
        }

        emit OfferCancelled(offerId);
    }

    function getOffer(uint256 offerId) external view returns (
        address creator,
        address targetUser,
        OfferItem[] memory offering,
        OfferItem[] memory wanting,
        bool active
    ) {
        TradeOffer storage o = offers[offerId];
        return (o.creator, o.targetUser, o.offering, o.wanting, o.active);
    }

    // ─── Storage gap ─────────────────────────────────────────
    uint256[38] private __gap;
}
