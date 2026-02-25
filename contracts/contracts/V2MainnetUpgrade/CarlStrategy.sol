// SPDX-License-Identifier: PHUNKY

/********* CarlStrategy.sol *
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

pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract CarlStrategy is Ownable, ReentrancyGuard, IERC721Receiver {

    address public constant CRYPTO_PHUNKS_V2 = 0xf07468eAd8cf26c752C676E43C814FEe9c8CF402;

    address payable public forwardAddress;
    uint256 public treasuryBps; // basis points kept in treasury (out of 10000)
    uint256 public bidPrice;    // price Carl pays for any V2 Phunk

    event Received(uint256 amount, uint256 keptForTreasury, uint256 forwarded);
    event PhunkSoldToCarl(uint256 indexed tokenId, address indexed seller, uint256 price);
    event PhunkWithdrawn(uint256 indexed tokenId, address to);
    event BidPriceSet(uint256 price);
    event TreasurySplitUpdated(uint256 treasuryBps);
    event ForwardAddressUpdated(address newAddress);
    event ETHWithdrawn(uint256 amount, address to);

    constructor(
        address payable _forwardAddress,
        uint256 _treasuryBps
    ) Ownable(msg.sender) {
        require(_treasuryBps <= 10000, "Invalid bps");
        forwardAddress = _forwardAddress;
        treasuryBps = _treasuryBps;
    }

    /// @notice Receives ETH from Market revShare, splits between treasury and forward address
    receive() external payable {
        uint256 keepAmount = msg.value * treasuryBps / 10000;
        uint256 forwardAmount = msg.value - keepAmount;

        if (forwardAmount > 0 && forwardAddress != address(0)) {
            (bool sent, ) = forwardAddress.call{value: forwardAmount}("");
            require(sent, "Forward failed");
        }

        emit Received(msg.value, keepAmount, forwardAmount);
    }

    /// @notice Sell your V2 CryptoPhunk to Carl at the current bid price
    /// @dev Seller must approve this contract first via CryptoPhunksV2.approve() or setApprovalForAll()
    /// @param tokenId The V2 Phunk token ID to sell
    function sellToCarl(uint256 tokenId) external nonReentrant {
        require(bidPrice > 0, "Bidding paused");
        require(address(this).balance >= bidPrice, "Insufficient funds");

        // Pull the V2 Phunk from seller
        IERC721(CRYPTO_PHUNKS_V2).safeTransferFrom(msg.sender, address(this), tokenId);

        // Pay the seller
        (bool sent, ) = payable(msg.sender).call{value: bidPrice}("");
        require(sent, "Payment failed");

        emit PhunkSoldToCarl(tokenId, msg.sender, bidPrice);
    }

    /// @notice Set the price Carl offers for any V2 Phunk. Set to 0 to pause.
    function setBidPrice(uint256 _price) external onlyOwner {
        bidPrice = _price;
        emit BidPriceSet(_price);
    }

    /// @notice Withdraw a V2 Phunk NFT from Carl
    function withdrawPhunk(uint256 tokenId, address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        IERC721(CRYPTO_PHUNKS_V2).safeTransferFrom(address(this), to, tokenId);
        emit PhunkWithdrawn(tokenId, to);
    }

    /// @notice Withdraw ETH from Carl
    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        emit ETHWithdrawn(amount, to);
    }

    function setTreasuryBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10000, "Invalid bps");
        treasuryBps = _bps;
        emit TreasurySplitUpdated(_bps);
    }

    function setForwardAddress(address payable _addr) external onlyOwner {
        forwardAddress = _addr;
        emit ForwardAddressUpdated(_addr);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPhunkBalance() external view returns (uint256) {
        return IERC721(CRYPTO_PHUNKS_V2).balanceOf(address(this));
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
