// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
  QuantumPhunks — the COLLECTION (NFT only).

                Phunk #483                                     Phunk #35

              @@@@@@@@::::::::                                 ==**      ==**
++++++++++++++++++++@@@@::::::++++@@                         ================**
....................@@@@::::::++++@@@@@@                     ================**
++++++++++++++++++++@@@@::::::++++++@@                       ================**
              @@@@@@@@::::::::++++++@@@@@@         ==      ++++++++++++++++++++**      ==
            **************************@@           ====================================**
              @@==@@====@@====@@@@@@@@@@@@@@         ================================**
              xxxxxxxxxxxxxxxxxx##@@@@@@                   @@--::::::::::::::**@@
              xx****xxxxxx****xx##@@####@@@@               %%%%%%%%%%%%%%%%%%@@@@    --
              xx..@@xxxxxx..@@xxxx##@@######               %%xx##%%%%%%####%%@@@@@@--
              xxxxxxxxxxxxxxxxxxxx##@@@@@@@@               %%..@@%%%%%%..@@%%%%@@--@@@@@@
              @@==================**--@@                   %%%%%%%%%%%%%%%%%%%%@@@@--@@
            @@======================**@@@@                 @@--::::::::::::::::**--@@%%@@
          @@@@==%%%%%%%%%%%%%%@@====**@@%%@@           @@@@--xxxxxxxxxxxxxxxx::::**@@%%@@
        @@xx@@====@@@@@@@@@@@@======**@@%%@@         @@xx@@xxxxxxxxxxxxxxxx@@xx::**@@%%@@
        @@xx@@======================**@@%%@@         @@xx@@xxxx@@@@@@@@@@@@xxxx::**@@%%@@
        @@xx##@@================**@@@@##%%@@         @@xx@@xxxxxxxxxxxxxxxxxxxx::**@@%%@@
          @@xx##@@==============**@@######%%@@       @@xx##@@xxxxxxxxxxxxxxxx**@@@@##%%@@
            @@xx##@@@@@@@@@@====::@@######%%@@         @@xx##@@--------::==::**@@######%%@@
              @@xxxxxx####@@==::**@@########%%@@         @@xx##@@@@@@@@@@::::--@@######%%@@
                @@@@@@xx##@@::==**@@########%%@@           @@xxxxxx####@@::--**@@########%%@@
                                                             @@@@@@xx##@@--::**@@########%%@@

  Created by DystoLabz, Vvverttt x ArkanaRuzain.

  - Pure fully-on-chain ERC-721C: image (SSTORE2) + traits + provenance, rendered in `tokenURI`.
  - No marketplace here — trading lives in the separate QuantumPhunksMarket contract.
  - UUPS upgradeable ONLY during setup; renounce ownership when the collection is final -> immutable forever.
*/

/// @dev Limit Break TransferValidator (ERC-721C).
interface ITransferValidator721 {
    function validateTransfer(address caller, address from, address to, uint256 tokenId) external;
    function isOperatorAllowed(address tokenAddress, address operator) external view returns (bool);
}
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
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @dev Minimal SSTORE2 — store bytes as a contract's runtime code, read via EXTCODECOPY.
library SSTORE2 {
    function write(bytes memory data) internal returns (address pointer) {
        bytes memory code = abi.encodePacked(hex"00", data);
        bytes memory creation = abi.encodePacked(hex"61", uint16(code.length), hex"80600a3d393df3", code);
        assembly { pointer := create(0, add(creation, 0x20), mload(creation)) }
        require(pointer != address(0), "SSTORE2_WRITE");
    }
    function read(address pointer) internal view returns (bytes memory data) {
        if (pointer == address(0)) return "";
        uint256 size = pointer.code.length;
        if (size <= 1) return "";
        size -= 1;
        assembly {
            data := mload(0x40)
            mstore(0x40, add(data, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(data, size)
            extcodecopy(pointer, add(data, 0x20), 1, size)
        }
    }
}

contract CryptoPhunksV67 is
    ICreatorToken,
    ERC721Upgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using Strings for uint256;

    // ===================== Errors =====================
    error MaxSupplyExceeded();
    error ValueExceedsMax();
    error LengthMismatch();
    error OperatorNotWhitelisted();
    error OperatorBlocked();
    error TransferValidatorNotAllowed();
    error NotLottery();

    // ===================== Storage: metadata =====================
    mapping(uint256 => address[]) private _imageChunks;   // SSTORE2 ptrs -> exact data URI bytes (chunked for >24KB)
    string  public description;
    string  public singleName;
    mapping(uint256 => string[]) private _traitKeys;
    mapping(uint256 => string[]) private _traitValues;
    mapping(uint256 => bytes32)  public tokenHashId;      // ethscription creation tx hash
    mapping(uint256 => bytes32)  public tokenSha;
    string  private _contractURIValue;                    // ERC-7572 collection metadata (data URI)
    mapping(uint256 => bool) public isAnimated;
    string  public backgroundColor;                       // 6-hex (no #)

    address public royaltyReceiver;     // ERC-2981 receiver (external markets + our market pay it)

    // ===================== ERC721-C / operator controls =====================
    mapping(address => bool) public approvedOperators;
    mapping(address => bool) public blockedOperators;
    bool public operatorWhitelistEnabled;
    address public transferValidator;

    // ===================== Supply / lottery =====================
    uint256 private _totalSupply;
    uint256 public  maxSupply;
    address public  lottery;            // QuantumPhunksLottery; only it may mintFromLottery/transferFromLottery
    bool private _bypassValidation;     // transient: skip ERC721-C validation on a lottery prize transfer

    event TokenImageSet(uint256 indexed tokenId);
    event TraitsSet(uint256 indexed tokenId);
    event HashIdSet(uint256 indexed tokenId, bytes32 hashId);
    event ShaSet(uint256 indexed tokenId, bytes32 sha);
    event Minted(address indexed to, uint256 indexed tokenId);
    event LotteryUpdated(address indexed lottery);
    event OperatorWhitelistUpdated(address indexed operator, bool approved);
    event OperatorBlockedUpdated(address indexed operator, bool blocked);
    event OperatorWhitelistToggled(bool enabled);
    event ContractURIUpdated();
    event RoyaltyReceiverSet(address indexed receiver);

    // ERC-4906 (metadata update extension) — tells marketplaces to refresh cached metadata.
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    uint96 public constant MAX_ROYALTY_BPS = 670; // 6.7%

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    // owner_ is explicit (NOT msg.sender): when deploying the proxy via a CREATE2 vanity factory, msg.sender
    // is the factory — so the intended owner must be passed in, set atomically in the same tx (no front-run).
    function initialize(string memory name_, string memory symbol_, address treasury_, address owner_) external initializer {
        if (treasury_ == address(0) || owner_ == address(0)) revert ValueExceedsMax();
        __ERC721_init(name_, symbol_);
        __ERC2981_init();
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        royaltyReceiver = treasury_;
        _setDefaultRoyalty(treasury_, 500);   // 5%
        maxSupply  = 10000;                    // fixed cap (no setter)
        singleName = "QuantumPhunk";
        backgroundColor = "638596";
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function supportsInterface(bytes4 id)
        public view override(ERC721Upgradeable, ERC2981Upgradeable) returns (bool)
    { return id == type(ICreatorToken).interfaceId || id == bytes4(0x49064906) /* ERC-4906 */
        || id == bytes4(0xe8a3d485) /* ERC-7572 contractURI */ || super.supportsInterface(id); }

    // ERC-721 collection name/symbol are owner-settable post-deploy (until renounced). Per-token titles
    // use `singleName` ("QuantumPhunk #123"), independent of the collection name here.
    function name() public view override returns (string memory) {
        return bytes(_nameOverride).length > 0 ? _nameOverride : super.name();
    }
    function symbol() public view override returns (string memory) {
        return bytes(_symbolOverride).length > 0 ? _symbolOverride : super.symbol();
    }
    function setNameAndSymbol(string calldata name_, string calldata symbol_) external onlyOwner {
        _nameOverride = name_; _symbolOverride = symbol_;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }

    // ===================== ERC721-C =====================
    function getTransferValidator() external view returns (address) { return transferValidator; }
    function getTransferValidationFunction() external pure returns (bytes4 functionSignature, bool isViewFunction) {
        functionSignature = ITransferValidator721.validateTransfer.selector; isViewFunction = false;
    }
    // zero is intentional: address(0) disables ERC721-C validation entirely.
    // slither-disable-next-line missing-zero-check
    function setTransferValidator(address validator) external onlyOwner {
        emit TransferValidatorUpdated(transferValidator, validator); transferValidator = validator;
    }
    function setApprovedOperator(address op, bool a) external onlyOwner { approvedOperators[op] = a; emit OperatorWhitelistUpdated(op, a); }
    function setBlockedOperator(address op, bool b) external onlyOwner { blockedOperators[op] = b; emit OperatorBlockedUpdated(op, b); }
    function setOperatorWhitelistEnabled(bool e) external onlyOwner { operatorWhitelistEnabled = e; emit OperatorWhitelistToggled(e); }
    function setApprovalForAll(address operator, bool approved) public override { if (approved) _checkOperator(operator); super.setApprovalForAll(operator, approved); }
    function approve(address to, uint256 tokenId) public override { if (to != address(0)) _checkOperator(to); super.approve(to, tokenId); }
    function _checkOperator(address op) internal view {
        if (blockedOperators[op]) revert OperatorBlocked();
        if (operatorWhitelistEnabled && !approvedOperators[op]) revert OperatorNotWhitelisted();
        address v = transferValidator;
        if (v != address(0) && !ITransferValidator721(v).isOperatorAllowed(address(this), op)) revert TransferValidatorNotAllowed();
    }

    // ===================== Mint / supply =====================
    function _doMint(address to, uint256 tokenId) private {
        if (_totalSupply >= maxSupply) revert MaxSupplyExceeded();
        _safeMint(to, tokenId); emit Minted(to, tokenId);
    }
    function ownerMint(address to, uint256 tokenId) external onlyOwner { _doMint(to, tokenId); }
    function ownerMintBatch(address to, uint256[] calldata ids) external onlyOwner {
        for (uint256 i; i < ids.length; ++i) _doMint(to, ids[i]);
    }
    // zero is intentional: address(0) unsets the lottery (disables lottery mint/transfer).
    // slither-disable-next-line missing-zero-check
    function setLottery(address lottery_) external onlyOwner { lottery = lottery_; emit LotteryUpdated(lottery_); }
    function mintFromLottery(address to, uint256 tokenId) external {
        if (msg.sender != lottery) revert NotLottery(); _doMint(to, tokenId);
    }
    function transferFromLottery(address to, uint256 tokenId) external {
        if (msg.sender != lottery) revert NotLottery();
        _bypassValidation = true; _safeTransfer(lottery, to, tokenId, ""); _bypassValidation = false;
    }
    function ownerOfRaw(uint256 tokenId) external view returns (address) { return _ownerOf(tokenId); }
    function isImageSet(uint256 tokenId) external view returns (bool) { return _imageChunks[tokenId].length > 0; }
    function configured(uint256 tokenId) external view returns (bool) { return tokenSha[tokenId] != bytes32(0); }
    function totalSupply() external view returns (uint256) { return _totalSupply; }

    /// @notice True if `tokenId` carries the exact trait (key,value) pair. Used by the market for trait bids.
    ///         Matches the token's real on-chain traits (handles duplicate trait_types, e.g. Female+Zombie).
    function hasTrait(uint256 tokenId, string calldata key, string calldata value) external view returns (bool) {
        string[] storage keys = _traitKeys[tokenId];
        string[] storage vals = _traitValues[tokenId];
        bytes32 k = keccak256(bytes(key));
        bytes32 v = keccak256(bytes(value));
        uint256 n = keys.length;
        for (uint256 i; i < n; ++i) {
            if (keccak256(bytes(keys[i])) == k && keccak256(bytes(vals[i])) == v) return true;
        }
        return false;
    }

    // ===================== Metadata setters (owner; locked once ownership is renounced) =====================
    function contractURI() external view returns (string memory) { return _contractURIValue; }
    function setContractURI(string calldata v) external onlyOwner { _contractURIValue = v; emit ContractURIUpdated(); }

    uint256 private constant IMG_CHUNK = 24000;
    function _storeImage(uint256 t, bytes calldata data) internal {
        delete _imageChunks[t];
        uint256 len = data.length;
        if (len == 0) { emit TokenImageSet(t); return; }
        for (uint256 off; off < len; off += IMG_CHUNK) {
            uint256 end = off + IMG_CHUNK < len ? off + IMG_CHUNK : len;
            _imageChunks[t].push(SSTORE2.write(data[off:end]));
        }
        emit TokenImageSet(t);
    }
    function setTokenImage(uint256 t, string calldata v) external onlyOwner { _storeImage(t, bytes(v)); emit MetadataUpdate(t); }
    function setTokenImageBatch(uint256[] calldata ts, string[] calldata vs) external onlyOwner {
        uint256 n = ts.length; if (n != vs.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) _storeImage(ts[i], bytes(vs[i]));
        emit BatchMetadataUpdate(0, type(uint256).max);
    }
    function clearTokenImage(uint256 t) external onlyOwner { delete _imageChunks[t]; emit TokenImageSet(t); emit MetadataUpdate(t); }
    function addTokenImageChunk(uint256 t, string calldata piece) external onlyOwner { _imageChunks[t].push(SSTORE2.write(bytes(piece))); emit TokenImageSet(t); emit MetadataUpdate(t); }
    function tokenImage(uint256 t) public view returns (string memory) {
        address[] storage ch = _imageChunks[t]; uint256 n = ch.length;
        if (n == 0) return ""; if (n == 1) return string(SSTORE2.read(ch[0]));
        bytes memory out = ""; for (uint256 i; i < n; ++i) out = bytes.concat(out, SSTORE2.read(ch[i]));
        return string(out);
    }
    function setDescription(string calldata v) external onlyOwner { description = v; emit BatchMetadataUpdate(0, type(uint256).max); }
    function setTraits(uint256 t, string[] calldata keys, string[] calldata vals) external onlyOwner {
        if (keys.length != vals.length) revert LengthMismatch(); _traitKeys[t] = keys; _traitValues[t] = vals; emit TraitsSet(t); emit MetadataUpdate(t);
    }
    function batchSetTraits(uint256[] calldata ids, string[][] calldata keys, string[][] calldata vals) external onlyOwner {
        uint256 n = ids.length; if (n != keys.length || n != vals.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            if (keys[i].length != vals[i].length) revert LengthMismatch();
            _traitKeys[ids[i]] = keys[i]; _traitValues[ids[i]] = vals[i]; emit TraitsSet(ids[i]);
        }
        emit BatchMetadataUpdate(0, type(uint256).max);
    }
    function setTokenHashId(uint256 t, bytes32 v) external onlyOwner { tokenHashId[t] = v; emit HashIdSet(t, v); emit MetadataUpdate(t); }
    function setTokenSha(uint256 t, bytes32 v) external onlyOwner { tokenSha[t] = v; emit ShaSet(t, v); emit MetadataUpdate(t); }
    function batchSetProvenance(uint256[] calldata ids, bytes32[] calldata hashIds, bytes32[] calldata shas) external onlyOwner {
        uint256 n = ids.length; if (n != hashIds.length || n != shas.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) { tokenHashId[ids[i]] = hashIds[i]; tokenSha[ids[i]] = shas[i]; emit HashIdSet(ids[i], hashIds[i]); emit ShaSet(ids[i], shas[i]); }
        emit BatchMetadataUpdate(0, type(uint256).max);
    }
    function setAnimated(uint256[] calldata ids, bool flag) external onlyOwner { for (uint256 i; i < ids.length; ++i) isAnimated[ids[i]] = flag; emit BatchMetadataUpdate(0, type(uint256).max); }
    function setBackgroundColor(string calldata hex6) external onlyOwner { backgroundColor = hex6; emit BatchMetadataUpdate(0, type(uint256).max); }
    function setRoyaltyRate(uint96 bps) external onlyOwner { if (bps > MAX_ROYALTY_BPS) revert ValueExceedsMax(); _setDefaultRoyalty(royaltyReceiver, bps); }
    function setRoyaltyReceiver(address r) external onlyOwner {
        if (r == address(0)) revert ValueExceedsMax();
        (, uint256 bps) = royaltyInfo(0, 10000); royaltyReceiver = r; _setDefaultRoyalty(r, uint96(bps)); emit RoyaltyReceiverSet(r);
    }

    // ===================== tokenURI (fully on-chain) =====================
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory base = bytes(singleName).length > 0 ? singleName : name();
        string memory label = string(abi.encodePacked(base, " #", tokenId.toString()));
        string memory img = tokenImage(tokenId);
        bool animated = isAnimated[tokenId];
        // ALWAYS wrap the `image` (thumbnail) in a crisp-rendering SVG so it displays SHARP and renders
        // consistently everywhere — a raw GIF data URI corrupts in OS grid previews before it settles.
        // Animated tokens ALSO get `animation_url` = the raw GIF so the detail view plays the animation.
        // Raw bytes are always available byte-identical via tokenImage() (provenance).
        string memory displayImg = _svgWrap(img);
        string memory anim = animated ? string(abi.encodePacked(',"animation_url":"', img, '"')) : "";
        string memory bg = bytes(backgroundColor).length > 0 ? string(abi.encodePacked(',"background_color":"', backgroundColor, '"')) : "";
        bytes memory json = abi.encodePacked(
            '{"name":"', label,
            '","description":"', bytes(description).length > 0 ? description : name(), '"',
            ',"image":"', displayImg, '"', anim, bg,
            // ethscription provenance is kept on-chain in tokenHashId/tokenSha (updatable, queryable),
            // but intentionally NOT surfaced in the metadata JSON — keeps the marketplace page clean.
            ',"attributes":', _buildAttributes(tokenId), '}'
        );
        return string(abi.encodePacked("data:application/json;charset=utf-8;base64,", Base64.encode(json)));
    }
    function _buildAttributes(uint256 tokenId) internal view returns (string memory) {
        string[] storage keys = _traitKeys[tokenId]; string[] storage vals = _traitValues[tokenId];
        uint256 len = keys.length; if (len == 0) return "[]";
        bytes memory out = "[";
        for (uint256 i; i < len; ++i) {
            if (i > 0) out = abi.encodePacked(out, ",");
            out = abi.encodePacked(out, '{"trait_type":"', keys[i], '","value":"', vals[i], '"}');
        }
        return string(abi.encodePacked(out, "]"));
    }
    /// @dev Wrap a stored image data URI in a crisp-rendering SVG (nearest-neighbor) so pixel art displays
    ///      SHARP on every viewer at any size. Works for any square image (24x24, 48x48). Raw bytes unchanged.
    function _svgWrap(string memory dataUri) internal view returns (string memory) {
        // bake the collection backgroundColor behind the (transparent) phunk so the bg shows EVERYWHERE
        // (grid thumbnails + detail), not just where a marketplace honors the background_color field.
        string memory bg = bytes(backgroundColor).length > 0
            ? string(abi.encodePacked('<rect width="1200" height="1200" fill="#', backgroundColor, '"/>'))
            : "";
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">',
            bg,
            '<image width="1200" height="1200" image-rendering="pixelated" preserveAspectRatio="xMidYMid meet" href="',
            dataUri,
            '"/></svg>'
        );
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(svg)));
    }
    // ===================== _update: ERC721-C validation + supply =====================
    // Reviewed: the only external call is validateTransfer to the trusted, owner-set ERC721-C validator
    // (address(0) => skipped). No user funds; state writes are supply counters. Not exploitable.
    // slither-disable-next-line reentrancy-no-eth
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address preOwner = _ownerOf(tokenId);
        bool isMintOrBurn = (preOwner == address(0) || to == address(0));
        if (!isMintOrBurn) {
            bool bypass = _bypassValidation;
            _bypassValidation = false;
            if (!bypass) {
                address v = transferValidator;
                if (v != address(0)) ITransferValidator721(v).validateTransfer(auth, preOwner, to, tokenId);
            }
        }
        address from = super._update(to, tokenId, auth);
        if (from == address(0)) { unchecked { ++_totalSupply; } }
        else if (to == address(0)) { unchecked { --_totalSupply; } }
        return from;
    }

    string private _nameOverride;    // optional owner override of ERC721 name()   (appended — upgrade-safe)
    string private _symbolOverride;  // optional owner override of ERC721 symbol()
    uint256[38] private __gap;
}
