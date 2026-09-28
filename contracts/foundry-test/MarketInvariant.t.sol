// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
// The DEPLOYED implementation is QuantumPhunksMarketMultiV2 (0x795a5a31...), not the base.
// Invariants that run against the base prove nothing about what is live.
import {QuantumPhunksMarketMultiV2 as QuantumPhunksMarketMulti} from "../contracts/QuantumPhunksMarketMultiV2.sol";

contract MockColl is ERC721 {
    address public t;
    constructor(address _t) ERC721("m", "M") { t = _t; }
    function mint(address to, uint256 id) external { _mint(to, id); }
    function royaltyInfo(uint256, uint256 p) external view returns (address, uint256) { return (t, (p * 500) / 10000); }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return true; }
}

contract MHandler is Test {
    QuantumPhunksMarketMulti public mkt;
    MockColl[2] public colls;
    address[3] public actors;
    uint256 public deposited;    // ghost: total ETH into the market
    uint256 public withdrawn;    // ghost: total ETH out

    constructor(QuantumPhunksMarketMulti _m, MockColl[2] memory _c, address[3] memory _a) {
        mkt = _m; colls = _c; actors = _a;
    }
    function _v(uint256 s) internal pure returns (uint256) { return bound(s, 0.01 ether, 0.09 ether); }
    function _u(uint256 s) internal view returns (address) { return actors[bound(s, 0, 2)]; }
    function _c(uint256 s) internal view returns (MockColl) { return colls[bound(s, 0, 1)]; }

    function bid(uint256 uS, uint256 cS, uint256 idS, uint256 vS) external {
        address u = _u(uS); MockColl c = _c(cS); uint256 id = bound(idS, 1, 18); uint256 v = _v(vS);
        vm.deal(u, v); vm.prank(u);
        try mkt.enterBidForPhunk{value: v}(address(c), id) { deposited += v; } catch {}
    }
    function collBid(uint256 uS, uint256 cS, uint256 vS, uint256 qS) external {
        address u = _u(uS); MockColl c = _c(cS); uint256 v = _v(vS); uint256 q = bound(qS, 1, 3);
        vm.deal(u, v * q); vm.prank(u);
        try mkt.enterCollectionBid{value: v * q}(address(c), v, q) { deposited += v * q; } catch {}
    }
    function acceptColl(uint256 uS, uint256 cS, uint256 idS, uint256 bS, uint256 vS) external {
        address u = _u(uS); MockColl c = _c(cS); uint256 id = bound(idS, 1, 18); address b = _u(bS); uint256 v = _v(vS);
        vm.prank(u);
        try mkt.acceptCollectionBid(address(c), id, b, v) {} catch {}   // internal escrow move, no net ETH change
    }
    function cancelColl(uint256 uS, uint256 cS, uint256 vS) external {
        address u = _u(uS); MockColl c = _c(cS); uint256 v = _v(vS);
        vm.prank(u);
        try mkt.withdrawCollectionBid(address(c), v, 1) {} catch {}     // moves to pull balance, no net ETH change
    }
    function withdraw(uint256 uS) external {
        address u = _u(uS); uint256 amt = mkt.pendingWithdrawals(u);
        if (amt == 0) return;
        vm.prank(u);
        try mkt.withdraw() { withdrawn += amt; } catch {}
    }
}

contract MarketInvariant is Test {
    QuantumPhunksMarketMulti mkt;
    MockColl[2] colls;
    MHandler h;

    function setUp() public {
        address treasury = makeAddr("treasury");
        colls[0] = new MockColl(treasury);
        colls[1] = new MockColl(treasury);
        QuantumPhunksMarketMulti impl = new QuantumPhunksMarketMulti();
        bytes memory init = abi.encodeCall(QuantumPhunksMarketMulti.initialize, (address(this)));
        mkt = QuantumPhunksMarketMulti(payable(address(new ERC1967Proxy(address(impl), init))));
        address[3] memory actors = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
        for (uint256 i; i < 2; i++) {
            mkt.setCollectionAllowed(address(colls[i]), true);
            for (uint256 a; a < 3; a++) {
                for (uint256 k; k < 6; k++) { uint256 id = a * 6 + k + 1; colls[i].mint(actors[a], id); }
                vm.prank(actors[a]); colls[i].setApprovalForAll(address(mkt), true);
            }
        }
        h = new MHandler(mkt, colls, actors);
        targetContract(address(h));
    }

    /// SOLVENCY: the market's ETH balance is ALWAYS exactly (deposited - withdrawn) — never creates or loses ETH.
    function invariant_solvent() public view {
        assertEq(address(mkt).balance, h.deposited() - h.withdrawn());
    }
}
