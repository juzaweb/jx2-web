# Loop State — jx2-web (Giang Hồ · React + Phaser 3 Wuxia RPG)

Last run: 2026-10-18 — feature pipeline cycle (L2, item A4)

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
- [ ] Next loop item after A4: pick highest-priority `todo` in `BACKLOG.md` (C2, A1, A2, B4 at P1).
- [ ] Enable branch protection requirements so CI must pass before merge on `develop`.

## Watch List

- Rollout level: **L2 enabled**. Merge target = `develop` only.
- Pipeline agents in `opencode.json`: `loop-feature`, `feature-propose`, `spec-review`, `implementer`, `verifier`.
- Policy: `gate.yaml` + `docs/safety.md`. Feature menu: `docs/jx2-feature-library.md`.
- Toolchain: Vitest 5 + jsdom; CI at `.github/workflows/ci.yml`.
- Spec review 2026-10-18: APPROVE A4, B5, C5, A5, C6, D4 — `SPEC GATE: PASS`.
- Feature scout 2026-10-18: No proposals this run (sufficient queue: 19 todo items in backlog).
- **Verifier finding (A4, deferred):** In `CombatSystem.damagePlayer`, backward compatibility with existing `game.js:387` calls (`this.combat.damagePlayer(7)`) is preserved via proximity lookup. In a future pass touching `game.js`, cleanly update to `this.combat.onBite(wolf)`.
- **Verifier finding (C1, deferred):** stack quantities live in two places — React
  state snapshot (`App.jsx`) and the `items.js` module singleton. `useItem` never
  decrements, and the HUD would go stale if it did. Wire quantity changes through
  `bridge` when C2 (loot) / C4 (consume) land.

## Verifier Run — A4 (2026-10-18, step 4)

- Skill: code-review-and-quality (5 axes). Scope: PR #5 diff against `develop` (`5b0fa5c`).
- **Correctness:** pure `computeDamage(attacker, defender, rng, options)` with attack-defense mitigation, floor of 1, crit multipliers, and combat log integration. ✅
- **Readability:** clear 4-step logic with JSDoc annotations and straightforward control flow. ✅
- **Architecture:** entity stats and getters on `Player` and `Wolf`, completely decoupled pure damage math. ✅
- **Security:** pure functional design, safe nullish coalescing, no prototype mutation. ✅
- **Performance:** O(1) arithmetic operations with negligible allocations. ✅
- **Tests:** 43/43 pass; 14 new unit tests in `src/game/combat.test.js`. ✅
- Verdict: **APPROVE** — `npm run build` ✅ · `npm test` ✅ 43/43.

## Last Run Evidence (2026-10-18)

- Item: **A4 — Critical hits + attack/defense damage formula** (branch `loop/a4-damage-formula`, PR #5, commit `e5933ca`, worktree `/tmp/opencode/jx2-a4`).
- Change: pure `computeDamage` exported in `combat.js`; integrated into `performAttack`, `performSkill`, `damagePlayer`; Vietnamese combat logs and floating text for critical strikes; base attributes added to `Player` and `Wolf`; 14 unit tests in `combat.test.js`.
- Verify: `npm run build` ✅ · `npm test` ✅ **43 passed / 43** (5 files; +14 new tests in `combat.test.js`).
- Diff: 4 files (≤ `gate.yaml:maxFiles` 10); all paths in `autoMergeAllowlist`, none in `humanMergeRequired` or denylist.
- Merge: PR #5 squashed & merged into `develop` automatically per `gate.yaml`.

## Recent Noise (ignored this run)

- Dist build output in `dist/` (gitignored).

---

Backlog: see `BACKLOG.md`
Run log: see `loop-run-log.md`
