// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @dev Multi-purpose mock for security testing.
///      1. Reentrancy attacker: attempts to call withdraw() again in receive()
///      2. ETH rejecter: when rejectMode=true, reverts all incoming ETH (for push-fail tests)
contract MockReentrancyAttacker {
    address public target;
    bool public rejectMode;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    function setTarget(address _target) external {
        target = _target;
    }

    /// @dev When true, incoming ETH is rejected (simulates a contract that can't receive ETH).
    ///      When false, incoming ETH is accepted and a reentrancy attempt is made.
    function setRejectMode(bool _reject) external {
        rejectMode = _reject;
    }

    function resetAttackState() external {
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    /// @dev Calls withdraw() on target to initiate attack. Propagates reverts.
    function attack() external {
        (bool ok, bytes memory ret) = target.call(abi.encodeWithSignature("withdraw()"));
        if (!ok) {
            if (ret.length > 0) {
                assembly { revert(add(ret, 32), mload(ret)) }
            } else {
                revert("MockReentrancyAttacker: attack failed");
            }
        }
    }

    /// @dev Forwards raw bytes as calldata to target (phunk deposits, function calls, etc.).
    function callTarget(bytes calldata data) external payable {
        (bool ok, bytes memory ret) = target.call{value: msg.value}(data);
        if (!ok) {
            if (ret.length > 0) {
                assembly { revert(add(ret, 32), mload(ret)) }
            } else {
                revert("MockReentrancyAttacker: callTarget failed");
            }
        }
    }

    receive() external payable {
        if (rejectMode) revert("MockReentrancyAttacker: ETH rejected");
        if (!reentryAttempted) {
            reentryAttempted = true;
            // Attempt reentrancy — silently swallow so the outer call doesn't revert
            (bool ok,) = target.call(abi.encodeWithSignature("withdraw()"));
            if (ok) reentrySucceeded = true;
        }
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
