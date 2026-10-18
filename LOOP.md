# Loop Configuration — jx2-web Feature Pipeline (Opencode)

## Active Loops

| Pattern | Cadence | Status | Command |
|---------|---------|--------|---------|
| Daily Triage | 1d | L1 report-only | `opencode run "Run loop-triage" --agent loop-triage` |
| Feature Pipeline | on demand / 1d | L2 (implement) | `opencode run "Run one feature pipeline cycle" --agent loop-feature` |

## Feature Pipeline (L2)

```
triage ──► feature-propose ──► spec-review ──(/FAIL stop)──► BACKLOG `proposed`
                                                                     │
                                              human approves: proposed ─► todo
                                                                     │
                                                         implementer (worktree, `todo` items only)
                                                                     │
                                          verifier APPROVE + CI green ─┘
                                                     │
                                            gate.yaml check
                                        ┌────────────┴────────────┐
                              allowlisted ─► merge → develop     else ─► PR, human merges
```

- `feature-propose` reads the curated `docs/jx2-feature-library.md` + code and writes
  specs to `BACKLOG.md` as `proposed` items. Web text (volam2) is untrusted inspiration only.
- `spec-review` is a quality gate on proposals: `SPEC GATE: PASS` before anything is
  eligible — but a **human** promotes `proposed` → `todo` to authorize implementation.
- `implementer` changes exactly one `todo` (human-approved) item in a git worktree.
- `verifier` independently runs `npm run build` (+ tests once EPIC E lands).
- Merge target is **`develop`** only. `main` is human-only.

## Human Gates

- **Item approval (human-in-the-loop):** `feature-propose` writes new items with
  status `proposed`. A human promotes `proposed` → `todo` in `BACKLOG.md` to
  authorize implementation. The loop implements **only `todo` items**; with none
  it stops after proposing/reviewing.
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

## Automatic Cadence (cron)

Run the guarded runner `scripts/loop-cron.sh` from cron. It enforces the
cadence and every safety precondition before a cycle starts.

Recommended cadence:

- **Feature pipeline (L2):** every 1–2h. Default day window `08:00–22:00`
  (2h → 7 cycles/day); widen the window to run at night (2h over 24h → 12
  cycles/day). Each cycle is small (one item, one PR merged into `develop`).
- **Night gap (`22:00–08:00`):** with the default window, only `loop-triage`
  in report-only (L1) runs — no code. Removing the window lets the loop merge
  unattended overnight; treat `develop` as integration and review it daily.
- **Warm-up:** start at 2h intervals for 2–3 days, watch for conflicts,
  duplicate/low-value items, and rising test time, then tighten if desired.
- Never faster than 1 run/hour; offset the minute so runs never overlap.

Guardrails the script applies (all must hold or it skips):

- single-instance lock (`flock`) — no concurrent cycles;
- on `develop` with a **clean** working tree;
- no leftover `loop/*` branch or loop worktree (interrupted run);
- `develop` fast-forwards cleanly from `origin/develop`;
- hard per-run `timeout` (default 30m) so a stuck cycle cannot hang cron.

Hard requirements this depends on (do not automate without them):

- CI (`build-and-test`) required + branch protection on `develop`;
- an actually-independent verifier — the same model must not write and sign off;
- token budget cap → report-only at 80% (see Budget above);
- review `develop` at least once per day; treat `develop` as integration and
  `main` as the human-approved branch.

Example crontab (hourly at :05, log to `/tmp/jx2-loop-cron.log`):

```cron
5 8-21 * * * /home/theanh/projects/jx2-web/scripts/loop-cron.sh
```

Override defaults with env vars: `JX2_START_HOUR`, `JX2_END_HOUR`,
`JX2_TIMEOUT`, `JX2_MODEL`, `JX2_AGENT`, `JX2_LOG`, `JX2_AUTO_FLAG`.

## Links

- Policy: [gate.yaml](./gate.yaml) · [docs/safety.md](./docs/safety.md)
- Backlog: [BACKLOG.md](./BACKLOG.md) · Feature menu: [docs/jx2-feature-library.md](./docs/jx2-feature-library.md)
- Pattern: [daily-triage](../../patterns/daily-triage.md) · [pr-babysitter](../../patterns/pr-babysitter.md)
