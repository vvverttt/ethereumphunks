// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {EtherPhunksAuctionHouseV6} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV6.sol";
import {EtherPhunksAuctionHouseV7} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV7.sol";
import {EtherPhunksAuctionHouseV2} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// V7 retires the two buy-now paths V6 left behind, and rejects a zero points address.
///
/// Written as PAIRS where it matters: the same call against V6 and against V7, asserting V6
/// lets it through and V7 does not. A retirement tested only on the retired version does not
/// show that anything was retired.
contract AuctionV7Test is Test {
    EtherPhunksAuctionHouseV6 v6;
    EtherPhunksAuctionHouseV7 v7;

    address owner = address(0xA0);
    address payable treasury = payable(address(0x7EA5));
    address alice = address(0xA11CE);

    function setUp() public {
        vm.startPrank(owner);
        v6 = EtherPhunksAuctionHouseV6(payable(address(new ERC1967Proxy(
            address(new EtherPhunksAuctionHouseV6()),
            abi.encodeCall(EtherPhunksAuctionHouseV2.initialize, (86400, 300, 5, 0.1 ether, address(0), treasury))
        ))));
        v7 = EtherPhunksAuctionHouseV7(payable(address(new ERC1967Proxy(
            address(new EtherPhunksAuctionHouseV7()),
            abi.encodeCall(EtherPhunksAuctionHouseV2.initialize, (86400, 300, 5, 0.1 ether, address(0), treasury))
        ))));
        vm.stopPrank();
        vm.deal(alice, 100 ether);
    }

    // ---- the gap V6 left -----------------------------------------------------

    /// On V6 the SETTER works, so buy-now can be armed. On V7 it cannot.
    function test_setBuyNow2_v6_arms_it_v7_refuses() public {
        bytes32 root = keccak256("wl");

        vm.prank(owner);
        v6.setBuyNow2(root, 0.167 ether, true);          // V6: succeeds — this is the gap
        assertTrue(v6.buyNow2Enabled(), "V6 baseline: buy-now armed");
        assertEq(v6.buyNow2Price(), 0.167 ether);

        vm.prank(owner);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.setBuyNow2(root, 0.167 ether, true);          // V7: cannot be armed
        assertFalse(v7.buyNow2Enabled(), "V7: must stay disarmed");
    }

    function test_setBuyNow_v6_arms_it_v7_refuses() public {
        vm.prank(owner);
        v6.setBuyNow(keccak256("wl"), 0.367 ether, true);
        assertTrue(v6.buyNowEnabled(), "V6 baseline");

        vm.prank(owner);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.setBuyNow(keccak256("wl"), 0.367 ether, true);
        assertFalse(v7.buyNowEnabled());
    }

    /// The buy paths themselves revert on V7 regardless of any state.
    function test_buyNow_is_retired() public {
        vm.prank(alice, alice);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.buyNow{value: 1 ether}(new bytes32[](0));
    }

    function test_buyNow2_is_retired() public {
        vm.prank(alice, alice);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.buyNow2{value: 1 ether}(new bytes32[](0));
    }

    /// An ALREADY-ARMED config must not survive the upgrade as something callable. This is the
    /// mainnet case: buyNow2Enabled was true with a live price and root behind a pause.
    function test_armed_config_cannot_be_used_after_upgrade() public {
        vm.prank(owner);
        v6.setBuyNow2(keccak256("wl"), 0.167 ether, true);
        assertTrue(v6.buyNow2Enabled());

        // The live auction house is a TRANSPARENT proxy, so upgradeToAndCall is on the
        // ProxyAdmin, not the implementation — there is no method to call here. Writing the
        // ERC-1967 implementation slot directly is the faithful equivalent for a unit test:
        // same storage, new code, which is exactly what the admin's upgrade does.
        address impl = address(new EtherPhunksAuctionHouseV7());
        vm.store(
            address(v6),
            0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc,
            bytes32(uint256(uint160(impl)))
        );
        EtherPhunksAuctionHouseV7 up = EtherPhunksAuctionHouseV7(payable(address(v6)));

        // The stored flag is still true — storage is deliberately untouched...
        assertTrue(up.buyNow2Enabled(), "flag remains set, by design");
        assertEq(up.buyNow2Price(), 0.167 ether);

        // ...but nothing can act on it any more.
        vm.prank(alice, alice);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        up.buyNow2{value: 0.167 ether}(new bytes32[](0));
    }

    // ---- the zero-address fix -------------------------------------------------

    function test_setPointsAddress_v6_accepts_zero_v7_rejects() public {
        vm.prank(owner);
        v6.setPointsAddress(address(0));                 // V6: silently accepted
        assertEq(v6.pointsAddress(), address(0), "V6 baseline: zero accepted");

        vm.prank(owner);
        vm.expectRevert(EtherPhunksAuctionHouseV7.PointsAddressZero.selector);
        v7.setPointsAddress(address(0));
    }

    function test_setPointsAddress_still_accepts_a_real_address() public {
        vm.prank(owner);
        v7.setPointsAddress(address(0xBEEF));
        assertEq(v7.pointsAddress(), address(0xBEEF));
    }

    function test_setPointsAddress_only_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        v7.setPointsAddress(address(0xBEEF));
    }

    // ---- V6's retirements still hold -----------------------------------------

    function test_v6_retirements_survive() public {
        vm.prank(alice, alice);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.buyItem{value: 1 ether}(keccak256("x"), 0, new bytes32[](0));

        vm.prank(alice, alice);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.swap{value: 0}(keccak256("a"), keccak256("b"), new bytes32[](0));
    }

    function test_retiredFeaturesV7_lists_all_twelve() public view {
        string[] memory l = v7.retiredFeaturesV7();
        assertEq(l.length, 12);
        assertEq(l[0], "buyItem");
        assertEq(l[8], "buyNow");
        assertEq(l[9], "buyNow2");
        assertEq(l[11], "setBuyNow2");
    }

    // ---- nothing else moves ---------------------------------------------------

    function test_core_auction_surface_unchanged() public view {
        assertEq(v7.owner(), owner);
        assertEq(v7.treasuryAddress(), treasury);
        assertEq(v7.availableETH(), 0);
        assertEq(v7.totalPendingReturns(), 0);
    }

    function testFuzz_buyNow2_reverts_for_any_caller_and_value(address who, uint96 val) public {
        vm.assume(who != address(0) && who.code.length == 0);
        vm.deal(who, uint256(val) + 1 ether);
        vm.prank(who, who);
        vm.expectRevert(EtherPhunksAuctionHouseV6.Retired.selector);
        v7.buyNow2{value: val}(new bytes32[](0));
    }
}
