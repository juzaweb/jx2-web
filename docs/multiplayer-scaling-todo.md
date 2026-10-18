# Multiplayer scaling — deferred work

Status: **deferred** (noted, not scheduled). Captured after the
server-authoritative HP change (`player_hp` / `player_defeated`).

## Context

Player HP is now server-authoritative: the server owns `hp`/`maxHp`, applies
wolf bites (`tickBites`) and PvP hits (`handlePlayerHit` → `applyPlayerDamage`),
and broadcasts `player_hp` to everyone. PvP also broadcasts `player_attack`.

The HP/bite path itself is cheap (see below). The problem is the **broadcast
fan-out** that both the new and the pre-existing events share.

## Measured load (single server process, one core = 100%)

Harness: 200 WebSocket clients clustered inside one PvP range, each emitting
`player_attack` + `player_hit` at N/s; server CPU read via `process.cpuUsage`.

| Scenario (200 connected)                      | Server CPU |
|-----------------------------------------------|------------|
| 40 fighters, 3 hits/s each                     | ~34% core  |
| 200 fighters, 1 hit/s each                      | ~120% core |
| 200 fighters, 3 hits/s each                     | >400% core (saturates) |
| (reference) 50 fighters, 3 hits/s               | ~12% core  |
| (reference) 100 fighters, 3 hits/s              | ~45% core  |
| reference: `tickBites`, 1000 players x 64 wolves | ~1.7% core |

Key number: at 200 all fighting @3/s, ~336 msgs/s in → **~54,000 msgs/s out**.

## Root causes (in leverage order)

1. **No area-of-interest (AOI).** Every event is sent to *all* N clients, so
   aggregate cost is O(N²). Players across the map receive irrelevant hits.
2. **High PvP frequency.** ~3 actions/s/player (attack cooldown 330 ms), far
   above the bite rate (0.71/s/player). Each action fans out to N.
3. **No server-side rate limit / cooldown.** `handlePlayerAttack` and
   `handlePlayerHit` accept any rate; a hacked client can spam `player_attack`
   (no server cooldown) and amplify 1 send → N sends.
4. **No backpressure handling.** A slow client's `ws.bufferedAmount` can grow
   unbounded; the server keeps queuing writes.

## Remediation plan (proposed)

1. **AOI via a spatial grid.** Only broadcast `player_*`, `enemy_*`, and chat to
   players within a view radius (~a few cells). Turns O(N²) into
   O(N × neighbours). Biggest win; fixes movement traffic too, not just PvP.
2. **Server-side throttle + attack cooldown.** Track `nextAttackAt` per player,
   reject `player_attack` / `player_hit` faster than ~3-4/s, and ignore
   `player_hit` with no matching recent attack.
3. **Coalesce HP updates per tick.** Collapse multiple HP changes in one tick
   into a single broadcast instead of one per event.
4. **Backpressure guard.** Check `ws.bufferedAmount` and skip/drop sends (or
   disconnect) for clients that fall behind.

## Acceptance / how to verify

- Re-run the load harness above per scenario; target: 200 all-fighting @3/s
  stays **< 100% of one core** and no client is disconnected.
- Add a regression test for the per-socket rate limit and the AOI filter
  (pure functions, unit-testable).
- Confirm normal play (200 connected, a few dozen fighting) does not regress.

## Non-goals

- Changing HP authority (already done).
- `maxHp` / `defense` / `attack` / EXP are still client-reported; server-side
  stat authority is a separate item.
