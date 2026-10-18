# Loop State — jx2-web (Giang Hồ · React + Phaser 3 Wuxia RPG)

Last run: 2026-10-18 — direct request (review+fix): hardening pass on the globally-unique-names change.
(Prior run: direct request (change) — make character names globally unique + drop soft-delete.)

## Review + fix pass on global unique names (2026-10-18, direct request)

- Applied code-review-and-quality (five axes) to the unique-name commit `e7e7fe6`; fixes:
  - **Boot-crash risk (Required):** the previous migration only deduped when `deleted_at` existed, so a legacy DB that already lacked the column but held cross-account duplicate names would throw `UNIQUE constraint failed` when the global index was created — crashing the server at import. Split migration into `_purgeSoftDeleted()` + `_dedupeNames()` and made dedupe run whenever duplicates exist.
  - **Migration atomicity (Required):** the migration now runs in one `BEGIN IMMEDIATE`/`COMMIT` (rollback on failure) so a partial rename/purge can't leave the DB half-upgraded.
  - **Shared-DB contention (Required):** added `_needsMigration()` so the write transaction is taken only when something actually needs migrating; a current schema (global index present) short-circuits with O(1) `sqlite_master` lookups and no table scan — critical because every `node --test` worker imports `characterDb` against the shared file.
  - **Unmapped constraint error (Required):** `create()` now catches the SQLite UNIQUE violation (errcode 2067 / message) and rethrows `NAME_TAKEN`, so a multi-process race can't surface as a 500. Shared `nameTakenError()` used by the pre-check and the backstop.
- New tests: dedupe when `deleted_at` is already gone; all 12 `character.test.js` cases green.
- Findings left open (reported, not changed):
  - **Consider — Unicode case folding:** `COLLATE NOCASE` folds ASCII only, so `Độc` and `độc` are distinct names. Correct fix needs a JS-normalized `name_key` column (JS `toLowerCase()` folds Vietnamese) + unique index on it. Pre-existing behavior; left as a follow-up to avoid a schema expansion in this change.
  - **FYI — known flake:** the WebSocket enemy tests fail intermittently under parallel workers; reproduced on the pre-change baseline `5211e44`, so unrelated to this change (already noted below).
- Verify: `npm run build` ✅ · `npm test` ✅ **148 passed / 148** · `npm run server:test` ✅ **53 passed / 53** on clean runs (character suite 12/12; WS flake reproduced on baseline).

## Globally unique character names + removed soft-delete (2026-10-18, direct request)

- Request: "unique tên nhân vật" — character names must be unique across the whole server, not just within one account; clarifies to **remove soft-delete** entirely (a deleted character is gone, so its name is freed).
- Change:
  - **Server (`server/src/data/characterDb.js`):** the per-account partial index `idx_characters_user_name (user_id, name) WHERE deleted_at IS NULL` is replaced by a global `idx_characters_name (name COLLATE NOCASE)`; `listed/count/find` no longer filter on `deleted_at`; `softDelete` → `remove` (hard `DELETE`); `restoreLast`/`countDeletedByUser`/`deletedAt` deleted. `create` now rejects any name already used by *any* account (`NAME_TAKEN`, message "Tên nhân vật này đã được sử dụng.").
  - **Migration (`_migrateSchema`):** for a legacy DB, purge soft-deleted rows, drop the old index, rename cross-account duplicates (oldest keeps the name, later ones get `-2`, `-3`, … within the 16-char limit), then `ALTER TABLE … DROP COLUMN deleted_at` before the global unique index is created. New tables never carry `deleted_at`.
  - **API:** `character.controller.js` drops `restoreCharacter` and all `deletedCount` fields; `character.routes.js` drops `POST …/characters/restore`.
  - **Client:** `apiClient.restoreCharacter` removed; `CharacterSelectModal.jsx` drops the "Khôi phục nhân vật" button, `deletedCount` state, and the "Bạn có thể khôi phục lại" notice; the delete confirm now says "xoá vĩnh viễn".
- Caveat: SQLite `COLLATE NOCASE` only folds ASCII case, so names differing only by non-ASCII casing (e.g. `Độc` vs `độc`) are treated as distinct — same as the previous per-account behavior.
- Verify: `npm run build` ✅ · `npm test` ✅ **148 passed / 148** (15 files) · `npm run server:test` ✅ **52 passed / 52** (3 suites; new cross-account-duplicate, hard-delete-frees-name, DELETE-404, and legacy soft-delete/duplicate migration tests). (Superseded by the next run's 53-test suite.)


## Remote players missing from the minimap (2026-10-18, direct request)

- Report: teammates/other players were not shown as blips on the minimap.
- Cause: `uiBridgeAdapter.drawMinimap` guarded the remote-player loop with `if (!rp.sprite || !rp.sprite.active)`. A `RemotePlayer` renders through a `container` (no physics `sprite`), so `rp.sprite` was always `undefined` and every remote player was skipped.
- Fix: guard on `rp.container?.active` (a destroyed player has already nulled its container). The old test passed only because it fed the loop a fake `sprite` — switched the test to the real `container` shape and added a negative case for a destroyed player.
- Verify: `npm run build` ✅ · `npm test` ✅ **149 passed / 149** (15 files).

## Blank minimap fix (2026-10-18, direct request)

- Report: the HUD minimap rendered empty.
- Cause: `MinimapPanel` emits `ACTION_REGISTER_MINIMAP` once in a mount `useEffect`. Phaser's `Game.boot()` waits on `TextureEvents.READY` before `start()`, so `JiangHuScene.create()` — where `UIBridgeAdapter` subscribes — runs on the first RAF frame, *after* React's effects. The registration was emitted into the void, `minimapCtx` stayed `null`, and `drawMinimap` returned early every frame.
- Fix: two-way handshake over the existing bridge. `UIBridgeAdapter` now (after subscribing) emits a new `ACTION_REQUEST_MINIMAP`; `MinimapPanel` answers it by re-sending its canvas. This covers both mount orders: panel-first (adapter requests → panel resends) and adapter-first (panel's own mount emit is caught). Extracted `attachMinimap()` for the bind. No new global/singleton state.
- Verify: `npm run build` ✅ · `npm test` ✅ **148 passed / 148** (15 files; +4: new `uiBridgeAdapter.test.js` covering re-request, late registration, drawing, and pre-bind no-op).

## Peer health bars + HP relay (2026-10-18, direct request)

- Request: "nhân vật ko nhìn thấy máu của nhau" — a player could see only their own overhead bar; peers had none.
- Cause: HP was purely local. `RemotePlayer` carried `hp`/`maxHp` from the join snapshot but they were never updated, and the client never reported HP changes, so there was no channel to keep peers in sync.
- Change:
  - **Client→server:** `NetworkClient.sendStats()` → new `player_stats` message. `game.js:update()` reports `{hp, maxHp}` inside the 50 ms throttle window only when they changed (tracked via `lastReportedHp`/`lastReportedMaxHp`).
  - **Server:** `GameSocketManager.handlePlayerStats` clamps `hp`→[0,9999] / `maxHp`→[1,9999], ignores un-joined sockets, and relays `player_stats` to everyone **except** the sender.
  - **Server→client:** `RemotePlayer.applyStats()` updates `hp`/`maxHp` (ignoring unusable values) and `RemotePlayer` now draws an overhead bar mirroring the local one (shared `HEALTH_BAR_WIDTH/HEIGHT` + `healthBarStyle` from `src/game/healthBar.js`). `remotePlayerManager.handlePlayerStats` routes the packet; `game.js` subscribes to `player_stats`.
  - Initial HP already rides the join snapshot (`init_world` / `player_joined`), so a bar is correct from first sight.
- Design note: HP stays client-authoritative for players (wolf bites are still computed on the hitter's client), so a peer's bar reflects what that player *reports*. Making player HP server-authoritative is a separate backlog item.
- Review (code-review-and-quality): flagged the near-duplicate `updateHealthBar`/rect-creation in `Player` and `RemotePlayer` (~20 identical lines with geometry that could drift). Extracted the rendering glue into `src/game/healthBarView.js` (`createHealthBar` + `layoutHealthBar`); the pure rules stay in `healthBar.js` (same pure/glue split as `enemySync.js` ↔ `enemy.js`). Also fixed `RemotePlayer`'s join HP fallback (`data.hp || 100` → numeric check, so a reported `0` is honoured). Added `healthBarView.test.js` (stub scene/rects, no Phaser).
- Verify: `npm run build` ✅ · `npm test` ✅ **144 passed / 144** (14 files) · `npm run server:test` ✅ **50 passed / 50**.

## Player overhead health bar + respawn position sync (2026-10-18, direct request)

- Request 1: show a health bar above the local character's head. Added `hpBack`/`hpFill` to `Player.createVisuals()` (between the name and the head) and a `updateHealthBar(x, y)` that sizes the fill from `hp/maxHp` and recolours green → amber → red; repositioned every frame in `update()`/`setPosition()`.
- Request 2 (bug): after a player died and respawned at Trường An, a peer standing in the city never saw them. Cause: `game.js:update()` gated the outbound `player_move` on `isMoving || wasMovingLastSync`, so a respawn / Hồi Thành Phù teleport — a jump while stationary — was never reported; the server kept the pre-respawn coordinates and peers kept rendering the stale position. Also, peers interpolated (Linear 0.22) and would have slid across the map on a large jump.
- Fix: new pure helper `src/game/positionSync.js` (`shouldReportPosition` + `TELEPORT_REPORT_THRESHOLD = 120`) forces a packet on a teleport-sized jump; `game.js` tracks `lastReportedPos` through it. `remotePlayer.js` snaps (>200 px) on a large jump so a respawn appears instantly instead of sliding.
- Review (code-review-and-quality): confirmed Phaser 3.90's Rectangle renderers draw from `src.width`, so `hpFill.width = …` is a valid resize on both WebGL and Canvas. Extracted the ratio/colour rule into `src/game/healthBar.js` (`healthBarStyle`) so the previously untested logic has coverage; fixed the bar's depth to use a stable anchor (`sprite.y`) so it no longer oscillates with the walk bob; de-nested the colour ternary and named the `reportPosition` decision in `game.js`.
- Verify: `npm run build` ✅ · `npm test` ✅ **138 passed / 138** (13 files; +11: `positionSync.test.js`, `healthBar.test.js`).

## HMR reconnect loop (2026-10-18, direct request — PR #22)

- Report: after pulling F3 the game page logged "Mất kết nối máy chủ. Đang tự động kết nối lại..." endlessly.
- Cause: `JiangHuScene.shutdown()` existed but was never invoked — `game.js` had no `events.on/once` registration at all. A scene destroyed by an HMR reload or a canvas remount therefore left its `NetworkClient` connected with auto-reconnect on. Both the orphan and the live client join with the same per-tab player id, and the server closes the *other* socket on every join, so the two kicked each other off forever. The same dead scene produced the console error `init_world → Cannot read properties of null (reading 'add')` (`remotePlayer.js:31`): Phaser's `Systems.destroy()` nulls `scene.add`/`displayList` immediately after emitting `destroy`.
- Fix: `bindSceneTeardown()` registers `shutdown()` on the scene's `shutdown` and `destroy` events, and `NetworkClient.disconnect()` now drops its handlers as well, so a late `close` or in-flight packet cannot reach the torn-down scene (nor log into the live HUD through the shared `bridge`).
- Verify: `npm run build` ✅ · `npm test` ✅ **127 passed / 127** (11 files; +5: new `src/game/game.test.js`, `networkClient.test.js`) · `npm run server:test` ✅ **49 passed / 49**.

## Character Select & Create (2026-10-18, direct request)

- Item: **Character select/creation flow** (branch `feature/character-select`, base `develop` `b67ea45`; rebased onto `develop` @ `3e880ab`, resolving conflicts with user display-name/session work #16).
- Change:
  - **Backend:** new `characters` SQLite table (`server/src/data/characterDb.js`, soft-delete + restore, max 3 active slots, Vietnamese-friendly name validation, `gender` nam/nu + `appearance` with a column migration for older DBs); `character.controller.js` + `character.routes.js` under `/api/users/:userId/characters` (list/create/delete/restore), mounted in `app.js`.
  - **Frontend:** `CharacterSelectModal.jsx` + `character-select.css` (list slots, Tạo mới/Xoá/Khôi phục/Trở lại/Bắt đầu; the "Tạo mới" panel shows 4 portrait tiles + a `Tên` input + Đồng ý/Trở lại) shown after login/register and before entering the world; `apiClient` gains `listCharacters/createCharacter/deleteCharacter/restoreCharacter`; `App.jsx` gates the game behind character selection and persists `activeCharacter` in the session via the shared `session.js`; in-game name now comes from the chosen character (`game.js`, `PlayerVitals.jsx`).
  - **Register:** "Tên hiển thị" field and its virtual-keyboard handling removed from `LoginModal.jsx`; backend still defaults `displayName` to the username.
- Verify: `npm run build` ✅ · `npm test` ✅ **79 passed / 79** (7 files) · `npm --prefix server test` ✅ **34 passed / 34** (+8 API suite incl. gender + a legacy-schema migration test). Integration smoke test against a live server confirmed register → create (with `gender: "nu"`) → list → soft-delete → restore, and a 400 on an invalid gender.
- Review (code-review-and-quality, 2026-10-18): exported a shared `isValidUserId` (dropped the duplicated regex in the controller); collapsed the modal's three post-mutation `listCharacters`+override blocks into one `reload()`; guarded `activeCharacter` against guest sessions; tightened `mapRow`'s `appearance`/`gender` coercion; added the migration regression test. During the rebase, dropped a duplicate `readSession`/`SESSION_KEY` helper in `App.jsx` in favour of the shared `session.js` module introduced by #16.
- Diff: 14 files (> `gate.yaml:maxFiles` 10) → **human merge required**; `server/**` is outside `autoMergeAllowlist`.
- Limitation: game save/progress is still keyed by `userId`, so multiple characters on one account share progress (follow-up if per-character saves are wanted).

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
- [x] F1 (server-synced enemy state) is on `develop`.
- [x] F2 (server-authoritative kill rewards) merged to `develop` — PR #15, squash commit `171359ab` (13-file diff exceeded `gate.yaml:maxFiles`, so a human merged it).
- [ ] F3 (server-authoritative enemy movement) is implemented on `loop/f3-enemy-movement` (PR #19 → `develop`); CI green, waiting on a **human merge** (12-file diff exceeds `gate.yaml:maxFiles`).

## Watch List

- Rollout level: **L2 enabled**. Merge target = `develop` only.
- Pipeline agents in `opencode.json`: `loop-feature`, `feature-propose`, `spec-review`, `implementer`, `verifier`.
- Policy: `gate.yaml` + `docs/safety.md`. Feature menu: `docs/jx2-feature-library.md`.
- Toolchain: Vitest 5 + jsdom; CI at `.github/workflows/ci.yml`.
- Spec review 2026-10-18: APPROVE A4, B5, C5, A5, C6, D4 — `SPEC GATE: PASS`.
- Spec review 2026-10-18 (C2 cycle): APPROVE C7, C8 (new) + C2 — `SPEC GATE: PASS`. (A6 was also approved then but has since been dropped.)
- Feature scout 2026-10-18: proposed C7 (rèn đúc, P3), C8 (cường hoá, P3); queue ~20 todo items. A6 (ngũ hành) dropped by human; B1 expanded to named maps (Trường An, Biện Kinh, Tuyền Châu, Tương Dương).
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
  authoritative `enemy_hit` broadcast. Kill rewards used to stay with the player who
  landed the killing blow; F2 moved them to the server (`enemy_reward`). Respawn
  timeouts are `setTimeout`s on the manager and are cleared in `close()`.
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

## Last Run Evidence (2026-10-18, F2 cycle)

- Item: **F2 — Server-authoritative kill rewards (EXP / bạc / drops)** (spec added to `BACKLOG.md` under EPIC F; `SPEC GATE: PASS` inline).
- Change: new `server/src/rewards.js` rolls the reward from the shared client catalog; `server/src/websocket/gameSocket.js` broadcasts `enemy_reward` once per kill from its own HP pool, attributed to the killing blow. Client: new pure `src/game/rewardSync.js` validates the payload, `CombatSystem.applyServerReward` renders the shared drop on every client but pays EXP/bạc/kill only to the attributed killer (`grantKillReward` also owns level-up, quest and save), `handleWolfKill` keeps the local roll only while offline, `game.js` wires `enemy_reward` and passes the joined player id down.
- Verify: `npm run build` ✅ · `npm test` ✅ **94 passed / 94** (8 files; +20 new across `rewardSync.test.js`, `items.test.js`, `combat.test.js`) · `npm run server:test` ✅ **29 passed / 29** (+4: `rewards.test.js`, `enemy_reward` broadcast + no-double-reward in `websocket.test.js`).
- Verifier (code-review sub-agent, 2026-10-18): REQUEST CHANGES on one medium finding — the shared drop was spawned collectable on every client, so a bystander could pick up another player's kill loot (+5 bạc and the catalog item), duplicating the reward per client. Fixed: `spawnDrop(..., { collectable })` and `collectDrop` refuse drops this client does not own; only the attributed killer's copy is collectable (+3 tests).
- Diff: 13 files (> `gate.yaml:maxFiles` 10) ⇒ **escalated to a human merge**; all paths allowlisted (`src/**`, `**/*.test.js`, `**/*.md`), none in `humanMergeRequired`, no denylist paths.
- Review follow-up (code-review-and-quality, 2026-10-18, `1ec1ecf`): removed the optional drop branch from `grantKillReward` (the caller now rolls and spawns its own drop), bounded the remembered drop list and expired loot this client cannot collect, filed **E4** for splitting the drop concern out of `CombatSystem` ⇒ 94/94 client tests, 29/29 server tests.
- **Enemy movement is server-owned (F3, 2026-10-18):** the shared AI lives in `src/game/enemyAi.js` (`ENEMY_TUNING` + `stepEnemy`: nearest player inside 210 px, chase 43 px/s holding at 52 px, otherwise walk home at 22 px/s). Online the server steps it on a 10 Hz tick (`gameSocket.tickEnemies`, `options.enemyTickMs`), stores/sends whole pixels and broadcasts only wolves that actually moved, so a settled map is silent; the client never steers a wolf (it renders the lead, snapping only on a warp >90 px, otherwise smoothing with `interpolateEnemyPosition`, tau 120 ms). Offline the client steps the same AI against the local player, so single-player still works. Damage reports carry no position, so a hit cannot move a monster; bite damage is still applied client-side (player HP stays local).
- Known remaining local mint (out of scope, filed for a follow-up): `collectDrop` still grants +5 bạc / +5 nội lực to whoever picks a drop up, so a doctored client could still mint on pickup.
- Tooling note: the backend SQLite test suite can flake with `database is locked` when `api.test.js` and `websocket.test.js` open `server/data/jx2.sqlite` as parallel `node --test` workers; 4 subsequent runs were clean.

## Last Run Evidence (2026-10-18, F3 cycle)

- Item: **F3 — Server-authoritative enemy movement** (human promoted the `proposed` spec to `todo`; `SPEC GATE: PASS` inline).
- Change: new shared, pure `src/game/enemyAi.js` (`stepEnemy`/`nearestPlayerInRange` + `ENEMY_TUNING`) owns the AI — online the server drives it, offline the client does; `server/src/websocket/gameSocket.js` runs a 10 Hz tick (`ENEMY_TICK_MS`, `options.enemyTickMs`), rounds positions onto the 1 px grid it broadcasts, broadcasts only moved wolves, no longer accepts or relays client `enemy_move`, and no longer lets an `enemy_hit` carry a position; client `src/game/enemy.js` (`Wolf`) stops steering itself while connected (renders the lead: snap on a warp, else `interpolateEnemyPosition` from `src/game/enemySync.js`) and steps the shared AI itself when offline; `src/game/game.js` drops the 500 ms position report, `src/game/combat.js` reports damage without a position, `src/game/networkClient.js` drops `sendEnemyMove`.
- Verify: `npm run build` ✅ · `npm test` ✅ **122 passed / 122** (10 files; +12: new `src/game/enemy.test.js`, interpolation rules in `enemySync.test.js`) · `npm run server:test` ✅ **49 passed / 49** (+7 `server/tests/enemyAi.test.js`, +1 WebSocket subtest).
- Protocol check: the WebSocket subtest stands one player far away and one beside wolf 1, then asserts both receive the wolf holding short of the *nearer* player, that the settled wolf stops producing `enemy_moved` traffic, that an `enemy_hit` carrying a bogus position leaves the wolf where the server had it, and that a client-sent `enemy_move` is ignored.
- Review (code-review verifier, 2026-10-18): REQUEST CHANGES on two medium findings, both fixed in this branch — `enemy_hit` still wrote the hitter's reported position into the authoritative state (dropped; the client no longer sends it), and deleting the client AI left offline play with stationary wolves (the AI moved to a shared `src/game/enemyAi.js` that the client steps when `networkClient.isConnected` is false). The low finding (stale README line) was fixed too.
- Review follow-up (five-axis pass, 2026-10-18): the offline→online handover no longer slides a wolf toward its spawn before the first snapshot (`Wolf.targetX/Y` start as null and only the server sets them; `revive()` dropped its dead target assignment), now covered by an `enemy.test.js` case. Hot-path allocations and the change sizing were checked and judged fine (8 wolves × ~3 small objects per frame; 14-file diff is one logical change).
- Diff: 12 files (> `gate.yaml:maxFiles` 10) ⇒ **escalated to a human merge**; all paths allowlisted, none in `humanMergeRequired`, no denylist paths.
- Rebase: replayed onto `develop` `18ed17a` (PR #18 character select/create) on 2026-10-18; only `STATE.md`'s header conflicted (both runs wrote the "Last run" line) — resolved by keeping this run's line and #18's section.

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
