// SPDX-License-Identifier: PHUNKY

/** Evolve.sol *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░████░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
****************************/

/* ========================================
   ∬  EtherPhunks Evolve                  ∬
   ========================================
   ∬  OG ↔ Quantum ethscription swap      ∬
   ∬  1:1 by tokenId, single tx           ∬
   ∬  One-time fee on first evolve         ∬
   ∬  + Hybrid push/pull refunds (audit)   ∬
   ====================================== */

pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract Mutation is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ─── Events ────────────────────────────────────────────

    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed id
    );

    event Evolved(
        address indexed user,
        uint256 indexed pairId,
        bytes32 ogHashId,
        bytes32 quantumHashId
    );

    event Devolved(
        address indexed user,
        uint256 indexed pairId,
        bytes32 quantumHashId,
        bytes32 ogHashId
    );

    event PairsRegistered(uint256 startPairId, uint256 count);

    event QuantumHashIdUpdated(
        uint256 indexed pairId,
        bytes32 oldQuantumHashId,
        bytes32 newQuantumHashId
    );

    // ─── Errors ────────────────────────────────────────────

    error InvalidDataLength();
    error UnknownEthscription();
    error PartnerNotAvailable();
    error InsufficientFee();

    // ─── State ─────────────────────────────────────────────

    uint256 public evolveFee;
    uint256 public pairCount;

    // Pair storage: pairId → hashIds
    mapping(uint256 => bytes32) public ogHashId;
    mapping(uint256 => bytes32) public quantumHashId;

    // Fee tracking: pairId → has first-evolve fee been paid
    mapping(uint256 => bool) public feePaid;

    // Reverse lookup: hashId → pairId
    mapping(bytes32 => uint256) public pairIdOf;

    // hashId → true if this is the OG side of the pair
    mapping(bytes32 => bool) public isOg;

    // hashId → is this a known registered ethscription
    mapping(bytes32 => bool) public registered;

    // hashId → address that last sent this ethscription to the contract
    mapping(bytes32 => address) public depositor;

    // Hybrid push/pull refunds (audit fix — consumes 1 __gap slot)
    mapping(address => uint256) public pendingReturns;

    // ─── Constructor & Initializer ──────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(uint256 _evolveFee) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        evolveFee = _evolveFee;
    }

    // ─── Admin: Register pairs ────────────────────────────

    function registerPairs(
        bytes32[] calldata _ogHashIds,
        bytes32[] calldata _quantumHashIds
    ) external onlyOwner {
        require(_ogHashIds.length == _quantumHashIds.length, "Length mismatch");

        uint256 startId = pairCount;

        for (uint256 i = 0; i < _ogHashIds.length; i++) {
            require(!registered[_ogHashIds[i]], "OG already registered");
            require(!registered[_quantumHashIds[i]], "Quantum already registered");

            uint256 pid = pairCount++;

            ogHashId[pid] = _ogHashIds[i];
            quantumHashId[pid] = _quantumHashIds[i];

            pairIdOf[_ogHashIds[i]] = pid;
            pairIdOf[_quantumHashIds[i]] = pid;

            isOg[_ogHashIds[i]] = true;

            registered[_ogHashIds[i]] = true;
            registered[_quantumHashIds[i]] = true;
        }

        emit PairsRegistered(startId, _ogHashIds.length);
    }

    // ─── Admin: Update quantum hashId for a pair ─────────
    // Used when a quantum ethscription is re-minted with a new hashId.
    // The old quantum MUST be withdrawn via withdrawEthscription() first.

    function updateQuantumHashId(
        uint256 pid,
        bytes32 newQuantumHashId
    ) external onlyOwner {
        require(pid < pairCount, "Invalid pair ID");
        require(newQuantumHashId != bytes32(0), "Zero hashId");

        bytes32 oldQuantumHashId = quantumHashId[pid];
        require(oldQuantumHashId != newQuantumHashId, "Same hashId");
        require(!registered[newQuantumHashId], "New quantum already registered");

        // Clear old quantum mappings
        delete registered[oldQuantumHashId];
        delete pairIdOf[oldQuantumHashId];
        delete depositor[oldQuantumHashId];

        // Set new quantum mappings
        quantumHashId[pid] = newQuantumHashId;
        pairIdOf[newQuantumHashId] = pid;
        registered[newQuantumHashId] = true;

        emit QuantumHashIdUpdated(pid, oldQuantumHashId, newQuantumHashId);
    }

    // ─── Fallback: Receive ethscription & auto-swap ───────

    fallback() external payable nonReentrant {
        if (msg.data.length == 0 || msg.data.length % 32 != 0) revert InvalidDataLength();

        uint256 count = msg.data.length / 32;

        // Owner can batch-deposit (pre-load) multiple ethscriptions
        if (msg.sender == owner()) {
            for (uint256 i = 0; i < count; i++) {
                bytes32 hId;
                assembly {
                    hId := calldataload(mul(i, 32))
                }
                if (!registered[hId]) revert UnknownEthscription();
                depositor[hId] = msg.sender;
            }
            return;
        }

        // Non-owner: single swap only
        if (count != 1) revert InvalidDataLength();

        bytes32 hashId;
        assembly {
            hashId := calldataload(0)
        }

        if (!registered[hashId]) revert UnknownEthscription();
        depositor[hashId] = msg.sender;

        require(!paused(), "Pausable: paused");

        uint256 pid = pairIdOf[hashId];

        if (isOg[hashId]) {
            _evolve(msg.sender, pid);
        } else {
            _devolve(msg.sender, pid);
        }
    }

    receive() external payable {
        revert("No direct ETH transfers");
    }

    // ─── Internal: Evolve (OG → Quantum) ──────────────────

    function _evolve(address user, uint256 pid) internal {
        bytes32 qHashId = quantumHashId[pid];
        address qDepositor = depositor[qHashId];

        if (qDepositor == address(0)) revert PartnerNotAvailable();

        // Charge fee on first evolve only
        uint256 feeRequired = 0;
        if (!feePaid[pid]) {
            if (msg.value < evolveFee) revert InsufficientFee();
            feePaid[pid] = true;
            feeRequired = evolveFee;
        }

        // Transfer quantum ethscription to user
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            qDepositor,
            user,
            qHashId
        );
        delete depositor[qHashId];

        emit Evolved(user, pid, ogHashId[pid], qHashId);

        // Refund excess ETH (hybrid push/pull)
        if (msg.value > feeRequired) {
            uint256 refund = msg.value - feeRequired;
            (bool sent, ) = payable(user).call{value: refund}("");
            if (!sent) {
                pendingReturns[user] += refund;
            }
        }
    }

    // ─── Internal: Devolve (Quantum → OG) ─────────────────

    function _devolve(address user, uint256 pid) internal {
        bytes32 oHashId = ogHashId[pid];
        address oDepositor = depositor[oHashId];

        if (oDepositor == address(0)) revert PartnerNotAvailable();

        // Devolve is always free

        // Transfer OG ethscription to user
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            oDepositor,
            user,
            oHashId
        );
        delete depositor[oHashId];

        emit Devolved(user, pid, quantumHashId[pid], oHashId);

        // Refund any ETH sent (devolve is free, hybrid push/pull)
        if (msg.value > 0) {
            (bool sent, ) = payable(user).call{value: msg.value}("");
            if (!sent) {
                pendingReturns[user] += msg.value;
            }
        }
    }

    // ─── Explicit swap (for owner or anyone who deposited via fallback) ─

    error NotDepositor();
    error NotOg();
    error NotQuantum();

    function evolve(bytes32 hashId) external payable nonReentrant {
        if (!registered[hashId]) revert UnknownEthscription();
        if (depositor[hashId] != msg.sender) revert NotDepositor();
        require(!paused(), "Pausable: paused");

        uint256 pid = pairIdOf[hashId];
        if (!isOg[hashId]) revert NotOg();

        _evolve(msg.sender, pid);
    }

    function devolve(bytes32 hashId) external payable nonReentrant {
        if (!registered[hashId]) revert UnknownEthscription();
        if (depositor[hashId] != msg.sender) revert NotDepositor();
        require(!paused(), "Pausable: paused");

        uint256 pid = pairIdOf[hashId];
        if (isOg[hashId]) revert NotQuantum();

        _devolve(msg.sender, pid);
    }

    // ─── Admin functions ──────────────────────────────────

    function setFee(uint256 _fee) external onlyOwner {
        evolveFee = _fee;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
    }

    function withdrawETH() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }

    function withdrawEthscription(bytes32 hashId, address to) external onlyOwner {
        address prevOwner = depositor[hashId] != address(0) ? depositor[hashId] : to;
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            prevOwner,
            to,
            hashId
        );
        delete depositor[hashId];
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

    // ─── Storage gap for future upgrades (50 - 1 consumed = 49) ──
    uint256[49] private __gap;
}
