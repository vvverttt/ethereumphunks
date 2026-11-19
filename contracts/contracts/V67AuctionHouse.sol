// SPDX-License-Identifier: GPL-3.0

/// @title v67 Auction House
///
/// One contract runs every auction: one auction at a time, back to back, each opened in the same
/// transaction that settles the last one. Built to "v67 Auction Contract: Build Spec" (Nov 14, 2026),
/// plus a featured queue for other collections.
///
/// What runs next:
///   - the featured queue: pieces the guardian lines up by hand, from any collection the guardian has
///     approved (e.g. a small 67-piece drop), in the exact order the guardian sets, each with an
///     optional length of its own;
///   - the v67 pool: a piece drawn at random.
///   They take turns, one auction at a time: every `queueEvery`-th auction is a queue piece while the
///   queue has any (default 2 = alternate; 1 = queue pieces back to back). Newly queued pieces go next in
///   line; when either side is empty the other just keeps running.
///
/// Lineage: the settle-and-open flow, the anti-snipe reset, the capped ETH push with a WETH
/// fallback, and the pause guardian with a delayed unpause follow the Nouns-derived CypherPunks
/// auction house (0x6f99cb3d…f1B8, GPL-3.0). Additions: a guardian rescue path for stray
/// funds and pieces, a 2-day delayed payout change, a stuck-auction skip, the featured queue, and a
/// UUPS escape hatch that the owner renounces once the code is final.
///
/// Roles
///   owner    upgrades only (UUPS + Ownable2Step). Renounce removes upgrades for good.
///   guardian survives renounce; deposit, approve collections, line up / reorder / retime / pull queue
///            pieces, pause, delayed unpause, auction length, delayed payout change (lapses after 7 days),
///            rescue to the payout address, stuck-auction skip (only when a real settle attempt fails).
///            No renounce, two-step handover.
///   anyone   bid, settle-and-open, unpause once matured, withdraw a credited refund.
///
/// Randomness (pool only): block.prevrandao. Whoever calls settle can choose which block to land in, so
/// they get a few blocks of room to nudge the draw. Accepted trade (same as CypherPunks). The queue has
/// no randomness: its order is public and set by the guardian.

pragma solidity 0.8.36;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
}

contract V67AuctionHouse is UUPSUpgradeable, Ownable2StepUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------- fixed rules

    /// @notice Floor for the opening bid (and its starting value). The guardian can raise the opening bid up to
    ///         MAX_OPENING_BID with setMinOpeningBid; it can never go below this.
    uint256 public constant MIN_OPENING_BID = 0.001 ether;
    /// @notice Ceiling on the guardian's opening bid, so a typo cannot price every piece out.
    uint256 public constant MAX_OPENING_BID = 10 ether;
    /// @notice Each outbid must be at least 5% over the current top bid (rounded up).
    uint256 public constant MIN_RAISE_BPS = 500;
    /// @notice A bid in the last 10 minutes pushes the end out to 10 minutes from that bid.
    uint256 public constant TIME_BUFFER = 600;
    /// @notice Starting auction length: 1 day 16 hours 5 minutes (1.67 days).
    uint256 public constant DEFAULT_DURATION = 144_288;
    /// @notice Guardian bounds for any auction length (global or per queue piece): 1 day to 7 weeks.
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 7 weeks;
    /// @notice Delay on a payout-address change and on unpausing.
    uint256 public constant PAYOUT_DELAY = 2 days;
    uint256 public constant UNPAUSE_DELAY = 2 days;
    /// @notice How long past its end time an auction must sit unsettled before the guardian may skip it.
    uint256 public constant STUCK_WAIT = 3 days;
    /// @notice Gas forwarded on every ETH push; on failure the amount goes out as WETH instead.
    uint256 public constant ETH_SEND_GAS = 30_000;
    /// @notice A payout proposal lapses 7 days after it is made (acceptable from day 2 to day 7).
    uint256 public constant PAYOUT_PROPOSAL_TTL = 7 days;
    /// @notice Gas a skip hands to its settle attempt. A normal settle uses ~115k-180k; this is several
    ///         times that, so a settle that fails inside it is genuinely broken, not starved.
    uint256 public constant SKIP_SETTLE_GAS = 1_000_000;
    /// @notice Most pieces that can wait in the featured queue at once (keeps reorder/pull gas bounded).
    uint256 public constant MAX_QUEUE = 500;
    /// @notice Starting mix: alternate queue and v67 pieces. Guardian can set 1..MAX_QUEUE_EVERY.
    uint16 public constant DEFAULT_QUEUE_EVERY = 2;
    uint16 public constant MAX_QUEUE_EVERY = 100;

    // ----------------------------------------------------------------- storage
    // Append-only from here on. Never reorder.

    struct Auction {
        address collection; // the NFT contract of the live piece
        uint40 startTime;
        uint40 endTime;
        bool active; // true from open until settled or skipped
        bool fromQueue; // true: a featured-queue piece; false: a v67 pool piece
        uint256 tokenId;
        address bidder;
        uint96 amount;
        uint32 queueDuration; // the queue piece's own length (0 = global), kept if it goes back to the queue
        uint96 reserve; // the opening bid this auction opened with; later changes never touch it
    }

    struct QueueItem {
        address collection;
        uint32 duration; // 0 = use the global `duration` at the moment it opens
        uint256 tokenId;
    }

    /// @notice The v67 collection. The only NFT that can ever enter the random pool.
    IERC721 public nft;
    /// @notice WETH, used only when a plain ETH push fails.
    address public weth;

    /// @notice Every winning bid is pushed here at settle.
    address public payout;
    address public pendingPayout;
    uint64 public payoutReadyAt;

    address public guardian;
    address public pendingGuardian;

    /// @notice Length applied to the next pool auction (and queue pieces with no length of their own).
    ///         Never changes a live one.
    uint32 public duration;
    bool public started;
    bool public paused;
    uint64 public unpauseScheduledAt;
    uint64 public auctionCount;

    Auction internal _auction;

    uint16[] internal _pool;
    /// @notice True while the contract holds v67 `id` as a pool piece (waiting or live).
    mapping(uint256 => bool) public inPool;

    /// @notice ETH credited to a bidder by a stuck-auction skip. Withdraw with withdrawRefund().
    mapping(address => uint256) public refunds;
    uint256 public totalRefundsOwed;

    /// @notice Collections the guardian has approved for the featured queue.
    mapping(address => bool) public collectionAllowed;
    /// @notice True while the contract holds (collection, id) as a queue piece (waiting or live).
    mapping(address => mapping(uint256 => bool)) public inQueue;
    /// @dev Queue pieces in run order. Waiting pieces are _queue[_qHead .. _queue.length); entries before
    ///      _qHead have already run and are deleted. Opening a piece just moves _qHead (constant gas).
    QueueItem[] internal _queue;
    uint256 internal _qHead;
    /// @notice Mix of queue and pool: every `queueEvery`-th auction is a queue piece while the queue has any.
    ///         1 = queue pieces back to back; 2 = alternate (queue, v67, queue, v67...); 3 = every third; ...
    uint16 public queueEvery;
    /// @notice v67 pool auctions opened since the last queue piece (saturates). Starts saturated, so the first
    ///         piece ever queued goes next in line; playQueueNext() saturates it again.
    uint16 public poolSinceQueue;
    /// @notice Smallest first bid for auctions that open from now on (the live one keeps its own). No bid at or
    ///         above it = the piece goes back to the end of its line, like an auction with no bids.
    uint96 public minOpeningBid;

    uint256[34] private __gap;

    // ------------------------------------------------------------------ events

    event Deposited(uint256 indexed tokenId, address indexed from);
    event CollectionAllowed(address indexed collection, bool allowed);
    event Queued(address indexed collection, uint256 indexed tokenId, uint256 position, uint256 duration);
    event QueueMoved(address indexed collection, uint256 indexed tokenId, uint256 from, uint256 to);
    event QueueDurationSet(address indexed collection, uint256 indexed tokenId, uint256 duration);
    event QueueRemoved(address indexed collection, uint256 indexed tokenId, address to);
    event QueueReleased(address indexed collection, uint256 indexed tokenId);
    event QueueEverySet(uint256 every);
    event QueueNextForced();
    event MinOpeningBidSet(uint256 amount);
    event AuctionCreated(
        uint256 indexed auctionId, address indexed collection, uint256 indexed tokenId, uint256 startTime, uint256 endTime
    );
    event AuctionBid(
        uint256 indexed auctionId, address indexed collection, uint256 indexed tokenId, address bidder, uint256 amount, bool extended
    );
    event AuctionExtended(uint256 indexed auctionId, address indexed collection, uint256 indexed tokenId, uint256 endTime);
    event AuctionSettled(
        uint256 indexed auctionId, address indexed collection, uint256 indexed tokenId, address winner, uint256 amount
    );
    event AuctionReturnedToPool(uint256 indexed auctionId, uint256 indexed tokenId);
    event AuctionReturnedToQueue(uint256 indexed auctionId, address indexed collection, uint256 indexed tokenId);
    event AuctionSkipped(
        uint256 indexed auctionId, address indexed collection, uint256 indexed tokenId, address bidder, uint256 refunded
    );
    event Idle();
    event Paused();
    event UnpauseScheduled(uint256 executableAt);
    event UnpauseCancelled();
    event Unpaused();
    event DurationSet(uint256 seconds_);
    event PayoutProposed(address indexed newPayout, uint256 readyAt);
    event PayoutCancelled(address indexed cancelled);
    event PayoutChanged(address indexed oldPayout, address indexed newPayout);
    event GuardianTransferStarted(address indexed current, address indexed pending);
    event GuardianTransferred(address indexed oldGuardian, address indexed newGuardian);
    event RefundCredited(address indexed bidder, uint256 amount);
    event RefundWithdrawn(address indexed bidder, uint256 amount);
    event SentAsWETH(address indexed to, uint256 amount);
    event RescuedETH(address indexed to, uint256 amount);
    event RescuedERC20(address indexed token, address indexed to, uint256 amount);
    event RescuedERC721(address indexed token, uint256 indexed tokenId, address indexed to);

    // ------------------------------------------------------------------ errors

    error ZeroAddress();
    error NotGuardian();
    error NotPendingGuardian();
    error AlreadyStarted();
    error AlreadyInPool(uint256 tokenId);
    error AlreadyQueued(address collection, uint256 tokenId);
    error CollectionNotAllowed(address collection);
    error QueueFull();
    error BadPosition();
    error LengthMismatch();
    error NotReceived(address collection, uint256 tokenId);
    error TokenIdTooLarge(uint256 tokenId);
    error NotUpForAuction();
    error AuctionExpired();
    error AuctionNotOver();
    error NoLiveAuction();
    error BidTooLow(uint256 required);
    error BidTooLarge();
    error DurationOutOfRange();
    error NoPendingPayout();
    error PayoutNotReady();
    error IsPaused();
    error NotPaused();
    error UnpauseNotScheduled();
    error UnpauseNotReady();
    error NotStuck();
    error NothingToWithdraw();
    error NothingToRescue();
    error PoolPiece();
    error QueuePiece();
    error QueueEveryOutOfRange();
    error OpeningBidOutOfRange();
    error DirectSafeTransferRejected();
    error PayoutExpired();
    error NotSelf();
    error InsufficientGasForSettleAttempt();

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert NotGuardian();
        _;
    }

    // ------------------------------------------------------------------ setup

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address nft_, address weth_, address payout_, address guardian_, address owner_)
        external
        initializer
    {
        if (nft_ == address(0) || weth_ == address(0) || payout_ == address(0) || guardian_ == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        nft = IERC721(nft_);
        weth = weth_;
        payout = payout_;
        guardian = guardian_;
        duration = uint32(DEFAULT_DURATION);
        queueEvery = DEFAULT_QUEUE_EVERY;
        poolSinceQueue = type(uint16).max;
        minOpeningBid = uint96(MIN_OPENING_BID);
    }

    /// @dev Upgrades: owner only, no delay. Renounce the owner to remove them for good.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ------------------------------------------------------------------ pool

    /// @notice Add v67 pieces to the random pool. Guardian only, so nobody else can change the pool's animal
    ///         mix; works after the owner renounces. Each piece is pulled from the guardian with transferFrom,
    ///         so approve this contract on v67 first. Starts the next auction at once if the contract was idle.
    function deposit(uint256[] calldata ids) external onlyGuardian nonReentrant {
        uint256 len = ids.length;
        // Checks + effects for every id first...
        for (uint256 k; k < len; ++k) {
            uint256 id = ids[k];
            if (id > type(uint16).max) revert TokenIdTooLarge(id);
            if (inPool[id]) revert AlreadyInPool(id);
            if (inQueue[address(nft)][id]) revert AlreadyQueued(address(nft), id);
            inPool[id] = true;
            _pool.push(uint16(id));
            emit Deposited(id, msg.sender);
        }
        if (started && !paused && !_auction.active) _openNext();
        // ...then the pulls. All-or-nothing: if any pull fails the whole deposit (and any opening) reverts.
        IERC721 n = nft;
        for (uint256 k; k < len; ++k) n.transferFrom(msg.sender, address(this), ids[k]);
    }

    /// @notice Pieces must come in through deposit() / queue(). A safe transfer sent here by mistake bounces.
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        revert DirectSafeTransferRejected();
    }

    /// @notice Owner only, once. Opens auction 1 (the queue head if one is lined up, else a pool draw).
    ///         After that the chain runs itself.
    function start() external onlyOwner nonReentrant {
        if (started) revert AlreadyStarted();
        if (paused) revert IsPaused();
        started = true;
        _openNext();
    }

    // ---------------------------------------------------------- featured queue

    /// @notice Approve or un-approve a collection for the featured queue. Un-approving only stops new
    ///         pieces from being queued; pieces already queued still run.
    function setCollectionAllowed(address collection, bool allowed) external onlyGuardian {
        if (collection == address(0)) revert ZeroAddress();
        collectionAllowed[collection] = allowed;
        emit CollectionAllowed(collection, allowed);
    }

    /// @notice Line up pieces from an approved collection at the back of the featured queue, in the order
    ///         given. Queue pieces run before any v67 pool draw. `durations` is either empty (every piece uses
    ///         the global length) or one entry per piece: 0 = global length, else 1 day to 7 weeks.
    ///         Pulled from the guardian with transferFrom, so approve this contract on that collection first
    ///         (and, for a collection with an operator whitelist like v67, whitelist this contract there).
    ///         Opens the next auction at once if the contract was idle.
    // slither-disable-next-line calls-loop
    function queue(address collection, uint256[] calldata ids, uint32[] calldata durations)
        external
        onlyGuardian
        nonReentrant
    {
        if (!collectionAllowed[collection]) revert CollectionNotAllowed(collection);
        uint256 len = ids.length;
        if (durations.length != 0 && durations.length != len) revert LengthMismatch();
        if (_queue.length - _qHead + len > MAX_QUEUE) revert QueueFull();
        bool isV67 = collection == address(nft);

        for (uint256 k; k < len; ++k) {
            uint256 id = ids[k];
            uint32 d = durations.length == 0 ? 0 : durations[k];
            if (d != 0 && (d < MIN_DURATION || d > MAX_DURATION)) revert DurationOutOfRange();
            if (inQueue[collection][id]) revert AlreadyQueued(collection, id);
            if (isV67 && inPool[id]) revert AlreadyInPool(id);
            inQueue[collection][id] = true;
            _queue.push(QueueItem({collection: collection, duration: d, tokenId: id}));
            emit Queued(collection, id, _queue.length - 1 - _qHead, d);
        }
        if (started && !paused && !_auction.active) _openNext();

        IERC721 c = IERC721(collection);
        for (uint256 k; k < len; ++k) {
            c.transferFrom(msg.sender, address(this), ids[k]);
            // Belt and braces for a collection we did not write: the piece must really be here now.
            if (c.ownerOf(ids[k]) != address(this)) revert NotReceived(collection, ids[k]);
        }
    }

    /// @notice How the queue mixes with the v67 pool: every `every`-th auction is a queue piece (1 = all queue
    ///         pieces first, back to back; 2 = alternate; ...). Applies from the next auction that opens.
    /// @notice Set the smallest first bid (reserve) for auctions that open from now on: 0.001 to 10 ETH.
    ///         The live auction keeps the value it opened with.
    function setMinOpeningBid(uint256 amount) external onlyGuardian {
        if (amount < MIN_OPENING_BID || amount > MAX_OPENING_BID) revert OpeningBidOutOfRange();
        minOpeningBid = uint96(amount);
        emit MinOpeningBidSet(amount);
    }

    function setQueueEvery(uint16 every) external onlyGuardian {
        if (every == 0 || every > MAX_QUEUE_EVERY) revert QueueEveryOutOfRange();
        queueEvery = every;
        emit QueueEverySet(every);
    }

    /// @notice Make the next auction that opens the queue head (if the queue has one), whatever the mix says.
    ///         After it the normal mix resumes. Never touches the live auction.
    function playQueueNext() external onlyGuardian {
        poolSinceQueue = type(uint16).max;
        emit QueueNextForced();
    }

    /// @notice Move a waiting queue piece from position `from` to position `to` (0 = runs next). The pieces
    ///         in between shift by one. Never touches the live auction.
    function moveQueued(uint256 from, uint256 to) external onlyGuardian {
        uint256 head = _qHead;
        uint256 waiting = _queue.length - head;
        if (from >= waiting || to >= waiting) revert BadPosition();
        if (from == to) return;
        uint256 a = head + from;
        uint256 b = head + to;
        QueueItem memory item = _queue[a];
        if (a < b) {
            for (uint256 i = a; i < b; ++i) _queue[i] = _queue[i + 1];
        } else {
            for (uint256 i = a; i > b; --i) _queue[i] = _queue[i - 1];
        }
        _queue[b] = item;
        emit QueueMoved(item.collection, item.tokenId, from, to);
    }

    /// @notice Give a waiting queue piece its own length (1 day to 7 weeks), or 0 to use the global length.
    function setQueuedDuration(uint256 position, uint32 seconds_) external onlyGuardian {
        uint256 head = _qHead;
        if (position >= _queue.length - head) revert BadPosition();
        if (seconds_ != 0 && (seconds_ < MIN_DURATION || seconds_ > MAX_DURATION)) revert DurationOutOfRange();
        QueueItem storage q = _queue[head + position];
        q.duration = seconds_;
        emit QueueDurationSet(q.collection, q.tokenId, seconds_);
    }

    /// @notice Pull a waiting queue piece out before it runs. It goes to the payout address (like a rescue),
    ///         so a compromised guardian key cannot walk off with it. The pieces behind it move up one.
    function removeQueued(uint256 position) external onlyGuardian nonReentrant {
        uint256 head = _qHead;
        uint256 len = _queue.length;
        if (position >= len - head) revert BadPosition();
        QueueItem memory item = _queue[head + position];
        for (uint256 i = head + position; i + 1 < len; ++i) _queue[i] = _queue[i + 1];
        _queue.pop();
        inQueue[item.collection][item.tokenId] = false;
        address to = payout;
        emit QueueRemoved(item.collection, item.tokenId, to);
        IERC721(item.collection).transferFrom(address(this), to, item.tokenId);
    }

    // --------------------------------------------------------------- bidding

    /// @notice Bid on the live auction, naming its collection and token id (so a bid can never land on a
    ///         different piece that happens to share the id). First bid at least 0.001 ETH; each later bid at
    ///         least 5% over the top. The previous top bidder is refunded in the same transaction (as WETH if
    ///         their wallet rejects ETH).
    // Auction end and anti-snipe window are block.timestamp by design (validators can shift it by seconds, not hours).
    // slither-disable-next-line timestamp
    function createBid(address collection, uint256 tokenId) external payable nonReentrant {
        Auction memory a = _auction;
        if (!a.active || a.collection != collection || a.tokenId != tokenId) revert NotUpForAuction();
        if (block.timestamp >= a.endTime) revert AuctionExpired();
        if (msg.value > type(uint96).max) revert BidTooLarge();

        uint256 required = a.bidder == address(0)
            ? a.reserve
            : (uint256(a.amount) * (10_000 + MIN_RAISE_BPS) + 9_999) / 10_000;
        if (msg.value < required) revert BidTooLow(required);

        _auction.bidder = msg.sender;
        _auction.amount = uint96(msg.value);

        bool extended = a.endTime - block.timestamp < TIME_BUFFER;
        uint64 auctionId = auctionCount;
        emit AuctionBid(auctionId, collection, tokenId, msg.sender, msg.value, extended);
        if (extended) {
            uint40 newEnd = uint40(block.timestamp + TIME_BUFFER);
            _auction.endTime = newEnd;
            emit AuctionExtended(auctionId, collection, tokenId, newEnd);
        }

        if (a.bidder != address(0)) _push(a.bidder, a.amount);
    }

    /// @notice Settle the live auction once it has ended, then open the next one (queue first, then pool).
    ///         Permissionless. If paused or nothing is waiting, the contract goes idle instead of opening.
    function settleCurrentAndCreateNewAuction() external nonReentrant {
        _settleAndOpen();
    }

    /// @dev Settle attempt used by skipStuckAuction. Only callable by this contract (an external self-call so a
    ///      revert inside it can be caught). The caller already holds the reentrancy lock.
    function settleForSkip() external {
        if (msg.sender != address(this)) revert NotSelf();
        _settleAndOpen();
    }

    // "Auction over" is block.timestamp by design.
    // slither-disable-next-line timestamp
    function _settleAndOpen() internal {
        Auction memory a = _auction;
        if (!a.active) revert NoLiveAuction();
        if (block.timestamp < a.endTime) revert AuctionNotOver();

        _auction.active = false; // mark settled before any transfer
        uint64 auctionId = auctionCount;

        if (a.bidder == address(0)) {
            // No bids: back to the end of where it came from (inPool / inQueue stays true).
            if (a.fromQueue) {
                _queue.push(QueueItem({collection: a.collection, duration: a.queueDuration, tokenId: a.tokenId}));
                emit AuctionReturnedToQueue(auctionId, a.collection, a.tokenId);
            } else {
                _pool.push(uint16(a.tokenId));
                emit AuctionReturnedToPool(auctionId, a.tokenId);
            }
        } else {
            if (a.fromQueue) inQueue[a.collection][a.tokenId] = false;
            else inPool[a.tokenId] = false;
            // transferFrom, not safeTransferFrom, so a contract winner without a receiver hook cannot jam settle
            IERC721(a.collection).transferFrom(address(this), a.bidder, a.tokenId);
            _push(payout, a.amount);
            emit AuctionSettled(auctionId, a.collection, a.tokenId, a.bidder, a.amount);
        }

        if (!paused) _openNext();
        else emit Idle();
    }

    /// @notice Withdraw ETH credited to you by a stuck-auction skip.
    function withdrawRefund() external nonReentrant {
        uint256 amt = refunds[msg.sender];
        if (amt == 0) revert NothingToWithdraw();
        refunds[msg.sender] = 0;
        totalRefundsOwed -= amt;
        _push(msg.sender, amt);
        emit RefundWithdrawn(msg.sender, amt);
    }

    // -------------------------------------------------------------- guardian

    /// @notice Stop the next auction from opening. A live auction still takes bids and settles.
    ///         Cancels any scheduled unpause.
    // `unpauseScheduledAt != 0` is a "schedule exists" flag, not a time comparison.
    // slither-disable-next-line timestamp
    function pause() external onlyGuardian {
        if (unpauseScheduledAt != 0) {
            unpauseScheduledAt = 0;
            emit UnpauseCancelled();
        }
        if (!paused) {
            paused = true;
            emit Paused();
        }
    }

    function scheduleUnpause() external onlyGuardian {
        if (!paused) revert NotPaused();
        unpauseScheduledAt = uint64(block.timestamp);
        emit UnpauseScheduled(block.timestamp + UNPAUSE_DELAY);
    }

    /// @notice Execute a matured unpause. Permissionless: the delay is the gate. Opens the next auction if idle.
    // The 2-day timelock is block.timestamp by design.
    // slither-disable-next-line timestamp
    function unpause() external nonReentrant {
        if (!paused) revert NotPaused();
        uint256 scheduledAt = unpauseScheduledAt;
        if (scheduledAt == 0) revert UnpauseNotScheduled();
        if (block.timestamp < scheduledAt + UNPAUSE_DELAY) revert UnpauseNotReady();
        unpauseScheduledAt = 0;
        paused = false;
        emit Unpaused();
        if (started && !_auction.active) _openNext();
    }

    /// @notice Set the global auction length, 1 day to 7 weeks. Applies from the next auction; never changes a
    ///         live one. Queue pieces with their own length keep it.
    function setDuration(uint256 seconds_) external onlyGuardian {
        if (seconds_ < MIN_DURATION || seconds_ > MAX_DURATION) revert DurationOutOfRange();
        duration = uint32(seconds_);
        emit DurationSet(seconds_);
    }

    function proposePayout(address newPayout) external onlyGuardian {
        if (newPayout == address(0)) revert ZeroAddress();
        pendingPayout = newPayout;
        uint64 readyAt = uint64(block.timestamp + PAYOUT_DELAY);
        payoutReadyAt = readyAt;
        emit PayoutProposed(newPayout, readyAt);
    }

    function cancelPayout() external onlyGuardian {
        address p = pendingPayout;
        if (p == address(0)) revert NoPendingPayout();
        pendingPayout = address(0);
        payoutReadyAt = 0;
        emit PayoutCancelled(p);
    }

    // The 2-day delay and 7-day expiry are block.timestamp by design.
    // slither-disable-next-line timestamp
    function acceptPayout() external onlyGuardian {
        address p = pendingPayout;
        if (p == address(0)) revert NoPendingPayout();
        uint256 readyAt = payoutReadyAt;
        if (block.timestamp < readyAt) revert PayoutNotReady();
        // proposed at readyAt - PAYOUT_DELAY; lapses PAYOUT_PROPOSAL_TTL after that
        if (block.timestamp > readyAt - PAYOUT_DELAY + PAYOUT_PROPOSAL_TTL) revert PayoutExpired();
        emit PayoutChanged(payout, p);
        payout = p;
        pendingPayout = address(0);
        payoutReadyAt = 0;
    }

    /// @notice Two-step guardian handover. There is no renounce, so funds can always be recovered.
    function transferGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) revert ZeroAddress();
        pendingGuardian = newGuardian;
        emit GuardianTransferStarted(guardian, newGuardian);
    }

    function acceptGuardian() external {
        if (msg.sender != pendingGuardian) revert NotPendingGuardian();
        emit GuardianTransferred(guardian, msg.sender);
        guardian = msg.sender;
        pendingGuardian = address(0);
    }

    /// @notice Skip an auction that has sat unsettled for 3 days past its end. It first tries a normal settle
    ///         with SKIP_SETTLE_GAS; if that works, the auction is simply settled (the winner keeps the piece).
    ///         Only a settle that genuinely reverts is skipped: the top bidder is credited a full refund and the
    ///         next auction opens. A pool piece goes back to the pool. A queue piece is released from the queue
    ///         instead (its collection is what broke, so re-running it would just jam again); the guardian can
    ///         then rescue it to the payout address.
    // reentrancy-no-eth: the only external call is a self-call (settleForSkip, callable by this contract only)
    // made while this function holds the reentrancy lock; state is written after it on purpose, because the
    // skip must only happen if that settle attempt failed. timestamp: the 3-day wait is block.timestamp by design.
    // slither-disable-next-line reentrancy-no-eth,timestamp
    function skipStuckAuction() external onlyGuardian nonReentrant {
        Auction memory a = _auction;
        if (!a.active) revert NoLiveAuction();
        if (block.timestamp < uint256(a.endTime) + STUCK_WAIT) revert NotStuck();

        // Gas floor: the attempt must receive the full SKIP_SETTLE_GAS (EIP-150 keeps 1/64 back, so
        // require 64/63 of it plus headroom for the skip path). Otherwise the guardian could starve the
        // attempt, make it fail, and skip an auction that would have settled.
        if (gasleft() < (SKIP_SETTLE_GAS * 64) / 63 + 100_000) revert InsufficientGasForSettleAttempt();
        try this.settleForSkip{gas: SKIP_SETTLE_GAS}() {
            return; // it settled normally
        } catch {}

        _auction.active = false;
        if (a.bidder != address(0)) {
            refunds[a.bidder] += a.amount;
            totalRefundsOwed += a.amount;
            emit RefundCredited(a.bidder, a.amount);
        }
        if (a.fromQueue) {
            inQueue[a.collection][a.tokenId] = false;
            emit QueueReleased(a.collection, a.tokenId);
        } else {
            _pool.push(uint16(a.tokenId));
        }
        emit AuctionSkipped(auctionCount, a.collection, a.tokenId, a.bidder, a.amount);

        if (!paused) _openNext();
        else emit Idle();
    }

    /// @notice Send ETH above what the contract owes (the live top bid plus credited refunds) to the payout address.
    function rescueETH() external onlyGuardian nonReentrant {
        uint256 owed = totalRefundsOwed + (_auction.active ? _auction.amount : 0);
        uint256 bal = address(this).balance;
        if (bal <= owed) revert NothingToRescue();
        uint256 extra = bal - owed;
        _push(payout, extra);
        emit RescuedETH(payout, extra);
    }

    /// @notice Send any ERC-20 held here to the payout address. The contract never owes anyone a token.
    function rescueERC20(address token, uint256 amount) external onlyGuardian nonReentrant {
        IERC20(token).safeTransfer(payout, amount);
        emit RescuedERC20(token, payout, amount);
    }

    /// @notice Send a stray NFT to the payout address: anything that is not a pool or queue piece (moved in by
    ///         plain transfer instead of deposit/queue, or released by a skip). Pool, queue and live pieces
    ///         cannot be taken.
    function rescueERC721(address token, uint256 tokenId) external onlyGuardian nonReentrant {
        if (token == address(nft) && inPool[tokenId]) revert PoolPiece();
        if (inQueue[token][tokenId]) revert QueuePiece();
        IERC721(token).transferFrom(address(this), payout, tokenId);
        emit RescuedERC721(token, tokenId, payout);
    }

    // ------------------------------------------------------------------ views

    function currentAuction()
        external
        view
        returns (
            address collection,
            uint256 tokenId,
            uint256 amount,
            address bidder,
            uint256 startTime,
            uint256 endTime,
            bool settled,
            bool fromQueue
        )
    {
        Auction memory a = _auction;
        return (a.collection, a.tokenId, a.amount, a.bidder, a.startTime, a.endTime, !a.active, a.fromQueue);
    }

    /// @notice Pieces waiting in the pool (the live piece is not counted).
    function poolSize() external view returns (uint256) {
        return _pool.length;
    }

    // False positive: these compare array indexes, not times (Slither taints _pool via _openNext).
    // slither-disable-next-line timestamp
    function poolIds(uint256 startIdx, uint256 count) external view returns (uint256[] memory ids) {
        uint256 len = _pool.length;
        if (startIdx >= len) return new uint256[](0);
        uint256 end = count > len - startIdx ? len : startIdx + count; // no overflow on a huge count

        ids = new uint256[](end - startIdx);
        for (uint256 i = startIdx; i < end; ++i) ids[i - startIdx] = _pool[i];
    }

    /// @notice Pieces waiting in the featured queue (the live piece is not counted).
    function queueSize() external view returns (uint256) {
        return _queue.length - _qHead;
    }

    /// @notice Waiting queue pieces in run order, from position `startIdx` (0 = runs next).
    ///         `durations` holds each piece's own length (0 = global length).
    // False positive: these compare array indexes, not times.
    // slither-disable-next-line timestamp
    function queueItems(uint256 startIdx, uint256 count)
        external
        view
        returns (address[] memory collections, uint256[] memory ids, uint256[] memory durations)
    {
        uint256 head = _qHead;
        uint256 len = _queue.length - head;
        if (startIdx >= len) return (new address[](0), new uint256[](0), new uint256[](0));
        uint256 end = count > len - startIdx ? len : startIdx + count;
        uint256 n = end - startIdx;
        collections = new address[](n);
        ids = new uint256[](n);
        durations = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            QueueItem memory q = _queue[head + startIdx + i];
            collections[i] = q.collection;
            ids[i] = q.tokenId;
            durations[i] = q.duration;
        }
    }

    /// @notice Smallest bid that would be accepted right now (0 if nothing is live).
    // False positive: `bidder == address(0)` is an address check, not a time comparison.
    // slither-disable-next-line timestamp
    function minNextBid() external view returns (uint256) {
        Auction memory a = _auction;
        if (!a.active) return 0;
        if (a.bidder == address(0)) return a.reserve;
        return (uint256(a.amount) * (10_000 + MIN_RAISE_BPS) + 9_999) / 10_000;
    }

    // -------------------------------------------------------------- internals

    /// @dev Open the next auction: the featured-queue head when the mix says so (or the pool is empty), else a
    ///      uniform draw from the v67 pool (swap-with-last, constant gas). Idles when both are empty.
    // False positives: `n == 0` / `qlen == 0` are empty-array checks (not balance/time equalities).
    // slither-disable-next-line timestamp,incorrect-equality
    function _openNext() internal {
        uint256 head = _qHead;
        uint256 qlen = _queue.length - head;
        uint256 n = _pool.length;
        if (qlen == 0 && n == 0) {
            emit Idle();
            return;
        }
        uint64 auctionId = auctionCount + 1;
        address collection;
        uint256 id;
        uint256 len = duration;
        uint32 ownDuration = 0;
        // Queue piece if one is waiting and either the pool is empty or enough pool auctions ran since the last one.
        uint16 since = poolSinceQueue;
        bool fromQueue = qlen != 0 && (n == 0 || uint256(since) + 1 >= queueEvery);

        if (fromQueue) {
            QueueItem memory q = _queue[head];
            delete _queue[head]; // gas refund; the slot is behind the head now
            _qHead = head + 1;
            poolSinceQueue = 0;
            collection = q.collection;
            id = q.tokenId;
            ownDuration = q.duration;
            if (ownDuration != 0) len = ownDuration;
        } else {
            // Accepted by the spec: prevrandao lets the settle caller pick among a few blocks to nudge the draw
            // (same trade as CypherPunks). Every piece still clears a public auction, so nothing mints cheap.
            // slither-disable-next-line weak-prng
            uint256 i = uint256(keccak256(abi.encode(block.prevrandao, address(this), auctionId, n))) % n;
            id = _pool[i];
            _pool[i] = _pool[n - 1];
            _pool.pop();
            collection = address(nft);
            if (since != type(uint16).max) poolSinceQueue = since + 1;
        }

        auctionCount = auctionId;
        uint40 startTime = uint40(block.timestamp);
        uint40 endTime = uint40(block.timestamp + len);
        _auction = Auction({
            collection: collection,
            startTime: startTime,
            endTime: endTime,
            active: true,
            fromQueue: fromQueue,
            tokenId: id,
            bidder: address(0),
            amount: 0,
            queueDuration: ownDuration,
            reserve: minOpeningBid
        });
        emit AuctionCreated(auctionId, collection, id, startTime, endTime);
    }

    /// @dev Push ETH with a 30k gas cap, ignoring return data. If it fails, wrap and send WETH instead,
    ///      so a recipient that rejects ETH can never block a bid or a settle.
    function _push(address to, uint256 amount) internal {
        bool ok;
        assembly {
            ok := call(ETH_SEND_GAS, to, amount, 0, 0, 0, 0)
        }
        if (!ok) {
            IWETH(weth).deposit{value: amount}();
            IERC20(weth).safeTransfer(to, amount);
            emit SentAsWETH(to, amount);
        }
    }
}
