// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import "./EthscriptionsEscrower.sol";

/**
 * @title IttybitsMarket
 * @dev Marketplace for trading Ittybits
 *
 * IMPORTANT: This contract allows any address to escrow any Ittybit ID, including IDs they don't
 * actually own according to the Ittybits indexer. This is by design, as smart contracts cannot
 * verify off-chain indexer state. The contract emits the proper events so that the Ittybits
 * protocol's indexer can determine valid transfers.
 *
 * UI implementations MUST filter listings to only show those where:
 * 1. The Ittybit ID exists
 * 2. The contract address actually owns the Ittybit according to the indexer
 * 3. The lister was the one who actually deposited the valid Ittybit
 */
contract IttybitsMarket is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EthscriptionsEscrower
{
    bytes32 constant DEPOSIT_AND_LIST_SIGNATURE = keccak256("DEPOSIT_AND_LIST_SIGNATURE");

    uint256 public contractVersion;
    address public royaltyReceiver;
    uint256 public royaltyFeeBps; // e.g. 500 = 5%
    uint256 public totalActiveBids; // Track total ETH locked in active bids

    struct Offer {
        bool isForSale;
        bytes32 ittybitId;
        uint minValue;
        address onlySellTo;
    }
    
    struct Bid {
        bool hasBid;
        bytes32 ittybitId;
        address bidder;
        uint value;
    }

    // Updated to double mapping: ittybitId => seller => Offer
    // This allows multiple sellers to list the same Ittybit ID
    mapping(bytes32 => mapping(address => Offer)) public ittybitsOfferedForSale;
    
    // Simplified to one bid per ittybit/seller combination
    // ittybitId => targetSeller => Bid
    mapping(bytes32 => mapping(address => Bid)) public ittybitBids;

    event IttybitOffered(bytes32 indexed ittybitId, uint minValue, address indexed toAddress);
    event IttybitBought(bytes32 indexed ittybitId, uint value, address indexed fromAddress, address indexed toAddress);
    event IttybitNoLongerForSale(bytes32 indexed ittybitId);
    event IttybitBidEntered(bytes32 indexed ittybitId, uint value, address indexed bidder, address indexed targetSeller);
    event IttybitBidWithdrawn(bytes32 indexed ittybitId, uint value, address indexed bidder, address indexed targetSeller);
    event IttybitBidAccepted(bytes32 indexed ittybitId, uint value, address indexed fromAddress, address indexed toAddress);
    event IttybitBidRefunded(bytes32 indexed ittybitId, uint value, address indexed bidder, address indexed targetSeller);
    event RoyaltiesUpdated(address indexed receiver, uint256 feeBps);

    function initialize(uint256 _contractVersion, address _royaltyReceiver, uint256 _royaltyFeeBps, address _owner) public initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();

        contractVersion = _contractVersion;
        royaltyReceiver = _royaltyReceiver;
        royaltyFeeBps = _royaltyFeeBps;
    }

    // Modifier to ensure only EOAs can interact (prevents contract griefing)
    modifier onlyEOA() {
        require(tx.origin == msg.sender, "Only EOA allowed");
        _;
    }

    function offerIttybitForSale(bytes32 ittybitId, uint minSalePriceInWei) external nonReentrant {
        _offerIttybitForSale(ittybitId, minSalePriceInWei);
    }

    function batchOfferIttybitsForSale(bytes32[] calldata ittybitIds, uint[] calldata minSalePricesInWei) external nonReentrant {
        require(ittybitIds.length == minSalePricesInWei.length, "Lengths mismatch");
        for (uint i = 0; i < ittybitIds.length; i++) {
            _offerIttybitForSale(ittybitIds[i], minSalePricesInWei[i]);
        }
    }

    function offerIttybitForSaleToAddress(bytes32 ittybitId, uint minSalePriceInWei, address toAddress) public nonReentrant {
        if (userEthscriptionDefinitelyNotStored(msg.sender, ittybitId)) revert EthscriptionNotDeposited();

        ittybitsOfferedForSale[ittybitId][msg.sender] = Offer(true, ittybitId, minSalePriceInWei, toAddress);
        emit IttybitOffered(ittybitId, minSalePriceInWei, toAddress);
    }

    function _offerIttybitForSale(bytes32 ittybitId, uint minSalePriceInWei) internal {
        // This only checks if the user has deposited the ittybit ID
        // It doesn't validate if they actually own it according to the indexer
        // UI must filter invalid listings where depositors don't actually own the Ittybit
        if (userEthscriptionDefinitelyNotStored(msg.sender, ittybitId)) revert EthscriptionNotDeposited();

        ittybitsOfferedForSale[ittybitId][msg.sender] = Offer(true, ittybitId, minSalePriceInWei, address(0));
        emit IttybitOffered(ittybitId, minSalePriceInWei, address(0));
    }

    function ittybitNoLongerForSale(bytes32 ittybitId) external {
        _ittybitNoLongerForSale(ittybitId);
    }
    
    function _ittybitNoLongerForSale(bytes32 ittybitId) internal {
        if (userEthscriptionDefinitelyNotStored(msg.sender, ittybitId)) revert EthscriptionNotDeposited();
        _invalidateListing(ittybitId, msg.sender);
        emit IttybitNoLongerForSale(ittybitId);
    }

    function buyIttybit(bytes32 ittybitId, uint minSalePriceInWei, address seller) external payable whenNotPaused nonReentrant {
        _buyIttybit(ittybitId, minSalePriceInWei, seller);
    }

    function batchBuyIttybits(bytes32[] calldata ittybitIds, uint[] calldata minSalePricesInWei, address[] calldata sellers) external payable whenNotPaused nonReentrant {
        require(ittybitIds.length == minSalePricesInWei.length, "Lengths mismatch");
        require(ittybitIds.length == sellers.length, "Lengths mismatch");

        uint totalSalePrice = 0;
        for (uint i = 0; i < ittybitIds.length; i++) {
            _buyIttybit(ittybitIds[i], minSalePricesInWei[i], sellers[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        require(msg.value == totalSalePrice, "Incorrect Ether amount");
    }

    function _buyIttybit(bytes32 ittybitId, uint minSalePriceInWei, address seller) internal {
        Offer memory offer = ittybitsOfferedForSale[ittybitId][seller];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            seller != msg.sender &&
            msg.value >= minSalePriceInWei,
            "Invalid sale conditions"
        );

        uint royaltyAmount = (minSalePriceInWei * royaltyFeeBps) / 10000;
        uint sellerAmount = minSalePriceInWei - royaltyAmount;

        _invalidateListing(ittybitId, seller);

        // Refund any active bid on this ittybit before sending payment to seller
        _refundActiveBid(ittybitId, seller);

        // Directly send ETH to the seller instead of storing in pendingWithdrawals
        if (sellerAmount > 0) {
            (bool sent, ) = payable(seller).call{value: sellerAmount}("");
            require(sent, "Failed to send ETH to seller");
        }

        // The royalty amount remains in the contract for royaltyReceiver to withdraw later

        // This emits the transfer event that the indexer will use
        // If multiple people deposited the same ID, only transfers by the actual owner
        // will be recognized as valid by the indexer
        _transferEthscription(seller, msg.sender, ittybitId);
        emit IttybitBought(ittybitId, minSalePriceInWei, seller, msg.sender);
    }

    // Bidding functionality
    
    function enterBidForIttybit(bytes32 ittybitId, address targetSeller) external payable onlyEOA whenNotPaused nonReentrant {
        _enterBidForIttybit(ittybitId, targetSeller, msg.value);
    }
    
    function batchEnterBidsForIttybits(
        bytes32[] calldata ittybitIds, 
        address[] calldata targetSellers,
        uint[] calldata bidAmounts
    ) external payable onlyEOA whenNotPaused nonReentrant {
        require(ittybitIds.length == targetSellers.length, "Arrays length mismatch");
        require(ittybitIds.length == bidAmounts.length, "Arrays length mismatch");
        
        uint totalBidAmount = 0;
        for (uint i = 0; i < bidAmounts.length; i++) {
            totalBidAmount += bidAmounts[i];
        }
        require(msg.value == totalBidAmount, "Incorrect ETH amount");
        
        for (uint i = 0; i < ittybitIds.length; i++) {
            _enterBidForIttybit(ittybitIds[i], targetSellers[i], bidAmounts[i]);
        }
    }
    
    function _enterBidForIttybit(bytes32 ittybitId, address targetSeller, uint bidAmount) internal {
        require(bidAmount > 0, "Bid must be greater than zero");
        require(msg.sender != targetSeller, "Cannot bid on your own Ittybit");
        // Ensure the targeted seller currently has this ittybit escrowed in the contract
        if (userEthscriptionDefinitelyNotStored(targetSeller, ittybitId)) revert EthscriptionNotDeposited();
        
        // Check for existing bid on this ittybit/seller combination
        Bid memory existing = ittybitBids[ittybitId][targetSeller];
        
        // Require new bid to be higher than the existing bid
        if (existing.hasBid) {
            require(bidAmount > existing.value, "Bid must be higher than current bid");
            
            // Refund the previous bidder (this will decrease totalActiveBids)
            _refundBid(ittybitId, targetSeller, existing.bidder, existing.value);
        }
        
        // Record the new bid
        ittybitBids[ittybitId][targetSeller] = Bid(
            true,
            ittybitId,
            msg.sender,
            bidAmount
        );
        
        // Increase total active bids
        totalActiveBids += bidAmount;
        
        emit IttybitBidEntered(ittybitId, bidAmount, msg.sender, targetSeller);
    }
    
    function withdrawBidForIttybit(bytes32 ittybitId, address targetSeller) external nonReentrant {
        Bid memory bid = ittybitBids[ittybitId][targetSeller];
        
        // Only the bidder can withdraw their bid
        require(bid.hasBid && bid.bidder == msg.sender, "No bid to withdraw or not your bid");
        
        _refundBid(ittybitId, targetSeller, bid.bidder, bid.value);
        
        emit IttybitBidWithdrawn(ittybitId, bid.value, msg.sender, targetSeller);
    }
    
    function acceptBidForIttybit(bytes32 ittybitId, uint minPrice, address bidder) external nonReentrant {
        _acceptBidForIttybit(ittybitId, minPrice, bidder);
    }
    
    function _acceptBidForIttybit(bytes32 ittybitId, uint minPrice, address bidder) internal {
        // Require the ittybit is currently escrowed by the caller
        if (userEthscriptionDefinitelyNotStored(msg.sender, ittybitId)) revert EthscriptionNotDeposited();
        
        // Get the bid
        Bid memory bid = ittybitBids[ittybitId][msg.sender];
        
        // Verify this is the bid we expect to accept
        require(bid.hasBid, "No bid to accept");
        require(bid.bidder == bidder, "Bidder mismatch");
        require(bid.value >= minPrice, "Bid too low");
        
        address seller = msg.sender;
        uint bidValue = bid.value;
        
        // Calculate royalty and seller amount
        uint royaltyAmount = (bidValue * royaltyFeeBps) / 10000;
        uint sellerAmount = bidValue - royaltyAmount;
        
        // Clear the bid and decrease total active bids
        delete ittybitBids[ittybitId][seller];
        totalActiveBids -= bidValue;
        
        // Clear any listing
        if (ittybitsOfferedForSale[ittybitId][seller].isForSale) {
            _invalidateListing(ittybitId, seller);
        }
        
        // Send payment to seller
        if (sellerAmount > 0) {
            (bool sent, ) = payable(seller).call{value: sellerAmount}("");
            require(sent, "Failed to send ETH to seller");
        }
        
        // Transfer the Ittybit (escrowed by seller)
        _transferEthscription(seller, bidder, ittybitId);
        
        emit IttybitBidAccepted(ittybitId, bidValue, seller, bidder);
    }

    // Helper function to refund a bid
    function _refundBid(bytes32 ittybitId, address targetSeller, address bidder, uint amount) internal {
        // Clear the bid
        delete ittybitBids[ittybitId][targetSeller];
        
        // Decrease total active bids
        totalActiveBids -= amount;
        
        // Send the refund
        (bool sent, ) = payable(bidder).call{value: amount}("");
        require(sent, "Failed to refund bid");
        
        emit IttybitBidRefunded(ittybitId, amount, bidder, targetSeller);
    }
    
    // Helper function to refund an active bid if one exists
    function _refundActiveBid(bytes32 ittybitId, address seller) internal {
        Bid memory bid = ittybitBids[ittybitId][seller];
        if (bid.hasBid) {
            _refundBid(ittybitId, seller, bid.bidder, bid.value);
        }
    }

    // Modified withdraw function to only withdraw available ETH (excluding locked bids)
    function withdraw() public nonReentrant {
        require(msg.sender == royaltyReceiver, "Only royalty receiver can withdraw");
        
        uint contractBalance = address(this).balance;
        uint availableAmount = contractBalance - totalActiveBids;
        require(availableAmount > 0, "No available ETH to withdraw");

        (bool sent, ) = payable(royaltyReceiver).call{value: availableAmount}("");
        require(sent, "Failed to send Ether");
    }

    function withdrawIttybit(bytes32 ittybitId) public {
        if (userEthscriptionDefinitelyNotStored(msg.sender, ittybitId)) revert EthscriptionNotDeposited();
        
        // CRITICAL: Only refund bids where msg.sender is the target seller
        // This prevents the attack vector while maintaining storage compatibility
        _refundActiveBid(ittybitId, msg.sender);
        
        super.withdrawEthscription(ittybitId);

        // Only cancel the caller's own listing
        if (ittybitsOfferedForSale[ittybitId][msg.sender].isForSale) {
            _invalidateListing(ittybitId, msg.sender);
            emit IttybitNoLongerForSale(ittybitId);
        }
    }

    function withdrawBatchIttybits(bytes32[] calldata ittybitIds) external {
        for (uint i = 0; i < ittybitIds.length; i++) {
            withdrawIttybit(ittybitIds[i]);
        }
    }
    
    function batchAcceptBidsForIttybits(
        bytes32[] calldata ittybitIds,
        uint[] calldata minPrices,
        address[] calldata bidders
    ) external nonReentrant {
        require(ittybitIds.length == minPrices.length, "Arrays length mismatch");
        require(ittybitIds.length == bidders.length, "Arrays length mismatch");
        
        for (uint i = 0; i < ittybitIds.length; i++) {
            _acceptBidForIttybit(ittybitIds[i], minPrices[i], bidders[i]);
        }
    }
    
    function batchCancelListings(bytes32[] calldata ittybitIds) external {
        for (uint i = 0; i < ittybitIds.length; i++) {
            _ittybitNoLongerForSale(ittybitIds[i]);
        }
    }

    function _invalidateListing(bytes32 ittybitId, address seller) internal {
        delete ittybitsOfferedForSale[ittybitId][seller];
    }

    function setRoyalties(address _receiver, uint256 _feeBps) external onlyOwner {
        require(_receiver != address(0), "Invalid receiver");
        require(_feeBps <= 500, "Max 5%");
        royaltyReceiver = _receiver;
        royaltyFeeBps = _feeBps;
        emit RoyaltiesUpdated(_receiver, _feeBps);
    }

    fallback() external {
        require(!paused(), "Contract is paused");

        bytes32 signature;
        assembly {
            signature := calldataload(32)
        }

        if (signature == DEPOSIT_AND_LIST_SIGNATURE) {
            require(msg.data.length % 32 == 0, "InvalidEthscriptionLength");

            bytes32 ittybitId;
            bytes32 listingPrice;
            bytes32 toAddress;

            assembly {
                ittybitId := calldataload(0)
                listingPrice := calldataload(64)
                toAddress := calldataload(96)
            }

            if (toAddress != 0x0) {
                // Note: This accepts deposits from any address, including those who don't
                // actually own the Ittybit according to the indexer
                _onPotentialSingleEthscriptionDeposit(msg.sender, ittybitId);
                offerIttybitForSaleToAddress(ittybitId, uint256(listingPrice), address(uint160(uint256(toAddress))));
                return;
            }

            _onPotentialSingleEthscriptionDeposit(msg.sender, ittybitId);
            _offerIttybitForSale(ittybitId, uint256(listingPrice));
            return;
        }

        // Handle bulk deposits - check if calldata is multiple of 32 bytes
        if (msg.data.length % 32 == 0 && msg.data.length > 0) {
            uint256 numEthscriptions = msg.data.length / 32;
            for (uint256 i = 0; i < numEthscriptions; i++) {
                bytes32 potentialEthscriptionId;
                assembly {
                    potentialEthscriptionId := calldataload(mul(i, 32))
                }
                _onPotentialSingleEthscriptionDeposit(msg.sender, potentialEthscriptionId);
            }
            return;
        }
        
        // Fall back to original single deposit (though this should not be reached)
        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }

    receive() external payable {
        require(!paused(), "Contract is paused");
    }

    // Batch query functions for efficient data retrieval
    function getBatchBids(bytes32[] calldata ittybitIds, address[] calldata sellers) external view returns (Bid[] memory) {
        require(ittybitIds.length == sellers.length, "Arrays length mismatch");
        
        Bid[] memory results = new Bid[](ittybitIds.length);
        for (uint i = 0; i < ittybitIds.length; i++) {
            results[i] = ittybitBids[ittybitIds[i]][sellers[i]];
        }
        return results;
    }

    function getBatchListings(bytes32[] calldata ittybitIds, address[] calldata sellers) external view returns (Offer[] memory) {
        require(ittybitIds.length == sellers.length, "Arrays length mismatch");
        
        Offer[] memory results = new Offer[](ittybitIds.length);
        for (uint i = 0; i < ittybitIds.length; i++) {
            results[i] = ittybitsOfferedForSale[ittybitIds[i]][sellers[i]];
        }
        return results;
    }
} 
