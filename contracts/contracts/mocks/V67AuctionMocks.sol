// SPDX-License-Identifier: GPL-3.0
// Test-only helpers for V67AuctionHouse. Never deployed.
pragma solidity 0.8.36;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// Minimal WETH9.
contract MockWETH9 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable { balanceOf[msg.sender] += msg.value; }

    function withdraw(uint256 wad) external {
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
    }

    function transfer(address to, uint256 wad) external returns (bool) {
        balanceOf[msg.sender] -= wad;
        balanceOf[to] += wad;
        return true;
    }

    function transferFrom(address from, address to, uint256 wad) external returns (bool) {
        if (from != msg.sender) allowance[from][msg.sender] -= wad;
        balanceOf[from] -= wad;
        balanceOf[to] += wad;
        return true;
    }

    function approve(address s, uint256 wad) external returns (bool) { allowance[msg.sender][s] = wad; return true; }
}

/// Plain ERC-721 with a batch mint, for fast pool simulations and as a "foreign" collection.
contract MockNFT721 is ERC721 {
    bool public frozen; // when true every transfer reverts (simulates a settle that cannot complete)
    constructor() ERC721("Mock", "MOCK") {}
    function mintBatch(address to, uint256 from, uint256 count) external {
        for (uint256 i; i < count; ++i) _mint(to, from + i);
    }
    function setFrozen(bool f) external { frozen = f; }
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        require(!frozen, "frozen");
        return super._update(to, tokenId, auth);
    }
}

/// Reverts on any ETH it is sent.
contract RejectETH {
    receive() external payable { revert("no eth"); }
}

/// Burns all gas it is given on receive.
contract GasBurner {
    uint256 public sink;
    receive() external payable { while (true) { sink++; } }
}

/// A contract bidder with no ERC721 receiver hook. Can be told to reject ETH refunds.
interface IAuctionBid {
    function createBid(address collection, uint256 tokenId) external payable;
    function nft() external view returns (address);
    function withdrawRefund() external;
}

contract BidderContract {
    bool public rejectEth;
    function setRejectEth(bool r) external { rejectEth = r; }
    function bid(address house, uint256 tokenId) external payable { IAuctionBid(house).createBid{value: msg.value}(IAuctionBid(house).nft(), tokenId); }
    function bidOn(address house, address collection, uint256 tokenId) external payable {
        IAuctionBid(house).createBid{value: msg.value}(collection, tokenId);
    }
    function withdraw(address house) external { IAuctionBid(house).withdrawRefund(); }
    receive() external payable { if (rejectEth) revert("no eth"); }
}

/// Forces ETH into a contract via selfdestruct (still moves ETH post-Cancun).
contract ForceSend {
    constructor(address payable to) payable { selfdestruct(to); }
}

/// Test-only: a "collection" whose transferFrom silently does nothing (the queue must catch it).
contract LyingNFT {
    function transferFrom(address, address, uint256) external {}
    function ownerOf(uint256) external pure returns (address) { return address(0xdead); }
}
