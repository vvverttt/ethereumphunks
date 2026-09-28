// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
// The DEPLOYED implementation is PhilipLotteryV67Erc721WlFix from PhilipLotteryV67_WlRefundFix.sol
// (0x18756f2a...), a different FILE from QuantumPhunksLottery.sol this used to import.
import {PhilipLotteryV67Erc721WlFix as PhilipLotteryV67Erc721} from "../contracts/PhilipLotteryV67_WlRefundFix.sol";
import {MockVRFWrapper} from "../contracts/mock/MockVRFWrapper.sol";

// minimal IQuantumPhunksNFT
contract MockNFT {
    mapping(uint256 => address) public raw;
    function configured(uint256) external pure returns (bool) { return true; }
    function isImageSet(uint256) external pure returns (bool) { return true; }
    function ownerOfRaw(uint256 id) external view returns (address) { return raw[id]; }
    function mintFromLottery(address to, uint256 id) external { raw[id] = to; }
    function transferFromLottery(address to, uint256 id) external { raw[id] = to; }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return false; }
}
contract MockVault { function recordBacking(uint256, address, uint256, uint256) external {} }

contract LHandler is Test {
    PhilipLotteryV67Erc721 public lot;
    MockVRFWrapper public wrap;
    address[3] public actors;
    uint256[] public pending;          // in-flight requestIds
    uint256 public vrfCost;

    constructor(PhilipLotteryV67Erc721 _l, MockVRFWrapper _w, address[3] memory _a, uint256 _vrf) {
        lot = _l; wrap = _w; actors = _a; vrfCost = _vrf;
    }

    function requestMint(uint256 aSeed, uint256 qSeed) external {
        address a = actors[bound(aSeed, 0, 2)];
        uint8 q = uint8(bound(qSeed, 1, 8));
        uint256 pay = lot.mintPrice() * q + vrfCost;
        vm.deal(a, pay);
        address[] memory c; uint256[] memory t;
        vm.prank(a, a);                                  // EOA (msg.sender==tx.origin)
        try lot.requestMint{value: pay}(q, c, t) { pending.push(wrap.lastRequestId()); } catch {}
    }
    function fulfill(uint256 idxSeed, uint256 word) external {
        if (pending.length == 0) return;
        uint256 i = bound(idxSeed, 0, pending.length - 1);
        try wrap.fulfill(pending[i], word) { pending[i] = pending[pending.length - 1]; pending.pop(); } catch {}
    }
    function refund(uint256 idxSeed) external {
        if (pending.length == 0) return;
        uint256 i = bound(idxSeed, 0, pending.length - 1);
        vm.roll(block.number + 400);                     // past STUCK_SPIN_REFUND_DELAY
        try lot.refundStuckSpin(pending[i]) { pending[i] = pending[pending.length - 1]; pending.pop(); } catch {}
    }
    function ownerWithdraw(uint256 amtSeed) external {
        // owner may only pull the SURPLUS; committed + refunds must stay
        uint256 bal = address(lot).balance;
        uint256 locked = lot.totalCommittedETH() + lot.totalPendingRefunds();
        uint256 surplus = bal > locked ? bal - locked : 0;
        if (surplus == 0) return;
        uint256 amt = bound(amtSeed, 1, surplus);
        vm.prank(lot.owner());
        try lot.withdrawSurplusETH(payable(address(0xBEEF)), amt) {} catch {}
    }
    function claim(uint256 aSeed) external {
        address a = actors[bound(aSeed, 0, 2)];
        vm.prank(a);
        try lot.withdrawRefund() {} catch {}
    }
}

contract LotteryInvariant is Test {
    PhilipLotteryV67Erc721 lot;
    MockVRFWrapper wrap;
    LHandler h;

    function setUp() public {
        MockNFT nft = new MockNFT();
        MockVault vault = new MockVault();
        wrap = new MockVRFWrapper(0.001 ether);
        PhilipLotteryV67Erc721 impl = new PhilipLotteryV67Erc721();
        bytes memory init = abi.encodeCall(PhilipLotteryV67Erc721.initialize, (address(nft), payable(address(this))));
        lot = PhilipLotteryV67Erc721(payable(address(new ERC1967Proxy(address(impl), init))));
        lot.setVRFConfig(address(wrap), 500000, 3);
        lot.setLotteryConfig(0.01 ether, 8, true);
        lot.setVault(address(vault));
        uint256[] memory ids = new uint256[](400);
        for (uint256 i; i < 400; i++) ids[i] = i + 1;
        lot.addPoolTokens(ids);
        address[3] memory a = [makeAddr("alice"), makeAddr("bob"), makeAddr("carol")];
        h = new LHandler(lot, wrap, a, 0.001 ether);
        targetContract(address(h));
    }

    /// MONEY SAFETY: player-committed ETH + owed refunds are ALWAYS covered by the balance — owner can't touch them.
    function invariant_committedProtected() public view {
        assertGe(address(lot).balance, lot.totalCommittedETH() + lot.totalPendingRefunds());
    }
}
