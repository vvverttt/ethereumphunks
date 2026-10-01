// SPDX-License-Identifier: PHUNKY

/* ==========================================
   ∬  QuantumPhunksMarketMulti V3           ∬
   ==========================================
   ∬  Low-price fee.                         ∬
   ∬                                         ∬
   ∬  A sale BELOW `lowPriceThreshold` pays  ∬
   ∬  `lowPriceBps` to the collection's      ∬
   ∬  ERC-2981 receiver instead of the       ∬
   ∬  normal royalty. Default: under         ∬
   ∬  0.067 ETH -> 67%.                      ∬
   ∬                                         ∬
   ∬  Storage: two slots from V2's own       ∬
   ∬  __gap (38 -> 36). Nothing moves.       ∬
   ========================================= */

pragma solidity ^0.8.20;

import "./QuantumPhunksMarketMultiV2.sol";

contract QuantumPhunksMarketMultiV3 is QuantumPhunksMarketMultiV2 {

    error BpsTooHigh();

    /// @notice Sales strictly below this pay `lowPriceBps` instead of the ERC-2981 royalty.
    ///         Zero disables the whole mechanism and V2 behaviour returns.
    uint256 public lowPriceThreshold;

    /// @notice Fee in basis points applied below the threshold. 6700 = 67%.
    uint256 public lowPriceBps;

    event LowPriceFeeUpdated(uint256 threshold, uint256 bps);

    uint256 private constant MAX_BPS = 10_000;

    /// @notice One-time setup after the upgrade. Call via upgradeToAndCall, or directly as owner.
    /// @dev Not an `initializer` — V2 already consumed that. Owner-gated and idempotent instead.
    function configureLowPriceFee(uint256 threshold, uint256 bps) public onlyOwner {
        if (bps > MAX_BPS) revert BpsTooHigh();
        lowPriceThreshold = threshold;
        lowPriceBps = bps;
        emit LowPriceFeeUpdated(threshold, bps);
    }

    /// @notice Convenience: the intended launch configuration — under 0.067 ETH pays 67%.
    function setDefaultLowPriceFee() external onlyOwner {
        configureLowPriceFee(0.067 ether, 6_700);
    }

    /// @notice What a sale at `price` would pay, without executing anything. Let the UI warn a
    ///         seller BEFORE they list into the penalty band rather than after they are paid.
    /// @return fee          what the receiver gets
    /// @return toSeller     what the seller gets
    /// @return isLowPrice   whether the low-price rate applied
    function quoteSale(address collection, uint256 tokenId, uint256 price)
        external view returns (uint256 fee, uint256 toSeller, bool isLowPrice)
    {
        fee = _feeFor(collection, tokenId, price);
        toSeller = price - fee;
        isLowPrice = lowPriceThreshold != 0 && price < lowPriceThreshold;
    }

    /// @dev The fee for a sale. Below the threshold the flat rate REPLACES the ERC-2981 royalty
    ///      rather than stacking on it — "we take 67%" has to mean 67% total, not 72%.
    function _feeFor(address collection, uint256 tokenId, uint256 price)
        internal view returns (uint256 fee)
    {
        if (lowPriceThreshold != 0 && price < lowPriceThreshold) {
            fee = (price * lowPriceBps) / MAX_BPS;
        } else {
            (, fee) = ICollection(collection).royaltyInfo(tokenId, price);
        }
        // Same guard V2 had: a fee may never exceed the sale, or `price - fee` underflows and
        // the escrow accounting breaks. bps is capped at 10000 so this cannot trigger from the
        // low-price branch, but a collection's own royaltyInfo is third-party code.
        if (fee > price) fee = price;
    }

    /// @dev Replaces V2's _settle. Identical split and identical solvency property —
    ///      seller + receiver always sums to exactly `price`, never more — only the rate differs.
    function _settle(address collection, uint256 tokenId, address seller, uint256 price)
        internal
        override
    {
        (address recv, ) = ICollection(collection).royaltyInfo(tokenId, price);
        uint256 fee = _feeFor(collection, tokenId, price);

        // Checked on purpose, as in V2: `price` arrives from the seller's uncapped `minValue`,
        // so an unchecked add could be wrapped by listing at an absurd price and would corrupt
        // the escrow accounting.
        pendingWithdrawals[seller] += price - fee;

        // If the collection has no receiver there is nobody to pay, so the fee is not taken at
        // all — it returns to the seller rather than being stranded in the contract, which
        // would break the solvency invariant.
        if (fee > 0 && recv != address(0)) pendingWithdrawals[recv] += fee;
        else if (fee > 0) pendingWithdrawals[seller] += fee;
    }
}
