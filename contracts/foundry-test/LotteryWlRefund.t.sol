// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {PhilipLotteryV67Erc721} from "../contracts/PhilipLotteryV67_CarlRouting.sol";
import {PhilipLotteryV67Erc721WlFix} from "../contracts/PhilipLotteryV67_WlRefundFix.sol";
import {MockVRFWrapper} from "../contracts/mock/MockVRFWrapper.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// Minimal stand-in for the NFT the lottery mints from.
contract MockNFT {
    mapping(uint256 => address) public raw;
    function isImageSet(uint256) external pure returns (bool) { return true; }
    function ownerOfRaw(uint256 id) external view returns (address) { return raw[id]; }
    function mintFromLottery(address to, uint256 id) external { raw[id] = to; }
    function transferFromLottery(address to, uint256 id) external { raw[id] = to; }
    function hasTrait(uint256, string calldata, string calldata) external pure returns (bool) { return true; }
}

/// The finding: requestMint consumed the whitelist discount allowance up front, but
/// _refundSpin never gave it back. A stuck or cancelled spin returned the buyer's ETH
/// and NFTs while permanently burning their discounted-mint allocation.
contract LotteryWlRefundTest is Test {
    MockNFT nft;
    MockVRFWrapper vrf;
    address player = address(0xB1A7E2);
    address payable treasury = payable(address(0x7EA5));

    function _deployOld() internal returns (PhilipLotteryV67Erc721 l) {
        l = PhilipLotteryV67Erc721(payable(address(new ERC1967Proxy(
            address(new PhilipLotteryV67Erc721()),
            abi.encodeCall(PhilipLotteryV67Erc721.initialize, (address(nft), treasury))
        ))));
    }
    function _deployNew() internal returns (PhilipLotteryV67Erc721WlFix l) {
        l = PhilipLotteryV67Erc721WlFix(payable(address(new ERC1967Proxy(
            address(new PhilipLotteryV67Erc721WlFix()),
            abi.encodeCall(PhilipLotteryV67Erc721WlFix.initialize, (address(nft), treasury))
        ))));
    }

    function setUp() public {
        nft = new MockNFT();
        vrf = new MockVRFWrapper(0.01 ether);   // VRF fee
        vm.deal(player, 100 ether);
    }

    function _configure(address l) internal {
        uint256[] memory ids = new uint256[](150);   // > SINGLE_MINT_ONLY_THRESHOLD (100) so batches are allowed
        for (uint256 i; i < 150; ++i) ids[i] = i + 1;
        PhilipLotteryV67Erc721 m = PhilipLotteryV67Erc721(payable(l));
        m.setVRFConfig(address(vrf), 200000, 3);
        m.addPoolTokens(ids);
        m.setLotteryConfig(1 ether, 8, true);
        address[] memory wl = new address[](1);
        wl[0] = player;
        m.setWhitelist(wl, true);
        m.setWhitelistDiscount(0.5 ether);
        m.setWhitelistDiscountCap(5);          // 5 discounted tokens, total
    }

    function _spin(address l, uint8 qty) internal returns (uint256 reqId) {
        address[] memory cs = new address[](0);
        uint256[] memory ts = new uint256[](0);
        uint256 cost = PhilipLotteryV67Erc721(payable(l)).quote(player, qty, cs, ts) + 0.02 ether;   // cover the VRF fee
        vm.prank(player, player);              // requestMint is onlyEOA
        PhilipLotteryV67Erc721(payable(l)).requestMint{value: cost}(qty, cs, ts);
        return vrf.lastRequestId();
    }

    function test_OLD_burns_the_allowance_on_a_refunded_spin() public {
        PhilipLotteryV67Erc721 l = _deployOld();
        _configure(address(l));

        assertEq(l.whitelistDiscountRemaining(player), 5, "starts with 5");
        uint256 req = _spin(address(l), 3);
        assertEq(l.whitelistDiscountRemaining(player), 2, "3 consumed");

        l.cancelPendingMint(req);              // spin never happens, ETH refunded

        assertEq(l.whitelistDiscountRemaining(player), 2,
            "BUG: allowance still spent on a spin that never ran");
    }

    function test_NEW_restores_the_allowance_on_a_refunded_spin() public {
        PhilipLotteryV67Erc721WlFix l = _deployNew();
        _configure(address(l));

        assertEq(l.whitelistDiscountRemaining(player), 5);
        uint256 req = _spin(address(l), 3);
        assertEq(l.whitelistDiscountRemaining(player), 2, "3 consumed while in flight");

        l.cancelPendingMint(req);

        assertEq(l.whitelistDiscountRemaining(player), 5, "allowance handed back");
        assertEq(l.pendingRefunds(player) > 0, true, "ETH still refunded as before");
    }

    /// A spin that actually settles must still consume the allowance.
    function test_NEW_keeps_the_allowance_spent_on_a_settled_spin() public {
        PhilipLotteryV67Erc721WlFix l = _deployNew();
        _configure(address(l));

        uint256 req = _spin(address(l), 3);
        uint256[] memory words = new uint256[](1);
        words[0] = uint256(keccak256("rand"));
        vm.prank(address(vrf));
        l.rawFulfillRandomWords(req, words);

        assertEq(l.whitelistDiscountRemaining(player), 2, "genuinely used");
    }
}
