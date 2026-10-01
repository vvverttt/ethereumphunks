// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {QuantumPhunksMarketMultiV2} from "../contracts/QuantumPhunksMarketMultiV2.sol";
import {QuantumPhunksMarketMultiV3} from "../contracts/QuantumPhunksMarketMultiV3.sol";

contract MockColl is ERC721 {
    address public t;
    bool public noReceiver;
    constructor(address _t) ERC721("m", "M") { t = _t; }
    function mint(address to, uint256 id) external { _mint(to, id); }
    function setNoReceiver(bool v) external { noReceiver = v; }
    function royaltyInfo(uint256, uint256 p) external view returns (address, uint256) {
        return (noReceiver ? address(0) : t, (p * 500) / 10000);   // 5%
    }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return true; }
}

contract MarketLowPriceFeeTest is Test {
    QuantumPhunksMarketMultiV3 mkt;
    MockColl coll;
    address owner = address(this);
    address treasury = address(0x7EA5);
    address alice = address(0xA11CE);   // seller
    address bob = address(0xB0B);       // buyer

    uint256 constant THRESHOLD = 0.067 ether;
    uint256 constant BPS = 6_700;

    function setUp() public {
        coll = new MockColl(treasury);
        mkt = QuantumPhunksMarketMultiV3(payable(address(new ERC1967Proxy(
            address(new QuantumPhunksMarketMultiV3()),
            abi.encodeCall(QuantumPhunksMarketMultiV2.initialize, (owner))
        ))));
        mkt.setCollectionAllowed(address(coll), true);
        mkt.setDefaultLowPriceFee();

        coll.mint(alice, 1);
        coll.mint(alice, 2);
        vm.prank(alice);
        coll.setApprovalForAll(address(mkt), true);
        vm.deal(bob, 100 ether);
    }

    function _sellAt(uint256 price, uint256 id) internal {
        vm.prank(alice);
        mkt.offerPhunkForSale(address(coll), id, price);
        address[] memory cs = new address[](1); cs[0] = address(coll);
        uint256[] memory ids = new uint256[](1); ids[0] = id;
        uint256[] memory ps = new uint256[](1); ps[0] = price;
        vm.prank(bob);
        mkt.buyPhunkBatch{value: price}(cs, ids, ps);
    }

    // ---- the feature ----------------------------------------------------------

    function test_below_threshold_takes_67_percent() public {
        uint256 price = 0.05 ether;
        _sellAt(price, 1);

        uint256 expectedFee = (price * BPS) / 10_000;      // 0.0335
        assertEq(mkt.pendingWithdrawals(treasury), expectedFee, "treasury should get 67%");
        assertEq(mkt.pendingWithdrawals(alice), price - expectedFee, "seller gets the rest");
        assertEq(mkt.pendingWithdrawals(alice), 0.0165 ether);
    }

    function test_at_or_above_threshold_takes_normal_royalty() public {
        uint256 price = THRESHOLD;                          // exactly 0.067 — NOT below
        _sellAt(price, 1);

        uint256 expectedFee = (price * 500) / 10_000;       // 5%
        assertEq(mkt.pendingWithdrawals(treasury), expectedFee, "should be the 5% royalty");
        assertEq(mkt.pendingWithdrawals(alice), price - expectedFee);
    }

    /// The boundary is strict `<`, so one wei decides which rate applies. Pinned because the
    /// whole point is a hard floor at the threshold — an off-by-one here moves the floor.
    function test_boundary_is_exact_to_the_wei() public {
        _sellAt(THRESHOLD - 1, 1);
        uint256 lowFee = mkt.pendingWithdrawals(treasury);
        assertEq(lowFee, ((THRESHOLD - 1) * BPS) / 10_000, "one wei under -> 67%");

        _sellAt(THRESHOLD, 2);
        uint256 added = mkt.pendingWithdrawals(treasury) - lowFee;
        assertEq(added, (THRESHOLD * 500) / 10_000, "exactly at -> 5%");
    }

    /// The fee REPLACES the royalty, it does not stack. 67%, not 72%.
    function test_fee_replaces_royalty_does_not_stack() public {
        uint256 price = 0.01 ether;
        _sellAt(price, 1);
        assertEq(mkt.pendingWithdrawals(treasury), (price * BPS) / 10_000);
        assertEq(
            mkt.pendingWithdrawals(treasury) + mkt.pendingWithdrawals(alice),
            price,
            "split must still sum to exactly the price"
        );
    }

    // ---- solvency: the property a fee change could most easily break -----------

    /// Whatever the rate, seller + receiver must equal the price exactly. More would mint ETH
    /// the contract does not hold; less would strand it and break withdrawals.
    function testFuzz_split_always_sums_to_price(uint96 rawPrice) public {
        uint256 price = bound(uint256(rawPrice), 1, 50 ether);
        vm.deal(bob, price);
        _sellAt(price, 1);

        assertEq(
            mkt.pendingWithdrawals(alice) + mkt.pendingWithdrawals(treasury),
            price,
            "escrow must equal the sale exactly"
        );
        assertGe(address(mkt).balance, price, "contract must hold what it owes");
    }

    function testFuzz_fee_never_exceeds_price(uint96 rawPrice, uint16 bps) public {
        uint256 price = bound(uint256(rawPrice), 1, 50 ether);
        mkt.configureLowPriceFee(100 ether, uint256(bound(bps, 0, 10_000)));   // threshold above any price
        vm.deal(bob, price);
        _sellAt(price, 1);
        assertLe(mkt.pendingWithdrawals(treasury), price);
        assertEq(mkt.pendingWithdrawals(alice) + mkt.pendingWithdrawals(treasury), price);
    }

    /// A collection with no ERC-2981 receiver must not strand the fee in the contract.
    function test_no_receiver_returns_fee_to_seller() public {
        coll.setNoReceiver(true);
        uint256 price = 0.05 ether;
        _sellAt(price, 1);
        assertEq(mkt.pendingWithdrawals(alice), price, "seller gets all of it");
        assertEq(mkt.pendingWithdrawals(address(0)), 0, "nothing stranded at the zero address");
    }

    // ---- configuration --------------------------------------------------------

    function test_threshold_zero_restores_v2_behaviour() public {
        mkt.configureLowPriceFee(0, BPS);
        uint256 price = 0.001 ether;                       // far below the old threshold
        _sellAt(price, 1);
        assertEq(mkt.pendingWithdrawals(treasury), (price * 500) / 10_000, "plain 5% royalty");
    }

    function test_bps_capped_at_100_percent() public {
        vm.expectRevert(QuantumPhunksMarketMultiV3.BpsTooHigh.selector);
        mkt.configureLowPriceFee(THRESHOLD, 10_001);
        mkt.configureLowPriceFee(THRESHOLD, 10_000);        // 100% is allowed
        assertEq(mkt.lowPriceBps(), 10_000);
    }

    function test_only_owner_configures() public {
        vm.prank(alice);
        vm.expectRevert();
        mkt.configureLowPriceFee(1 ether, 100);
    }

    function test_defaults_are_067_and_67_percent() public view {
        assertEq(mkt.lowPriceThreshold(), 0.067 ether);
        assertEq(mkt.lowPriceBps(), 6_700);
    }

    // ---- quoteSale, so the UI can warn before listing ---------------------------

    function test_quoteSale_matches_what_actually_happens() public {
        uint256 price = 0.05 ether;
        (uint256 fee, uint256 toSeller, bool isLow) = mkt.quoteSale(address(coll), 1, price);
        assertTrue(isLow);
        assertEq(fee, (price * BPS) / 10_000);
        assertEq(toSeller, price - fee);

        _sellAt(price, 1);
        assertEq(mkt.pendingWithdrawals(treasury), fee, "quote matched the settlement");
        assertEq(mkt.pendingWithdrawals(alice), toSeller);
    }

    function test_quoteSale_above_threshold() public view {
        (uint256 fee, uint256 toSeller, bool isLow) = mkt.quoteSale(address(coll), 1, 1 ether);
        assertFalse(isLow);
        assertEq(fee, 0.05 ether);        // 5%
        assertEq(toSeller, 0.95 ether);
    }

    // ---- upgrade safety ---------------------------------------------------------

    function test_upgrade_from_v2_preserves_state_and_applies_the_fee() public {
        // a fresh V2, mid-use
        QuantumPhunksMarketMultiV2 v2 = QuantumPhunksMarketMultiV2(payable(address(new ERC1967Proxy(
            address(new QuantumPhunksMarketMultiV2()),
            abi.encodeCall(QuantumPhunksMarketMultiV2.initialize, (owner))
        ))));
        v2.setCollectionAllowed(address(coll), true);
        MockColl c2 = new MockColl(treasury);
        c2.mint(alice, 7);
        v2.setCollectionAllowed(address(c2), true);
        vm.prank(alice); c2.setApprovalForAll(address(v2), true);

        vm.prank(alice);
        v2.offerPhunkForSale(address(c2), 7, 0.05 ether);

        address newImpl = address(new QuantumPhunksMarketMultiV3());
        v2.upgradeToAndCall(newImpl, "");
        QuantumPhunksMarketMultiV3 up = QuantumPhunksMarketMultiV3(payable(address(v2)));

        // the listing survived
        (bool forSale,, uint256 minValue,) = up.offers(address(c2), 7);
        assertTrue(forSale, "listing lost across the upgrade");
        assertEq(minValue, 0.05 ether);

        // fee is OFF until configured — the new slots start zeroed
        assertEq(up.lowPriceThreshold(), 0, "must not auto-enable");
        up.setDefaultLowPriceFee();
        assertEq(up.lowPriceThreshold(), 0.067 ether);

        address[] memory cs = new address[](1); cs[0] = address(c2);
        uint256[] memory ids = new uint256[](1); ids[0] = 7;
        uint256[] memory ps = new uint256[](1); ps[0] = 0.05 ether;
        vm.prank(bob);
        up.buyPhunkBatch{value: 0.05 ether}(cs, ids, ps);
        assertEq(up.pendingWithdrawals(treasury), (0.05 ether * BPS) / 10_000, "fee applied after upgrade");
    }
}
