// SPDX-License-Identifier: PHUNKY

/****** AuctionHouseV2 *
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
   ∬  EtherPhunks Auction House V2        ∬
   ========================================
   ∬  Nouns-style continuous auction       ∬
   ∬  Owner loads pool, random auctions    ∬
   ∬  Hybrid push/pull refunds             ∬
   ∬  Per-item reserve prices              ∬
   ∬  67 points on win                     ∬
   ∬  + withdrawETH protection (audit)     ∬
   ∬  + redirectPendingReturns (audit)     ∬
   ∬  + RefundEscrowed event (audit)       ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";
import "./interfaces/IPoints.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract EtherPhunksAuctionHouseV2 is Initializable, EthscriptionsEscrower, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    // ─── Auction struct ──────────────────────────────────────

    struct Auction {
        bytes32 hashId;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        address payable bidder;
        bool settled;
        uint256 auctionId;
    }

    // ─── State ───────────────────────────────────────────────

    // Auction config
    uint256 public duration;
    uint256 public timeBuffer;
    uint8 public minBidIncrementPercentage;
    uint256 public reservePrice;
    uint256 public auctionId;

    // Points + Treasury
    address public pointsAddress;
    address payable public treasuryAddress;

    // Pool (LotteryV68 pattern)
    bytes32[] private _pool;
    mapping(bytes32 => uint256) private _poolIndex;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;

    // Per-item reserve prices (0 = use global reservePrice)
    mapping(bytes32 => uint256) public itemReservePrice;

    // Hybrid refunds: try auto-send, fallback to pull
    mapping(address => uint256) public pendingReturns;

    // Randomness (LotteryV68 pattern)
    bytes32 private _lastRandomHash;

    // Current auction
    Auction public auction;

    // Committed ETH protection (audit fix — consumes 1 __gap slot)
    uint256 public totalCommittedETH;

    // ─── Events ──────────────────────────────────────────────

    event AuctionCreated(bytes32 indexed hashId, uint256 auctionId, uint256 startTime, uint256 endTime);
    event AuctionBid(bytes32 indexed hashId, uint256 auctionId, address sender, uint256 value);
    event AuctionExtended(bytes32 indexed hashId, uint256 auctionId, uint256 endTime);
    event AuctionSettled(bytes32 indexed hashId, uint256 auctionId, address winner, uint256 amount);
    event PoolDeposited(bytes32 indexed hashId);
    event PoolWithdrawn(bytes32 indexed hashId);
    event RefundEscrowed(address indexed recipient, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        uint256 _duration,
        uint256 _timeBuffer,
        uint8 _minBidIncrementPercentage,
        uint256 _reservePrice,
        address _pointsAddress,
        address payable _treasuryAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_treasuryAddress != address(0), "Invalid treasury");
        duration = _duration;
        timeBuffer = _timeBuffer;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        reservePrice = _reservePrice;
        pointsAddress = _pointsAddress;
        treasuryAddress = _treasuryAddress;
    }

    // ─── Fallback: Owner deposits ethscriptions into pool ────

    fallback() external {
        require(msg.sender == owner(), "Only owner can deposit");
        require(msg.data.length > 0 && msg.data.length % 32 == 0, "Invalid length");

        for (uint256 i = 0; i < msg.data.length / 32; i++) {
            bytes32 hashId;
            assembly {
                hashId := calldataload(mul(i, 32))
            }

            require(hashId != bytes32(0), "Invalid hashId");
            require(!inPool[hashId], "Already in pool");

            // Record in escrow storage (set to 1 so cooldown is always satisfied)
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                msg.sender
            ][hashId] = 1;

            // Add to pool
            _poolIndex[hashId] = _pool.length;
            _pool.push(hashId);
            inPool[hashId] = true;
            depositor[hashId] = msg.sender;

            emit PoolDeposited(hashId);
        }
    }

    // ─── Settle + Create (anyone, when not paused) ───────────

    function settleAndCreate() external nonReentrant whenNotPaused notBlacklisted {
        if (auction.startTime != 0 && !auction.settled) {
            _settleAuction();
        }
        if (_pool.length > 0) {
            _createAuction();
        }
    }

    // ─── Standalone settle (always works, even when paused) ──

    function settleAuction() external nonReentrant notBlacklisted {
        _settleAuction();
    }

    // ─── Create bid ──────────────────────────────────────────

    function createBid() external payable nonReentrant notBlacklisted {
        require(block.timestamp < auction.endTime, "Auction expired");
        require(!auction.settled, "Auction settled");
        require(msg.sender == tx.origin, "No contracts");

        // First bid must meet reserve; subsequent must beat last + increment
        if (auction.bidder == address(0)) {
            uint256 reserve = itemReservePrice[auction.hashId] > 0
                ? itemReservePrice[auction.hashId]
                : reservePrice;
            require(msg.value >= reserve, "Below reserve price");
        } else {
            require(
                msg.value >= auction.amount + (auction.amount * minBidIncrementPercentage / 100),
                "Bid too low"
            );
        }

        // Save previous bidder info
        address payable prevBidder = auction.bidder;
        uint256 prevAmount = auction.amount;

        // Update state FIRST (CEI pattern)
        totalCommittedETH = totalCommittedETH - prevAmount + msg.value;
        auction.amount = msg.value;
        auction.bidder = payable(msg.sender);

        // Anti-snipe: extend if within timeBuffer of end
        if (auction.endTime - block.timestamp < timeBuffer) {
            auction.endTime = block.timestamp + timeBuffer;
            emit AuctionExtended(auction.hashId, auction.auctionId, auction.endTime);
        }

        // Hybrid refund: try auto-send, fallback to pendingReturns
        if (prevBidder != address(0)) {
            (bool sent, ) = prevBidder.call{value: prevAmount}("");
            if (!sent) {
                pendingReturns[prevBidder] += prevAmount;
                emit RefundEscrowed(prevBidder, prevAmount);
            }
        }

        emit AuctionBid(auction.hashId, auction.auctionId, msg.sender, msg.value);
    }

    // ─── Withdraw pending returns ────────────────────────────

    function withdraw() external nonReentrant notBlacklisted {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
    }

    // ─── Internal: Settle auction ────────────────────────────

    function _settleAuction() internal {
        require(auction.startTime != 0, "No auction");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.settled, "Already settled");

        auction.settled = true;
        totalCommittedETH -= auction.amount;

        if (auction.bidder != address(0)) {
            // Winner exists — transfer ethscription to winner
            _transferEthscription(depositor[auction.hashId], auction.bidder, auction.hashId);
            delete depositor[auction.hashId];

            // Award 67 points to winner
            if (pointsAddress != address(0)) {
                try IPoints(pointsAddress).addPoints(auction.bidder, 67) {} catch {}
            }

            // Send ETH to treasury (hybrid: try push, fallback to pull)
            (bool sent, ) = treasuryAddress.call{value: auction.amount}("");
            if (!sent) {
                pendingReturns[treasuryAddress] += auction.amount;
                emit RefundEscrowed(treasuryAddress, auction.amount);
            }
        } else {
            // No bids — return to pool
            _poolIndex[auction.hashId] = _pool.length;
            _pool.push(auction.hashId);
            inPool[auction.hashId] = true;
            // depositor and escrow are still intact from original deposit
        }

        emit AuctionSettled(auction.hashId, auction.auctionId, auction.bidder, auction.amount);
    }

    // ─── Internal: Create auction ────────────────────────────

    function _createAuction() internal {
        require(_pool.length > 0, "Pool empty");

        bytes32 hashId;
        uint256 idx;

        if (_orderQueue.length > 0) {
            // Use next item from ordered queue (pop from end = last item owner added)
            hashId = _orderQueue[_orderQueue.length - 1];
            _orderQueue.pop();
            // Verify it's still in the pool (owner may have withdrawn it since setAuctionOrder)
            require(inPool[hashId], "Ordered item not in pool");
            idx = _poolIndex[hashId];
        } else {
            // Random selection (LotteryV68 chained hash pattern)
            bytes32 randomHash = keccak256(abi.encodePacked(
                _lastRandomHash,
                block.prevrandao,
                block.timestamp,
                block.basefee,
                blockhash(block.number - 1),
                auctionId,
                msg.sender,
                gasleft()
            ));
            _lastRandomHash = randomHash;
            idx = uint256(randomHash) % _pool.length;
            hashId = _pool[idx];
        }

        // Swap-and-pop removal
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        delete _poolIndex[hashId];
        inPool[hashId] = false;

        // Create auction
        auctionId++;

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        auction = Auction({
            hashId: hashId,
            amount: 0,
            startTime: startTime,
            endTime: endTime,
            bidder: payable(address(0)),
            settled: false,
            auctionId: auctionId
        });

        emit AuctionCreated(hashId, auctionId, startTime, endTime);
    }

    // ─── View functions ──────────────────────────────────────

    function poolSize() external view returns (uint256) {
        return _pool.length;
    }

    function getPoolItems(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        uint256 end = offset + limit;
        if (end > _pool.length) end = _pool.length;
        if (offset >= _pool.length) return new bytes32[](0);

        bytes32[] memory items = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            items[i - offset] = _pool[i];
        }
        return items;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Owner functions ─────────────────────────────────────

    function setDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 60, "Min 60 seconds");
        duration = _duration;
    }

    function setAuctionEndTime(uint256 _endTime) external onlyOwner {
        require(auction.startTime != 0 && !auction.settled, "No active auction");
        require(_endTime > block.timestamp, "End time must be future");
        auction.endTime = _endTime;
    }

    function setTimeBuffer(uint256 _timeBuffer) external onlyOwner {
        timeBuffer = _timeBuffer;
    }

    function setMinBidIncrementPercentage(uint8 _minBidIncrementPercentage) external onlyOwner {
        require(_minBidIncrementPercentage >= 1, "Min 1%");
        minBidIncrementPercentage = _minBidIncrementPercentage;
    }

    function setReservePrice(uint256 _reservePrice) external onlyOwner {
        reservePrice = _reservePrice;
    }

    function setItemReservePrices(bytes32[] calldata hashIds, uint256[] calldata prices) external onlyOwner {
        require(hashIds.length == prices.length, "Length mismatch");
        for (uint256 i = 0; i < hashIds.length; i++) {
            itemReservePrice[hashIds[i]] = prices[i];
        }
    }

    function setPointsAddress(address _pointsAddress) external onlyOwner {
        pointsAddress = _pointsAddress;
    }

    function setTreasuryAddress(address payable _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        treasuryAddress = _treasuryAddress;
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance - totalCommittedETH, "Exceeds available balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    function withdrawFromPool(bytes32 hashId) external onlyOwner nonReentrant {
        require(inPool[hashId], "Not in pool");

        // O(1) swap-and-pop
        uint256 idx = _poolIndex[hashId];
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();

        inPool[hashId] = false;
        delete _poolIndex[hashId];
        delete depositor[hashId];

        // Transfer back to owner
        _transferEthscription(owner(), owner(), hashId);

        emit PoolWithdrawn(hashId);
    }

    function withdrawFromPoolBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            require(inPool[hashId], "Not in pool");

            uint256 idx = _poolIndex[hashId];
            bytes32 lastHash = _pool[_pool.length - 1];
            _pool[idx] = lastHash;
            _poolIndex[lastHash] = idx;
            _pool.pop();

            inPool[hashId] = false;
            delete _poolIndex[hashId];
            delete depositor[hashId];

            _transferEthscription(owner(), owner(), hashId);

            emit PoolWithdrawn(hashId);
        }
    }

    function emergencyWithdrawEthscriptionBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            // Skip active auction logic in batch (can't easily refund inside loop)
            if (inPool[hashId]) {
                uint256 idx = _poolIndex[hashId];
                bytes32 lastHash = _pool[_pool.length - 1];
                _pool[idx] = lastHash;
                _poolIndex[lastHash] = idx;
                _pool.pop();
                inPool[hashId] = false;
                delete _poolIndex[hashId];
                delete depositor[hashId];
            }
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                owner()
            ][hashId] = 1;
            _transferEthscription(owner(), owner(), hashId);
        }
    }

    function emergencyWithdrawEthscription(bytes32 hashId) external onlyOwner nonReentrant {
        // If this is the active auction item, refund the current bidder and mark settled
        if (auction.hashId == hashId && auction.startTime != 0 && !auction.settled) {
            auction.settled = true;
            totalCommittedETH -= auction.amount;

            if (auction.bidder != address(0)) {
                (bool sent, ) = auction.bidder.call{value: auction.amount}("");
                if (!sent) {
                    pendingReturns[auction.bidder] += auction.amount;
                    emit RefundEscrowed(auction.bidder, auction.amount);
                }
            }

            emit AuctionSettled(auction.hashId, auction.auctionId, address(0), 0);
        }

        // Clean pool state if item is in the pool
        if (inPool[hashId]) {
            uint256 idx = _poolIndex[hashId];
            bytes32 lastHash = _pool[_pool.length - 1];
            _pool[idx] = lastHash;
            _poolIndex[lastHash] = idx;
            _pool.pop();
            inPool[hashId] = false;
            delete _poolIndex[hashId];
            delete depositor[hashId];
        }

        // Re-register in escrow so transfer validation passes
        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            owner()
        ][hashId] = 1;
        _transferEthscription(owner(), owner(), hashId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function redirectPendingReturns(address from, address payable to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 amount = pendingReturns[from];
        require(amount > 0, "Nothing to redirect");
        pendingReturns[from] = 0;
        pendingReturns[to] += amount;
    }

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    // ─── Ordered queue (owner sets priority auction order) ───

    bytes32[] private _orderQueue;

    event AuctionOrderSet(bytes32[] hashIds);

    // Owner sets an ordered list of hashIds to auction next (last item auctioned first).
    // All hashIds must already be in the pool.
    function setAuctionOrder(bytes32[] calldata hashIds) external onlyOwner {
        for (uint256 i = 0; i < hashIds.length; i++) {
            require(inPool[hashIds[i]], "Item not in pool");
        }
        delete _orderQueue;
        for (uint256 i = 0; i < hashIds.length; i++) {
            _orderQueue.push(hashIds[i]);
        }
        emit AuctionOrderSet(hashIds);
    }

    function auctionOrderSize() external view returns (uint256) {
        return _orderQueue.length;
    }

    function getAuctionOrderItems() external view returns (bytes32[] memory) {
        return _orderQueue;
    }

    // ─── Swap: users swap their v67 for one in the pool ─────

    bool public swapEnabled;
    bytes32 public swapMerkleRoot;
    uint256 public swapFee;
    uint256 public totalSwapped;

    event Swapped(bytes32 indexed sentHashId, bytes32 indexed receivedHashId, address indexed swapper, uint256 swapNumber);

    function swap(bytes32 sendHashId, bytes32 receiveHashId, bytes32[] calldata proof) external payable nonReentrant whenNotPaused notBlacklisted {
        require(swapEnabled, "Swaps disabled");
        require(_pool.length > 0, "Pool empty");
        require(msg.value >= swapFee, "Insufficient fee");
        require(swapMerkleRoot != bytes32(0), "Merkle root not set");
        require(_verifySwapMerkle(proof, swapMerkleRoot, sendHashId), "Not a valid CryptoPhunksV67");
        require(inPool[receiveHashId], "Not in pool");
        require(receiveHashId != auction.hashId || auction.settled, "Cannot swap active auction item");
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][sendHashId] > 0,
            "Ethscription not deposited"
        );

        // Send fee to treasury
        if (msg.value > 0 && treasuryAddress != address(0)) {
            (bool sent, ) = treasuryAddress.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        totalSwapped++;
        address dep = depositor[receiveHashId];

        // Remove received item from pool (swap-and-pop)
        uint256 idx = _poolIndex[receiveHashId];
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        inPool[receiveHashId] = false;
        delete _poolIndex[receiveHashId];
        delete depositor[receiveHashId];

        // Add sent item to pool
        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            owner()
        ][sendHashId] = 1;
        delete EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            msg.sender
        ][sendHashId];
        _poolIndex[sendHashId] = _pool.length;
        _pool.push(sendHashId);
        inPool[sendHashId] = true;
        depositor[sendHashId] = owner();

        // Send picked item to user
        _transferEthscription(dep, msg.sender, receiveHashId);

        emit Swapped(sendHashId, receiveHashId, msg.sender, totalSwapped);
    }

    function cancelSwapDeposit(bytes32 hashId) external nonReentrant notBlacklisted {
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][hashId] > 0,
            "Not deposited"
        );
        require(!inPool[hashId], "In pool");
        _transferEthscription(msg.sender, msg.sender, hashId);
    }

    function setSwapEnabled(bool _enabled) external onlyOwner {
        swapEnabled = _enabled;
    }

    function setSwapMerkleRoot(bytes32 _root) external onlyOwner {
        swapMerkleRoot = _root;
    }

    function setSwapFee(uint256 _fee) external onlyOwner {
        swapFee = _fee;
    }

    function _verifySwapMerkle(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 hash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            if (hash < proof[i]) {
                hash = keccak256(abi.encodePacked(hash, proof[i]));
            } else {
                hash = keccak256(abi.encodePacked(proof[i], hash));
            }
        }
        return hash == root;
    }

    // ─── Blacklist (incident response: lock out a compromised wallet) ──
    // NOTE: must remain the LAST storage var before __gap (consumes 1 gap slot).
    mapping(address => bool) public blacklisted;

    event Blacklisted(address indexed account, bool status);

    modifier notBlacklisted() {
        require(!blacklisted[msg.sender], "Blacklisted");
        _;
    }

    function setBlacklist(address account, bool status) external onlyOwner {
        blacklisted[account] = status;
        emit Blacklisted(account, status);
    }

    /// @notice Owner-only recovery. Emits the escrow transfer with the REAL
    /// depositor as previousOwner so the ethscriptions protocol accepts it,
    /// and sends the item to a safe wallet. Cleans pool state if still pooled.
    function adminWithdraw(
        address previousOwner,
        bytes32[] calldata hashIds,
        address to
    ) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            if (inPool[hashId]) {
                uint256 idx = _poolIndex[hashId];
                bytes32 lastHash = _pool[_pool.length - 1];
                _pool[idx] = lastHash;
                _poolIndex[lastHash] = idx;
                _pool.pop();
                inPool[hashId] = false;
                delete _poolIndex[hashId];
                delete depositor[hashId];
            }
            _transferEthscription(previousOwner, to, hashId);
        }
    }

    // ─── Storage gap for future upgrades (was 44; -1 for blacklisted = 43) ──

    uint256[43] private __gap;
}
