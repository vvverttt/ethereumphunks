// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CryptoPhunksV67Flip} from "../contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTFlip.sol";
import {CryptoPhunksV67V2} from "../contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// V2 makes the operator controls retroactive.
///
/// Every test here is written as a PAIR where it matters: the same sequence is run against the
/// deployed implementation (Flip) and against V2, asserting the old one lets the transfer
/// through and the new one does not. A fix that is only tested on the fixed contract does not
/// show that it fixed anything.
contract QuantumPhunksNFTV2Test is Test {
    CryptoPhunksV67Flip v1;
    CryptoPhunksV67V2 v2;

    address owner = address(0xA0);
    address treasury = address(0x7EA5);
    address lottery = address(0x107);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address mkt = address(0x4A55);

    function setUp() public {
        v1 = CryptoPhunksV67Flip(address(new ERC1967Proxy(
            address(new CryptoPhunksV67Flip()),
            abi.encodeCall(CryptoPhunksV67Flip.initialize, ("CryptoPhunksV67", "QP", treasury, owner))
        )));
        // Flip's selector, not V2's: `initialize` is declared on the base and external, so it
        // does not resolve through the derived type. Same signature either way.
        v2 = CryptoPhunksV67V2(address(new ERC1967Proxy(
            address(new CryptoPhunksV67V2()),
            abi.encodeCall(CryptoPhunksV67Flip.initialize, ("CryptoPhunksV67", "QP", treasury, owner))
        )));
        vm.startPrank(owner);
        v1.setLottery(lottery);
        v2.setLottery(lottery);
        vm.stopPrank();
    }

    // ---- the bug, and that V2 fixes it ---------------------------------------

    /// Blanket approval (setApprovalForAll) granted before a block.
    function test_blanketApproval_v1_survives_block_v2_does_not() public {
        // --- V1: the deployed behaviour ---
        vm.prank(owner);  v1.ownerMint(alice, 1);
        vm.prank(alice);  v1.setApprovalForAll(mkt, true);
        vm.prank(owner);  v1.setBlockedOperator(mkt, true);

        vm.prank(mkt);
        v1.transferFrom(alice, bob, 1);
        assertEq(v1.ownerOf(1), bob, "V1 baseline: blocked operator still transferred");

        // --- V2: same sequence, now refused ---
        vm.prank(owner);  v2.ownerMint(alice, 1);
        vm.prank(alice);  v2.setApprovalForAll(mkt, true);
        vm.prank(owner);  v2.setBlockedOperator(mkt, true);

        assertFalse(v2.isApprovedForAll(alice, mkt), "V2: approval must read as revoked");
        vm.prank(mkt);
        vm.expectRevert();
        v2.transferFrom(alice, bob, 1);
        assertEq(v2.ownerOf(1), alice, "V2: token must not move");
    }

    /// Per-token approval (approve) goes through _getApproved, a different code path that a
    /// fix touching only isApprovedForAll would miss entirely.
    function test_perTokenApproval_v1_survives_block_v2_does_not() public {
        vm.prank(owner);  v1.ownerMint(alice, 1);
        vm.prank(alice);  v1.approve(mkt, 1);
        vm.prank(owner);  v1.setBlockedOperator(mkt, true);

        vm.prank(mkt);
        v1.transferFrom(alice, bob, 1);
        assertEq(v1.ownerOf(1), bob, "V1 baseline: per-token approval survived the block");

        vm.prank(owner);  v2.ownerMint(alice, 1);
        vm.prank(alice);  v2.approve(mkt, 1);
        vm.prank(owner);  v2.setBlockedOperator(mkt, true);

        assertEq(v2.getApproved(1), address(0), "V2: per-token approval must read as cleared");
        vm.prank(mkt);
        vm.expectRevert();
        v2.transferFrom(alice, bob, 1);
        assertEq(v2.ownerOf(1), alice);
    }

    /// Turning the whitelist ON must also void approvals held by operators that are not on it.
    /// This is the half that actually delivers "only tradable on our market".
    function test_enablingWhitelist_v1_leaves_old_approvals_live_v2_voids_them() public {
        vm.prank(owner);  v1.ownerMint(alice, 1);
        vm.prank(alice);  v1.setApprovalForAll(mkt, true);
        vm.prank(owner);  v1.setOperatorWhitelistEnabled(true);

        vm.prank(mkt);
        v1.transferFrom(alice, bob, 1);
        assertEq(v1.ownerOf(1), bob, "V1 baseline: whitelist did not void the old approval");

        vm.prank(owner);  v2.ownerMint(alice, 1);
        vm.prank(alice);  v2.setApprovalForAll(mkt, true);
        vm.prank(owner);  v2.setOperatorWhitelistEnabled(true);

        vm.prank(mkt);
        vm.expectRevert();
        v2.transferFrom(alice, bob, 1);
        assertEq(v2.ownerOf(1), alice);
    }

    /// ...and approving the operator restores it, so the switch is not one-way.
    function test_whitelisting_the_operator_restores_its_approval() public {
        vm.prank(owner);  v2.ownerMint(alice, 1);
        vm.prank(alice);  v2.setApprovalForAll(mkt, true);
        vm.startPrank(owner);
        v2.setOperatorWhitelistEnabled(true);
        v2.setApprovedOperator(mkt, true);
        vm.stopPrank();

        assertTrue(v2.isApprovedForAll(alice, mkt));
        vm.prank(mkt);
        v2.transferFrom(alice, bob, 1);
        assertEq(v2.ownerOf(1), bob);
    }

    /// Unblocking restores an approval that was never actually revoked in storage.
    function test_unblocking_restores_the_original_approval() public {
        vm.prank(owner);  v2.ownerMint(alice, 1);
        vm.prank(alice);  v2.setApprovalForAll(mkt, true);

        vm.prank(owner);  v2.setBlockedOperator(mkt, true);
        assertFalse(v2.isApprovedForAll(alice, mkt));

        vm.prank(owner);  v2.setBlockedOperator(mkt, false);
        assertTrue(v2.isApprovedForAll(alice, mkt), "approval should come back");
        vm.prank(mkt);
        v2.transferFrom(alice, bob, 1);
        assertEq(v2.ownerOf(1), bob);
    }

    // ---- what must NOT change ------------------------------------------------

    /// The owner of a token is not an "operator" and must always be able to move it.
    function test_owner_can_always_move_their_own_token() public {
        vm.prank(owner);  v2.ownerMint(alice, 1);
        vm.startPrank(owner);
        v2.setOperatorWhitelistEnabled(true);
        v2.setBlockedOperator(alice, true);   // even blocking the holder themselves
        vm.stopPrank();

        vm.prank(alice);
        v2.transferFrom(alice, bob, 1);
        assertEq(v2.ownerOf(1), bob, "holder must not be locked out of their own token");
    }

    /// The lottery path calls _update with auth = address(0), so it bypasses _isAuthorized
    /// entirely and must keep working however the operator flags are set.
    function test_lottery_transfer_unaffected() public {
        vm.prank(lottery); v2.mintFromLottery(lottery, 1);
        vm.startPrank(owner);
        v2.setOperatorWhitelistEnabled(true);
        v2.setBlockedOperator(lottery, true);
        vm.stopPrank();

        vm.prank(lottery);
        v2.transferFromLottery(alice, 1);
        assertEq(v2.ownerOf(1), alice);
    }

    /// Revoking must stay possible — otherwise enabling the whitelist would trap holders.
    function test_revoking_still_works_while_blocked() public {
        vm.prank(alice); v2.setApprovalForAll(mkt, true);
        vm.prank(owner); v2.setBlockedOperator(mkt, true);
        vm.prank(alice); v2.setApprovalForAll(mkt, false);   // must not revert
    }

    function test_minting_unaffected_by_operator_flags() public {
        vm.startPrank(owner);
        v2.setOperatorWhitelistEnabled(true);
        v2.ownerMint(alice, 1);
        vm.stopPrank();
        assertEq(v2.ownerOf(1), alice);
        assertEq(v2.totalSupply(), 1);
    }

    // ---- the status helper ----------------------------------------------------

    function test_operatorStatus_reports_the_reason() public {
        bool ok; string memory why;

        (ok, why) = v2.operatorStatus(alice, mkt);
        assertFalse(ok); assertEq(why, "no-approval");

        vm.prank(alice); v2.setApprovalForAll(mkt, true);
        (ok, why) = v2.operatorStatus(alice, mkt);
        assertTrue(ok); assertEq(why, "");

        vm.prank(owner); v2.setOperatorWhitelistEnabled(true);
        (ok, why) = v2.operatorStatus(alice, mkt);
        assertFalse(ok); assertEq(why, "not-whitelisted");

        vm.prank(owner); v2.setBlockedOperator(mkt, true);
        (ok, why) = v2.operatorStatus(alice, mkt);
        assertFalse(ok); assertEq(why, "blocked", "blocked must outrank not-whitelisted");
    }

    // ---- upgrade safety -------------------------------------------------------

    /// V2 adds no storage. Upgrading a live V1 proxy must preserve every value and every
    /// existing approval, and the fix must take effect immediately afterwards.
    function test_upgrade_preserves_state_and_applies_the_fix() public {
        vm.prank(owner);  v1.ownerMint(alice, 1);
        vm.prank(owner);  v1.setTokenImage(1, "data:image/png;base64,AAAA");
        vm.prank(alice);  v1.setApprovalForAll(mkt, true);
        vm.prank(owner);  v1.setBlockedOperator(mkt, true);

        uint256 supplyBefore = v1.totalSupply();
        string memory imgBefore = v1.tokenImage(1);

        // Deploy the impl BEFORE the prank: `new` is itself a call, so inlining it would spend
        // the prank on the deployment and run upgradeToAndCall as the test contract.
        address newImpl = address(new CryptoPhunksV67V2());
        vm.prank(owner);
        v1.upgradeToAndCall(newImpl, "");
        CryptoPhunksV67V2 up = CryptoPhunksV67V2(address(v1));

        assertEq(up.totalSupply(), supplyBefore, "supply moved");
        assertEq(up.tokenImage(1), imgBefore, "image moved");
        assertEq(up.ownerOf(1), alice, "ownership moved");
        assertEq(up.maxSupply(), 10000);
        assertEq(up.lottery(), lottery);
        assertTrue(up.blockedOperators(mkt), "block flag lost");

        // The fix is live the moment the upgrade lands.
        assertFalse(up.isApprovedForAll(alice, mkt));
        vm.prank(mkt);
        vm.expectRevert();
        up.transferFrom(alice, bob, 1);
    }

    // ---- fuzz -----------------------------------------------------------------

    /// However the three flags are set, an operator may transfer only when it holds an approval
    /// AND is not blocked AND (whitelist off OR it is approved). No combination escapes.
    function testFuzz_operator_transfers_iff_permitted(
        bool approvedByHolder, bool blocked, bool whitelistOn, bool onWhitelist
    ) public {
        vm.prank(owner); v2.ownerMint(alice, 1);

        if (approvedByHolder) { vm.prank(alice); v2.setApprovalForAll(mkt, true); }
        vm.startPrank(owner);
        if (blocked)     v2.setBlockedOperator(mkt, true);
        if (whitelistOn) v2.setOperatorWhitelistEnabled(true);
        if (onWhitelist) v2.setApprovedOperator(mkt, true);
        vm.stopPrank();

        bool shouldPass = approvedByHolder && !blocked && (!whitelistOn || onWhitelist);

        vm.prank(mkt);
        if (shouldPass) {
            v2.transferFrom(alice, bob, 1);
            assertEq(v2.ownerOf(1), bob);
        } else {
            vm.expectRevert();
            v2.transferFrom(alice, bob, 1);
            assertEq(v2.ownerOf(1), alice);
        }
    }
}
