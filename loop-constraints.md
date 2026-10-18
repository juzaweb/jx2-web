# Loop Constraints

> Add rules below with `/constraints <rule>` in your agent.
> The `loop-constraints` skill reads this file at the start of every run.
> Constraints here are **binding** — the agent MUST follow them.

## Push & Merge
- Auto-merge is allowed ONLY into `develop`. Never merge, push, or commit to `main`.
- `main` receives changes only from a human after review.
- Auto-merge requires: verifier APPROVE + green CI + all changed paths inside `gate.yaml:autoMergeAllowlist` + no path in `humanMergeRequired` + diff <= maxFiles.
- Anything failing a gate condition opens a PR and stops for a human.

## Paths
- Never edit .env, .env.*, auth/, payments/, secrets/, credentials/
- Never edit infrastructure configs without human approval

## Code
- Always run tests before proposing a fix
- Never disable tests to make CI green
- Never refactor unrelated code — one item per run
- One backlog item = one worktree = one PR
- Max 3 fix attempts per item; escalate after
- Enforce the attempt limit mechanically: log each try to `loop-ledger.json` and run `loop-context --check` before retrying (see the `loop-guard` skill)

## Communication
- Always tell me what you're about to do before doing it
- Never close an issue or PR without my approval

## Budget
- If token spend hits 80% of daily cap, switch to report-only
- If loop-pause-all is active, exit immediately

---
<!-- Add your own rules below. Use plain English. The loop reads this verbatim. -->
