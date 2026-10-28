import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { performance } from "node:perf_hooks";

// Initialize temporary DB before importing playerBag
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "grant-bench-"));
process.env.DB_PATH = path.join(testDir, "bench.sqlite");

const { grantItem, grantItems, readBag } = await import("../src/game/playerBag.js");

const TEST_PLAYER_ID = "bench_player_1";
const ITEMS = [
  { itemId: "kiem-lang-khach", amount: 1 },
  { itemId: "ao-lang-khach", amount: 1 },
  { itemId: "kim-sang-duoc", amount: 5 }
];

console.log("=== Grant Items Benchmark ===");

const ITERATIONS = 2000;

// Benchmark 1: Sequential grantItem in loop (N DB operations per kill)
const startSeq = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  for (const item of ITEMS) {
    grantItem(TEST_PLAYER_ID, item.itemId, item.amount);
  }
}
const endSeq = performance.now();
const seqDuration = endSeq - startSeq;
console.log(`Sequential grantItem (${ITERATIONS} iterations x ${ITEMS.length} items): ${seqDuration.toFixed(2)} ms`);
console.log(`Ops/sec: ${((ITERATIONS * ITEMS.length) / (seqDuration / 1000)).toFixed(2)} items/sec`);

// Benchmark 2: Batch grantItems (1 DB operation per kill)
if (typeof grantItems === "function") {
  const startBatch = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    grantItems(TEST_PLAYER_ID, ITEMS);
  }
  const endBatch = performance.now();
  const batchDuration = endBatch - startBatch;
  console.log(`Batch grantItems (${ITERATIONS} iterations x ${ITEMS.length} items): ${batchDuration.toFixed(2)} ms`);
  console.log(`Ops/sec: ${((ITERATIONS * ITEMS.length) / (batchDuration / 1000)).toFixed(2)} items/sec`);
  console.log(`Speedup: ${(seqDuration / batchDuration).toFixed(2)}x faster`);
}

// Cleanup
fs.rmSync(testDir, { recursive: true, force: true });
