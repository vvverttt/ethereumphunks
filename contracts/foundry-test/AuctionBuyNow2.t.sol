// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {EtherPhunksAuctionHouseV2} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV2.sol";
import {EtherPhunksAuctionHouseV4} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV4.sol";

/// Focused checks for the V4 second buy-now tier. The buyNow2 execution path is a line-for-line copy
/// of the audited, live V3 buyNow, so this covers the NEW surface: setBuyNow2 guards/owner-gate, the
/// early reverts, and that tier-1 and tier-2 config are fully independent.
contract AuctionBuyNow2Test is Test {
    EtherPhunksAuctionHouseV4 a;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    bytes32 constant ROOT = 0x489c11e3222b36770259545fb6134b9057f5cb3076347ddf37de50beca86a6a7;

    function setUp() public {
        EtherPhunksAuctionHouseV4 impl = new EtherPhunksAuctionHouseV4();
        bytes memory init = abi.encodeCall(
            EtherPhunksAuctionHouseV2.initialize,
            (86400, 300, 10, 0.367 ether, address(0), payable(treasury))
        );
        a = EtherPhunksAuctionHouseV4(payable(address(new ERC1967Proxy(address(impl), init))));
    }

    function test_setBuyNow2_ownerOnly() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        a.setBuyNow2(ROOT, 0.167 ether, true);
    }

    function test_setBuyNow2_guard_zeroPrice() public {
        vm.expectRevert(bytes("Price must be > 0"));
        a.setBuyNow2(ROOT, 0, true);
    }

    function test_setBuyNow2_guard_zeroRoot() public {
        vm.expectRevert(bytes("Root must be set"));
        a.setBuyNow2(bytes32(0), 0.167 ether, true);
    }

    function test_setBuyNow2_configReadback() public {
        a.setBuyNow2(ROOT, 0.167 ether, true);
        assertEq(a.buyNow2MerkleRoot(), ROOT);
        assertEq(a.buyNow2Price(), 0.167 ether);
        assertTrue(a.buyNow2Enabled());
    }

    function test_buyNow2_disabled_reverts() public {
        bytes32[] memory proof = new bytes32[](0);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(bytes("Buy-now disabled"));
        a.buyNow2{value: 0.167 ether}(proof);
    }

    function test_buyNow2_noActiveAuction_reverts() public {
        a.setBuyNow2(ROOT, 0.167 ether, true);
        bytes32[] memory proof = new bytes32[](0);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(bytes("No active auction"));
        a.buyNow2{value: 0.167 ether}(proof);
    }

    /// The two tiers are fully independent: configuring one never touches the other.
    function test_tiers_independent() public {
        a.setBuyNow(ROOT, 0.267 ether, true);      // tier 1
        a.setBuyNow2(ROOT, 0.167 ether, true);      // tier 2
        assertEq(a.buyNowPrice(), 0.267 ether);
        assertEq(a.buyNow2Price(), 0.167 ether);
        // disabling tier 1 leaves tier 2 intact
        a.setBuyNow(bytes32(0), 0, false);
        assertFalse(a.buyNowEnabled());
        assertTrue(a.buyNow2Enabled());
        assertEq(a.buyNow2Price(), 0.167 ether);
    }
}
