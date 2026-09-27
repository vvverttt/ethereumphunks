// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { PhilipLotteryV67CarlLaunch } from "../contracts/PhilipLotteryV67_CarlLaunch.sol";

/// @notice LIVE-PROXY FORK REHEARSAL — the single riskiest tx of the launch: upgrading the deployed lottery
///         proxy 0x7028 to PhilipLotteryV67CarlLaunch. Proves, against REAL mainnet state, that the upgrade
///         preserves live storage byte-for-byte and that the new vars occupy fresh (zero) gap space.
contract LotteryUpgradeForkTest is Test {
    address constant LOTTERY = 0x702862d4cb2E55452170814AAb9117cDE8287e61;
    address constant OWNER = 0x19d57A31b982d3d75c16358795A4D19c803e4A72;

    PhilipLotteryV67CarlLaunch lot;

    function setUp() public {
        vm.createSelectFork("https://ethereum-rpc.publicnode.com");
        lot = PhilipLotteryV67CarlLaunch(payable(LOTTERY));
    }

    function test_liveUpgradePreservesStorageAndConfigures() public {
        // ── snapshot the REAL live state (all in slots 0-33) ──
        uint256 mintPrice0 = lot.mintPrice();
        uint8 maxBatch0 = lot.maxBatchSize();
        uint16 maxWallet0 = lot.maxPerWallet();
        address treasury0 = lot.treasury();
        bool active0 = lot.lotteryActive();
        uint256 pool0 = lot.poolSize();
        bool discEnabled0 = lot.discountsEnabled();
        address v2coll0 = lot.v2Collection();
        address vault0 = lot.vault();
        uint256 committed0 = lot.totalCommittedETH();
        uint256 pendingVRF0 = lot.pendingVRFRequests();
        uint256 unit0 = lot.unitValue();
        // sanity: we really are on the live, configured contract
        assertEq(mintPrice0, 0.0967 ether, "live mint price");
        // Don't hardcode the live pool: it grew from 4,250 to 5,331 when the final 1,081
        // were added. What this test actually cares about is that the upgrade PRESERVES
        // whatever the pool is, which the assertion further down checks.
        assertGt(pool0, 0, "live pool is non-empty");
        assertEq(treasury0, OWNER, "live treasury");

        // ── THE riskiest tx: upgrade the LIVE proxy (prank the real owner) ──
        PhilipLotteryV67CarlLaunch newImpl = new PhilipLotteryV67CarlLaunch();
        vm.prank(OWNER);
        UUPSUpgradeable(LOTTERY).upgradeToAndCall(address(newImpl), "");

        // ── every snapshot reads back BYTE-IDENTICAL ──
        assertEq(lot.mintPrice(), mintPrice0, "mintPrice preserved");
        assertEq(lot.maxBatchSize(), maxBatch0, "maxBatchSize preserved");
        assertEq(lot.maxPerWallet(), maxWallet0, "maxPerWallet preserved");
        assertEq(lot.treasury(), treasury0, "treasury preserved");
        assertEq(lot.lotteryActive(), active0, "lotteryActive preserved");
        assertEq(lot.poolSize(), pool0, "pool size preserved across the upgrade");
        assertEq(lot.discountsEnabled(), discEnabled0, "discountsEnabled preserved");
        assertEq(lot.v2Collection(), v2coll0, "v2Collection preserved");
        assertEq(lot.vault(), vault0, "vault preserved");
        assertEq(lot.totalCommittedETH(), committed0, "committed ETH preserved");
        assertEq(lot.pendingVRFRequests(), pendingVRF0, "pendingVRF preserved");
        assertEq(lot.unitValue(), unit0, "unitValue preserved");

        // ── new storage reads zero (fresh gap space — no collision with live state) ──
        assertEq(lot.carlPhunkIn(), address(0), "new: carlPhunkIn zero");
        assertFalse(lot.pairingEnabled(v2coll0), "new: pairingEnabled zero");
        assertEq(lot.lpEscrow(), address(0), "new: lpEscrow zero");
        assertEq(lot.lpEscrowRouted(), 0, "new: lpEscrowRouted zero");
        assertEq(lot.discountLockCap(), 0, "new: discountLockCap zero");
        assertEq(lot.freeSpinsUsed(), 0, "new: freeSpinsUsed zero");
        assertFalse(lot.reservedTurtle(1234), "new: reservedTurtle zero");

        // ── the new CARL-launch dials configure correctly on the LIVE proxy ──
        vm.startPrank(OWNER);
        lot.setLpRouting(address(0x1E5C), 41.3 ether);
        lot.setDiscountLockCap(670);
        lot.setFreeSpinConfig(67);
        lot.setMaxPerWallet(16);
        uint256[] memory r = new uint256[](2); r[0] = 1234; r[1] = 5678;
        lot.setReservedTurtles(r, true);
        vm.stopPrank();
        assertEq(lot.lpEscrowTarget(), 41.3 ether, "lpEscrowTarget set");
        assertEq(lot.discountLockCap(), 670, "discountLockCap 670");
        assertEq(lot.freeSpinCap(), 67, "freeSpinCap 67");
        assertEq(lot.maxPerWallet(), 16, "maxPerWallet -> 16");
        assertTrue(lot.reservedTurtle(1234) && lot.reservedTurtle(5678), "reserved 16 config");
    }
}
