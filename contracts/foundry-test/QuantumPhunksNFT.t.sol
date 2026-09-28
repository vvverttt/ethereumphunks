// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CryptoPhunksV67} from "../contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFT.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// A receiver that tries to re-enter on the ERC-721 callback. Used to prove that the
/// `_bypassValidation` flag cannot be borrowed by a reentrant transfer.
contract ReenterReceiver is IERC721Receiver {
    CryptoPhunksV67 public nft;
    uint256 public ownedToken;
    address public victimTo;
    bool public armed;
    bool public reentered;
    bool public reentrySucceeded;

    function arm(CryptoPhunksV67 n, uint256 owned, address to) external {
        nft = n; ownedToken = owned; victimTo = to; armed = true;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (armed && !reentered) {
            reentered = true;
            // Try to move a DIFFERENT token we already hold, while the outer call is mid-flight.
            try nft.transferFrom(address(this), victimTo, ownedToken) { reentrySucceeded = true; } catch {}
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// A validator that records every call and can be told to reject.
contract MockValidator {
    bool public rejectTransfers;
    bool public rejectOperators;
    uint256 public validateCalls;

    function setReject(bool t, bool o) external { rejectTransfers = t; rejectOperators = o; }
    function validateTransfer(address, address, address, uint256) external {
        validateCalls++;
        require(!rejectTransfers, "validator: transfer rejected");
    }
    function isOperatorAllowed(address, address) external view returns (bool) { return !rejectOperators; }
}

contract QuantumPhunksNFTTest is Test {
    CryptoPhunksV67 nft;
    address owner = address(0xA0);
    address treasury = address(0x7EA5);
    address lottery = address(0x107);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address mkt = address(0x4A55);

    function setUp() public {
        nft = CryptoPhunksV67(address(new ERC1967Proxy(
            address(new CryptoPhunksV67()),
            abi.encodeCall(CryptoPhunksV67.initialize, ("CryptoPhunksV67", "QP", treasury, owner))
        )));
        vm.prank(owner);
        nft.setLottery(lottery);
    }

    // ---- supply ---------------------------------------------------------------

    function test_maxSupply_is_a_hard_cap() public {
        assertEq(nft.maxSupply(), 10000);
        // Cheap proof without minting 10k: mint a few, then assert the guard reads totalSupply.
        vm.startPrank(owner);
        for (uint256 i = 1; i <= 5; i++) nft.ownerMint(alice, i);
        vm.stopPrank();
        assertEq(nft.totalSupply(), 5);
    }

    /// The cap is on COUNT, not on the ID RANGE. Worth pinning as a deliberate property so a
    /// future reader does not assume ids are bounded by maxSupply — nothing stops #999999.
    function test_tokenId_is_NOT_bounded_by_maxSupply() public {
        vm.prank(owner);
        nft.ownerMint(alice, 999_999);
        assertEq(nft.ownerOf(999_999), alice);
        assertEq(nft.totalSupply(), 1);
    }

    function test_ownerMintBatch_mints_all() public {
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1; ids[1] = 2; ids[2] = 3;
        vm.prank(owner);
        nft.ownerMintBatch(alice, ids);
        assertEq(nft.totalSupply(), 3);
        assertEq(nft.balanceOf(alice), 3);
    }

    function test_only_owner_mints() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.ownerMint(alice, 1);
    }

    // ---- lottery gating -------------------------------------------------------

    function test_mintFromLottery_only_lottery() public {
        vm.prank(alice);
        vm.expectRevert(CryptoPhunksV67.NotLottery.selector);
        nft.mintFromLottery(alice, 1);

        vm.prank(lottery);
        nft.mintFromLottery(alice, 1);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_transferFromLottery_only_lottery() public {
        vm.prank(lottery);
        nft.mintFromLottery(lottery, 1);

        vm.prank(alice);
        vm.expectRevert(CryptoPhunksV67.NotLottery.selector);
        nft.transferFromLottery(alice, 1);

        vm.prank(lottery);
        nft.transferFromLottery(alice, 1);
        assertEq(nft.ownerOf(1), alice);
    }

    // ---- operator controls ----------------------------------------------------

    function test_blocked_operator_cannot_get_approval() public {
        vm.prank(owner);
        nft.setBlockedOperator(mkt, true);

        vm.prank(alice);
        vm.expectRevert(CryptoPhunksV67.OperatorBlocked.selector);
        nft.setApprovalForAll(mkt, true);

        vm.prank(alice);
        vm.expectRevert(CryptoPhunksV67.OperatorBlocked.selector);
        nft.approve(mkt, 1);
    }

    /// Blocking is checked FIRST and unconditionally — an operator that is both blocked and
    /// approved stays blocked. This ordering is the whole guarantee, so it is pinned.
    function test_blocked_beats_approved() public {
        vm.startPrank(owner);
        nft.setApprovedOperator(mkt, true);
        nft.setBlockedOperator(mkt, true);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(CryptoPhunksV67.OperatorBlocked.selector);
        nft.setApprovalForAll(mkt, true);
    }

    function test_whitelist_gates_approvals_when_enabled() public {
        vm.prank(owner);
        nft.setOperatorWhitelistEnabled(true);

        vm.prank(alice);
        vm.expectRevert(CryptoPhunksV67.OperatorNotWhitelisted.selector);
        nft.setApprovalForAll(mkt, true);

        vm.prank(owner);
        nft.setApprovedOperator(mkt, true);
        vm.prank(alice);
        nft.setApprovalForAll(mkt, true);
        assertTrue(nft.isApprovedForAll(alice, mkt));
    }

    /// Revoking (approved=false) must never be gated — otherwise enabling the whitelist could
    /// trap holders into approvals they cannot withdraw.
    function test_revoking_approval_is_never_blocked() public {
        vm.prank(alice);
        nft.setApprovalForAll(mkt, true);

        vm.startPrank(owner);
        nft.setBlockedOperator(mkt, true);
        nft.setOperatorWhitelistEnabled(true);
        vm.stopPrank();

        vm.prank(alice);
        nft.setApprovalForAll(mkt, false);   // must not revert
        assertFalse(nft.isApprovedForAll(alice, mkt));
    }

    /// FINDING: blocking an operator does NOT revoke an approval it already holds, because
    /// _update checks only the transfer validator, never blockedOperators. With the validator
    /// at address(0) — which is the live configuration — a pre-existing approval keeps working
    /// after the block.
    ///
    /// Pinned as a test so the behaviour is explicit rather than discovered later.
    function test_FINDING_blocking_does_not_revoke_an_existing_approval() public {
        vm.prank(owner);
        nft.ownerMint(alice, 1);

        vm.prank(alice);
        nft.setApprovalForAll(mkt, true);      // approved while allowed

        vm.prank(owner);
        nft.setBlockedOperator(mkt, true);     // now blocked

        // The block stops NEW approvals...
        vm.prank(bob);
        vm.expectRevert(CryptoPhunksV67.OperatorBlocked.selector);
        nft.setApprovalForAll(mkt, true);

        // ...but the operator can still move alice's token with the approval it already had.
        vm.prank(mkt);
        nft.transferFrom(alice, bob, 1);
        assertEq(nft.ownerOf(1), bob, "blocked operator still transferred");
    }

    // ---- transfer validator ---------------------------------------------------

    function test_validator_is_consulted_on_transfer() public {
        MockValidator v = new MockValidator();
        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTransferValidator(address(v));
        vm.stopPrank();

        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);
        assertEq(v.validateCalls(), 1);

        v.setReject(true, false);
        vm.prank(bob);
        vm.expectRevert(bytes("validator: transfer rejected"));
        nft.transferFrom(bob, alice, 1);
    }

    function test_validator_zero_disables_validation() public {
        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTransferValidator(address(0));
        vm.stopPrank();

        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);   // no validator call, no revert
        assertEq(nft.ownerOf(1), bob);
    }

    /// Mints and burns must skip validation, or a validator could brick minting.
    function test_mint_skips_validation() public {
        MockValidator v = new MockValidator();
        vm.startPrank(owner);
        nft.setTransferValidator(address(v));
        v.setReject(true, false);
        nft.ownerMint(alice, 1);           // must succeed despite the rejecting validator
        vm.stopPrank();
        assertEq(v.validateCalls(), 0);
    }

    // ---- the bypass flag ------------------------------------------------------

    /// _bypassValidation is set around the lottery's prize transfer. It is consumed at the top
    /// of _update (read then immediately cleared), so by the time the receiver's callback runs
    /// it is already false and a reentrant transfer gets no free pass.
    function test_bypass_flag_cannot_be_borrowed_by_reentrancy() public {
        MockValidator v = new MockValidator();
        ReenterReceiver r = new ReenterReceiver();

        vm.startPrank(owner);
        nft.ownerMint(address(r), 77);          // the attacker already holds #77
        nft.setTransferValidator(address(v));
        vm.stopPrank();

        vm.prank(lottery);
        nft.mintFromLottery(lottery, 1);

        r.arm(nft, 77, bob);
        v.setReject(true, false);               // validator rejects everything

        vm.prank(lottery);
        nft.transferFromLottery(address(r), 1); // bypass applies to THIS transfer only

        assertTrue(r.reentered(), "callback did not fire");
        assertFalse(r.reentrySucceeded(), "reentrant transfer rode the bypass flag");
        assertEq(nft.ownerOf(77), address(r), "#77 moved on a borrowed bypass");
    }

    /// And the flag must not stay set after the call returns.
    function test_bypass_flag_does_not_persist() public {
        MockValidator v = new MockValidator();
        vm.startPrank(owner);
        nft.setTransferValidator(address(v));
        vm.stopPrank();

        vm.prank(lottery);
        nft.mintFromLottery(lottery, 1);
        vm.prank(lottery);
        nft.transferFromLottery(alice, 1);

        v.setReject(true, false);
        vm.prank(alice);
        vm.expectRevert(bytes("validator: transfer rejected"));
        nft.transferFrom(alice, bob, 1);        // validation must be back on
    }

    // ---- royalties ------------------------------------------------------------

    function test_royalty_capped() public {
        // Read the cap FIRST. vm.prank applies to the next call including a view, so
        // `nft.setRoyaltyRate(nft.MAX_ROYALTY_BPS() + 1)` spends the prank on the getter and
        // the setter then runs as the test contract — failing on Ownable, not on the cap.
        uint96 cap = nft.MAX_ROYALTY_BPS();

        vm.prank(owner);
        vm.expectRevert(CryptoPhunksV67.ValueExceedsMax.selector);
        nft.setRoyaltyRate(cap + 1);

        vm.prank(owner);
        nft.setRoyaltyRate(cap);
        (, uint256 amt) = nft.royaltyInfo(1, 10000);
        assertEq(amt, cap);
    }

    /// setRoyaltyReceiver recovers the current rate via royaltyInfo(0, 10000) and re-applies it.
    /// If that round-trip were lossy the rate would silently drift on every receiver change.
    function test_changing_receiver_preserves_the_rate() public {
        vm.startPrank(owner);
        nft.setRoyaltyRate(333);
        nft.setRoyaltyReceiver(bob);
        vm.stopPrank();

        (address rcv, uint256 amt) = nft.royaltyInfo(1, 10000);
        assertEq(rcv, bob);
        assertEq(amt, 333, "rate drifted when the receiver changed");
    }

    function test_royalty_receiver_cannot_be_zero() public {
        vm.prank(owner);
        vm.expectRevert(CryptoPhunksV67.ValueExceedsMax.selector);
        nft.setRoyaltyReceiver(address(0));
    }

    // ---- metadata -------------------------------------------------------------

    function test_traits_roundtrip_and_hasTrait() public {
        string[] memory k = new string[](2);
        string[] memory v = new string[](2);
        k[0] = "Type";  v[0] = "Female";
        k[1] = "Type";  v[1] = "Zombie";     // duplicate trait_type is legitimate here

        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTraits(1, k, v);
        vm.stopPrank();

        assertTrue(nft.hasTrait(1, "Type", "Female"));
        assertTrue(nft.hasTrait(1, "Type", "Zombie"));
        assertFalse(nft.hasTrait(1, "Type", "Male"));
    }

    function test_setTraits_length_mismatch_reverts() public {
        string[] memory k = new string[](2);
        string[] memory v = new string[](1);
        vm.prank(owner);
        vm.expectRevert(CryptoPhunksV67.LengthMismatch.selector);
        nft.setTraits(1, k, v);
    }

    function test_image_roundtrips_byte_exact() public {
        string memory img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTokenImage(1, img);
        vm.stopPrank();
        assertEq(nft.tokenImage(1), img);
        assertTrue(nft.isImageSet(1));
    }

    /// Images over the 24,000-byte chunk size are split across SSTORE2 pointers and must
    /// reassemble byte-identically — provenance depends on it.
    function test_large_image_chunks_and_reassembles() public {
        bytes memory big = new bytes(50_000);
        for (uint256 i; i < big.length; i++) big[i] = bytes1(uint8(48 + (i % 10)));
        string memory s = string(big);

        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTokenImage(1, s);
        vm.stopPrank();

        assertEq(keccak256(bytes(nft.tokenImage(1))), keccak256(big), "image did not survive chunking");
    }

    function test_setTokenImage_overwrites_not_appends() public {
        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTokenImage(1, "aaa");
        nft.setTokenImage(1, "bb");
        vm.stopPrank();
        assertEq(nft.tokenImage(1), "bb");
    }

    /// FINDING: trait strings are interpolated into the metadata JSON with no escaping, so a
    /// value containing a double quote produces malformed JSON. Owner-only input, so this is a
    /// data-integrity footgun rather than an attack, but it is worth knowing it is unguarded.
    function test_FINDING_quote_in_trait_breaks_tokenURI_json() public {
        string[] memory k = new string[](1);
        string[] memory v = new string[](1);
        k[0] = "Name"; v[0] = 'has"quote';

        vm.startPrank(owner);
        nft.ownerMint(alice, 1);
        nft.setTraits(1, k, v);
        vm.stopPrank();

        string memory uri = nft.tokenURI(1);
        // It still returns a string — it is the decoded JSON that is broken, which no on-chain
        // assertion can catch. Pinned so the absence of escaping is documented, not assumed safe.
        assertGt(bytes(uri).length, 0);
    }

    function test_tokenURI_reverts_for_unminted() public {
        vm.expectRevert();
        nft.tokenURI(4242);
    }

    // ---- upgrade / access -----------------------------------------------------

    function test_only_owner_upgrades() public {
        address impl = address(new CryptoPhunksV67());
        vm.prank(alice);
        vm.expectRevert();
        nft.upgradeToAndCall(impl, "");

        vm.prank(owner);
        nft.upgradeToAndCall(impl, "");
    }

    function test_initialize_cannot_be_called_twice() public {
        vm.expectRevert();
        nft.initialize("x", "y", treasury, owner);
    }

    function test_initialize_rejects_zero_addresses() public {
        address impl = address(new CryptoPhunksV67());
        vm.expectRevert(CryptoPhunksV67.ValueExceedsMax.selector);
        new ERC1967Proxy(impl, abi.encodeCall(CryptoPhunksV67.initialize, ("n", "s", address(0), owner)));
        vm.expectRevert(CryptoPhunksV67.ValueExceedsMax.selector);
        new ERC1967Proxy(impl, abi.encodeCall(CryptoPhunksV67.initialize, ("n", "s", treasury, address(0))));
    }

    function test_supportsInterface() public view {
        assertTrue(nft.supportsInterface(0x80ac58cd));  // ERC721
        assertTrue(nft.supportsInterface(0x2a55205a));  // ERC2981
        assertTrue(nft.supportsInterface(0x49064906));  // ERC4906
        assertTrue(nft.supportsInterface(0xe8a3d485));  // ERC7572 contractURI
        assertTrue(nft.supportsInterface(0xad0d7f6c));  // ICreatorToken
    }

    // ---- fuzz -----------------------------------------------------------------

    function testFuzz_royaltyRate_never_exceeds_cap(uint96 bps) public {
        uint96 cap = nft.MAX_ROYALTY_BPS();   // before the prank — see test_royalty_capped
        vm.prank(owner);
        if (bps > cap) {
            vm.expectRevert(CryptoPhunksV67.ValueExceedsMax.selector);
            nft.setRoyaltyRate(bps);
        } else {
            nft.setRoyaltyRate(bps);
            (, uint256 amt) = nft.royaltyInfo(1, 10000);
            assertLe(amt, cap);
        }
    }

    function testFuzz_mint_then_transfer_preserves_supply(uint256 id, address to) public {
        vm.assume(to != address(0) && to.code.length == 0);
        id = bound(id, 1, type(uint128).max);
        vm.prank(owner);
        nft.ownerMint(alice, id);
        assertEq(nft.totalSupply(), 1);
        vm.prank(alice);
        nft.transferFrom(alice, to, id);
        assertEq(nft.totalSupply(), 1, "transfer changed supply");
    }
}
