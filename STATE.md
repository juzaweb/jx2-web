# Loop State — jx2-web (Giang Hồ · React + Phaser 3 Wuxia RPG)

Last run: 2026-10-18 — feature pipeline cycle (L2, item C2)

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

## Verifier Run — C2 (2026-10-18, step 4)

- Skill: code-review-and-quality (5 axes). Scope: PR #7 diff against `develop` (`f8c7efe`); branch `loop/c2-loot-drops`.
- **Correctness:** `collectDrop → addQuantity → onStateChange → saveGame → StorageManager.save({inventory: getQuantities()})` traced; reload path (`App.jsx` mount → `loadInventory`) round-trip independently re-probed; `rollDrop` never returns a non-catalog id. ✅
- **Readability:** full JSDoc, straight control flow, clear names. ✅ (Nit: `DROP_TABLE.find` after `rollDrop` is redundant.)
- **Architecture:** helpers live in `items.js` (catalog + quantities owner); `combat.js` imports one-way, no cycle; matches `Touches`. ✅
- **Security:** input validation on id/amount; adversarial probe confirms no prototype pollution (`__proto__`/`constructor` non-issue and unreachable). ✅
- **Performance:** `rollDrop` O(4), `addQuantity` O(1), no leaks. ✅
- **Tests:** 52/52 pass; `items.test.js` 10 → 19 (+9), no existing test weakened. ✅
- Verdict: **APPROVE** — `npm run build` ✅ · `npm test` ✅ 52/52.

## Last Run Evidence (2026-10-18)

- Item: **C2 — Loot drops feed inventory** (branch `loop/c2-loot-drops`, PR #7, commit `182e8c8`, worktree `/tmp/opencode/jx2-c2`).
- Change: `addQuantity(id, amount)` + weighted `DROP_TABLE`/pure `rollDrop(rng)` in `items.js`; `spawnDrop` rolls a loot entry and `collectDrop` grants it to the persisted inventory with a Vietnamese log line; existing +5 bạc / +5 nội lực and the `onStateChange` save path preserved; 9 unit tests in `items.test.js`.
- Verify: `npm run build` ✅ · `npm test` ✅ **52 passed / 52** (5 files; +9 new tests in `items.test.js`).
- Diff: 3 files (≤ `gate.yaml:maxFiles` 10); all paths in `autoMergeAllowlist` (`src/**`, `**/*.test.js`), none in `humanMergeRequired` or denylist.
- CI: `build-and-test` ✅. Merge: PR #7 squashed & merged into `develop` automatically per `gate.yaml`.

## Recent Noise (ignored this run)

- Dist build output in `dist/` (gitignored).

---

Backlog: see `BACKLOG.md`
Run log: see `loop-run-log.md`
