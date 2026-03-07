// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @dev Contract that rejects all incoming ETH — used to test hybrid push/pull refunds.
contract MockRejectETH {
    // No receive() or fallback() — all ETH transfers via call{value: ...} will fail.
}
