// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
  QuantumPhunksMarketMulti — MULTI-COLLECTION marketplace (PRE-AUDIT DRAFT).
  Created by DystoLabz, Vvverttt x ArkanaRuzain.

  - Trades ANY owner-registered ERC-721 collection (v67 now; a future 10k + smalls later) via approval.
  - No hard-wired NFT: owner registers collections with setCollectionAllowed(addr, true).
  - Every offer/bid keyed by (collection, tokenId). ETH is pull-payment escrow, shared across collections.
  - 5% royalty read from each collection's own ERC-2981. No owner ETH drain.

  INVARIANT (fuzz then human-audit):
    address(this).balance >= Σ pendingWithdrawals
                           + Σ bids[c][id].value
                           + Σ collectionBids[c][b][p]·p
                           + Σ traitBids[c][b][k][p]·p
*/

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IPoints { function addPoints(address user, uint256 amount) external; }

/// @dev Each registered collection must be ERC-721 + ERC-2981; trait bids need hasTrait (optional per collection).
interface ICollection {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
    function hasTrait(uint256 tokenId, string calldata key, string calldata value) external view returns (bool);
}

contract QuantumPhunksMarketMulti is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    error NotTokenOwner();
    error NothingToWithdraw();
    error TransferFailed();
    error MarketIsPaused();
    error NotForSale();
    error OnlySellToMismatch();
    error SellerOwnershipChanged();
    error CannotBuyOwn();
    error WrongValue();
    error BidTooLow();
    error NoBid();
    error NotBidder();
    error CannotBidOwn();
    error ZeroBid();
    error PriceBelowMin();
    error ZeroAddress();
    error TraitMismatch();
    error TraitBidsDisabled();
    error CollectionNotAllowed();
    error BadBatch();
    error NothingBought();

    struct Offer { bool isForSale; address seller; uint256 minValue; address onlySellTo; }
    struct Bid   { bool hasBid;   address bidder; uint256 value; }

    // (collection => tokenId => …)
    mapping(address => mapping(uint256 => Offer)) public offers;
    mapping(address => mapping(uint256 => Bid))   public bids;
    mapping(address => uint256) public pendingWithdrawals;                                   // per-user, all collections
    mapping(address => mapping(address => mapping(uint256 => uint256))) public collectionBids; // coll=>bidder=>price=>qty
    mapping(address => mapping(address => mapping(bytes32 => mapping(uint256 => uint256)))) public traitBids; // coll=>bidder=>key=>price=>qty

    mapping(address => bool) public allowedCollections;   // registry (owner-managed)
    bool public marketPaused;
    bool public traitBidsEnabled;
    address public pointsAddress;
    uint256 public pointsPerBuy;

    event CollectionAllowed(address indexed collection, bool allowed);
    event PhunkOffered(address indexed collection, uint256 indexed tokenId, uint256 minValue, address indexed toAddress);
    event PhunkNoLongerForSale(address indexed collection, uint256 indexed tokenId);
    event PhunkBought(address indexed collection, uint256 indexed tokenId, uint256 value, address seller, address buyer);
    event PhunkBidEntered(address indexed collection, uint256 indexed tokenId, uint256 value, address bidder);
    event PhunkBidWithdrawn(address indexed collection, uint256 indexed tokenId, uint256 value, address bidder);
    event CollectionBidEntered(address indexed collection, address indexed bidder, uint256 pricePerItem, uint256 quantity);
    event CollectionBidWithdrawn(address indexed collection, address indexed bidder, uint256 pricePerItem, uint256 quantity);
    event CollectionBidAccepted(address indexed collection, uint256 indexed tokenId, uint256 pricePerItem, address seller, address bidder);
    event TraitBidEntered(address indexed collection, address indexed bidder, string traitType, string value, uint256 pricePerItem, uint256 quantity);
    event TraitBidWithdrawn(address indexed collection, address indexed bidder, string traitType, string value, uint256 pricePerItem, uint256 quantity);
    event TraitBidAccepted(address indexed collection, uint256 indexed tokenId, string traitType, string value, uint256 pricePerItem, address seller, address bidder);
    event MarketPausedSet(bool paused);
    event TraitBidsEnabledSet(bool enabled);
    event PointsConfigSet(address indexed pointsAddress, uint256 pointsPerBuy);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address owner_) external initializer {
        if (owner_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        pointsPerBuy = 67;
    }
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ===================== Owner config =====================
    function setCollectionAllowed(address collection, bool allowed) external onlyOwner {
        if (collection == address(0)) revert ZeroAddress();
        allowedCollections[collection] = allowed;
        emit CollectionAllowed(collection, allowed);
    }
    function setMarketPaused(bool p) external onlyOwner { marketPaused = p; emit MarketPausedSet(p); }
    function setTraitBidsEnabled(bool e) external onlyOwner { traitBidsEnabled = e; emit TraitBidsEnabledSet(e); }
    // slither-disable-next-line missing-zero-check
    function setPointsConfig(address a, uint256 p) external onlyOwner { pointsAddress = a; pointsPerBuy = p; emit PointsConfigSet(a, p); }

    modifier active(address collection) {
        if (marketPaused) revert MarketIsPaused();
        if (!allowedCollections[collection]) revert CollectionNotAllowed();
        _;
    }

    function _awardPoints(address to) internal {
        if (pointsAddress != address(0) && pointsPerBuy != 0) {
            try IPoints(pointsAddress).addPoints(to, pointsPerBuy) {} catch {}
        }
    }
    /// @dev royalty -> receiver's pull balance, remainder -> seller's.
    function _settle(address collection, uint256 tokenId, address seller, uint256 price) internal {
        (address recv, uint256 royalty) = ICollection(collection).royaltyInfo(tokenId, price);
        if (royalty > price) royalty = price;
        unchecked { pendingWithdrawals[seller] += price - royalty; }
        if (royalty > 0 && recv != address(0)) pendingWithdrawals[recv] += royalty;
    }
    function _traitKey(string memory t, string memory v) internal pure returns (bytes32) { return keccak256(abi.encode("TRAIT", t, v)); }

    // ===================== Listings =====================
    function offerPhunkForSale(address c, uint256 id, uint256 minWei) external active(c) nonReentrant {
        if (ICollection(c).ownerOf(id) != msg.sender) revert NotTokenOwner();
        offers[c][id] = Offer(true, msg.sender, minWei, address(0));
        emit PhunkOffered(c, id, minWei, address(0));
    }
    function offerPhunkForSaleToAddress(address c, uint256 id, uint256 minWei, address to) external active(c) nonReentrant {
        if (ICollection(c).ownerOf(id) != msg.sender) revert NotTokenOwner();
        offers[c][id] = Offer(true, msg.sender, minWei, to);
        emit PhunkOffered(c, id, minWei, to);
    }
    function phunkNoLongerForSale(address c, uint256 id) external nonReentrant {
        if (ICollection(c).ownerOf(id) != msg.sender) revert NotTokenOwner();
        delete offers[c][id];
        emit PhunkNoLongerForSale(c, id);
    }

    // ===================== Buy =====================
    // buyer's own-bid refund is written after the (trusted, callback-free) NFT transfer, under nonReentrant — benign.
    // slither-disable-next-line reentrancy-no-eth,reentrancy-benign
    function buyPhunk(address c, uint256 id) external payable active(c) nonReentrant {
        Offer memory o = offers[c][id];
        if (!o.isForSale) revert NotForSale();
        if (o.onlySellTo != address(0) && o.onlySellTo != msg.sender) revert OnlySellToMismatch();
        if (msg.value != o.minValue) revert WrongValue();
        if (o.seller == msg.sender) revert CannotBuyOwn();
        if (o.seller != ICollection(c).ownerOf(id)) revert SellerOwnershipChanged();

        delete offers[c][id];
        _settle(c, id, o.seller, msg.value);
        // slither-disable-next-line arbitrary-send-erc20
        ICollection(c).transferFrom(o.seller, msg.sender, id);
        _awardPoints(msg.sender);
        emit PhunkBought(c, id, msg.value, o.seller, msg.sender);

        Bid memory b = bids[c][id];
        if (b.bidder == msg.sender) { delete bids[c][id]; pendingWithdrawals[msg.sender] += b.value; }
    }

    /// @notice Sweep: buy as many of the listed items as are still available, in one tx. `cs[i]` holds
    ///         token `ids[i]`, and the buyer pays at most `maxPrices[i]` for it. Items that were sniped,
    ///         delisted, changed owner, restricted to another buyer, or whose price rose above the
    ///         buyer's max are SKIPPED (best-effort, not reverted). `msg.value` is the budget; whatever
    ///         isn't spent (skipped items + price drops) is refunded to the buyer's pull balance.
    ///         Reverts only if the arrays are malformed, the market is paused, or NOTHING was bought.
    // buyer own-bid refunds + change go to pull balances; no ETH is pushed. nonReentrant + effects-before
    // the only external calls (trusted ERC-721 ownerOf/transferFrom, callback-free).
    // slither-disable-next-line reentrancy-no-eth,reentrancy-benign
    function buyPhunkBatch(
        address[] calldata cs,
        uint256[] calldata ids,
        uint256[] calldata maxPrices
    ) external payable nonReentrant {
        uint256 n = cs.length;
        if (n == 0 || n != ids.length || n != maxPrices.length) revert BadBatch();
        if (marketPaused) revert MarketIsPaused();

        uint256 spent = 0;
        uint256 bought = 0;
        for (uint256 i = 0; i < n; ) {
            address c = cs[i];
            uint256 id = ids[i];
            Offer memory o = offers[c][id];

            // Best-effort: skip anything not cleanly buyable at or below the buyer's per-item max.
            if (
                allowedCollections[c] &&
                o.isForSale &&
                (o.onlySellTo == address(0) || o.onlySellTo == msg.sender) &&
                o.seller != msg.sender &&
                o.minValue <= maxPrices[i] &&
                o.seller == ICollection(c).ownerOf(id)
            ) {
                uint256 price = o.minValue;
                unchecked { spent += price; ++bought; }

                delete offers[c][id];
                _settle(c, id, o.seller, price);
                // slither-disable-next-line arbitrary-send-erc20
                ICollection(c).transferFrom(o.seller, msg.sender, id);
                emit PhunkBought(c, id, price, o.seller, msg.sender);

                Bid memory b = bids[c][id];
                if (b.bidder == msg.sender) { delete bids[c][id]; pendingWithdrawals[msg.sender] += b.value; }
            }

            unchecked { ++i; }
        }

        if (bought == 0) revert NothingBought();
        if (spent > msg.value) revert WrongValue();

        // Points for the items actually bought — one external call.
        if (pointsAddress != address(0) && pointsPerBuy != 0) {
            try IPoints(pointsAddress).addPoints(msg.sender, pointsPerBuy * bought) {} catch {}
        }

        // Refund the unspent budget to the buyer's pull balance (consistent with the rest of the
        // contract — no ETH is ever pushed, so no reentrancy surface on the refund).
        uint256 refund = msg.value - spent;
        if (refund > 0) pendingWithdrawals[msg.sender] += refund;
    }

    /// @dev Lets the frontend detect this impl supports batch sweeps before offering the sweep UI.
    ///      Pre-batch implementations lack this selector, so the read reverts and the UI stays hidden.
    function supportsBatchBuy() external pure returns (bool) { return true; }

    // ===================== Per-token bids =====================
    function enterBidForPhunk(address c, uint256 id) external payable active(c) nonReentrant {
        if (ICollection(c).ownerOf(id) == msg.sender) revert CannotBidOwn();
        if (msg.value == 0) revert ZeroBid();
        Bid memory ex = bids[c][id];
        if (msg.value <= ex.value) revert BidTooLow();
        if (ex.value > 0) pendingWithdrawals[ex.bidder] += ex.value;
        bids[c][id] = Bid(true, msg.sender, msg.value);
        emit PhunkBidEntered(c, id, msg.value, msg.sender);
    }
    function acceptBidForPhunk(address c, uint256 id, uint256 minPrice) external active(c) nonReentrant {
        if (ICollection(c).ownerOf(id) != msg.sender) revert NotTokenOwner();
        Bid memory b = bids[c][id];
        if (b.value == 0) revert NoBid();
        if (b.value < minPrice) revert PriceBelowMin();
        delete bids[c][id];
        delete offers[c][id];
        _settle(c, id, msg.sender, b.value);
        // slither-disable-next-line arbitrary-send-erc20
        ICollection(c).transferFrom(msg.sender, b.bidder, id);
        _awardPoints(b.bidder);
        emit PhunkBought(c, id, b.value, msg.sender, b.bidder);
    }
    function withdrawBidForPhunk(address c, uint256 id) external nonReentrant {
        Bid memory b = bids[c][id];
        if (b.bidder != msg.sender) revert NotBidder();
        delete bids[c][id];
        pendingWithdrawals[msg.sender] += b.value;
        emit PhunkBidWithdrawn(c, id, b.value, msg.sender);
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ===================== Collection (floor) bids =====================
    function enterCollectionBid(address c, uint256 pricePerItem, uint256 qty) external payable active(c) nonReentrant {
        if (pricePerItem == 0 || qty == 0) revert ZeroBid();
        if (msg.value != pricePerItem * qty) revert WrongValue();
        collectionBids[c][msg.sender][pricePerItem] += qty;
        emit CollectionBidEntered(c, msg.sender, pricePerItem, qty);
    }
    function withdrawCollectionBid(address c, uint256 pricePerItem, uint256 qty) external nonReentrant {
        uint256 have = collectionBids[c][msg.sender][pricePerItem];
        if (qty == 0 || qty > have) revert NoBid();
        collectionBids[c][msg.sender][pricePerItem] = have - qty;
        pendingWithdrawals[msg.sender] += pricePerItem * qty;
        emit CollectionBidWithdrawn(c, msg.sender, pricePerItem, qty);
    }
    function acceptCollectionBid(address c, uint256 id, address bidder, uint256 pricePerItem) external active(c) nonReentrant {
        _acceptCollectionBidOne(c, id, bidder, pricePerItem);
    }
    function acceptCollectionBidBatch(address c, uint256[] calldata ids, address bidder, uint256 pricePerItem) external active(c) nonReentrant {
        for (uint256 i; i < ids.length; ++i) _acceptCollectionBidOne(c, ids[i], bidder, pricePerItem);
    }
    function _acceptCollectionBidOne(address c, uint256 id, address bidder, uint256 pricePerItem) internal {
        if (ICollection(c).ownerOf(id) != msg.sender) revert NotTokenOwner();
        if (bidder == msg.sender) revert CannotBuyOwn();
        uint256 qty = collectionBids[c][bidder][pricePerItem];
        if (qty == 0) revert NoBid();
        collectionBids[c][bidder][pricePerItem] = qty - 1;
        delete offers[c][id];
        _settle(c, id, msg.sender, pricePerItem);
        // slither-disable-next-line arbitrary-send-erc20
        ICollection(c).transferFrom(msg.sender, bidder, id);
        _awardPoints(bidder);
        emit CollectionBidAccepted(c, id, pricePerItem, msg.sender, bidder);
    }

    // ===================== Trait bids =====================
    function traitBidOf(address c, address bidder, string calldata t, string calldata v, uint256 pricePerItem) external view returns (uint256) {
        return traitBids[c][bidder][_traitKey(t, v)][pricePerItem];
    }
    function enterTraitBid(address c, string calldata t, string calldata v, uint256 pricePerItem, uint256 qty) external payable active(c) nonReentrant {
        if (!traitBidsEnabled) revert TraitBidsDisabled();
        if (pricePerItem == 0 || qty == 0) revert ZeroBid();
        if (msg.value != pricePerItem * qty) revert WrongValue();
        traitBids[c][msg.sender][_traitKey(t, v)][pricePerItem] += qty;
        emit TraitBidEntered(c, msg.sender, t, v, pricePerItem, qty);
    }
    function withdrawTraitBid(address c, string calldata t, string calldata v, uint256 pricePerItem, uint256 qty) external nonReentrant {
        bytes32 k = _traitKey(t, v);
        uint256 have = traitBids[c][msg.sender][k][pricePerItem];
        if (qty == 0 || qty > have) revert NoBid();
        traitBids[c][msg.sender][k][pricePerItem] = have - qty;
        pendingWithdrawals[msg.sender] += pricePerItem * qty;
        emit TraitBidWithdrawn(c, msg.sender, t, v, pricePerItem, qty);
    }
    function acceptTraitBid(address c, uint256 id, address bidder, string calldata t, string calldata v, uint256 pricePerItem) external active(c) nonReentrant {
        _acceptTraitBidOne(c, id, bidder, t, v, pricePerItem);
    }
    function acceptTraitBidBatch(address c, uint256[] calldata ids, address bidder, string calldata t, string calldata v, uint256 pricePerItem) external active(c) nonReentrant {
        for (uint256 i; i < ids.length; ++i) _acceptTraitBidOne(c, ids[i], bidder, t, v, pricePerItem);
    }
    function _acceptTraitBidOne(address c, uint256 id, address bidder, string calldata t, string calldata v, uint256 pricePerItem) internal {
        if (!traitBidsEnabled) revert TraitBidsDisabled();
        if (ICollection(c).ownerOf(id) != msg.sender) revert NotTokenOwner();
        if (bidder == msg.sender) revert CannotBuyOwn();
        if (!ICollection(c).hasTrait(id, t, v)) revert TraitMismatch();
        bytes32 k = _traitKey(t, v);
        uint256 qty = traitBids[c][bidder][k][pricePerItem];
        if (qty == 0) revert NoBid();
        traitBids[c][bidder][k][pricePerItem] = qty - 1;
        delete offers[c][id];
        _settle(c, id, msg.sender, pricePerItem);
        // slither-disable-next-line arbitrary-send-erc20
        ICollection(c).transferFrom(msg.sender, bidder, id);
        _awardPoints(bidder);
        emit TraitBidAccepted(c, id, t, v, pricePerItem, msg.sender, bidder);
    }

    uint256[38] private __gap;
}
