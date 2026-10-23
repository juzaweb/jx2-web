# CRITICAL PROTOCOLS

## Language Split
- **Interpersonal Communication:** ALL chat, logic explanations, and feedback MUST be in **VIETNAMESE**.
- **Technical Artifacts:** ALL code, docstrings, and **GIT COMMIT MESSAGES** MUST be in **ENGLISH**.
- **STRICT:** Never use Vietnamese in Git logs or Commit messages under any circumstances.
- **DO NOT** commit or push anything without permission.

### General Rules

- Ask clarifying questions until you are at least 95% confident that you understand the task and can successfully complete it.
- Never make assumptions when a missing requirement could materially affect the implementation.
- Before writing any source code, define the implementation logic and potential error cases / edge cases.
- Always use the `/code-review-and-quality` skill to review and fix any code changes.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a fileor symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

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
- Documented verify command: `npm run build && npm test` (Vitest + jsdom).
- Work source: pick exactly one `todo` item from `BACKLOG.md`, highest priority first.
- Move an item to `done` only when it meets the Definition of Done in `BACKLOG.md`.
- Game content strings are Vietnamese; code, identifiers, and commit messages stay English.
