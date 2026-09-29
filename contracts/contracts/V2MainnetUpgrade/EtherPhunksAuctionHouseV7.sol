// SPDX-License-Identifier: PHUNKY

/* ==========================================
   ∬  EtherPhunksAuctionHouse V7            ∬
   ==========================================
   ∬  Finishes what V6 started.              ∬
   ∬                                         ∬
   ∬  V6 retired `buyItem` (the V5 per-item  ∬
   ∬  buy-now) but left `buyNow` (V3) and    ∬
   ∬  `buyNow2` (V4) callable. buyNow2 was   ∬
   ∬  found ARMED on mainnet: enabled=true,  ∬
   ∬  price 0.167 ETH, live merkle root —    ∬
   ∬  held back only by the pause.           ∬
   ∬                                         ∬
   ∬  RETIRED (always revert):               ∬
   ∬    · buyNow      · setBuyNow            ∬
   ∬    · buyNow2     · setBuyNow2           ∬
   ∬                                         ∬
   ∬  FIXED: setPointsAddress rejects zero.  ∬
   ∬                                         ∬
   ∬  Storage: UNCHANGED. Overrides only.    ∬
   ========================================= */

pragma solidity ^0.8.20;

import "./EtherPhunksAuctionHouseV6.sol";

contract EtherPhunksAuctionHouseV7 is EtherPhunksAuctionHouseV6 {

    error PointsAddressZero();

    // =========================================================
    // Retired: the remaining buy-now paths
    // =========================================================
    //
    // V6's reasoning applied only to `buyItem`, but `buyNow` and `buyNow2` are the same idea
    // wearing older names: while an auction is live and nobody has bid yet, a whitelisted
    // address takes the item outright at a fixed price. Every item in this house is the
    // project's own, so a fixed-price take short-circuits the auction that is supposed to
    // price it.
    //
    // This mattered more than the other two. At the time of writing, on mainnet:
    //
    //     paused            true          <- the ONLY thing stopping it
    //     buyNow2Enabled    true
    //     buyNow2Price      0.167 ether
    //     buyNow2MerkleRoot 0x489c11e3...  <- a live whitelist
    //
    // So unpausing alone would have re-armed it. Reverting rather than clearing the flag, for
    // the same reason V6 gave: a switch can be flipped back by accident, this cannot.
    //
    // The storage stays (removing a slot would shift everything after it) and buyNow2Price
    // still reads 0.167 ether forever. Nothing consumes it any more.

    function buyNow(bytes32[] calldata)
        external
        payable
        override
        nonReentrant
        whenNotPaused
        notBlacklisted
    {
        revert Retired();
    }

    function buyNow2(bytes32[] calldata)
        external
        payable
        override
        nonReentrant
        whenNotPaused
        notBlacklisted
    {
        revert Retired();
    }

    function setBuyNow(bytes32, uint256, bool) external view override onlyOwner { revert Retired(); }
    function setBuyNow2(bytes32, uint256, bool) external view override onlyOwner { revert Retired(); }

    // =========================================================
    // Fixed: setPointsAddress accepted address(0)
    // =========================================================
    //
    // A zero points address does not revert — a call to an address with no code succeeds and
    // returns nothing — so points would silently stop accruing with no error anywhere. Cheap
    // to make impossible.

    function setPointsAddress(address _pointsAddress) external override onlyOwner {
        if (_pointsAddress == address(0)) revert PointsAddressZero();
        pointsAddress = _pointsAddress;
    }

    // =========================================================
    // What this house still does
    // =========================================================

    /// @notice Everything retired across V6 and V7, so a caller can check before building a tx.
    function retiredFeaturesV7() external pure returns (string[] memory list) {
        list = new string[](12);
        list[0]  = "buyItem";               // V6
        list[1]  = "swap";
        list[2]  = "cancelSwapDeposit";
        list[3]  = "setBuyNowPublic";
        list[4]  = "setItemBuyNowEnabled";
        list[5]  = "setSwapEnabled";
        list[6]  = "setSwapMerkleRoot";
        list[7]  = "setSwapFee";
        list[8]  = "buyNow";                // V7
        list[9]  = "buyNow2";
        list[10] = "setBuyNow";
        list[11] = "setBuyNow2";
    }
}
