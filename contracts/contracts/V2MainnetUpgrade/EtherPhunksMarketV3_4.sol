// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV3_4.sol *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
****************************/

/* ========================================
   ∬  V3_4: auto-refund bid on market sale ∬
   ========================================
   ∬  When a phunk is BOUGHT through the   ∬
   ∬  market, any standing (not-yet-       ∬
   ∬  accepted) bid keyed to the seller is ∬
   ∬  refunded + cleared — so a sale wipes ∬
   ∬  the bid instead of leaving it stale. ∬
   ∬                                       ∬
   ∬  Mirrors ittybits' _refundActiveBid   ∬
   ∬  (ittybitId, seller) inside           ∬
   ∬  _buyIttybit — but uses our safer     ∬
   ∬  PULL refund (pendingWithdrawals)     ∬
   ∬  instead of a push call mid-buy.      ∬
   ∬                                       ∬
   ∬  No new storage. Only overrides       ∬
   ∬  _buyPhunk + adds one internal helper.∬
   ====================================== */

pragma solidity 0.8.20;

import "./EtherPhunksMarketV3_3.sol";

contract EtherPhunksMarketV3_4 is EtherPhunksMarketV3_3 {

    // initialize() inherited from V3_2 (fresh-deploy/tests only; never called on a
    // production proxy upgrade — guarded by the `initializer` modifier).

    /// @dev Same as the inherited sale, plus: refund any standing bid against the seller.
    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal virtual override {
        // Capture the seller BEFORE the parent deletes the offer (_invalidateListing).
        address seller = phunksOfferedForSale[phunkId].seller;

        // Execute the unchanged sale (validations, payment, royalty, transfer, points).
        super._buyPhunk(phunkId, minSalePriceInWei);

        // Then auto-refund the now-orphaned bid against the (former) seller.
        _refundStandingBidOnSale(phunkId, seller);
    }

    /// @dev Refund + clear a standing bid against `seller` for `phunkId`, if one exists
    ///      and has NOT been accepted. Accepted bids are never touched: an accepted bid
    ///      escrows the item and invalidates the listing, so this sale path can't even
    ///      reach an accepted-bid item — the `acceptedBlock == 0` guard is belt-and-braces.
    ///      Pull refund (pendingWithdrawals) — no external call, no reentrancy surface.
    function _refundStandingBidOnSale(bytes32 phunkId, address seller) internal {
        Bid memory bid = bids[seller][phunkId];
        if (bid.hasBid && bid.acceptedBlock == 0) {
            delete bids[seller][phunkId];
            pendingWithdrawals[bid.bidder] += bid.value;
            emit BidWithdrawn(phunkId, seller, bid.bidder, bid.value);
        }
    }
}
