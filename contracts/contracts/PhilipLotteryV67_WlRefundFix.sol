// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFV2PlusWrapper.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IQuantumPhunksNFT {
    function isImageSet(uint256 tokenId) external view returns (bool);
    function ownerOfRaw(uint256 tokenId) external view returns (address);
    function mintFromLottery(address to, uint256 tokenId) external;
    function transferFromLottery(address to, uint256 tokenId) external;
    function hasTrait(uint256 tokenId, string calldata key, string calldata value) external view returns (bool);
}

interface IVaultBacking {
    function recordBacking(uint256 v67Id, address coll, uint256 v2tokenId, uint256 reclaimValue) external;
}

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IPoints {
    function addPoints(address user, uint256 amount) external;
}

interface IERC721Min {
    // slither-disable-next-line erc20-interface  (ERC-721 transferFrom shares ERC-20's selector; this is correct)
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice CARL bond funding: any wallet can permissionlessly `receive()` — the CarlBondingCurve
///         pulls its own credited balance the same way the treasury does (see IPullCredit).
interface IPullCredit {
    // no functions required; the router just needs to be a valid receive()-capable address that
    // later calls withdrawRefund() on this Lottery to pull what's been routed to it
}

/**
 * @title PhilipLotteryV67Erc721 — CARL routing upgrade
 * @notice Identical to the deployed PhilipLotteryV67Erc721, plus an optional, adjustable,
 *         toggleable split of mint proceeds into a CARL bonding-curve router. Storage-compatible:
 *         new state consumes from the existing `__gap` reservation, so this is a safe UUPS
 *         `upgradeToAndCall` target for the live proxy — no other behavior changes.
 *
 *  CARL routing design (all owner-adjustable, all reversible, off by default):
 *    - carlRoutingEnabled: master on/off switch. Off => 100% of every mint credits the treasury,
 *      byte-for-byte the original behavior. This is the "can turn it off if need" requirement.
 *    - carlRouteBps: 0-10,000 (0-100%) of each mint payment routed to `carlBondRouter` instead of
 *      the treasury. Hard-capped at BPS (10,000) so it can never exceed the payment. This is the
 *      "adjust what goes in" requirement.
 *    - carlBondRouter: the recipient address (expected to be a CarlBondingCurve-facing router).
 *      Uses the EXISTING pull-payment ledger (`pendingRefunds`), so the router pulls its own
 *      credited ETH via `withdrawRefund()` exactly like the treasury does today — no new ETH-moving
 *      code path, no new reentrancy surface.
 *    - Routing only ever touches the TREASURY's share of a mint. Player refunds (surrender
 *      returns, stuck-spin refunds) are computed and paid identically to before; CARL routing
 *      cannot affect what a player is owed.
 */
contract PhilipLotteryV67Erc721WlFix is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    error AlreadyMinted();
    error InvalidAddress();
    error InvalidPayment();
    error InvalidQuantity();
    error InvalidSize();
    error LotteryInactive();
    error NoPendingMint();
    error NoTokensAvailable();
    error NotConfigured();
    error PendingMintActive();
    error TokenOutOfRange();
    error TransferFailed();
    error WalletLimitReached();
    error NotWhitelisted();
    error OnlyEOA();
    error LengthMismatch();
    error TooEarly();
    error NotAuthorized();
    error CreditExceedsOrder();
    error TooManySurrendered();
    error TwinWindowClosed();     // twinSwap only during the pre-lottery window
    error NotTwinEligible();      // Special / One-of-One / already-minted has no twin
    error NotV2Owner();           // caller doesn't own the V2 with this id
    error TokenNotInPool();       // twin id isn't an available pool token
    error VaultNotSet();
    error BpsTooHigh();           // carlRouteBps > BPS (10,000)

    uint256 public constant MAX_TOKEN_ID = 9999;
    uint256 public constant SINGLE_MINT_ONLY_THRESHOLD = 100;
    uint256 public constant STUCK_SPIN_REFUND_DELAY = 300; // ~1h: minter can self-refund a stuck spin after this
    uint256 public constant MAX_SURRENDER_PER_SPIN = 60;   // bound the surrendered-NFT list so pulls/returns can't run away
    uint16 public constant BPS = 10_000;

    struct PendingMint {
        address player;
        uint8 quantity;
        uint256 mintPayment;
        uint256 requestBlock;   // set at request; gates the minter self-refund
    }

    IQuantumPhunksNFT public nft;

    uint256 public mintPrice;
    uint8 public maxBatchSize;
    bool public lotteryActive;
    address payable public treasury;
    IVRFV2PlusWrapper public vrfWrapper;
    uint32 public vrfCallbackGasLimit;
    uint16 public vrfRequestConfirmations;
    uint256 public pendingVRFRequests;
    uint256 public pendingMintQuantity;

    uint256[] private _activePool;
    mapping(uint256 => uint256) private _poolIndexPlusOne;
    mapping(uint256 => bool) public reserved;
    mapping(uint256 => PendingMint) public pendingMints;
    mapping(address => uint256) public pendingRefunds;
    uint256 public totalPendingRefunds;

    uint16 public maxPerWallet;
    mapping(address => uint256) public lotteryMintsOf;

    // ─── Points + whitelist(discount) + hold-to-discount ───
    address public pointsAddress;                  // optional: awards points per mint (off when 0)
    bool public whitelistEnabled;                  // optional GATE (private phase); off by default
    mapping(address => bool) public whitelisted;   // OTC/discount addresses: pay `whitelistDiscount` less, mint alongside everyone
    uint256 public pointsPerToken;                 // points granted per minted token (default 67)
    uint256 public totalCommittedETH;              // player payments held for IN-FLIGHT VRF spins; owner can NEVER withdraw these
    uint256 public whitelistDiscount;              // wei off PER TOKEN for whitelisted addresses (capped by whitelistDiscountCap)
    uint16  public whitelistDiscountCap;           // "set amount": max discounted tokens per whitelisted addr (0 = uncapped)
    mapping(address => uint16) public whitelistDiscountUsed; // discounted tokens already claimed, per address
    bool public discountsEnabled;                  // master toggle for the surrender-another-collection discounts
    // ─── Discounts priced in UNITS so one global knob rescales everything (e.g. if V2 floor moves). ───
    uint256 public unitValue;                      // wei per "unit" (e.g. 0.01675 ETH); change this to rescale ALL discounts at once
    mapping(address => uint16) public collectionUnits;                 // collection => default units per NFT (0 = not a discount collection)
    mapping(address => mapping(uint256 => uint16)) public tokenUnits;  // collection => tokenId => OVERRIDE units (rare traits); 0 = use collection default

    // ─── Surrender escrow: buyers HAND OVER V1/V2/Philip NFTs for the discount (treasury accumulates them) ───
    struct SurrenderedNFT { address collection; uint256 tokenId; uint256 reclaimValue; } // reclaimValue = discount it gave -> its Vault backing/reclaim price
    mapping(uint256 => SurrenderedNFT[]) private _surrendered; // requestId => NFTs escrowed for the discount while the spin is pending
    mapping(uint256 => bool) public surrenderClaimable;        // requestId => spin settled but surrenders not yet moved to the Vault (retry forwardSurrendered)
    mapping(uint256 => uint256[]) private _mintedIds;          // requestId => the v67 ids won in this spin (for 1:1 surrender->backing pairing)

    // ─── Vault + twin swap ───
    address public vault;                 // QuantumPhunksVault; surrenders + twin V2s become 1:1 backing here
    bool public twinWindowOpen;           // pre-lottery window: twinSwap works, spins are OFF (mutually exclusive w/ lotteryActive)
    uint256 public freeTwinSwaps;         // remaining free twin claims (starts 67); after that a fee applies
    uint256 public twinSwapFee;           // wei fee once the free ones run out
    address public v2Collection;          // the collection whose #N twins v67 #N (CryptoPhunksV2)
    mapping(address => bool) public freeTwinAllowed;  // always-free twin swaps (e.g. quantumphunks.eth for testing); doesn't consume the 67

    // ─── CARL bond routing (NEW — consumes 3 slots from the old __gap[38]) ───
    address public carlBondRouter;        // recipient for the routed share; pulls via withdrawRefund() like the treasury
    uint16 public carlRouteBps;           // 0-10,000: share of each mint payment routed to carlBondRouter instead of treasury
    bool public carlRoutingEnabled;       // master on/off switch; OFF => byte-for-byte original behavior

    event PoolLoaded(uint256 count);
    event PoolTokenRemoved(uint256 indexed tokenId);
    event Reserved(uint256 indexed tokenId, bool reserved);
    event MintRequested(uint256 indexed requestId, address indexed player, uint8 quantity, uint256 mintPayment);
    event MintRequestCancelled(uint256 indexed requestId, address indexed player, uint8 quantity, uint256 mintPayment);
    event RandomMinted(uint256 indexed requestId, address indexed player, uint256 indexed tokenId);
    event TreasuryCredited(address indexed treasury, uint256 amount);
    event RefundEscrowed(address indexed user, uint256 amount);
    event SurplusETHWithdrawn(address indexed to, uint256 amount);
    event LotteryConfigUpdated(uint256 mintPrice, uint8 maxBatchSize, bool active);
    event VRFConfigUpdated(address wrapper, uint32 callbackGasLimit, uint16 confirmations);
    event NFTUpdated(address indexed nft);
    event TreasuryUpdated(address indexed treasury);
    event MaxPerWalletUpdated(uint16 maxPerWallet);
    event PointsConfigUpdated(address indexed pointsAddress, uint256 pointsPerToken);
    event WhitelistToggled(bool enabled);
    event WhitelistUpdated(address indexed account, bool allowed);
    event WhitelistDiscountSet(uint256 discountWei);
    event WhitelistDiscountCapSet(uint16 cap);
    event DiscountsEnabledSet(bool enabled);
    event UnitValueSet(uint256 weiPerUnit);
    event CollectionUnitsSet(address indexed collection, uint16 units);
    event TokenUnitsSet(address indexed collection, uint256 indexed tokenId, uint16 units);
    event Surrendered(uint256 indexed requestId, address indexed player, uint256 count);
    event SurrenderReturned(uint256 indexed requestId, address indexed player, uint256 count);
    event SurrenderSwept(uint256 indexed requestId, address indexed to, uint256 count);

    // ─── CARL routing events ───
    event CarlBondRouterSet(address indexed router);
    event CarlRouteBpsSet(uint16 bps);
    event CarlRoutingEnabledSet(bool enabled);
    event CarlCredited(address indexed router, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address nft_, address payable treasury_) external initializer {
        if (nft_ == address(0) || treasury_ == address(0)) revert InvalidAddress();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        nft = IQuantumPhunksNFT(nft_);
        treasury = treasury_;
        maxBatchSize = 8;
        maxPerWallet = 67;
        pointsPerToken = 67;
        freeTwinSwaps = 0;    // no free-67 promo by default; freeTwinAllowed[] gives free testing, owner can set a count later
    }

    receive() external payable {}

    // Accept pre-minted prizes ONLY from the configured collection; reject stray NFTs so
    // they can't get stuck here (and can never end up raffled).
    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(nft)) revert InvalidAddress();
        return this.onERC721Received.selector;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice The discount UNITS for a token: its rare-trait override if set, else the collection default.
    function unitsForToken(address collection, uint256 tokenId) public view returns (uint256) {
        return _unitsForToken(collection, tokenId);
    }
    /// @notice The per-NFT ETH-off for a specific token = its units × the global unitValue.
    function discountForToken(address collection, uint256 tokenId) public view returns (uint256) {
        return _unitsForToken(collection, tokenId) * unitValue;
    }
    function _unitsForToken(address collection, uint256 tokenId) internal view returns (uint256) {
        uint16 o = tokenUnits[collection][tokenId];
        return o != 0 ? o : collectionUnits[collection];
    }
    function _discountForToken(address collection, uint256 tokenId) internal view returns (uint256) {
        return _unitsForToken(collection, tokenId) * unitValue;
    }

    /// @notice ETH credit for SURRENDERING the given (collection, tokenId) NFTs plus any whitelist discount. Each
    ///         entry adds that token's discount (rare-trait override if set, else the collection default); duplicates
    ///         allowed. RAW total — `quote`/`requestMint` reject anything worth more than the order (never over-give).
    /// @param collections collection address of each NFT the buyer will surrender
    /// @param tokenIds    tokenId of each NFT (parallel to `collections`) — lets rare traits be worth more
    function creditFor(address player, address[] calldata collections, uint256[] calldata tokenIds) public view returns (uint256 credit) {
        if (collections.length != tokenIds.length) revert LengthMismatch();
        credit = 0;   // surrender credit only; the whitelist discount is per-token (see _wlDiscount / quote)
        if (discountsEnabled) {
            for (uint256 i; i < collections.length; ++i) {
                credit += _discountForToken(collections[i], tokenIds[i]);   // non-discount tokens add 0; requestMint rejects them
            }
        }
    }

    /// @dev Whitelist discount: `whitelistDiscount` wei off PER TOKEN, for up to `whitelistDiscountCap` tokens per
    ///      address (0 = uncapped). Returns the total wei off and how many tokens it covers (for usage tracking).
    function _wlDiscount(address player, uint8 quantity) internal view returns (uint256 disc, uint16 discQty) {
        if (!whitelisted[player] || whitelistDiscount == 0) return (0, 0);
        uint256 rem = whitelistDiscountCap == 0
            ? quantity
            : (whitelistDiscountCap > whitelistDiscountUsed[player] ? whitelistDiscountCap - whitelistDiscountUsed[player] : 0);
        discQty = uint16(quantity < rem ? quantity : rem);
        disc = uint256(discQty) * whitelistDiscount;
    }
    /// @notice Discounted tokens a whitelisted address still has at the whitelist price (0-cap => effectively unlimited).
    function whitelistDiscountRemaining(address player) external view returns (uint256) {
        if (whitelistDiscountCap == 0) return type(uint256).max;
        uint16 used = whitelistDiscountUsed[player];
        return whitelistDiscountCap > used ? whitelistDiscountCap - used : 0;
    }

    /// @notice What the buyer pays for `quantity` (mint portion, excl. the VRF fee): order total minus the value
    ///         of the NFTs they surrender. REVERTS `CreditExceedsOrder` if that surrender is worth MORE than the
    ///         order (buy 1 @ 0.067 and try to hand over 2×V2 = 0.08 → rejected). They can use up to the order,
    ///         pay the rest, and never over-give. No leftover, ever.
    function quote(address player, uint8 quantity, address[] calldata collections, uint256[] calldata tokenIds) public view returns (uint256) {
        uint256 orderTotal = mintPrice * quantity;
        (uint256 wl, ) = _wlDiscount(player, quantity);
        uint256 credit = creditFor(player, collections, tokenIds) + wl;
        if (credit > orderTotal) revert CreditExceedsOrder();
        return orderTotal - credit;
    }

    /// @param surrenderCollections collection address of each NFT to hand over for the discount
    /// @param surrenderTokenIds    tokenId of each NFT to hand over (parallel to `surrenderCollections`)
    ///        Buyer must have approved this contract for those collections. Total discount can't exceed the order.
    // Reviewed: nonReentrant. The ETH-sending call is to the trusted, owner-set Chainlink VRF wrapper
    // (no callback into arbitrary code). Surrender transferFrom targets are validated (_discountForToken != 0
    // => only owner-allowlisted collections) and accounting is written before the pulls. Not exploitable.
    // slither-disable-next-line reentrancy-eth
    function requestMint(
        uint8 quantity,
        address[] calldata surrenderCollections,
        uint256[] calldata surrenderTokenIds
    ) external payable nonReentrant {
        if (msg.sender != tx.origin) revert OnlyEOA();                              // anti-snipe: no contract callers/bots
        if (!lotteryActive) revert LotteryInactive();
        if (whitelistEnabled && !whitelisted[msg.sender]) revert NotWhitelisted();  // optional GATE (private phase)
        if (quantity == 0 || quantity > maxBatchSize) revert InvalidQuantity();
        uint256 available = _activePool.length - pendingMintQuantity;
        if (available < quantity) revert NoTokensAvailable();
        if (available <= SINGLE_MINT_ONLY_THRESHOLD && quantity != 1) revert InvalidQuantity();
        if (address(vrfWrapper) == address(0)) revert InvalidAddress();
        uint256 cap = maxPerWallet;
        if (cap != 0 && lotteryMintsOf[msg.sender] + quantity > cap) revert WalletLimitReached();

        uint256 nSurrender = surrenderCollections.length;
        if (nSurrender != surrenderTokenIds.length) revert LengthMismatch();
        if (nSurrender > MAX_SURRENDER_PER_SPIN) revert TooManySurrendered();
        if (nSurrender != 0 && !discountsEnabled) revert LotteryInactive();          // can't surrender for credit while discounts are off

        uint256 vrfCost = vrfWrapper.calculateRequestPriceNative(vrfCallbackGasLimit, 1);
        uint256 mintPayment = quote(msg.sender, quantity, surrenderCollections, surrenderTokenIds); // reverts if surrender worth > order (never over-given)
        (, uint16 wlDiscQty) = _wlDiscount(msg.sender, quantity);
        whitelistDiscountUsed[msg.sender] += wlDiscQty;                                     // consume the set-amount whitelist allocation
        uint256 totalCost = mintPayment + vrfCost;
        if (msg.value < totalCost) revert InvalidPayment();

        // VRF v2.5 native payment REQUIRES extraArgs flagging nativePayment=true,
        // else the wrapper reverts LINKPaymentInRequestRandomWordsInNative().
        bytes memory extraArgs = VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({ nativePayment: true }));
        uint256 requestId = vrfWrapper.requestRandomWordsInNative{value: vrfCost}(
            vrfCallbackGasLimit,
            vrfRequestConfirmations,
            1,
            extraArgs
        );
        // Defense in depth: official Chainlink wrappers never return duplicate ids, but a
        // malicious or misconfigured wrapper could; block overwrite to keep accounting sane.
        if (pendingMints[requestId].player != address(0)) revert PendingMintActive();
        pendingMints[requestId] = PendingMint(msg.sender, quantity, mintPayment, block.number);
        if (wlDiscQty != 0) _pendingWlDiscQty[requestId] = wlDiscQty;   // so a refund can give it back
        pendingVRFRequests++;
        pendingMintQuantity += quantity;
        lotteryMintsOf[msg.sender] += quantity;
        totalCommittedETH += mintPayment;           // protect this ETH until the spin settles/cancels

        // Pull & ESCROW the surrendered NFTs (buyer must have approved this contract). Held here while the
        // spin is pending: forwarded to the treasury on a win (sweepSurrendered), returned to the buyer on refund.
        for (uint256 i; i < nSurrender; ++i) {
            address c = surrenderCollections[i];
            uint256 id = surrenderTokenIds[i];
            uint256 rv = _discountForToken(c, id);
            if (rv == 0) revert NotConfigured();                                       // never accept a token worth no discount
            IERC721Min(c).transferFrom(msg.sender, address(this), id);
            _surrendered[requestId].push(SurrenderedNFT(c, id, rv));                   // store its value = its Vault reclaim price
        }
        if (nSurrender != 0) emit Surrendered(requestId, msg.sender, nSurrender);

        if (msg.value > totalCost) {
            _refundOrCredit(payable(msg.sender), msg.value - totalCost);
        }

        emit MintRequested(requestId, msg.sender, quantity, mintPayment);
    }

    /// @notice Owner-only FREE spin: a real VRF random mint of 1..maxBatchSize to the owner, paying ONLY the
    ///         VRF fee (no mint price). Works even while the lottery is inactive — for pre-launch testing and
    ///         free owner pulls. Same random path as a normal spin; the winning token is only known at fulfillment.
    // Reviewed: nonReentrant + onlyOwner; ETH-sending call is to the trusted Chainlink VRF wrapper only.
    // slither-disable-next-line reentrancy-eth
    function ownerSpin(uint8 quantity) external payable onlyOwner nonReentrant {
        if (quantity == 0 || quantity > maxBatchSize) revert InvalidQuantity();
        uint256 available = _activePool.length - pendingMintQuantity;
        if (available < quantity) revert NoTokensAvailable();
        if (address(vrfWrapper) == address(0)) revert InvalidAddress();

        uint256 vrfCost = vrfWrapper.calculateRequestPriceNative(vrfCallbackGasLimit, 1);
        if (msg.value < vrfCost) revert InvalidPayment();

        bytes memory extraArgs = VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({ nativePayment: true }));
        uint256 requestId = vrfWrapper.requestRandomWordsInNative{value: vrfCost}(
            vrfCallbackGasLimit, vrfRequestConfirmations, 1, extraArgs
        );
        if (pendingMints[requestId].player != address(0)) revert PendingMintActive();
        pendingMints[requestId] = PendingMint(msg.sender, quantity, 0, block.number);  // mintPayment = 0 (free)
        pendingVRFRequests++;
        pendingMintQuantity += quantity;

        if (msg.value > vrfCost) _refundOrCredit(payable(msg.sender), msg.value - vrfCost);
        emit MintRequested(requestId, msg.sender, quantity, 0);
    }

    // Reviewed: nonReentrant + caller must be the trusted VRF wrapper. External calls (NFT mint/transfer)
    // are to our own configured collection; pool state is updated safely. Not exploitable.
    // slither-disable-next-line reentrancy-no-eth
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
        if (msg.sender != address(vrfWrapper)) revert InvalidAddress();
        if (randomWords.length == 0) revert InvalidSize();
        PendingMint memory pending = pendingMints[requestId];
        if (pending.player == address(0)) revert NoPendingMint();
        delete pendingMints[requestId];
        delete _pendingWlDiscQty[requestId];   // spin settled: the discount was genuinely used
        pendingVRFRequests--;
        pendingMintQuantity -= pending.quantity;

        bool hasSurrender = _surrendered[requestId].length != 0;
        for (uint256 i; i < pending.quantity; ++i) {
            uint256 random = uint256(keccak256(abi.encode(randomWords[0], requestId, pending.player, i)));
            uint256 index = random % _activePool.length;
            uint256 tokenId = _activePool[index];
            _removeFromPoolByIndex(index);
            if (hasSurrender) _mintedIds[requestId].push(tokenId);   // record won ids for 1:1 surrender->backing
            _deliver(pending.player, tokenId);
            emit RandomMinted(requestId, pending.player, tokenId);
        }

        // Points (best-effort; never blocks the mint settlement)
        if (pointsAddress != address(0) && pointsPerToken != 0) {
            try IPoints(pointsAddress).addPoints(pending.player, uint256(pending.quantity) * pointsPerToken) {} catch {}
        }

        // payment moves from "committed" to the treasury's (+ CARL router's) pull balance
        if (totalCommittedETH >= pending.mintPayment) totalCommittedETH -= pending.mintPayment;
        else totalCommittedETH = 0;
        _creditTreasury(pending.mintPayment);
        // Auto-forward the surrendered phunks to the treasury. Done via a GAS-SAFE self-call: we pre-flag the
        // spin claimable, then try the forward — on success it flips the flag off; if the list is so large it
        // would exceed the VRF callback gas, the sub-call reverts, the flag STAYS set, and the mint still
        // settles cleanly (owner sweeps those later). So the common case is automatic and nothing can brick.
        if (_surrendered[requestId].length != 0) {
            surrenderClaimable[requestId] = true;
            try this.forwardSurrendered(requestId) {} catch {}
        }
        if (_activePool.length == 0) {
            lotteryActive = false;
            emit LotteryConfigUpdated(mintPrice, maxBatchSize, false);
        }
    }

    function reserveMint(address to, uint256 tokenId) external onlyOwner {
        _reserveMint(to, tokenId);
    }

    function reserveMintBatch(address to, uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i; i < tokenIds.length; ++i) {
            _reserveMint(to, tokenIds[i]);
        }
    }

    /// @notice Batch-deliver up to `maxCount` of the REMAINING pool tokens to ANY wallet
    /// (treasury / you / etc.) without listing ids — transfers held pre-mints, mints the rest.
    /// Never touches tokens committed to in-flight VRF spins; pass a small `maxCount` to chunk.
    // Reviewed: onlyOwner; transfers are to our own configured NFT; pool state updated safely.
    // slither-disable-next-line reentrancy-no-eth
    function mintRemaining(address to, uint256 maxCount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        uint256 avail = _activePool.length > pendingMintQuantity ? _activePool.length - pendingMintQuantity : 0;
        if (maxCount > avail) maxCount = avail;
        for (uint256 i; i < maxCount; ++i) {
            uint256 last = _activePool.length - 1;
            uint256 tokenId = _activePool[last];
            _removeFromPoolByIndex(last);          // O(1) pop of the tail
            reserved[tokenId] = true;
            emit Reserved(tokenId, true);
            _deliver(to, tokenId);
        }
    }

    function addPoolTokens(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            if (tokenId > MAX_TOKEN_ID) revert TokenOutOfRange();
            // Pool-ready == the image is set. Provenance (tokenSha/hashId) is optional owner-note
            // metadata only — never a gate. A token needs its on-chain image to be winnable.
            if (!nft.isImageSet(tokenId)) revert NotConfigured();
            // allow UNMINTED (mint-on-win) or a PRE-MINTED prize the lottery holds (transfer-on-win)
            address rawOwner = nft.ownerOfRaw(tokenId);
            if (reserved[tokenId] || (rawOwner != address(0) && rawOwner != address(this))) revert AlreadyMinted();
            if (_poolIndexPlusOne[tokenId] == 0) {
                _poolIndexPlusOne[tokenId] = _activePool.length + 1;
                _activePool.push(tokenId);
            }
        }
        emit PoolLoaded(tokenIds.length);
    }

    function removePoolToken(uint256 tokenId) external onlyOwner {
        _removeFromPoolForOwner(tokenId);
    }

    function setReserved(uint256 tokenId, bool value) external onlyOwner {
        if (tokenId > MAX_TOKEN_ID) revert TokenOutOfRange();
        reserved[tokenId] = value;
        if (value) _removeFromPoolForOwner(tokenId);
        emit Reserved(tokenId, value);
    }

    function setLotteryConfig(uint256 price, uint8 maxBatch, bool active) external onlyOwner {
        if (maxBatch == 0 || maxBatch > 8) revert InvalidQuantity();
        if (active && twinWindowOpen) revert TwinWindowClosed();   // close the twin window before going live
        mintPrice = price;
        maxBatchSize = maxBatch;
        lotteryActive = active;
        emit LotteryConfigUpdated(price, maxBatch, active);
    }

    function setVRFConfig(address wrapper, uint32 callbackGasLimit, uint16 confirmations) external onlyOwner {
        if (wrapper == address(0)) revert InvalidAddress();
        if (callbackGasLimit == 0 || confirmations == 0) revert InvalidSize();
        if (pendingVRFRequests != 0) revert PendingMintActive();
        vrfWrapper = IVRFV2PlusWrapper(wrapper);
        vrfCallbackGasLimit = callbackGasLimit;
        vrfRequestConfirmations = confirmations;
        emit VRFConfigUpdated(wrapper, callbackGasLimit, confirmations);
    }

    function setTreasury(address payable treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setNFT(address nft_) external onlyOwner {
        if (nft_ == address(0)) revert InvalidAddress();
        if (pendingVRFRequests != 0) revert PendingMintActive();
        nft = IQuantumPhunksNFT(nft_);
        emit NFTUpdated(nft_);
    }

    // ─── Vault + twin swap ───
    event VaultSet(address indexed vault);
    event V2CollectionSet(address indexed collection);
    event TwinWindowSet(bool open);
    event TwinSwapFeeSet(uint256 fee);
    event TwinClaimed(address indexed claimer, uint256 indexed tokenId, bool free, uint256 fee);

    // slither-disable-next-line missing-zero-check
    function setVault(address vault_) external onlyOwner { vault = vault_; emit VaultSet(vault_); }
    // slither-disable-next-line missing-zero-check
    function setV2Collection(address v2_) external onlyOwner { v2Collection = v2_; emit V2CollectionSet(v2_); }
    function setTwinSwapFee(uint256 fee) external onlyOwner { twinSwapFee = fee; emit TwinSwapFeeSet(fee); }
    function setFreeTwinSwaps(uint256 n) external onlyOwner { freeTwinSwaps = n; }
    /// @notice Allow `a` unlimited FREE twin swaps (e.g. quantumphunks.eth for testing); doesn't consume the 67.
    function setFreeTwinAllowed(address a, bool v) external onlyOwner { freeTwinAllowed[a] = v; }

    /// @notice Open/close the pre-lottery twin window. Mutually exclusive with active spins.
    function setTwinWindow(bool open) external onlyOwner {
        if (open && lotteryActive) revert TwinWindowClosed();   // can't run the window while spins are live
        twinWindowOpen = open;
        emit TwinWindowSet(open);
    }

    /// @notice Twin claim: give V2 #id, receive the SPECIFIC v67 #id (its twin). Window-gated (spins OFF).
    ///         First `freeTwinSwaps` (67) are free, then `twinSwapFee`. The V2 locks in the Vault as 1:1 backing
    ///         for v67 #id (reclaim = its value + Vault fee). One-of-ones/Special have no twin -> rejected.
    // Reviewed: nonReentrant; EOA-only. External calls are to our own NFT/Vault (no arbitrary callback) and a
    // view ownerOf on the owner-set V2 collection. Pool/reserved updated before delivery. Not exploitable.
    // slither-disable-next-line reentrancy-eth
    function twinSwap(uint256 tokenId) external payable nonReentrant {
        if (msg.sender != tx.origin) revert OnlyEOA();
        if (!twinWindowOpen) revert TwinWindowClosed();
        if (vault == address(0)) revert VaultNotSet();
        if (v2Collection == address(0)) revert InvalidAddress();
        if (IERC721Owner(v2Collection).ownerOf(tokenId) != msg.sender) revert NotV2Owner();
        if (_poolIndexPlusOne[tokenId] == 0) revert TokenNotInPool();               // must be an available pool token
        if (nft.hasTrait(tokenId, "Special", "One of One")) revert NotTwinEligible(); // one-of-ones have no twin

        uint256 fee = 0;   // free path keeps fee = 0; only the paid branch below sets it
        bool allowed = freeTwinAllowed[msg.sender];               // always-free (testing) — never consumes the 67
        bool isFree = allowed || freeTwinSwaps > 0;
        if (isFree) { if (!allowed) { unchecked { freeTwinSwaps -= 1; } } }
        else { fee = twinSwapFee; if (msg.value < fee) revert InvalidPayment(); }

        // take #id out of the random pool so a spin can't also win it, then deliver its twin
        _removeFromPoolForOwner(tokenId);
        reserved[tokenId] = true;
        emit Reserved(tokenId, true);

        uint256 rv = _discountForToken(v2Collection, tokenId);
        IERC721Min(v2Collection).transferFrom(msg.sender, vault, tokenId);            // V2 -> Vault
        _deliver(msg.sender, tokenId);                                               // v67 #id -> claimer
        IVaultBacking(vault).recordBacking(tokenId, v2Collection, tokenId, rv == 0 ? mintPrice : rv);

        if (fee != 0) _creditTreasury(fee);
        if (msg.value > fee) _refundOrCredit(payable(msg.sender), msg.value - fee);
        emit TwinClaimed(msg.sender, tokenId, isFree, fee);
    }

    function setMaxPerWallet(uint16 value) external onlyOwner {
        maxPerWallet = value;
        emit MaxPerWalletUpdated(value);
    }

    // ─── Points (off when pointsAddress == 0) ───
    // zero is intentional: pointsAddress_ = address(0) turns points off.
    // slither-disable-next-line missing-zero-check
    function setPointsConfig(address pointsAddress_, uint256 pointsPerToken_) external onlyOwner {
        pointsAddress = pointsAddress_;
        pointsPerToken = pointsPerToken_;
        emit PointsConfigUpdated(pointsAddress_, pointsPerToken_);
    }

    // ─── Whitelist (optional gate; off by default) ───
    function setWhitelistEnabled(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
        emit WhitelistToggled(enabled);
    }
    function setWhitelist(address[] calldata accounts, bool allowed) external onlyOwner {
        for (uint256 i; i < accounts.length; ++i) {
            whitelisted[accounts[i]] = allowed;
            emit WhitelistUpdated(accounts[i], allowed);
        }
    }

    // ─── Whitelist discount (OTC addresses pay less; mint alongside everyone) ───
    function setWhitelistDiscount(uint256 discountWei) external onlyOwner {
        whitelistDiscount = discountWei;
        emit WhitelistDiscountSet(discountWei);
    }
    /// @notice "Set amount": how many tokens each whitelisted address may mint at the discount price (0 = uncapped).
    ///         e.g. cap=2 → each whitelisted holder gets 2 cheaper, then pays full price.
    function setWhitelistDiscountCap(uint16 cap) external onlyOwner {
        whitelistDiscountCap = cap;
        emit WhitelistDiscountCapSet(cap);
    }

    // ─── Hold-to-discount: hold another collection, pay less. Editable + toggleable. ───
    function setDiscountsEnabled(bool enabled) external onlyOwner {
        discountsEnabled = enabled;
        emit DiscountsEnabledSet(enabled);
    }
    /// @notice ONE global knob: wei per discount unit. Change it to rescale EVERY discount at once
    ///         (e.g. if the V2 floor doubles, double unitValue). Per-token/collection unit tiers stay put.
    function setUnitValue(uint256 weiPerUnit) external onlyOwner {
        unitValue = weiPerUnit;
        emit UnitValueSet(weiPerUnit);
    }
    function setCollectionUnits(address collection, uint16 units) external onlyOwner {
        if (collection == address(0)) revert InvalidAddress();
        collectionUnits[collection] = units;
        emit CollectionUnitsSet(collection, units);
    }
    function setCollectionUnitsBatch(address[] calldata collections, uint16[] calldata units) external onlyOwner {
        if (collections.length != units.length) revert LengthMismatch();
        for (uint256 i; i < collections.length; ++i) {
            if (collections[i] == address(0)) revert InvalidAddress();
            collectionUnits[collections[i]] = units[i];
            emit CollectionUnitsSet(collections[i], units[i]);
        }
    }

    // ─── Per-token (rare-trait) unit override: specific token IDs worth more. 0 clears -> collection default. ───
    function setTokenUnits(address collection, uint256 tokenId, uint16 units) external onlyOwner {
        if (collection == address(0)) revert InvalidAddress();
        tokenUnits[collection][tokenId] = units;
        emit TokenUnitsSet(collection, tokenId, units);
    }
    function setTokenUnitsBatch(address collection, uint256[] calldata tokenIds, uint16[] calldata units) external onlyOwner {
        if (collection == address(0)) revert InvalidAddress();
        if (tokenIds.length != units.length) revert LengthMismatch();
        for (uint256 i; i < tokenIds.length; ++i) {
            tokenUnits[collection][tokenIds[i]] = units[i];
            emit TokenUnitsSet(collection, tokenIds[i], units[i]);
        }
    }

    // ─── CARL bond routing: setters ───

    /// @notice Set the CARL bond router recipient. Address(0) is allowed (disables routing target,
    ///         same effect as carlRoutingEnabled=false, kept as a second independent safety switch).
    // slither-disable-next-line missing-zero-check
    function setCarlBondRouter(address router) external onlyOwner {
        carlBondRouter = router;
        emit CarlBondRouterSet(router);
    }

    /// @notice Adjust what share of each mint payment routes to CARL, 0-10,000 bps (0-100%).
    function setCarlRouteBps(uint16 bps) external onlyOwner {
        if (bps > BPS) revert BpsTooHigh();
        carlRouteBps = bps;
        emit CarlRouteBpsSet(bps);
    }

    /// @notice Master on/off switch. OFF => every mint credits 100% to treasury, unchanged from the
    ///         original contract's behavior, regardless of what carlRouteBps/carlBondRouter are set to.
    function setCarlRoutingEnabled(bool enabled) external onlyOwner {
        carlRoutingEnabled = enabled;
        emit CarlRoutingEnabledSet(enabled);
    }

    /// @notice Preview how a given payment would split right now, without sending anything.
    function previewCarlSplit(uint256 amount) public view returns (uint256 toTreasury, uint256 toCarl) {
        if (carlRoutingEnabled && carlBondRouter != address(0) && carlRouteBps != 0) {
            toCarl = (amount * carlRouteBps) / BPS;
        }
        toTreasury = amount - toCarl;
    }

    // Cancels a stuck Chainlink VRF request and refunds the user's MINT PAYMENT only.
    // The Chainlink VRF fee that was paid upfront in `requestMint` is NOT refunded — it has
    // already been transferred to Chainlink and is not recoverable by this contract.
    function cancelPendingMint(uint256 requestId) external onlyOwner nonReentrant {
        _refundSpin(requestId);
    }

    /// @notice Reclaim a STUCK spin's payment if the VRF callback never landed. The minter can call
    ///         this themselves after STUCK_SPIN_REFUND_DELAY blocks (owner can at any time). Deletes
    ///         the pending request, so a late callback reverts (NoPendingMint) — no double-award, and
    ///         the winning token was never chosen, so nothing is ever revealed. The prize stays in the
    ///         pool; only the ETH is returned (VRF fee already spent, not recoverable).
    function refundStuckSpin(uint256 requestId) external nonReentrant {
        if (msg.sender != owner()) {
            PendingMint memory p = pendingMints[requestId];
            if (p.player == address(0)) revert NoPendingMint();
            if (msg.sender != p.player) revert NotAuthorized();
            if (block.number <= p.requestBlock + STUCK_SPIN_REFUND_DELAY) revert TooEarly();
        }
        _refundSpin(requestId);
    }

    // The Chainlink VRF fee paid upfront is NOT refunded — it's already with Chainlink.
    // Reviewed: reached only from nonReentrant entrypoints; delete-before-process; refunds via pull ledger.
    // slither-disable-next-line reentrancy-no-eth
    function _refundSpin(uint256 requestId) internal {
        PendingMint memory pending = pendingMints[requestId];
        if (pending.player == address(0)) revert NoPendingMint();
        delete pendingMints[requestId];
        pendingVRFRequests--;
        pendingMintQuantity -= pending.quantity;
        if (lotteryMintsOf[pending.player] >= pending.quantity) lotteryMintsOf[pending.player] -= pending.quantity;
        // Return the whitelist-discount allocation this spin consumed. Without this a stuck or
        // cancelled spin permanently burned the buyer's discounted-mint allowance even though the
        // spin never happened and their ETH was returned.
        uint16 wlBack = _pendingWlDiscQty[requestId];
        if (wlBack != 0) {
            delete _pendingWlDiscQty[requestId];
            uint16 wlUsed = whitelistDiscountUsed[pending.player];
            whitelistDiscountUsed[pending.player] = wlUsed >= wlBack ? wlUsed - wlBack : 0;
        }
        // payment moves from "committed" to the player's refund pull balance
        if (totalCommittedETH >= pending.mintPayment) totalCommittedETH -= pending.mintPayment;
        else totalCommittedETH = 0;
        pendingRefunds[pending.player] += pending.mintPayment;
        totalPendingRefunds += pending.mintPayment;
        // RETURN any surrendered NFTs to the buyer — a stuck/cancelled spin never keeps their phunks.
        SurrenderedNFT[] storage list = _surrendered[requestId];
        uint256 n = list.length;
        if (n != 0) {
            for (uint256 i; i < n; ++i) {
                IERC721Min(list[i].collection).transferFrom(address(this), pending.player, list[i].tokenId);
            }
            delete _surrendered[requestId];
            emit SurrenderReturned(requestId, pending.player, n);
        }
        emit MintRequestCancelled(requestId, pending.player, pending.quantity, pending.mintPayment);
        emit RefundEscrowed(pending.player, pending.mintPayment);
    }

    function withdrawRefund() external nonReentrant {
        uint256 amount = pendingRefunds[msg.sender];
        if (amount == 0) revert InvalidPayment();
        pendingRefunds[msg.sender] = 0;
        totalPendingRefunds -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function withdrawSurplusETH(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        if (address(this).balance - totalPendingRefunds - totalCommittedETH < amount) revert InvalidPayment();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit SurplusETHWithdrawn(to, amount);
    }

    /// @notice Gas-safe self-call used by the VRF callback to AUTO-forward a won spin's surrendered NFTs to the
    ///         treasury. External only (so the callback can wrap it in try/catch); not callable by anyone else.
    function forwardSurrendered(uint256 requestId) external {
        if (msg.sender != address(this)) revert NotAuthorized();
        _forwardSurrendered(requestId);
    }

    /// @notice Owner FALLBACK: forward any WON spins' surrendered NFTs to the treasury. Normally the win
    ///         auto-forwards; this only matters for a surrender list so large it didn't fit the VRF callback
    ///         (stays flagged claimable). Anything still pending or refunded is untouched (the buyer's).
    function sweepSurrendered(uint256[] calldata requestIds) external onlyOwner nonReentrant {
        for (uint256 k; k < requestIds.length; ++k) {
            uint256 id = requestIds[k];
            if (surrenderClaimable[id]) _forwardSurrendered(id);
        }
    }

    // Route a WON spin's surrendered V2s into the Vault as 1:1 backing for the v67s just won; any EXTRA
    // surrenders (more handed over than tokens minted) go to the treasury. Reached only from nonReentrant
    // entrypoints (the VRF callback's try/catch self-call, or the owner sweep fallback).
    // slither-disable-next-line reentrancy-no-eth
    function _forwardSurrendered(uint256 requestId) internal {
        address _vault = vault;
        if (_vault == address(0)) revert VaultNotSet();
        SurrenderedNFT[] storage list = _surrendered[requestId];
        uint256[] storage won = _mintedIds[requestId];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) {
            SurrenderedNFT memory s = list[i];
            if (i < won.length) {
                // 1:1: V2 -> Vault, then back the i-th won v67 with it (reclaim price = its recorded value)
                IERC721Min(s.collection).transferFrom(address(this), _vault, s.tokenId);
                IVaultBacking(_vault).recordBacking(won[i], s.collection, s.tokenId, s.reclaimValue);
            } else {
                // extra surrender beyond the mint count -> treasury (owner asset), not backing
                IERC721Min(s.collection).transferFrom(address(this), treasury, s.tokenId);
            }
        }
        delete _surrendered[requestId];
        delete _mintedIds[requestId];
        surrenderClaimable[requestId] = false;
        emit SurrenderSwept(requestId, _vault, n);
    }

    /// @notice The NFTs currently escrowed against `requestId` (pending → returnable; won → treasury's).
    function surrenderedOf(uint256 requestId) external view returns (SurrenderedNFT[] memory) {
        return _surrendered[requestId];
    }

    function poolSize() external view returns (uint256) {
        return _activePool.length;
    }

    function poolItems(uint256 offset, uint256 limit) external view returns (uint256[] memory items) {
        uint256 end = offset + limit;
        if (end > _activePool.length) end = _activePool.length;
        if (offset >= _activePool.length) return new uint256[](0);
        items = new uint256[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            items[i - offset] = _activePool[i];
        }
    }

    function getVRFCost() external view returns (uint256) {
        if (address(vrfWrapper) == address(0)) return 0;
        return vrfWrapper.calculateRequestPriceNative(vrfCallbackGasLimit, 1);
    }

    function _reserveMint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert InvalidAddress();
        _removeFromPoolForOwner(tokenId);
        reserved[tokenId] = true;
        emit Reserved(tokenId, true);
        _deliver(to, tokenId);
    }

    function _removeFromPoolForOwner(uint256 tokenId) internal {
        uint256 indexPlusOne = _poolIndexPlusOne[tokenId];
        if (indexPlusOne == 0) return;
        if (_activePool.length - 1 < pendingMintQuantity) revert NoTokensAvailable();
        _removeFromPoolByIndex(indexPlusOne - 1);
    }

    // Deliver a pooled token to `to`: TRANSFER if the lottery holds a pre-minted prize,
    // otherwise MINT a fresh one. Lets the same pool mix pre-minted + mint-on-win prizes.
    function _deliver(address to, uint256 tokenId) internal {
        if (nft.ownerOfRaw(tokenId) == address(this)) nft.transferFromLottery(to, tokenId);
        else nft.mintFromLottery(to, tokenId);
    }

    function _removeFromPoolByIndex(uint256 index) internal {
        uint256 tokenId = _activePool[index];
        uint256 lastTokenId = _activePool[_activePool.length - 1];
        _activePool[index] = lastTokenId;
        _poolIndexPlusOne[lastTokenId] = index + 1;
        _activePool.pop();
        delete _poolIndexPlusOne[tokenId];
        emit PoolTokenRemoved(tokenId);
    }

    /// @dev Split `amount` between the CARL bond router and the treasury (per `previewCarlSplit`), and
    ///      credit each via the SAME pull-payment ledger used everywhere else in this contract. When
    ///      routing is off (default), this is byte-for-byte the original single-recipient behavior.
    // Note: mint proceeds credit the CURRENT treasury/router at fulfillment time, not whatever was set
    // when the user called requestMint. Owner should avoid rotating treasury/router while VRF requests
    // are in flight if accounting consistency matters.
    function _creditTreasury(uint256 amount) internal {
        if (amount == 0) return;
        (uint256 toTreasury, uint256 toCarl) = previewCarlSplit(amount);
        if (toTreasury != 0) {
            pendingRefunds[treasury] += toTreasury;
            totalPendingRefunds += toTreasury;
            emit TreasuryCredited(treasury, toTreasury);
        }
        if (toCarl != 0) {
            pendingRefunds[carlBondRouter] += toCarl;
            totalPendingRefunds += toCarl;
            emit CarlCredited(carlBondRouter, toCarl);
        }
    }

    function _refundOrCredit(address payable to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) {
            pendingRefunds[to] += amount;
            totalPendingRefunds += amount;
            emit RefundEscrowed(to, amount);
        }
    }

    // was [50] originally; -8 points/whitelist/discount/committed-ETH, -2 surrender escrow,
    // -2 unit pricing (unitValue+collectionUnits+tokenUnits), -3 CARL routing (router+bps+enabled)
    // ─── Whitelist-discount rollback (NEW — consumes 1 slot from __gap[35]) ───
    /// @dev Discounted tokens consumed by an IN-FLIGHT spin, so a refund can hand them back.
    ///      Kept in its own mapping rather than added to PendingMint: growing that struct would
    ///      re-lay-out every entry of `pendingMints`, and a separate mapping is append-only.
    mapping(uint256 => uint16) private _pendingWlDiscQty;

    uint256[34] private __gap;
}
