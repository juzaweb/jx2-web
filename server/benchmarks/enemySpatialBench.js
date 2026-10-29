import { Bench } from "tinybench";
import { BITE_TUNING } from "../../src/game/enemyAi.js";
import { SpatialGrid, GRID_CELL_SIZE } from "../src/websocket/gameSocket.js";

// Linear getNearEnemies implementation
function linearGetNearEnemies(x, y, radius, enemies) {
  const radiusSq = radius * radius;
  const result = [];
  enemies.forEach((enemy) => {
    if (enemy.isDead) return;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    if (dx * dx + dy * dy <= radiusSq) {
      result.push(enemy);
    }
  });
  return result;
}

// Spatial getNearEnemies implementation
function spatialGetNearEnemies(x, y, radius, grid) {
  return grid.getNear(x, y, radius).filter((enemy) => !enemy.isDead);
}

// Linear tickBites implementation
function linearTickBites(players, enemies, biteRangeSq) {
  let bitCount = 0;
  players.forEach((player) => {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    enemies.forEach((wolf) => {
      if (wolf.isDead) return;
      const dx = wolf.x - player.x;
      const dy = wolf.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < biteRangeSq && distSq < nearestDistanceSq) {
        nearest = wolf;
        nearestDistanceSq = distSq;
      }
    });
    if (nearest) bitCount++;
  });
  return bitCount;
}

// Spatial grid tickBites implementation
function spatialTickBites(players, spatialGrid, biteRange) {
  let bitCount = 0;
  const biteRangeSq = biteRange * biteRange;
  players.forEach((player) => {
    const candidates = spatialGrid.getNear(player.x, player.y, biteRange);
    let nearest = null;
    let nearestDistanceSq = biteRangeSq;
    for (let i = 0; i < candidates.length; i++) {
      const wolf = candidates[i];
      if (wolf.isDead) continue;
      const dx = wolf.x - player.x;
      const dy = wolf.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistanceSq) {
        nearest = wolf;
        nearestDistanceSq = distSq;
      }
    }
    if (nearest) bitCount++;
  });
  return bitCount;
}

// Generate benchmark world data
function createBenchmarkWorld(numPlayers, numEnemies, worldWidth = 32000, worldHeight = 32000) {
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: `p_${i}`,
      x: Math.random() * worldWidth,
      y: Math.random() * worldHeight,
      nextBiteAt: 0,
      invulnerableUntil: 0
    });
  }

  const enemies = [];
  const grid = new SpatialGrid(GRID_CELL_SIZE);
  for (let i = 0; i < numEnemies; i++) {
    const enemy = {
      id: i,
      x: Math.random() * worldWidth,
      y: Math.random() * worldHeight,
      isDead: i % 10 === 0 // 10% dead
    };
    enemies.push(enemy);
    if (!enemy.isDead) {
      grid.add(enemy);
    }
  }

  return { players, enemies, grid };
}

async function runBenchmark() {
  const bench = new Bench({ time: 1000 });
  const biteRange = BITE_TUNING.range;
  const biteRangeSq = biteRange * biteRange;
  const aoiRadius = 800;

  // Scenario 1: Medium map (100 players, 500 enemies)
  const world1 = createBenchmarkWorld(100, 500);

  // Scenario 2: Large map (200 players, 2000 enemies)
  const world2 = createBenchmarkWorld(200, 2000);

  bench
    .add("Linear nearEnemies query (2000 enemies)", () => {
      linearGetNearEnemies(16000, 16000, aoiRadius, world2.enemies);
    })
    .add("Spatial nearEnemies query (2000 enemies)", () => {
      spatialGetNearEnemies(16000, 16000, aoiRadius, world2.grid);
    })
    .add("Linear tickBites (100 players, 500 enemies)", () => {
      linearTickBites(world1.players, world1.enemies, biteRangeSq);
    })
    .add("Spatial tickBites (100 players, 500 enemies)", () => {
      spatialTickBites(world1.players, world1.grid, biteRange);
    })
    .add("Linear tickBites (200 players, 2000 enemies)", () => {
      linearTickBites(world2.players, world2.enemies, biteRangeSq);
    })
    .add("Spatial tickBites (200 players, 2000 enemies)", () => {
      spatialTickBites(world2.players, world2.grid, biteRange);
    });

  await bench.run();

  console.log("=== BENCHMARK COMPARISON RESULTS ===");
  console.table(bench.table());
}

runBenchmark();
