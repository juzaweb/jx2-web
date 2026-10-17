# Loop State — jx2-web (Giang Hồ · React + Phaser 3 Wuxia RPG)

Last run: never

## Project Snapshot

- Stack: React 19 + Vite + Phaser 3 (Arcade physics).
- Entry: `src/main.jsx` → `src/App.jsx` (React HUD) + `src/game/game.js` (Phaser scene).
- Bridge: `src/game/bridge.js` (pub/sub between Phaser and React HUD).
- Persistence: `src/game/storage.js` (localStorage, partial).
- Verify command: `npm run build` (no test suite yet — see BACKLOG.md).
- Run locally: `npm run dev` (http://localhost:3000).

## High Priority (loop is acting or waiting on human)

- [ ] Push the local `develop` branch to `origin` so the PR/merge flow works (remote has `main` only).
- [ ] Enable branch protection on `main` on GitHub (human-only merges).
- [ ] (Backlog seed) Add test harness + CI — EPIC E (`npm test` does not exist yet).
- [ ] (Backlog seed) Persist inventory + quest state (`src/game/items.js` is static demo data).

## Watch List

- Rollout level: **L2 enabled** by human on this date. Merge target = `develop` only.
- Pipeline agents defined in `opencode.json`: `loop-feature`, `feature-propose`, `spec-review`, `implementer`, `verifier`.
- Policy: `gate.yaml` + `docs/safety.md`. Feature menu: `docs/jx2-feature-library.md`.
- Backlog source of truth: `BACKLOG.md`.

## Recent Noise (ignored this run)

- Dist build output in `dist/` (gitignored).

---

Backlog: see `BACKLOG.md`
Run log: see `loop-run-log.md` — —
