## 2025-05-18 - Distance Calculations and Single-Pass Proximity Searches
**Learning:** High-frequency targeting functions (`nearestEnemyInReach`, `nearestEnemyTarget`, `pickAutoTarget`) previously used `filter().sort()` chaining with `Phaser.Math.Distance.Between` / `Math.hypot`, resulting in $O(N \log N)$ sorting passes, repeated square root calls, and intermediate array allocations.
**Action:** Replace `filter().sort()` with single-pass $O(N)$ linear scans using squared distances ($dx^2 + dy^2$) for nearest-entity queries.
