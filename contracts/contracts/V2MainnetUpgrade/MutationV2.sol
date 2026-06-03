// SPDX-License-Identifier: PHUNKY

/* ========================================
   ∬  MutationV2: batch withdraw          ∬
   ========================================
   ∬  Adds withdrawEthscriptionBatch so   ∬
   ∬  the owner can pull many ethscriptions∬
   ∬  out in a single tx (e.g. retiring    ∬
   ∬  the contract). Exact loop of the     ∬
   ∬  existing single withdrawEthscription.∬
   ∬  No new storage; onlyOwner.           ∬
   ====================================== */

pragma solidity 0.8.20;

import "./EtherPhunksEvolve.sol";

contract MutationV2 is Mutation {

    /// @notice Owner-only batch version of withdrawEthscription. Emits the ESIP transfer
    ///         event for each hashId to `to` and clears its depositor record — identical
    ///         to the single-item path, just looped. The ethscriptions protocol only
    ///         honors transfers of ids the contract actually owns, so passing an id it
    ///         doesn't hold is a harmless no-op on-chain.
    /// @param hashIds The ethscription ids to withdraw.
    /// @param to      Recipient of all of them (e.g. the owner wallet).
    function withdrawEthscriptionBatch(bytes32[] calldata hashIds, address to) external onlyOwner {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            address prevOwner = depositor[hashId] != address(0) ? depositor[hashId] : to;
            emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(prevOwner, to, hashId);
            delete depositor[hashId];
        }
    }
}
