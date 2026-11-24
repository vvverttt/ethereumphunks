// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.36;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {V67AuctionHouse} from "../../contracts/V67AuctionHouse.sol";
import {MockWETH9, MockNFT721} from "../../contracts/mocks/V67AuctionMocks.sol";

/// queueHeld / depositHeld: pieces sent to the house by a plain transfer go straight into the queue / pool,
/// no rescue-and-requeue round trip.
///   Unit + fuzz on mocks, an invariant handler that mixes strays into normal traffic, and (when FORK_URL is
///   set) a mainnet-fork run of the real upgrade with the 10 Phunkmas that were transferred in by mistake.

abstract contract HeldBase is Test {
    V67AuctionHouse house;
    MockWETH9 weth;
    MockNFT721 nft;   // v67 stand-in
    MockNFT721 drop;  // a queue collection (Phunkmas stand-in)
    address owner = makeAddr("owner");
    address guardian = makeAddr("guardian");
    address payout = makeAddr("payout");
    address stranger = makeAddr("stranger");

    function _deploy() internal {
        weth = new MockWETH9();
        nft = new MockNFT721();
        drop = new MockNFT721();
        V67AuctionHouse impl = new V67AuctionHouse();
        bytes memory init = abi.encodeCall(V67AuctionHouse.initialize, (address(nft), address(weth), payout, guardian, owner));
        house = V67AuctionHouse(address(new ERC1967Proxy(address(impl), init)));
        vm.startPrank(guardian);
        house.setCollectionAllowed(address(drop), true);
        house.setQueueEvery(1);
        nft.setApprovalForAll(address(house), true);
        drop.setApprovalForAll(address(house), true);
        vm.stopPrank();
    }

    /// The mistake: plain transferFrom straight to the house (bypasses onERC721Received).
    function _stray(MockNFT721 c, uint256 from, uint256 n) internal returns (uint256[] memory ids) {
        c.mintBatch(guardian, from, n);
        ids = new uint256[](n);
        vm.startPrank(guardian);
        for (uint256 i; i < n; ++i) {
            ids[i] = from + i;
            c.transferFrom(guardian, address(house), ids[i]);
        }
        vm.stopPrank();
    }

    function _ids1(uint256 a) internal pure returns (uint256[] memory r) { r = new uint256[](1); r[0] = a; }

    function _live() internal view returns (address col, uint256 id, bool active) {
        bool settled;
        (col, id,,,,, settled,) = house.currentAuction();
        active = !settled;
    }
}

contract V67AuctionHouseHeldTest is HeldBase {
    uint32[] none;

    function setUp() public { _deploy(); }

    function test_queueHeld_runsStraysInOrder_thenSells() public {
        uint256[] memory ids = _stray(drop, 10, 5);
        vm.prank(guardian);
        house.queueHeld(address(drop), ids, none);
        assertEq(house.queueSize(), 5);
        (, uint256[] memory q,) = house.queueItems(0, 5);
        for (uint256 i; i < 5; ++i) {
            assertEq(q[i], ids[i]);
            assertTrue(house.inQueue(address(drop), ids[i]));
        }
        vm.prank(owner);
        house.start();
        address bidder = makeAddr("bidder");
        for (uint256 i; i < 5; ++i) {
            (address col, uint256 id, bool active) = _live();
            assertTrue(active);
            assertEq(col, address(drop));
            assertEq(id, ids[i], "runs in the order given");
            vm.deal(bidder, 1 ether);
            vm.prank(bidder);
            house.createBid{value: 0.01 ether}(address(drop), id);
            (,,,,, uint256 endT,,) = house.currentAuction();
            vm.warp(endT);
            house.settleCurrentAndCreateNewAuction();
            assertEq(drop.ownerOf(id), bidder, "winner gets the piece");
        }
        assertEq(payout.balance, 0.05 ether, "every winning bid reached payout");
    }

    /// Real fix order: held pieces, then pulled pieces, then the held Santa last; queue keeps the exact order.
    function test_mixHeldAndPulled_keepsExactOrder() public {
        uint256[] memory held = _stray(drop, 100, 3);
        uint256[] memory santa = _stray(drop, 99, 1);
        drop.mintBatch(guardian, 200, 2);
        uint256[] memory pulled = new uint256[](2);
        pulled[0] = 200; pulled[1] = 201;
        vm.startPrank(guardian);
        house.queueHeld(address(drop), held, none);
        house.queue(address(drop), pulled, none);
        house.queueHeld(address(drop), santa, none);
        vm.stopPrank();
        (, uint256[] memory q,) = house.queueItems(0, 10);
        uint256[6] memory want = [uint256(100), 101, 102, 200, 201, 99];
        assertEq(q.length, 6);
        for (uint256 i; i < 6; ++i) assertEq(q[i], want[i]);
    }

    function test_queueHeld_opensAtOnceWhenIdle() public {
        vm.prank(owner);
        house.start(); // nothing to run: idle
        (,, bool active) = _live();
        assertFalse(active);
        uint256[] memory ids = _stray(drop, 1, 2);
        vm.prank(guardian);
        house.queueHeld(address(drop), ids, none);
        (address col, uint256 id, bool a2) = _live();
        assertTrue(a2);
        assertEq(col, address(drop));
        assertEq(id, 1);
        assertEq(house.queueSize(), 1);
    }

    function test_queueHeld_ownDurations() public {
        uint256[] memory ids = _stray(drop, 1, 2);
        uint32[] memory d = new uint32[](2);
        d[0] = 3 days; d[1] = 0;
        vm.prank(guardian);
        house.queueHeld(address(drop), ids, d);
        (,, uint256[] memory durs) = house.queueItems(0, 2);
        assertEq(durs[0], 3 days);
        assertEq(durs[1], 0);
    }

    function test_queueHeld_reverts() public {
        uint256[] memory ids = _stray(drop, 1, 2);
        // not guardian
        vm.prank(stranger);
        vm.expectRevert(V67AuctionHouse.NotGuardian.selector);
        house.queueHeld(address(drop), ids, none);
        // owner is not enough either
        vm.prank(owner);
        vm.expectRevert(V67AuctionHouse.NotGuardian.selector);
        house.queueHeld(address(drop), ids, none);
        // collection not approved
        MockNFT721 other = new MockNFT721();
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.CollectionNotAllowed.selector, address(other)));
        house.queueHeld(address(other), ids, none);
        // not held: still in the guardian's wallet
        drop.mintBatch(guardian, 50, 1);
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.NotHeld.selector, address(drop), 50));
        house.queueHeld(address(drop), _ids1(50), none);
        // not held: does not exist (ownerOf reverts)
        vm.prank(guardian);
        vm.expectRevert();
        house.queueHeld(address(drop), _ids1(999), none);
        // bad lengths / durations
        uint32[] memory one = new uint32[](1);
        vm.prank(guardian);
        vm.expectRevert(V67AuctionHouse.LengthMismatch.selector);
        house.queueHeld(address(drop), ids, one);
        uint32[] memory bad = new uint32[](2);
        bad[0] = 1 hours;
        vm.prank(guardian);
        vm.expectRevert(V67AuctionHouse.DurationOutOfRange.selector);
        house.queueHeld(address(drop), ids, bad);
        // same piece twice in one call
        uint256[] memory dup = new uint256[](2);
        dup[0] = 1; dup[1] = 1;
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.AlreadyQueued.selector, address(drop), 1));
        house.queueHeld(address(drop), dup, none);
        // already queued
        vm.startPrank(guardian);
        house.queueHeld(address(drop), ids, none);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.AlreadyQueued.selector, address(drop), 1));
        house.queueHeld(address(drop), _ids1(1), none);
        vm.stopPrank();
    }

    /// The live piece is held by the house but can never be queued a second time.
    function test_queueHeld_cannotDoubleQueueLivePiece() public {
        uint256[] memory ids = _stray(drop, 1, 2);
        vm.prank(guardian);
        house.queueHeld(address(drop), ids, none);
        vm.prank(owner);
        house.start();
        (, uint256 liveId, bool active) = _live();
        assertTrue(active);
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.AlreadyQueued.selector, address(drop), liveId));
        house.queueHeld(address(drop), _ids1(liveId), none);
    }

    /// Pool pieces of v67 can never be queued via queueHeld (same rule as queue).
    function test_queueHeld_v67PoolPieceRejected() public {
        vm.prank(guardian);
        house.setCollectionAllowed(address(nft), true);
        nft.mintBatch(guardian, 1, 1);
        vm.prank(guardian);
        house.deposit(_ids1(1));
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.AlreadyInPool.selector, 1));
        house.queueHeld(address(nft), _ids1(1), none);
    }

    /// Once queued, a stray is protected like any queue piece: rescue cannot take it.
    function test_rescueBlockedAfterQueueHeld_allowedBefore() public {
        uint256[] memory ids = _stray(drop, 1, 2);
        vm.startPrank(guardian);
        house.queueHeld(address(drop), _ids1(1), none);
        vm.expectRevert(V67AuctionHouse.QueuePiece.selector);
        house.rescueERC721(address(drop), 1);
        house.rescueERC721(address(drop), 2); // still a stray: rescue works as before
        vm.stopPrank();
        assertEq(drop.ownerOf(2), payout);
        ids;
    }

    /// A safe transfer still bounces; only a plain transfer can strand a piece.
    function test_safeTransferStillBounces() public {
        drop.mintBatch(guardian, 1, 1);
        vm.prank(guardian);
        vm.expectRevert();
        drop.safeTransferFrom(guardian, address(house), 1);
    }

    function test_depositHeld_works_andReverts() public {
        uint256[] memory ids = _stray(nft, 1, 3);
        vm.prank(stranger);
        vm.expectRevert(V67AuctionHouse.NotGuardian.selector);
        house.depositHeld(ids);
        vm.prank(guardian);
        house.depositHeld(ids);
        assertEq(house.poolSize(), 3);
        for (uint256 i; i < 3; ++i) assertTrue(house.inPool(ids[i]));
        // again
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.AlreadyInPool.selector, 1));
        house.depositHeld(_ids1(1));
        // not held
        nft.mintBatch(guardian, 10, 1);
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.NotHeld.selector, address(nft), 10));
        house.depositHeld(_ids1(10));
        // too large for the pool
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.TokenIdTooLarge.selector, 70000));
        house.depositHeld(_ids1(70000));
        // a queued v67 piece cannot also enter the pool
        vm.prank(guardian);
        house.setCollectionAllowed(address(nft), true);
        uint256[] memory s = _stray(nft, 20, 1);
        vm.startPrank(guardian);
        house.queueHeld(address(nft), s, none);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.AlreadyQueued.selector, address(nft), 20));
        house.depositHeld(s);
        vm.stopPrank();
        // depositHeld then start: a pool piece opens
        vm.prank(guardian);
        house.setQueueEvery(2);
        vm.prank(owner);
        house.start();
        (address col,, bool active) = _live();
        assertTrue(active);
        assertTrue(col == address(nft));
    }

    /// The old queue() still pulls from the guardian exactly as before.
    function test_queue_unchanged() public {
        drop.mintBatch(guardian, 1, 3);
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1; ids[1] = 2; ids[2] = 3;
        vm.prank(guardian);
        house.queue(address(drop), ids, none);
        for (uint256 i; i < 3; ++i) assertEq(drop.ownerOf(ids[i]), address(house));
        assertEq(house.queueSize(), 3);
        // a stray can't be queued with queue() (guardian no longer owns it)
        uint256[] memory s = _stray(drop, 9, 1);
        vm.prank(guardian);
        vm.expectRevert();
        house.queue(address(drop), s, none);
    }

    /// Fuzz: any number of strays in any order queue in exactly that order; nothing else changes hands.
    function testFuzz_queueHeldOrder(uint256 n, uint256 seed) public {
        n = bound(n, 1, 40);
        uint256[] memory ids = _stray(drop, 1, n);
        for (uint256 i = n; i > 1; --i) { // Fisher-Yates with the seed
            uint256 j = uint256(keccak256(abi.encode(seed, i))) % i;
            (ids[i - 1], ids[j]) = (ids[j], ids[i - 1]);
        }
        uint256 guardianBefore = drop.balanceOf(guardian);
        vm.prank(guardian);
        house.queueHeld(address(drop), ids, none);
        (, uint256[] memory q,) = house.queueItems(0, n);
        for (uint256 i; i < n; ++i) assertEq(q[i], ids[i]);
        assertEq(drop.balanceOf(address(house)), n);
        assertEq(drop.balanceOf(guardian), guardianBefore);
    }

    /// Fuzz: a batch with any one piece not held reverts as a whole (nothing half-queued).
    function testFuzz_queueHeldAllOrNothing(uint256 n, uint256 badAt) public {
        n = bound(n, 2, 20);
        badAt = bound(badAt, 0, n - 1);
        uint256[] memory ids = _stray(drop, 1, n);
        drop.mintBatch(guardian, 500, 1);
        ids[badAt] = 500;
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.NotHeld.selector, address(drop), 500));
        house.queueHeld(address(drop), ids, none);
        assertEq(house.queueSize(), 0);
    }
}

/// Invariant: strays mixed into normal traffic (queue, queueHeld, depositHeld, rescue of strays, bids, settles).
contract HeldHandler is Test {
    V67AuctionHouse house;
    MockNFT721 nft;
    MockNFT721 drop;
    address guardian;
    uint32[] none;
    uint256 nextDrop = 1;
    uint256 nextV67 = 1;
    uint256[] public strays;     // drop pieces sitting in the house unqueued
    uint256 public dropIn;       // drop pieces that entered the house (queue or stray)
    uint256 public dropSold;
    uint256 public dropRescued;
    uint256 public v67In;
    uint256 public v67Sold;
    address bidder = makeAddr("hbidder");

    constructor(V67AuctionHouse h, MockNFT721 n, MockNFT721 d, address g) { house = h; nft = n; drop = d; guardian = g; }

    function strayCount() external view returns (uint256) { return strays.length; }

    function queuePulled(uint256 k) external {
        k = bound(k, 1, 3);
        if (house.queueSize() + k > house.MAX_QUEUE()) return;
        drop.mintBatch(guardian, nextDrop, k);
        uint256[] memory ids = new uint256[](k);
        for (uint256 i; i < k; ++i) ids[i] = nextDrop + i;
        nextDrop += k;
        vm.prank(guardian);
        house.queue(address(drop), ids, none);
        dropIn += k;
    }

    function sendStray(uint256 k) external {
        k = bound(k, 1, 3);
        drop.mintBatch(guardian, nextDrop, k);
        vm.startPrank(guardian);
        for (uint256 i; i < k; ++i) {
            drop.transferFrom(guardian, address(house), nextDrop + i);
            strays.push(nextDrop + i);
        }
        vm.stopPrank();
        nextDrop += k;
        dropIn += k;
    }

    function queueStrays(uint256 k) external {
        uint256 len = strays.length;
        if (len == 0) return;
        k = bound(k, 1, len);
        if (house.queueSize() + k > house.MAX_QUEUE()) return;
        uint256[] memory ids = new uint256[](k);
        for (uint256 i; i < k; ++i) { ids[i] = strays[strays.length - 1]; strays.pop(); }
        vm.prank(guardian);
        house.queueHeld(address(drop), ids, none);
    }

    function rescueStray() external {
        if (strays.length == 0) return;
        uint256 id = strays[strays.length - 1];
        strays.pop();
        vm.prank(guardian);
        house.rescueERC721(address(drop), id);
        dropRescued++;
    }

    function strayV67(uint256 k) external {
        k = bound(k, 1, 3);
        nft.mintBatch(guardian, nextV67, k);
        uint256[] memory ids = new uint256[](k);
        vm.startPrank(guardian);
        for (uint256 i; i < k; ++i) {
            ids[i] = nextV67 + i;
            nft.transferFrom(guardian, address(house), ids[i]);
        }
        house.depositHeld(ids);
        vm.stopPrank();
        nextV67 += k;
        v67In += k;
    }

    function bidAndSettle(uint256 bidSeed) external {
        (address col, uint256 id,,,, uint256 endT, bool settled,) = house.currentAuction();
        if (settled) return;
        bool withBid = bidSeed % 3 != 0;
        if (withBid && block.timestamp < endT) {
            uint256 need = house.minNextBid();
            vm.deal(bidder, need);
            vm.prank(bidder);
            house.createBid{value: need}(col, id);
        } else {
            withBid = false;
        }
        (,,, address top,,,,) = house.currentAuction();
        (,,,,, endT,,) = house.currentAuction();
        vm.warp(endT);
        house.settleCurrentAndCreateNewAuction();
        if (top != address(0)) {
            if (col == address(drop)) dropSold++;
            else v67Sold++;
        }
    }
}

contract V67AuctionHouseHeldInvariantTest is HeldBase {
    HeldHandler h;

    function setUp() public {
        _deploy();
        vm.prank(guardian);
        house.setQueueEvery(2);
        vm.prank(owner);
        house.start();
        h = new HeldHandler(house, nft, drop, guardian);
        targetContract(address(h));
    }

    /// Every drop piece that entered the house is waiting in the queue, live, a stray, sold, or rescued.
    function invariant_dropReconciles() public view {
        (address col,,,,,, bool settled,) = house.currentAuction();
        uint256 live = (!settled && col == address(drop)) ? 1 : 0;
        assertEq(drop.balanceOf(address(house)), house.queueSize() + live + h.strayCount());
        assertEq(h.dropIn(), house.queueSize() + live + h.strayCount() + h.dropSold() + h.dropRescued());
    }

    /// Every v67 piece that came in is waiting in the pool, live, or sold.
    function invariant_v67Reconciles() public view {
        (address col,,,,,, bool settled,) = house.currentAuction();
        uint256 live = (!settled && col == address(nft)) ? 1 : 0;
        assertEq(nft.balanceOf(address(house)), house.poolSize() + live);
        assertEq(h.v67In(), house.poolSize() + live + h.v67Sold());
    }

    /// Strays are never marked queued; queued pieces are always held.
    function invariant_straysNotQueued() public view {
        for (uint256 i; i < h.strayCount(); ++i) {
            uint256 id = h.strays(i);
            assertFalse(house.inQueue(address(drop), id));
            assertEq(drop.ownerOf(id), address(house));
        }
        uint256 q = house.queueSize();
        (, uint256[] memory ids,) = house.queueItems(0, q);
        for (uint256 i; i < q; ++i) assertEq(drop.ownerOf(ids[i]), address(house));
    }

    function invariant_noIdleWithStock() public view {
        (,,,,,, bool settled,) = house.currentAuction();
        if (settled && !house.paused()) {
            assertEq(house.poolSize(), 0);
            assertEq(house.queueSize(), 0);
        }
    }
}

/// Mainnet fork: upgrade the live proxy to this code, then run the exact fix for the 10 stray Phunkmas.
/// Run: FORK_URL=https://eth.drpc.org FOUNDRY_PROFILE=v67auction forge test --mc HeldFork -vv
contract V67AuctionHouseHeldFork is Test {
    address constant HOUSE = 0xE3C8d1cf63456535Ad41E47932AF1Fe1708E84C2;
    address constant PHUNKMAS = 0x677bec0663F66EffEF56C6DC31d64616C29526F9;
    address constant QP = 0x19d57A31b982d3d75c16358795A4D19c803e4A72;

    function test_fork_fixStraysAndRunAll17() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) { vm.skip(true); return; }
        vm.createSelectFork(url);
        V67AuctionHouse house = V67AuctionHouse(HOUSE);
        IERC721 pm = IERC721(PHUNKMAS);

        uint256[9] memory heldA = [uint256(10455), 10456, 10461, 10463, 10464, 10465, 10466, 10474, 10475];
        uint256[7] memory wallet = [uint256(10476), 10486, 10488, 10493, 10507, 10519, 10520];
        for (uint256 i; i < 9; ++i) assertEq(pm.ownerOf(heldA[i]), HOUSE, "stray in house");
        assertEq(pm.ownerOf(10454), HOUSE, "Santa in house");
        for (uint256 i; i < 7; ++i) assertEq(pm.ownerOf(wallet[i]), QP, "still in wallet");
        assertEq(house.owner(), QP);
        assertEq(house.guardian(), QP);
        assertFalse(house.started());

        // the upgrade, as quantumphunks.eth sends it
        uint256 poolBefore = house.poolSize();
        V67AuctionHouse impl = new V67AuctionHouse();
        vm.prank(QP);
        house.upgradeToAndCall(address(impl), "");
        // state carried over untouched
        assertEq(house.owner(), QP);
        assertEq(house.guardian(), QP);
        assertEq(house.payout(), QP);
        assertEq(house.duration(), 144_288);
        assertEq(house.poolSize(), poolBefore);
        assertFalse(house.started());

        uint32[] memory none;
        uint256[] memory a = new uint256[](9);
        for (uint256 i; i < 9; ++i) a[i] = heldA[i];
        uint256[] memory b = new uint256[](7);
        for (uint256 i; i < 7; ++i) b[i] = wallet[i];
        uint256[] memory santa = new uint256[](1);
        santa[0] = 10454;

        vm.startPrank(QP);
        house.setQueueEvery(1);
        house.setCollectionAllowed(PHUNKMAS, true);
        house.queueHeld(PHUNKMAS, a, none);
        pm.setApprovalForAll(HOUSE, true);
        house.queue(PHUNKMAS, b, none);
        house.queueHeld(PHUNKMAS, santa, none);
        vm.stopPrank();

        uint256[17] memory order = [uint256(10455), 10456, 10461, 10463, 10464, 10465, 10466, 10474, 10475,
            10476, 10486, 10488, 10493, 10507, 10519, 10520, 10454];
        (, uint256[] memory q,) = house.queueItems(0, 20);
        assertEq(q.length, 17);
        for (uint256 i; i < 17; ++i) assertEq(q[i], order[i], "queue order");
        console.log("queue ok: 17 pieces, Santa last");

        vm.prank(QP);
        house.start();
        address bidder = makeAddr("forkBidder");
        for (uint256 i; i < 17; ++i) {
            (address col, uint256 id,,,, uint256 endT, bool settled,) = house.currentAuction();
            assertFalse(settled);
            assertEq(col, PHUNKMAS);
            assertEq(id, order[i]);
            if (i == 16) { vm.prank(QP); house.pause(); } // Santa live: pause before settling him
            uint256 need = house.minNextBid();
            vm.deal(bidder, need);
            vm.prank(bidder);
            house.createBid{value: need}(PHUNKMAS, id);
            vm.warp(endT);
            house.settleCurrentAndCreateNewAuction();
            assertEq(pm.ownerOf(id), bidder);
        }
        (,,,,,, bool done,) = house.currentAuction();
        assertTrue(done, "paused after Santa: nothing else opened");
        assertEq(house.poolSize(), poolBefore, "v67 pool untouched");
        console.log("all 17 sold in order, Santa last, house idle and paused after");
    }
}
