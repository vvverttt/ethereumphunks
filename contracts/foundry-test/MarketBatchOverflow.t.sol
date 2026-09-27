// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
// Named imports: both files declare IPoints/ICollection at file scope, so a plain
// import of each would clash.
import {QuantumPhunksMarketMulti} from "../contracts/QuantumPhunksMarketMulti.sol";
import {QuantumPhunksMarketMultiV2} from "../contracts/QuantumPhunksMarketMultiV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// Minimal ERC-721 + ERC-2981 stand-in. Only what the market actually calls.
contract MockNFT {
    mapping(uint256 => address) public ownerOf;
    function mint(address to, uint256 id) external { ownerOf[id] = to; }
    function transferFrom(address from, address to, uint256 id) external {
        require(ownerOf[id] == from, "not owner");
        ownerOf[id] = to;
    }
    /// 5%, checked — mirrors OpenZeppelin ERC2981, which reverts when salePrice*500 overflows.
    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (address(this), (salePrice * 500) / 10000);
    }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return true; }
}

/// The finding: buyPhunkBatch settles at the SELLER's uncapped `minValue`, accumulated
/// `unchecked`, and only compares the total to msg.value AFTER _settle has credited
/// balances. Listing at absurd prices wraps the total, so a batch can settle for free
/// and mint escrow credit that was never paid for — then be withdrawn as real ETH
/// belonging to other users' bids.
contract MarketBatchOverflowTest is Test {
    MockNFT nft;
    address seller = address(0xAAA1);   // attacker wallet 1
    address buyer  = address(0xBBB2);   // attacker wallet 2
    address victim = address(0xCCC3);   // an honest bidder whose ETH is escrowed

    // royaltyInfo does salePrice*500 in CHECKED arithmetic, so a single price cannot exceed
    // type(uint256).max/500 (~2^247). Wrapping `spent` past 2^256 therefore needs ~500
    // DISTINCT tokens the attacker owns — that constraint is what caps the severity.
    uint256 constant CAP = type(uint256).max / 500;
    uint256 constant N   = 500;
    // 500*CAP lands just BELOW 2^256, so one extra tiny listing tips the sum to exactly
    // 2^256 and `spent` wraps to 0. TOPUP is that remainder.
    uint256 constant TOPUP = 0 - (CAP * N);   // == 2**256 - 500*CAP, computed by wrapping

    function setUp() public {
        nft = new MockNFT();
        for (uint256 i = 1; i <= N + 1; ++i) nft.mint(seller, i);
        vm.deal(buyer, 1 ether);
        vm.deal(victim, 10 ether);
    }

    function _listMany(address market) internal {
        vm.startPrank(seller);
        for (uint256 i = 1; i <= N; ++i) QuantumPhunksMarketMulti(market).offerPhunkForSale(address(nft), i, CAP);
        QuantumPhunksMarketMulti(market).offerPhunkForSale(address(nft), N + 1, TOPUP);
        vm.stopPrank();
    }

    function _manyArgs() internal view returns (address[] memory cs, uint256[] memory ids, uint256[] memory mx) {
        cs = new address[](N + 1); ids = new uint256[](N + 1); mx = new uint256[](N + 1);
        for (uint256 i = 0; i <= N; ++i) { cs[i] = address(nft); ids[i] = i + 1; mx[i] = type(uint256).max; }
    }

    /// FINDING, and its limits.
    ///
    /// buyPhunkBatch accumulates `spent` UNCHECKED and only compares it to msg.value AFTER
    /// _settle has already credited balances, using the SELLER's uncapped `minValue` as the
    /// price. That is the defect the V2 fix removes.
    ///
    /// I could not build a working exploit. royaltyInfo does `salePrice * 500` in checked
    /// maths, capping one listing at type(uint256).max/500, so wrapping `spent` needs ~501
    /// distinct attacker-owned tokens — and at those magnitudes other CHECKED arithmetic in
    /// _settle reverts first. withdraw() is all-or-nothing too, so an inflated credit above
    /// the contract balance cannot be drained. Latent bug worth removing; not a demonstrated
    /// exploit. Recorded here so the next reader does not have to redo the work.

    /// The ordinary path must still work unchanged.
    function test_NEW_impl_normal_batch_still_works() public {
        QuantumPhunksMarketMultiV2 m = QuantumPhunksMarketMultiV2(address(new ERC1967Proxy(
            address(new QuantumPhunksMarketMultiV2()),
            abi.encodeCall(QuantumPhunksMarketMultiV2.initialize, (address(this)))
        )));
        m.setCollectionAllowed(address(nft), true);

        vm.startPrank(seller);
        m.offerPhunkForSale(address(nft), 1, 1 ether);
        m.offerPhunkForSale(address(nft), 2, 2 ether);
        vm.stopPrank();

        address[] memory cs = new address[](2); uint256[] memory ids = new uint256[](2); uint256[] memory mx = new uint256[](2);
        cs[0] = address(nft); cs[1] = address(nft); ids[0] = 1; ids[1] = 2;
        mx[0] = type(uint256).max; mx[1] = type(uint256).max;
        vm.deal(buyer, 5 ether);
        vm.prank(buyer);
        m.buyPhunkBatch{value: 3 ether}(cs, ids, mx);

        assertEq(nft.ownerOf(1), buyer);
        assertEq(nft.ownerOf(2), buyer);
        // 3 ETH of sales, 5% royalty = 0.15 to the receiver, 2.85 to the seller.
        assertEq(m.pendingWithdrawals(seller), 2.85 ether, "seller gets 95%");
        assertEq(m.pendingWithdrawals(address(nft)), 0.15 ether, "royalty paid");
    }
}
