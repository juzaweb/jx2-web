/**
 * End-to-end capacity benchmark for the game socket: N concurrent players
 * hunting on one map, driven from a SEPARATE process so the load generator does
 * not steal the CPU it is measuring (see `ccuBenchServer.js`).
 *
 * Client behaviour mirrors the browser client:
 *   - one `player_move` every 50 ms while walking (src/game/game.js:1698)
 *   - one `player_attack` + follow-up `enemy_hit` per second inside melee reach
 *
 * Usage:
 *   node benchmarks/ccu200Bench.js
 *   node benchmarks/ccu200Bench.js --players 400 --seconds 20
 *   node benchmarks/ccu200Bench.js --no-combat
 *   node benchmarks/ccu200Bench.js --move-hz 10     # what a 10 Hz client costs
 */

import { fork } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const here = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = (name) => argv.includes(`--${name}`);

const PLAYERS = Number(arg("players", 200));
const SECONDS = Number(arg("seconds", 15));
const WARMUP_MS = Number(arg("warmup", 3000));
const rawMoveHz = Number(arg("move-hz", 20));
const MOVE_HZ = Number.isFinite(rawMoveHz) && rawMoveHz > 0 ? rawMoveHz : 20;
const MOVE_INTERVAL_MS = Math.round(1000 / MOVE_HZ);
const ATTACK_INTERVAL_MS = Number(arg("attack-ms", 1000));
const TICK_MS = Number(arg("tick", 100));
const MAP_ID = arg("map", "dong-mon-thanh");
const COMBAT = !flag("no-combat");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const { getMap } = await import("../../src/game/maps/mapRegistry.js");
const { MELEE_REACH } = await import("../../src/game/combatRules.js");

// --- Server child -------------------------------------------------------------

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "jx2-ccu-bench-"));
const child = fork(path.join(here, "ccuBenchServer.js"), [`--map=${MAP_ID}`, `--tick=${TICK_MS}`], {
  env: { ...process.env, DB_PATH: path.join(dataDir, "bench.sqlite"), NODE_ENV: "test" },
  stdio: ["ignore", "ignore", "inherit", "ipc"]
});

const pending = new Map();
let readyInfo = null;
let childExited = false;
child.on("message", (msg) => {
  if (msg?.type === "ready") {
    readyInfo = msg;
    const resolve = pending.get("ready");
    if (resolve) resolve(msg);
    return;
  }
  const resolve = pending.get(msg?.type);
  if (resolve) {
    pending.delete(msg.type);
    resolve(msg);
  }
});
child.on("exit", (code, signal) => {
  childExited = true;
  if (!readyInfo || code !== 0) {
    console.error(`[bench] server child exited early (code=${code}, signal=${signal})`);
  }
  // Unblock any pending ask so the parent never hangs on a dead server.
  for (const [, resolve] of pending) resolve({ type: "stats", players: 0, ticks: {}, db: {} });
  pending.clear();
});

const ask = (type) =>
  new Promise((resolve) => {
    if (childExited) return resolve({ type });
    pending.set(type, resolve);
    child.send({ type });
  });

const ready = await new Promise((resolve) => {
  if (readyInfo) return resolve(readyInfo);
  pending.set("ready", resolve);
});
const url = `ws://127.0.0.1:${ready.port}/ws`;

// --- Synthetic clients --------------------------------------------------------

class BenchClient {
  constructor(index, spawn) {
    this.index = index;
    this.characterId = `bench_char_${index}`;
    this.x = spawn.x;
    this.y = spawn.y;
    this.spawnX = spawn.x;
    this.spawnY = spawn.y;
    this.angle = Math.random() * Math.PI * 2;
    this.inMessages = 0;
    this.inBytes = 0;
    this.outMessages = 0;
    this.outBytes = 0;
    this.enemies = [];
    this.target = null;
    this.timers = [];
    this.ws = new WebSocket(url, { perMessageDeflate: false });
    this.ws.on("message", (raw) => {
      this.inMessages += 1;
      this.inBytes += raw.length;
      // Only the first big frame (init_world) is parsed; the rest is counted raw.
      if (this.enemies.length === 0) {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "init_world") {
            this.enemies = msg.payload.enemies || [];
            this.pickTarget();
          }
        } catch {
          // ignore
        }
      }
    });
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
    this.send({
      type: "player_join",
      payload: { token: "bench-token", characterId: this.characterId, x: this.x, y: this.y }
    });
  }

  pickTarget() {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    this.target = best;
  }

  send(message) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify(message);
    this.outMessages += 1;
    this.outBytes += Buffer.byteLength(payload);
    this.ws.send(payload);
  }

  start() {
    this.timers.push(
      setInterval(() => {
        // Circle the camp: stays inside the leash area, never past the server's
        // travel allowance (walk speed 1050 px/s -> ~52 px per 50 ms).
        this.angle += 0.11;
        this.x = this.spawnX + Math.cos(this.angle) * 60;
        this.y = this.spawnY + Math.sin(this.angle) * 60;
        this.send({
          type: "player_move",
          payload: {
            x: Math.round(this.x),
            y: Math.round(this.y),
            vx: 52,
            vy: -52,
            direction: "right"
          }
        });
      }, MOVE_INTERVAL_MS)
    );

    if (COMBAT) {
      this.timers.push(
        setInterval(() => {
          if (!this.target || this.target.isDead) this.pickTarget();
          if (!this.target) return;
          const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
          if (dist > MELEE_REACH - 20) return;
          this.send({
            type: "player_attack",
            payload: { skill: "normal", x: this.target.x, y: this.target.y, facingRight: true }
          });
          this.send({ type: "enemy_hit", payload: { id: this.target.id } });
        }, ATTACK_INTERVAL_MS)
      );
    }
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  async close() {
    this.stop();
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      this.ws.once("close", resolve);
      this.ws.close();
    });
  }
}

/** Scatter clients around the map's hunting camps. */
const buildSpawns = (count) => {
  const map = getMap(MAP_ID);
  const spawns = map.enemySpawns || [];
  const camps = spawns.length
    ? spawns.map((spawn) =>
        Array.isArray(spawn) ? { x: spawn[0], y: spawn[1] } : { x: spawn.x, y: spawn.y }
      )
    : [{ x: (map.bounds.x0 + map.bounds.x1) / 2, y: (map.bounds.y0 + map.bounds.y1) / 2 }];

  return Array.from({ length: count }, (_, i) => {
    const camp = camps[i % camps.length];
    const ring = 40 + (i % 5) * 22;
    const angle = (i / count) * Math.PI * 2;
    return {
      x: Math.round(camp.x + Math.cos(angle) * ring),
      y: Math.round(camp.y + Math.sin(angle) * ring)
    };
  });
};
// --- Phases -------------------------------------------------------------------

const totals = (clients) => ({
  clientSent: clients.reduce((sum, c) => sum + c.outMessages, 0),
  clientSentBytes: clients.reduce((sum, c) => sum + c.outBytes, 0),
  clientReceived: clients.reduce((sum, c) => sum + c.inMessages, 0),
  clientReceivedBytes: clients.reduce((sum, c) => sum + c.inBytes, 0)
});

const runPhase = async (clients, name, seconds) => {
  const before = totals(clients);
  await ask("reset");
  const start = Date.now();
  await sleep(seconds * 1000);
  const stats = await ask("stats");
  const wallMs = Date.now() - start;
  const after = totals(clients);

  const perSec = (value) => value / (wallMs / 1000);
  const inMessages = after.clientSent - before.clientSent;
  const outMessages = after.clientReceived - before.clientReceived;
  const { ticks, db } = stats;
  if (!ticks?.tickEnemies) return { phase: name, note: "server died during phase" };

  return {
    phase: name,
    players: stats.players,
    wallS: Number((wallMs / 1000).toFixed(1)),
    srvCpuPct: Number(stats.cpuPct.toFixed(1)),
    lagAvgMs: Number(stats.lagAvgMs.toFixed(1)),
    lagMaxMs: Number(stats.lagMaxMs.toFixed(0)),
    inMsgPerSec: Math.round(perSec(inMessages)),
    outMsgPerSec: Math.round(perSec(outMessages)),
    outMBps: Number((perSec(after.clientReceivedBytes - before.clientReceivedBytes) / 1e6).toFixed(2)),
    msgPerClientPerSec: Number((perSec(outMessages) / Math.max(1, stats.players)).toFixed(0)),
    enemyTickAvgMs: Number(ticks.tickEnemies.avgMs.toFixed(2)),
    enemyTickMaxMs: Number(ticks.tickEnemies.maxMs.toFixed(1)),
    bitesAvgMs: Number(ticks.tickBites.avgMs.toFixed(3)),
    regenAvgMs: Number(ticks.tickRegen.avgMs.toFixed(2)),
    moveAvgUs: Number((ticks.handlePlayerMove.avgMs * 1000).toFixed(1)),
    hitAvgUs: Number((ticks.handleEnemyHit.avgMs * 1000).toFixed(1)),
    broadcastsPerSec: Math.round(perSec(ticks.broadcastToMap.calls)),
    sendCostMsPerSec: Number(
      perSec(ticks.broadcastToMap.avgMs * ticks.broadcastToMap.calls).toFixed(1)
    ),
    dbWritesPerSec: Math.round(
      perSec(db.setVitals.calls + db.setProgress.calls + db.setInventory.calls)
    ),
    dbMsPerSec: Number(
      perSec(db.setVitals.totalMs + db.setProgress.totalMs + db.setInventory.totalMs).toFixed(1)
    ),
    rssMb: Number(stats.memoryMb.toFixed(0))
  };
};

// --- Main ---------------------------------------------------------------------

console.log(
  `\n${PLAYERS} clients -> "${MAP_ID}" | roster ${ready.roster} spawns | ` +
    `move ${MOVE_HZ} Hz | ${COMBAT ? `attack ${ATTACK_INTERVAL_MS} ms` : "no combat"} | ` +
    `enemyTick ${TICK_MS} ms`
);

const spawns = buildSpawns(PLAYERS);
const clients = spawns.map((spawn, i) => new BenchClient(i, spawn));

const joinStart = Date.now();
await Promise.all(clients.map((client) => client.connect()));
const joinMs = Date.now() - joinStart;
console.error(`[bench] connected in ${joinMs} ms, warming up ${WARMUP_MS} ms`);
await sleep(WARMUP_MS);
console.error(`[bench] warmup done, players=${(await ask("stats")).players}`);

const phases = [];
console.error("[bench] phase: idle");
phases.push(await runPhase(clients, "idle", 3));

if (!childExited) {
  clients.forEach((client) => client.start());
  console.error(`[bench] phase: ${COMBAT ? "move + combat" : "move"}`);
  phases.push(await runPhase(clients, COMBAT ? "move + combat" : "move", SECONDS));

  clients.forEach((client) => client.stop());
  console.error("[bench] phase: idle after stop");
  phases.push(await runPhase(clients, "idle after stop", 3));
}

await Promise.all(clients.map((client) => client.close()));
child.kill();
fs.rmSync(dataDir, { recursive: true, force: true });

console.log(
  `\nJoin burst: ${PLAYERS} clients in ${joinMs} ms (${(PLAYERS / (joinMs / 1000)).toFixed(0)} joins/s)\n`
);
console.table(phases);
const measured = phases.filter((row) => typeof row.srvCpuPct === "number");
console.log(
  "| Phase | srv CPU | loop lag avg/max | in msg/s | out msg/s | out MB/s | " +
    "per client/s | enemy tick | broadcasts/s | send ms/s | DB writes/s | DB ms/s |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
);
measured.forEach((row) =>
  console.log(
    `| ${row.phase} | ${row.srvCpuPct}% | ${row.lagAvgMs}/${row.lagMaxMs} ms | ${row.inMsgPerSec} | ` +
      `${row.outMsgPerSec} | ${row.outMBps} | ${row.msgPerClientPerSec} | ${row.enemyTickAvgMs} ms | ` +
      `${row.broadcastsPerSec} | ${row.sendCostMsPerSec} | ${row.dbWritesPerSec} | ${row.dbMsPerSec} |`
  )
);
process.exit(0);
