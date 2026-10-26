/**
 * Server side of the CCU benchmark. Forked by `ccu200Bench.js` so the synthetic
 * clients get their own event loop: measuring both in one process makes the load
 * generator steal the CPU it is supposed to be measuring.
 *
 * Speaks a tiny IPC protocol with the parent:
 *   -> { type: "reset" }        zero the counters
 *   -> { type: "stats" }        report counters since the last reset
 *   <- { type: "ready", port, roster }
 *   <- { type: "stats", ... }
 */

import http from "node:http";
import process from "node:process";

process.env.NODE_ENV = "test";

const { initGameSocket } = await import("../src/websocket/gameSocket.js");
const { store } = await import("../src/data/playerDb.js");
const { getMap } = await import("../../src/game/maps/mapRegistry.js");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};

const MAP_ID = arg("map", "dong-mon-thanh");
const TICK_MS = Number(arg("tick", 100));

/** Wrap a method to count calls and accumulate wall time. */
const instrument = (target, name) => {
  const original = target[name];
  const stat = { calls: 0, totalMs: 0, maxMs: 0 };
  target[name] = function instrumented(...args) {
    const start = process.hrtime.bigint();
    try {
      return original.apply(this, args);
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      stat.calls += 1;
      stat.totalMs += ms;
      if (ms > stat.maxMs) stat.maxMs = ms;
    }
  };
  return stat;
};

const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end();
});

const gameSocket = initGameSocket(server, {
  path: "/ws",
  enemyTickMs: TICK_MS,
  random: () => 0.5,
  verifyToken: (token) => (token === "bench-token" ? "bench_user" : null),
  ownsCharacter: () => true,
  findCharacter: (_userId, characterId) => ({
    id: characterId,
    name: characterId,
    sect: "thieu-lam",
    gender: "male"
  })
});

const tickStats = {
  tickEnemies: instrument(gameSocket, "tickEnemies"),
  tickBites: instrument(gameSocket, "tickBites"),
  tickRegen: instrument(gameSocket, "tickRegen"),
  handlePlayerMove: instrument(gameSocket, "handlePlayerMove"),
  handleEnemyHit: instrument(gameSocket, "handleEnemyHit"),
  broadcastToMap: instrument(gameSocket, "broadcastToMap")
};

const dbStats = {
  setVitals: instrument(store, "setVitals"),
  setProgress: instrument(store, "setProgress"),
  setInventory: instrument(store, "setInventory")
};

/** Event-loop lag: how late a 10 ms timer fires. */
const lag = { max: 0, sum: 0, samples: 0, last: 0 };
setInterval(() => {
  const now = Date.now();
  const drift = Math.max(0, now - lag.last - 10);
  lag.last = now;
  lag.sum += drift;
  lag.samples += 1;
  if (drift > lag.max) lag.max = drift;
}, 10).unref();
lag.last = Date.now();

const snapshot = () => ({
  type: "stats",
  players: gameSocket.players.size,
  sockets: gameSocket.wss.clients.size,
  lagAvgMs: lag.samples ? lag.sum / lag.samples : 0,
  lagMaxMs: lag.max,
  ticks: Object.fromEntries(
    Object.entries(tickStats).map(([key, stat]) => [
      key,
      { calls: stat.calls, avgMs: stat.calls ? stat.totalMs / stat.calls : 0, maxMs: stat.maxMs }
    ])
  ),
  db: Object.fromEntries(
    Object.entries(dbStats).map(([key, stat]) => [key, { calls: stat.calls, totalMs: stat.totalMs }])
  ),
  memoryMb: process.memoryUsage().rss / 1e6
});

const resetStats = () => {
  for (const stat of Object.values(tickStats)) {
    stat.calls = 0;
    stat.totalMs = 0;
    stat.maxMs = 0;
  }
  for (const stat of Object.values(dbStats)) {
    stat.calls = 0;
    stat.totalMs = 0;
  }
  lag.max = 0;
  lag.sum = 0;
  lag.samples = 0;
  lag.last = Date.now();
};

let cpuBaseline = process.cpuUsage();
let wallBaseline = Date.now();

const send = (msg) => {
  try {
    process.send(msg);
  } catch {
    // Parent already gone (benchmark finished or was interrupted).
    process.exit(0);
  }
};

process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "reset") {
    resetStats();
    cpuBaseline = process.cpuUsage();
    wallBaseline = Date.now();
    send({ type: "reset" });
    return;
  }
  if (msg.type === "stats") {
    const cpu = process.cpuUsage(cpuBaseline);
    const wallMs = Date.now() - wallBaseline;
    send({
      ...snapshot(),
      wallMs,
      cpuPct: ((cpu.user + cpu.system) / 1000 / wallMs) * 100
    });
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
send({
  type: "ready",
  port: server.address().port,
  roster: gameSocket.rosterFor(MAP_ID).size,
  spawns: getMap(MAP_ID).enemySpawns?.length || 0
});
