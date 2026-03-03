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

/* ========================================
   ∬  PhilipLotteryV67 (Upgradeable)      ∬
   ========================================
   ∬  Upgradeable proxy (transparent)     ∬
   ∬  Hybrid push/pull refunds            ∬
   ∬  Batch withdraw (withdrawPrizeBatch) ∬
   ∬  Emergency ethscription recovery     ∬
   ∬  On-chain points (67 per play)       ∬
   ∬  No contract callers (tx.origin)     ∬
   ∬  Auto-send revenue to treasury       ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";
import "./interfaces/IPoints.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract PhilipLotteryV67 is
    Initializable,
    EthscriptionsEscrower,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    uint256 public playPrice;
    uint256 public totalPlays;
    bool public active;
    address public pointsAddress;
    address payable public treasuryAddress;

    bytes32[] private _prizePool;
    mapping(bytes32 => uint256) private _poolIndex;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;
    mapping(address => uint256) public playerPlays;
    bytes32 private _lastRandomHash;

    // Hybrid push/pull refunds
    mapping(address => uint256) public pendingReturns;

    // ─── Events ──────────────────────────────────────────────

    event LotteryPlayed(
        uint256 indexed playId,
        address indexed player,
        uint256 price
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
    event TreasuryAddressChanged(address indexed oldAddress, address indexed newAddress);
    event PointsAddressChanged(address indexed oldAddress, address indexed newAddress);

    // ─── Constructor & Initializer ───────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _playPrice,
        address _pointsAddress,
        address payable _treasuryAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_treasuryAddress != address(0), "Invalid treasury");
        playPrice = _playPrice;
        pointsAddress = _pointsAddress;
        treasuryAddress = _treasuryAddress;
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

            require(hashId != bytes32(0), "Invalid hashId");
            require(!inPool[hashId], "Already in pool");

            // Record in escrow storage (set to 1 so cooldown is always satisfied)
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                previousOwner
            ][hashId] = 1;

            // Add to prize pool
            _poolIndex[hashId] = _prizePool.length;
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
        require(msg.sender == tx.origin, "No contracts");
        require(active, "Lottery inactive");
        require(msg.value >= playPrice, "Insufficient payment");
        require(_prizePool.length > 0, "No prizes available");

        totalPlays++;
        playerPlays[msg.sender]++;

        // Award points on-chain
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(msg.sender, 67) {} catch {}
        }

        bytes32 randomHash = keccak256(abi.encodePacked(
            _lastRandomHash,
            block.prevrandao,
            block.timestamp,
            block.basefee,
            blockhash(block.number - 1),
            totalPlays,
            msg.sender,
            gasleft()
        ));
        _lastRandomHash = randomHash;
        uint256 winIndex = uint256(randomHash) % _prizePool.length;
        bytes32 wonHashId = _prizePool[winIndex];
        address dep = depositor[wonHashId];

        // Remove from pool (swap with last, then pop)
        bytes32 lastHash = _prizePool[_prizePool.length - 1];
        _prizePool[winIndex] = lastHash;
        _poolIndex[lastHash] = winIndex;
        _prizePool.pop();
        inPool[wonHashId] = false;
        delete depositor[wonHashId];
        delete _poolIndex[wonHashId];

        // Transfer ethscription to winner via escrower protocol event
        _transferEthscription(dep, msg.sender, wonHashId);

        emit LotteryPlayed(totalPlays, msg.sender, msg.value);
        emit PrizeAwarded(totalPlays, msg.sender, wonHashId);

        // Send play price to treasury (hybrid: fallback to pendingReturns)
        (bool sent, ) = treasuryAddress.call{value: playPrice}("");
        if (!sent) {
            pendingReturns[treasuryAddress] += playPrice;
        }

        // Refund excess payment (hybrid: fallback to pendingReturns)
        if (msg.value > playPrice) {
            (bool refundSent, ) = payable(msg.sender).call{value: msg.value - playPrice}("");
            if (!refundSent) {
                pendingReturns[msg.sender] += msg.value - playPrice;
            }
        }
    }

    // =========================================================
    // Pull payment (withdraw failed refunds)
    // =========================================================

    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
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
        require(_price > 0, "Price must be > 0");
        playPrice = _price;
        emit PriceSet(_price);
    }

    function setActive(bool _active) external onlyOwner {
        active = _active;
        emit ActiveToggled(_active);
    }

    function setPointsAddress(address _pointsAddress) external onlyOwner {
        address oldAddress = pointsAddress;
        pointsAddress = _pointsAddress;
        emit PointsAddressChanged(oldAddress, _pointsAddress);
    }

    function setTreasuryAddress(address payable _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        address oldAddress = treasuryAddress;
        treasuryAddress = _treasuryAddress;
        emit TreasuryAddressChanged(oldAddress, _treasuryAddress);
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    // =========================================================
    // Prize withdrawal (single + batch)
    // =========================================================

    function withdrawPrize(bytes32 hashId) external onlyOwner nonReentrant {
        require(inPool[hashId], "Not in pool");
        _removeFromPool(hashId);
        _transferEthscription(owner(), owner(), hashId);
        emit PrizeWithdrawn(hashId);
    }

    function withdrawPrizeBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            require(inPool[hashId], "Not in pool");
            _removeFromPool(hashId);
            _transferEthscription(owner(), owner(), hashId);
            emit PrizeWithdrawn(hashId);
        }
    }

    // =========================================================
    // Emergency: recover stuck ethscriptions
    // =========================================================

    function emergencyWithdrawEthscription(bytes32 hashId) external onlyOwner nonReentrant {
        // Clean pool state if it's in the pool
        if (inPool[hashId]) {
            _removeFromPool(hashId);
        }

        // Re-register in escrow and transfer to owner
        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            owner()
        ][hashId] = 1;
        _transferEthscription(owner(), owner(), hashId);

        emit PrizeWithdrawn(hashId);
    }

    // =========================================================
    // Internal: O(1) pool removal (swap-and-pop)
    // =========================================================

    function _removeFromPool(bytes32 hashId) internal {
        uint256 idx = _poolIndex[hashId];
        bytes32 lastHash = _prizePool[_prizePool.length - 1];
        _prizePool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _prizePool.pop();

        inPool[hashId] = false;
        delete depositor[hashId];
        delete _poolIndex[hashId];
    }

    // =========================================================
    // Safety overrides
    // =========================================================

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Storage gap for future upgrades ───────────────────────
    uint256[50] private __gap;
}
