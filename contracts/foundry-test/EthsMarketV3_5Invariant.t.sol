// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {EtherPhunksMarketV3_2} from "../contracts/V2MainnetUpgrade/EtherPhunksMarketV3_2.sol";
import {EtherPhunksMarketV3_5} from "../contracts/V2MainnetUpgrade/EtherPhunksMarketV3_5.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// Drives the market through random sequences of every money-moving path.
/// Bids, refunds, acceptance, expiry and withdrawals all run against real ETH.
contract EHandler is Test {
    EtherPhunksMarketV3_5 public m;
    address[4] public actors;
    bytes32[3] public ids;

    /// Every address the invariant must account for, including the royalty receiver.
    function allActors() external view returns (address[4] memory) { return actors; }
    function allIds() external view returns (bytes32[3] memory) { return ids; }

    constructor(EtherPhunksMarketV3_5 _m, address[4] memory _actors, bytes32[3] memory _ids) {
        m = _m; actors = _actors; ids = _ids;
    }

    function _actor(uint256 s) internal view returns (address) { return actors[s % actors.length]; }
    function _id(uint256 s) internal view returns (bytes32) { return ids[s % ids.length]; }

    function enterBid(uint256 bidderSeed, uint256 ownerSeed, uint256 idSeed, uint96 amount) public {
        address bidder = _actor(bidderSeed);
        address owner_ = _actor(ownerSeed);
        bytes32 id = _id(idSeed);
        uint256 amt = uint256(amount) % 5 ether;
        if (amt == 0 || bidder == owner_) return;
        vm.deal(bidder, bidder.balance + amt);
        vm.prank(bidder);
        try m.enterBid{value: amt}(id, owner_) {} catch {}
    }

    function withdrawBid(uint256 bidderSeed, uint256 ownerSeed, uint256 idSeed) public {
        vm.prank(_actor(bidderSeed));
        try m.withdrawBid(_id(idSeed), _actor(ownerSeed)) {} catch {}
    }

    /// Deposit the ethscription into escrow through the fallback, then accept.
    function depositAndAccept(uint256 ownerSeed, uint256 idSeed, uint256 bidderSeed) public {
        address owner_ = _actor(ownerSeed);
        bytes32 id = _id(idSeed);
        vm.prank(owner_);
        (bool ok, ) = address(m).call(abi.encodePacked(id));
        ok; // a repeat deposit from the same owner reverts by design
        vm.prank(owner_);
        try m.acceptBid(id, _actor(bidderSeed), 0) {} catch {}
    }

    function confirmBid(uint256 bidderSeed, uint256 ownerSeed, uint256 idSeed, uint8 roll) public {
        vm.roll(block.number + (uint256(roll) % 12));
        vm.prank(_actor(bidderSeed));
        try m.confirmBid(_id(idSeed), _actor(ownerSeed)) {} catch {}
    }

    /// The new escape hatch. Rolling far enough forward makes it callable.
    function expireAcceptedBid(uint256 ownerSeed, uint256 idSeed, bool jump) public {
        if (jump) vm.roll(block.number + m.ACCEPTED_BID_EXPIRY_BLOCKS() + 1);
        try m.expireAcceptedBid(_id(idSeed), _actor(ownerSeed)) {} catch {}
    }

    function withdraw(uint256 actorSeed) public {
        vm.prank(_actor(actorSeed));
        try m.withdraw() {} catch {}
    }

    function listAndBuy(uint256 sellerSeed, uint256 buyerSeed, uint256 idSeed, uint96 price) public {
        address seller = _actor(sellerSeed);
        address buyer = _actor(buyerSeed);
        bytes32 id = _id(idSeed);
        uint256 p = uint256(price) % 3 ether;
        if (seller == buyer || p == 0) return;

        vm.prank(seller);
        (bool ok, ) = address(m).call(abi.encodePacked(id));
        ok;
        vm.prank(seller);
        try m.offerPhunkForSale(id, p) {} catch { return; }

        bytes32[] memory bIds = new bytes32[](1);
        uint256[] memory prices = new uint256[](1);
        bIds[0] = id; prices[0] = p;
        vm.deal(buyer, buyer.balance + p);
        vm.roll(block.number + 6);          // clear the escrow cooldown
        vm.prank(buyer);
        try m.batchBuyPhunk{value: p}(bIds, prices) {} catch {}
    }
}

/// INVARIANT: the contract must always hold at least what it owes —
///   balance >= Σ pendingWithdrawals + Σ value locked in live bids
/// If this ever breaks, someone's withdraw() fails or someone is overpaid.
contract EthsMarketV3_5Invariant is Test {
    EtherPhunksMarketV3_5 m;
    EHandler h;
    address[4] actors;
    bytes32[3] ids;

    function setUp() public {
        m = EtherPhunksMarketV3_5(payable(address(new ERC1967Proxy(
            address(new EtherPhunksMarketV3_5()),
            abi.encodeCall(EtherPhunksMarketV3_2.initialize, (5, address(0xBEEF)))
        ))));

        actors = [address(0xA1), address(0xA2), address(0xA3), address(0xA4)];
        ids = [keccak256("p1"), keccak256("p2"), keccak256("p3")];

        // 5% royalty to an actor, so royalty accounting is inside the invariant too.
        address payable[] memory rs = new address payable[](1);
        uint256[] memory sh = new uint256[](1);
        rs[0] = payable(actors[3]); sh[0] = 10000;
        m.setRoyaltyBps(500);
        m.setRoyaltyReceivers(rs, sh);

        h = new EHandler(m, actors, ids);
        targetContract(address(h));
    }

    function invariant_solvent() public view {
        uint256 owed;
        for (uint256 i = 0; i < actors.length; i++) {
            owed += m.pendingWithdrawals(actors[i]);
            for (uint256 j = 0; j < ids.length; j++) {
                (bool hasBid, , uint256 value, ) = m.bids(actors[i], ids[j]);
                if (hasBid) owed += value;
            }
        }
        assertGe(address(m).balance, owed, "market owes more than it holds");
    }
}
