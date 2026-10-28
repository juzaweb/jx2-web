import { GameSocketManager } from "../src/websocket/gameSocket.js";

const manager = Object.create(GameSocketManager.prototype);

const playerNoBuffs = {
  id: "test-player-1",
  level: 10,
  equipment: { weapon: "kiem-lang-khach", armor: "ao-vai" },
  buffs: []
};

const playerWithBuffs = {
  id: "test-player-2",
  level: 10,
  equipment: { weapon: "kiem-lang-khach", armor: "ao-vai" },
  buffs: [
    { stat: "attackPct", amount: 0.2, until: Date.now() + 60000 },
    { stat: "critRate", amount: 0.1, until: Date.now() + 120000 }
  ]
};

const ITERATIONS = 1_000_000;

console.log("--- Running effectiveStats Benchmark ---");

// Test 1: Player without buffs (movement ticks)
const startNoBuffs = performance.now();
let now = Date.now();
for (let i = 0; i < ITERATIONS; i++) {
  // Simulate ticks advancing by 50ms
  now += 50;
  manager.effectiveStats(playerNoBuffs, now);
}
const endNoBuffs = performance.now();
const timeNoBuffs = endNoBuffs - startNoBuffs;
console.log(`No Buffs (${ITERATIONS.toLocaleString()} calls): ${timeNoBuffs.toFixed(2)} ms (${(timeNoBuffs / ITERATIONS * 1000).toFixed(4)} us/call)`);

// Test 2: Player with active buffs (movement ticks)
const startWithBuffs = performance.now();
now = Date.now();
for (let i = 0; i < ITERATIONS; i++) {
  now += 50;
  manager.effectiveStats(playerWithBuffs, now);
}
const endWithBuffs = performance.now();
const timeWithBuffs = endWithBuffs - startWithBuffs;
console.log(`With Buffs (${ITERATIONS.toLocaleString()} calls): ${timeWithBuffs.toFixed(2)} ms (${(timeWithBuffs / ITERATIONS * 1000).toFixed(4)} us/call)`);
