// SPDX-License-Identifier: PHUNKY

/** EtherPhunksMarketV3.sol *
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
   ∬  CHANGELOG V3:                       ∬
   ========================================
   ∬  + 3.67% royalties (adjustable bps)  ∬
   ∬  + Configurable royalty receiver      ∬
   ∬  + On-chain points (try/catch)        ∬
   ∬  + Fresh proxy (not upgrade from V2)  ∬
   ====================================== */

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./interfaces/IPoints.sol";
import "./EthscriptionsEscrower.sol";

contract EtherPhunksMarketV3 is
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

    // V3: Royalties
    uint256 public royaltyBps;
    address payable public royaltyReceiver;

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

    event RoyaltyBpsChanged(uint256 oldBps, uint256 newBps);
    event RoyaltyReceiverChanged(address indexed oldReceiver, address indexed newReceiver);

    function initialize(
        uint256 _contractVersion,
        address _pointsAddress,
        uint256 _royaltyBps,
        address payable _royaltyReceiver
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_royaltyBps <= 1000, "Max 10%");
        require(_royaltyReceiver != address(0), "Invalid receiver");

        contractVersion = _contractVersion;
        pointsAddress = _pointsAddress;
        royaltyBps = _royaltyBps;
        royaltyReceiver = _royaltyReceiver;
    }

    // =========================================================
    // Listing
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
    // Buying (with royalties)
    // =========================================================

    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal virtual {
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

        // Calculate royalty
        uint royalty = (minSalePriceInWei * royaltyBps) / 10000;
        uint sellerAmount = minSalePriceInWei - royalty;

        pendingWithdrawals[seller] += sellerAmount;
        if (royalty > 0 && royaltyReceiver != address(0)) {
            (bool sent, ) = royaltyReceiver.call{value: royalty}("");
            require(sent, "Royalty transfer failed");
        }

        _addPoints(msg.sender, 100);
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
    // Withdrawals
    // =========================================================

    function withdraw() public nonReentrant {
        require(pendingWithdrawals[msg.sender] != 0, "No pending withdrawals");

        uint amount = pendingWithdrawals[msg.sender];
        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");
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

    fallback() external {
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
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(owner, amount) {} catch {}
        }
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
        address oldPointsAddress = pointsAddress;
        pointsAddress = _pointsAddress;
        emit PointsAddressChanged(oldPointsAddress, _pointsAddress);
    }

    function setRoyaltyBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        uint256 oldBps = royaltyBps;
        royaltyBps = _bps;
        emit RoyaltyBpsChanged(oldBps, _bps);
    }

    function setRoyaltyReceiver(address payable _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid receiver");
        address oldReceiver = royaltyReceiver;
        royaltyReceiver = _receiver;
        emit RoyaltyReceiverChanged(oldReceiver, _receiver);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
