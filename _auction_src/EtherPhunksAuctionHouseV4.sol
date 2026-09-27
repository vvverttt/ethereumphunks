// SPDX-License-Identifier: PHUNKY

/* ========================================
   ∬  EtherPhunks Auction House V4          ∬
   ========================================
   ∬  V3 + a SECOND independent buy-now tier ∬
   ∬  ("buyNow2"): its own whitelist root,    ∬
   ∬  price and switch, so two holder groups   ∬
   ∬  can take the live item at two prices     ∬
   ∬  (e.g. Missing/Dysto @ 0.267 via buyNow,  ∬
   ∬  EthsRocks @ 0.167 via buyNow2).          ∬
   ∬  Identical no-bid-window invariant as V3. ∬
   ==================================== ==== */

pragma solidity ^0.8.20;

import "./EtherPhunksAuctionHouseV3.sol";
import "./interfaces/IPoints.sol";

contract EtherPhunksAuctionHouseV4 is EtherPhunksAuctionHouseV3 {

    // ─── Buy-now tier 2 state (V4) ───────────────────────────
    // Appended strictly AFTER V3's entire layout (incl. its uint256[47] __gapV3).
    // Cannot touch any existing V2/V3 storage — validated append-only.

    bytes32 public buyNow2MerkleRoot;  // merkle root of the tier-2 (EthsRocks) holder snapshot
    uint256 public buyNow2Price;       // tier-2 fixed take price, e.g. 0.167 ether
    bool public buyNow2Enabled;        // tier-2 master switch

    event BuyNow2Configured(bytes32 merkleRoot, uint256 price, bool enabled);

    /// @notice Tier-2 twin of {buyNow}: take the live auction item at `buyNow2Price` if msg.sender is
    ///         in the tier-2 whitelist. Same no-bid-window invariant — only before any bid exists, so
    ///         there is nothing to refund and the ethscription-escrow path stays clean.
    /// @param proof merkle proof that msg.sender is in the tier-2 snapshot
    function buyNow2(bytes32[] calldata proof)
        external
        payable
        nonReentrant
        whenNotPaused
        notBlacklisted
    {
        require(buyNow2Enabled, "Buy-now disabled");
        require(auction.startTime != 0 && !auction.settled, "No active auction");
        require(block.timestamp < auction.endTime, "Auction expired");
        require(auction.bidder == address(0), "Auction already has a bid");
        require(msg.value >= buyNow2Price, "Below buy-now price");
        require(_verifyWhitelist2(proof, buyNow2MerkleRoot, msg.sender), "Not whitelisted");

        bytes32 hashId = auction.hashId;
        uint256 aId = auction.auctionId;
        address dep = depositor[hashId];

        // ── Effects (CEI) ──
        auction.settled = true;
        delete depositor[hashId];

        // ── Interactions ──
        _transferEthscription(dep, msg.sender, hashId);

        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(msg.sender, 67) {} catch {}
        }

        (bool sent, ) = treasuryAddress.call{value: msg.value}("");
        if (!sent) {
            pendingReturns[treasuryAddress] += msg.value;
            emit RefundEscrowed(treasuryAddress, msg.value);
        }

        emit BuyNow(hashId, aId, msg.sender, msg.value);
        emit AuctionSettled(hashId, aId, msg.sender, msg.value);
    }

    // ─── Owner config ────────────────────────────────────────

    function setBuyNow2(bytes32 merkleRoot, uint256 price, bool enabled) external onlyOwner {
        if (enabled) {
            require(price > 0, "Price must be > 0");
            require(merkleRoot != bytes32(0), "Root must be set");
        }
        buyNow2MerkleRoot = merkleRoot;
        buyNow2Price = price;
        buyNow2Enabled = enabled;
        emit BuyNow2Configured(merkleRoot, price, enabled);
    }

    // V3's _verifyWhitelist is private, so re-implement identically for tier 2.
    function _verifyWhitelist2(bytes32[] calldata proof, bytes32 root, address account)
        private
        pure
        returns (bool)
    {
        if (root == bytes32(0)) return false;
        bytes32 hash = keccak256(abi.encodePacked(account));
        for (uint256 i = 0; i < proof.length; i++) {
            hash = hash < proof[i]
                ? keccak256(abi.encodePacked(hash, proof[i]))
                : keccak256(abi.encodePacked(proof[i], hash));
        }
        return hash == root;
    }

    // ─── Storage gap for future V4 upgrades ──────────────────
    uint256[47] private __gapV4;
}
