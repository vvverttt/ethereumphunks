// Sources flattened with hardhat v2.28.6 https://hardhat.org

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


// File contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV2.sol

// Original license: SPDX_License_Identifier: PHUNKY

/****** AuctionHouseV2 *
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
   ∬  EtherPhunks Auction House V2        ∬
   ========================================
   ∬  Nouns-style continuous auction       ∬
   ∬  Owner loads pool, random auctions    ∬
   ∬  Hybrid push/pull refunds             ∬
   ∬  Per-item reserve prices              ∬
   ∬  67 points on win                     ∬
   ∬  + withdrawETH protection (audit)     ∬
   ∬  + redirectPendingReturns (audit)     ∬
   ∬  + RefundEscrowed event (audit)       ∬
   ====================================== */

pragma solidity 0.8.20;
contract EtherPhunksAuctionHouseV2 is Initializable, EthscriptionsEscrower, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    // ─── Auction struct ──────────────────────────────────────

    struct Auction {
        bytes32 hashId;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        address payable bidder;
        bool settled;
        uint256 auctionId;
    }

    // ─── State ───────────────────────────────────────────────

    // Auction config
    uint256 public duration;
    uint256 public timeBuffer;
    uint8 public minBidIncrementPercentage;
    uint256 public reservePrice;
    uint256 public auctionId;

    // Points + Treasury
    address public pointsAddress;
    address payable public treasuryAddress;

    // Pool (LotteryV68 pattern)
    bytes32[] private _pool;
    mapping(bytes32 => uint256) private _poolIndex;
    mapping(bytes32 => bool) public inPool;
    mapping(bytes32 => address) public depositor;

    // Per-item reserve prices (0 = use global reservePrice)
    mapping(bytes32 => uint256) public itemReservePrice;

    // Hybrid refunds: try auto-send, fallback to pull
    mapping(address => uint256) public pendingReturns;

    // Randomness (LotteryV68 pattern)
    bytes32 private _lastRandomHash;

    // Current auction
    Auction public auction;

    // Committed ETH protection (audit fix — consumes 1 __gap slot)
    uint256 public totalCommittedETH;

    // ─── Events ──────────────────────────────────────────────

    event AuctionCreated(bytes32 indexed hashId, uint256 auctionId, uint256 startTime, uint256 endTime);
    event AuctionBid(bytes32 indexed hashId, uint256 auctionId, address sender, uint256 value);
    event AuctionExtended(bytes32 indexed hashId, uint256 auctionId, uint256 endTime);
    event AuctionSettled(bytes32 indexed hashId, uint256 auctionId, address winner, uint256 amount);
    event PoolDeposited(bytes32 indexed hashId);
    event PoolWithdrawn(bytes32 indexed hashId);
    event RefundEscrowed(address indexed recipient, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        uint256 _duration,
        uint256 _timeBuffer,
        uint8 _minBidIncrementPercentage,
        uint256 _reservePrice,
        address _pointsAddress,
        address payable _treasuryAddress
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(_treasuryAddress != address(0), "Invalid treasury");
        duration = _duration;
        timeBuffer = _timeBuffer;
        minBidIncrementPercentage = _minBidIncrementPercentage;
        reservePrice = _reservePrice;
        pointsAddress = _pointsAddress;
        treasuryAddress = _treasuryAddress;
    }

    // ─── Fallback: Owner deposits ethscriptions into pool ────

    fallback() external {
        require(msg.sender == owner(), "Only owner can deposit");
        require(msg.data.length > 0 && msg.data.length % 32 == 0, "Invalid length");

        for (uint256 i = 0; i < msg.data.length / 32; i++) {
            bytes32 hashId;
            assembly {
                hashId := calldataload(mul(i, 32))
            }

            require(hashId != bytes32(0), "Invalid hashId");
            require(!inPool[hashId], "Already in pool");

            // Record in escrow storage (set to 1 so cooldown is always satisfied)
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                msg.sender
            ][hashId] = 1;

            // Add to pool
            _poolIndex[hashId] = _pool.length;
            _pool.push(hashId);
            inPool[hashId] = true;
            depositor[hashId] = msg.sender;

            emit PoolDeposited(hashId);
        }
    }

    // ─── Settle + Create (anyone, when not paused) ───────────

    function settleAndCreate() external nonReentrant whenNotPaused {
        if (auction.startTime != 0 && !auction.settled) {
            _settleAuction();
        }
        if (_pool.length > 0) {
            _createAuction();
        }
    }

    // ─── Standalone settle (always works, even when paused) ──

    function settleAuction() external nonReentrant {
        _settleAuction();
    }

    // ─── Create bid ──────────────────────────────────────────

    function createBid() external payable nonReentrant {
        require(block.timestamp < auction.endTime, "Auction expired");
        require(!auction.settled, "Auction settled");
        require(msg.sender == tx.origin, "No contracts");

        // First bid must meet reserve; subsequent must beat last + increment
        if (auction.bidder == address(0)) {
            uint256 reserve = itemReservePrice[auction.hashId] > 0
                ? itemReservePrice[auction.hashId]
                : reservePrice;
            require(msg.value >= reserve, "Below reserve price");
        } else {
            require(
                msg.value >= auction.amount + (auction.amount * minBidIncrementPercentage / 100),
                "Bid too low"
            );
        }

        // Save previous bidder info
        address payable prevBidder = auction.bidder;
        uint256 prevAmount = auction.amount;

        // Update state FIRST (CEI pattern)
        totalCommittedETH = totalCommittedETH - prevAmount + msg.value;
        auction.amount = msg.value;
        auction.bidder = payable(msg.sender);

        // Anti-snipe: extend if within timeBuffer of end
        if (auction.endTime - block.timestamp < timeBuffer) {
            auction.endTime = block.timestamp + timeBuffer;
            emit AuctionExtended(auction.hashId, auction.auctionId, auction.endTime);
        }

        // Hybrid refund: try auto-send, fallback to pendingReturns
        if (prevBidder != address(0)) {
            (bool sent, ) = prevBidder.call{value: prevAmount}("");
            if (!sent) {
                pendingReturns[prevBidder] += prevAmount;
                emit RefundEscrowed(prevBidder, prevAmount);
            }
        }

        emit AuctionBid(auction.hashId, auction.auctionId, msg.sender, msg.value);
    }

    // ─── Withdraw pending returns ────────────────────────────

    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingReturns[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
    }

    // ─── Internal: Settle auction ────────────────────────────

    function _settleAuction() internal {
        require(auction.startTime != 0, "No auction");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.settled, "Already settled");

        auction.settled = true;
        totalCommittedETH -= auction.amount;

        if (auction.bidder != address(0)) {
            // Winner exists — transfer ethscription to winner
            _transferEthscription(depositor[auction.hashId], auction.bidder, auction.hashId);
            delete depositor[auction.hashId];

            // Award 67 points to winner
            if (pointsAddress != address(0)) {
                try IPoints(pointsAddress).addPoints(auction.bidder, 67) {} catch {}
            }

            // Send ETH to treasury (hybrid: try push, fallback to pull)
            (bool sent, ) = treasuryAddress.call{value: auction.amount}("");
            if (!sent) {
                pendingReturns[treasuryAddress] += auction.amount;
                emit RefundEscrowed(treasuryAddress, auction.amount);
            }
        } else {
            // No bids — return to pool
            _poolIndex[auction.hashId] = _pool.length;
            _pool.push(auction.hashId);
            inPool[auction.hashId] = true;
            // depositor and escrow are still intact from original deposit
        }

        emit AuctionSettled(auction.hashId, auction.auctionId, auction.bidder, auction.amount);
    }

    // ─── Internal: Create auction ────────────────────────────

    function _createAuction() internal {
        require(_pool.length > 0, "Pool empty");

        bytes32 hashId;
        uint256 idx;

        if (_orderQueue.length > 0) {
            // Use next item from ordered queue (pop from end = last item owner added)
            hashId = _orderQueue[_orderQueue.length - 1];
            _orderQueue.pop();
            // Verify it's still in the pool (owner may have withdrawn it since setAuctionOrder)
            require(inPool[hashId], "Ordered item not in pool");
            idx = _poolIndex[hashId];
        } else {
            // Random selection (LotteryV68 chained hash pattern)
            bytes32 randomHash = keccak256(abi.encodePacked(
                _lastRandomHash,
                block.prevrandao,
                block.timestamp,
                block.basefee,
                blockhash(block.number - 1),
                auctionId,
                msg.sender,
                gasleft()
            ));
            _lastRandomHash = randomHash;
            idx = uint256(randomHash) % _pool.length;
            hashId = _pool[idx];
        }

        // Swap-and-pop removal
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        delete _poolIndex[hashId];
        inPool[hashId] = false;

        // Create auction
        auctionId++;

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + duration;

        auction = Auction({
            hashId: hashId,
            amount: 0,
            startTime: startTime,
            endTime: endTime,
            bidder: payable(address(0)),
            settled: false,
            auctionId: auctionId
        });

        emit AuctionCreated(hashId, auctionId, startTime, endTime);
    }

    // ─── View functions ──────────────────────────────────────

    function poolSize() external view returns (uint256) {
        return _pool.length;
    }

    function getPoolItems(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        uint256 end = offset + limit;
        if (end > _pool.length) end = _pool.length;
        if (offset >= _pool.length) return new bytes32[](0);

        bytes32[] memory items = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            items[i - offset] = _pool[i];
        }
        return items;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Owner functions ─────────────────────────────────────

    function setDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 60, "Min 60 seconds");
        duration = _duration;
    }

    function setAuctionEndTime(uint256 _endTime) external onlyOwner {
        require(auction.startTime != 0 && !auction.settled, "No active auction");
        require(_endTime > block.timestamp, "End time must be future");
        auction.endTime = _endTime;
    }

    function setTimeBuffer(uint256 _timeBuffer) external onlyOwner {
        timeBuffer = _timeBuffer;
    }

    function setMinBidIncrementPercentage(uint8 _minBidIncrementPercentage) external onlyOwner {
        require(_minBidIncrementPercentage >= 1, "Min 1%");
        minBidIncrementPercentage = _minBidIncrementPercentage;
    }

    function setReservePrice(uint256 _reservePrice) external onlyOwner {
        reservePrice = _reservePrice;
    }

    function setItemReservePrices(bytes32[] calldata hashIds, uint256[] calldata prices) external onlyOwner {
        require(hashIds.length == prices.length, "Length mismatch");
        for (uint256 i = 0; i < hashIds.length; i++) {
            itemReservePrice[hashIds[i]] = prices[i];
        }
    }

    function setPointsAddress(address _pointsAddress) external onlyOwner {
        pointsAddress = _pointsAddress;
    }

    function setTreasuryAddress(address payable _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "Invalid treasury");
        treasuryAddress = _treasuryAddress;
    }

    function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance - totalCommittedETH, "Exceeds available balance");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    function withdrawFromPool(bytes32 hashId) external onlyOwner nonReentrant {
        require(inPool[hashId], "Not in pool");

        // O(1) swap-and-pop
        uint256 idx = _poolIndex[hashId];
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();

        inPool[hashId] = false;
        delete _poolIndex[hashId];
        delete depositor[hashId];

        // Transfer back to owner
        _transferEthscription(owner(), owner(), hashId);

        emit PoolWithdrawn(hashId);
    }

    function withdrawFromPoolBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            require(inPool[hashId], "Not in pool");

            uint256 idx = _poolIndex[hashId];
            bytes32 lastHash = _pool[_pool.length - 1];
            _pool[idx] = lastHash;
            _poolIndex[lastHash] = idx;
            _pool.pop();

            inPool[hashId] = false;
            delete _poolIndex[hashId];
            delete depositor[hashId];

            _transferEthscription(owner(), owner(), hashId);

            emit PoolWithdrawn(hashId);
        }
    }

    function emergencyWithdrawEthscriptionBatch(bytes32[] calldata hashIds) external onlyOwner nonReentrant {
        for (uint256 i = 0; i < hashIds.length; i++) {
            bytes32 hashId = hashIds[i];
            // Skip active auction logic in batch (can't easily refund inside loop)
            if (inPool[hashId]) {
                uint256 idx = _poolIndex[hashId];
                bytes32 lastHash = _pool[_pool.length - 1];
                _pool[idx] = lastHash;
                _poolIndex[lastHash] = idx;
                _pool.pop();
                inPool[hashId] = false;
                delete _poolIndex[hashId];
                delete depositor[hashId];
            }
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
                owner()
            ][hashId] = 1;
            _transferEthscription(owner(), owner(), hashId);
        }
    }

    function emergencyWithdrawEthscription(bytes32 hashId) external onlyOwner nonReentrant {
        // If this is the active auction item, refund the current bidder and mark settled
        if (auction.hashId == hashId && auction.startTime != 0 && !auction.settled) {
            auction.settled = true;
            totalCommittedETH -= auction.amount;

            if (auction.bidder != address(0)) {
                (bool sent, ) = auction.bidder.call{value: auction.amount}("");
                if (!sent) {
                    pendingReturns[auction.bidder] += auction.amount;
                    emit RefundEscrowed(auction.bidder, auction.amount);
                }
            }

            emit AuctionSettled(auction.hashId, auction.auctionId, address(0), 0);
        }

        // Clean pool state if item is in the pool
        if (inPool[hashId]) {
            uint256 idx = _poolIndex[hashId];
            bytes32 lastHash = _pool[_pool.length - 1];
            _pool[idx] = lastHash;
            _poolIndex[lastHash] = idx;
            _pool.pop();
            inPool[hashId] = false;
            delete _poolIndex[hashId];
            delete depositor[hashId];
        }

        // Re-register in escrow so transfer validation passes
        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            owner()
        ][hashId] = 1;
        _transferEthscription(owner(), owner(), hashId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function redirectPendingReturns(address from, address payable to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 amount = pendingReturns[from];
        require(amount > 0, "Nothing to redirect");
        pendingReturns[from] = 0;
        pendingReturns[to] += amount;
    }

    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership");
    }

    // ─── Ordered queue (owner sets priority auction order) ───

    bytes32[] private _orderQueue;

    event AuctionOrderSet(bytes32[] hashIds);

    // Owner sets an ordered list of hashIds to auction next (last item auctioned first).
    // All hashIds must already be in the pool.
    function setAuctionOrder(bytes32[] calldata hashIds) external onlyOwner {
        for (uint256 i = 0; i < hashIds.length; i++) {
            require(inPool[hashIds[i]], "Item not in pool");
        }
        delete _orderQueue;
        for (uint256 i = 0; i < hashIds.length; i++) {
            _orderQueue.push(hashIds[i]);
        }
        emit AuctionOrderSet(hashIds);
    }

    function auctionOrderSize() external view returns (uint256) {
        return _orderQueue.length;
    }

    function getAuctionOrderItems() external view returns (bytes32[] memory) {
        return _orderQueue;
    }

    // ─── Swap: users swap their v67 for one in the pool ─────

    bool public swapEnabled;
    bytes32 public swapMerkleRoot;
    uint256 public swapFee;
    uint256 public totalSwapped;

    event Swapped(bytes32 indexed sentHashId, bytes32 indexed receivedHashId, address indexed swapper, uint256 swapNumber);

    function swap(bytes32 sendHashId, bytes32 receiveHashId, bytes32[] calldata proof) external payable nonReentrant whenNotPaused {
        require(swapEnabled, "Swaps disabled");
        require(_pool.length > 0, "Pool empty");
        require(msg.value >= swapFee, "Insufficient fee");
        require(swapMerkleRoot != bytes32(0), "Merkle root not set");
        require(_verifySwapMerkle(proof, swapMerkleRoot, sendHashId), "Not a valid CryptoPhunksV67");
        require(inPool[receiveHashId], "Not in pool");
        require(receiveHashId != auction.hashId || auction.settled, "Cannot swap active auction item");
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][sendHashId] > 0,
            "Ethscription not deposited"
        );

        // Send fee to treasury
        if (msg.value > 0 && treasuryAddress != address(0)) {
            (bool sent, ) = treasuryAddress.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        totalSwapped++;
        address dep = depositor[receiveHashId];

        // Remove received item from pool (swap-and-pop)
        uint256 idx = _poolIndex[receiveHashId];
        bytes32 lastHash = _pool[_pool.length - 1];
        _pool[idx] = lastHash;
        _poolIndex[lastHash] = idx;
        _pool.pop();
        inPool[receiveHashId] = false;
        delete _poolIndex[receiveHashId];
        delete depositor[receiveHashId];

        // Add sent item to pool
        EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            owner()
        ][sendHashId] = 1;
        delete EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[
            msg.sender
        ][sendHashId];
        _poolIndex[sendHashId] = _pool.length;
        _pool.push(sendHashId);
        inPool[sendHashId] = true;
        depositor[sendHashId] = owner();

        // Send picked item to user
        _transferEthscription(dep, msg.sender, receiveHashId);

        emit Swapped(sendHashId, receiveHashId, msg.sender, totalSwapped);
    }

    function cancelSwapDeposit(bytes32 hashId) external nonReentrant {
        require(
            EthscriptionsEscrowerStorage.s().ethscriptionReceivedOnBlockNumber[msg.sender][hashId] > 0,
            "Not deposited"
        );
        require(!inPool[hashId], "In pool");
        _transferEthscription(msg.sender, msg.sender, hashId);
    }

    function setSwapEnabled(bool _enabled) external onlyOwner {
        swapEnabled = _enabled;
    }

    function setSwapMerkleRoot(bytes32 _root) external onlyOwner {
        swapMerkleRoot = _root;
    }

    function setSwapFee(uint256 _fee) external onlyOwner {
        swapFee = _fee;
    }

    function _verifySwapMerkle(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 hash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            if (hash < proof[i]) {
                hash = keccak256(abi.encodePacked(hash, proof[i]));
            } else {
                hash = keccak256(abi.encodePacked(proof[i], hash));
            }
        }
        return hash == root;
    }

    // ─── Storage gap for future upgrades (49 - 4 swap slots - 1 orderQueue = 44) ──

    uint256[44] private __gap;
}
