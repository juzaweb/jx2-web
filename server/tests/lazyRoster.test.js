import test from "node:test";
import assert from "node:assert/strict";
import { GameSocketManager, SpatialGrid } from "../src/websocket/gameSocket.js";

/**
 * Bare manager with only the roster collaborators, so lazy construction can be
 * checked without opening a WebSocket server or starting timers. Mirrors the
 * constructor: the default map starts with an empty roster, every other map is
 * absent until someone asks for it.
 */
function makeManager() {
  const manager = Object.create(GameSocketManager.prototype);
  manager.enemiesEnabled = true;
  manager.enemyByMap = new Map();
  manager.enemyGridByMap = new Map();
  manager.enemies = new Map();
  manager.enemyGrid = new SpatialGrid(1000);
  manager.enemyByMap.set("market", manager.enemies);
  manager.enemyGridByMap.set("market", manager.enemyGrid);
  return manager;
}

test("a hunting roster is built on first use, not at boot", () => {
  const manager = makeManager();

  assert.equal(manager.enemyByMap.size, 1, "only the empty default map exists");

  const roster = manager.rosterFor("ba-thuc");

  assert.equal(roster.size, 90, "the ground's authored spawns are loaded");
  assert.equal(manager.enemyByMap.get("ba-thuc"), roster, "the roster is cached");
  assert.equal(manager.enemyByMap.size, 2, "the other eight grounds stay cold");
});

test("asking twice reuses the same roster and grid", () => {
  const manager = makeManager();

  const first = manager.rosterFor("quan-trung");
  const second = manager.rosterFor("quan-trung");

  assert.equal(first, second);
  assert.equal(manager.enemyByMap.size, 2);
  assert.ok(manager.enemyGridByMap.get("quan-trung"));
});

test("an unknown map id falls back to the default map", () => {
  const manager = makeManager();

  manager.rosterFor("atlantis");

  assert.equal(manager.enemyByMap.has("market"), true);
  assert.equal(manager.enemyByMap.has("atlantis"), false);
});