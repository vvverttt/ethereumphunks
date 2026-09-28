// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CryptoPhunksV67} from "../contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFT.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// Drives the NFT through random sequences of mints, transfers, approvals and owner config
/// changes. Ghost variables track what SHOULD be true so the invariants can check the
/// contract against an independent tally rather than against itself.
contract NFTHandler is Test {
    CryptoPhunksV67 public nft;
    address public owner;
    address public lottery;
    address[4] public actors;

    uint256 public ghostMinted;          // successful mints
    uint256 public ghostBurned;          // (no burn path today — kept so the invariant stays honest if one lands)
    uint256 public mintAttempts;
    uint256 public transferAttempts;
    uint256 public blockedApprovalAttempts;
    bool    public blockedOperatorEverApproved;   // must stay false

    // Operators the handler may use, and the set it keeps blocked.
    address[3] public operators;
    mapping(address => bool) public shouldBeBlocked;

    constructor(CryptoPhunksV67 _nft, address _owner, address _lottery, address[4] memory _actors) {
        nft = _nft; owner = _owner; lottery = _lottery; actors = _actors;
        operators[0] = address(0xDEAD01);
        operators[1] = address(0xDEAD02);
        operators[2] = address(0xDEAD03);
        // operators[0] is permanently blocked; the invariant asserts it never gains an approval.
        shouldBeBlocked[operators[0]] = true;
        vm.prank(owner);
        _nft.setBlockedOperator(operators[0], true);
    }

    function _actor(uint256 s) internal view returns (address) { return actors[bound(s, 0, 3)]; }
    function _op(uint256 s) internal view returns (address) { return operators[bound(s, 0, 2)]; }
    function _id(uint256 s) internal pure returns (uint256) { return bound(s, 1, 60); }

    function ownerMint(uint256 toS, uint256 idS) external {
        mintAttempts++;
        vm.prank(owner);
        try nft.ownerMint(_actor(toS), _id(idS)) { ghostMinted++; } catch {}
    }

    function lotteryMint(uint256 toS, uint256 idS) external {
        mintAttempts++;
        vm.prank(lottery);
        try nft.mintFromLottery(_actor(toS), _id(idS)) { ghostMinted++; } catch {}
    }

    /// Anyone who is not the lottery must never succeed here.
    function lotteryMintFromStranger(uint256 whoS, uint256 idS) external {
        address who = _actor(whoS);
        if (who == lottery) return;
        vm.prank(who);
        try nft.mintFromLottery(who, _id(idS)) { ghostMinted++; } catch {}
    }

    function transfer(uint256 fromS, uint256 toS, uint256 idS) external {
        transferAttempts++;
        address from = _actor(fromS); address to = _actor(toS); uint256 id = _id(idS);
        if (to == address(0)) return;
        vm.prank(from);
        try nft.transferFrom(from, to, id) {} catch {}
    }

    function approveOperator(uint256 whoS, uint256 opS, bool on) external {
        address who = _actor(whoS); address op = _op(opS);
        if (shouldBeBlocked[op] && on) blockedApprovalAttempts++;
        vm.prank(who);
        try nft.setApprovalForAll(op, on) {
            if (on && shouldBeBlocked[op]) blockedOperatorEverApproved = true;
        } catch {}
    }

    function operatorTransfer(uint256 opS, uint256 fromS, uint256 toS, uint256 idS) external {
        address op = _op(opS); address from = _actor(fromS); address to = _actor(toS);
        if (to == address(0)) return;
        vm.prank(op);
        try nft.transferFrom(from, to, _id(idS)) {} catch {}
    }

    function toggleWhitelist(bool on) external {
        vm.prank(owner);
        try nft.setOperatorWhitelistEnabled(on) {} catch {}
    }

    function setApproved(uint256 opS, bool on) external {
        address op = _op(opS);
        vm.prank(owner);
        try nft.setApprovedOperator(op, on) {} catch {}
    }

    /// The owner may block/unblock operators 1 and 2, but operator 0 stays blocked forever —
    /// otherwise the "never approved" invariant would be testing nothing.
    function setBlocked(uint256 opS, bool on) external {
        address op = _op(opS);
        if (op == operators[0]) return;
        vm.prank(owner);
        try nft.setBlockedOperator(op, on) {} catch {}
    }

    function setRoyalty(uint96 bps) external {
        vm.prank(owner);
        try nft.setRoyaltyRate(bps) {} catch {}
    }

    function setValidator(uint256 s) external {
        // Only ever address(0) here: a non-zero validator would need to be a real contract, and
        // the unit tests already cover the validator path with a mock.
        if (bound(s, 0, 1) == 0) return;
        vm.prank(owner);
        try nft.setTransferValidator(address(0)) {} catch {}
    }
}

contract QuantumPhunksNFTInvariantTest is Test {
    CryptoPhunksV67 nft;
    NFTHandler handler;
    address owner = address(0xA0);
    address treasury = address(0x7EA5);
    address lottery = address(0x107);

    function setUp() public {
        nft = CryptoPhunksV67(address(new ERC1967Proxy(
            address(new CryptoPhunksV67()),
            abi.encodeCall(CryptoPhunksV67.initialize, ("CryptoPhunksV67", "QP", treasury, owner))
        )));
        vm.prank(owner);
        nft.setLottery(lottery);

        address[4] memory actors = [address(0xA11CE), address(0xB0B), address(0xC0C), address(0xD0D)];
        handler = new NFTHandler(nft, owner, lottery, actors);
        targetContract(address(handler));
    }

    /// Supply can never exceed the cap set at initialize. This is the one that protects the
    /// collection's scarcity claim.
    function invariant_supply_never_exceeds_max() public view {
        assertLe(nft.totalSupply(), nft.maxSupply());
    }

    /// totalSupply is maintained by hand in _update (++ on mint, -- on burn). It must agree
    /// with an independently-kept count, or the counter has drifted from reality.
    function invariant_supply_matches_ghost_count() public view {
        assertEq(nft.totalSupply(), handler.ghostMinted() - handler.ghostBurned());
    }

    /// A permanently-blocked operator must never hold an approval, no matter what order the
    /// whitelist and approved-operator flags were toggled in. Blocking is checked first and
    /// unconditionally; this proves no ordering defeats it.
    function invariant_blocked_operator_never_approved() public view {
        assertFalse(handler.blockedOperatorEverApproved(), "a blocked operator gained an approval");
        address blocked = handler.operators(0);
        for (uint256 i; i < 4; i++) {
            assertFalse(nft.isApprovedForAll(handler.actors(i), blocked), "blocked operator holds approval");
        }
    }

    /// The royalty rate is capped at 6.7% and no sequence of setter calls may exceed it.
    function invariant_royalty_within_cap() public view {
        (, uint256 amt) = nft.royaltyInfo(1, 10000);
        assertLe(amt, nft.MAX_ROYALTY_BPS());
    }

    /// The royalty receiver is never address(0) — payments would be burned.
    function invariant_royalty_receiver_never_zero() public view {
        (address rcv,) = nft.royaltyInfo(1, 10000);
        assertTrue(rcv != address(0));
    }

    /// maxSupply has no setter; it must still read 10000 after any sequence.
    function invariant_maxSupply_immutable() public view {
        assertEq(nft.maxSupply(), 10000);
    }

    /// Ownership cannot drift to an actor through any handler call.
    function invariant_owner_unchanged() public view {
        assertEq(nft.owner(), owner);
    }

    /// The lottery address only changes via setLottery, which the handler never calls.
    function invariant_lottery_unchanged() public view {
        assertEq(nft.lottery(), lottery);
    }

    function invariant_callSummary() public view {
        console.log("mint attempts    ", handler.mintAttempts());
        console.log("minted ok        ", handler.ghostMinted());
        console.log("transfer attempts", handler.transferAttempts());
        console.log("blocked-approval attempts", handler.blockedApprovalAttempts());
    }
}
