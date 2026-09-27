// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV3_3.sol *
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

/* ========================================
   ∬  V3_3: one-tx escrow + accept bid    ∬
   ========================================
   ∬  Adds a DEPOSIT_AND_ACCEPT_BID       ∬
   ∬  fallback path so the owner escrows  ∬
   ∬  AND accepts a bid in a single tx,   ∬
   ∬  matching the existing               ∬
   ∬  DEPOSIT_AND_LIST pattern.           ∬
   ∬                                      ∬
   ∬  3-step flow:                        ∬
   ∬   1. bidder  enterBid                ∬
   ∬   2. owner   escrow + acceptBid (1)  ∬
   ∬   3. bidder  confirmBid (after 5)    ∬
   ∬                                      ∬
   ∬  No new storage. No V3_2 logic       ∬
   ∬  changes. Adds one constant + an     ∬
   ∬  overridden fallback.                ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EtherPhunksMarketV3_2.sol";

contract EtherPhunksMarketV3_3 is EtherPhunksMarketV3_2 {

    bytes32 constant DEPOSIT_AND_ACCEPT_BID_SIGNATURE =
        keccak256("DEPOSIT_AND_ACCEPT_BID_SIGNATURE");

    // initialize() is inherited from V3_2 (fresh-deploy/tests only — guarded by
    // the `initializer` modifier; never called on a production proxy upgrade).

    // Step 2 (combined): owner sends the Ethscription to the contract (escrow)
    // AND accepts the standing bid in the SAME transaction.
    //
    // Calldata layout (each field 32 bytes, matches DEPOSIT_AND_LIST style):
    //   [  0: 32]  phunkId          (the Ethscription being transferred in)
    //   [ 32: 64]  signature        (DEPOSIT_AND_ACCEPT_BID_SIGNATURE)
    //   [ 64: 96]  bidder           (address, left-padded)
    //   [ 96:128]  minValue         (uint256 — front-run protection floor)
    //
    // The ethscriptions protocol only honors the transfer of the real phunkId
    // (first word) since the sender doesn't own ethscriptions equal to the
    // signature / bidder / minValue words — same property DEPOSIT_AND_LIST relies on.
    fallback() external override {
        require(!paused(), "Contract is paused");

        bytes32 signature;
        assembly {
            signature := calldataload(32)
        }

        if (signature == DEPOSIT_AND_ACCEPT_BID_SIGNATURE) {
            require(msg.data.length % 32 == 0, "InvalidEthscriptionLength");

            bytes32 phunkId;
            bytes32 bidderRaw;
            bytes32 minValueRaw;
            assembly {
                phunkId := calldataload(0)
                bidderRaw := calldataload(64)
                minValueRaw := calldataload(96)
            }

            address bidder = address(uint160(uint256(bidderRaw)));

            // 1. Escrow the Ethscription (records deposit block for msg.sender).
            _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);

            // 2. Accept the standing bid against (msg.sender, phunkId).
            _acceptBidFrom(msg.sender, phunkId, bidder, uint256(minValueRaw));
            return;
        }

        if (signature == DEPOSIT_AND_LIST_SIGNATURE) {
            require(msg.data.length % 32 == 0, "InvalidEthscriptionLength");

            bytes32 phunkId;
            bytes32 listingPrice;
            bytes32 toAddress;

            assembly {
                phunkId := calldataload(0)
                listingPrice := calldataload(64)
                toAddress := calldataload(96)
            }

            if (toAddress != 0x0) {
                address addrToAddress = address(uint160(uint256(toAddress)));

                _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
                offerPhunkForSaleToAddress(phunkId, uint256(listingPrice), addrToAddress);
                return;
            }

            _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
            _offerPhunkForSale(phunkId, uint256(listingPrice));
            return;
        }

        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }

    // Internal accept-bid used by the combined fallback path.
    // Mirrors V3_2.acceptBid exactly, but takes the owner explicitly (msg.sender
    // in the fallback context) and skips the deposit check since the caller has
    // just deposited the Ethscription in the same transaction.
    function _acceptBidFrom(
        address owner,
        bytes32 phunkId,
        address bidder,
        uint256 minValue
    ) internal {
        Bid storage bid = bids[owner][phunkId];
        require(bid.hasBid, "No bid");
        require(bid.bidder == bidder, "Bidder mismatch");
        require(bid.acceptedBlock == 0, "Already accepted");
        require(bid.value >= minValue, "Below minValue");

        if (phunksOfferedForSale[phunkId].isForSale) {
            _invalidateListing(phunkId);
            emit PhunkNoLongerForSale(phunkId);
        }

        bid.acceptedBlock = block.number;
        emit BidAccepted(phunkId, owner, bidder, bid.value, block.number);
    }
}
