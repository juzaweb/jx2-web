# Game Feature Proposals

- **Date:** 2025-05-18
- **Project / engine:** React 18, Vite, Phaser 3 (Arcade Physics), Node.js / WebSocket server authority
- **Genre / target platform:** Browser-playable isometric 2.5D wuxia RPG (PC desktop & mobile web browser)
- **Development stage:** Playable Alpha / Content Expansion (2 functional maps, weapon-kit skill architecture, server-authoritative combat)
- **Audit scope:** `src/game/` (progression, equipment, items, skills, shop, combat, maps, worldManager), `src/components/` (HUD, Modals, MobileControls), `server/src/` (gameSocket, rewards, enemy loop), and `docs/`
- **Limitations:** Live high-concurrency multiplayer latency (>200ms) was not benchmarked in real network conditions; art assets are constrained to programmatically generated vector graphics and existing sprite sheets.

## Executive summary

Giang Hồ is a React and Phaser 3 browser wuxia RPG inspired by classic Vietnamese martial arts MMORPGs (Võ Lâm Truyền Kỳ 2). The game features a solid technical foundation: 60FPS Arcade physics, server-authoritative movement/combat/rewards, bi-directional React-Phaser bridge, persistent storage, and two playable maps (Biện Kinh market town and Đông Môn Thành 270-monster hunting grounds).

While core combat and navigation are functional, current playability faces four distinct design gaps:
1. **Economic Sink & Upgrading Void:** Monsters pay silver and occasionally drop a skill book or a weapon, but silver is only spent on basic potions at Dược Sư; there is no gear-enhancement or material sink yet.
2. **Combat Usability in Dense Camps:** Đông Môn Thành features 18 camps with 15 monsters each (270 total). Target selection lacks a visual lock indicator and range preview ring, leading to ambiguous target selection during dense fights.
3. **Weapon Kit Depth:** The sect system was replaced by weapon kits (sword / gloves / saber) with book-based learning (`docs/weapon-skills.md`), but each weapon has a single item and a small kit — expanding those kits and weapon sources is the current content gap.
4. **Short-Term Goal Absence:** Aside from grinding monster camps for EXP, players lack structured daily objectives. The HUD minimap has a Quest Tracker stub (`MinimapPanel.jsx`), but no repeatable quest engine exists.

This document proposes 5 prioritized, evidence-backed features designed to deepen the core loop without introducing feature bloat or scope creep.

---

## Current game and core loop

The implemented gameplay loop follows a classic ARPG structure:

1. **Player Goal:** Advance character level (up to 99), acquire silver coins and rare materials, learn weapon skills from books, and conquer higher-level monster camps (from level 3 Sơn Cẩu up to level 29 Ma Giáo Đệ Tử).
2. **Core Player Actions:** Direct movement (WASD, click-to-move, or mobile joystick), casting the skill bound to a hotbar slot (`1`-`9`, assigned by dragging from the `F5` tree), consumable usage from hotbar slots, and talking to shopkeepers (`NPC_DUOC`).
3. **Challenge / Opposition:** Aggressive and leashed enemy camps (`src/game/enemyCatalog.js`) in Đông Môn Thành (`dongMonThanhMap.js`). Enemies bite, pathfind toward players, and respawn on server ticks.
4. **Feedback and Rewards:** Server-calculated damage numbers, floaty text, Web Audio synth sounds, EXP bar gains, silver payouts, and server-rolled skill-book/weapon drops (`rollEnemyReward` in `server/src/rewards.js`).
5. **Progression and Persistence:** Level vitals calculated in `src/game/progression.js`, equipment stat bonuses derived in `src/game/equipment.js` (`attack`, `defense`, `maxHp`, `maxMp`, `critRate`, `accuracy`), all server-owned via `server/src/websocket/gameSocket.js`; only hotbar/mobile bindings live in `localStorage` (`src/game/storage.js`).

---

## Ranked feature shortlist

| Priority | Feature | Target Player Value | Effort | Confidence |
| --- | --- | --- | --- | --- |
| **P1** | **Equipment Enhancement System (Cường Hóa Trang Bị)** | Converts silver (plus a new upgrade material) into stat growth (+1 to +10 gear), solving silver accumulation. | M | High |
| **P1** | **Target Selection & Visual Lock Indicator (Khóa Mục Tiêu)** | Renders visual target ring & range feedback in 270-monster camps, fixing targeting ambiguity on PC & mobile. | S | High |
| **P1** | **Weapon Kit Expansion & Weapon Sources** | Deepens the implemented sword/gloves/saber kits and adds more weapon items (drops or a smith) so players can specialize. | M | High |
| **P2** | **Daily Bounty Quest System (Nhiệm Vụ Dã Tẩu)** | Reuses Minimap quest tracker UI to offer repeatable monster hunt contracts with silver and material rewards. | M | High |
| **P2** | **Elite Monster Encounter (Trảm Tướng Đông Môn Thành)** | Adds an elite Boss spawn (Ma Giáo Trưởng Lao) in camp 18 to serve as a high-risk pinnacle test for level 25+ players. | S | Medium |

---

## Feature proposals

### [P1] Equipment Enhancement System (Cường Hóa Trang Bị)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Gives silver coins a progression purpose beyond potions. Allows players to continuously upgrade equipped gear (`weapon`, `armor`, `helmet`, `accessory`), giving tangible power progression when facing high-level camps in Đông Môn Thành.
- **Design summary:** Players visit a Blacksmith NPC or open an Enhancement tab in the equipment sheet. Inserting an equipped item costs silver coins and 1x an upgrade material (e.g. a new Huyễn Kim Thạch item). Enhancing increases item bonus stats (e.g. `attack +2` per rank) up to +10. Success rate starts at 100% (+1 to +3) and scales down to 40% (+10), with failure retaining the item but consuming materials.
- **Core loop connection:** Monster kill -> Silver & upgrade material -> Blacksmith Enhancement -> Higher stats (`attack`, `defense`, `maxHp`) -> Able to farm higher-level camps.
- **MVP scope:**
  - Enhance equipped items up to +6 with deterministic silver + material cost.
  - Server-authoritative enhancement validation (`server/src/websocket/gameSocket.js`).
  - Stat multiplier applied in `deriveEquipmentBonuses()` in `src/game/equipment.js`.
  - Simple visual enhancement level indicator (`+1` .. `+6` badge) on equipment slots.
- **Optional extensions:**
  - Visual glowing aura / particle effect on character rig for +7 and above weapons (`heroRigView.js`).
  - Protection talismans to prevent downgrades on higher tiers (+7 to +10).
- **Dependencies:** `src/game/equipment.js`, `src/game/items.js`, `server/src/websocket/gameSocket.js`.
- **Risks and trade-offs:** Must be server-authoritative to prevent cheated upgrades. Requires clear UI feedback for success/failure.
- **Effort:** M — Server validation logic, pure equipment modifier extension, and UI integration.
- **Acceptance criteria:**
  - [ ] Player can submit an equipped item, required silver, and the upgrade material to enhance gear.
  - [ ] Enhancing item updates `deriveEquipmentBonuses()` with upgraded stat values.
  - [ ] Server validates silver and material balance before confirming enhancement.
  - [ ] Failed attempts deduct materials without destroying or corrupting equipped item.
- **Validation plan:** Unit test enhancement logic in `equipment.test.js`; integration test server websocket handler with mock silver/material quantities.
- **Evidence:** There is no upgrade material in the item catalog today; the proposal would add one to `src/game/items.js` (and a drop or shop source) before it can be spent.
- **Assumptions / open questions:** Enhancement values are flat additions to `bonuses` object.

---

### [P1] Target Selection & Visual Lock Indicator (Khóa Mục Tiêu Chiêu Thức)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Prevents mis-clicks and wasted skill casts when fighting crowded monster camps (e.g., 15 monsters per camp in Đông Môn Thành). Gives immediate visual clarity on which enemy is targeted and whether it is within skill cast range.
- **Design summary:** Clicking or tapping an enemy locks it as the active target, drawing a ground indicator ring (gold/red vector circle) beneath its feet. If a target is locked, single-target skills like `dai_tu_di_chuong` automatically cast toward the locked target. Range indicator changes color (green = in range, red = out of range).
- **Core loop connection:** Improves combat precision and skill responsiveness during intense hunting sessions.
- **MVP scope:**
  - Active target state stored in Phaser scene (`JiangHuScene.activeTarget`).
  - Ground ring graphic rendered under active target in `src/game/healthBarView.js` or dedicated target indicator component.
  - Skill cast targets `activeTarget` if valid and alive; falls back to cursor or auto-proximity when no target is locked.
  - Pressing `Tab` or clicking empty ground selects nearest target or clears selection.
- **Optional extensions:**
  - Target portrait HUD widget displaying target HP %, level, and monster name.
  - Mobile auto-target locking button in `MobileControls.jsx`.
- **Dependencies:** `src/game/combat.js`, `src/game/healthBarView.js`, `src/game/game.js`.
- **Risks and trade-offs:** Must handle target death and despawn cleanly without leaving dangling references or crashing render loops.
- **Effort:** S — Pure client-side targeting and rendering additions.
- **Acceptance criteria:**
  - [ ] Clicking a monster selects it and displays a ground target indicator ring.
  - [ ] Casting targeted skills (`target === "enemy"`) directs the skill to the locked target if alive and within bounds.
  - [ ] Target ring automatically disappears when the target dies or leaves sight range (leashing/despawn).
  - [ ] Pressing `Tab` cycles through visible hostiles within 400px radius.
- **Validation plan:** Manual verification in Đông Môn Thành camps; unit test target resolution in `combat.test.js`.
- **Evidence:** `src/game/combat.js` (`resolveTargets`) currently resolves nearest enemy in radius or cursor location without persistent target lock state.
- **Assumptions / open questions:** Target lock is client-side visual and selection logic; damage calculations remain server-authoritative.

---

### [P1] Weapon Kit Expansion & Weapon Sources

- **Status:** Partially implemented — weapon kits, book learning and the first weapon drops shipped; this proposal covers the next step.
- **Confidence:** High
- **Player value:** Lets a hero specialize by weapon (sword / gloves / saber) instead of a removed class, and gives every kit enough depth to keep progressing. Weapons already drop from `hac-y-sat-thu` (gloves) and `ma-giao-de-tu` (saber).
- **Design summary:** Add more skills per kit and more weapon tiers per type. Keep the rules in `docs/weapon-skills.md`: `skill.weapon` must match the equipped weapon, non-starter skills are learned from books, and the server validates both.
- **Core loop connection:** Farm monsters → books expand the current kit → better weapons from late camps → harder camps.
- **MVP scope:**
  - Author additional skills per weapon kit in `src/game/skills.js`, with books in `MONSTER_BOOK_DROPS`.
  - Add second-tier weapons (and a weapon source beyond drops, e.g. a smith NPC) so loot keeps pace with leveling.
  - Add i18n strings (VI, EN, ZH) and icons for every new skill/weapon.
- **Optional extensions:**
  - Damage-over-time server tick extension for the dao (Ngũ Độc-flavoured) kit.
  - Weapon-specific VFX sheets for new ultimates.
- **Dependencies:** `src/game/skills.js`, `src/game/weapons.js`, `src/game/items.js`, `src/game/enemyCatalog.js`, `src/i18n/locales/`, `server/src/websocket/gameSocket.js`.
- **Risks and trade-offs:** Balance MP/cooldowns across kits so no weapon trivializes hunting; more weapons mean more inventory/equipment UI states.
- **Effort:** M — catalog authoring, i18n, icons, drop tables and tests.
- **Acceptance criteria:**
  - [ ] Every learnable skill has a book and appears in at least one monster drop pool (enforced by `skills.test.js`).
  - [ ] Every weapon drop maps to a real item with `slot: "weapon"` and a `weaponType` (`rewards.test.js`).
  - [ ] All skill names/descriptions resolve in VI, EN, ZH.
  - [ ] `npm test` + `npm run server:test` stay green.
- **Validation plan:** Bind a new skill from the `F5` tree, cast it with the matching weapon, and confirm the server rejects it with another weapon.
- **Evidence:** `docs/weapon-skills.md` documents the current catalog, drop tables and extension steps.
- **Assumptions / open questions:** Whether the next weapon source should be more monster drops or a dedicated smith NPC.

---

### [P2] Daily Bounty Quest System (Nhiệm Vụ Dã Tẩu)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Gives players clear daily/repeatable objectives (e.g. "Kill 10 Lâm Tặc in Đông Môn Thành") rather than unstructured grinding, rewarding structured effort with bonus EXP, silver, and upgrade materials.
- **Design summary:** Players interact with a Dã Tẩu NPC in Biện Kinh or click the Quest Tracker UI on the HUD. Accepting a bounty assigns a kill count contract (e.g. 0/10 Lâm Tặc). Progress updates in real-time as monsters are killed. Upon completion, turning in the contract awards bonus EXP, silver, and 1x Huyễn Kim Thạch.
- **Core loop connection:** Directs player hunting location -> Encourages exploration of higher camp columns in Đông Môn Thành -> Rewards enhancement materials.
- **MVP scope:**
  - Single active bounty contract state stored on server (`playerData.activeBounty`).
  - Server listens to `enemy_killed` events and updates bounty counter.
  - HUD Quest Tracker in `MinimapPanel.jsx` displays active objective and progress text.
  - Reward payout handled via existing `applyReward()` in `src/game/progression.js`.
- **Optional extensions:**
  - Tiered bounties based on player level (Level 3-8, Level 9-18, Level 19-29).
  - Daily limit (e.g. 5 bounties per day) with scaling rewards.
- **Dependencies:** `src/game/progression.js`, `src/components/HUD/MinimapPanel.jsx`, `server/src/websocket/gameSocket.js`.
- **Risks and trade-offs:** Quest state must persist in server player data to prevent progress loss on reconnect.
- **Effort:** M — Server quest tracking, websocket payload extension, and React HUD binding.
- **Acceptance criteria:**
  - [ ] Player can accept a monster bounty contract matching their level range.
  - [ ] Defeating target monsters increments contract counter in real-time on HUD.
  - [ ] Contract completion allows turning in for bonus EXP, silver, and material reward.
  - [ ] Bounty state survives disconnects and map transitions.
- **Validation plan:** Unit test bounty progression helper; test websocket event handlers for bounty claim.
- **Evidence:** `MinimapPanel.jsx` has a dedicated "Nhiệm vụ" (Quest) tab container stub, currently displaying static placeholder text.
- **Assumptions / open questions:** Bounties are repeatable contracts without complex branching narrative.

---

### [P2] Elite Monster Encounter: Ma Giáo Trưởng Lao (Trảm Tướng Đông Môn Thành)

- **Status:** Proposed
- **Confidence:** Medium
- **Player value:** Provides a pinnacle boss challenge in the deep forest of Đông Môn Thành (Camp 18), testing high-level characters (Level 25+) who have acquired enhanced gear and advanced skills.
- **Design summary:** Spawn a unique Elite Boss monster ("Ma Giáo Trưởng Lao", Level 30) at the center of Camp 18 in Đông Môn Thành. The boss has 5x standard HP, higher attack, an AoE skill attack, and a 180-second respawn timer. Defeating the boss yields high EXP, silver, and guaranteed Huyễn Kim Thạch drops.
- **Core loop connection:** End-game combat test for peak character progression.
- **MVP scope:**
  - Add `ma-giao-truong-lao` entry to `src/game/enemyCatalog.js` with special visual tint/scale.
  - Place single boss spawn in `dongMonThanhMap.js` at Camp 18 center.
  - Server-authoritative 180s respawn timer and high-value reward payout in `server/src/rewards.js`.
- **Optional extensions:**
  - Boss telegraphing visual effect (red ground circle before AoE attack).
  - Server-wide defeat announcement chat broadcast in `ChatPanel.jsx`.
- **Dependencies:** `src/game/enemyCatalog.js`, `src/game/maps/dongMonThanhMap.js`, `server/src/websocket/gameSocket.js`.
- **Risks and trade-offs:** Boss must be leashed properly to Camp 18 so it cannot be lured to the map entry portal.
- **Effort:** S — Enemy catalog addition, map spawn placement, and reward tuning.
- **Acceptance criteria:**
  - [ ] Ma Giáo Trưởng Lao spawns in Camp 18 with visually distinct size and name tag.
  - [ ] Boss uses leashed AI and returns to origin if lured too far.
  - [ ] Defeating boss pays high-tier EXP, silver, and guaranteed upgrade materials.
  - [ ] Boss respawns on server after 180 seconds.
- **Validation plan:** Server integration test for boss spawn and death lifecycle; manual verification in Camp 18.
- **Evidence:** `docs/plan/dong-mon-thanh.md` notes that Đông Môn Thành was shipped with 18 camps and 270 standard spawns, explicitly noting "No boss" in initial version, leaving Camp 18 as an ideal boss location.
- **Assumptions / open questions:** Boss reuses existing `Enemy` AI class with boosted stats and scale factor.

---

## Suggested roadmap

### Next
High-value, well-understood features ready for immediate implementation:
1. **Target Selection & Visual Lock Indicator [P1]:** Low risk, immediate combat clarity improvement.
2. **Weapon Kit Expansion & Weapon Sources [P1]:** Deepens the implemented weapon/book system, documented in `docs/weapon-skills.md`.
3. **Equipment Enhancement System [P1]:** Connects existing `huyen-kim-thach` drops and silver to character power progression.

### Validate first
Features requiring gameplay balance check or technical spike:
1. **Daily Bounty Quest System [P2]:** Validate UI presentation in `MinimapPanel.jsx` and server bounty persistence model.
2. **Elite Boss Encounter [P2]:** Playtest Camp 18 stat tuning to ensure boss challenge is rewarding without being impossible solo.

### Later
Longer-term expansions and future content iterations:
1. **Server-authoritative Poison / DoT Engine (Dao v2):** Add a server-side status effect tick loop for poison damage over time for the dao kit.
2. **Multi-map World Expansion:** Additional high-level maps (e.g. Dương Châu, Biện Kinh Suburbs) with new monster species.

---

## Dependencies and milestones

```
[Milestone 1: Combat & Skill Polish]
  ├── Target Selection & Lock Indicator
  └── Weapon Kit Expansion & Weapon Sources

[Milestone 2: Economy & Progression Loop]
  ├── Equipment Enhancement System (+1..+6, Huyễn Kim Thạch sink)
  └── Daily Bounty Quest System (Minimap Quest Tracker)

[Milestone 3: End-Game Content Challenge]
  └── Elite Boss Spawn (Ma Giáo Trưởng Lao in Đông Môn Thành)
```

---

## Validation checklist

1. **Combat Usability Test:**
   - [ ] Select monster in dense camp -> Target ring renders cleanly.
   - [ ] Cast single-target skill -> Hits selected target.
   - [ ] Target dies -> Ring disappears smoothly without errors.

2. **Weapon Skill Integrity Test:**
   - [ ] Every weapon kit has valid skills with unique slots.
   - [ ] Every learnable skill has a book and at least one monster drop pool.
   - [ ] `npm test` and `npm run server:test` pass catalog/reward invariants.
   - [ ] All skill names resolve in VI, EN, ZH locales.

3. **Equipment Enhancement Test:**
   - [ ] Spend silver + 1x Huyễn Kim Thạch -> Equipment rank increases (+1).
   - [ ] Stat bonuses updated in character panel and combat damage formulas.
   - [ ] Server rejects enhancement if silver or material count is insufficient.

4. **Bounty System Test:**
   - [ ] Accept bounty contract -> Objective progress shown in HUD Minimap panel.
   - [ ] Kill targeted monsters -> Progress increments 1/10 .. 10/10.
   - [ ] Turn in bounty -> Payout awarded, contract cleared.

---

## Deferred ideas

- **Real-Time PvP Arena / Guild Wars:** Out of scope for current single-player / co-op focus; existing duel mechanics in `pvp.js` suffice for current stage.
- **Auction House / Trade Market:** Excessive complexity for current player count; NPC shop and direct drops meet economy needs.
- **Gacha / Paid Loot Boxes:** Explicitly rejected to preserve authentic wuxia RPG mechanics and avoid manipulative monetization loops.

---

## Open questions

1. Should Equipment Enhancement have visual glowing weapon aura effects at +7 and above in the current Phaser rig renderer?
2. Should the dao kit's poison mechanics be shipped as v1 (flat debuff/slow) first or wait for the full server-authoritative DoT tick engine (v2)?
