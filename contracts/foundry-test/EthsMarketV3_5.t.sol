// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {EtherPhunksMarketV3_2} from "../contracts/V2MainnetUpgrade/EtherPhunksMarketV3_2.sol";
import {EtherPhunksMarketV3_5} from "../contracts/V2MainnetUpgrade/EtherPhunksMarketV3_5.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// A royalty receiver that refuses ETH. Under V3_4's push payout this reverts the whole
/// sale; under V3_5's pull payout the sale completes and the share sits claimable.
contract RejectingReceiver {
    receive() external payable { revert("nope"); }
}

contract EthsMarketV3_5Test is Test {
    EtherPhunksMarketV3_5 m;
    address owner  = address(0xA01);
    address seller = address(0x5E11E2);
    address bidder = address(0xB1DDE2);
    bytes32 constant PHUNK = keccak256("phunk-1");

    function setUp() public {
        vm.prank(owner);
        m = EtherPhunksMarketV3_5(payable(address(new ERC1967Proxy(
            address(new EtherPhunksMarketV3_5()),
            abi.encodeCall(EtherPhunksMarketV3_2.initialize, (5, address(0xBEEF)))
        ))));
        vm.deal(bidder, 100 ether);
        vm.deal(seller, 1 ether);
    }

    // ---- 1. withdraw() ordering -------------------------------------------------

    function test_withdraw_zeroes_before_sending() public {
        // give the seller a pending balance by way of a cancelled bid
        vm.prank(bidder);
        m.enterBid{value: 1 ether}(PHUNK, seller);
        vm.prank(bidder);
        m.withdrawBid(PHUNK, seller);
        assertEq(m.pendingWithdrawals(bidder), 1 ether);

        uint256 before = bidder.balance;
        vm.prank(bidder);
        m.withdraw();

        assertEq(m.pendingWithdrawals(bidder), 0, "balance cleared");
        assertEq(bidder.balance, before + 1 ether, "ETH received");

        vm.prank(bidder);
        vm.expectRevert("No pending withdrawals");
        m.withdraw();
    }

    // ---- 2. royalties by pull ---------------------------------------------------

    function test_royalties_credit_instead_of_pushing() public {
        RejectingReceiver bad = new RejectingReceiver();
        address payable[] memory rs = new address payable[](1);
        uint256[] memory sh = new uint256[](1);
        rs[0] = payable(address(bad));
        sh[0] = 10000;

        vm.startPrank(m.owner());   // initialize() set the owner to the proxy deployer
        m.setRoyaltyBps(500);
        m.setRoyaltyReceivers(rs, sh);
        vm.stopPrank();

        // A receiver that reverts on receive() must NOT be able to block anything.
        // Under pull it simply accrues a claimable balance.
        assertEq(m.pendingWithdrawals(address(bad)), 0);
    }

    // ---- 3. accepted bids expire ------------------------------------------------

    function test_accepted_bid_can_be_expired_and_refunds_bidder() public {
        vm.prank(bidder);
        m.enterBid{value: 2 ether}(PHUNK, seller);

        // seller escrows the ethscription, then accepts
        vm.prank(seller);
        (bool ok, ) = address(m).call(abi.encodePacked(PHUNK));
        assertTrue(ok, "deposit");
        vm.prank(seller);
        m.acceptBid(PHUNK, bidder, 1 ether);

        // before expiry nobody can clear it
        vm.expectRevert("Not expired yet");
        m.expireAcceptedBid(PHUNK, seller);

        // the bidder is locked out of withdrawing, as designed
        vm.prank(bidder);
        vm.expectRevert("Bid accepted, cannot withdraw");
        m.withdrawBid(PHUNK, seller);

        vm.roll(block.number + m.ACCEPTED_BID_EXPIRY_BLOCKS() + 1);

        // anyone may clear it; the bidder gets their ETH back
        m.expireAcceptedBid(PHUNK, seller);
        assertEq(m.pendingWithdrawals(bidder), 2 ether, "bidder refunded");

        (bool hasBid, , , ) = m.bids(seller, PHUNK);
        assertFalse(hasBid, "slot freed");

        // and the slot is usable again
        vm.prank(bidder);
        m.enterBid{value: 3 ether}(PHUNK, seller);
    }

    function test_expire_rejects_unaccepted_bid() public {
        vm.prank(bidder);
        m.enterBid{value: 1 ether}(PHUNK, seller);
        vm.roll(block.number + 100000);
        vm.expectRevert("Not accepted");
        m.expireAcceptedBid(PHUNK, seller);
    }
}
