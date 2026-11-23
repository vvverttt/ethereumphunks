// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Phunksmas} from "../../contracts/V2MainnetUpgrade/QuantumCollections/Phunksmas.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract Receiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// Receiver that tries to mint more during the safeMint callback (must fail: not owner).
contract ReentrantMinter is IERC721Receiver {
    Phunksmas public nft; bool public tried; bool public succeeded;
    function set(Phunksmas n) external { nft = n; }
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (!tried) {
            tried = true;
            try nft.ownerMint(address(this), 10520) { succeeded = true; } catch {}
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

abstract contract Base is Test {
    Phunksmas nft;
    address owner = makeAddr("owner");
    uint256 constant FIRST = 10454;
    uint256 constant LAST = 10520;

    function _deployBare() internal returns (Phunksmas) {
        return new Phunksmas("Phunksmas", "PHMAS", owner);
    }
    function _deploy() internal returns (Phunksmas n) {
        n = _deployBare();
        uint256[] memory ids = new uint256[](67); string[] memory imgs = new string[](67);
        for (uint256 i; i < 67; ++i) { ids[i] = FIRST + i; imgs[i] = "data:image/png;base64,AAAA"; }
        vm.prank(owner); n.setTokenImageBatch(ids, imgs);
    }
    function _all() internal pure returns (uint256[] memory ids) {
        ids = new uint256[](67); for (uint256 i; i < 67; ++i) ids[i] = FIRST + i;
    }
    function _eoa(address a) internal view returns (bool) {
        return a != address(0) && a.code.length == 0 && a != address(nft) && uint160(a) > 0x10000;
    }
}

contract PhunksmasFuzz is Base {
    function setUp() public { nft = _deploy(); }

    // ---------- deploy / not upgradeable ----------
    function test_initState() public view {
        assertEq(nft.name(), "Phunksmas");
        assertEq(nft.symbol(), "PHMAS");
        assertEq(nft.owner(), owner);
        assertEq(nft.maxSupply(), 67);
        assertEq(nft.totalSupply(), 0);
        assertEq(nft.backgroundColor(), "638596");
        assertEq(nft.FIRST_ID(), FIRST);
        assertEq(nft.LAST_ID(), LAST);
    }
    function test_constructorRejectsZeroOwner() public {
        vm.expectRevert();
        new Phunksmas("a", "b", address(0));
    }
    /// Not upgradeable: no UUPS / proxy entry points exist on the contract at all.
    function test_notUpgradeable() public {
        (bool ok,) = address(nft).call(abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(1), ""));
        assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("proxiableUUID()"));
        assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("initialize(string,string,address)", "x", "y", address(this)));
        assertFalse(ok);
        // no EIP-1967 implementation slot in use: this is the code itself, not a proxy
        bytes32 implSlot = 0x360894a13ba1a3211667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        assertEq(vm.load(address(nft), implSlot), bytes32(0));
    }
    function test_renounceOnlyAfterAll67() public {
        vm.startPrank(owner);
        nft.ownerMint(owner, FIRST);
        vm.expectRevert(Phunksmas.NotAllMinted.selector); nft.renounceOwnership();
        vm.stopPrank();
        assertEq(nft.owner(), owner);
    }
    function test_renounceFreezesEverything() public {
        vm.startPrank(owner);
        nft.ownerMintBatch(owner, _all());
        nft.renounceOwnership();
        assertEq(nft.owner(), address(0));
        vm.expectRevert(); nft.setTokenImage(FIRST, "data:image/png;base64,BBBB");
        vm.expectRevert(); nft.setNameAndSymbol("a", "b");
        vm.expectRevert(); nft.setDescription("x");
        vm.stopPrank();
        assertEq(nft.ownerOf(FIRST), owner);   // holders unaffected
    }

    // ---------- access control on every admin function ----------
    function testFuzz_adminFunctionsOwnerOnly(address caller) public {
        vm.assume(caller != owner);
        uint256[] memory ids = new uint256[](1); ids[0] = FIRST;
        string[] memory s1 = new string[](1); s1[0] = "x";
        string[][] memory s2 = new string[][](1); s2[0] = s1;
        vm.startPrank(caller);
        vm.expectRevert(); nft.ownerMint(caller, FIRST);
        vm.expectRevert(); nft.ownerMintBatch(caller, ids);
        vm.expectRevert(); nft.setNameAndSymbol("a", "b");
        vm.expectRevert(); nft.setContractURI("x");
        vm.expectRevert(); nft.setTokenImage(FIRST, "x");
        vm.expectRevert(); nft.setTokenImageBatch(ids, s1);
        vm.expectRevert(); nft.clearTokenImage(FIRST);
        vm.expectRevert(); nft.addTokenImageChunk(FIRST, "x");
        vm.expectRevert(); nft.setDescription("x");
        vm.expectRevert(); nft.setTraits(FIRST, s1, s1);
        vm.expectRevert(); nft.batchSetTraits(ids, s2, s2);
        vm.expectRevert(); nft.setBackgroundColor("000000");
        vm.expectRevert(); nft.transferOwnership(caller);
        vm.expectRevert(); nft.renounceOwnership();
        vm.expectRevert(); nft.freeze(ids);
        vm.stopPrank();
    }

    // ---------- mint range + cap ----------
    function testFuzz_mintRange(uint256 id) public {
        address to = makeAddr("to");
        vm.prank(owner);
        if (id < FIRST || id > LAST) {
            vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector);
            nft.ownerMint(to, id);
        } else {
            nft.ownerMint(to, id);
            assertEq(nft.ownerOf(id), to);
            assertEq(nft.totalSupply(), 1);
        }
    }
    function test_fullDropThenNoMore() public {
        uint256[] memory ids = new uint256[](67);
        for (uint256 i; i < 67; ++i) ids[i] = FIRST + i;
        vm.startPrank(owner);
        nft.ownerMintBatch(owner, ids);
        assertEq(nft.totalSupply(), 67);
        vm.expectRevert(); nft.ownerMint(owner, FIRST);       // duplicate
        vm.expectRevert(); nft.ownerMint(owner, LAST + 1);    // out of range
        vm.stopPrank();
    }
    function testFuzz_noDoubleMint(uint8 off) public {
        uint256 id = FIRST + (uint256(off) % 67);
        vm.startPrank(owner);
        nft.ownerMint(owner, id);
        vm.expectRevert(); nft.ownerMint(makeAddr("b"), id);
        vm.stopPrank();
        assertEq(nft.totalSupply(), 1);
    }
    function test_mintCallbackCannotReenterMint() public {
        ReentrantMinter r = new ReentrantMinter(); r.set(nft);
        vm.prank(owner); nft.ownerMint(address(r), FIRST);
        assertTrue(r.tried()); assertFalse(r.succeeded());
        assertEq(nft.totalSupply(), 1);
    }

    // ---------- trade anywhere ----------
    function testFuzz_anyOperatorCanTrade(address holder, address op, address to, uint8 off) public {
        vm.assume(_eoa(holder) && _eoa(op) && _eoa(to) && holder != op);
        uint256 id = FIRST + (uint256(off) % 67);
        vm.prank(owner); nft.ownerMint(holder, id);
        vm.prank(holder); nft.setApprovalForAll(op, true);
        vm.prank(op); nft.transferFrom(holder, to, id);
        assertEq(nft.ownerOf(id), to);
        assertEq(nft.totalSupply(), 1);
    }
    function testFuzz_strangerCannotMove(address holder, address thief, uint8 off) public {
        vm.assume(_eoa(holder) && _eoa(thief) && holder != thief && holder != owner);
        uint256 id = FIRST + (uint256(off) % 67);
        vm.prank(owner); nft.ownerMint(holder, id);
        vm.prank(thief); vm.expectRevert(); nft.transferFrom(holder, thief, id);
        vm.prank(owner); vm.expectRevert(); nft.transferFrom(holder, owner, id);   // contract owner can't either
    }

    // ---------- royalty ----------
    function testFuzz_royaltyAlwaysZero(uint256 id, uint256 price) public view {
        (address r, uint256 amt) = nft.royaltyInfo(id, price);
        assertEq(r, address(0)); assertEq(amt, 0);
    }

    // ---------- images: chunked SSTORE2 round-trip is byte-exact ----------
    /// random base64-alphabet body (never contains " < >)
    function _body(uint256 seed, uint256 len) internal pure returns (bytes memory b) {
        bytes memory A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        b = new bytes(len);
        bytes32 h = keccak256(abi.encode(seed));
        for (uint256 i; i < len; ++i) { if (i % 32 == 0) h = keccak256(abi.encode(h)); b[i] = A[uint8(h[i % 32]) % 65]; }
    }
    /// a valid image data URI of exactly `len` bytes (len 0 => empty = clear)
    function _blob(uint256 seed, uint256 len) internal pure returns (bytes memory) {
        if (len == 0) return "";
        bytes memory p = "data:image/png;base64,";
        if (len <= p.length) len = p.length + 1;
        return bytes.concat(p, _body(seed, len - p.length));
    }
    function testFuzz_imageRoundTrip(uint256 seed, uint256 len) public {
        len = bound(len, 23, 40_000);   // up to the cap; crosses the 24,000-byte chunk boundary
        bytes memory b = _blob(seed, len);
        vm.prank(owner); nft.setTokenImage(FIRST, string(b));
        assertEq(bytes(nft.tokenImage(FIRST)), b);
        assertTrue(nft.isImageSet(FIRST));
        // overwrite with something shorter: no stale chunks left behind
        bytes memory c = _blob(seed ^ 1, len / 3 + 23);
        vm.prank(owner); nft.setTokenImage(FIRST, string(c));
        assertEq(bytes(nft.tokenImage(FIRST)), c);
    }
    function testFuzz_appendChunks(uint256 seed, uint16 a, uint16 b2) public {
        bytes memory x = _blob(seed, bound(a, 1, 20_000));
        bytes memory y = _body(seed ^ 1, bound(b2, 1, 20_000));
        vm.startPrank(owner);
        nft.setTokenImage(FIRST, string(x));
        nft.addTokenImageChunk(FIRST, string(y));
        assertEq(bytes(nft.tokenImage(FIRST)), bytes.concat(x, y));
        (uint256 chunks, uint256 sz) = nft.imageInfo(FIRST);
        assertEq(sz, x.length + y.length); assertGe(chunks, 2);
        nft.clearTokenImage(FIRST);
        vm.stopPrank();
        assertEq(bytes(nft.tokenImage(FIRST)).length, 0);
    }

    function test_imageSizeCap() public {
        vm.startPrank(owner);
        nft.setTokenImage(FIRST, string(_blob(1, 40_000)));
        vm.expectRevert(Phunksmas.ImageTooLarge.selector); nft.setTokenImage(FIRST, string(_blob(1, 40_001)));
        nft.setTokenImage(FIRST, string(_blob(1, 39_000)));
        nft.addTokenImageChunk(FIRST, string(_body(2, 1_000)));
        vm.expectRevert(Phunksmas.ImageTooLarge.selector); nft.addTokenImageChunk(FIRST, "A");
        vm.stopPrank();
    }

    // ---------- image validation: nothing can break the SVG/HTML wrappers ----------
    function testFuzz_imageRejectsBreakingBytes(uint256 seed, uint16 len, uint16 pos, uint8 which) public {
        bytes memory img = _blob(seed, bound(len, 30, 30_000));
        uint256 at = bound(pos, 5, img.length - 1);
        bytes1[3] memory bad = [bytes1('"'), bytes1("<"), bytes1(">")];
        img[at] = bad[which % 3];
        vm.prank(owner); vm.expectRevert(Phunksmas.BadImage.selector); nft.setTokenImage(FIRST, string(img));
    }
    function test_imageRules() public {
        vm.startPrank(owner);
        vm.expectRevert(Phunksmas.BadImage.selector); nft.setTokenImage(FIRST, "image/png;base64,AAAA");   // no data:
        vm.expectRevert(Phunksmas.BadImage.selector); nft.setTokenImage(FIRST, "data");
        vm.expectRevert(Phunksmas.BadImage.selector); nft.setTokenImage(FIRST, "data:text/html,hi");     // not an image
        vm.expectRevert(Phunksmas.BadImage.selector); nft.setTokenImage(FIRST, "");                       // clear is separate
        nft.clearTokenImage(FIRST);
        vm.expectRevert(Phunksmas.BadImage.selector); nft.addTokenImageChunk(FIRST, "AAAA");            // no first chunk
        nft.setTokenImage(FIRST, "data:image/png;base64,AAAA");
        vm.expectRevert(Phunksmas.BadImage.selector); nft.addTokenImageChunk(FIRST, 'AA"onload=x');
        nft.addTokenImageChunk(FIRST, "BBBB");
        assertEq(nft.tokenImage(FIRST), "data:image/png;base64,AAAABBBB");
        nft.clearTokenImage(FIRST);
        assertFalse(nft.isImageSet(FIRST));
        string[] memory vs = new string[](2); vs[0] = "data:image/png;base64,AAAA"; vs[1] = 'data:x"y';
        uint256[] memory ts = new uint256[](2); ts[0] = FIRST; ts[1] = FIRST + 1;
        vm.expectRevert(Phunksmas.BadImage.selector); nft.setTokenImageBatch(ts, vs);
        vm.stopPrank();
    }
    function test_isAnimatedGone() public {
        (bool ok,) = address(nft).call(abi.encodeWithSignature("isAnimated(uint256)", FIRST)); assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("setAnimated(uint256[],bool)", new uint256[](0), true)); assertFalse(ok);
    }

    // ---------- per-token freeze ----------
    function test_freezeLocksImageAndTraits() public {
        string[] memory k = new string[](1); k[0] = "Type";
        string[] memory v = new string[](1); v[0] = "Elf";
        uint256[] memory one = new uint256[](1); one[0] = FIRST;
        vm.startPrank(owner);
        nft.setTraits(FIRST, k, v);
        nft.ownerMint(owner, FIRST);
        nft.freeze(one);
        assertTrue(nft.frozen(FIRST));
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.setTokenImage(FIRST, "data:image/png;base64,BBBB");
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.setTokenImageBatch(one, _strs("data:image/png;base64,BBBB"));
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.addTokenImageChunk(FIRST, "BBBB");
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.clearTokenImage(FIRST);
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.setTraits(FIRST, k, k);
        string[][] memory kk = new string[][](1); kk[0] = k;
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.batchSetTraits(one, kk, kk);
        vm.expectRevert(Phunksmas.TokenIsFrozen.selector); nft.freeze(one);   // one-way, no double
        // other pieces stay editable
        nft.setTraits(FIRST + 1, k, k);
        vm.stopPrank();
        assertTrue(nft.hasTrait(FIRST, "Type", "Elf"));
        assertEq(nft.tokenImage(FIRST), "data:image/png;base64,AAAA");
        // still trades normally
        vm.prank(owner); nft.transferFrom(owner, makeAddr("x"), FIRST);
    }
    function test_freezeNeedsImageAndRange() public {
        Phunksmas bare = _deployBare();
        uint256[] memory one = new uint256[](1); one[0] = FIRST;
        vm.startPrank(owner);
        vm.expectRevert(Phunksmas.ImageNotSet.selector); bare.freeze(one);
        one[0] = LAST + 1;
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); bare.freeze(one);
        vm.stopPrank();
    }
    function testFuzz_settersRejectOutOfRange(uint256 id) public {
        vm.assume(id < FIRST || id > LAST);
        string[] memory k = new string[](1); k[0] = "a";
        uint256[] memory one = new uint256[](1); one[0] = id;
        string[][] memory kk = new string[][](1); kk[0] = k;
        vm.startPrank(owner);
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.setTokenImage(id, "data:image/png;base64,AAAA");
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.setTokenImageBatch(one, _strs("data:image/png;base64,AAAA"));
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.addTokenImageChunk(id, "AAAA");
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.clearTokenImage(id);
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.setTraits(id, k, k);
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.batchSetTraits(one, kk, kk);
        vm.expectRevert(Phunksmas.TokenIdOutOfRange.selector); nft.freeze(one);
        vm.stopPrank();
    }
    function test_mintNeedsImage() public {
        Phunksmas bare = _deployBare();
        vm.startPrank(owner);
        vm.expectRevert(Phunksmas.ImageNotSet.selector); bare.ownerMint(owner, FIRST);
        bare.setTokenImage(FIRST, "data:image/png;base64,AAAA");
        bare.ownerMint(owner, FIRST);
        vm.expectRevert(Phunksmas.BadImage.selector); bare.clearTokenImage(FIRST);   // minted: replace, never blank
        bare.setTokenImage(FIRST, "data:image/png;base64,BBBB");
        vm.stopPrank();
        assertEq(bare.tokenImage(FIRST), "data:image/png;base64,BBBB");
    }
    function test_titleIsFixed() public {
        vm.startPrank(owner);
        nft.ownerMint(owner, FIRST);
        nft.setNameAndSymbol("Other", "OTH");
        vm.stopPrank();
        assertEq(nft.name(), "Other");
        assertEq(vm.parseJsonString(_json(FIRST), ".name"), "Phunksmas #10454");   // per-token title unchanged
    }
    function _strs(string memory a) internal pure returns (string[] memory r) { r = new string[](1); r[0] = a; }

    // ---------- traits ----------
    function testFuzz_traits(string memory k, string memory v, string memory other) public {
        vm.assume(keccak256(bytes(other)) != keccak256(bytes(v)));
        vm.assume(keccak256(bytes(k)) != keccak256(bytes("Type")));
        string[] memory ks = new string[](2); ks[0] = "Type"; ks[1] = k;
        string[] memory vs = new string[](2); vs[0] = "Elf"; vs[1] = v;
        vm.prank(owner); nft.setTraits(FIRST, ks, vs);
        assertTrue(nft.hasTrait(FIRST, k, v));
        assertTrue(nft.hasTrait(FIRST, "Type", "Elf"));
        assertFalse(nft.hasTrait(FIRST, k, other));
        assertFalse(nft.hasTrait(FIRST + 1, k, v));
    }
    function testFuzz_traitLengthMismatch(uint8 a, uint8 b) public {
        a = uint8(bound(a, 0, 8)); b = uint8(bound(b, 0, 8)); vm.assume(a != b);
        vm.prank(owner); vm.expectRevert(Phunksmas.LengthMismatch.selector);
        nft.setTraits(FIRST, new string[](a), new string[](b));
    }

    // ---------- no lottery / no reentrancy guard left over ----------
    function test_noLotteryCode() public {
        (bool ok,) = address(nft).call(abi.encodeWithSignature("lottery()"));               assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("setLottery(address)", owner));   assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("mintFromLottery(address,uint256)", owner, FIRST)); assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("transferFromLottery(address,uint256)", owner, FIRST)); assertFalse(ok);
    }

    // ---------- background colour must be 6 hex chars ----------
    function testFuzz_backgroundColor(string memory c) public {
        bytes memory b = bytes(c); bool ok = b.length == 6;
        for (uint256 i; ok && i < 6; ++i) {
            bytes1 x = b[i];
            ok = (x >= "0" && x <= "9") || (x >= "a" && x <= "f") || (x >= "A" && x <= "F");
        }
        vm.prank(owner);
        if (!ok) { vm.expectRevert(Phunksmas.BadBackgroundColor.selector); nft.setBackgroundColor(c); }
        else { nft.setBackgroundColor(c); assertEq(nft.backgroundColor(), c); }
    }
    function test_backgroundColorExamples() public {
        vm.startPrank(owner);
        nft.setBackgroundColor("638596");
        nft.setBackgroundColor("ABCdef");
        vm.expectRevert(Phunksmas.BadBackgroundColor.selector); nft.setBackgroundColor("#638596");
        vm.expectRevert(Phunksmas.BadBackgroundColor.selector); nft.setBackgroundColor("63859");
        vm.expectRevert(Phunksmas.BadBackgroundColor.selector); nft.setBackgroundColor('6"><x>');
        vm.stopPrank();
    }

    // ---------- owner text is JSON-escaped (a quote can't break metadata) ----------
    function test_jsonEscaping() public {
        uint256 id = FIRST;
        string[] memory ks = new string[](1); ks[0] = 'He said "hi"';
        string[] memory vs = new string[](1); vs[0] = string(abi.encodePacked("back\\slash", bytes1(0x0a), "nl"));
        vm.startPrank(owner);
        nft.ownerMint(owner, id);
        nft.setTraits(id, ks, vs);
        nft.setDescription('A "quoted" description');
        vm.stopPrank();
        string memory j = _json(id);
        assertTrue(_contains(j, '"trait_type":"He said \\"hi\\""'));
        assertTrue(_contains(j, '"value":"back\\\\slash\\u000anl"'));
        assertTrue(_contains(j, '"description":"A \\"quoted\\" description"'));
        // hasTrait still matches the raw (unescaped) values
        assertTrue(nft.hasTrait(id, 'He said "hi"', vs[0]));
    }
    function testFuzz_jsonStaysValid(string memory k, string memory v) public {
        string[] memory ks = new string[](1); ks[0] = k;
        string[] memory vs = new string[](1); vs[0] = v;
        vm.startPrank(owner);
        nft.ownerMint(owner, FIRST);
        nft.setTraits(FIRST, ks, vs);
        vm.stopPrank();
        string memory j = _json(FIRST);
        // parse with forge's JSON parser: must not revert, and the trait round-trips exactly
        assertEq(vm.parseJsonString(j, ".attributes[0].trait_type"), k);
        assertEq(vm.parseJsonString(j, ".attributes[0].value"), v);
        assertEq(vm.parseJsonString(j, ".name"), "Phunksmas #10454");
    }
    function _json(uint256 id) internal view returns (string memory) {
        bytes memory prefix = bytes("data:application/json;charset=utf-8;base64,");
        bytes memory u = bytes(nft.tokenURI(id));
        bytes memory enc = new bytes(u.length - prefix.length);
        for (uint256 i; i < enc.length; ++i) enc[i] = u[i + prefix.length];
        return _b64decode(string(enc));
    }

    // ---------- tokenURI ----------
    function testFuzz_tokenURIName(uint8 off) public {
        uint256 id = FIRST + (uint256(off) % 67);
        vm.expectRevert(); nft.tokenURI(id);                     // not minted yet
        vm.startPrank(owner);
        nft.ownerMint(owner, id);
        nft.setTokenImage(id, "data:image/png;base64,AAAA");
        vm.stopPrank();
        string memory uri = nft.tokenURI(id);
        bytes memory prefix = bytes("data:application/json;charset=utf-8;base64,");
        bytes memory u = bytes(uri);
        bytes memory enc = new bytes(u.length - prefix.length);
        for (uint256 i; i < enc.length; ++i) enc[i] = u[i + prefix.length];
        string memory want = string.concat('{"name":"Phunksmas #', vm.toString(id), '"');
        string memory jsonStr = _b64decode(string(enc));
        assertEq(_startsWith(jsonStr, want), true);
        assertTrue(_contains(jsonStr, '"animation_url":"data:text/html;base64,'));
        assertTrue(_contains(jsonStr, '"background_color":"638596"'));
    }

    // tiny helpers
    function _startsWith(string memory s, string memory p) internal pure returns (bool) {
        bytes memory a = bytes(s); bytes memory b = bytes(p);
        if (b.length > a.length) return false;
        for (uint256 i; i < b.length; ++i) if (a[i] != b[i]) return false;
        return true;
    }
    function _contains(string memory s, string memory p) internal pure returns (bool) {
        bytes memory a = bytes(s); bytes memory b = bytes(p);
        if (b.length > a.length) return false;
        for (uint256 i; i + b.length <= a.length; ++i) {
            bool ok = true;
            for (uint256 j; j < b.length; ++j) if (a[i + j] != b[j]) { ok = false; break; }
            if (ok) return true;
        }
        return false;
    }
    function _b64decode(string memory s) internal pure returns (string memory) {
        bytes memory d = bytes(s);
        bytes memory out = new bytes(d.length / 4 * 3);
        uint256 o; uint256 pad;
        for (uint256 i; i < d.length; i += 4) {
            uint256 n;
            for (uint256 j; j < 4; ++j) {
                uint8 c = uint8(d[i + j]); uint256 v;
                if (c >= 65 && c <= 90) v = c - 65; else if (c >= 97 && c <= 122) v = c - 71;
                else if (c >= 48 && c <= 57) v = c + 4; else if (c == 43) v = 62; else if (c == 47) v = 63;
                else { v = 0; pad++; }
                n = (n << 6) | v;
            }
            out[o++] = bytes1(uint8(n >> 16)); out[o++] = bytes1(uint8(n >> 8)); out[o++] = bytes1(uint8(n));
        }
        assembly { mstore(out, sub(mload(out), pad)) }
        return string(out);
    }
}

// ===================== invariants =====================
contract Handler is Test {
    Phunksmas public nft; address public owner;
    address[] public actors;
    uint256[] public minted;
    mapping(uint256 => bool) public isMinted;

    constructor(Phunksmas n, address o) {
        nft = n; owner = o;
        for (uint256 i; i < 5; ++i) actors.push(makeAddr(string.concat("actor", vm.toString(i))));
    }
    function mint(uint256 idSeed, uint256 actorSeed) external {
        uint256 id = bound(idSeed, 10440, 10535);   // includes out-of-range ids on purpose
        address to = actors[actorSeed % actors.length];
        vm.prank(owner);
        try nft.ownerMint(to, id) { minted.push(id); isMinted[id] = true; } catch {}
    }
    function transfer(uint256 idx, uint256 fromSeed, uint256 toSeed) external {
        if (minted.length == 0) return;
        uint256 id = minted[idx % minted.length];
        address from = nft.ownerOf(id);
        address to = actors[toSeed % actors.length];
        fromSeed;
        vm.prank(from); nft.transferFrom(from, to, id);
    }
    function approveAndPull(uint256 idx, uint256 opSeed, uint256 toSeed) external {
        if (minted.length == 0) return;
        uint256 id = minted[idx % minted.length];
        address from = nft.ownerOf(id);
        address op = actors[opSeed % actors.length];
        address to = actors[toSeed % actors.length];
        vm.prank(from); nft.approve(op, id);
        vm.prank(op); nft.transferFrom(from, to, id);
    }
    function strangerSteal(uint256 idx, uint256 thiefSeed) external {
        if (minted.length == 0) return;
        uint256 id = minted[idx % minted.length];
        address from = nft.ownerOf(id);
        address thief = actors[thiefSeed % actors.length];
        if (thief == from || nft.getApproved(id) == thief || nft.isApprovedForAll(from, thief)) return;
        vm.prank(thief);
        try nft.transferFrom(from, thief, id) { revert("stolen"); } catch {}
    }
    function mintedCount() external view returns (uint256) { return minted.length; }
    function actorCount() external view returns (uint256) { return actors.length; }
}

contract PhunksmasInvariant is Base {
    Handler h;
    function setUp() public {
        nft = _deploy();
        h = new Handler(nft, owner);
        targetContract(address(h));
    }
    function invariant_supplyMatchesMints() public view {
        assertEq(nft.totalSupply(), h.mintedCount());
        assertLe(nft.totalSupply(), 67);
    }
    function invariant_everyMintedIdInRangeAndOwnedByActor() public view {
        uint256 n = h.mintedCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = h.minted(i);
            assertGe(id, FIRST); assertLe(id, LAST);
            address o = nft.ownerOf(id);
            bool isActor;
            for (uint256 j; j < h.actorCount(); ++j) if (h.actors(j) == o) isActor = true;
            assertTrue(isActor);
        }
    }
    function invariant_outOfRangeNeverExists() public view {
        assertEq(nft.ownerOfRaw(FIRST - 1), address(0));
        assertEq(nft.ownerOfRaw(LAST + 1), address(0));
    }
    function invariant_royaltyZeroAndOwnerUnchanged() public view {
        (, uint256 amt) = nft.royaltyInfo(FIRST, 1 ether);
        assertEq(amt, 0);
        assertEq(nft.owner(), owner);
    }
}

// ===================== ERC-721 standard conformance =====================
contract NoReceiver {}
contract BadReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) { return 0xdeadbeef; }
}
contract RevertReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) { revert("nope"); }
}

contract PhunksmasERC721 is Base {
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    function setUp() public {
        nft = _deploy();
        vm.prank(owner); nft.ownerMint(alice, FIRST);
    }
    function test_interfaces() public view {
        assertTrue(nft.supportsInterface(0x01ffc9a7));   // ERC-165
        assertTrue(nft.supportsInterface(0x80ac58cd));   // ERC-721
        assertTrue(nft.supportsInterface(0x5b5e139f));   // ERC-721 Metadata
        assertTrue(nft.supportsInterface(0x2a55205a));   // ERC-2981
        assertTrue(nft.supportsInterface(0x49064906));   // ERC-4906
        assertTrue(nft.supportsInterface(0xe8a3d485));   // ERC-7572
        assertFalse(nft.supportsInterface(0xffffffff));  // must be false per ERC-165
        assertFalse(nft.supportsInterface(0x780e9d63));  // not Enumerable (not claimed)
    }
    function test_balancesAndOwner() public {
        assertEq(nft.balanceOf(alice), 1);
        vm.expectRevert(); nft.balanceOf(address(0));
        vm.expectRevert(); nft.ownerOf(FIRST + 1);
        vm.prank(alice); nft.transferFrom(alice, bob, FIRST);
        assertEq(nft.balanceOf(alice), 0); assertEq(nft.balanceOf(bob), 1);
    }
    function test_transferToZeroReverts() public {
        vm.prank(alice); vm.expectRevert(); nft.transferFrom(alice, address(0), FIRST);
    }
    function test_wrongFromReverts() public {
        vm.prank(alice); vm.expectRevert(); nft.transferFrom(bob, alice, FIRST);
    }
    function test_approvalClearedOnTransfer() public {
        vm.prank(alice); nft.approve(bob, FIRST);
        assertEq(nft.getApproved(FIRST), bob);
        vm.prank(bob); nft.transferFrom(alice, bob, FIRST);
        assertEq(nft.getApproved(FIRST), address(0));
        vm.prank(bob); nft.transferFrom(bob, alice, FIRST);
        vm.prank(bob); vm.expectRevert(); nft.transferFrom(alice, bob, FIRST);   // old approval gone
    }
    function test_operatorRevoke() public {
        vm.prank(alice); nft.setApprovalForAll(bob, true);
        assertTrue(nft.isApprovedForAll(alice, bob));
        vm.prank(alice); nft.setApprovalForAll(bob, false);
        vm.prank(bob); vm.expectRevert(); nft.transferFrom(alice, bob, FIRST);
    }
    function test_operatorCanApproveOthers() public {
        vm.prank(alice); nft.setApprovalForAll(bob, true);
        address carol = makeAddr("carol");
        vm.prank(bob); nft.approve(carol, FIRST);
        vm.prank(carol); nft.transferFrom(alice, carol, FIRST);
        assertEq(nft.ownerOf(FIRST), carol);
    }
    function test_safeTransferToContracts() public {
        address nr = address(new NoReceiver());
        address br = address(new BadReceiver());
        address rr = address(new RevertReceiver());
        address ok = address(new Receiver());
        vm.startPrank(alice);
        vm.expectRevert(); nft.safeTransferFrom(alice, nr, FIRST);
        vm.expectRevert(); nft.safeTransferFrom(alice, br, FIRST);
        vm.expectRevert(); nft.safeTransferFrom(alice, rr, FIRST, "data");
        nft.transferFrom(alice, nr, FIRST);              // plain transferFrom does not check (by standard)
        vm.stopPrank();
        assertEq(nft.ownerOf(FIRST), nr);
        vm.prank(owner); nft.ownerMint(alice, FIRST + 1);
        vm.prank(alice); nft.safeTransferFrom(alice, ok, FIRST + 1);
        assertEq(nft.ownerOf(FIRST + 1), ok);
    }
    function test_safeMintToNonReceiverReverts() public {
        address nr = address(new NoReceiver());
        vm.prank(owner); vm.expectRevert(); nft.ownerMint(nr, FIRST + 1);
        assertEq(nft.totalSupply(), 1);
    }
    function test_transferEventsEmitted() public {
        vm.expectEmit(true, true, true, false, address(nft));
        emit IERC721Like.Transfer(alice, bob, FIRST);
        vm.prank(alice); nft.transferFrom(alice, bob, FIRST);
    }
    function test_metadataSetters() public {
        vm.startPrank(owner);
        nft.setNameAndSymbol("New", "NEW");
        assertEq(nft.name(), "New"); assertEq(nft.symbol(), "NEW");
        nft.setNameAndSymbol("", "");
        assertEq(nft.name(), "Phunksmas"); assertEq(nft.symbol(), "PHMAS");   // empty = back to default
        nft.setContractURI("data:application/json,{}");
        assertEq(nft.contractURI(), "data:application/json,{}");
        nft.setDescription("Merry");
        vm.stopPrank();
        assertGt(bytes(nft.tokenURI(FIRST)).length, 0);
    }
    function test_batchLengthChecks() public {
        uint256[] memory ids = new uint256[](2); ids[0] = FIRST; ids[1] = FIRST + 1;
        vm.startPrank(owner);
        vm.expectRevert(Phunksmas.LengthMismatch.selector); nft.setTokenImageBatch(ids, new string[](1));
        vm.expectRevert(Phunksmas.LengthMismatch.selector); nft.batchSetTraits(ids, new string[][](1), new string[][](2));
        string[][] memory k = new string[][](2); string[][] memory v = new string[][](2);
        k[0] = new string[](1); v[0] = new string[](2);
        vm.expectRevert(Phunksmas.LengthMismatch.selector); nft.batchSetTraits(ids, k, v);
        vm.stopPrank();
    }
    function test_ownershipTransferIsTwoStep() public {
        vm.prank(owner); nft.transferOwnership(bob);
        assertEq(nft.owner(), owner);            // nothing moves until bob accepts
        assertEq(nft.pendingOwner(), bob);
        address mallory = makeAddr("mallory");
        vm.prank(mallory); vm.expectRevert(); nft.acceptOwnership();
        vm.prank(bob); nft.acceptOwnership();
        assertEq(nft.owner(), bob);
        vm.prank(owner); vm.expectRevert(); nft.ownerMint(owner, FIRST + 2);
        vm.prank(bob); nft.ownerMint(bob, FIRST + 2);
    }
    function test_mistypedOwnerCanBeCancelled() public {
        address typo = makeAddr("typo");
        vm.startPrank(owner);
        nft.transferOwnership(typo);
        nft.transferOwnership(address(0));       // cancel the pending transfer
        vm.stopPrank();
        assertEq(nft.pendingOwner(), address(0));
        assertEq(nft.owner(), owner);
        vm.prank(typo); vm.expectRevert(); nft.acceptOwnership();
    }
    /// gas to render the biggest current piece (Mrs. Claus ~2 KB) must stay far below RPC eth_call caps.
    function test_tokenURIGas() public {
        bytes memory img = _blobGas(2600);
        string[] memory ks = new string[](10); string[] memory vs = new string[](10);
        for (uint256 i; i < 10; ++i) { ks[i] = "Trait Type"; vs[i] = "Some Trait Value"; }
        vm.startPrank(owner);
        nft.setTokenImage(FIRST, string(img));
        nft.setTraits(FIRST, ks, vs);
        vm.stopPrank();
        uint256 g = gasleft(); nft.tokenURI(FIRST); g -= gasleft();
        emit log_named_uint("tokenURI gas (2.6 KB image, 10 traits)", g);
        assertLt(g, 10_000_000);
    }
}
function _blobGas(uint256 len) pure returns (bytes memory b) {
    bytes memory p = "data:image/png;base64,";
    b = new bytes(len);
    for (uint256 i; i < len; ++i) b[i] = i < p.length ? p[i] : bytes1(uint8(65 + i % 26));
}
interface IERC721Like { event Transfer(address indexed from, address indexed to, uint256 indexed tokenId); }
