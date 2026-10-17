# BACKLOG — jx2-web (Giang Hồ · Wuxia RPG)

Feature backlog the loop pulls work from. Ordered by priority within each epic.
Status legend: `todo` · `in-progress` · `blocked` · `done`.

> Loop rules: one item per run, small PRs, verify with `npm run build`
> (plus the item's own tests once a harness exists). Update this file + `STATE.md`
> after each run. Do not start an epic's next item before the current one is `done`.

---

## EPIC E — Engineering Quality (do these first)

### E1 — Add a test harness · `done` · P0
- **Why:** No `npm test` exists; nothing guards combat/storage/items logic.
- **Scope:** Add Vitest + jsdom config; add `test` + `test:ci` scripts.
- **Acceptance:**
  - `npm test` runs and passes.
  - A first unit test covers `src/game/storage.js` save/load round-trip.
  - A unit test covers item catalog shape in `src/game/items.js`.
- **Touches:** `package.json`, `vite.config.js`, new `src/**/*.test.js`.
- **Evidence:** Vitest 5 + jsdom; 16 tests pass across `storage.test.js`, `items.test.js`, `bridge.test.js`.

### E2 — CI workflow (build + test) · `done` · P0
- **Why:** No `.github/workflows`; regressions land unseen.
- **Acceptance:** PR triggers `npm ci` → `npm run build` → `npm test`; fails on error.
- **Touches:** `.github/workflows/ci.yml`.
- **Evidence:** `.github/workflows/ci.yml` runs on PR to `main`/`develop` and push to `develop`.

### E3 — Playwright smoke test · `todo` · P1
- **Why:** Need proof the game actually boots in a browser.
- **Acceptance:** Loads app, canvas mounts, HUD (vitals, hotbar) visible; no console errors.
- **Touches:** new `e2e/`, Playwright config.

---

## EPIC C — Items & Progression

### C1 — Persist inventory state · `todo` · P0
- **Why:** `src/game/items.js` is explicitly static demo data; quantities reset on reload.
- **Acceptance:** Inventory + quick-slot quantities load from and save to `storage.js`.
- **Touches:** `src/game/items.js`, `src/game/storage.js`, `src/components/Modals/InventoryModal.jsx`.

### C2 — Loot drops feed inventory · `todo` · P1
- **Why:** Kills drop items visually but inventory is static.
- **Acceptance:** Enemy drop adds to inventory quantity; persists across reload.
- **Touches:** `src/game/combat.js`, `src/game/items.js`.

### C3 — Equipment affects stats · `todo` · P2
- **Why:** Weapons/armor exist as inert icons only.
- **Acceptance:** Equipping a weapon/armor changes attack/defense; reflected in HUD.
- **Touches:** `src/game/player.js`, `src/components/HUD/PlayerVitals.jsx`.

### C4 — Use consumables from inventory grid · `todo` · P2
- **Acceptance:** Clicking a consumable in `InventoryModal` triggers `ACTION_USE_POTION` and decrements qty.
- **Touches:** `src/components/Modals/InventoryModal.jsx`.

---

## EPIC A — Combat & Skills

### A1 — Multiple skills with cooldown + MP cost · `todo` · P1
- **Why:** Only one skill ("Kiếm Khí") wired to Q/8.
- **Acceptance:** ≥3 skills; each has MP cost, cooldown, hotbar binding, HUD cooldown cue.
- **Touches:** `src/game/combat.js`, `src/components/HUD/HotbarDock.jsx`.

### A2 — Level-up stat increases · `todo` · P1
- **Acceptance:** EXP threshold triggers level-up; maxHp/maxMp/attack increase; chat log announces it.
- **Touches:** `src/game/player.js`, `src/game/combat.js`.

### A3 — Enemy variety (ranged + elite) · `todo` · P2
- **Touches:** `src/game/enemy.js`, `src/game/world.js`.

---

## EPIC B — World & NPC

### B1 — Multiple maps + portals · `todo` · P2
### B2 — NPCs + dialogue system · `todo` · P2
### B3 — Shop NPC (buy/sell with coins) · `todo` · P3
### B4 — Quest system (log, rewards, multi-quest) · `todo` · P1
- **Why:** Quest is a single hard-coded kill counter (`progress/total`).
- **Acceptance:** Quest definitions, active-quest tracker in HUD, reward on completion, persists.
- **Touches:** `src/game/`, `src/components/HUD/MinimapPanel.jsx`.

---

## EPIC D — UX / HUD

### D1 — HUD accessibility pass · `todo` · P2
- **Why:** Modals/HUD need keyboard nav, ARIA, focus management, contrast.
- **Touches:** `src/components/**`.

### D2 — Mobile controls polish · `todo` · P3
### D3 — Settings persistence (audio/graphics) · `todo` · P3

---

## Definition of Done (every item)

1. `npm run build` succeeds.
2. If a test harness exists, `npm test` passes and adds coverage for the change.
3. `STATE.md` updated with evidence and next action.
4. Human approves before merge to `main` (see `loop-constraints.md`).
