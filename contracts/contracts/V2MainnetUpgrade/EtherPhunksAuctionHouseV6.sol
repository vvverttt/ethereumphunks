// SPDX-License-Identifier: PHUNKY

/* ==========================================
   ∬  EtherPhunksAuctionHouse V6            ∬
   ==========================================
   ∬  A pure auction house again.            ∬
   ∬                                         ∬
   ∬  RETIRED (always revert):               ∬
   ∬    · buyItem      — per-item buy-now    ∬
   ∬    · swap         — item-for-item swap  ∬
   ∬    · cancelSwapDeposit                  ∬
   ∬  and every whitelist/tier setter that   ∬
   ∬  only existed to configure them.        ∬
   ∬                                         ∬
   ∬  FIXED:                                 ∬
   ∬    · withdrawETH now subtracts          ∬
   ∬      totalPendingReturns as well as     ∬
   ∬      totalCommittedETH (V2 audit).      ∬
   ∬                                         ∬
   ∬  Storage: one new slot taken from V2's  ∬
   ∬  own __gap (43 -> 42). Nothing in       ∬
   ∬  V3/V4/V5 moves.                        ∬
   ========================================= */

pragma solidity ^0.8.20;

import "./EtherPhunksAuctionHouseV5.sol";

contract EtherPhunksAuctionHouseV6 is EtherPhunksAuctionHouseV5 {

    error Retired();

    event FeatureRetired(string feature);

    // =========================================================
    // Retired: per-item buy-now
    // =========================================================
    //
    // V5 sold any pooled item outright at one of three fixed prices. Every item in this
    // house is the project's own, so a fixed-price take served no one and meant a deposit
    // was instantly purchasable at whatever price happened to be configured — 0.267 public,
    // 0.167 to any EthsRocks holder — regardless of what the item was worth.
    //
    // Reverting rather than relying on `itemBuyNowEnabled` being false: a switch can be
    // flipped back by accident, this cannot.

    function buyItem(bytes32, uint8, bytes32[] calldata)
        external
        payable
        override
        nonReentrant
        notBlacklisted
    {
        revert Retired();
    }

    // =========================================================
    // Retired: swaps
    // =========================================================
    //
    // Swap let a holder trade an item in for a pooled one against a merkle whitelist. It
    // was never switched on (swapEnabled false, root zero, fee zero) and there are no
    // third-party deposits to protect, so it is closed rather than left dormant.

    function swap(bytes32, bytes32, bytes32[] calldata)
        external
        payable
        override
        nonReentrant
        whenNotPaused
        notBlacklisted
    {
        revert Retired();
    }

    function cancelSwapDeposit(bytes32)
        external
        override
        nonReentrant
        notBlacklisted
    {
        revert Retired();
    }

    // =========================================================
    // Retired: whitelist + tier configuration
    // =========================================================
    //
    // These only ever configured buy-now and swaps. The underlying storage stays (it must —
    // removing a slot would shift everything after it), but nothing can write to it again.
    // Reading buyNowPrice or a merkle root still works and still returns the old value;
    // no code path consumes it any more.

    function setBuyNowPublic(uint256, bool) external view override onlyOwner { revert Retired(); }
    function setItemBuyNowEnabled(bool) external view override onlyOwner { revert Retired(); }
    function setSwapEnabled(bool) external view override onlyOwner { revert Retired(); }
    function setSwapMerkleRoot(bytes32) external view override onlyOwner { revert Retired(); }
    function setSwapFee(uint256) external view override onlyOwner { revert Retired(); }

    // =========================================================
    // What this house still does
    // =========================================================

    /// @notice Everything retired in V6, so a caller can check before building a transaction.
    function retiredFeatures() external pure returns (string[] memory list) {
        list = new string[](8);
        list[0] = "buyItem";
        list[1] = "swap";
        list[2] = "cancelSwapDeposit";
        list[3] = "setBuyNowPublic";
        list[4] = "setItemBuyNowEnabled";
        list[5] = "setSwapEnabled";
        list[6] = "setSwapMerkleRoot";
        list[7] = "setSwapFee";
    }

    /// @notice ETH the owner may actually withdraw: the balance minus both liabilities.
    ///         Mirrors the corrected check inside withdrawETH so it can be read off-chain.
    function availableETH() external view returns (uint256) {
        uint256 bal = address(this).balance;
        uint256 owed = totalCommittedETH + totalPendingReturns;
        return bal > owed ? bal - owed : 0;
    }
}
