## 2025-05-18 - [Enemy AI Distance Calculation Optimization]
**Learning:** `nearestPlayerInRange` in `src/game/enemyAi.js` is executed for every living enemy on every AI tick (10 Hz) on server and per-frame in offline client. Replacing `.forEach` and `Math.hypot` with bounding box pre-checks (`Math.abs(dx) < aggroRange`) and squared distance comparison yielded an ~8.5x execution speedup (100k calls dropped from ~747ms to ~87ms).
**Action:** Always prefer bounding-box pre-checks and squared distance comparisons (`dx*dx + dy*dy < radiusSq`) in high-frequency game loop spatial queries.
