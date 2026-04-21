// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
//  ERC721PhunksV1 — Full On-Chain Upgradeable NFT
//
//  Bridge flow (two-way):
//    1. Send tx to this contract with msg.data = hashId (32 bytes)
//       -> ethscription locked in contract, 5-block cooldown
//    2. bridgeIn(to, tokenId, hashId, sha) -> ERC-721 minted
//    3. unbridge(tokenId) -> ERC-721 burned, ethscription returned
//
//  Also supports merkle-proof mint for initial snapshot distribution.
//
//  Marketplace (CryptoPunks-exact):
//    offerForSale / offerForSaleToAddress / cancelOffer / buyToken
//    enterBid / withdrawBid / acceptBid
//    pendingWithdrawals / withdraw
//
//  Extras: UUPS upgradeable, ERC-2981 6.7% royalty (0% own market),
//          on-chain SVG + background, traits, ethscription provenance,
//          operator whitelist, ERC721-C transfer validation.
// ============================================================

// ──────────────────────────────────────────────────────────────
//  ERC721-C interfaces (inlined — no external dependency)
// ──────────────────────────────────────────────────────────────

/// @dev Limit Break TransferValidator v3 mainnet: 0x721C0078c2328597Ca70F5451ffF5A7B38D4E947
interface ITransferValidator721 {
    function validateTransfer(address caller, address from, address to, uint256 tokenId) external;
    function isOperatorAllowed(address tokenAddress, address operator) external view returns (bool);
}

/// @dev ICreatorToken — ERC721-C interface (interface ID: 0xad0d7f6c)
interface ICreatorToken {
    event TransferValidatorUpdated(address oldValidator, address newValidator);
    function getTransferValidator() external view returns (address);
    function getTransferValidationFunction() external view returns (bytes4, bool);
    function setTransferValidator(address validator) external;
}

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ERC721PhunksV67 is
    ICreatorToken,
    ERC721Upgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using Strings for uint256;

    // ========================================================
    // Custom errors
    // ========================================================

    error NotOwner();
    error NotSeller();
    error NotDepositor();
    error AlreadyDeposited();
    error AlreadyMinted();
    error CooldownActive();
    error NotDeposited();
    error InvalidProof();
    error MerkleRootNotSet();
    error NoHashId();
    error NotForSale();
    error NotForYou();
    error InsufficientETH();
    error SellerNoLongerOwns();
    error ZeroBid();
    error OwnerCannotBid();
    error MustBeatExistingBid();
    error NoBidFromCaller();
    error NoBid();
    error BelowMinPrice();
    error NothingToWithdraw();
    error TransferFailed();
    error CannotDrainUserFunds();
    error OperatorNotWhitelisted();
    error InvalidSize();
    error LengthMismatch();
    error TraitLengthMismatch();
    // [AUDIT FIX 1] wrong tokenId chosen during deposit bridge
    error TokenIdMismatch();
    // [AUDIT FIX 2] price/bid value exceeds uint96 storage
    error ValueExceedsMax();
    error MaxSupplyExceeded();
    error TransferValidatorNotAllowed();
    error NotOurToken();
    error ERC721NotEscrowed();

    // ========================================================
    // Constants
    // ========================================================

    uint256 public constant BRIDGE_COOLDOWN_BLOCKS = 5;

    // ========================================================
    // Storage — metadata
    // ========================================================

    mapping(uint256 => string)   private _tokenImage;
    mapping(uint256 => string)   private _tokenBackground;
    string  public defaultBackground;
    string  public description;
    string  public singleName;   // singular token name, e.g. "QuantumPhunk"
    uint16  public canvasSize;
    mapping(uint256 => string[]) private _traitKeys;
    mapping(uint256 => string[]) private _traitValues;
    mapping(uint256 => bytes32)  public tokenHashId;
    mapping(uint256 => bytes32)  public tokenSha;
    mapping(uint256 => string)   public tokenLabel;

    // ========================================================
    // Storage — bridge
    // ========================================================

    bytes32 public merkleRoot;
    mapping(bytes32 => bool)    public minted;
    mapping(address => mapping(bytes32 => uint256)) public depositBlockNumber;
    mapping(bytes32 => address) public ethscriptionDepositor;

    // [AUDIT FIX 1] owner pre-approves the exact tokenId each hashId may claim.
    // If set (non-zero), bridgeIn MUST use this tokenId — prevents a depositor
    // from occupying an arbitrary slot and griefing the correct holder.
    mapping(bytes32 => uint256) public authorizedTokenId;

    // ========================================================
    // Storage — operator whitelist
    // ========================================================

    mapping(address => bool) public approvedOperators;
    bool public operatorWhitelistEnabled;

    // ========================================================
    // Storage — marketplace structs
    // ========================================================

    struct Offer {
        bool    isForSale;
        address seller;
        uint96  minPrice;
        address onlySellTo; // address(0) = public
    }

    // 1 storage slot: address(20) + uint96(12). bidder==address(0) means no bid.
    struct Bid {
        address bidder;
        uint96  value;
    }

    // ========================================================
    // Storage — marketplace state
    // ========================================================

    mapping(uint256 => Offer) public offersForSale;
    mapping(uint256 => Bid)   public tokenBids;
    mapping(address => uint256) public pendingWithdrawals;
    uint256 public totalPending;
    uint256 private _totalSupply;
    uint256 public  maxSupply;

    // ========================================================
    // Storage — ERC721-C (appended safely for UUPS upgrade)
    // ========================================================

    address public transferValidator;

    // ========================================================
    // Storage — toggle mechanism (appended for UUPS upgrade)
    // ========================================================

    // Reverse lookup: ethscription hashId → ERC721 tokenId
    mapping(bytes32 => uint256) public hashToTokenId;
    // Tracks who escrowed their ERC721 (so they can toggle back to ERC721 mode)
    mapping(uint256 => address) public erc721Depositor;

    // ========================================================
    // Events — ethscriptions protocol
    // ========================================================

    // Exact name required by ethscriptions protocol indexer
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed id
    );

    // ========================================================
    // Events — bridge
    // ========================================================

    event EthscriptionDeposited(address indexed from,  bytes32 indexed hashId);
    event BridgedIn(address indexed to, uint256 indexed tokenId, bytes32 indexed hashId);
    event Unbridged(address indexed by, uint256 indexed tokenId, bytes32 indexed hashId);
    event MerkleRootUpdated(bytes32 root);

    // ========================================================
    // Events — metadata
    // ========================================================

    event TokenImageSet(uint256 indexed tokenId);
    event TokenBackgroundSet(uint256 indexed tokenId, string hexColor);
    event DefaultBackgroundSet(string hexColor);
    event CanvasSizeSet(uint16 size);
    event TraitsSet(uint256 indexed tokenId);
    event HashIdSet(uint256 indexed tokenId, bytes32 hashId);
    event ShaSet(uint256 indexed tokenId, bytes32 sha);
    event LabelSet(uint256 indexed tokenId, string label);

    // ========================================================
    // Events — operator whitelist
    // ========================================================

    event OperatorWhitelistUpdated(address indexed operator, bool approved);
    event OperatorWhitelistToggled(bool enabled);
    event ToggledToEthscription(address indexed holder, uint256 indexed tokenId, bytes32 indexed hashId);
    event ToggledToERC721(address indexed holder, uint256 indexed tokenId, bytes32 indexed hashId);

    // ========================================================
    // Events — marketplace
    // ========================================================

    event OfferCreated(uint256 indexed tokenId, uint256 minPrice, address onlySellTo);
    event OfferCancelled(uint256 indexed tokenId);
    event Sale(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 value);
    event BidEntered(uint256 indexed tokenId, address indexed bidder, uint256 value);
    event BidWithdrawn(uint256 indexed tokenId, address indexed bidder, uint256 value);
    event BidAccepted(uint256 indexed tokenId, address indexed seller, address indexed bidder, uint256 value);

    // ========================================================
    // Initializer
    // ========================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        string memory name_,
        string memory symbol_,
        address treasury_,
        bytes32 merkleRoot_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __ERC2981_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        _setDefaultRoyalty(treasury_, 670);
        merkleRoot               = merkleRoot_;
        operatorWhitelistEnabled = true;
        canvasSize               = 24;
        defaultBackground        = "638596";
        maxSupply                = 10386;
        singleName               = "QuantumPhunk";
    }

    // ========================================================
    // UUPS / ERC-165
    // ========================================================

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function supportsInterface(bytes4 id)
        public view override(ERC721Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return id == type(ICreatorToken).interfaceId || super.supportsInterface(id);
    }

    // ========================================================
    // ERC721-C — ICreatorToken implementation
    // ========================================================

    function getTransferValidator() external view returns (address) {
        return transferValidator;
    }

    /// @dev Returns the validateTransfer(address,address,address,uint256) selector
    ///      and whether it is a view function (false — it reverts on failure).
    function getTransferValidationFunction() external pure returns (bytes4 functionSignature, bool isViewFunction) {
        functionSignature = ITransferValidator721.validateTransfer.selector;
        isViewFunction    = false;
    }

    /// @notice Set or clear the Limit Break TransferValidator.
    ///         Use address(0) to disable on-chain royalty enforcement.
    ///         Mainnet v3 validator: 0x721C0078c2328597Ca70F5451ffF5A7B38D4E947
    function setTransferValidator(address validator) external onlyOwner {
        emit TransferValidatorUpdated(transferValidator, validator);
        transferValidator = validator;
    }

    // ========================================================
    // Fallback — step 1 of deposit bridge
    // ========================================================

    /**
     * @notice Send a tx to this address with msg.data = ethscription hashId (32 bytes).
     *         The ethscriptions protocol treats this as transferring the ethscription
     *         to this contract — it is now locked here.
     *         After BRIDGE_COOLDOWN_BLOCKS blocks, call bridgeIn() to mint your ERC-721.
     */
    fallback() external payable {
        if (msg.data.length == 32) {
            bytes32 hashId = abi.decode(msg.data, (bytes32));
            if (ethscriptionDepositor[hashId] != address(0)) revert AlreadyDeposited();
            depositBlockNumber[msg.sender][hashId] = block.number;
            ethscriptionDepositor[hashId]          = msg.sender;
            emit EthscriptionDeposited(msg.sender, hashId);
            // Note: if minted[hashId]==true, this is a toggle-back deposit.
            // Caller must follow up with toggleToERC721() after the cooldown.
        }
    }

    receive() external payable {}

    // ========================================================
    // Bridge in — deposit path
    // ========================================================

    function bridgeIn(
        address to,
        uint256 tokenId,
        bytes32 hashId,
        bytes32 sha
    ) external nonReentrant {
        if (ethscriptionDepositor[hashId] != msg.sender)              revert NotDepositor();
        if (minted[hashId])                                            revert AlreadyMinted();
        uint256 dep = depositBlockNumber[msg.sender][hashId];
        if (dep == 0)                                                  revert NotDeposited();
        if (block.number - dep < BRIDGE_COOLDOWN_BLOCKS)              revert CooldownActive();
        // [AUDIT FIX 1] enforce owner-approved tokenId when set
        uint256 auth = authorizedTokenId[hashId];
        if (auth != 0 && tokenId != auth)                             revert TokenIdMismatch();

        if (_totalSupply >= maxSupply)                                 revert MaxSupplyExceeded();
        minted[hashId]         = true;
        tokenHashId[tokenId]   = hashId;
        tokenSha[tokenId]      = sha;
        hashToTokenId[hashId]  = tokenId;
        _safeMint(to, tokenId);
        emit BridgedIn(to, tokenId, hashId);
    }

    // ========================================================
    // Bridge in — merkle path (initial snapshot launch)
    // ========================================================

    /**
     * @notice Mint via merkle proof (snapshot launch).
     *         Contract does NOT hold the ethscription on this path.
     *         unbridge() on a merkle-minted token burns the ERC-721 only.
     *
     *         The caller submits ALL token data — image, label, traits.
     *         The merkle leaf commits to every field so nothing can be faked.
     *         Caller pays 100% of on-chain storage gas. Owner pays nothing.
     *
     * Leaf = keccak256(bytes.concat(keccak256(abi.encode(
     *            to, tokenId, hashId, sha, imageUri, label, traitKeys, traitValues
     *        ))))
     */
    /**
     * @notice Claim ERC721 via merkle proof.
     *         Caller must first deposit their ethscription (proves current ownership).
     *         Leaf: keccak256(keccak256(abi.encode(tokenId, hashId, sha, imageUri, label, traitKeys, traitValues)))
     *         — no owner field, so the proof is transferable with the ethscription.
     */
    function mint(
        uint256           tokenId,
        bytes32           hashId,
        bytes32           sha,
        string  calldata  imageUri,
        string  calldata  label,
        string[] calldata traitKeys,
        string[] calldata traitValues,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (minted[hashId])                                  revert AlreadyMinted();
        if (merkleRoot == bytes32(0))                        revert MerkleRootNotSet();
        if (traitKeys.length != traitValues.length)          revert TraitLengthMismatch();
        // Must have deposited the ethscription — proves current ownership
        if (ethscriptionDepositor[hashId] != msg.sender)     revert NotDepositor();
        uint256 dep = depositBlockNumber[msg.sender][hashId];
        if (dep == 0)                                        revert NotDeposited();
        if (block.number - dep < BRIDGE_COOLDOWN_BLOCKS)     revert CooldownActive();
        // Leaf excludes owner — valid for whoever currently holds the ethscription
        bytes32 leaf = keccak256(bytes.concat(keccak256(
            abi.encode(tokenId, hashId, sha, imageUri, label, traitKeys, traitValues)
        )));
        if (!MerkleProof.verify(proof, merkleRoot, leaf))    revert InvalidProof();
        if (_totalSupply >= maxSupply)                       revert MaxSupplyExceeded();
        minted[hashId]        = true;
        tokenHashId[tokenId]  = hashId;
        tokenSha[tokenId]     = sha;
        hashToTokenId[hashId] = tokenId;
        _tokenImage[tokenId]  = imageUri;
        tokenLabel[tokenId]   = label;
        _traitKeys[tokenId]   = traitKeys;
        _traitValues[tokenId] = traitValues;
        _safeMint(msg.sender, tokenId);
        emit BridgedIn(msg.sender, tokenId, hashId);
    }

    function setMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root; emit MerkleRootUpdated(root);
    }

    // [AUDIT FIX 1] pre-approve the exact tokenId each hashId may claim via bridgeIn
    function setAuthorizedTokenId(bytes32 hashId, uint256 tokenId) external onlyOwner {
        authorizedTokenId[hashId] = tokenId;
    }
    function batchSetAuthorizedTokenId(
        bytes32[] calldata hashIds,
        uint256[] calldata tokenIds
    ) external onlyOwner {
        if (hashIds.length != tokenIds.length) revert LengthMismatch();
        for (uint256 i; i < hashIds.length; ++i) {
            authorizedTokenId[hashIds[i]] = tokenIds[i];
        }
    }

    function ownerMint(address to, uint256 tokenId) external onlyOwner {
        if (_totalSupply >= maxSupply) revert MaxSupplyExceeded();
        _safeMint(to, tokenId); emit BridgedIn(to, tokenId, bytes32(0));
    }

    /// @notice Extend (never shrink) the max supply — owner only.
    function setMaxSupply(uint256 newMax) external onlyOwner {
        if (newMax < maxSupply) revert ValueExceedsMax(); // can only increase
        maxSupply = newMax;
    }

    // ========================================================
    // Toggle — ERC721 → Ethscription
    // ========================================================

    /**
     * @notice Send your ERC721 to this contract (via safeTransferFrom) to
     *         switch to ethscription mode. The contract escrows your ERC721
     *         and releases the locked ethscription back to you.
     *         Call toggleToERC721() after re-depositing the ethscription to
     *         switch back. No burns ever happen after initial creation.
     */
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external returns (bytes4) {
        if (msg.sender != address(this)) revert NotOurToken();
        bytes32 hashId = tokenHashId[tokenId];
        if (hashId == bytes32(0)) revert NoHashId();
        address dep = ethscriptionDepositor[hashId];
        // Clear any stale ethscription deposit state
        if (dep != address(0)) {
            delete ethscriptionDepositor[hashId];
            delete depositBlockNumber[dep][hashId];
        }
        erc721Depositor[tokenId] = from;
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address(this), from, hashId);
        emit ToggledToEthscription(from, tokenId, hashId);
        return 0x150b7a02;
    }

    // ========================================================
    // Toggle — Ethscription → ERC721
    // ========================================================

    /**
     * @notice After depositing your ethscription (fallback with 32-byte hashId)
     *         and waiting BRIDGE_COOLDOWN_BLOCKS, call this to reclaim your
     *         escrowed ERC721. You must be the same address that locked the ERC721.
     */
    function toggleToERC721(bytes32 hashId) external nonReentrant {
        uint256 tokenId = hashToTokenId[hashId];
        if (erc721Depositor[tokenId] != msg.sender) revert ERC721NotEscrowed();
        if (ethscriptionDepositor[hashId] != msg.sender) revert NotDepositor();
        uint256 dep = depositBlockNumber[msg.sender][hashId];
        if (dep == 0) revert NotDeposited();
        if (block.number - dep < BRIDGE_COOLDOWN_BLOCKS) revert CooldownActive();
        delete erc721Depositor[tokenId];
        delete ethscriptionDepositor[hashId];
        delete depositBlockNumber[msg.sender][hashId];
        _transfer(address(this), msg.sender, tokenId);
        emit ToggledToERC721(msg.sender, tokenId, hashId);
    }

    /**
     * @notice Cancel a deposit before minting — returns ethscription to yourself.
     */
    function cancelDeposit(bytes32 hashId) external nonReentrant {
        if (ethscriptionDepositor[hashId] != msg.sender) revert NotDepositor();
        if (minted[hashId])                              revert AlreadyMinted();
        uint256 dep = depositBlockNumber[msg.sender][hashId];
        if (dep == 0)                                           revert NotDeposited();
        if (block.number - dep < BRIDGE_COOLDOWN_BLOCKS)       revert CooldownActive();
        delete ethscriptionDepositor[hashId];
        delete depositBlockNumber[msg.sender][hashId];
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            msg.sender, msg.sender, hashId
        );
    }

    function bridgeCooldownRemaining(address depositor, bytes32 hashId)
        external view returns (uint256)
    {
        uint256 d = depositBlockNumber[depositor][hashId];
        if (d == 0) return type(uint256).max;
        uint256 elapsed = block.number - d;
        return elapsed >= BRIDGE_COOLDOWN_BLOCKS ? 0 : BRIDGE_COOLDOWN_BLOCKS - elapsed;
    }

    // ========================================================
    // Operator whitelist
    // ========================================================

    function setApprovalForAll(address operator, bool approved) public override {
        if (approved) {
            if (operatorWhitelistEnabled && !approvedOperators[operator])
                revert OperatorNotWhitelisted();
            address _validator = transferValidator;
            if (_validator != address(0) && !ITransferValidator721(_validator).isOperatorAllowed(address(this), operator))
                revert TransferValidatorNotAllowed();
        }
        super.setApprovalForAll(operator, approved);
    }

    function approve(address to, uint256 tokenId) public override {
        if (to != address(0)) {
            if (operatorWhitelistEnabled && !approvedOperators[to])
                revert OperatorNotWhitelisted();
            address _validator = transferValidator;
            if (_validator != address(0) && !ITransferValidator721(_validator).isOperatorAllowed(address(this), to))
                revert TransferValidatorNotAllowed();
        }
        super.approve(to, tokenId);
    }

    function setApprovedOperator(address operator, bool approved) external onlyOwner {
        approvedOperators[operator] = approved;
        emit OperatorWhitelistUpdated(operator, approved);
    }

    function setOperatorWhitelistEnabled(bool enabled) external onlyOwner {
        operatorWhitelistEnabled = enabled;
        emit OperatorWhitelistToggled(enabled);
    }

    // ========================================================
    // Metadata setters
    // ========================================================

    function setTokenImage(uint256 t, string calldata v) external onlyOwner {
        _tokenImage[t] = v; emit TokenImageSet(t);
    }
    function setTokenBackground(uint256 t, string calldata v) external onlyOwner {
        _tokenBackground[t] = v; emit TokenBackgroundSet(t, v);
    }
    function setDefaultBackground(string calldata v) external onlyOwner {
        defaultBackground = v; emit DefaultBackgroundSet(v);
    }
    function setDescription(string calldata v) external onlyOwner {
        description = v;
    }
    function setSingleName(string calldata v) external onlyOwner {
        singleName = v;
    }
    function setCanvasSize(uint16 v) external onlyOwner {
        if (v == 0) revert InvalidSize(); canvasSize = v; emit CanvasSizeSet(v);
    }
    function setTraits(uint256 t, string[] memory keys, string[] memory vals) external onlyOwner {
        if (keys.length != vals.length) revert LengthMismatch();
        _traitKeys[t] = keys; _traitValues[t] = vals; emit TraitsSet(t);
    }
    function setTokenHashId(uint256 t, bytes32 v) external onlyOwner {
        tokenHashId[t] = v; emit HashIdSet(t, v);
    }
    function setTokenSha(uint256 t, bytes32 v) external onlyOwner {
        tokenSha[t] = v; emit ShaSet(t, v);
    }
    function setTokenLabel(uint256 t, string calldata v) external onlyOwner {
        tokenLabel[t] = v; emit LabelSet(t, v);
    }
    function setRoyalty(address treasury, uint96 bps) external onlyOwner {
        _setDefaultRoyalty(treasury, bps);
    }


    // ========================================================
    // tokenURI — fully on-chain
    // ========================================================

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory base = bytes(singleName).length > 0 ? singleName : name();
        string memory label = bytes(tokenLabel[tokenId]).length > 0
            ? tokenLabel[tokenId]
            : string(abi.encodePacked(base, " ", tokenId.toString()));
        bytes memory json = abi.encodePacked(
            '{"name":"', label,
            '","description":"', bytes(description).length > 0 ? description : name(), '"',
            ',"image":"',       _buildImageUri(tokenId), '"',
            ',"ethscription_hashid":"0x', _bytes32ToHex(tokenHashId[tokenId]), '"',
            ',"ethscription_sha":"0x',    _bytes32ToHex(tokenSha[tokenId]),    '"',
            ',"attributes":',   _buildAttributes(tokenId), '}'
        );
        return string(abi.encodePacked("data:application/json;utf8,", json));
    }

    function _buildImageUri(uint256 tokenId) internal view returns (string memory) {
        string memory raw = _tokenImage[tokenId];
        if (bytes(raw).length == 0) return "";

        // Resolve background: per-token override first, then collection default.
        string memory bg = bytes(_tokenBackground[tokenId]).length > 0
            ? _tokenBackground[tokenId]
            : defaultBackground;

        // No background set — return the raw ethscription data URI as-is.
        // (data:image/png;base64,... from the original UTF-8 ethscription content)
        if (bytes(bg).length == 0) return raw;

        // Background set — wrap in SVG so the colour rect sits behind the PNG.
        // shape-rendering="crispEdges" keeps pixel art sharp at any display size.
        string memory cs = uint256(canvasSize).toString();
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ', cs, ' ', cs,
            '" shape-rendering="crispEdges"><rect width="', cs, '" height="', cs,
            '" fill="#', bg, '"/><image href="', raw,
            '" width="', cs, '" height="', cs, '"/></svg>'
        );
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(svg)));
    }

    function _buildAttributes(uint256 tokenId) internal view returns (string memory) {
        string[] storage keys = _traitKeys[tokenId];
        string[] storage vals = _traitValues[tokenId];
        uint256 len = keys.length;
        if (len == 0) return "[]";
        bytes memory out = "[";
        for (uint256 i; i < len; ++i) {
            if (i > 0) out = abi.encodePacked(out, ",");
            out = abi.encodePacked(out, '{"trait_type":"', keys[i], '","value":"', vals[i], '"}');
        }
        return string(abi.encodePacked(out, "]"));
    }

    function _bytes32ToHex(bytes32 b) internal pure returns (string memory r) {
        assembly {
            r := mload(0x40)
            mstore(0x40, add(r, 0x60))
            mstore(r, 64)
            let chars := 0x30313233343536373839616263646566
            let ptr := add(r, 0x20)
            for { let i := 0 } lt(i, 32) { i := add(i, 1) } {
                let v := byte(i, b)
                mstore8(add(ptr, mul(i, 2)),     byte(shr(4, v), chars))
                mstore8(add(ptr, add(mul(i, 2), 1)), byte(and(v, 0xf), chars))
            }
        }
    }

    // ========================================================
    // _update — clear marketplace state on any transfer / burn
    // ========================================================

    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        // ERC721-C: validate every real transfer (skip mints, burns, and contract-escrow releases)
        address preOwner = _ownerOf(tokenId);
        if (preOwner != address(0) && to != address(0) && preOwner != address(this)) {
            address _validator = transferValidator;
            if (_validator != address(0)) {
                ITransferValidator721(_validator).validateTransfer(auth, preOwner, to, tokenId);
            }
        }

        address from = super._update(to, tokenId, auth);
        // Track total supply
        if (from == address(0)) {
            unchecked { ++_totalSupply; }
        } else if (to == address(0)) {
            unchecked { --_totalSupply; }
        }
        // Clear marketplace state on any transfer or burn
        if (offersForSale[tokenId].isForSale) {
            delete offersForSale[tokenId];
            emit OfferCancelled(tokenId);
        }
        Bid storage bid = tokenBids[tokenId];
        if (bid.bidder != address(0)) {
            _creditPending(bid.bidder, bid.value);
            emit BidWithdrawn(tokenId, bid.bidder, bid.value);
            delete tokenBids[tokenId];
        }
        return from;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    // ========================================================
    // Marketplace — asks
    // ========================================================

    function offerForSale(uint256 tokenId, uint256 minPrice) external {
        if (ownerOf(tokenId) != msg.sender)  revert NotOwner();
        if (minPrice > type(uint96).max)      revert ValueExceedsMax(); // [AUDIT FIX 2]
        offersForSale[tokenId] = Offer(true, msg.sender, uint96(minPrice), address(0));
        emit OfferCreated(tokenId, minPrice, address(0));
    }

    function offerForSaleToAddress(uint256 tokenId, uint256 minPrice, address to) external {
        if (ownerOf(tokenId) != msg.sender)  revert NotOwner();
        if (minPrice > type(uint96).max)      revert ValueExceedsMax(); // [AUDIT FIX 2]
        offersForSale[tokenId] = Offer(true, msg.sender, uint96(minPrice), to);
        emit OfferCreated(tokenId, minPrice, to);
    }

    function cancelOffer(uint256 tokenId) external {
        if (offersForSale[tokenId].seller != msg.sender) revert NotSeller();
        delete offersForSale[tokenId];
        emit OfferCancelled(tokenId);
    }

    /// @notice Buy a token listed for sale. 0% fee.
    function buyToken(uint256 tokenId) external payable nonReentrant {
        Offer memory o = offersForSale[tokenId];
        if (!o.isForSale)                                              revert NotForSale();
        if (o.onlySellTo != address(0) && o.onlySellTo != msg.sender) revert NotForYou();
        if (msg.value < o.minPrice)                                    revert InsufficientETH();
        if (o.seller != ownerOf(tokenId))                              revert SellerNoLongerOwns();
        address seller = o.seller;
        delete offersForSale[tokenId];
        _creditPending(seller, msg.value);
        _transfer(seller, msg.sender, tokenId);
        emit Sale(tokenId, seller, msg.sender, msg.value);
    }

    // ========================================================
    // Marketplace — individual bids (CryptoPunks-exact)
    // ========================================================

    function enterBid(uint256 tokenId) external payable nonReentrant {
        if (msg.value == 0)                  revert ZeroBid();
        if (msg.value > type(uint96).max)    revert ValueExceedsMax(); // [AUDIT FIX 2]
        if (ownerOf(tokenId) == msg.sender)  revert OwnerCannotBid();
        Bid storage e = tokenBids[tokenId];
        if (e.bidder != address(0)) {
            if (msg.value <= e.value) revert MustBeatExistingBid();
            _creditPending(e.bidder, e.value);
        }
        tokenBids[tokenId] = Bid(msg.sender, uint96(msg.value));
        emit BidEntered(tokenId, msg.sender, msg.value);
    }

    function withdrawBid(uint256 tokenId) external nonReentrant {
        Bid storage b = tokenBids[tokenId];
        if (b.bidder != msg.sender) revert NoBidFromCaller();
        uint256 amount = b.value;
        delete tokenBids[tokenId];
        _creditPending(msg.sender, amount);
        emit BidWithdrawn(tokenId, msg.sender, amount);
    }

    function acceptBid(uint256 tokenId, uint256 minPrice) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        Bid storage b = tokenBids[tokenId];
        if (b.bidder == address(0)) revert NoBid();
        if (b.value < minPrice)     revert BelowMinPrice();
        address bidder = b.bidder; uint256 amount = b.value;
        delete tokenBids[tokenId];
        _creditPending(msg.sender, amount);
        _transfer(msg.sender, bidder, tokenId);
        emit BidAccepted(tokenId, msg.sender, bidder, amount);
    }

    // ========================================================
    // Pull payment
    // ========================================================

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        totalPending -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _creditPending(address r, uint256 a) internal {
        pendingWithdrawals[r] += a; totalPending += a;
    }

    // ========================================================
    // Admin
    // ========================================================

    function rescueETH(uint256 amount) external onlyOwner {
        if (amount > address(this).balance || address(this).balance - amount < totalPending)
            revert CannotDrainUserFunds();
        (bool ok, ) = payable(owner()).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
