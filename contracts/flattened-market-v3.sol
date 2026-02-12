WARNING: You are currently using Node.js v22.11.0, which is not supported by Hardhat. This can lead to unexpected behavior. See https://hardhat.org/nodejs-versions


// Sources flattened with hardhat v2.22.5 https://hardhat.org

// SPDX-License-Identifier: MIT AND PHUNKY

// File @openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (proxy/utils/Initializable.sol)

pragma solidity ^0.8.20;

/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since proxied contracts do not make use of a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 *
 * The initialization functions use a version number. Once a version number is used, it is consumed and cannot be
 * reused. This mechanism prevents re-execution of each "step" but allows the creation of new initialization steps in
 * case an upgrade adds a module that needs to be initialized.
 *
 * For example:
 *
 * [.hljs-theme-light.nopadding]
 * ```solidity
 * contract MyToken is ERC20Upgradeable {
 *     function initialize() initializer public {
 *         __ERC20_init("MyToken", "MTK");
 *     }
 * }
 *
 * contract MyTokenV2 is MyToken, ERC20PermitUpgradeable {
 *     function initializeV2() reinitializer(2) public {
 *         __ERC20Permit_init("MyToken");
 *     }
 * }
 * ```
 *
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {ERC1967Proxy-constructor}.
 *
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 *
 * [CAUTION]
 * ====
 * Avoid leaving a contract uninitialized.
 *
 * An uninitialized contract can be taken over by an attacker. This applies to both a proxy and its implementation
 * contract, which may impact the proxy. To prevent the implementation contract from being used, you should invoke
 * the {_disableInitializers} function in the constructor to automatically lock it when it is deployed:
 *
 * [.hljs-theme-light.nopadding]
 * ```
 * /// @custom:oz-upgrades-unsafe-allow constructor
 * constructor() {
 *     _disableInitializers();
 * }
 * ```
 * ====
 */
abstract contract Initializable {
    /**
     * @dev Storage of the initializable contract.
     *
     * It's implemented on a custom ERC-7201 namespace to reduce the risk of storage collisions
     * when using with upgradeable contracts.
     *
     * @custom:storage-location erc7201:openzeppelin.storage.Initializable
     */
    struct InitializableStorage {
        /**
         * @dev Indicates that the contract has been initialized.
         */
        uint64 _initialized;
        /**
         * @dev Indicates that the contract is in the process of being initialized.
         */
        bool _initializing;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Initializable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    /**
     * @dev The contract is already initialized.
     */
    error InvalidInitialization();

    /**
     * @dev The contract is not initializing.
     */
    error NotInitializing();

    /**
     * @dev Triggered when the contract has been initialized or reinitialized.
     */
    event Initialized(uint64 version);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most once. In its scope,
     * `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Similar to `reinitializer(1)`, except that in the context of a constructor an `initializer` may be invoked any
     * number of times. This behavior in the constructor can be useful during testing and is not expected to be used in
     * production.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer() {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        // Cache values to avoid duplicated sloads
        bool isTopLevelCall = !$._initializing;
        uint64 initialized = $._initialized;

        // Allowed calls:
        // - initialSetup: the contract is not in the initializing state and no previous version was
        //                 initialized
        // - construction: the contract is initialized at version 1 (no reininitialization) and the
        //                 current contract is just being deployed
        bool initialSetup = initialized == 0 && isTopLevelCall;
        bool construction = initialized == 1 && address(this).code.length == 0;

        if (!initialSetup && !construction) {
            revert InvalidInitialization();
        }
        $._initialized = 1;
        if (isTopLevelCall) {
            $._initializing = true;
        }
        _;
        if (isTopLevelCall) {
            $._initializing = false;
            emit Initialized(1);
        }
    }

    /**
     * @dev A modifier that defines a protected reinitializer function that can be invoked at most once, and only if the
     * contract hasn't been initialized to a greater version before. In its scope, `onlyInitializing` functions can be
     * used to initialize parent contracts.
     *
     * A reinitializer may be used after the original initialization step. This is essential to configure modules that
     * are added through upgrades and that require initialization.
     *
     * When `version` is 1, this modifier is similar to `initializer`, except that functions marked with `reinitializer`
     * cannot be nested. If one is invoked in the context of another, execution will revert.
     *
     * Note that versions can jump in increments greater than 1; this implies that if multiple reinitializers coexist in
     * a contract, executing them in the right order is up to the developer or operator.
     *
     * WARNING: Setting the version to 2**64 - 1 will prevent any future reinitialization.
     *
     * Emits an {Initialized} event.
     */
    modifier reinitializer(uint64 version) {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        if ($._initializing || $._initialized >= version) {
            revert InvalidInitialization();
        }
        $._initialized = version;
        $._initializing = true;
        _;
        $._initializing = false;
        emit Initialized(version);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} and {reinitializer} modifiers, directly or indirectly.
     */
    modifier onlyInitializing() {
        _checkInitializing();
        _;
    }

    /**
     * @dev Reverts if the contract is not in an initializing state. See {onlyInitializing}.
     */
    function _checkInitializing() internal view virtual {
        if (!_isInitializing()) {
            revert NotInitializing();
        }
    }

    /**
     * @dev Locks the contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers() internal virtual {
        // solhint-disable-next-line var-name-mixedcase
        InitializableStorage storage $ = _getInitializableStorage();

        if ($._initializing) {
            revert InvalidInitialization();
        }
        if ($._initialized != type(uint64).max) {
            $._initialized = type(uint64).max;
            emit Initialized(type(uint64).max);
        }
    }

    /**
     * @dev Returns the highest version that has been initialized. See {reinitializer}.
     */
    function _getInitializedVersion() internal view returns (uint64) {
        return _getInitializableStorage()._initialized;
    }

    /**
     * @dev Returns `true` if the contract is currently initializing. See {onlyInitializing}.
     */
    function _isInitializing() internal view returns (bool) {
        return _getInitializableStorage()._initializing;
    }

    /**
     * @dev Returns a pointer to the storage namespace.
     */
    // solhint-disable-next-line var-name-mixedcase
    function _getInitializableStorage() private pure returns (InitializableStorage storage $) {
        assembly {
            $.slot := INITIALIZABLE_STORAGE
        }
    }
}


// File @openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract ContextUpgradeable is Initializable {
    function __Context_init() internal onlyInitializing {
    }

    function __Context_init_unchained() internal onlyInitializing {
    }
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Ownable
    struct OwnableStorage {
        address _owner;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant OwnableStorageLocation = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

    function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
        assembly {
            $.slot := OwnableStorageLocation
        }
    }

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    function __Ownable_init(address initialOwner) internal onlyInitializing {
        __Ownable_init_unchained(initialOwner);
    }

    function __Ownable_init_unchained(address initialOwner) internal onlyInitializing {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        OwnableStorage storage $ = _getOwnableStorage();
        return $._owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        OwnableStorage storage $ = _getOwnableStorage();
        address oldOwner = $._owner;
        $._owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/Pausable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
abstract contract PausableUpgradeable is Initializable, ContextUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Pausable
    struct PausableStorage {
        bool _paused;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Pausable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant PausableStorageLocation = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;

    function _getPausableStorage() private pure returns (PausableStorage storage $) {
        assembly {
            $.slot := PausableStorageLocation
        }
    }

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Unpaused(address account);

    /**
     * @dev The operation failed because the contract is paused.
     */
    error EnforcedPause();

    /**
     * @dev The operation failed because the contract is not paused.
     */
    error ExpectedPause();

    /**
     * @dev Initializes the contract in unpaused state.
     */
    function __Pausable_init() internal onlyInitializing {
        __Pausable_init_unchained();
    }

    function __Pausable_init_unchained() internal onlyInitializing {
        PausableStorage storage $ = _getPausableStorage();
        $._paused = false;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() {
        _requirePaused();
        _;
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual returns (bool) {
        PausableStorage storage $ = _getPausableStorage();
        return $._paused;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _pause() internal virtual whenNotPaused {
        PausableStorage storage $ = _getPausableStorage();
        $._paused = true;
        emit Paused(_msgSender());
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function _unpause() internal virtual whenPaused {
        PausableStorage storage $ = _getPausableStorage();
        $._paused = false;
        emit Unpaused(_msgSender());
    }
}


// File @openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol@v5.0.2

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuardUpgradeable is Initializable {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /// @custom:storage-location erc7201:openzeppelin.storage.ReentrancyGuard
    struct ReentrancyGuardStorage {
        uint256 _status;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ReentrancyGuardStorageLocation = 0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    function _getReentrancyGuardStorage() private pure returns (ReentrancyGuardStorage storage $) {
        assembly {
            $.slot := ReentrancyGuardStorageLocation
        }
    }

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    function __ReentrancyGuard_init() internal onlyInitializing {
        __ReentrancyGuard_init_unchained();
    }

    function __ReentrancyGuard_init_unchained() internal onlyInitializing {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        $._status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if ($._status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        $._status = ENTERED;
    }

    function _nonReentrantAfter() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        $._status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        return $._status == ENTERED;
    }
}


// File contracts/V2MainnetUpgrade/EthscriptionsEscrower.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.20;

library EthscriptionsEscrowerStorage {
    struct Layout {
        mapping(address => mapping(bytes32 => uint256)) ethscriptionReceivedOnBlockNumber;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256(
            "ethscriptions.contracts.storage.EthscriptionsEscrowerStorage"
        );

    function s() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract EthscriptionsEscrower {
    error EthscriptionNotDeposited();
    error EthscriptionAlreadyReceivedFromSender();
    error InvalidEthscriptionLength();
    error AdditionalCooldownRequired(uint256 additionalBlocksNeeded);

    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed id
    );

    event PotentialEthscriptionDeposited(
        address indexed owner,
        bytes32 indexed potentialEthscriptionId
    );

    event PotentialEthscriptionWithdrawn(
        address indexed owner,
        bytes32 indexed potentialEthscriptionId
    );

    uint256 public constant ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS = 5;

    function _transferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal virtual {
        _validateTransferEthscription(previousOwner, to, ethscriptionId);

        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            previousOwner,
            to,
            ethscriptionId
        );

        _afterTransferEthscription(previousOwner, to, ethscriptionId);
    }

    function withdrawEthscription(bytes32 ethscriptionId) internal virtual {
        _transferEthscription(msg.sender, msg.sender, ethscriptionId);

        // emit PotentialEthscriptionWithdrawn(msg.sender, ethscriptionId);
    }

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal virtual {
        if (userCalldata.length != 32) revert InvalidEthscriptionLength();

        bytes32 potentialEthscriptionId = abi.decode(userCalldata, (bytes32));

        if (
            userEthscriptionPossiblyStored(
                previousOwner,
                potentialEthscriptionId
            )
        ) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][potentialEthscriptionId] = block.number;

        // emit PotentialEthscriptionDeposited(previousOwner, potentialEthscriptionId);
    }

    function _validateTransferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal view virtual {
        if (
            userEthscriptionDefinitelyNotStored(previousOwner, ethscriptionId)
        ) {
            revert EthscriptionNotDeposited();
        }

        uint256 blocksRemaining = blocksRemainingUntilValidTransfer(
            previousOwner,
            ethscriptionId
        );

        if (blocksRemaining != 0) {
            revert AdditionalCooldownRequired(blocksRemaining);
        }
    }

    function _afterTransferEthscription(
        address previousOwner,
        address to,
        bytes32 ethscriptionId
    ) internal virtual {
        delete EthscriptionsEscrowerStorage
            .s()
            .ethscriptionReceivedOnBlockNumber[previousOwner][ethscriptionId];
    }

    function blocksRemainingUntilValidTransfer(
        address previousOwner,
        bytes32 ethscriptionId
    ) public view virtual returns (uint256) {
        uint256 receivedBlockNumber = EthscriptionsEscrowerStorage
            .s()
            .ethscriptionReceivedOnBlockNumber[previousOwner][ethscriptionId];

        if (receivedBlockNumber == 0) {
            revert EthscriptionNotDeposited();
        }

        uint256 blocksPassed = block.number - receivedBlockNumber;

        return
            blocksPassed < ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS
                ? ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS - blocksPassed
                : 0;
    }

    function userEthscriptionDefinitelyNotStored(
        address owner,
        bytes32 ethscriptionId
    ) public view virtual returns (bool) {
        return
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                owner
            ][ethscriptionId] == 0;
    }

    function userEthscriptionPossiblyStored(
        address owner,
        bytes32 ethscriptionId
    ) public view virtual returns (bool) {
        return !userEthscriptionDefinitelyNotStored(owner, ethscriptionId);
    }
}


// File contracts/V2MainnetUpgrade/interfaces/IPoints.sol

// Original license: SPDX_License_Identifier: PHUNKY
pragma solidity 0.8.20;

interface IPoints {
    function addPoints(address user, uint256 amount) external;
}


// File contracts/V2MainnetUpgrade/EtherPhunksMarketV3.sol

// Original license: SPDX_License_Identifier: PHUNKY

/** EtherPhunksMarketV3.sol *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░░░ *
* ░░░░░▒▒██░░░░░░▒▒██░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░████░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░██░░░░░░░░ *
* ░░░░░░░░░██████░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
* ░░░░░░░░░░░░░░░░░░░░░░░░░ *
****************************/

/* ========================================
   ∬  CHANGELOG V3:                       ∬
   ========================================
   ∬  + 3.67% royalties (adjustable bps)  ∬
   ∬  + Configurable royalty receiver      ∬
   ∬  + On-chain points (try/catch)        ∬
   ∬  + Fresh proxy (not upgrade from V2)  ∬
   ====================================== */

pragma solidity 0.8.20;
contract EtherPhunksMarketV3 is
    Initializable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EthscriptionsEscrower
{
    bytes32 constant DEPOSIT_AND_LIST_SIGNATURE = keccak256("DEPOSIT_AND_LIST_SIGNATURE");

    uint256 public contractVersion;
    address public pointsAddress;

    struct Offer {
        bool isForSale;
        bytes32 phunkId;
        address seller;
        uint minValue;
        address onlySellTo;
    }

    mapping(bytes32 => Offer) public phunksOfferedForSale;
    mapping(address => uint) public pendingWithdrawals;

    // V3: Royalties
    uint256 public royaltyBps;
    address payable public royaltyReceiver;

    event PhunkOffered(
        bytes32 indexed phunkId,
        uint minValue,
        address indexed toAddress
    );

    event PhunkBought(
        bytes32 indexed phunkId,
        uint value,
        address indexed fromAddress,
        address indexed toAddress
    );

    event PhunkNoLongerForSale(
        bytes32 indexed phunkId
    );

    event PointsAddressChanged(
        address indexed oldPointsAddress,
        address indexed newPointsAddress
    );

    event RoyaltyBpsChanged(uint256 oldBps, uint256 newBps);
    event RoyaltyReceiverChanged(address indexed oldReceiver, address indexed newReceiver);

    function initialize(
        uint256 _contractVersion,
        address _pointsAddress,
        uint256 _royaltyBps,
        address payable _royaltyReceiver
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_royaltyBps <= 1000, "Max 10%");
        require(_royaltyReceiver != address(0), "Invalid receiver");

        contractVersion = _contractVersion;
        pointsAddress = _pointsAddress;
        royaltyBps = _royaltyBps;
        royaltyReceiver = _royaltyReceiver;
    }

    // =========================================================
    // Listing
    // =========================================================

    function offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) external nonReentrant {
        _offerPhunkForSale(phunkId, minSalePriceInWei);
    }

    function batchOfferPhunkForSale(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external nonReentrant {
        require(phunkIds.length == minSalePricesInWei.length, "Lengths mismatch");
        for (uint i = 0; i < phunkIds.length; i++) {
            _offerPhunkForSale(phunkIds[i], minSalePricesInWei[i]);
        }
    }

    function offerPhunkForSaleToAddress(
        bytes32 phunkId,
        uint minSalePriceInWei,
        address toAddress
    ) public nonReentrant {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            toAddress
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, toAddress);
    }

    function _offerPhunkForSale(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        phunksOfferedForSale[phunkId] = Offer(
            true,
            phunkId,
            msg.sender,
            minSalePriceInWei,
            address(0x0)
        );

        emit PhunkOffered(phunkId, minSalePriceInWei, address(0x0));
    }

    function phunkNoLongerForSale(bytes32 phunkId) external {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        _invalidateListing(phunkId);
        emit PhunkNoLongerForSale(phunkId);
    }

    // =========================================================
    // Buying (with royalties)
    // =========================================================

    function _buyPhunk(
        bytes32 phunkId,
        uint minSalePriceInWei
    ) internal virtual {
        Offer memory offer = phunksOfferedForSale[phunkId];

        require(
            offer.isForSale &&
            (offer.onlySellTo == address(0x0) || offer.onlySellTo == msg.sender) &&
            minSalePriceInWei == offer.minValue &&
            offer.seller != msg.sender &&
            msg.value >= minSalePriceInWei,
            "Invalid sale conditions"
        );

        _invalidateListing(phunkId);

        address seller = offer.seller;

        // Calculate royalty
        uint royalty = (minSalePriceInWei * royaltyBps) / 10000;
        uint sellerAmount = minSalePriceInWei - royalty;

        pendingWithdrawals[seller] += sellerAmount;
        if (royalty > 0 && royaltyReceiver != address(0)) {
            pendingWithdrawals[royaltyReceiver] += royalty;
        }

        _addPoints(seller, 100);
        _transferEthscription(seller, msg.sender, phunkId);
        emit PhunkBought(phunkId, minSalePriceInWei, seller, msg.sender);
    }

    function batchBuyPhunk(
        bytes32[] calldata phunkIds,
        uint[] calldata minSalePricesInWei
    ) external payable whenNotPaused nonReentrant {
        require(phunkIds.length == minSalePricesInWei.length, "Lengths mismatch");

        uint totalSalePrice = 0;
        for (uint i = 0; i < phunkIds.length; i++) {
            _buyPhunk(phunkIds[i], minSalePricesInWei[i]);
            totalSalePrice += minSalePricesInWei[i];
        }

        require(msg.value == totalSalePrice, "Incorrect Ether amount");
    }

    // =========================================================
    // Withdrawals
    // =========================================================

    function withdraw() public nonReentrant {
        require(pendingWithdrawals[msg.sender] != 0, "No pending withdrawals");

        uint amount = pendingWithdrawals[msg.sender];
        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");
    }

    function withdrawPhunk(bytes32 phunkId) public {
        if (userEthscriptionDefinitelyNotStored(msg.sender, phunkId)) {
            revert EthscriptionNotDeposited();
        }

        super.withdrawEthscription(phunkId);

        Offer memory offer = phunksOfferedForSale[phunkId];
        if (offer.isForSale) {
            _invalidateListing(phunkId);
            emit PhunkNoLongerForSale(phunkId);
        }
    }

    function withdrawBatchPhunks(bytes32[] calldata phunkIds) external {
        for (uint i = 0; i < phunkIds.length; i++) {
            withdrawPhunk(phunkIds[i]);
        }
    }

    // =========================================================
    // Deposits (fallback)
    // =========================================================

    function _onPotentialEthscriptionDeposit(
        address previousOwner,
        bytes calldata userCalldata
    ) internal override {
        require(userCalldata.length % 32 == 0, "Invalid ethscription length");

        for (uint256 i = 0; i < userCalldata.length / 32; i++) {
            bytes32 potentialEthscriptionId = abi.decode(slice(userCalldata, i * 32, 32), (bytes32));

            if (userEthscriptionPossiblyStored(previousOwner, potentialEthscriptionId)) {
                revert EthscriptionAlreadyReceivedFromSender();
            }

            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                previousOwner
            ][potentialEthscriptionId] = block.number;
        }
    }

    function _onPotentialSingleEthscriptionDeposit(
        address previousOwner,
        bytes32 phunkId
    ) internal {
        if (userEthscriptionPossiblyStored(previousOwner, phunkId)) {
            revert EthscriptionAlreadyReceivedFromSender();
        }

        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            previousOwner
        ][phunkId] = block.number;
    }

    fallback() external {
        require(!paused(), "Contract is paused");

        bytes32 signature;
        assembly {
            signature := calldataload(32)
        }

        if (signature == DEPOSIT_AND_LIST_SIGNATURE) {
            require(msg.data.length % 32 == 0, "InvalidEthscriptionLength");

            bytes32 phunkId;
            bytes32 listingPrice;
            bytes32 toAddress;

            assembly {
                phunkId := calldataload(0)
                listingPrice := calldataload(64)
                toAddress := calldataload(96)
            }

            if (toAddress != 0x0) {
                address addrToAddress = address(uint160(uint256(toAddress)));
                _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
                offerPhunkForSaleToAddress(phunkId, uint256(listingPrice), addrToAddress);
                return;
            }

            _onPotentialSingleEthscriptionDeposit(msg.sender, phunkId);
            _offerPhunkForSale(phunkId, uint256(listingPrice));
            return;
        }

        _onPotentialEthscriptionDeposit(msg.sender, msg.data);
    }

    receive() external payable {
        require(!paused(), "Contract is paused");
    }

    // =========================================================
    // Internal helpers
    // =========================================================

    function _invalidateListing(bytes32 phunkId) internal {
        delete phunksOfferedForSale[phunkId];
    }

    function _addPoints(address owner, uint256 amount) internal {
        if (pointsAddress != address(0)) {
            try IPoints(pointsAddress).addPoints(owner, amount) {} catch {}
        }
    }

    function slice(
        bytes memory data,
        uint256 start,
        uint256 len
    ) internal pure returns (bytes memory) {
        bytes memory b = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            b[i] = data[i + start];
        }
        return b;
    }

    // =========================================================
    // Owner functions
    // =========================================================

    function setPointsAddress(address _pointsAddress) public onlyOwner {
        address oldPointsAddress = pointsAddress;
        pointsAddress = _pointsAddress;
        emit PointsAddressChanged(oldPointsAddress, _pointsAddress);
    }

    function setRoyaltyBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        uint256 oldBps = royaltyBps;
        royaltyBps = _bps;
        emit RoyaltyBpsChanged(oldBps, _bps);
    }

    function setRoyaltyReceiver(address payable _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid receiver");
        address oldReceiver = royaltyReceiver;
        royaltyReceiver = _receiver;
        emit RoyaltyReceiverChanged(oldReceiver, _receiver);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
