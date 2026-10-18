# Loop State — jx2-web (Giang Hồ · React + Phaser 3 Wuxia RPG)

Last run: 2026-10-18 — feature pipeline cycle (L2, item F1 — server-synced enemy state)

## Project Snapshot

- Stack: React 19 + Vite + Phaser 3 (Arcade physics).
- Entry: `src/main.jsx` → `src/App.jsx` (React HUD) + `src/game/game.js` (Phaser scene).
- Bridge: `src/game/bridge.js` (pub/sub between Phaser and React HUD).
- Persistence: `src/game/storage.js` (localStorage: stats, position, quest, audio, inventory quantities).
- Verify command: `npm run build && npm test` (Vitest + jsdom). Run locally: `npm run dev` (http://localhost:3000).

## High Priority (loop is acting or waiting on human)

- [x] A4 is merged to `develop` (`e5933ca`, PR #5).
- [x] Spec review on 2026-10-18 approved A5, C6, D4 — `SPEC GATE: PASS`.
- [x] C1 is merged to `develop` (`89c5bd5`).
- [x] C2 is merged to `develop` (`182e8c8`, PR #7).
- [ ] Next loop item after C2: pick highest-priority `todo` in `BACKLOG.md` (A1, A2, B4 at P1; E3 is P1 but needs Playwright → `package.json` humanMergeRequired).
- [ ] Enable branch protection requirements so CI must pass before merge on `develop`.
- [ ] F1 (server-synced enemy state) is rebased onto `develop` on this branch, waiting on a PR/merge.

## Watch List

- Rollout level: **L2 enabled**. Merge target = `develop` only.
- Pipeline agents in `opencode.json`: `loop-feature`, `feature-propose`, `spec-review`, `implementer`, `verifier`.
- Policy: `gate.yaml` + `docs/safety.md`. Feature menu: `docs/jx2-feature-library.md`.
- Toolchain: Vitest 5 + jsdom; CI at `.github/workflows/ci.yml`.
- Spec review 2026-10-18: APPROVE A4, B5, C5, A5, C6, D4 — `SPEC GATE: PASS`.
- Spec review 2026-10-18 (C2 cycle): APPROVE A6, C7, C8 (new) + C2 — `SPEC GATE: PASS`.
- Feature scout 2026-10-18: proposed A6 (ngũ hành, P2), C7 (rèn đúc, P3), C8 (cường hoá, P3); queue now 22 todo items.
- **Verifier finding (C1/C2, deferred):** HUD inventory is a mount-time snapshot, so a looted quantity is not shown live in `InventoryModal` until reload. Persistence still works. Wire quantity changes through `bridge` when a UI item (C4 consume, or a dedicated UX item) lands.
- **Verifier finding (A4, deferred):** In `CombatSystem.damagePlayer`, backward compatibility with existing `game.js:387` calls (`this.combat.damagePlayer(7)`) is preserved via proximity lookup. In a future pass touching `game.js`, cleanly update to `this.combat.onBite(wolf)`.
- **Verifier finding (C1, deferred):** stack quantities live in two places — React
  state snapshot (`App.jsx`) and the `items.js` module singleton. `useItem` never
  decrements, and the HUD would go stale if it did. Wire quantity changes through
  `bridge` when C2 (loot) / C4 (consume) land.
- **F1 design notes:** the server owns enemy HP/death/respawn; clients keep the local
  AI for movement and report positions (`enemy_move`, 500 ms throttle → server relays
  only ≥40 px drift → clients snap only beyond 90 px). Damage is still applied
  optimistically on the hitter's client for feedback, then overwritten by the
  authoritative `enemy_hit` broadcast, so kill rewards/drops stay with the player who
  landed the killing blow. Respawn timeouts are `setTimeout`s on the manager and are
  cleared in `close()`.
- **F1 not yet merged:** edits are in the working tree on the current branch
  (the multiplayer base is uncommitted), so no worktree/branch/PR was created this run.

## Verifier Run — C2 (2026-10-18, step 4)

- Skill: code-review-and-quality (5 axes). Scope: PR #7 diff against `develop` (`f8c7efe`); branch `loop/c2-loot-drops`.
- **Correctness:** `collectDrop → addQuantity → onStateChange → saveGame → StorageManager.save({inventory: getQuantities()})` traced; reload path (`App.jsx` mount → `loadInventory`) round-trip independently re-probed; `rollDrop` never returns a non-catalog id. ✅
- **Readability:** full JSDoc, straight control flow, clear names. ✅ (Nit: `DROP_TABLE.find` after `rollDrop` is redundant.)
- **Architecture:** helpers live in `items.js` (catalog + quantities owner); `combat.js` imports one-way, no cycle; matches `Touches`. ✅
- **Security:** input validation on id/amount; adversarial probe confirms no prototype pollution (`__proto__`/`constructor` non-issue and unreachable). ✅
- **Performance:** `rollDrop` O(4), `addQuantity` O(1), no leaks. ✅
- **Tests:** 52/52 pass; `items.test.js` 10 → 19 (+9), no existing test weakened. ✅
- Verdict: **APPROVE** — `npm run build` ✅ · `npm test` ✅ 52/52.

## Last Run Evidence (2026-10-18, C2 cycle)

- Item: **C2 — Loot drops feed inventory** (branch `loop/c2-loot-drops`, PR #7, commit `182e8c8`, worktree `/tmp/opencode/jx2-c2`).
- Change: `addQuantity(id, amount)` + weighted `DROP_TABLE`/pure `rollDrop(rng)` in `items.js`; `spawnDrop` rolls a loot entry and `collectDrop` grants it to the persisted inventory with a Vietnamese log line; existing +5 bạc / +5 nội lực and the `onStateChange` save path preserved; 9 unit tests in `items.test.js`.
- Verify: `npm run build` ✅ · `npm test` ✅ **52 passed / 52** (5 files; +9 new tests in `items.test.js`).
- Diff: 3 files (≤ `gate.yaml:maxFiles` 10); all paths in `autoMergeAllowlist` (`src/**`, `**/*.test.js`), none in `humanMergeRequired` or denylist.
- CI: `build-and-test` ✅. Merge: PR #7 squashed & merged into `develop` automatically per `gate.yaml`.

## Last Run Evidence (2026-10-18, F1 cycle)

- Item: **F1 — Server-synced enemy state (position + HP)** (spec added to `BACKLOG.md` under new EPIC F; `SPEC GATE: PASS` inline).
- Change: `server/src/websocket/gameSocket.js` now owns the enemy roster (spawns, HP, dead flag, respawn timers) and speaks `enemy_hit` (validated, broadcast to all) and `enemy_move` (drift-relayed); `init_world` ships `enemies`. Client: new pure `src/game/enemySync.js` reconcile rules used by `Wolf.applyServerState` (`enemy.js`), `EnemyManager.applyEnemyState/applyServerSnapshot`, `combat.damageEnemy` reports damage, `game.js` wires the three new events + throttled 500 ms `enemy_move`, `networkClient.js` gains `sendEnemyHit`/`sendEnemyMove`.
- Verify: `npm run build` ✅ · `npm test` ✅ **50 passed / 50** (+9 new in `enemySync.test.js`) · `npm run server:test` ✅ **25 passed / 25** (+1 new enemy-sync suite).
- Live check: temporarily started the backend, patched `WebSocket` in the running browser tab, and confirmed real frames — `init_world` carries the `enemies` roster, the client emits `enemy_move` for all 8 wolves every 500 ms, and a second player's hits arrived as `enemy_hit` broadcasts dropping HP (e.g. `id=0 hp=13/45 → 0/45 dead`). Backend stopped again afterwards.
- Diff: 10 files (== `gate.yaml:maxFiles`); all paths allowlisted, none in `humanMergeRequired`, no denylist paths.
- Review (code-review-and-quality, 2026-10-18): fixed corpse position-snap and the offline-only respawn loop → `npm test` 51/51.
- Rebase: replayed onto `develop` (`aa8d023`, PR #10 user-auth) on 2026-10-18; the auth/dev-script commits were already upstream and dropped as empty.

## Last Run Evidence (2026-10-18, prior cycle)

- Item: **C1 — Persist inventory state** (branch `loop/c1-persist-inventory`, base `develop` e393866, worktree `/tmp/opencode/jx2-c1`).
- Change: `storage.js` persists a sanitized `inventory` id→qty map (`loadInventory` merges over catalog defaults; saves preserve inventory when omitted); `items.js` gains `defaultQuantities` / `setQuantities` / `getQuantities` / `applyQuantities`; `App.jsx` loads on mount and passes quantities to `InventoryModal`/`HotbarDock`; `game.js` includes `inventory: getQuantities()` in every save.
- Verify: `npm run build` ✅ · `npm test` ✅ **24 passed / 24** (3 files; +8 new tests in `items.test.js`, `storage.test.js`).
- Diff: 10 files (≤ `gate.yaml:maxFiles`); all paths allowlisted, none in `humanMergeRequired`.
- Tooling note: `feature-propose`/`implementer`/`verifier` sub-agents blocked by `permission: ask`; roles executed inline by `loop-feature`.
## Recent Noise (ignored this run)

- Dist build output in `dist/` (gitignored).

---

Backlog: see `BACKLOG.md`
Run log: see `loop-run-log.md`
