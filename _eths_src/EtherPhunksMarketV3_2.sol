// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV3_2.sol *
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
   ∬  V3_2: 3-step bid functions          ∬
   ========================================
   ∬  + enterBid    (bidder locks ETH)    ∬
   ∬  + withdrawBid (bidder cancels)      ∬
   ∬  + acceptBid   (owner accepts)       ∬
   ∬  + confirmBid  (bidder confirms      ∬
   ∬                 after 5-block cool)  ∬
   ∬  Bid storage appended after V3_1     ∬
   ∬  No changes to V3_1 logic            ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EtherPhunksMarketV3_1.sol";

contract EtherPhunksMarketV3_2 is EtherPhunksMarketV3_1 {

    /// @notice Fresh-deploy initializer (used by tests + fresh proxies only).
    /// In production, V3_2 is deployed as an UPGRADE over the existing V3_1 proxy
    /// at 0xa48a..., which already has state initialized — do NOT call this on
    /// upgrade. The `initializer` modifier guards against double-init.
    function initialize(uint256 _contractVersion, address _pointsAddress) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        contractVersion = _contractVersion;
        pointsAddress = _pointsAddress;
    }

    // ─── New storage (appended after V3_1 state) ───
    struct Bid {
        bool hasBid;
        address bidder;
        uint256 value;
        uint256 acceptedBlock; // 0 = not yet accepted
    }
    mapping(address => mapping(bytes32 => Bid)) public bids;

    event BidEntered(bytes32 indexed phunkId, address indexed owner, address indexed bidder, uint256 value);
    event BidWithdrawn(bytes32 indexed phunkId, address indexed owner, address indexed bidder, uint256 value);
    event BidAccepted(bytes32 indexed phunkId, address indexed owner, address indexed bidder, uint256 value, uint256 acceptedBlock);
    event BidConfirmed(bytes32 indexed phunkId, address indexed owner, address indexed bidder, uint256 value);
    event BidRefunded(bytes32 indexed phunkId, address indexed owner, address indexed bidder, uint256 value);

    // Step 1: bidder creates bid against a specific (owner, phunkId).
    // If a lower bid exists, it is auto-refunded to its bidder via pendingWithdrawals.
    function enterBid(bytes32 phunkId, address currentOwner) external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Bid > 0");
        require(currentOwner != address(0), "Invalid owner");
        require(currentOwner != msg.sender, "No self-bid");

        Bid memory existing = bids[currentOwner][phunkId];
        if (existing.hasBid) {
            require(existing.acceptedBlock == 0, "Bid accepted, locked");
            require(msg.value > existing.value, "Must exceed existing bid");
            pendingWithdrawals[existing.bidder] += existing.value;
            emit BidWithdrawn(phunkId, currentOwner, existing.bidder, existing.value);
        }

        bids[currentOwner][phunkId] = Bid(true, msg.sender, msg.value, 0);
        emit BidEntered(phunkId, currentOwner, msg.sender, msg.value);
    }

    // Bidder cancels their bid (only if not yet accepted).
    function withdrawBid(bytes32 phunkId, address currentOwner) external nonReentrant {
        Bid memory bid = bids[currentOwner][phunkId];
        require(bid.hasBid, "No bid");
        require(bid.bidder == msg.sender, "Not bidder");
        require(bid.acceptedBlock == 0, "Bid accepted, cannot withdraw");

        delete bids[currentOwner][phunkId];
        pendingWithdrawals[msg.sender] += bid.value;
        emit BidWithdrawn(phunkId, currentOwner, msg.sender, bid.value);
    }

    // Step 2: owner accepts bid. Ethscription must already be in escrow.
    // Any active listing on this phunk is auto-invalidated to prevent double-sale.
    function acceptBid(bytes32 phunkId, address bidder, uint256 minValue) external whenNotPaused nonReentrant {
        Bid storage bid = bids[msg.sender][phunkId];
        require(bid.hasBid, "No bid");
        require(bid.bidder == bidder, "Bidder mismatch");
        require(bid.acceptedBlock == 0, "Already accepted");
        require(bid.value >= minValue, "Below minValue");

        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        if (phunksOfferedForSale[phunkId].isForSale) {
            _invalidateListing(phunkId);
            emit PhunkNoLongerForSale(phunkId);
        }

        bid.acceptedBlock = block.number;
        emit BidAccepted(phunkId, msg.sender, bidder, bid.value, block.number);
    }

    // Step 3: bidder confirms after 5-block cooldown — atomic swap executes.
    // Defensive: if owner moved the Ethscription out post-accept, bidder is refunded.
    function confirmBid(bytes32 phunkId, address currentOwner) external whenNotPaused nonReentrant {
        Bid memory bid = bids[currentOwner][phunkId];
        require(bid.hasBid, "No bid");
        require(bid.bidder == msg.sender, "Not bidder");
        require(bid.acceptedBlock != 0, "Not accepted yet");
        require(block.number >= bid.acceptedBlock + ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS, "Cooldown active");

        delete bids[currentOwner][phunkId];

        if (userEthscriptionDefinitelyNotStored(currentOwner, phunkId)) {
            pendingWithdrawals[msg.sender] += bid.value;
            emit BidRefunded(phunkId, currentOwner, msg.sender, bid.value);
            return;
        }

        uint256 royalty = 0;
        if (royaltyBps > 0 && royaltyReceivers.length > 0) {
            royalty = (bid.value * royaltyBps) / 10000;
        }
        uint256 sellerAmount = bid.value - royalty;

        pendingWithdrawals[currentOwner] += sellerAmount;

        if (royalty > 0) {
            for (uint i = 0; i < royaltyReceivers.length; i++) {
                uint share = (royalty * royaltyReceivers[i].share) / 10000;
                if (share > 0) {
                    (bool sent,) = royaltyReceivers[i].receiver.call{value: share}("");
                    require(sent, "Royalty failed");
                }
            }
        }

        _transferEthscription(currentOwner, msg.sender, phunkId);
        _addPoints(msg.sender, 67);

        emit BidConfirmed(phunkId, currentOwner, msg.sender, bid.value);
    }
}
