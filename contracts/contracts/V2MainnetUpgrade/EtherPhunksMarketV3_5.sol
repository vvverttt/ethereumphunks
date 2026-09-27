// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV3_5.sol *
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
****************************/

/* ==========================================
   ∬  V3_5: audit fixes                      ∬
   ==========================================
   ∬  1. withdraw() now zeroes the balance    ∬
   ∬     BEFORE sending. V3_1 sent first and  ∬
   ∬     zeroed after — the classic reentrancy∬
   ∬     shape, held back only by nonReentrant∬
   ∬                                          ∬
   ∬  2. Royalties are PULL, not push. A      ∬
   ∬     receiver that rejects ETH could      ∬
   ∬     previously revert every sale and     ∬
   ∬     every confirmBid, bricking the       ∬
   ∬     market until the owner intervened.   ∬
   ∬                                          ∬
   ∬  3. Accepted bids can expire. Before,    ∬
   ∬     only the bidder could ever resolve   ∬
   ∬     an accepted bid — if they vanished   ∬
   ∬     their ETH was locked forever and the ∬
   ∬     (owner, phunkId) bid slot was dead.  ∬
   ∬                                          ∬
   ∬  No new storage. No layout change.       ∬
   ========================================= */

pragma solidity 0.8.20;

import "./EtherPhunksMarketV3_4.sol";

contract EtherPhunksMarketV3_5 is EtherPhunksMarketV3_4 {

    /// After this many blocks an accepted-but-unconfirmed bid can be cleared by anyone,
    /// refunding the bidder. ~24h at 12s blocks. Long enough that an honest bidder is
    /// never raced, short enough that funds are not stranded indefinitely.
    uint256 public constant ACCEPTED_BID_EXPIRY_BLOCKS = 7200;

    event AcceptedBidExpired(
        bytes32 indexed phunkId,
        address indexed owner,
        address indexed bidder,
        uint256 value
    );

    // =========================================================
    // 1. withdraw() — checks, effects, THEN interactions
    // =========================================================

    /// @dev V3_1 performed the external call while `pendingWithdrawals[msg.sender]` was
    ///      still set, and zeroed it afterwards. Only `nonReentrant` stood between that
    ///      and a drain. Order corrected here; behaviour is otherwise identical.
    function withdraw() public override nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount != 0, "No pending withdrawals");

        pendingWithdrawals[msg.sender] = 0;            // effect first

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");         // interaction last
    }

    // =========================================================
    // 2. Royalties by pull, so a bad receiver cannot brick sales
    // =========================================================

    /// @dev Credits each receiver's `pendingWithdrawals` instead of pushing ETH. The
    ///      contract already uses pull for seller proceeds and bid refunds; this makes
    ///      the royalty path consistent with the rest of it and removes the external
    ///      call from the middle of every sale.
    ///
    ///      Receivers collect with the same `withdraw()` everyone else uses. Any rounding
    ///      dust from the share split stays in the contract, as before.
    function _payRoyalties(uint256 royalty) internal override {
        if (royalty == 0) return;
        for (uint i = 0; i < royaltyReceivers.length; i++) {
            uint256 share = (royalty * royaltyReceivers[i].share) / 10000;
            if (share > 0) {
                pendingWithdrawals[royaltyReceivers[i].receiver] += share;
            }
        }
    }

    // =========================================================
    // 3. Accepted bids expire instead of locking funds forever
    // =========================================================

    /// @notice Clear an accepted bid that the bidder never confirmed, refunding them.
    ///
    /// Before this, `acceptedBlock != 0` blocked `enterBid` ("Bid accepted, locked") and
    /// `withdrawBid` ("cannot withdraw"), and only the bidder could call `confirmBid`.
    /// A bidder who disappeared after acceptance left their own ETH stranded AND made
    /// that (owner, phunkId) slot permanently unbiddable.
    ///
    /// Permissionless on purpose: it only ever returns the bid to the bidder, so there is
    /// nothing to gain by calling it and no reason to restrict who may.
    ///
    /// The seller is unaffected either way — they can already `withdrawPhunk` to take the
    /// Ethscription back out of escrow.
    function expireAcceptedBid(bytes32 phunkId, address currentOwner) external nonReentrant {
        Bid memory bid = bids[currentOwner][phunkId];
        require(bid.hasBid, "No bid");
        require(bid.acceptedBlock != 0, "Not accepted");
        require(
            block.number > bid.acceptedBlock + ACCEPTED_BID_EXPIRY_BLOCKS,
            "Not expired yet"
        );

        delete bids[currentOwner][phunkId];
        pendingWithdrawals[bid.bidder] += bid.value;

        emit AcceptedBidExpired(phunkId, currentOwner, bid.bidder, bid.value);
        emit BidRefunded(phunkId, currentOwner, bid.bidder, bid.value);
    }

    /// @notice Blocks remaining before `expireAcceptedBid` becomes callable. Reverts if
    ///         there is no accepted bid to expire.
    function blocksUntilBidExpiry(bytes32 phunkId, address currentOwner)
        external
        view
        returns (uint256)
    {
        Bid memory bid = bids[currentOwner][phunkId];
        require(bid.hasBid && bid.acceptedBlock != 0, "No accepted bid");
        uint256 expiresAt = bid.acceptedBlock + ACCEPTED_BID_EXPIRY_BLOCKS;
        return block.number > expiresAt ? 0 : expiresAt - block.number + 1;
    }
}
