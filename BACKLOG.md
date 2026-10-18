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

### E4 — Split the loot/drop concern out of CombatSystem · `proposed` · P3
- **Why:** `src/game/combat.js` is ~600 lines mixing the damage model, kill rewards, drop lifecycle, quest progress, player damage, level-up and audio; F2 added five reward methods to it (code review 2026-10-18 flagged the file size as the follow-up to F2). The drop concern — spawning, ownership, expiry, animating and collecting world loot — is self-contained and can be unit tested without a `CombatSystem` instance.
- **Acceptance:** A focused module (e.g. `src/game/drops.js`) owns `spawnDrop`/`updateDrops`/`collectDrop` (ownership + expiry + the drop-list bound); `CombatSystem` delegates to it and keeps only combat/reward orchestration; drop behaviour is covered by tests that build the drop manager directly rather than through `CombatSystem`; `npm run build` and `npm test` stay green with no behaviour change.
- **Touches:** `src/game/combat.js`, new `src/game/drops.js`, new `src/game/drops.test.js`, `src/game/combat.test.js`.
- **Spec gate:** pending — new item awaiting `spec-review`.

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

---

## EPIC B — World & NPC

### B1 — Multiple maps + portals (Biện Kinh, Tuyền Châu, Tương Dương) · `todo` · P2
- **Why:** The world is a single hard-coded map. JX2 travel is defined by distinct cities linked by portals; named maps give the world a sense of place and a backbone for quests, NPCs, and shops. Maps must load **on demand** — preloading every map at boot is too heavy.
- **Acceptance:**
  - A map registry defines ≥4 named maps (Trường An, Biện Kinh, Tuyền Châu, Tương Dương), each with a ground tint/decoration and a spawn point.
  - Only the active map is built/loaded; a map is created lazily when the player enters it via a portal — never preload all maps at startup.
  - On transition the previous map's scene/game objects are torn down, so memory does not grow across travels.
  - A pure helper resolves `{ fromMapId, portalId } → { toMapId, x, y }` and rejects unknown portals/maps.
  - The current map name shows in the HUD/minimap.
  - The player's map id + position save per map and restore after reload.
  - Unit tests cover portal resolution and per-map save/restore.
- **Touches:** `src/game/world.js`, `src/game/game.js`, `src/game/storage.js`, `src/components/HUD/MinimapPanel.jsx`, new `src/game/maps.js`, new `src/game/maps.test.js`.
- **Maps to:** World & NPC `[stretch]` — "Multiple maps with portal transitions".

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

## EPIC F — Multiplayer & Server Sync

### F1 — Server-synced enemy state (position + HP) · `in-progress` · P1
- **Why:** Each client runs its own `EnemyManager`, so a wolf killed on one screen keeps full HP on the screen next to it; the shared world (already live for player positions/chat) is missing its monster state.
- **Acceptance:**
  - A joining client receives the authoritative enemy roster (position, HP, dead flag) in `init_world`.
  - Dealing damage (`damageEnemy`) reports `enemy_hit` to the server; the server owns HP and broadcasts the new value to every client, so a second player sees the same HP drop within one frame.
  - Death and respawn are decided on the server (`enemy_hit` with `isDead`, then `enemy_respawned` after the respawn delay) so all clients agree on kill/respawn timing.
  - Enemy positions reported by clients (`enemy_move`, throttled) are relayed to other clients when the drift is meaningful; clients only snap when the snapshot is far from their local AI position.
  - Server input validation: unknown enemy ids, non-positive damage, un-joined sockets, and malformed position reports are ignored.
  - Unit tests cover the client reconciliation rules (`src/game/enemySync.test.js`) and the WebSocket protocol (`server/tests/websocket.test.js`).
- **Touches:** `server/src/websocket/gameSocket.js`, `src/game/enemy.js`, `src/game/enemySync.js`, `src/game/combat.js`, `src/game/game.js`, `src/game/networkClient.js`, tests.
- **Maps to:** Social / MMO `[stretch]` — shared real-time world state (enemy HP/position).
- **Spec gate:** `SPEC GATE: PASS` (inline spec review, 2026-10-18).

### F2 — Server-authoritative kill rewards (EXP / bạc / drops) · `done` · P2
- **Why:** F1 put enemy HP, death and respawn on the server, but the reward is still minted by whichever client locally crosses HP ≤ 0: `CombatSystem.damageEnemy` → `handleWolfKill` rolled `Phaser.Math.Between(3, 9)` bạc, added a flat +35 EXP, incremented the kill counter, fired `spawnDrop` (a `rollDrop` from `DROP_TABLE`) and persisted the stats through `onStateChange`. That was the only client-authoritative step left in the combat loop — the server's `enemy_hit` broadcast already carried `attackerId`, yet nothing a client received could contradict a doctored payout. Acceptable for the co-op demo, but it has to close before any economy feature that treats bạc/EXP as scarce (B3 shop, C7 rèn đúc, C8 cường hoá).
- **Acceptance:**
  - The server rolls the kill reward when it marks an enemy dead from its own HP pool, attributes the kill to the `attackerId` of the `enemy_hit` that finished it, and broadcasts an `enemy_reward` event.
  - Clients no longer add EXP/bạc/drops on their own when an enemy reaches 0 HP; `handleWolfKill` keeps only presentation (death, log line) and pays out from the server event.
  - A reward is granted exactly once per kill: a duplicate, late, or post-death `enemy_hit` for the same enemy — including the existing "already dead on the server: resync" path — produces no second reward.
  - The reward roll reuses the shared catalog (`items.js` `DROP_TABLE` / `rollKillReward`) so client and server agree on EXP, bạc and loot; the client validates the payload (finite non-negative amounts, catalog-backed drop id) and rejects anything else.
  - A client that did not land the killing blow still renders the shared drop in the world, but that drop is only collectable by the attributed killer, so EXP, bạc and loot for one kill cannot be duplicated across clients.
  - Unit tests cover the server reward roll + attribution under a fixed rng (`server/tests/rewards.test.js`), the broadcast and the no-double-reward rule (`server/tests/websocket.test.js`), the payload validation (`src/game/rewardSync.test.js`) and client-side application (`src/game/combat.test.js`).
- **Touches:** `server/src/rewards.js`, `server/src/websocket/gameSocket.js`, `src/game/items.js`, `src/game/rewardSync.js`, `src/game/combat.js`, `src/game/game.js`, tests.
- **Depends on:** F1 (server-owned enemy HP/death).
- **Maps to:** Social / MMO `[stretch]` — authoritative shared world state; unblocks the economy items (B3, C7, C8).
- **Evidence:** Branch `loop/f2-server-rewards` → PR #15 against `develop`; `npm run build` ✅ · `npm test` ✅ 94/94 (8 files; +20) · `npm run server:test` ✅ 29/29 (+4). Verifier (code-review, 2026-10-18) found the shared drop was collectable by bystanders, which duplicated loot per client → fixed by marking the drop `collectable` only for the attributed killer (+3 tests); a follow-up five-axis `code-review-and-quality` pass then removed the optional-drop branch from `grantKillReward` and bounded the drop list (+2 tests). Diff 13 files (> `gate.yaml:maxFiles` 10) → escalated to a human merge.
- **Spec gate:** `SPEC GATE: PASS` (inline spec review, 2026-10-18).

### F3 — Server-authoritative enemy movement · `done` · P2
- **Why:** F1 gave the server authority over enemy HP, death and respawn, but **movement** still runs on each client: every client drives the local AI (chase the local player within 210 px, otherwise walk home at 22 px/s — `src/game/enemy.js`), reports all alive positions every 500 ms (`src/game/game.js`), the server records them last-writer-wins and relays only ≥40 px drift (`server/src/websocket/gameSocket.js`), and a receiver snaps only beyond 90 px (`src/game/enemySync.js`). An aggroed wolf is therefore pulled toward each client's *own* player: two players watching the same wolf see it up to ~90 px apart, permanently, with a visible jump each time a threshold is crossed. Only idle wolves converge, because both clients walk them to the same `home`. Movement is the last part of the enemy state that is per-client.
- **Acceptance:**
  - The server runs the enemy AI on a fixed tick (order of 10 Hz) with the same tuning as today (aggro range 210 px, chase speed 43 px/s, stop distance 52 px, idle return 22 px/s), targeting the nearest player each tick; the server's enemy position is the single source of truth.
  - Clients stop sending `enemy_move`, and `Wolf.update` no longer steers a live enemy locally — the rendered position comes from the server snapshot only.
  - Clients smooth/interpolate between ticks so movement stays fluid at 60 fps (no teleport inside the interpolation bound) and a larger correction is blended or clamped instead of snapped.
  - Tick rate and interpolation bound are named constants with the bandwidth/smoothness trade-off documented; the service stays within a low single-digit KB/s per client for the current 8-enemy world.
  - Two players on opposite sides of the same wolf see it move identically, and the F1/F2 rules are preserved: HP, death, respawn timing and the kill-reward attribution still behave as specified.
  - Unit tests cover the pure server AI step (nearest-player targeting, idle return, dead enemies ignored) and the client reconciliation/interpolation rule; WebSocket tests assert the roster carries positions and that a client-sent `enemy_move` is ignored.
- **Touches:** new `server/src/enemyAi.js`, `server/src/websocket/gameSocket.js`, `src/game/enemy.js`, `src/game/enemySync.js`, `src/game/game.js`, `src/game/networkClient.js`, tests.
- **Depends on:** F1 (server enemy roster) and F2 (kill attribution must keep pointing at the killer).
- **Maps to:** Social / MMO `[stretch]` — authoritative shared world state.
- **Evidence:** Branch `loop/f3-enemy-movement` → PR #19 against `develop` (promoted from `proposed` to `todo` by the maintainer); `npm run build` ✅ · `npm test` ✅ 121/121 (+11: new `src/game/enemy.test.js`, interpolation rules in `enemySync.test.js`) · `npm run server:test` ✅ 49/49 (+7 `enemyAi.test.js`, +1 WebSocket subtest where a far-away player watches the wolf walk to the nearer player, a settled wolf stops producing traffic, a hit cannot move a wolf, and a client-sent `enemy_move` is ignored).
- **Review (code-review, 2026-10-18):** REQUEST CHANGES on two medium findings, both fixed — `enemy_hit` no longer writes the hitter's reported position into the authoritative state (a client could drag a wolf anywhere, and the render lag pulled it back on every hit), and offline play keeps enemy movement because the shared AI (`src/game/enemyAi.js`) is stepped client-side when no server owns the roster; plus the stale README line. Diff 14 files (> `gate.yaml:maxFiles` 10) → escalated to a human merge.
- **Spec gate:** `SPEC GATE: PASS` (inline spec review + human promotion, 2026-10-18).

---

## Definition of Done (every item)

1. `npm run build` succeeds.
2. If a test harness exists, `npm test` passes and adds coverage for the change.
3. `STATE.md` updated with evidence and next action.
4. Human approves before merge to `main` (see `loop-constraints.md`).
