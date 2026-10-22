import http from "node:http";
import { GameSocketManager } from "../server/src/websocket/gameSocket.js";
import { BITE_TUNING } from "../src/game/enemyAi.js";

// Setup dummy HTTP server & GameSocketManager instance
const dummyServer = http.createServer();
const gameSocket = new GameSocketManager(dummyServer, {
  enemyRespawnMs: 1000,
  enemyTickMs: 100,
  enemySpawns: []
});

// Mock damage application to avoid side effects
gameSocket.applyPlayerDamage = (target) => {
  target.hp = Math.max(0, target.hp - 10);
};

// Populate wolves across the map
const wolfCount = 100;
gameSocket.enemies.clear();
for (let i = 0; i < wolfCount; i++) {
  gameSocket.enemies.set(i, {
    id: i,
    x: (i % 10) * 1000 + 500,
    y: Math.floor(i / 10) * 1000 + 500,
    isDead: false
  });
}

// Populate players: 500 players scattered
const playerCount = 500;
const players = [];
for (let i = 0; i < playerCount; i++) {
  players.push({
    id: `player_${i}`,
    x: (i % 25) * 400 + 200,
    y: Math.floor(i / 25) * 400 + 200,
    nextBiteAt: 0,
    invulnerableUntil: 0,
    defense: 6
  });
}

// Benchmark scenarios:
// Scenario 1: All players eligible (worst case)
// Scenario 2: 80% players ineligible (on cooldown / invulnerable)

function runBench(name, setupPlayersFn, iterations = 5000) {
  // Warmup
  for (let i = 0; i < 500; i++) {
    setupPlayersFn(i);
    gameSocket.tickBites(players);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    setupPlayersFn(i);
    gameSocket.tickBites(players);
  }
  const totalMs = performance.now() - start;
  const avgUs = (totalMs / iterations) * 1000;
  console.log(`[${name}] Total: ${totalMs.toFixed(2)} ms | Avg: ${avgUs.toFixed(2)} µs/op`);
  return avgUs;
}

console.log("--- Benchmark tickBites Baseline ---");
runBench("Scenario 1: 500 players, 100 wolves (all eligible)", (i) => {
  const now = Date.now();
  players.forEach((p) => {
    p.nextBiteAt = 0;
    p.invulnerableUntil = 0;
  });
});

runBench("Scenario 2: 500 players, 100 wolves (80% ineligible due to cooldown)", (i) => {
  const now = Date.now();
  players.forEach((p, idx) => {
    if (idx % 5 === 0) {
      p.nextBiteAt = 0;
      p.invulnerableUntil = 0;
    } else {
      p.nextBiteAt = now + 10000;
      p.invulnerableUntil = now + 10000;
    }
  });
});

gameSocket.close();
