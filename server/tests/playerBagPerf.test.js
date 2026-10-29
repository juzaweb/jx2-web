import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("playerBag performance benchmark: sequential vs batched item grants", async (t) => {
  const testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "jx2-bag-perf-"));
  process.env.DB_PATH = path.join(testDataDir, "perf.sqlite");
  process.env.NODE_ENV = "test";

  const { store } = await import("../src/data/playerDb.js");
  const { grantItem, grantItems, readBag } = await import("../src/game/playerBag.js");

  t.after(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const playerId = "char_perf_test";
  const itemsToGrant = {
    "kim-sang-duoc": 10,
    "dai-hoan-dan": 10,
    "nu-nhi-hong": 10,
    "hoi-thanh-phu": 10,
    "kiem-lang-khach": 1,
    "bao-tay-lang-khach": 1,
    "dao-lang-khach": 1,
    "ao-lang-khach": 1,
    "non-lang-khach": 1,
    "quan-lang-khach": 1
  };

  const ITERATIONS = 100;

  // Measure Sequential grantItem
  const startSequential = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    for (const [id, qty] of Object.entries(itemsToGrant)) {
      grantItem(playerId, id, qty);
    }
  }
  const endSequential = performance.now();
  const sequentialTimeMs = endSequential - startSequential;

  console.log(`\n--- BENCHMARK RESULTS ---`);
  console.log(`Sequential grantItem (${ITERATIONS} batches x 10 items = 1000 DB reads/writes): ${sequentialTimeMs.toFixed(2)} ms`);

  // Reset inventory for batched test
  store.setInventory(playerId, {});

  // Measure Batched grantItems if available
  if (typeof grantItems === "function") {
    const startBatched = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      grantItems(playerId, itemsToGrant);
    }
    const endBatched = performance.now();
    const batchedTimeMs = endBatched - startBatched;
    const speedup = (sequentialTimeMs / batchedTimeMs).toFixed(2);

    console.log(`Batched grantItems (${ITERATIONS} batches x 10 items = 100 DB reads/writes): ${batchedTimeMs.toFixed(2)} ms`);
    console.log(`Speedup factor: ${speedup}x faster (${((1 - batchedTimeMs / sequentialTimeMs) * 100).toFixed(1)}% reduction in time)\n`);

    assert.ok(batchedTimeMs <= sequentialTimeMs, "Batched grantItems should be faster than sequential grantItem");
  } else {
    console.log(`grantItems is not implemented yet.\n`);
  }
});
