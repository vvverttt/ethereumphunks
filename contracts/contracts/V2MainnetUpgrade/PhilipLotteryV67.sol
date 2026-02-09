// SPDX-License-Identifier: PHUNKY

/*********** PhilipLotteryV67 *
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

import "./EthscriptionsEscrower.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PhilipLotteryV67 is EthscriptionsEscrower, Ownable, Pausable, ReentrancyGuard {

    uint256 public playPrice;
    uint256 public totalPlays;
    bool public active;

    bytes32[] private _prizePool;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;

    event LotteryPlayed(
        uint256 indexed playId,
        address indexed player,
        uint256 price,
        uint256 randomSeed
    );

    event PrizeAwarded(
        uint256 indexed playId,
        address indexed winner,
        bytes32 indexed hashId
    );

    event PrizeDeposited(bytes32 indexed hashId, address indexed depositor);
    event PrizeWithdrawn(bytes32 indexed hashId);
    event PriceSet(uint256 newPrice);
    event ActiveToggled(bool active);

    constructor(uint256 _playPrice) Ownable(msg.sender) {
        playPrice = _playPrice;
        active = true;
    }

    // =========================================================
    // Ethscription Deposits (owner sends ethscriptions here)
    // =========================================================

    fallback() external {
        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal override {
        require(previousOwner == owner(), "Only owner can deposit");
        require(userCalldata.length > 0 && userCalldata.length % 32 == 0, "Invalid length");

        for (uint256 i = 0; i < userCalldata.length / 32; i++) {
            bytes32 hashId = abi.decode(userCalldata[i * 32 : (i + 1) * 32], (bytes32));

            require(!inPool[hashId], "Already in pool");

            // Record in escrow storage (tracks block number for cooldown)
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                previousOwner
            ][hashId] = block.number;

            // Add to prize pool
            _prizePool.push(hashId);
            inPool[hashId] = true;
            depositor[hashId] = previousOwner;

            emit PrizeDeposited(hashId, previousOwner);
        }
    }

    // =========================================================
    // Play (pay fee, win random ethscription)
    // =========================================================

    function play() external payable nonReentrant whenNotPaused {
        require(active, "Lottery inactive");
        require(msg.value >= playPrice, "Insufficient payment");
        require(_prizePool.length > 0, "No prizes available");

        totalPlays++;

        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.prevrandao,
            block.timestamp,
            totalPlays,
            msg.sender
        )));

        uint256 winIndex = randomSeed % _prizePool.length;
        bytes32 wonHashId = _prizePool[winIndex];
        address dep = depositor[wonHashId];

        // Remove from pool (swap with last, then pop)
        _prizePool[winIndex] = _prizePool[_prizePool.length - 1];
        _prizePool.pop();
        inPool[wonHashId] = false;
        delete depositor[wonHashId];

        // Transfer ethscription to winner via escrower protocol event
        _transferEthscription(dep, msg.sender, wonHashId);

        emit LotteryPlayed(totalPlays, msg.sender, msg.value, randomSeed);
        emit PrizeAwarded(totalPlays, msg.sender, wonHashId);

        // Refund excess payment
        if (msg.value > playPrice) {
            (bool sent, ) = payable(msg.sender).call{value: msg.value - playPrice}("");
            require(sent, "Refund failed");
        }
    }

    // =========================================================
    // View Functions
    // =========================================================

    function poolSize() external view returns (uint256) {
        return _prizePool.length;
    }

    function getPoolItems(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        uint256 end = offset + limit;
        if (end > _prizePool.length) end = _prizePool.length;
        if (offset >= _prizePool.length) return new bytes32[](0);

        bytes32[] memory items = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            items[i - offset] = _prizePool[i];
        }
        return items;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // =========================================================
    // Owner Functions
    // =========================================================

    function setPrice(uint256 _price) external onlyOwner {
        playPrice = _price;
        emit PriceSet(_price);
    }

    function setActive(bool _active) external onlyOwner {
        active = _active;
        emit ActiveToggled(_active);
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    function withdrawPrize(bytes32 hashId) external onlyOwner {
        require(inPool[hashId], "Not in pool");

        // Find and remove from array
        for (uint256 i = 0; i < _prizePool.length; i++) {
            if (_prizePool[i] == hashId) {
                _prizePool[i] = _prizePool[_prizePool.length - 1];
                _prizePool.pop();
                break;
            }
        }
        inPool[hashId] = false;

        // Transfer back to owner
        _transferEthscription(owner(), owner(), hashId);

        emit PrizeWithdrawn(hashId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
