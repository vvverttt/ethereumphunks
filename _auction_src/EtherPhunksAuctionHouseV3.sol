// SPDX-License-Identifier: PHUNKY

/* ========================================
   ∬  EtherPhunks Auction House V3         ∬
   ========================================
   ∬  V2  + whitelisted fixed-price take    ∬
   ∬  "buyNow": a whitelisted ethsrocks     ∬
   ∬  holder can take the CURRENT auction   ∬
   ∬  item at a fixed price, but ONLY while  ∬
   ∬  it has zero bids (reserve not yet met) ∬
   ∬  → no bidder ever needs refunding, so   ∬
   ∬  the ethscription-escrow path stays as  ∬
   ∬  clean as a normal settle.              ∬
   ∬  Once anyone bids, buyNow locks for      ∬
   ∬  that item; the auction runs normally.  ∬
   ==================================== ==== */

pragma solidity ^0.8.20;

import "./EtherPhunksAuctionHouseV2.sol";
import "./interfaces/IPoints.sol";

contract EtherPhunksAuctionHouseV3 is EtherPhunksAuctionHouseV2 {

    // ─── Buy-now state (V3) ──────────────────────────────────
    // NOTE ON STORAGE LAYOUT: V3 inherits V2, so these vars are appended
    // AFTER V2's entire layout (including its uint256[43] __gap). They occupy
    // previously-unused slots — the upgrade is strictly append-only and cannot
    // touch any existing V2 storage. A fresh __gap is added for future V3 vars.

    bytes32 public buyNowMerkleRoot;  // merkle root of the ethsrocks holder snapshot (whitelist)
    uint256 public buyNowPrice;       // fixed take price, e.g. 0.167 ether
    bool public buyNowEnabled;        // master switch

    // ─── Events ──────────────────────────────────────────────

    event BuyNow(bytes32 indexed hashId, uint256 auctionId, address indexed buyer, uint256 amount);
    event BuyNowConfigured(bytes32 merkleRoot, uint256 price, bool enabled);

    // ─── Whitelisted fixed-price take of the live auction item ─

    /// @notice Take the item currently up for auction at `buyNowPrice`, without
    ///         bidding. Only works while the auction has NO bids yet (reserve not
    ///         met). The instant anyone bids, this reverts for that item and it
    ///         must play out as a normal auction.
    /// @param proof merkle proof that msg.sender is in the ethsrocks snapshot
    function buyNow(bytes32[] calldata proof)
        external
        payable
        nonReentrant
        whenNotPaused
        notBlacklisted
    {
        require(buyNowEnabled, "Buy-now disabled");
        require(auction.startTime != 0 && !auction.settled, "No active auction");
        require(block.timestamp < auction.endTime, "Auction expired");
        // CORE INVARIANT: only before any bid. With no bidder there is nothing to
        // refund, so no double-spend / stuck-escrow risk on the ethscription.
        require(auction.bidder == address(0), "Auction already has a bid");
        require(msg.value >= buyNowPrice, "Below buy-now price");
        require(_verifyWhitelist(proof, buyNowMerkleRoot, msg.sender), "Not whitelisted");

        bytes32 hashId = auction.hashId;
        uint256 aId = auction.auctionId;
        address dep = depositor[hashId];

        // ── Effects (CEI) ──
        auction.settled = true;      // consume the current auction; totalCommittedETH is
                                     // untouched because a no-bid auction committed nothing.
        delete depositor[hashId];

        // ── Interactions ──
        // Same event-based escrow transfer path a normal winning settle uses.
        _transferEthscription(dep, msg.sender, hashId);

        // Match auction wins: 67 points to the buyer (best-effort, never blocks).
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(msg.sender, 67) {} catch {}
        }

        // Proceeds to treasury (hybrid push → pull fallback, like the rest of the house).
        (bool sent, ) = treasuryAddress.call{value: msg.value}("");
        if (!sent) {
            pendingReturns[treasuryAddress] += msg.value;
            emit RefundEscrowed(treasuryAddress, msg.value);
        }

        emit BuyNow(hashId, aId, msg.sender, msg.value);
        // Mirror the auction lifecycle so existing indexers see a settlement.
        emit AuctionSettled(hashId, aId, msg.sender, msg.value);

        // The next Phunk goes up on the next settleAndCreate() call (frontend already
        // triggers this), exactly like a normal settlement — auction.settled is now true.
    }

    // ─── Owner config ────────────────────────────────────────

    function setBuyNow(bytes32 merkleRoot, uint256 price, bool enabled) external onlyOwner {
        // Guard the footgun: enabling with a zero price would give whitelisted
        // holders free items; enabling with a zero root would let nobody in.
        if (enabled) {
            require(price > 0, "Price must be > 0");
            require(merkleRoot != bytes32(0), "Root must be set");
        }
        buyNowMerkleRoot = merkleRoot;
        buyNowPrice = price;
        buyNowEnabled = enabled;
        emit BuyNowConfigured(merkleRoot, price, enabled);
    }

    // ─── Merkle whitelist verify (sorted-pair keccak, leaf = keccak(address)) ─

    function _verifyWhitelist(bytes32[] calldata proof, bytes32 root, address account)
        private
        pure
        returns (bool)
    {
        if (root == bytes32(0)) return false;
        bytes32 hash = keccak256(abi.encodePacked(account));
        for (uint256 i = 0; i < proof.length; i++) {
            hash = hash < proof[i]
                ? keccak256(abi.encodePacked(hash, proof[i]))
                : keccak256(abi.encodePacked(proof[i], hash));
        }
        return hash == root;
    }

    // ─── Storage gap for future V3 upgrades ──────────────────
    uint256[47] private __gapV3;
}
