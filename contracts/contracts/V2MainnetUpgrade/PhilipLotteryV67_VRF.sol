// SPDX-License-Identifier: PHUNKY

/*********** PhilipLotteryV67_VRF *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░████░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░██░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
****************************/

/* ========================================
   ∬  V67_VRF: Chainlink VRF upgrade       ∬
   ========================================
   ∬  Upgrade target for the LIVE V67      ∬
   ∬  proxies (commit-reveal). Preserves   ∬
   ∬  V67's EXACT storage layout, then     ∬
   ∬  consumes gap slots for VRF state.    ∬
   ∬                                       ∬
   ∬  + Chainlink VRF v2.5 (direct fund)   ∬
   ∬  + Single tx: pay → VRF → auto-assign ∬
   ∬  + Player pays VRF fee in native ETH  ∬
   ∬  + No commit-reveal, no cancel        ∬
   ∬  + No cherry-picking possible         ∬
   ∬                                       ∬
   ∬  Commit-reveal state vars are kept    ∬
   ∬  (unused) purely for layout safety.   ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";
import "./interfaces/IPoints.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFV2PlusWrapper.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract PhilipLotteryV67_VRF is
    Initializable,
    EthscriptionsEscrower,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ─── Constants (V67, kept) ─────────────────────────────────
    uint256 public constant REVEAL_DELAY = 2;
    uint256 public constant REVEAL_EXPIRY = 256;

    // ─── Commitment struct (V67 layout, UNUSED in VRF) ────────
    struct PlayCommitment {
        uint256 commitBlock;
        uint256 priceLocked;
    }

    // ─── State (V67 EXACT layout — DO NOT REORDER) ────────────
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
    bytes32 private _lastRandomHash; // unused in VRF (kept for layout)

    mapping(address => uint256) public pendingReturns;

    // commit-reveal accounting (UNUSED in VRF — kept for layout)
    mapping(address => PlayCommitment) public commitments;
    uint256 public pendingReveals;
    uint256 public totalRevealed;
    uint256 public totalCommittedETH; // tracks ETH held for in-flight VRF callbacks

    // ─── V67_VRF new state (consumes gap slots) ───────────────
    IVRFV2PlusWrapper public vrfWrapper;
    uint32 public vrfCallbackGasLimit;
    uint16 public vrfRequestConfirmations;

    struct PendingSpin {
        address player;
        uint256 pricePaid;
    }
    mapping(uint256 => PendingSpin) public pendingSpins; // requestId → spin

    // ─── Events ──────────────────────────────────────────────
    event LotteryPlayed(uint256 indexed playId, address indexed player, uint256 price);
    event PrizeAwarded(uint256 indexed playId, address indexed winner, bytes32 indexed hashId);
    event PrizeDeposited(bytes32 indexed hashId, address indexed depositor);
    event PrizeWithdrawn(bytes32 indexed hashId);
    event PriceSet(uint256 newPrice);
    event ActiveToggled(bool active);
    event TreasuryAddressChanged(address indexed oldAddress, address indexed newAddress);
    event PointsAddressChanged(address indexed oldAddress, address indexed newAddress);
    event RefundEscrowed(address indexed recipient, uint256 amount);
    event SpinRequested(uint256 indexed requestId, address indexed player, uint256 price);
    event VRFConfigUpdated(address wrapper, uint32 callbackGasLimit, uint16 confirmations);

    // initialize() is NOT redeclared — this is an UPGRADE over already-initialized
    // V67 proxies. State is preserved. The original V67 initializer already ran.

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

            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                previousOwner
            ][hashId] = 1;

            _poolIndex[hashId] = _prizePool.length;
            _prizePool.push(hashId);
            inPool[hashId] = true;
            depositor[hashId] = previousOwner;

            emit PrizeDeposited(hashId, previousOwner);
        }
    }

    function reEmitDepositEvents(bytes32[] calldata hashIds) external onlyOwner {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            require(inPool[hashId], "Not in pool");
            emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
                depositor[hashId],
                address(this),
                hashId
            );
        }
    }

    // =========================================================
    // Play: single tx — pay ETH, VRF callback assigns the prize.
    // No cherry-picking: the outcome is decided by VRF AFTER the
    // player has irrevocably paid; there is no cancel/refund path.
    // =========================================================

    function play() external payable nonReentrant whenNotPaused {
        require(msg.sender == tx.origin, "No contracts");
        require(active, "Lottery inactive");
        require(address(vrfWrapper) != address(0), "VRF not configured");
        require(_prizePool.length > 0, "No prizes available");

        uint256 vrfCost = vrfWrapper.calculateRequestPriceNative(vrfCallbackGasLimit, 1);
        require(msg.value >= playPrice + vrfCost, "Insufficient payment");

        uint256 requestId = vrfWrapper.requestRandomWordsInNative{value: vrfCost}(
            vrfCallbackGasLimit,
            vrfRequestConfirmations,
            1,
            ""
        );

        pendingSpins[requestId] = PendingSpin({ player: msg.sender, pricePaid: playPrice });
        totalCommittedETH += playPrice; // protect this ETH from owner withdrawETH until settled

        uint256 totalCost = playPrice + vrfCost;
        if (msg.value > totalCost) {
            uint256 overpayment = msg.value - totalCost;
            (bool refundSent, ) = payable(msg.sender).call{value: overpayment}("");
            if (!refundSent) {
                pendingReturns[msg.sender] += overpayment;
                emit RefundEscrowed(msg.sender, overpayment);
            }
        }

        emit SpinRequested(requestId, msg.sender, playPrice);
    }

    // =========================================================
    // VRF Callback — only the Chainlink wrapper can call this
    // =========================================================

    function rawFulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) external nonReentrant {
        require(msg.sender == address(vrfWrapper), "Only VRF wrapper");

        PendingSpin memory spin = pendingSpins[_requestId];
        require(spin.player != address(0), "Unknown request");

        delete pendingSpins[_requestId];
        totalPlays++;
        playerPlays[spin.player]++;

        // settle the held ETH bookkeeping
        if (totalCommittedETH >= spin.pricePaid) {
            totalCommittedETH -= spin.pricePaid;
        } else {
            totalCommittedETH = 0;
        }

        // Defensive: if the pool emptied between request and callback, refund the player.
        if (_prizePool.length == 0) {
            (bool r, ) = payable(spin.player).call{value: spin.pricePaid}("");
            if (!r) {
                pendingReturns[spin.player] += spin.pricePaid;
                emit RefundEscrowed(spin.player, spin.pricePaid);
            }
            return;
        }

        // Pick random prize (Chainlink VRF — unpredictable, ungameable)
        uint256 winIndex = _randomWords[0] % _prizePool.length;
        bytes32 wonHashId = _prizePool[winIndex];
        address dep = depositor[wonHashId];

        // Remove from pool (swap-and-pop)
        bytes32 lastHash = _prizePool[_prizePool.length - 1];
        _prizePool[winIndex] = lastHash;
        _poolIndex[lastHash] = winIndex;
        _prizePool.pop();
        inPool[wonHashId] = false;
        delete depositor[wonHashId];
        delete _poolIndex[wonHashId];

        _transferEthscription(dep, spin.player, wonHashId);

        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(spin.player, 67) {} catch {}
        }

        emit LotteryPlayed(totalPlays, spin.player, spin.pricePaid);
        emit PrizeAwarded(totalPlays, spin.player, wonHashId);

        // Play price → treasury (hybrid push/pull)
        (bool sent, ) = treasuryAddress.call{value: spin.pricePaid}("");
        if (!sent) {
            pendingReturns[treasuryAddress] += spin.pricePaid;
            emit RefundEscrowed(treasuryAddress, spin.pricePaid);
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

    function getVRFCost() external view returns (uint256) {
        if (address(vrfWrapper) == address(0)) return 0;
        return vrfWrapper.calculateRequestPriceNative(vrfCallbackGasLimit, 1);
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

    function setVRFConfig(
        address _vrfWrapper,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations
    ) external onlyOwner {
        require(_vrfWrapper != address(0), "Invalid wrapper");
        vrfWrapper = IVRFV2PlusWrapper(_vrfWrapper);
        vrfCallbackGasLimit = _callbackGasLimit;
        vrfRequestConfirmations = _requestConfirmations;
        emit VRFConfigUpdated(_vrfWrapper, _callbackGasLimit, _requestConfirmations);
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance - totalCommittedETH, "Exceeds available balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    // =========================================================
    // Prize withdrawal (single + batch)
    // =========================================================

    function withdrawPrize(bytes32 hashId) external onlyOwner nonReentrant {
        require(inPool[hashId], "Not in pool");
        address dep = depositor[hashId];
        _removeFromPool(hashId);
        _transferEthscription(dep, owner(), hashId);
        emit PrizeWithdrawn(hashId);
    }

    function withdrawPrizeBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            require(inPool[hashId], "Not in pool");
            address dep = depositor[hashId];
            _removeFromPool(hashId);
            _transferEthscription(dep, owner(), hashId);
            emit PrizeWithdrawn(hashId);
        }
    }

    // =========================================================
    // Emergency: recover stuck ethscriptions
    // =========================================================

    function emergencyWithdrawEthscription(bytes32 hashId) external onlyOwner nonReentrant {
        if (inPool[hashId]) {
            _removeFromPool(hashId);
        }
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
    // Safety
    // =========================================================

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    function redirectPendingReturns(address from, address payable to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 amount = pendingReturns[from];
        require(amount > 0, "Nothing to redirect");
        pendingReturns[from] = 0;
        pendingReturns[to] += amount;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}

    // ─── Storage gap (V67 had [45]; new VRF state consumes slots) ──
    // Adjust this number until OZ validateUpgrade(V67 → V67_VRF) passes.
    uint256[43] private __gap;
}
