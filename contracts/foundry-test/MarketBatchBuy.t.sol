// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {QuantumPhunksMarketMulti} from "../contracts/QuantumPhunksMarketMulti.sol";

contract BMockColl is ERC721 {
    address public t;
    constructor(address _t) ERC721("m", "M") { t = _t; }
    function mint(address to, uint256 id) external { _mint(to, id); }
    function royaltyInfo(uint256, uint256 p) external view returns (address, uint256) { return (t, (p * 500) / 10000); }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return true; }
}

/// Best-effort sweep (buyPhunkBatch) correctness: skip unavailable/over-max, refund unspent, atomic-safe.
contract MarketBatchBuyTest is Test {
    QuantumPhunksMarketMulti mkt;
    BMockColl coll;
    address treasury = makeAddr("treasury");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");

    function setUp() public {
        coll = new BMockColl(treasury);
        QuantumPhunksMarketMulti impl = new QuantumPhunksMarketMulti();
        bytes memory init = abi.encodeCall(QuantumPhunksMarketMulti.initialize, (address(this)));
        mkt = QuantumPhunksMarketMulti(payable(address(new ERC1967Proxy(address(impl), init))));
        mkt.setCollectionAllowed(address(coll), true);
        for (uint256 id = 1; id <= 20; id++) coll.mint(seller, id);
        vm.prank(seller); coll.setApprovalForAll(address(mkt), true);
    }

    function _list(uint256 id, uint256 price) internal { vm.prank(seller); mkt.offerPhunkForSale(address(coll), id, price); }
    function _cs(uint256 n) internal view returns (address[] memory a) { a = new address[](n); for (uint256 i; i < n; i++) a[i] = address(coll); }
    function _u(uint256 a) internal pure returns (uint256[] memory r) { r = new uint256[](1); r[0] = a; }
    function _u(uint256 a, uint256 b) internal pure returns (uint256[] memory r) { r = new uint256[](2); r[0] = a; r[1] = b; }
    function _u(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory r) { r = new uint256[](3); r[0] = a; r[1] = b; r[2] = c; }

    function test_supportsBatchBuy() public view { assertTrue(mkt.supportsBatchBuy()); }

    function test_sweep_happy_allBought_noRefund() public {
        _list(1, 0.1 ether); _list(2, 0.2 ether); _list(3, 0.3 ether);
        uint256 total = 0.6 ether;
        vm.deal(buyer, total); vm.prank(buyer);
        mkt.buyPhunkBatch{value: total}(_cs(3), _u(1, 2, 3), _u(0.1 ether, 0.2 ether, 0.3 ether));

        assertEq(coll.ownerOf(1), buyer);
        assertEq(coll.ownerOf(2), buyer);
        assertEq(coll.ownerOf(3), buyer);
        uint256 royalty = (total * 500) / 10000;
        assertEq(mkt.pendingWithdrawals(seller), total - royalty);
        assertEq(mkt.pendingWithdrawals(treasury), royalty);
        assertEq(mkt.pendingWithdrawals(buyer), 0); // nothing skipped -> no refund
        assertEq(address(mkt).balance, total);       // solvent
    }

    /// The core race: someone buys/delists an item mid-sweep -> it's skipped, the rest still go through,
    /// and the buyer is refunded the skipped item's budget. The sweep does NOT fail.
    function test_sweep_oneNotForSale_skips_and_refunds() public {
        _list(1, 0.1 ether); // id 2 deliberately NOT listed (as if sniped/delisted)
        uint256 total = 0.3 ether;
        vm.deal(buyer, total); vm.prank(buyer);
        mkt.buyPhunkBatch{value: total}(_cs(2), _u(1, 2), _u(0.1 ether, 0.2 ether));

        assertEq(coll.ownerOf(1), buyer);           // bought the available one
        assertEq(coll.ownerOf(2), seller);          // skipped the unavailable one
        assertEq(mkt.pendingWithdrawals(buyer), 0.2 ether); // refunded the skipped budget
        assertEq(address(mkt).balance, total);              // solvent
    }

    function test_sweep_priceRoseAboveMax_skips() public {
        _list(1, 0.1 ether); _list(2, 0.2 ether);
        vm.prank(seller); mkt.offerPhunkForSale(address(coll), 2, 0.5 ether); // re-list id 2 above buyer's max
        uint256 total = 0.3 ether;
        vm.deal(buyer, total); vm.prank(buyer);
        mkt.buyPhunkBatch{value: total}(_cs(2), _u(1, 2), _u(0.1 ether, 0.2 ether));

        assertEq(coll.ownerOf(1), buyer);
        assertEq(coll.ownerOf(2), seller);                  // too expensive -> skipped
        assertEq(mkt.pendingWithdrawals(buyer), 0.2 ether); // refunded
    }

    function test_sweep_priceDropped_buysLow_refundsDiff() public {
        _list(1, 0.1 ether);
        vm.prank(seller); mkt.offerPhunkForSale(address(coll), 1, 0.06 ether); // seller lowered the price
        vm.deal(buyer, 0.1 ether); vm.prank(buyer);
        mkt.buyPhunkBatch{value: 0.1 ether}(_cs(1), _u(1), _u(0.1 ether)); // buyer max still 0.1

        assertEq(coll.ownerOf(1), buyer);
        assertEq(mkt.pendingWithdrawals(buyer), 0.04 ether); // paid 0.06, refunded 0.04
        assertEq(address(mkt).balance, 0.1 ether);
    }

    function test_sweep_allGone_reverts_NothingBought() public {
        // nothing listed
        vm.deal(buyer, 0.1 ether); vm.prank(buyer);
        vm.expectRevert(QuantumPhunksMarketMulti.NothingBought.selector);
        mkt.buyPhunkBatch{value: 0.1 ether}(_cs(1), _u(1), _u(0.1 ether));
        assertEq(coll.ownerOf(1), seller);
    }

    function test_sweep_underpay_reverts_WrongValue() public {
        _list(1, 0.1 ether);
        vm.deal(buyer, 0.05 ether); vm.prank(buyer);
        vm.expectRevert(QuantumPhunksMarketMulti.WrongValue.selector);
        mkt.buyPhunkBatch{value: 0.05 ether}(_cs(1), _u(1), _u(0.1 ether)); // budget < price bought
        assertEq(coll.ownerOf(1), seller); // atomic rollback
    }

    function test_sweep_empty_reverts_BadBatch() public {
        vm.prank(buyer);
        vm.expectRevert(QuantumPhunksMarketMulti.BadBatch.selector);
        mkt.buyPhunkBatch(_cs(0), new uint256[](0), new uint256[](0));
    }

    function test_sweep_lengthMismatch_reverts_BadBatch() public {
        vm.prank(buyer);
        vm.expectRevert(QuantumPhunksMarketMulti.BadBatch.selector);
        mkt.buyPhunkBatch(_cs(2), _u(1, 2), _u(0.1 ether)); // maxPrices length mismatch
    }

    function test_sweep_ownItem_skipped() public {
        _list(1, 0.1 ether);
        vm.deal(seller, 0.1 ether); vm.prank(seller);
        vm.expectRevert(QuantumPhunksMarketMulti.NothingBought.selector); // own item skipped -> nothing bought
        mkt.buyPhunkBatch{value: 0.1 ether}(_cs(1), _u(1), _u(0.1 ether));
    }

    function test_sweep_refundsBuyerOwnBid() public {
        _list(1, 0.1 ether);
        vm.deal(buyer, 0.05 ether); vm.prank(buyer);
        mkt.enterBidForPhunk{value: 0.05 ether}(address(coll), 1);

        vm.deal(buyer, 0.1 ether); vm.prank(buyer);
        mkt.buyPhunkBatch{value: 0.1 ether}(_cs(1), _u(1), _u(0.1 ether));

        assertEq(coll.ownerOf(1), buyer);
        assertEq(mkt.pendingWithdrawals(buyer), 0.05 ether); // own bid refunded, no sweep change
        assertEq(address(mkt).balance, 0.15 ether);
    }

    /// Stateless fuzz: list k items at random prices, sweep all with matching maxPrices -> all bought, solvent.
    function testFuzz_sweep(uint256 kSeed, uint256 priceSeed) public {
        uint256 k = bound(kSeed, 1, 20);
        address[] memory cs = _cs(k);
        uint256[] memory ids = new uint256[](k);
        uint256[] memory maxP = new uint256[](k);
        uint256 total = 0;
        for (uint256 i = 0; i < k; i++) {
            uint256 id = i + 1;
            uint256 price = bound(uint256(keccak256(abi.encode(priceSeed, i))), 0.0001 ether, 5 ether);
            _list(id, price);
            ids[i] = id; maxP[i] = price; total += price;
        }
        vm.deal(buyer, total); vm.prank(buyer);
        mkt.buyPhunkBatch{value: total}(cs, ids, maxP);
        for (uint256 i = 0; i < k; i++) assertEq(coll.ownerOf(ids[i]), buyer);
        assertEq(mkt.pendingWithdrawals(buyer), 0); // all available -> no refund
        assertEq(address(mkt).balance, total);      // solvent
    }
}

/// Stateful invariant: ETH is conserved (balance == deposited - withdrawn) across list/bid/sweep/withdraw,
/// including best-effort sweeps that partially fill and refund.
contract SweepHandler is Test {
    QuantumPhunksMarketMulti public mkt;
    BMockColl public coll;
    address[3] public actors;
    uint256 public deposited;
    uint256 public withdrawn;

    constructor(QuantumPhunksMarketMulti _m, BMockColl _c, address[3] memory _a) { mkt = _m; coll = _c; actors = _a; }
    function _who(uint256 s) internal view returns (address) { return actors[bound(s, 0, 2)]; }
    function _p(uint256 s) internal pure returns (uint256) { return bound(s, 0.001 ether, 0.05 ether); }

    function list(uint256 uS, uint256 idS, uint256 pS) external {
        address u = _who(uS); uint256 id = bound(idS, 1, 18);
        if (coll.ownerOf(id) != u) return;
        vm.prank(u);
        try mkt.offerPhunkForSale(address(coll), id, _p(pS)) {} catch {}
    }
    function bid(uint256 uS, uint256 idS, uint256 vS) external {
        address u = _who(uS); uint256 id = bound(idS, 1, 18); uint256 v = _p(vS);
        vm.deal(u, v); vm.prank(u);
        try mkt.enterBidForPhunk{value: v}(address(coll), id) { deposited += v; } catch {}
    }
    function sweep(uint256 uS, uint256 idS, uint256 nS, uint256 budgetS) external {
        address u = _who(uS);
        uint256 n = bound(nS, 1, 4);
        address[] memory cs = new address[](n);
        uint256[] memory ids = new uint256[](n);
        uint256[] memory maxP = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 id = bound(uint256(keccak256(abi.encode(idS, i))), 1, 18);
            cs[i] = address(coll); ids[i] = id;
            (, , uint256 minV, ) = mkt.offers(address(coll), id);
            // fuzz the per-item max around the live price (sometimes too low -> item skipped)
            maxP[i] = bound(uint256(keccak256(abi.encode(budgetS, i))), 0, minV == 0 ? 0.05 ether : minV * 2);
        }
        // budget always covers everything that *could* be bought (maxP is the cap the contract enforces)
        uint256 budget = 0;
        for (uint256 i = 0; i < n; i++) budget += maxP[i];
        vm.deal(u, budget); vm.prank(u);
        try mkt.buyPhunkBatch{value: budget}(cs, ids, maxP) { deposited += budget; } catch {}
    }
    function withdraw(uint256 uS) external {
        address u = _who(uS); uint256 amt = mkt.pendingWithdrawals(u);
        if (amt == 0) return;
        vm.prank(u);
        try mkt.withdraw() { withdrawn += amt; } catch {}
    }
}

contract MarketSweepInvariant is Test {
    QuantumPhunksMarketMulti mkt;
    BMockColl coll;
    SweepHandler h;

    function setUp() public {
        address treasury = makeAddr("treasury");
        coll = new BMockColl(treasury);
        QuantumPhunksMarketMulti impl = new QuantumPhunksMarketMulti();
        bytes memory init = abi.encodeCall(QuantumPhunksMarketMulti.initialize, (address(this)));
        mkt = QuantumPhunksMarketMulti(payable(address(new ERC1967Proxy(address(impl), init))));
        mkt.setCollectionAllowed(address(coll), true);
        address[3] memory actors = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
        for (uint256 a; a < 3; a++) {
            for (uint256 k; k < 6; k++) { uint256 id = a * 6 + k + 1; coll.mint(actors[a], id); }
            vm.prank(actors[a]); coll.setApprovalForAll(address(mkt), true);
        }
        h = new SweepHandler(mkt, coll, actors);
        targetContract(address(h));
    }

    /// SOLVENCY: the market never creates or loses ETH, even with best-effort sweeps + refunds.
    function invariant_sweepSolvent() public view {
        assertEq(address(mkt).balance, h.deposited() - h.withdrawn());
    }
}
