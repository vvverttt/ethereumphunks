// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {EtherPhunksAuctionHouseV2} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV2.sol";
import {EtherPhunksAuctionHouseV5} from "../contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV5.sol";

/// Focused checks for the V5 per-item buy-now ("buyItem"): buy ANY pool item outright at one of three
/// fixed tiers (2 EthsRocks / 1 Missing-Dysto / 0 PUBLIC), no auction. Covers the new surface: the
/// owner config guards, tier gating + prices, the merkle gate for tiers 1/2, the no-whitelist public
/// tier, the full happy path (item leaves pool + escrow transfer + treasury paid), and the KEY
/// invariant that buyItem keeps working while the house is paused (auctions off = paused).
contract AuctionBuyItemV5Test is Test {
    EtherPhunksAuctionHouseV5 a;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");   // whitelisted (single-leaf tree below)
    address bob = makeAddr("bob");       // not whitelisted
    bytes32 constant ITEM = bytes32(uint256(0xC0FFEE));

    // Mirror of V5's event for vm.expectEmit matching.
    event ItemBought(bytes32 indexed hashId, address indexed buyer, uint256 amount, uint8 tier);

    // Single-leaf merkle tree: root == keccak256(abi.encodePacked(leaf-account)), proof is empty.
    bytes32 aliceRoot;
    bytes32[] emptyProof;

    function setUp() public {
        EtherPhunksAuctionHouseV5 impl = new EtherPhunksAuctionHouseV5();
        bytes memory init = abi.encodeCall(
            EtherPhunksAuctionHouseV2.initialize,
            (86400, 300, 10, 0.367 ether, address(0), payable(treasury))
        );
        a = EtherPhunksAuctionHouseV5(payable(address(new ERC1967Proxy(address(impl), init))));

        aliceRoot = keccak256(abi.encodePacked(alice));

        // Deposit ITEM into the pool via the owner-only fallback (this test contract is the owner).
        (bool ok, ) = address(a).call(abi.encodePacked(ITEM));
        require(ok, "deposit failed");
        assertTrue(a.inPool(ITEM));

        // Deposits stamp received-block = 1; roll past the 5-block escrow cooldown so transfers pass.
        vm.roll(100);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // ─── Owner config ─────────────────────────────────────────

    function test_setBuyNowPublic_ownerOnly() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        a.setBuyNowPublic(0.367 ether, true);
    }

    function test_setBuyNowPublic_guard_zeroPrice() public {
        vm.expectRevert(bytes("Price must be > 0"));
        a.setBuyNowPublic(0, true);
    }

    function test_setBuyNowPublic_readback() public {
        a.setBuyNowPublic(0.367 ether, true);
        assertEq(a.buyNowPublicPrice(), 0.367 ether);
        assertTrue(a.buyNowPublicEnabled());
    }

    function test_setItemBuyNowEnabled_ownerOnly() public {
        vm.prank(alice);
        vm.expectRevert();
        a.setItemBuyNowEnabled(true);
    }

    // ─── Master switch + availability gating ──────────────────

    function test_buyItem_masterDisabled_reverts() public {
        a.setBuyNowPublic(0.367 ether, true); // tier configured, but master off
        vm.prank(alice);
        vm.expectRevert(bytes("Item buy-now disabled"));
        a.buyItem{value: 0.367 ether}(ITEM, 0, emptyProof);
    }

    function test_buyItem_notInPool_reverts() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNowPublic(0.367 ether, true);
        bytes32 missing = bytes32(uint256(0xDEAD));
        vm.prank(alice);
        vm.expectRevert(bytes("Not available"));
        a.buyItem{value: 0.367 ether}(missing, 0, emptyProof);
    }

    function test_buyItem_publicTierDisabled_reverts() public {
        a.setItemBuyNowEnabled(true); // master on, public tier NOT enabled
        vm.prank(bob);
        vm.expectRevert(bytes("Tier disabled"));
        a.buyItem{value: 0.367 ether}(ITEM, 0, emptyProof);
    }

    function test_buyItem_belowPrice_reverts() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNowPublic(0.367 ether, true);
        vm.prank(bob);
        vm.expectRevert(bytes("Below buy-now price"));
        a.buyItem{value: 0.3 ether}(ITEM, 0, emptyProof);
    }

    // ─── Public tier (tier 0, no whitelist) happy path ────────

    function test_buyItem_public_succeeds() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNowPublic(0.367 ether, true);

        uint256 treasuryBefore = treasury.balance;

        vm.expectEmit(true, true, false, true, address(a));
        emit ItemBought(ITEM, bob, 0.367 ether, 0);

        vm.prank(bob);
        a.buyItem{value: 0.367 ether}(ITEM, 0, emptyProof);

        assertFalse(a.inPool(ITEM), "item should leave pool");
        assertEq(a.depositor(ITEM), address(0), "depositor cleared");
        assertEq(treasury.balance - treasuryBefore, 0.367 ether, "treasury paid");
    }

    /// THE key invariant: auctions are disabled by pausing the house, and buy-now must survive that.
    function test_buyItem_worksWhilePaused() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNowPublic(0.367 ether, true);
        a.pause();

        vm.prank(bob);
        a.buyItem{value: 0.367 ether}(ITEM, 0, emptyProof);
        assertFalse(a.inPool(ITEM));
    }

    // ─── Whitelist tier 1 (Missing/Dysto @ buyNowPrice) ───────

    function test_buyItem_tier1_whitelisted_succeeds() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNow(aliceRoot, 0.267 ether, true); // tier 1 root/price/switch (V3 setter)

        vm.prank(alice);
        a.buyItem{value: 0.267 ether}(ITEM, 1, emptyProof);
        assertFalse(a.inPool(ITEM));
    }

    function test_buyItem_tier1_wrongWallet_reverts() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNow(aliceRoot, 0.267 ether, true);
        vm.prank(bob); // not in the single-leaf tree
        vm.expectRevert(bytes("Not whitelisted"));
        a.buyItem{value: 0.267 ether}(ITEM, 1, emptyProof);
    }

    function test_buyItem_tier1_disabled_reverts() public {
        a.setItemBuyNowEnabled(true); // tier 1 not configured/enabled
        vm.prank(alice);
        vm.expectRevert(bytes("Tier disabled"));
        a.buyItem{value: 0.267 ether}(ITEM, 1, emptyProof);
    }

    // ─── Whitelist tier 2 (EthsRocks @ buyNow2Price) ──────────

    function test_buyItem_tier2_whitelisted_succeeds() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNow2(aliceRoot, 0.167 ether, true); // tier 2 root/price/switch (V4 setter)

        vm.prank(alice);
        a.buyItem{value: 0.167 ether}(ITEM, 2, emptyProof);
        assertFalse(a.inPool(ITEM));
    }

    /// Buying the same item twice must fail — it is gone from the pool after the first buy.
    function test_buyItem_doubleBuy_reverts() public {
        a.setItemBuyNowEnabled(true);
        a.setBuyNowPublic(0.367 ether, true);

        vm.prank(bob);
        a.buyItem{value: 0.367 ether}(ITEM, 0, emptyProof);

        vm.prank(alice);
        vm.expectRevert(bytes("Not available"));
        a.buyItem{value: 0.367 ether}(ITEM, 0, emptyProof);
    }
}
