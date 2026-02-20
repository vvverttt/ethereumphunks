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

    // ─── Initializer ──────────────────────────────────────

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

    // ─── Fallback: Receive ethscription & auto-swap ───────

    fallback() external payable nonReentrant {
        if (msg.data.length != 32) revert InvalidDataLength();

        bytes32 hashId;
        assembly {
            hashId := calldataload(0)
        }

        if (!registered[hashId]) revert UnknownEthscription();

        // Record who deposited this ethscription
        depositor[hashId] = msg.sender;

        // Owner deposits are just pre-loading — no swap (works even when paused)
        if (msg.sender == owner()) return;

        // Non-owner swaps require contract to be unpaused
        require(!paused(), "Pausable: paused");

        uint256 pid = pairIdOf[hashId];

        if (isOg[hashId]) {
            _evolve(msg.sender, pid);
        } else {
            _devolve(msg.sender, pid);
        }
    }

    receive() external payable {}

    // ─── Internal: Evolve (OG → Quantum) ──────────────────

    function _evolve(address user, uint256 pid) internal {
        bytes32 qHashId = quantumHashId[pid];
        address qDepositor = depositor[qHashId];

        if (qDepositor == address(0)) revert PartnerNotAvailable();

        // Charge fee on first evolve only
        if (!feePaid[pid]) {
            if (msg.value < evolveFee) revert InsufficientFee();
            feePaid[pid] = true;
        }

        // Transfer quantum ethscription to user
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            qDepositor,
            user,
            qHashId
        );
        delete depositor[qHashId];

        emit Evolved(user, pid, ogHashId[pid], qHashId);
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

    function withdrawETH() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "Transfer failed");
    }

    function withdrawEthscription(bytes32 hashId, address to) external onlyOwner {
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            address(this),
            to,
            hashId
        );
        delete depositor[hashId];
    }
}
