// SPDX-License-Identifier: MIT
// 0.8.39: the first release with an empty known-bug list (fixes OverlappingRecursiveStorageStructCopyCorruption
// (+ViaIR), YulOptimizerKnowledgeBaseStaleBookkeeping, MisorderedNamedParametersInRequireWithCustomErrors,
// MemoryByteArrayElementDeleteClearsWholeWord, SpillSlotCollisionAcrossMutualRecursion), so Etherscan shows
// no compiler-bug warnings.
pragma solidity 0.8.39;

/*
  Phunkmas — 67 handcrafted Christmas 1/1s. ERC-721, fully on-chain, forked from CryptoPhunksV67
  (provenance removed: no ethscription hashId/sha).

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

  - Plain fully-on-chain ERC-721 (no ERC-721C transfer validator): image (SSTORE2) + traits, rendered in `tokenURI`.
  - Tradable anywhere (no operator restrictions) and NO royalty: royaltyInfo always returns (0, 0);
    ERC-2981 stays only so markets that call it (ours does, on every sale) don't revert.
  - Still image and animation are stored SEPARATELY:
      `image`         = the still art (crisp SVG wrap)                 -> thumbnails, grids, wallets
      `animation_url` = a viewer: still / creation animation / mirror, picked from a small tray (no text)
                        (falls back to the still art for tokens without an animation)
    Animations are uploaded in chunks (setTokenAnimation + addTokenAnimationChunk), so each tx stays
    under the 16.7M per-transaction gas cap and each Etherscan paste stays small.
  - Token id = 10453 + position in the drop order (10454..10520, right after Phunklloween's 10387..10453);
    pieces are minted as they're finished.
  - NOT upgradeable: the code is fixed at deploy (no proxy). The owner can mint and edit art/traits until
    ownership is renounced; after that nothing can change.
*/

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
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

contract Phunkmas is
    ERC721,
    ERC2981,
    Ownable2Step
{
    using Strings for uint256;

    // ===================== Errors =====================
    error MaxSupplyExceeded();
    error LengthMismatch();
    error BadBackgroundColor();
    error TokenIdOutOfRange();
    error BadImage();
    error ImageTooLarge();
    error ImageNotSet();
    error TokenIsFrozen();
    error NotAllMinted();

    // ===================== Storage: metadata =====================
    mapping(uint256 => address[]) private _imageChunks;   // SSTORE2 ptrs -> exact data URI bytes (chunked for >24KB)
    mapping(uint256 => address[]) private _animChunks;    // SSTORE2 ptrs -> the animation's data URI (optional)
    string  public description;
    string  public constant singleName = "Phunkmas";    // per-token title: "Phunkmas #10454"
    mapping(uint256 => string[]) private _traitKeys;
    mapping(uint256 => string[]) private _traitValues;
    string  private _contractURIValue;                    // ERC-7572 collection metadata (data URI)
    string  public backgroundColor;                       // 6-hex (no #)

    // ===================== Supply =====================
    uint256 private _totalSupply;
    uint256 public constant maxSupply = 67;   // fixed cap

    event TokenImageSet(uint256 indexed tokenId);
    event TraitsSet(uint256 indexed tokenId);
    event Minted(address indexed to, uint256 indexed tokenId);
    event ContractURIUpdated();
    event TokenImageCleared(uint256 indexed tokenId);
    event TokenFrozen(uint256 indexed tokenId);
    event TokenAnimationSet(uint256 indexed tokenId);
    event TokenAnimationCleared(uint256 indexed tokenId);

    // ERC-4906 (metadata update extension) — tells marketplaces to refresh cached metadata.
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    // owner_ is explicit (NOT msg.sender) so a deployer/factory can hand ownership straight to
    // quantumphunks.eth in the same tx. Ownable rejects address(0). Later ownership moves are two-step
    // (Ownable2Step): the new owner must call acceptOwnership(), so a mistyped address can't take control.
    constructor(string memory name_, string memory symbol_, address owner_)
        ERC721(name_, symbol_)
        Ownable(owner_)
    {
        // no royalty is ever set: royaltyInfo -> (address(0), 0)
        backgroundColor = "638596";             // OG CryptoPunks blue-grey (cryptopunks.app)
    }

    function supportsInterface(bytes4 id)
        public view override(ERC721, ERC2981) returns (bool)
    { return id == bytes4(0x49064906) /* ERC-4906 */
        || id == bytes4(0xe8a3d485) /* ERC-7572 contractURI */ || super.supportsInterface(id); }

    // ERC-721 collection name/symbol are owner-settable post-deploy (until renounced). Per-token titles
    // always use the constant `singleName` ("Phunkmas #10454"); setNameAndSymbol does not change them.
    function name() public view override returns (string memory) {
        return bytes(_nameOverride).length > 0 ? _nameOverride : super.name();
    }
    function symbol() public view override returns (string memory) {
        return bytes(_symbolOverride).length > 0 ? _symbolOverride : super.symbol();
    }
    function setNameAndSymbol(string calldata name_, string calldata symbol_) external onlyOwner {
        _nameOverride = name_; _symbolOverride = symbol_;
        emit BatchMetadataUpdate(FIRST_ID, LAST_ID);
    }

    /// @notice Renouncing makes everything permanent, so it is only allowed once all 67 exist
    ///         (otherwise the unminted ids would be stranded forever).
    function renounceOwnership() public override onlyOwner {
        if (_totalSupply != maxSupply) revert NotAllMinted();
        super.renounceOwnership();
    }

    // ===================== Mint / supply =====================
    uint256 public constant FIRST_ID = 10454;   // drop position 1  (Santa Claus)
    uint256 public constant LAST_ID  = 10520;   // drop position 67 (Krampus)
    /// @notice Max still size. tokenURI cost grows faster than linearly with size: the still is encoded twice
    ///         (thumbnail + viewer page) next to the animation. 4 KB + a 58.5 KB animation reads at ~15.9M gas
    ///         (tested); 6 KB + 58.5 KB would not fit under the 16.7M cap. Any 24x24 PNG fits (even uncompressed
    ///         ~3.3 KB as a data URI); the drop's stills are 0.6-2.7 KB.
    uint256 public constant MAX_IMAGE_BYTES = 4_000;
    /// @notice Max animation size. Only ONE copy is encoded into tokenURI (inside the viewer page), and with
    ///         MAX_IMAGE_BYTES this keeps tokenURI readable under the 16.7M per-call gas cap (tested).
    uint256 public constant MAX_ANIMATION_BYTES = 58_500;   // largest of the 17 (Grinch) is 58,082

    /// @notice Per-token lock: once frozen, that token's image, animation and traits can never change again
    ///         (protects trait bids / buyers during the drop, before the final renounce).
    mapping(uint256 => bool) public frozen;

    function _checkId(uint256 t) private pure { if (t < FIRST_ID || t > LAST_ID) revert TokenIdOutOfRange(); }
    function _editable(uint256 t) private view { _checkId(t); if (frozen[t]) revert TokenIsFrozen(); }

    function _doMint(address to, uint256 tokenId) private {
        // only the 67 Phunkmas slots: a mistyped id would otherwise burn one of the 67 forever (no burn fn)
        _checkId(tokenId);
        if (_totalSupply >= maxSupply) revert MaxSupplyExceeded();
        if (_imageChunks[tokenId].length == 0) revert ImageNotSet();   // never mint a blank token
        _safeMint(to, tokenId); emit Minted(to, tokenId);
    }
    function ownerMint(address to, uint256 tokenId) external onlyOwner { _doMint(to, tokenId); }
    function ownerMintBatch(address to, uint256[] calldata ids) external onlyOwner {
        for (uint256 i; i < ids.length; ++i) _doMint(to, ids[i]);
    }
    /// @notice One-way: lock the image, animation and traits of finished pieces. Needs an image (no freezing a blank).
    function freeze(uint256[] calldata ids) external onlyOwner {
        for (uint256 i; i < ids.length; ++i) {
            uint256 t = ids[i]; _editable(t);
            if (_imageChunks[t].length == 0) revert ImageNotSet();
            frozen[t] = true; emit TokenFrozen(t); emit MetadataUpdate(t);
        }
    }
    function ownerOfRaw(uint256 tokenId) external view returns (address) { return _ownerOf(tokenId); }
    function isImageSet(uint256 tokenId) external view returns (bool) { return _imageChunks[tokenId].length > 0; }
    /// @notice Chunk count + total stored bytes of a token's image (check before/after populating).
    function imageInfo(uint256 tokenId) external view returns (uint256 chunks, uint256 bytesStored) {
        address[] storage ch = _imageChunks[tokenId]; chunks = ch.length;
        for (uint256 i; i < chunks; ++i) { uint256 sz = ch[i].code.length; if (sz > 0) bytesStored += sz - 1; }
    }
    function totalSupply() external view returns (uint256) { return _totalSupply; }

    /// @notice True if `tokenId` carries the exact trait (key,value) pair. Used by the market for trait bids.
    ///         Matches the token's real on-chain traits (handles duplicate trait_types, e.g. Male+Guardian).
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
    /// @dev Images are embedded inside href="..." / src="..." quotes, so a `"` (or `<` `>`) would break the
    ///      SVG/HTML. Reject those bytes on write; a full image must also start with "data:image/".
    function _checkImageBytes(bytes calldata d) internal pure {
        bool bad;
        assembly {
            let p := d.offset
            let end := add(p, d.length)
            for { } lt(p, end) { p := add(p, 1) } {
                let c := byte(0, calldataload(p))
                if or(eq(c, 0x22), or(eq(c, 0x3c), eq(c, 0x3e))) { bad := 1 break }   // " < >
            }
        }
        if (bad) revert BadImage();
    }
    function _imageBytes(uint256 t) private view returns (uint256 total) {
        address[] storage ch = _imageChunks[t];
        for (uint256 i; i < ch.length; ++i) { uint256 sz = ch[i].code.length; if (sz > 0) total += sz - 1; }
    }
    function _storeImage(uint256 t, bytes calldata data) internal {
        _editable(t);
        uint256 len = data.length;
        if (len == 0) revert BadImage();                       // use clearTokenImage to clear
        if (len > MAX_IMAGE_BYTES) revert ImageTooLarge();
        if (len < 11 || bytes11(data[0:11]) != bytes11("data:image/")) revert BadImage();
        _checkImageBytes(data);
        delete _imageChunks[t];
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
        emit BatchMetadataUpdate(FIRST_ID, LAST_ID);
    }
    /// @notice Clear an UNMINTED slot's image (a minted token always keeps one; replace it instead).
    function clearTokenImage(uint256 t) external onlyOwner {
        _editable(t);
        if (_ownerOf(t) != address(0)) revert BadImage();
        delete _imageChunks[t]; emit TokenImageCleared(t); emit MetadataUpdate(t);
    }
    function addTokenImageChunk(uint256 t, string calldata piece) external onlyOwner {
        _editable(t);
        if (_imageChunks[t].length == 0) revert BadImage();   // first chunk must come via setTokenImage (data: check)
        if (_imageBytes(t) + bytes(piece).length > MAX_IMAGE_BYTES) revert ImageTooLarge();
        _checkImageBytes(bytes(piece));
        _imageChunks[t].push(SSTORE2.write(bytes(piece))); emit TokenImageSet(t); emit MetadataUpdate(t);
    }
    function tokenImage(uint256 t) public view returns (string memory) {
        address[] storage ch = _imageChunks[t]; uint256 n = ch.length;
        if (n == 0) return ""; if (n == 1) return string(SSTORE2.read(ch[0]));
        bytes memory out = ""; for (uint256 i; i < n; ++i) out = bytes.concat(out, SSTORE2.read(ch[i]));
        return string(out);
    }
    // ===================== Animation (separate from the still image) =====================
    function _animBytes(uint256 t) private view returns (uint256 total) {
        address[] storage ch = _animChunks[t];
        for (uint256 i; i < ch.length; ++i) { uint256 sz = ch[i].code.length; if (sz > 0) total += sz - 1; }
    }
    function _storeAnim(uint256 t, bytes calldata data) internal {
        _editable(t);
        uint256 len = data.length;
        if (len == 0) revert BadImage();                       // use clearTokenAnimation to remove
        if (len > MAX_ANIMATION_BYTES) revert ImageTooLarge();
        if (len < 11 || bytes11(data[0:11]) != bytes11("data:image/")) revert BadImage();
        _checkImageBytes(data);
        delete _animChunks[t];
        for (uint256 off; off < len; off += IMG_CHUNK) {
            uint256 end = off + IMG_CHUNK < len ? off + IMG_CHUNK : len;
            _animChunks[t].push(SSTORE2.write(data[off:end]));
        }
        emit TokenAnimationSet(t);
    }
    /// @notice Set (replace) a token's animation: a full `data:image/...` URI (e.g. an animated GIF), or the
    ///         FIRST part of one, with the rest appended via addTokenAnimationChunk. Shown as animation_url.
    function setTokenAnimation(uint256 t, string calldata v) external onlyOwner { _storeAnim(t, bytes(v)); emit MetadataUpdate(t); }
    /// @notice Set several animations in one tx (keep each tx under the 16.7M gas cap: ~320 gas per byte).
    function setTokenAnimationBatch(uint256[] calldata ts, string[] calldata vs) external onlyOwner {
        uint256 n = ts.length; if (n != vs.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) _storeAnim(ts[i], bytes(vs[i]));
        emit BatchMetadataUpdate(FIRST_ID, LAST_ID);
    }
    /// @notice Append the next part of an animation started with setTokenAnimation (for big ones / small pastes).
    function addTokenAnimationChunk(uint256 t, string calldata piece) external onlyOwner {
        _editable(t);
        if (_animChunks[t].length == 0) revert BadImage();   // first part must come via setTokenAnimation
        if (_animBytes(t) + bytes(piece).length > MAX_ANIMATION_BYTES) revert ImageTooLarge();
        _checkImageBytes(bytes(piece));
        bytes calldata p = bytes(piece);
        for (uint256 off; off < p.length; off += IMG_CHUNK) {
            uint256 end = off + IMG_CHUNK < p.length ? off + IMG_CHUNK : p.length;
            _animChunks[t].push(SSTORE2.write(p[off:end]));
        }
        emit TokenAnimationSet(t); emit MetadataUpdate(t);
    }
    /// @notice Remove a token's animation: animation_url falls back to the still image.
    function clearTokenAnimation(uint256 t) external onlyOwner {
        _editable(t);
        delete _animChunks[t]; emit TokenAnimationCleared(t); emit MetadataUpdate(t);
    }
    /// @notice The stored animation data URI, byte-identical ("" if none).
    function tokenAnimation(uint256 t) public view returns (string memory) {
        address[] storage ch = _animChunks[t]; uint256 n = ch.length;
        if (n == 0) return ""; if (n == 1) return string(SSTORE2.read(ch[0]));
        bytes memory out = ""; for (uint256 i; i < n; ++i) out = bytes.concat(out, SSTORE2.read(ch[i]));
        return string(out);
    }
    function hasAnimation(uint256 t) external view returns (bool) { return _animChunks[t].length > 0; }
    /// @notice Chunk count + total stored bytes of a token's animation (check before/after uploading).
    function animationInfo(uint256 t) external view returns (uint256 chunks, uint256 bytesStored) {
        chunks = _animChunks[t].length; bytesStored = _animBytes(t);
    }

    function setDescription(string calldata v) external onlyOwner { description = v; emit BatchMetadataUpdate(FIRST_ID, LAST_ID); }
    function setTraits(uint256 t, string[] calldata keys, string[] calldata vals) external onlyOwner {
        _editable(t);
        if (keys.length != vals.length) revert LengthMismatch(); _traitKeys[t] = keys; _traitValues[t] = vals; emit TraitsSet(t); emit MetadataUpdate(t);
    }
    function batchSetTraits(uint256[] calldata ids, string[][] calldata keys, string[][] calldata vals) external onlyOwner {
        uint256 n = ids.length; if (n != keys.length || n != vals.length) revert LengthMismatch();
        for (uint256 i; i < n; ++i) {
            _editable(ids[i]);
            if (keys[i].length != vals[i].length) revert LengthMismatch();
            _traitKeys[ids[i]] = keys[i]; _traitValues[ids[i]] = vals[i]; emit TraitsSet(ids[i]);
        }
        emit BatchMetadataUpdate(FIRST_ID, LAST_ID);
    }
    function setBackgroundColor(string calldata hex6) external onlyOwner { if (!_isHex6(bytes(hex6))) revert BadBackgroundColor(); backgroundColor = hex6; emit BatchMetadataUpdate(FIRST_ID, LAST_ID); }

    // ===================== tokenURI (fully on-chain) =====================
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory label = string(abi.encodePacked(singleName, " #", tokenId.toString()));   // "Phunkmas #10454"
        string memory img = tokenImage(tokenId);
        // ALWAYS wrap the `image` (thumbnail) in a crisp-rendering SVG so it displays SHARP and renders
        // consistently everywhere. Raw bytes are always available byte-identical via tokenImage().
        string memory displayImg = _svgWrap(img);
        // animation_url = a small viewer page. With an animation: still / animation / mirror views, no text (opens on
        // the still). Without one: click-to-flip on the still (byte-identical to live CryptoPhunksV67Flip).
        string memory anim = string(abi.encodePacked(',"animation_url":"', _flipPage(img, tokenAnimation(tokenId)), '"'));
        string memory bg = bytes(backgroundColor).length > 0 ? string(abi.encodePacked(',"background_color":"', backgroundColor, '"')) : "";
        bytes memory json = abi.encodePacked(
            '{"name":"', label,
            '","description":"', _esc(bytes(description).length > 0 ? description : name()), '"',
            ',"image":"', displayImg, '"', anim, bg,
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
            out = abi.encodePacked(out, '{"trait_type":"', _esc(keys[i]), '","value":"', _esc(vals[i]), '"}');
        }
        return string(abi.encodePacked(out, "]"));
    }
    /// @dev JSON-escape owner-set text (", \ and control chars) so a stray quote can never break a token's metadata.
    function _esc(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str); uint256 extra = 0;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c == '"' || c == "\\") extra += 1; else if (uint8(c) < 0x20) extra += 5;
        }
        if (extra == 0) return str;
        bytes memory out = new bytes(b.length + extra); uint256 o = 0;
        bytes16 hexd = "0123456789abcdef";
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c == '"' || c == "\\") { out[o++] = "\\"; out[o++] = c; }
            else if (uint8(c) < 0x20) {
                out[o++] = "\\"; out[o++] = "u"; out[o++] = "0"; out[o++] = "0";
                out[o++] = hexd[uint8(c) >> 4]; out[o++] = hexd[uint8(c) & 0x0f];
            } else out[o++] = c;
        }
        return string(out);
    }
    function _isHex6(bytes memory b) internal pure returns (bool) {
        if (b.length != 6) return false;
        for (uint256 i; i < 6; ++i) {
            bytes1 c = b[i];
            if (!((c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F"))) return false;
        }
        return true;
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
    /// @dev Viewer page for animation_url. `still` = the image; `animation` = "" or the animation data URI.
    ///      No animation: click-to-flip (byte-identical to live CryptoPhunksV67Flip).
    ///      Animation: full-size art, no text; a small tray of three views that shows only on hover (switch from the tray; keyboard arrows too): the still (opens
    ///      here), the animation (its tray thumbnail plays; picking it plays it big from frame 1) and the mirror.
    ///      Clicking the picture mirrors whatever is showing. Both URIs sit in quoted attributes and are
    ///      guaranteed free of " < > by _checkImageBytes.
    function _flipPage(string memory still, string memory animation) internal view returns (string memory) {
        string memory bg = bytes(backgroundColor).length > 0 ? backgroundColor : "000000";
        bytes memory html = abi.encodePacked(
            '<style>html,body{margin:0;height:100%;background:#', bg,
            '}img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;',
            'image-rendering:pixelated;cursor:pointer;transition:transform .25s}',
            '.r{transform:scaleX(-1)}'
        );
        if (bytes(animation).length == 0) {
            html = abi.encodePacked(html, '</style><img id=p src="', still,
                '"><script>p.onclick=function(){p.classList.toggle("r")}</script>');
        } else {
            html = abi.encodePacked(html,
                'html,body{overflow:hidden;user-select:none}#n{opacity:0;transition:opacity .3s}body:hover #n{opacity:1}',
                '#n{position:absolute;bottom:2.5vmin;left:50%;transform:translateX(-50%);display:flex;gap:.9vmin;',
                'padding:.9vmin;border-radius:1.6vmin;background:rgba(0,0,0,.45)}',
                '#n b{position:relative;width:5vmin;height:5vmin;border-radius:.9vmin;cursor:pointer;',
                'background:#', bg, ' center/contain no-repeat;image-rendering:pixelated;outline:.3vmin solid transparent}',
                '#n b.on{outline-color:#fff}#n b:nth-child(3){transform:scaleX(-1)}',
                '</style><img id=p src="', still, '" data-a="', animation,
                '"><div id=n><b></b><b></b><b></b></div><script>',
                'var S=p.src,A=p.dataset.a,B=n.children,v=0,c=0;',
                'function go(i){v=(i+3)%3;p.src=v==1?A+"#"+(++c):S;p.className=v==2?"r":"";',
                'for(var k=0;k<3;k++)B[k].className=k==v?"on":""}',
                'for(var k=0;k<3;k++){B[k].style.backgroundImage="url("+(k==1?A:S)+")";B[k].onclick=go.bind(0,k)}',
                'p.onclick=function(){p.classList.toggle("r")};',
                'onkeydown=function(e){if(e.key=="ArrowLeft")go(v-1);if(e.key=="ArrowRight")go(v+1)};go(0)</script>');
        }
        return string(abi.encodePacked("data:text/html;base64,", Base64.encode(html)));
    }
    // ===================== _update: supply counter (mints only; there is no burn) =====================
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from == address(0)) { unchecked { ++_totalSupply; } }   // no burn exists, so supply only grows
        return from;
    }

    string private _nameOverride;    // optional owner override of ERC721 name()
    string private _symbolOverride;  // optional owner override of ERC721 symbol()
}
