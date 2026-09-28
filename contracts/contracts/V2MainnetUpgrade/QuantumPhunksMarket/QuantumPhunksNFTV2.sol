// SPDX-License-Identifier: PHUNKY

/* ==========================================
   ∬  CryptoPhunksV67 V2                    ∬
   ==========================================
   ∬  Makes the operator controls RETRO-      ∬
   ∬  ACTIVE. Before this, blocking an        ∬
   ∬  operator (or turning the whitelist on)  ∬
   ∬  only stopped NEW approvals — anything   ∬
   ∬  already approved kept full transfer     ∬
   ∬  power forever.                          ∬
   ∬                                          ∬
   ∬  Storage: UNCHANGED. Two view overrides  ∬
   ∬  only, so the upgrade is layout-safe.    ∬
   ========================================= */

pragma solidity ^0.8.20;

import "./QuantumPhunksNFTFlip.sol";

contract CryptoPhunksV67V2 is CryptoPhunksV67Flip {

    /// @notice Why this exists.
    ///
    /// V1 checked `blockedOperators` and the whitelist ONLY in `approve` / `setApprovalForAll`
    /// — i.e. at the moment an approval is granted. `_update` consulted just the ERC721-C
    /// transfer validator, so with the validator at address(0) (the live configuration) an
    /// operator that was approved BEFORE being blocked could still move tokens indefinitely.
    /// Blocking looked like a kill switch and was really only a "no new approvals" switch.
    ///
    /// OpenZeppelin's `_isAuthorized` resolves authority through exactly two virtual hooks:
    ///
    ///     owner == spender || isApprovedForAll(owner, spender) || _getApproved(tokenId) == spender
    ///
    /// Overriding both makes an existing approval evaluate to "not authorised" the instant the
    /// operator stops being allowed — covering blanket approvals and per-token approvals alike,
    /// without touching `_update` or adding storage.
    ///
    /// Deliberately NOT called here: the external `ITransferValidator721.isOperatorAllowed`
    /// check that `_checkOperator` also performs. These are `view` functions on the hot path of
    /// every transfer, balance check and marketplace read; an external call in them would make
    /// a third-party contract able to revert routine reads. `_update` already consults the
    /// validator on the transfer itself, which is the right place for it.

    function _allowedOperator(address op) internal view returns (bool) {
        if (op == address(0)) return false;
        if (blockedOperators[op]) return false;
        if (operatorWhitelistEnabled && !approvedOperators[op]) return false;
        return true;
    }

    /// @inheritdoc ERC721Upgradeable
    function isApprovedForAll(address owner_, address operator)
        public view override returns (bool)
    {
        if (!_allowedOperator(operator)) return false;
        return super.isApprovedForAll(owner_, operator);
    }

    /// @dev Per-token approvals go through `_getApproved`, not `isApprovedForAll`, so blocking
    ///      has to be applied here too or `approve(blockedOp, id)` granted earlier would survive.
    function _getApproved(uint256 tokenId)
        internal view override returns (address)
    {
        address a = super._getApproved(tokenId);
        return _allowedOperator(a) ? a : address(0);
    }

    /// @notice Whether `operator` may act on `owner`'s tokens right now, and if not, why.
    ///         Reading the reason off-chain beats inferring it from a reverted transfer.
    /// @return allowed  true if the operator both holds an approval and is currently permitted
    /// @return reason   "" when allowed; otherwise "blocked", "not-whitelisted", or "no-approval"
    function operatorStatus(address owner_, address operator)
        external view returns (bool allowed, string memory reason)
    {
        if (blockedOperators[operator])                                   return (false, "blocked");
        if (operatorWhitelistEnabled && !approvedOperators[operator])     return (false, "not-whitelisted");
        if (!super.isApprovedForAll(owner_, operator))                    return (false, "no-approval");
        return (true, "");
    }
}
