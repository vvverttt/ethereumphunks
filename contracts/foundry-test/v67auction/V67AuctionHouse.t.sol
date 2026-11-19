// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.36;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {V67AuctionHouse} from "../../contracts/V67AuctionHouse.sol";
import {MockWETH9, MockNFT721, BidderContract, ForceSend} from "../../contracts/mocks/V67AuctionMocks.sol";

/// Fuzz + invariant suite for V67AuctionHouse.
///   Fuzz:      bid raise rule, anti-snipe extension, duration bounds, rescue never touching owed ETH,
///              skip gas-griefing defense (no gas amount lets the guardian skip a settleable auction).
///   Invariant: a handler drives random bids / settles / pauses / skips / deposits / withdrawals /
///              forced ETH; ETH, pieces and payouts must always reconcile.

abstract contract Base is Test {
    V67AuctionHouse house;
    MockWETH9 weth;
    MockNFT721 nft;
    address owner = makeAddr("owner");
    address guardian = makeAddr("guardian");
    address payout = makeAddr("payout");

    function _deploy(uint256 n) internal {
        weth = new MockWETH9();
        nft = new MockNFT721();
        V67AuctionHouse impl = new V67AuctionHouse();
        bytes memory init = abi.encodeCall(V67AuctionHouse.initialize, (address(nft), address(weth), payout, guardian, owner));
        house = V67AuctionHouse(address(new ERC1967Proxy(address(impl), init)));
        nft.mintBatch(guardian, 1, n);
        vm.prank(guardian);
        nft.setApprovalForAll(address(house), true);
        if (n > 0) {
            uint256[] memory ids = new uint256[](n);
            for (uint256 i; i < n; ++i) ids[i] = i + 1;
            vm.prank(guardian);
            house.deposit(ids);
        }
    }

    function _cur() internal view returns (uint256 id, uint256 amt, address bidder, uint256 endT, bool settled) {
        (, id, amt, bidder,, endT, settled,) = house.currentAuction();
    }
}

contract V67AuctionHouseFuzzTest is Base {
    function setUp() public {
        _deploy(20);
        vm.prank(owner);
        house.start();
    }

    /// The raise rule: a second bid is accepted iff it is >= ceil(first * 1.05).
    function testFuzz_raiseRule(uint256 first, uint256 second) public {
        first = bound(first, 0.001 ether, 10_000 ether);
        second = bound(second, 0, 20_000 ether);
        (uint256 id,,,,) = _cur();
        address a = makeAddr("a");
        address b = makeAddr("b");
        vm.deal(a, first);
        vm.deal(b, second);
        vm.prank(a);
        house.createBid{value: first}(address(nft), id);
        uint256 need = (first * 10_500 + 9_999) / 10_000;
        assertGt(need, first, "raise must be strictly positive");
        vm.prank(b);
        if (second < need) {
            vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.BidTooLow.selector, need));
            house.createBid{value: second}(address(nft), id);
        } else {
            house.createBid{value: second}(address(nft), id);
            assertEq(a.balance, first, "outbid bidder refunded in full");
            (,, address top,,) = _cur();
            assertEq(top, b);
        }
    }

    /// Anti-snipe: a bid with r seconds left extends the end to now+600 iff r < 600; never shortens it.
    function testFuzz_extension(uint256 secondsLeft) public {
        (uint256 id,,, uint256 endT,) = _cur();
        secondsLeft = bound(secondsLeft, 1, endT - block.timestamp);
        vm.warp(endT - secondsLeft);
        address a = makeAddr("a");
        vm.deal(a, 1 ether);
        vm.prank(a);
        house.createBid{value: 0.01 ether}(address(nft), id);
        (,,, uint256 newEnd,) = _cur();
        if (secondsLeft < 600) assertEq(newEnd, block.timestamp + 600);
        else assertEq(newEnd, endT);
        assertGe(newEnd, endT);
    }

    /// Reserve: the setter accepts exactly [0.001, 10] ETH; once a new auction opens with reserve r, a first bid
    /// is accepted iff it is >= r; the live auction is never affected by the change.
    function testFuzz_reserve(uint256 r, uint256 bidAmt) public {
        vm.prank(guardian);
        if (r < 0.001 ether || r > 10 ether) {
            vm.expectRevert(V67AuctionHouse.OpeningBidOutOfRange.selector);
            house.setMinOpeningBid(r);
            return;
        }
        house.setMinOpeningBid(r);
        assertEq(house.minNextBid(), 0.001 ether, "live auction keeps its reserve");
        (uint256 id,,, uint256 endT,) = _cur();
        vm.warp(endT);
        house.settleCurrentAndCreateNewAuction(); // no bids: back to pool, next opens with reserve r
        assertEq(house.minNextBid(), r);
        (id,,,,) = _cur();
        bidAmt = bound(bidAmt, 0, 20 ether);
        address a = makeAddr("a");
        vm.deal(a, bidAmt);
        vm.prank(a);
        if (bidAmt < r) {
            vm.expectRevert(abi.encodeWithSelector(V67AuctionHouse.BidTooLow.selector, r));
            house.createBid{value: bidAmt}(address(nft), id);
        } else {
            house.createBid{value: bidAmt}(address(nft), id);
            (,, address top,,) = _cur();
            assertEq(top, a);
        }
    }

    /// Duration setter: accepted iff within [1 day, 7 weeks]; never changes the live auction.
    function testFuzz_duration(uint256 d) public {
        (,,, uint256 endT,) = _cur();
        vm.prank(guardian);
        if (d < 1 days || d > 7 weeks) {
            vm.expectRevert(V67AuctionHouse.DurationOutOfRange.selector);
            house.setDuration(d);
        } else {
            house.setDuration(d);
            assertEq(house.duration(), d);
        }
        (,,, uint256 endAfter,) = _cur();
        assertEq(endAfter, endT);
    }

    /// Rescue only ever moves forced ETH; the live bid and credited refunds stay put.
    function testFuzz_rescueNeverTakesOwed(uint96 bidAmt, uint96 forced) public {
        uint256 b = bound(bidAmt, 0.001 ether, 1_000 ether);
        uint256 f = bound(forced, 0, 1_000 ether);
        (uint256 id,,,,) = _cur();
        address a = makeAddr("a");
        vm.deal(a, b);
        vm.prank(a);
        house.createBid{value: b}(address(nft), id);
        if (f > 0) {
            vm.deal(address(this), f);
            new ForceSend{value: f}(payable(address(house)));
        }
        uint256 payoutBefore = payout.balance;
        vm.prank(guardian);
        if (f == 0) {
            vm.expectRevert(V67AuctionHouse.NothingToRescue.selector);
            house.rescueETH();
        } else {
            house.rescueETH();
            assertEq(payout.balance - payoutBefore, f);
        }
        assertEq(address(house).balance, b, "live bid untouched");
    }

    /// Skip griefing: whatever gas the guardian sends, a settleable auction is never skipped.
    /// Below the floor it reverts; at or above it the auction settles normally and the winner gets the piece.
    function testFuzz_skipCannotStarveSettle(uint256 gasToSend) public {
        gasToSend = bound(gasToSend, 200_000, 6_000_000);
        (uint256 id,,, uint256 endT,) = _cur();
        address a = makeAddr("a");
        vm.deal(a, 1 ether);
        vm.prank(a);
        house.createBid{value: 1 ether}(address(nft), id);
        vm.warp(endT + 3 days);

        vm.prank(guardian);
        (bool ok,) = address(house).call{gas: gasToSend}(abi.encodeCall(V67AuctionHouse.skipStuckAuction, ()));
        if (ok) {
            assertEq(nft.ownerOf(id), a, "settleable auction must settle, never skip");
            assertEq(house.refunds(a), 0);
        } else {
            // reverted (gas floor or out of gas): nothing changed, piece still in the live auction
            (uint256 liveId,, address bidder,, bool settled) = _cur();
            assertEq(liveId, id);
            assertEq(bidder, a);
            assertFalse(settled);
            assertEq(nft.ownerOf(id), address(house));
        }
    }

    /// A genuinely stuck settle (every transfer reverts) is skipped, with a full refund credit.
    function testFuzz_skipStuckRefundsInFull(uint96 amt) public {
        uint256 b = bound(amt, 0.001 ether, 1_000 ether);
        (uint256 id,,, uint256 endT,) = _cur();
        address a = makeAddr("a");
        vm.deal(a, b);
        vm.prank(a);
        house.createBid{value: b}(address(nft), id);
        nft.setFrozen(true);
        vm.warp(endT + 3 days);
        vm.prank(guardian);
        house.skipStuckAuction();
        assertEq(house.refunds(a), b);
        assertTrue(house.inPool(id));
        nft.setFrozen(false);
        vm.prank(a);
        house.withdrawRefund();
        assertEq(a.balance, b);
    }

    /// Paging view never reverts and never returns more than exists.
    function testFuzz_poolIdsPaging(uint256 start, uint256 count) public view {
        uint256 len = house.poolSize();
        uint256[] memory ids = house.poolIds(start, count);
        uint256 expected = start >= len ? 0 : (count > len - start ? len - start : count);
        assertEq(ids.length, expected);
    }

    /// Draw: n pieces sold back to back, each exactly once, regardless of prevrandao.
    function testFuzz_drawSellsEachOnce(uint256 seed) public {
        address a = makeAddr("a");
        vm.deal(a, 100 ether);
        bool[21] memory seen;
        for (uint256 k; k < 20; ++k) {
            (uint256 id,,, uint256 endT, bool settled) = _cur();
            assertFalse(settled);
            assertFalse(seen[id], "drawn twice");
            seen[id] = true;
            vm.prank(a);
            house.createBid{value: 0.001 ether}(address(nft), id);
            vm.warp(endT);
            vm.prevrandao(bytes32(uint256(keccak256(abi.encode(seed, k)))));
            house.settleCurrentAndCreateNewAuction();
        }
        assertEq(house.poolSize(), 0);
        assertEq(nft.balanceOf(a), 20);
    }
}

/// Drives the house with random actions; tracks ghost totals for the invariants.
/// Two collections: the v67 mock (random pool) and a "drop" mock (featured queue).
contract Handler is Test {
    V67AuctionHouse house;
    MockNFT721 nft;
    MockNFT721 public drop;
    MockWETH9 weth;
    address guardian;
    address payout;
    address[] public actors;
    BidderContract public rejecter; // a bidder whose wallet rejects ETH (refunds go out as WETH)

    uint256 public nextId;
    uint256 public deposited;
    uint256 public sold;              // v67 pieces sold
    uint256 public nextDropId = 1;
    uint256 public dropQueued;        // drop pieces ever queued
    uint256 public dropSold;
    uint256 public dropRemoved;       // pulled out to payout
    uint256 public dropReleased;      // released by a skip, still held by the house
    uint256 public ghostPaidToPayout; // winning bids (ETH + WETH) that should have reached payout
    uint256 public ghostForced;       // ETH forced in and not yet rescued
    uint256 public ghostRescued;
    uint256 public ghostBidIn;        // all ETH bid into the house
    uint256 public ghostReturnedToBidders; // outbid refunds + withdrawn credits
    uint256 public orderViolations;   // queue head did not open next / a move landed wrong

    constructor(V67AuctionHouse h, MockNFT721 n, MockWETH9 w, address g, address p, uint256 firstFreeId) {
        house = h; nft = n; weth = w; guardian = g; payout = p; nextId = firstFreeId;
        for (uint256 i; i < 4; ++i) actors.push(makeAddr(string(abi.encodePacked("actor", vm.toString(i)))));
        rejecter = new BidderContract();
        rejecter.setRejectEth(true);
        actors.push(address(rejecter));
        drop = new MockNFT721();
        vm.startPrank(guardian);
        drop.setApprovalForAll(address(house), true);
        house.setCollectionAllowed(address(drop), true);
        vm.stopPrank();
    }

    function _live() internal view returns (bool active, address col, uint256 id, uint256 amt, address bidder, uint256 endT) {
        bool settled;
        (col, id, amt, bidder,, endT, settled,) = house.currentAuction();
        active = !settled;
    }

    function _isLive() internal view returns (bool a) { (a,,,,,) = _live(); }

    struct Expect { bool queueNext; bool poolNext; address hc; uint256 hid; }

    /// What must open next, per the mix rule, judged before the action (queue head vs a v67 draw).
    function _expect() internal view returns (Expect memory e) {
        uint256 q = house.queueSize();
        uint256 p = house.poolSize();
        e.queueNext = q != 0 && (p == 0 || uint256(house.poolSinceQueue()) + 1 >= house.queueEvery());
        e.poolNext = !e.queueNext && p != 0;
        if (q != 0) {
            (address[] memory c, uint256[] memory i,) = house.queueItems(0, 1);
            e.hc = c[0];
            e.hid = i[0];
        }
    }

    /// After anything that opens an auction: it must be exactly what the mix rule said.
    function _checkOpened(Expect memory e) internal {
        if (house.paused()) return;
        (bool active, address col, uint256 id,,,) = _live();
        if (e.queueNext && (!active || col != e.hc || id != e.hid)) orderViolations++;
        if (e.poolNext && (!active || col != address(nft))) orderViolations++;
    }

    function bid(uint256 actorSeed, uint256 amtSeed) external {
        (bool active, address col, uint256 id, uint256 amt, address prev, uint256 endT) = _live();
        if (!active || block.timestamp >= endT) return;
        uint256 need = house.minNextBid(); // the live auction's own reserve, or the 5% raise
        if (prev != address(0)) assertEq(need, (amt * 10_500 + 9_999) / 10_000, "raise rule");
        uint256 value = bound(amtSeed, need, need * 2 + 1 ether);
        address a = actors[actorSeed % actors.length];
        if (a == address(rejecter)) {
            vm.deal(address(this), value); // the handler funds the rejecting bidder's call
            rejecter.bidOn{value: value}(address(house), col, id);
        } else {
            vm.deal(a, value);
            vm.prank(a);
            house.createBid{value: value}(col, id);
        }
        ghostBidIn += value;
        if (prev != address(0)) ghostReturnedToBidders += amt;
    }

    function settle(uint256 callerSeed) external {
        (bool active, address col,, uint256 amt, address bidder, uint256 endT) = _live();
        if (!active) return;
        if (block.timestamp < endT) vm.warp(endT);
        Expect memory e = _expect();
        // A no-bid queue piece goes back to the queue before the next one opens, which changes the inputs
        // (only matters when the queue was empty); skip the check in that one case.
        bool requeue = bidder == address(0) && col == address(drop) && house.queueSize() == 0;
        vm.prank(actors[callerSeed % actors.length]);
        house.settleCurrentAndCreateNewAuction();
        if (bidder != address(0)) {
            if (col == address(drop)) dropSold++;
            else sold++;
            ghostPaidToPayout += amt;
        }
        if (!requeue) _checkOpened(e);
    }

    function warp(uint256 s) external { vm.warp(block.timestamp + bound(s, 1, 3 days)); }

    function randao(uint256 r) external { vm.prevrandao(bytes32(r)); }

    function pause() external { vm.prank(guardian); house.pause(); }

    function unpause() external {
        if (!house.paused()) return;
        if (house.unpauseScheduledAt() == 0) { vm.prank(guardian); house.scheduleUnpause(); }
        vm.warp(block.timestamp + 2 days);
        bool idle = !_isLive();
        Expect memory e = _expect();
        house.unpause();
        if (idle) _checkOpened(e);
    }

    function setDuration(uint256 d) external { vm.prank(guardian); house.setDuration(bound(d, 1 days, 7 weeks)); }

    /// Change the reserve mid-auction: the live auction's minimum must not move.
    function setMinBid(uint256 m) external {
        (bool active,,,, address prev,) = _live();
        uint256 before = house.minNextBid();
        vm.prank(guardian);
        house.setMinOpeningBid(bound(m, 0.001 ether, 10 ether));
        if (active && house.minNextBid() != before) orderViolations++;
        prev;
    }

    function deposit(uint256 n) external {
        n = bound(n, 1, 5);
        nft.mintBatch(guardian, nextId, n);
        uint256[] memory ids = new uint256[](n);
        for (uint256 i; i < n; ++i) ids[i] = nextId + i;
        nextId += n;
        vm.prank(guardian);
        house.deposit(ids);
        deposited += n;
    }

    function queueDrop(uint256 n, uint256 durSeed) external {
        n = bound(n, 1, 4);
        if (house.queueSize() + n > house.MAX_QUEUE()) return;
        drop.mintBatch(guardian, nextDropId, n);
        uint256[] memory ids = new uint256[](n);
        uint32[] memory durs = new uint32[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = nextDropId + i;
            uint256 r = uint256(keccak256(abi.encode(durSeed, i))) % 3;
            durs[i] = r == 0 ? 0 : uint32(bound(uint256(keccak256(abi.encode(durSeed, i, 1))), 1 days, 7 weeks));
        }
        nextDropId += n;
        bool opensNow = !_isLive() && house.started() && !house.paused() && house.queueSize() == 0;
        vm.prank(guardian);
        house.queue(address(drop), ids, durs);
        dropQueued += n;
        if (opensNow) {
            (bool active, address col, uint256 id,,,) = _live();
            if (!active || col != address(drop) || id != ids[0]) orderViolations++;
        }
    }

    function setQueueEvery(uint256 every) external {
        vm.prank(guardian);
        house.setQueueEvery(uint16(bound(every, 1, 5)));
    }

    function playQueueNext() external {
        vm.prank(guardian);
        house.playQueueNext();
    }

    function moveQ(uint256 a, uint256 b) external {
        uint256 len = house.queueSize();
        if (len == 0) return;
        a = a % len;
        b = b % len;
        (, uint256[] memory before,) = house.queueItems(0, len);
        vm.prank(guardian);
        house.moveQueued(a, b);
        (, uint256[] memory afterIds,) = house.queueItems(0, len);
        if (afterIds[b] != before[a]) orderViolations++;
    }

    function setQDur(uint256 pos, uint256 d) external {
        uint256 len = house.queueSize();
        if (len == 0) return;
        vm.prank(guardian);
        house.setQueuedDuration(pos % len, d % 2 == 0 ? 0 : uint32(bound(d, 1 days, 7 weeks)));
    }

    function removeQ(uint256 pos) external {
        uint256 len = house.queueSize();
        if (len == 0) return;
        vm.prank(guardian);
        house.removeQueued(pos % len);
        dropRemoved++;
    }

    /// A stuck settle: freeze the live piece's collection, wait out STUCK_WAIT, guardian skips, unfreeze.
    function skipStuck() external {
        (bool active, address col, uint256 id,,, uint256 endT) = _live();
        if (!active) return;
        vm.warp(endT + 3 days);
        MockNFT721 c = col == address(drop) ? drop : nft;
        c.setFrozen(true);
        vm.prank(guardian);
        house.skipStuckAuction();
        c.setFrozen(false);
        // With no bidder the settle attempt needs no transfer, so it succeeds and the piece goes back to the
        // queue; only a genuinely failed settle releases it.
        if (col == address(drop) && !house.inQueue(address(drop), id)) dropReleased++;
    }

    function withdraw(uint256 actorSeed) external {
        address a = actors[actorSeed % actors.length];
        uint256 owed = house.refunds(a);
        if (owed == 0) return;
        if (a == address(rejecter)) rejecter.withdraw(address(house));
        else { vm.prank(a); house.withdrawRefund(); }
        ghostReturnedToBidders += owed;
    }

    function forceEth(uint256 amt) external {
        amt = bound(amt, 1, 5 ether);
        vm.deal(address(this), amt);
        new ForceSend{value: amt}(payable(address(house)));
        ghostForced += amt;
    }

    function rescue() external {
        if (ghostForced == 0) return;
        vm.prank(guardian);
        house.rescueETH();
        ghostRescued += ghostForced;
        ghostForced = 0;
    }

    function actorsLength() external view returns (uint256) { return actors.length; }
}

contract V67AuctionHouseInvariantTest is Base {
    Handler handler;
    uint256 constant START = 12;

    function setUp() public {
        _deploy(START);
        vm.prank(owner);
        house.start();
        handler = new Handler(house, nft, weth, guardian, payout, START + 1);
        targetContract(address(handler));
    }

    /// ETH: the house holds exactly the live top bid + credited refunds + unrescued forced ETH.
    function invariant_ethExactlyOwed() public view {
        (,, uint256 amt,,,, bool settled,) = house.currentAuction();
        uint256 live = settled ? 0 : amt;
        assertEq(address(house).balance, live + house.totalRefundsOwed() + handler.ghostForced());
    }

    /// Money conservation: every wei bid in is either still held, refunded/withdrawn, or paid to payout.
    function invariant_bidsConserved() public view {
        (,, uint256 amt,,,, bool settled,) = house.currentAuction();
        uint256 live = settled ? 0 : amt;
        assertEq(handler.ghostBidIn(), live + house.totalRefundsOwed() + handler.ghostReturnedToBidders() + handler.ghostPaidToPayout());
    }

    /// Payout received every winning bid (as ETH, or WETH if the fallback fired) plus every rescue.
    function invariant_payoutGotEverything() public view {
        assertEq(payout.balance + weth.balanceOf(payout), handler.ghostPaidToPayout() + handler.ghostRescued());
    }

    /// v67 pieces: the house holds exactly the waiting pool + the live v67 piece; nothing lost or duplicated.
    function invariant_piecesReconcile() public view {
        (address col, uint256 liveId,,,,, bool settled,) = house.currentAuction();
        bool liveV67 = !settled && col == address(nft);
        uint256 n = house.poolSize();
        assertEq(nft.balanceOf(address(house)), n + (liveV67 ? 1 : 0));
        assertEq(START + handler.deposited(), n + (liveV67 ? 1 : 0) + handler.sold());
        uint256[] memory ids = house.poolIds(0, n);
        for (uint256 i; i < ids.length; ++i) {
            assertTrue(house.inPool(ids[i]));
            assertEq(nft.ownerOf(ids[i]), address(house));
            if (liveV67) assertTrue(ids[i] != liveId, "live piece also waiting in pool");
            for (uint256 j = i + 1; j < ids.length; ++j) assertTrue(ids[i] != ids[j], "duplicate in pool");
        }
        if (liveV67) assertTrue(house.inPool(liveId));
    }

    /// Drop pieces: every queued piece is waiting, live, sold, pulled out, or released; none twice in the queue.
    function invariant_queueReconciles() public view {
        MockNFT721 d = handler.drop();
        (address col, uint256 liveId,,,,, bool settled,) = house.currentAuction();
        bool liveDrop = !settled && col == address(d);
        uint256 q = house.queueSize();
        assertEq(handler.dropQueued(), q + (liveDrop ? 1 : 0) + handler.dropSold() + handler.dropRemoved() + handler.dropReleased());
        assertEq(d.balanceOf(address(house)), q + (liveDrop ? 1 : 0) + handler.dropReleased());
        (address[] memory cols, uint256[] memory ids,) = house.queueItems(0, q);
        for (uint256 i; i < q; ++i) {
            assertEq(cols[i], address(d));
            assertTrue(house.inQueue(address(d), ids[i]));
            assertEq(d.ownerOf(ids[i]), address(house));
            if (liveDrop) assertTrue(ids[i] != liveId, "live piece also waiting in queue");
            for (uint256 j = i + 1; j < q; ++j) assertTrue(ids[i] != ids[j], "duplicate in queue");
        }
        if (liveDrop) assertTrue(house.inQueue(address(d), liveId));
    }

    /// Every auction that opens is exactly what the mix rule says (queue head vs v67 draw); moves land where asked.
    function invariant_queueOrder() public view {
        assertEq(handler.orderViolations(), 0);
    }

    /// Never idle while there is something to auction and nothing stops it.
    function invariant_noIdleWithStock() public view {
        (,,,,,, bool settled,) = house.currentAuction();
        if (settled && !house.paused()) {
            assertEq(house.poolSize(), 0);
            assertEq(house.queueSize(), 0);
        }
    }
}
