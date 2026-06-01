// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV3_1.sol *
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
   ∬  V3_1: Match forked V2_1 behavior    ∬
   ========================================
   ∬  + Royalties (direct send, not pull)  ∬
   ∬  + Updated points to buyer            ∬
   ∬  + Removed unnecessary bloat          ∬
   ====================================== */

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./interfaces/IPoints.sol";
import "./EthscriptionsEscrower.sol";

contract EtherPhunksMarketV3_1 is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EthscriptionsEscrower
{
    bytes32 constant DEPOSIT_AND_LIST_SIGNATURE = keccak256("DEPOSIT_AND_LIST_SIGNATURE");

    uint256 public contractVersion;
    address public pointsAddress;

    struct Offer {
        bool isForSale;
        bytes32 phunkId;
        address seller;
        uint minValue;
        address onlySellTo;
    }

    mapping(bytes32 => Offer) public phunksOfferedForSale;
    mapping(address => uint) public pendingWithdrawals;

    // Royalties (storage layout must match V3 for first two slots)
    uint256 public royaltyBps;
    address payable public __deprecated_royaltyReceiver;

    // V3_1: Multiple royalty receivers
    struct RoyaltyReceiver {
        address payable receiver;
        uint256 share; // out of 10000 (e.g. 5000 = 50% of the royalty)
    }
    RoyaltyReceiver[] public royaltyReceivers;

    event PhunkOffered(
        bytes32 indexed phunkId,
        uint minValue,
        address indexed toAddress
    );

    event PhunkBought(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress,
        address indexed toAddress
    );

    event PhunkNoLongerForSale(
        bytes32 indexed phunkId
    );

    event PointsAddressChanged(
        address indexed oldPointsAddress,
        address indexed newPointsAddress
    );

    // =========================================================
    // Listing (matches V2_1 behavior)
    // =========================================================

    function offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) external nonReentrant {
        _offerPhunkForSale(phunkId, minSalePriceInWei);
    }

    function batchOfferPhunkForSale(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external nonReentrant {
        require(phunkIds.length == minSalePricesInWei.length, "Lengths mismatch");
        for (uint i = 0; i < phunkIds.length; i++) {
            _offerPhunkForSale(phunkIds[i], minSalePricesInWei[i]);
        }
    }

    function offerPhunkForSaleToAddress(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address toAddress
    ) public nonReentrant {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            toAddress
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, toAddress);
    }

    function _offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            address(0x0)
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, address(0x0));
    }

    function phunkNoLongerForSale(bytes32 phunkId) external {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        _invalidateListing(phunkId);
        emit PhunkNoLongerForSale(phunkId);
    }

    // =========================================================
    // Buying (royalties sent directly, like V2_1 revShare)
    // =========================================================

    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        Offer memory offer = phunksOfferedForSale[phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender &&
            msg.value >= minSalePriceInWei,
            "Invalid sale conditions"
        );

        uint royalty = 0;
        if (royaltyBps > 0 && royaltyReceivers.length > 0) {
            royalty = (minSalePriceInWei * royaltyBps) / 10000;
        }
        uint sellerAmount = minSalePriceInWei - royalty;

        _invalidateListing(phunkId);

        address seller = offer.seller;

        pendingWithdrawals[seller] += sellerAmount;

        if (royalty > 0) {
            for (uint i = 0; i < royaltyReceivers.length; i++) {
                uint share = (royalty * royaltyReceivers[i].share) / 10000;
                if (share > 0) {
                    (bool sent,) = royaltyReceivers[i].receiver.call{value: share}("");
                    require(sent, "Royalty transfer failed");
                }
            }
        }

        _addPoints(msg.sender, 67);
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(phunkId, minSalePriceInWei, seller, msg.sender);
    }

    function batchBuyPhunk(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external payable whenNotPaused nonReentrant {
        require(phunkIds.length == minSalePricesInWei.length, "Lengths mismatch");

        uint totalSalePrice = 0;
        for (uint i = 0; i < phunkIds.length; i++) {
            _buyPhunk(phunkIds[i], minSalePricesInWei[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        require(msg.value == totalSalePrice, "Incorrect Ether amount");
    }

    // =========================================================
    // Withdrawals (matches V2_1)
    // =========================================================

    function withdraw() public nonReentrant {
        require(pendingWithdrawals[msg.sender] != 0, "No pending withdrawals");

        uint amount = pendingWithdrawals[msg.sender];

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");

        pendingWithdrawals[msg.sender] = 0;
    }

    function withdrawPhunk(bytes32 phunkId) public {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        super.withdrawEthscription(phunkId);

        Offer memory offer = phunksOfferedForSale[phunkId];
        if (offer.isForSale) {
            _invalidateListing(phunkId);
            emit PhunkNoLongerForSale(phunkId);
        }
    }

    function withdrawBatchPhunks(bytes32[] calldata phunkIds) external {
        for (uint i = 0; i < phunkIds.length; i++) {
            withdrawPhunk(phunkIds[i]);
        }
    }

    // =========================================================
    // Deposits (fallback)
    // =========================================================

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal override {
        require(userCalldata.length % 32 == 0, "Invalid ethscription length");

        for (uint256 i = 0; i < userCalldata.length / 32; i++) {
            bytes32 potentialEthscriptionId = abi.decode(slice(userCalldata, i * 32, 32), (bytes32));

            if (userEthscriptionPossiblyStored(previousOwner, potentialEthscriptionId)) {
                revert EthscriptionAlreadyReceivedFromSender();
            }

            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                previousOwner
            ][potentialEthscriptionId] = block.number;
        }
    }

    function _onPotentialSingleEthscriptionDeposit(
        address previousOwner,
        bytes32 phunkId
    ) internal {
        if (userEthscriptionPossiblyStored(previousOwner, phunkId)) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][phunkId] = block.number;
    }

    fallback() external virtual {
        require(!paused(), "Contract is paused");

        bytes32 signature;
        assembly {
            signature := calldataload(32)
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

    receive() external payable {
        require(!paused(), "Contract is paused");
    }

    // =========================================================
    // Internal helpers
    // =========================================================

    function _invalidateListing(bytes32 phunkId) internal {
        delete phunksOfferedForSale[phunkId];
    }

    function _addPoints(address owner, uint256 amount) internal {
        try IPoints(pointsAddress).addPoints(owner, amount) {} catch {}
    }

    function slice(
        bytes memory data,
        uint256 start,
        uint256 len
    ) internal pure returns (bytes memory) {
        bytes memory b = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            b[i] = data[i + start];
        }
        return b;
    }

    // =========================================================
    // Owner functions
    // =========================================================

    function setPointsAddress(address _pointsAddress) public onlyOwner {
        require(_pointsAddress != address(0), "Invalid address");

        address oldPointsAddress = pointsAddress;
        pointsAddress = _pointsAddress;

        emit PointsAddressChanged(oldPointsAddress, _pointsAddress);
    }

    function setRoyaltyBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        royaltyBps = _bps;
    }

    function setRoyaltyReceivers(
        address payable[] calldata _receivers,
        uint256[] calldata _shares
    ) external onlyOwner {
        require(_receivers.length == _shares.length, "Length mismatch");

        uint256 totalShares = 0;
        for (uint i = 0; i < _shares.length; i++) {
            require(_receivers[i] != address(0), "Invalid address");
            totalShares += _shares[i];
        }
        require(totalShares == 10000, "Shares must total 10000");

        delete royaltyReceivers;
        for (uint i = 0; i < _receivers.length; i++) {
            royaltyReceivers.push(RoyaltyReceiver(_receivers[i], _shares[i]));
        }
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
