// SPDX-License-Identifier: PHUNKY

/*********** CryptoPhunksVault ***************
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
****************************************/

/* ========================================
   ∬  CryptoPhunksVault                  ∬
   ========================================
   ∬  Owner deposits spare phunks         ∬
   ∬  Users swap 1:1 for free             ∬
   ∬  Random selection from pool          ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EthscriptionsEscrower.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract CryptoPhunksVault is
    Initializable,
    EthscriptionsEscrower,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ─── State ───────────────────────────────────────────────
    bytes32[] private _pool;
    mapping(bytes32 => uint256) private _poolIndex;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;

    bool public swapEnabled;
    uint256 public totalSwapped;
    bytes32 private _lastRandomHash;
    uint256 public swapFee;
    address payable public treasuryAddress;
    bytes32 public merkleRoot;

    // ─── Events ──────────────────────────────────────────────
    event PoolDeposited(bytes32 indexed hashId);
    event PoolWithdrawn(bytes32 indexed hashId);
    event Swapped(bytes32 indexed sentHashId, bytes32 indexed receivedHashId, address indexed swapper, uint256 swapNumber);

    // ─── Constructor & Initializer ───────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address payable _treasuryAddress) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        swapEnabled = true;
        treasuryAddress = _treasuryAddress;
    }

    // =========================================================
    // Fallback: Owner deposits, users deposit for swap
    // =========================================================

    fallback() external {
        require(msg.data.length > 0 && msg.data.length % 32 == 0, "Invalid length");

        if (msg.sender == owner()) {
            // Owner deposit into pool
            for (uint256 i = 0; i < msg.data.length / 32; i++) {
                bytes32 hashId;
                assembly { hashId := calldataload(mul(i, 32)) }

                require(hashId != bytes32(0), "Invalid hashId");
                require(!inPool[hashId], "Already in pool");

                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                    msg.sender
                ][hashId] = 1;

                _poolIndex[hashId] = _pool.length;
                _pool.push(hashId);
                inPool[hashId] = true;
                depositor[hashId] = msg.sender;

                emit PoolDeposited(hashId);
            }
        } else {
            // User deposit for swap — track receipt
            for (uint256 i = 0; i < msg.data.length / 32; i++) {
                bytes32 hashId;
                assembly { hashId := calldataload(mul(i, 32)) }
                require(hashId != bytes32(0), "Invalid hashId");

                EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                    msg.sender
                ][hashId] = block.number;
            }
        }
    }

    // =========================================================
    // Swap: user sends 1 phunk, picks 1 from pool
    // =========================================================

    function swap(bytes32 sendHashId, bytes32 receiveHashId, bytes32[] calldata proof) external payable nonReentrant whenNotPaused {
        require(swapEnabled, "Swaps disabled");
        require(_pool.length > 0, "Pool empty");
        require(msg.value >= swapFee, "Insufficient fee");
        require(merkleRoot != bytes32(0), "Merkle root not set");
        require(_verifyMerkle(proof, merkleRoot, sendHashId), "Not a valid CryptoPhunksV67");
        require(inPool[receiveHashId], "Not in pool");
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

        // Send random phunk to user
        _transferEthscription(dep, msg.sender, receiveHashId);

        emit Swapped(sendHashId, receiveHashId, msg.sender, totalSwapped);
    }

    // =========================================================
    // Cancel deposit (get your phunk back if you didn't swap)
    // =========================================================

    function cancelDeposit(bytes32 hashId) external nonReentrant {
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][hashId] > 0,
            "Not deposited"
        );
        require(!inPool[hashId], "In pool");
        _transferEthscription(msg.sender, msg.sender, hashId);
    }

    // =========================================================
    // View Functions
    // =========================================================

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

    // =========================================================
    // Owner Functions
    // =========================================================

    function setSwapEnabled(bool _enabled) external onlyOwner {
        swapEnabled = _enabled;
    }

    function withdrawFromPool(bytes32 hashId) external onlyOwner nonReentrant {
        require(inPool[hashId], "Not in pool");
        address dep = depositor[hashId];
        _removeFromPool(hashId);
        _transferEthscription(dep, owner(), hashId);
        emit PoolWithdrawn(hashId);
    }

    function withdrawFromPoolBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            require(inPool[hashIds[i]], "Not in pool");
            address dep = depositor[hashIds[i]];
            _removeFromPool(hashIds[i]);
            _transferEthscription(dep, owner(), hashIds[i]);
            emit PoolWithdrawn(hashIds[i]);
        }
    }

    function setMerkleRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
    }

    function setSwapFee(uint256 _fee) external onlyOwner {
        swapFee = _fee;
    }

    function setTreasuryAddress(address payable _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        treasuryAddress = _treasuryAddress;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    // =========================================================
    // Internal
    // =========================================================

    function _verifyMerkle(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
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

    function _removeFromPool(bytes32 hashId) internal {
        uint256 idx = _poolIndex[hashId];
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();

        inPool[hashId] = false;
        delete depositor[hashId];
        delete _poolIndex[hashId];
    }

    // ─── Storage gap ─────────────────────────────────────────
    uint256[41] private __gap;
}
