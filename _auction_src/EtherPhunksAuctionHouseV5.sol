// SPDX-License-Identifier: PHUNKY

/* ==========================================
   ∬  EtherPhunks Auction House V5           ∬
   ==========================================
   ∬  Per-item fixed-price buy-now over the   ∬
   ∬  WHOLE pool ("buyItem"): any pooled       ∬
   ∬  ethscription can be taken directly at    ∬
   ∬  one of three fixed prices — no auction:  ∬
   ∬    tier 2  EthsRocks     @ buyNow2Price   ∬
   ∬    tier 1  Missing/Dysto @ buyNowPrice    ∬
   ∬    tier 0  PUBLIC (no wl) @ buyNowPublic  ∬
   ∬  All items are purchasable at once from   ∬
   ∬  their own details page.                  ∬
   ∬                                           ∬
   ∬  Auctions are turned OFF operationally:   ∬
   ∬  settle the live item (if any) then       ∬
   ∬  pause() — settleAndCreate is whenNot-    ∬
   ∬  Paused so no new auction can start, and  ∬
   ∬  createBid dies once nothing is live.     ∬
   ∬  buyItem DELIBERATELY omits whenNotPaused ∬
   ∬  so buy-now keeps working while paused.   ∬
   ∬  Append-only over V4.                     ∬
   ========================================== */

pragma solidity ^0.8.20;

import "./EtherPhunksAuctionHouseV4.sol";
import "./interfaces/IPoints.sol";

contract EtherPhunksAuctionHouseV5 is EtherPhunksAuctionHouseV4 {

    // ─── Buy-now tier-0 (PUBLIC) + master switch (V5) ─────────
    // Appended strictly AFTER V4's entire layout (incl. its uint256[47] __gapV4).
    // Append-only: cannot touch any existing V2/V3/V4 storage — validateUpgrade(V4 -> V5) enforced.

    uint256 public buyNowPublicPrice;   // tier-0 public take price, e.g. 0.367 ether (NO whitelist)
    bool public buyNowPublicEnabled;    // tier-0 (public) master switch
    bool public itemBuyNowEnabled;      // master switch for the whole per-item buy-now feature

    // ─── Events ───────────────────────────────────────────────

    event ItemBought(bytes32 indexed hashId, address indexed buyer, uint256 amount, uint8 tier);
    event BuyNowPublicConfigured(uint256 price, bool enabled);
    event ItemBuyNowToggled(bool enabled);

    // ─── Per-item fixed-price take of ANY pool item ───────────

    /// @notice Buy a specific pooled ethscription `hashId` outright at one of three fixed prices.
    ///         No auction is involved — the item is pulled straight from the pool. `tier` picks price:
    ///           tier 2 → buyNow2Price       (EthsRocks whitelist, merkle proof required)
    ///           tier 1 → buyNowPrice        (Missing/Dysto whitelist, merkle proof required)
    ///           tier 0 → buyNowPublicPrice  (PUBLIC — no whitelist, `proof` ignored)
    ///         Each tier is independently switchable. Tiers 1/2 reuse V3/V4's roots + prices so the
    ///         same holder snapshots that gated the auction buy-now now gate per-item buy-now.
    /// @dev Intentionally NOT `whenNotPaused`: auctions are disabled by pausing the house, and buy-now
    ///      must survive that pause. Guarded instead by `itemBuyNowEnabled` + the per-tier switch.
    ///      `inPool[hashId] == true` guarantees this is a genuine pool item and NOT the live auction
    ///      item (a promoted auction item has inPool == false), so there is never a bidder to refund —
    ///      the same clean, no-bid-window invariant buyNow relies on. CEI + nonReentrant throughout.
    /// @param hashId the pooled ethscription to buy
    /// @param tier   0 = public, 1 = buyNow whitelist, 2 = buyNow2 whitelist
    /// @param proof  merkle proof for the chosen whitelist tier (ignored when tier == 0)
    function buyItem(bytes32 hashId, uint8 tier, bytes32[] calldata proof)
        external
        payable
        nonReentrant
        notBlacklisted
    {
        require(itemBuyNowEnabled, "Item buy-now disabled");
        require(inPool[hashId], "Not available");

        uint256 price;
        if (tier == 2) {
            require(buyNow2Enabled, "Tier disabled");
            require(_verifyBuyItemWl(proof, buyNow2MerkleRoot, msg.sender), "Not whitelisted");
            price = buyNow2Price;
        } else if (tier == 1) {
            require(buyNowEnabled, "Tier disabled");
            require(_verifyBuyItemWl(proof, buyNowMerkleRoot, msg.sender), "Not whitelisted");
            price = buyNowPrice;
        } else {
            require(buyNowPublicEnabled, "Tier disabled");
            price = buyNowPublicPrice;
        }
        require(price > 0, "Price not set");
        require(msg.value >= price, "Below buy-now price");

        address dep = depositor[hashId];

        // ── Effects (CEI) ──
        _removeFromPool(hashId);
        delete depositor[hashId];

        // ── Interactions ──
        // Same event-based escrow transfer path a normal winning settle / buyNow uses.
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

        emit ItemBought(hashId, msg.sender, msg.value, tier);
    }

    // ─── Owner config ─────────────────────────────────────────

    /// @notice Set the PUBLIC (tier-0, no-whitelist) buy-now price and switch.
    function setBuyNowPublic(uint256 price, bool enabled) external onlyOwner {
        if (enabled) require(price > 0, "Price must be > 0");
        buyNowPublicPrice = price;
        buyNowPublicEnabled = enabled;
        emit BuyNowPublicConfigured(price, enabled);
    }

    /// @notice Master on/off for the entire per-item buy-now feature.
    function setItemBuyNowEnabled(bool enabled) external onlyOwner {
        itemBuyNowEnabled = enabled;
        emit ItemBuyNowToggled(enabled);
    }

    // V3/V4's _verifyWhitelist* are private, so re-implement identically here.
    function _verifyBuyItemWl(bytes32[] calldata proof, bytes32 root, address account)
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

    // ─── Storage gap for future V5 upgrades ───────────────────
    uint256[47] private __gapV5;
}
