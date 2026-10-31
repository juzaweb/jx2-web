## 2025-05-18 - Distance Calculations and Single-Pass Proximity Searches
**Learning:** High-frequency targeting functions (`nearestEnemyInReach`, `nearestEnemyTarget`, `pickAutoTarget`) previously used `filter().sort()` chaining with `Phaser.Math.Distance.Between` / `Math.hypot`, resulting in $O(N \log N)$ sorting passes, repeated square root calls, and intermediate array allocations.
**Action:** Replace `filter().sort()` with single-pass $O(N)$ linear scans using squared distances ($dx^2 + dy^2$) for nearest-entity queries.

## 2026-10-31 - Avoiding getAlive() Array Allocations in High-Frequency Pointer & Targeting Loops
**Learning:** `EnemyManager.getAlive()` allocates a fresh array via `.filter()` on every invocation. Calling it inside per-frame or high-frequency input handlers (`pointermove` hover cursor updates, combat attacks, `findPendingTarget`) generated unnecessary GC garbage and repeated allocations even though target checkers (`findEnemyAt`, range loops) already perform in-loop liveness checks (`!enemy || enemy.isDead || enemy.active === false`).
**Action:** In high-frequency hot paths, iterate over `enemyManager.getAll()` directly and filter inline, or use `enemyManager.getById()` for target ID lookups instead of allocating filtered intermediate arrays.
