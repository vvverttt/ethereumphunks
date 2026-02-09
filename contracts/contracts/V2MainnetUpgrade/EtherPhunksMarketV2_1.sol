// SPDX-License-Identifier: PHUNKY

pragma solidity 0.8.20;

import "./EtherPhunksMarketV2.sol";

contract EtherPhunksMarketV2_1 is EtherPhunksMarketV2 {

    /**
     * @dev Withdrawals state patch flag.
     */
    bool public _withdrawsPatched;

    event WithdrawalsPatched(uint256 count);

    /**
     * @dev The address that receives rev share from sales.
     */
    address payable public revShareAddress;

    /**
     * @dev Rev share percentage out of 100000 (e.g. 6700 = 6.7%).
     */
    uint public revSharePercentage;

    /**
     * @dev Initializes the new version of the contract.
     * @param _newVersion The new version number.
     * @param _revShareAddress The address to receive rev share.
     * @param _revSharePercentage The rev share percentage (out of 100000).
     */
    function initializeV2_1(
        uint256 _newVersion,
        address payable _revShareAddress,
        uint _revSharePercentage
    ) public reinitializer(3) {
        contractVersion = _newVersion;
        _withdrawsPatched = false;
        revShareAddress = _revShareAddress;
        revSharePercentage = _revSharePercentage;
    }

    /**
     * @dev Override _buyPhunk to add rev share and buyer points.
     * @param phunkId The hashId of the item to buy.
     * @param minSalePriceInWei The minimum sale price in Wei.
     */
    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal override {
        Offer memory offer = phunksOfferedForSale[phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender &&
            msg.value >= minSalePriceInWei,
            "Invalid sale conditions"
        );

        uint revShareAmount = 0;
        if (revShareAddress != address(0) && revSharePercentage > 0) {
            revShareAmount = minSalePriceInWei * revSharePercentage / 100000;
        }
        uint sellerAmount = minSalePriceInWei - revShareAmount;

        _invalidateListing(phunkId);

        address seller = offer.seller;

        pendingWithdrawals[seller] += sellerAmount;

        if (revShareAmount > 0) {
            (bool sent,) = revShareAddress.call{value: revShareAmount}("");
            require(sent, "Revshare transfer failed");
        }

        _addPoints(msg.sender, 67);
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(
            phunkId,
            minSalePriceInWei,
            seller,
            msg.sender
        );
    }

    /**
     * @dev Sets the address for rev share.
     * @param _newRevShare The new address for rev share.
     */
    function setRevShareAddress(address payable _newRevShare) public onlyOwner {
        require(_newRevShare != address(0), "Invalid address");
        revShareAddress = _newRevShare;
    }

    /**
     * @dev Sets the rev share percentage.
     * @param _percentage The new percentage (out of 100000).
     */
    function setRevSharePercentage(uint _percentage) public onlyOwner {
        require(_percentage <= 100000, "Cannot exceed 100%");
        revSharePercentage = _percentage;
    }

    /**
     * @dev Patch withdrawals state.
     * @param addresses The array of addresses for which withdrawals need to be patched.
     * @param amounts The array of withdrawal amounts corresponding to the addresses.
     */
    function patchWithdrawals(address[] calldata addresses, uint256[] calldata amounts) external onlyOwner {
        require(!_withdrawsPatched, "Contract has already been seeded");
        require(addresses.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < addresses.length; i++) {
            pendingWithdrawals[addresses[i]] = amounts[i];
        }

        _withdrawsPatched = true;
        emit WithdrawalsPatched(addresses.length);
    }
}
