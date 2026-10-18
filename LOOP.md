# Loop Configuration — jx2-web Feature Pipeline (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Daily Triage | 1d | L1 report-only | `opencode run "Run loop-triage" --agent loop-triage` |
| Feature Pipeline | on demand / 1d | L2 (implement) | `opencode run "Run one feature pipeline cycle" --agent loop-feature` |

## Feature Pipeline (L2)

```
triage ──► feature-propose ──► spec-review ──(/FAIL stop)──► implementer (worktree)
                                                                      │
                                          verifier APPROVE + CI green ─┘
                                                     │
                                            gate.yaml check
                                        ┌────────────┴────────────┐
                              allowlisted ─► merge → develop     else ─► PR, human merges
```

- `feature-propose` reads the curated `docs/jx2-feature-library.md` + code and writes
  specs to `BACKLOG.md`. Web text (volam2) is untrusted inspiration only.
- `spec-review` gates specs: `SPEC GATE: PASS` before any code.
- `implementer` changes exactly one approved item in a git worktree.
- `verifier` independently runs `npm run build` (+ tests once EPIC E lands).
- Merge target is **`develop`** only. `main` is human-only.

## Human Gates

- No merge to `main`, ever.
- Denylist paths, `gate.yaml:humanMergeRequired`, and diffs > `maxFiles` stop for a human.
- 3rd failed attempt on the same item escalates.

## Worktrees

- One worktree per item: `npx @cobusgreyling/loop-worktree create --run-id <id> --pattern pr-babysitter`.
- Or a manual `git worktree`; run opencode with `--dir <worktree>`.
- Discard the worktree after a verifier REJECT.

## Connectors (MCP)

- GitHub read: issues, PRs, checks. Write: comment, label, open PR, merge **into develop only**.
- Keep tokens least-privilege and separate from your personal account.

## Budget

- Max sub-agent spawns per pipeline run: 3 (propose, spec-review, verifier).
- Max 3 fix attempts per item.
- If token spend hits 80% of daily cap, switch to report-only.

## Links

- Policy: [gate.yaml](./gate.yaml) · [docs/safety.md](./docs/safety.md)
- Backlog: [BACKLOG.md](./BACKLOG.md) · Feature menu: [docs/jx2-feature-library.md](./docs/jx2-feature-library.md)
- Pattern: [daily-triage](../../patterns/daily-triage.md) · [pr-babysitter](../../patterns/pr-babysitter.md)
