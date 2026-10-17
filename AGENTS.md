# AGENTS.md — Opencode Minimal Loop

These rules are loaded by opencode before loop work.

## Loop Mode

- Start in L1 report-only mode.
- Read `STATE.md` before any triage.
- Update `STATE.md` after every loop run.
- Do not edit source code until the human explicitly enables L2.

## Safety

- Never commit, push, or merge to `main`. That branch is human-only.
- Auto-merge is allowed only into `develop`, and only when `gate.yaml` permits it.
- Never edit `.env`, `.env.*`, `auth/`, `payments/`, `secrets/`, or `credentials/`.
- Use a git worktree for every code-changing attempt.
- Max 3 fix attempts per item; escalate after that.

## Pipeline

- One cycle: `feature-propose` → `spec-review` (must PASS) → `implementer` (worktree) → `verifier` → PR → merge into `develop`.
- Run a cycle with: `opencode run "Run one feature pipeline cycle" --agent loop-feature`.
- Stop and escalate if a diff exceeds `gate.yaml:maxFiles` or touches a denylisted path.

## Verification

- For L2+ changes, dispatch a verifier sub-agent after implementation.
- Run the project's documented tests before proposing a fix.
- Record test evidence in `STATE.md`.

## Project (jx2-web)

- Stack: React 19 + Vite + Phaser 3 (Arcade physics).
- Documented verify command: `npm run build`. There is no test runner yet
  (see `BACKLOG.md` EPIC E); do not invent one as part of an unrelated change.
- Work source: pick exactly one `todo` item from `BACKLOG.md`, highest priority first.
- Move an item to `done` only when it meets the Definition of Done in `BACKLOG.md`.
- Game content strings are Vietnamese; code, identifiers, and commit messages stay English.
