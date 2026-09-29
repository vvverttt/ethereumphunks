// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PhilipLotteryV67Erc721} from "../contracts/PhilipLotteryV67_CarlRouting.sol";
import {MockVRFWrapper} from "../contracts/mock/MockVRFWrapper.sol";

contract MockNFT {
    mapping(uint256 => address) public raw;
    function isImageSet(uint256) external pure returns (bool) { return true; }
    function ownerOfRaw(uint256 id) external view returns (address) { return raw[id]; }
    function mintFromLottery(address to, uint256 id) external { raw[id] = to; }
    function transferFromLottery(address to, uint256 id) external { raw[id] = to; }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return false; }
}
contract MockVault { function recordBacking(uint256, address, uint256, uint256) external {} }

/**
 * @title CarlRouting
 * @notice Unit + fuzz coverage for the CARL bond-routing addition. Verifies:
 *   1. previewCarlSplit never creates/destroys value (toTreasury + toCarl == amount, for ANY inputs).
 *   2. carlRouteBps can never be set above 10,000 (100%).
 *   3. The master switch (carlRoutingEnabled=false) always yields 100% to treasury, regardless of
 *      whatever bps/router are configured — the "turn it off if need" requirement.
 *   4. A zero router address always yields 100% to treasury even if enabled+bps are set (second
 *      independent safety switch).
 *   5. Only the owner can touch any of the three CARL setters.
 *   6. End-to-end: a real requestMint -> VRF fulfill actually credits the split correctly via the
 *      existing pull-payment ledger (pendingRefunds), and both parties can withdraw their share.
 *   7. Existing money-safety invariant (committed + refunds <= balance) still holds with routing on.
 */
contract CarlRoutingTest is Test {
    PhilipLotteryV67Erc721 lot;
    MockVRFWrapper wrap;
    MockNFT nft;
    MockVault vault;
    address owner = address(this);
    address carlRouter = makeAddr("carlBondRouter");
    address player = makeAddr("player");

    uint256 constant VRF_COST = 0.001 ether;

    function setUp() public {
        nft = new MockNFT();
        vault = new MockVault();
        wrap = new MockVRFWrapper(VRF_COST);
        PhilipLotteryV67Erc721 impl = new PhilipLotteryV67Erc721();
        bytes memory init = abi.encodeCall(PhilipLotteryV67Erc721.initialize, (address(nft), payable(owner)));
        lot = PhilipLotteryV67Erc721(payable(address(new ERC1967Proxy(address(impl), init))));
        lot.setVRFConfig(address(wrap), 500000, 3);
        lot.setLotteryConfig(0.0967 ether, 8, true);
        lot.setVault(address(vault));
        // >100 tokens so a fuzzed qty in [1,8] never trips SINGLE_MINT_ONLY_THRESHOLD (pool<=100 => qty must be 1).
        uint256[] memory ids = new uint256[](150);
        for (uint256 i; i < 150; i++) ids[i] = i + 1;
        lot.addPoolTokens(ids);
    }

    // ─────────────────────────── (1) split never creates/destroys value ───────────────────────────

    function testFuzz_previewSplitConservesValue(uint256 amount, uint16 bps, bool enabled, bool setRouter) public {
        amount = bound(amount, 0, 1_000_000 ether);
        bps = uint16(bound(bps, 0, lot.BPS()));
        lot.setCarlRoutingEnabled(enabled);
        lot.setCarlRouteBps(bps);
        lot.setCarlBondRouter(setRouter ? carlRouter : address(0));

        (uint256 toTreasury, uint256 toCarl) = lot.previewCarlSplit(amount);
        assertEq(toTreasury + toCarl, amount, "split must conserve total value");
    }

    // ─────────────────────────── (2) bps hard cap ───────────────────────────

    /// bound, not vm.assume. BPS() is 10,000 and the input is a uint16, so only ~35% of the
    /// range satisfies `> cap` — vm.assume discards the rest, and at high run counts that
    /// exhausts Foundry's 65,536-rejection budget and fails the run for no reason. bound maps
    /// every input into the valid range instead of throwing most of them away, so this holds
    /// at any --fuzz-runs.
    function testFuzz_setCarlRouteBps_revertsAboveCap(uint16 bps) public {
        bps = uint16(bound(bps, uint256(lot.BPS()) + 1, type(uint16).max));
        vm.expectRevert(PhilipLotteryV67Erc721.BpsTooHigh.selector);
        lot.setCarlRouteBps(bps);
    }

    function testFuzz_setCarlRouteBps_acceptsAtOrBelowCap(uint16 bps) public {
        bps = uint16(bound(bps, 0, lot.BPS()));
        lot.setCarlRouteBps(bps);
        assertEq(lot.carlRouteBps(), bps);
    }

    // ─────────────────────────── (3) master switch: OFF => 100% treasury, always ───────────────────────────

    function testFuzz_routingDisabled_alwaysFullyToTreasury(uint256 amount, uint16 bps, address router) public {
        amount = bound(amount, 0, 1_000_000 ether);
        bps = uint16(bound(bps, 0, lot.BPS()));
        lot.setCarlRouteBps(bps);
        lot.setCarlBondRouter(router);
        lot.setCarlRoutingEnabled(false);   // explicitly OFF regardless of bps/router

        (uint256 toTreasury, uint256 toCarl) = lot.previewCarlSplit(amount);
        assertEq(toCarl, 0, "no CARL credit while routing disabled");
        assertEq(toTreasury, amount, "100% must go to treasury while routing disabled");
    }

    // ─────────────────────────── (4) zero router => 100% treasury even if enabled+bps set ───────────────────────────

    function testFuzz_zeroRouter_alwaysFullyToTreasury(uint256 amount, uint16 bps) public {
        amount = bound(amount, 0, 1_000_000 ether);
        bps = uint16(bound(bps, 1, lot.BPS())); // nonzero on purpose
        lot.setCarlRoutingEnabled(true);
        lot.setCarlRouteBps(bps);
        lot.setCarlBondRouter(address(0));      // never set

        (uint256 toTreasury, uint256 toCarl) = lot.previewCarlSplit(amount);
        assertEq(toCarl, 0, "no CARL credit with a zero router address");
        assertEq(toTreasury, amount);
    }

    // ─────────────────────────── (5) access control on the three setters ───────────────────────────

    function testFuzz_onlySetCarlBondRouter(address caller, address router) public {
        vm.assume(caller != owner);
        vm.prank(caller);
        vm.expectRevert();
        lot.setCarlBondRouter(router);
    }

    function testFuzz_onlySetCarlRouteBps(address caller, uint16 bps) public {
        vm.assume(caller != owner);
        bps = uint16(bound(bps, 0, lot.BPS()));
        vm.prank(caller);
        vm.expectRevert();
        lot.setCarlRouteBps(bps);
    }

    function testFuzz_onlySetCarlRoutingEnabled(address caller, bool enabled) public {
        vm.assume(caller != owner);
        vm.prank(caller);
        vm.expectRevert();
        lot.setCarlRoutingEnabled(enabled);
    }

    // ─────────────────────────── (6) end-to-end: real mint actually splits + both sides withdraw ───────────────────────────

    function testFuzz_endToEnd_splitCreditsAndWithdraws(uint16 bps, uint8 qty) public {
        bps = uint16(bound(bps, 0, lot.BPS()));
        qty = uint8(bound(qty, 1, 8));
        lot.setCarlBondRouter(carlRouter);
        lot.setCarlRouteBps(bps);
        lot.setCarlRoutingEnabled(true);

        uint256 pay = lot.mintPrice() * qty + VRF_COST;
        vm.deal(player, pay);
        address[] memory c;
        uint256[] memory t;
        vm.prank(player, player);
        lot.requestMint{value: pay}(qty, c, t);

        uint256 mintPayment = lot.mintPrice() * qty;
        (uint256 expectTreasury, uint256 expectCarl) = lot.previewCarlSplit(mintPayment);

        wrap.fulfill(wrap.lastRequestId(), uint256(keccak256(abi.encode("seed"))));

        assertEq(lot.pendingRefunds(owner), expectTreasury, "treasury credited the expected share");
        assertEq(lot.pendingRefunds(carlRouter), expectCarl, "carl router credited the expected share");

        // both sides can pull their own share via the existing pull-payment path — withdrawRefund()
        // reverts on a zero balance by design, so only pull a side whose expected share is nonzero
        // (bps=0 => treasury gets everything, CARL gets nothing; bps=10000 => the reverse).
        if (expectTreasury != 0) {
            uint256 treasuryBefore = owner.balance;
            lot.withdrawRefund();
            assertEq(owner.balance - treasuryBefore, expectTreasury);
        }

        if (expectCarl != 0) {
            vm.prank(carlRouter);
            lot.withdrawRefund();
            assertEq(carlRouter.balance, expectCarl);
        }
    }

    /// @notice Player refund path (surrender/stuck-spin) is completely untouched by CARL routing —
    ///         routing only ever splits the TREASURY's share, never what a player is owed.
    function testFuzz_playerRefundUnaffectedByRouting(uint16 bps) public {
        bps = uint16(bound(bps, 0, lot.BPS()));
        lot.setCarlBondRouter(carlRouter);
        lot.setCarlRouteBps(bps);
        lot.setCarlRoutingEnabled(true);

        uint256 pay = lot.mintPrice() * 1 + VRF_COST;
        vm.deal(player, pay);
        address[] memory c;
        uint256[] memory t;
        vm.prank(player, player);
        lot.requestMint{value: pay}(1, c, t);

        uint256 reqId = wrap.lastRequestId();
        vm.roll(block.number + 400); // past STUCK_SPIN_REFUND_DELAY
        vm.prank(player);
        lot.refundStuckSpin(reqId);

        assertEq(lot.pendingRefunds(player), lot.mintPrice(), "player refund is the FULL mint payment, untouched by CARL split");
        assertEq(lot.pendingRefunds(carlRouter), 0, "no CARL credit on a refunded (never-fulfilled) spin");
    }

    // ─────────────────────────── (7) money-safety invariant still holds with routing on ───────────────────────────

    function testFuzz_committedProtected_withRoutingOn(uint16 bps, uint8 qty) public {
        bps = uint16(bound(bps, 0, lot.BPS()));
        qty = uint8(bound(qty, 1, 8));
        lot.setCarlBondRouter(carlRouter);
        lot.setCarlRouteBps(bps);
        lot.setCarlRoutingEnabled(true);

        uint256 pay = lot.mintPrice() * qty + VRF_COST;
        vm.deal(player, pay);
        address[] memory c;
        uint256[] memory t;
        vm.prank(player, player);
        lot.requestMint{value: pay}(qty, c, t);
        wrap.fulfill(wrap.lastRequestId(), uint256(keccak256(abi.encode("seed2"))));

        assertGe(address(lot).balance, lot.totalCommittedETH() + lot.totalPendingRefunds());
    }

    receive() external payable {}
}
