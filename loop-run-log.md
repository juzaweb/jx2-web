# Loop Run Log — jx2-web

Append one entry per run. Prune entries older than 30 days.

## Format

```json
{
  "run_id": "2026-06-09T08:15:00Z",
  "pattern": "daily-triage",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "report-only | fix-proposed | escalated | no-op"
}
```

<!-- Loop appends below this line -->

```json
{
  "run_id": "2026-10-18T04:00:00Z",
  "pattern": "loop-feature",
  "item": "A4",
  "pr": 5,
  "commit": "e5933ca",
  "files_touched": 4,
  "tests_passing": 43,
  "outcome": "merged",
  "target": "develop"
}
```