# BACKLOG — jx2-web (Giang Hồ · Wuxia RPG)

Feature backlog the loop pulls work from. Ordered by priority within each epic.
Status legend: `proposed` · `todo` · `in-progress` · `blocked` · `done`.
- `proposed` — AI proposal awaiting **human approval**.
- `todo` — human-approved, ready to implement (the loop only picks these).

> **Human approval gate:** `feature-propose` writes new items as `proposed`.
> A human promotes an item to `todo` to approve it for implementation. The loop
> implements only `todo` items; if none exist it stops after proposing.
>
> Loop rules: one item per run, small PRs, verify with `npm run build`
> (plus the item's own tests once a harness exists). Update this file + `STATE.md`
> after each run. Do not start an epic's next item before the current one is `done`.

---

## EPIC E — Engineering Quality (do these first)

### E1 — Add a test harness · `done` · P0
- **Why:** No `npm test` exists; nothing guards combat/storage/items logic.
- **Scope:** Add Vitest + jsdom config; add `test` + `test:watch` scripts.
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

### C1 — Persist inventory state · `done` · P0
- **Why:** `src/game/items.js` is explicitly static demo data; quantities reset on reload.
- **Acceptance:** Inventory + quick-slot quantities load from and save to `storage.js`.
- **Touches:** `src/game/items.js`, `src/game/storage.js`, `src/components/Modals/InventoryModal.jsx`.
- **Evidence:** Merged in `89c5bd5`; 24 unit tests passing across storage and items suites.

### C2 — Loot drops feed inventory · `done` · P1
- **Why:** Kills drop items visually but inventory is static.
- **Acceptance:** Enemy drop adds to inventory quantity; persists across reload.
- **Touches:** `src/game/combat.js`, `src/game/items.js`.
- **Evidence:** Merged PR #7 (`182e8c8`); `addQuantity` + weighted `DROP_TABLE`/`rollDrop` in `items.js`; `collectDrop` grants the rolled item and persists via `saveGame`; 52 unit tests passing (+9 in `items.test.js`); verifier APPROVE.
- **Maps to:** Loot & Economy `[core]` — "Enemy drop tables feeding inventory".

### C3 — Equipment affects stats · `todo` · P2
- **Why:** Weapons/armor exist as inert icons only.
- **Acceptance:** Equipping a weapon/armor changes attack/defense; reflected in HUD.
- **Touches:** `src/game/player.js`, `src/components/HUD/PlayerVitals.jsx`.

### C4 — Use consumables from inventory grid · `todo` · P2
- **Acceptance:** Clicking a consumable in `InventoryModal` triggers `ACTION_USE_POTION` and decrements qty.
- **Touches:** `src/components/Modals/InventoryModal.jsx`

### C5 — Item rarity tiers with colored tooltips · `todo` · P2
- **Why:** Every item renders identically; the JX2 rarity tiers (thường / lam / kim / huyền) are missing, so loot has no visible value gradient.
- **Acceptance:** Each item in `QUICK_ITEMS` and `INVENTORY_ITEMS` declares `rarity` in `{common, uncommon, rare, epic}`; inventory names and tooltips apply a per-rarity CSS class/colour; a unit test asserts every item has a valid rarity and that all four tiers appear at least once.
- **Touches:** `src/game/items.js`, `src/components/Modals/InventoryModal.jsx`, `src/components/HUD/HotbarDock.jsx`, `src/styles/item-icons.css`, `src/game/items.test.js`.
- **Maps to:** Items & Equipment `[stretch]` — "Item rarity tiers (thường / lam / kim / huyền)".

### C6 — Sect initiation & stat affinities · `todo` · P2
- **Why:** The player is permanently an unaffiliated "Lãng Khách" with fixed base stats; JX2 character identity centers on choosing a môn phái (Thiếu Lâm, Võ Đang, Nga My) with distinct stat affinities and titles.
- **Acceptance:** A pure catalog defines ≥3 sects (`thieu-lam`, `vo-dang`, `nga-my`) with Vietnamese names, descriptions, and stat affinity modifiers (e.g. Thiếu Lâm +HP/DEF, Võ Đang +MP/ATK, Nga My +HP/MP regen); player can select or switch sect via `Lệnh Bài Môn Phái` or dialogue; chosen sect persists in `storage.js`; HUD and player overhead name display the sect title (e.g. "Võ Đang Đệ Tử"); unit tests verify stat modifier calculation, storage round-trip, and invalid sect ID rejection.
- **Touches:** `src/game/player.js`, `src/game/storage.js`, `src/components/HUD/PlayerVitals.jsx`, new `src/game/sect.js`, new `src/game/sect.test.js`.
- **Maps to:** Factions & Classes `[core]` — "Sect affects starting stats and one signature skill".

### C7 — Material refinement / crafting (rèn đúc) · `todo` · P3
- **Why:** The catalog already carries refinement materials — `huyen-kim-thach` ("dùng để rèn đúc trang bị"), `hoang-kim-huyen-thiet`, `yeu-dan`, `bach-nien-linh-chi` — but nothing consumes them, so loot has no sink. Crafting turns farmed materials into existing weapons/armor and closes the loot → gear loop.
- **Acceptance:** A pure `RECIPES` catalog defines ≥3 recipes, each mapping input `{ itemId: qty }` materials to one output equipment id already present in `INVENTORY_ITEMS`, and every referenced id exists in the catalog; `canCraft(quantities, recipeId)` reports whether all inputs are satisfied; `craft(quantities, recipeId)` returns `{ ok, quantities }`, consuming inputs and adding the output only when `canCraft` is true and leaving quantities untouched on failure or an unknown recipe; crafted changes persist through `storage.js` and round-trip after reload; a `Rèn Đúc` action (new modal or a section in `InventoryModal`) lists recipes and disables those with insufficient materials; unit tests cover sufficient materials (inputs consumed, output added), insufficient materials (no mutation), unknown-recipe rejection, and a storage save/load round-trip.
- **Touches:** new `src/game/recipes.js`, new `src/game/recipes.test.js`, `src/game/items.js`, `src/game/storage.js`, `src/components/Modals/InventoryModal.jsx`.
- **Maps to:** Loot & Economy `[stretch]` — "Material refinement / crafting (rèn đúc)".
- **Depends on:** C1 (done) for persisted quantities; benefits from C2 for material drops.

### C8 — Equipment enhancement (cường hoá) +0..+N · `todo` · P3
- **Why:** JX2's signature gear sink is cường hoá: spend stones for a chance to raise a piece +0 → +N, with a downgrade risk at high levels. The equipment in `INVENTORY_ITEMS` is currently inert and there is no risk/reward progression axis.
- **Acceptance:** A pure `ENHANCE_TABLE` maps level → `{ successChance, downgradeChance }` for +0..+10, with success chance decreasing and a non-zero downgrade risk above a threshold; `enhance(level, rng)` returns `{ nextLevel, result: "success" | "fail" | "downgrade" }` and is deterministic for a fixed rng; enhancement consumes a material (e.g. a `huyen-tinh-thach` stone added to the catalog) and is rejected at max level or without materials; each `+N` grants a documented attack/defense bonus; enhanced levels persist through `storage.js`; `InventoryModal` shows the `+N` suffix on enhanced gear and exposes an enhance action; unit tests cover guaranteed success, failure without downgrade, failure with downgrade, max-level rejection, and material consumption.
- **Touches:** new `src/game/enhance.js`, new `src/game/enhance.test.js`, `src/game/items.js`, `src/game/storage.js`, `src/components/Modals/InventoryModal.jsx`.
- **Maps to:** Items & Equipment `[stretch]` — "Enhancement (cường hoá) +0..+N with success chance and downgrade risk".
- **Depends on:** C3 for equip stats (bonus targets attack/defense).

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

### A4 — Critical hits + attack/defense damage formula · `done` · P1
- **Why:** Damage is a flat random range (`Phaser.Math.Between(17, 25)`); there is no attack/defense formula or crit, so C3 equipment stats would have nothing to affect.
- **Acceptance:** A pure `computeDamage(attacker, defender, rng)` returns `{ damage, crit }`, applying attack-minus-defense mitigation, a minimum-damage floor of 1, and a crit multiplier; `performAttack`/`performSkill` use it and the combat log marks critical hits; unit tests cover the floor, the crit path, and a deterministic rng.
- **Touches:** `src/game/combat.js`, `src/game/player.js`, `src/game/enemy.js`, new `src/game/combat.test.js`.
- **Evidence:** Merged PR #5 (`e5933ca`); 43 unit tests passing (14 new in `combat.test.js`); verifier APPROVE.
- **Maps to:** Combat `[core]` — "Critical hits, damage formula with attack/defense".

### A5 — Combat status effects & buff slot · `todo` · P2
- **Why:** Combat currently only performs instant HP subtractions; there are no ongoing effects like damage-over-time (Trúng độc) or stat buffs (Hộ thể khí), leaving the existing `#buff-slot` in PlayerVitals static and unfunctional.
- **Acceptance:** A pure status effect engine `updateBuffs(buffs, deltaMs)` handles duration decay, interval-based ticks, and stat modifiers; supports at least one buff ("Hộ Thể Khí" reducing damage taken) and one debuff ("Trúng Độc" dealing periodic damage); active buffs display in the PlayerVitals buff slot with name, icon, and remaining timer; combat log announces effect application and expiration; unit tests cover duration decay, tick triggers, modifier application, and clean expiration removal.
- **Touches:** `src/game/combat.js`, `src/game/player.js`, `src/components/HUD/PlayerVitals.jsx`, new `src/game/buffs.js`, new `src/game/buffs.test.js`.
- **Maps to:** Skills `[stretch]` — "Buffs / debuffs with duration and stacking rules".

### A6 — Elemental damage types & resistances (ngũ hành) · `todo` · P2
- **Why:** `computeDamage` is purely physical. JX2 combat depth comes from the ngũ hành wheel (Kim / Mộc / Thủy / Hỏa / Thổ), where a skill's element is stronger or weaker against a defender's element; this extends the A4 formula into a typed one so future skills and enemies have meaningful match-ups.
- **Acceptance:** A pure `ELEMENTS` catalog exports `kim`, `moc`, `thuy`, `hoa`, `tho` with Vietnamese labels; `computeDamage` accepts an attacker element (`options.element`) and a defender element (`options.defenderElement`, falling back to `defender.element`) and applies an element multiplier (neutral 1.0, strong 1.5, weak 0.75) before the minimum-damage floor of 1; behaviour with no element supplied is unchanged (floor, crit, and variance still hold); `performAttack`/`performSkill` pass the player's element and each `Wolf` declares an element; the combat log names the element on a strong/weak hit; unit tests cover neutral, strong, weak, and missing-element cases and confirm the floor of 1 survives a weak hit.
- **Touches:** `src/game/combat.js`, `src/game/player.js`, `src/game/enemy.js`, `src/game/combat.test.js`.
- **Maps to:** Combat `[stretch]` — "Elemental types and resistances".
- **Depends on:** A4 (done) for `computeDamage`.

---

## EPIC B — World & NPC

### B1 — Multiple maps + portals · `todo` · P2
### B2 — NPCs + dialogue system · `todo` · P2
### B3 — Shop NPC (buy/sell with coins) · `todo` · P3
### B4 — Quest system (log, rewards, multi-quest) · `todo` · P1
- **Why:** Quest is a single hard-coded kill counter (`progress/total`).
- **Acceptance:** Quest definitions, active-quest tracker in HUD, reward on completion, persists.
- **Touches:** `src/game/`, `src/components/HUD/MinimapPanel.jsx`

### B5 — Day/night ambience cycle · `todo` · P3
- **Why:** The world is permanently tinted daylight; a slow day/night cycle adds JX2 atmosphere and makes the street lanterns meaningful.
- **Acceptance:** A pure `tintForTime(elapsedMs)` maps a cycle position to an RGB tint plus lantern intensity; the scene applies it each frame and cycles over a fixed period; a unit test covers the mapping endpoints and determinism.
- **Touches:** `src/game/world.js`, `src/game/game.js`, new `src/game/world.test.js`.
- **Maps to:** Presentation `[stretch]` — "Day/night and weather on the world map".

---

## EPIC D — UX / HUD

### D1 — HUD accessibility pass · `todo` · P2
- **Why:** Modals/HUD need keyboard nav, ARIA, focus management, contrast.
- **Touches:** `src/components/**`.

### D2 — Mobile controls polish · `todo` · P3
### D3 — Settings persistence (audio/graphics) · `todo` · P3

### D4 — Interactive chat channels · `todo` · P3
- **Why:** The chat input bar contains a non-functional static button (`[ Cận ] ▼`) and hardcodes every message to the "near" channel; JX2 players rely on switching channels (Thế giới, Môn phái, Tổ đội, Cận) to communicate.
- **Acceptance:** Clicking `#chat-channel-btn` toggles a selector enabling the player to choose active channel (`near`, `world`, `sect`, `team`); outgoing messages carry the selected channel `type` and render with corresponding Vietnamese bracket tag (`[Cận]`, `[Thế giới]`, `[Môn phái]`, `[Tổ đội]`) and distinct color style; ChatPanel tab filtering scopes or shows messages accordingly; unit tests verify channel switching, message formatting with the channel prefix/type, and filter matching.
- **Touches:** `src/components/HUD/ChatPanel.jsx`, `src/App.jsx`, `src/index.css`, new `src/components/HUD/ChatPanel.test.jsx`.
- **Maps to:** Social / MMO `[stretch]` — "Chat channels: thế giới / môn phái / tổ đội".

---

## Definition of Done (every item)

1. `npm run build` succeeds.
2. If a test harness exists, `npm test` passes and adds coverage for the change.
3. `STATE.md` updated with evidence and next action.
4. Human approves before merge to `main` (see `loop-constraints.md`).
