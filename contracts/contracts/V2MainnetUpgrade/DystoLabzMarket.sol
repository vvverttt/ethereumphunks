// SPDX-License-Identifier: PHUNKY

/** DystoLabzMarket.sol *
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
   ∬  UPGRADE: DystoLabzMarket             ∬
   ========================================
   ∬  + Multi-receiver royalties            ∬
   ∬  + Each receiver has own bps           ∬
   ∬  + Total capped at 10%                 ∬
   ∬  + Direct ETH send to receivers        ∬
   ∬  + Owner can change receivers anytime   ∬
   ∬  + try/catch on points (safer)         ∬
   ∬  + setPointsAddress owner function     ∬
   ∬  + receive() for plain ETH             ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EtherPhunksMarket.sol";

contract DystoLabzMarket is EtherPhunksMarket {

    struct RoyaltyShare {
        address payable receiver;
        uint256 bps; // basis points from sale price (e.g., 367 = 3.67%)
    }

    // New storage (appended after V1 slots 0-4)
    RoyaltyShare[] internal _royaltyShares; // slot 5

    event RoyaltySharesUpdated(uint256 receiverCount, uint256 totalBps);
    event PointsAddressChanged(address indexed oldPointsAddress, address indexed newPointsAddress);

    function initializeRoyalties(
        uint256 _newVersion,
        address payable[] calldata _receivers,
        uint256[] calldata _bps
    ) public reinitializer(2) {
        contractVersion = _newVersion;
        _setRoyaltyShares(_receivers, _bps);
    }

    // =========================================================
    // Royalty queries
    // =========================================================

    function getRoyaltyShares() external view returns (RoyaltyShare[] memory) {
        return _royaltyShares;
    }

    function getRoyaltyShareCount() external view returns (uint256) {
        return _royaltyShares.length;
    }

    function getTotalRoyaltyBps() public view returns (uint256 total) {
        for (uint i = 0; i < _royaltyShares.length; i++) {
            total += _royaltyShares[i].bps;
        }
    }

    // =========================================================
    // Buying (with royalties)
    // =========================================================

    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal override {
        Offer memory offer = phunksOfferedForSale[phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender &&
            msg.value >= minSalePriceInWei,
            "Invalid sale conditions"
        );

        _invalidateListing(phunkId);

        address seller = offer.seller;

        // Distribute royalties
        uint totalRoyalty = _distributeRoyalties(minSalePriceInWei);
        uint sellerAmount = minSalePriceInWei - totalRoyalty;

        pendingWithdrawals[seller] += sellerAmount;

        _addPoints(msg.sender, 100);
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(phunkId, minSalePriceInWei, seller, msg.sender);

        // Refund buyer's existing bid if they had one
        Bid memory bid = phunkBids[phunkId];
        if (bid.bidder == msg.sender) {
            pendingWithdrawals[msg.sender] += bid.value;
            phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
        }
    }

    // =========================================================
    // Accept bid (with royalties)
    // =========================================================

    function acceptBidForPhunk(
        bytes32 phunkId,
        uint minPrice
    ) external override whenNotPaused nonReentrant {
        require(
            !userEthscriptionDefinitelyNotStored(msg.sender, phunkId),
            unicode"That's not your Phunk 🖕"
        );

        address seller = msg.sender;

        Bid memory bid = phunkBids[phunkId];
        address bidder = bid.bidder;

        require(
            bid.value != 0 &&
            bid.value >= minPrice &&
            seller != bidder,
            unicode"No Phunk for you 🖕"
        );

        phunksOfferedForSale[phunkId] = Offer(
            false,
            phunkId,
            bidder,
            0,
            address(0x0)
        );

        uint amount = bid.value;

        // Distribute royalties
        uint totalRoyalty = _distributeRoyalties(amount);
        uint sellerAmount = amount - totalRoyalty;

        pendingWithdrawals[seller] += sellerAmount;

        _addPoints(seller, 100);

        _transferEthscription(seller, bidder, phunkId);
        emit PhunkBought(phunkId, amount, seller, bidder);

        phunkBids[phunkId] = Bid(false, phunkId, address(0x0), 0);
    }

    // =========================================================
    // Royalty distribution
    // =========================================================

    function _distributeRoyalties(uint256 salePrice) internal returns (uint256 totalRoyalty) {
        for (uint i = 0; i < _royaltyShares.length; i++) {
            uint royalty = (salePrice * _royaltyShares[i].bps) / 10000;
            if (royalty > 0) {
                totalRoyalty += royalty;
                (bool sent, ) = _royaltyShares[i].receiver.call{value: royalty}("");
                require(sent, "Royalty transfer failed");
            }
        }
    }

    // =========================================================
    // Safer points (try/catch)
    // =========================================================

    function _addPoints(
        address owner,
        uint256 amount
    ) internal override {
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(owner, amount) {} catch {}
        }
    }

    // =========================================================
    // Owner functions
    // =========================================================

    function setRoyaltyShares(
        address payable[] calldata _receivers,
        uint256[] calldata _bps
    ) external onlyOwner {
        _setRoyaltyShares(_receivers, _bps);
    }

    function _setRoyaltyShares(
        address payable[] calldata _receivers,
        uint256[] calldata _bps
    ) internal {
        require(_receivers.length == _bps.length, "Lengths mismatch");
        require(_receivers.length <= 10, "Max 10 receivers");

        // Clear existing
        delete _royaltyShares;

        uint256 totalBps = 0;
        for (uint i = 0; i < _receivers.length; i++) {
            require(_receivers[i] != address(0), "Invalid receiver");
            require(_bps[i] > 0, "Bps must be > 0");
            totalBps += _bps[i];
            _royaltyShares.push(RoyaltyShare(_receivers[i], _bps[i]));
        }

        require(totalBps <= 1000, "Total royalty max 10%");
        emit RoyaltySharesUpdated(_receivers.length, totalBps);
    }

    function setPointsAddress(address _pointsAddress) public onlyOwner {
        address oldPointsAddress = pointsAddress;
        pointsAddress = _pointsAddress;
        emit PointsAddressChanged(oldPointsAddress, _pointsAddress);
    }

    // =========================================================
    // Receive ETH
    // =========================================================

    receive() external payable {
        require(!paused(), "Contract is paused");
    }
}
