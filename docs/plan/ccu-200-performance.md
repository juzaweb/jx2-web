# 200 CCU combat — measured capacity and budget

Status: **measured, not yet optimized**. The current broadcast model does not fit
200 concurrent players on one map. The measurements below and the fix plan are
the basis for the next change.

Reproduce with:

```bash
cd server
node benchmarks/ccu200Bench.js                      # 200 players, 20 Hz, combat
node benchmarks/ccu200Bench.js --players 100
node benchmarks/ccu200Bench.js --move-hz 10        # what a 10 Hz client would cost
node benchmarks/ccu200Bench.js --no-combat
```

## Method

`benchmarks/ccu200Bench.js` forks `benchmarks/ccuBenchServer.js` (the real
`GameSocketManager`, real SQLite ledger, real enemy tick) and drives it from a
**separate process**, so the load generator does not steal the CPU it measures.
Synthetic clients behave like the browser client:

- `player_move` every 50 ms while walking (`src/game/game.js:1698` sends at 20 Hz)
- `player_attack` + follow-up `enemy_hit` once per second inside melee reach
- all players on `dong-mon-thanh` (24000×14000, 270 monster spawns) scattered
  around its hunting camps

Server side, `tickEnemies`, `tickBites`, `tickRegen`, `handlePlayerMove`,
`handleEnemyHit`, `broadcastToMap` and the SQLite write calls are instrumented;
event-loop lag is sampled with a 10 ms timer.

Hardware: Apple Silicon laptop, Node 24.12, single server process, loopback
transport. Absolute numbers on a production VPS will be lower; the *shape* of the
curve (the important part) is the same.

## Results

`out msg/s` is what the server pushes to all clients; `send ms/s` is exclusive
CPU time spent inside `broadcastToMap` (JSON + `ws.send`).

| Players | Client rate | out msg/s | out MB/s | Server CPU | Loop lag avg/max | send ms/s |
| --- | --- | --- | --- | --- | --- | --- |
| 25 | idle (regen only) | 1,249 | 0.09 | 2.4% | 1.1 / 8 ms | 10 |
| 25 | 20 Hz + combat | 12,950 | 1.58 | 8.8% | 1.1 / 6 ms | 73 |
| 50 | idle | 4,998 | 0.37 | 3.9% | 1.4 / 16 ms | 25 |
| 50 | 20 Hz + combat | 53,081 | 6.51 | 34.2% | 2.9 / 34 ms | 328 |
| 100 | idle | 19,993 | 1.48 | 10% | 2.1 / 50 ms | 90 |
| 100 | 20 Hz + combat | 204,802 | 25.4 | 98.3% | **296 / 745 ms** | 974 |
| 200 | idle | 85,467 | 6.36 | 48.4% | 11.9 / 205 ms | 489 |
| 200 | 0.5 Hz, no combat | 90,636 | 7.47 | 57.7% | 17.4 / 427 ms | 582 |

Non-fan-out work is tiny at every size:

| Work | Cost at 200 players |
| --- | --- |
| `tickEnemies` (270 monsters, 10 Hz) | 0.05–0.09 ms per tick → **~0.1% of a core** |
| `tickBites` | < 0.01 ms per tick |
| `handlePlayerMove` | ~1 µs per message |
| `handleEnemyHit` | ~1 µs per message |
| SQLite writes | 400 writes/s, ~13 ms/s |

Join burst: 200 sockets in **63 ms** (≈3,175 joins/s). Note each `init_world`
carries every player *and* every monster on the map, so a 200-player mass
reconnect is an O(N²) payload burst (~50–80 KB per join).

## The bottleneck: full-map fan-out is O(N²)

Every event is broadcast to **everyone standing on the map**
(`broadcastToMap` iterates all sockets and filters by `mapId`). Traffic therefore
grows with the square of the population on a map:

```
out_msgs/s ≈ events_per_player_per_s × players × (players − 1)
```

Measured cost per outbound message is stable at **≈5.5 µs** (JSON stringify is
amortized over the fan-out; `ws.send` framing + syscall dominates). One Node
process therefore tops out at roughly:

```
core capacity  ≈ 1,000 ms / 5.5 µs  ≈ 180k msg/s (100% CPU)
usable budget  ≈ 110–130k msg/s     (60–70% CPU, room for gameplay)
```

Both checks confirm the model:

- 100 players × 20 Hz × 99 peers = 198,000 predicted, 204,802 measured.
- 200 players idle: 2 regen points/s × 200 × 199 = 79,600 predicted, 85,467 measured.

### What 200 CCU in combat actually asks for

| Event | Rate | Recipients | out msg/s |
| --- | --- | --- | --- |
| movement (20 Hz) | 4,000/s | 199 | **796,000** |
| attacks | 200/s | 199 | 39,800 |
| landed hits | 200/s | 199 | 39,800 |
| passive regen (2 HP/s) | 400/s | 199 | 79,600 |
| bites / deaths / rewards | ~50/s | 199 | ~10,000 |
| **Total** | | | **≈965,000 msg/s** |

That is ~7.5× the capacity of one process, ~85 MB/s of egress, and — the part
that no server tuning fixes — **~4,800 messages per second into each browser**.
The design is over budget before the first monster dies.

Two consequences already visible at low N:

1. **Idle players cost a fortune.** 200 players doing nothing burn 48% of a core
   because passive regen broadcasts one `player_hp` per whole HP point to the
   whole map. HP regen alone is 79.6k msg/s.
2. **The knee is between 50 and 100.** CPU goes 34% → 98% while load only doubles,
   and loop lag explodes from 3 ms to 296 ms. At 100 CCU the event loop is
   already missing ticks; beyond that the server starts shedding sockets via
   `maxBufferedBytes` and DB writes drop (156/s measured instead of 200/s).

**Verdict: today's code supports ≈40–50 CCU per map on one core** (34% CPU at 50,
and each client already receiving ~1,060 msg/s). 200 CCU in combat needs the
fan-out redesigned, not a bigger machine.

## Fix plan (ordered by impact)

### 1. Fixed-rate snapshots instead of per-event broadcast — 20× win

Replace "one message per event per peer" with "one snapshot per client per tick":

- Server keeps a 10 Hz broadcast clock. On each tick it sends **one**
  `world_state` frame per player containing the players/monsters that moved since
  the previous tick.
- Clients interpolate between snapshots (they already interpolate `enemy_moved`
  and `player_moved`, so this is a transport change, not a renderer rewrite).

Projected at 200 CCU: `200 × 10 = 2,000 msg/s` instead of 796,000. Payload ≈2.4 KB
(200 entities × 12 B) → **~4.8 MB/s**, CPU ≈ 20–30 ms/s (**2–3%**).

### 2. Area of interest — 10–20× win on bandwidth

Ship only entities within a radius (the code already has `SpatialGrid`, built for
exactly this) instead of the whole map. With ~12 visible entities per player the
snapshot shrinks to ~700 B: `2,000 × 700 B ≈ 1.4 MB/s`.

This also fixes the `init_world` O(N) payload and the "everyone renders everyone"
assumption in the comments at `gameSocket.js:240`.

### 3. Fold regen/HP into the snapshot

Delete the per-point `player_hp` broadcast from `tickRegen` (keep the state
change; drop the fan-out). Health ships in the snapshot like everything else.
Removes 79,600 msg/s at 200 CCU — the single biggest idle cost.

### 4. Batch vitals persistence

`persistVitals` runs a synchronous SQLite write on every HP/MP change, including
every regen point: 400 writes/s at 200 CCU idle. Flush dirty players on a 5–10 s
timer, on death, and on disconnect → ~40 writes/s, and no synchronous DB I/O on
the combat hot path.

### 5. Reduce the client send rate

20 Hz is unnecessary when the renderer already interpolates. 10 Hz halves inbound
traffic and gives the anti-cheat (`maxTravelDistance`) a wider tolerance window.
Cheap change, fold it into step 1.

### Expected result

| Metric | Now (200 CCU) | After 1–4 |
| --- | --- | --- |
| out msg/s | ~965,000 | ~2,000 |
| egress | ~85 MB/s | ~1.4 MB/s |
| server CPU | ~440% of a core (infeasible) | < 10% |
| per-client msg/s | ~4,800 | 10 |
| DB writes/s | 400+ | ~40 |

That leaves room to grow: with the same core you could run several sharded maps
(`shard by map`, one process per map group) rather than one giant process.

## Follow-ups worth measuring after the change

- 200 CCU with 4–5 monster camps active, to size the snapshot payload honestly.
- Mass reconnect (200 joins at once) with the AOI `init_world`.
- SQLite WAL behaviour under the batched write pattern (`data/jx2.sqlite-wal`).
