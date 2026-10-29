# Game Feature Proposals

- **Date:** 2026-10-28
- **Project / engine:** React 19, Vite 8, Phaser 3.90 (Arcade Physics), Node.js / WebSocket server authority
- **Genre / target platform:** Browser-playable 2.5D isometric wuxia RPG (PC desktop & mobile web browser)
- **Development stage:** Playable Alpha / Content Expansion (13 playable maps across 3 factions Hán/Thục/Ngụy, weapon-kit skill architecture, Dã Tẩu newbie quest chain, server-authoritative combat & persistent player DB)
- **Audit scope:** `src/game/` (progression, equipment, items, skills, shop, combat, maps, worldManager, quests, autoTarget, targetRing, pvp, factions), `src/components/` (HUD, Modals, MobileControls, MinimapPanel, ChatPanel), `server/src/` (gameSocket, rewards, enemy loop, auth, state), and `docs/`
- **Limitations:** Live high-concurrency WAN network latency (>200ms) under real multi-region conditions was not benchmarked; art assets reuse vector-painted graphics and sprite sheets without custom 3D models.

## Executive summary

Giang Hồ is a React and Phaser 3 browser wuxia RPG inspired by classic Vietnamese martial arts MMORPGs (Võ Lâm Truyền Kỳ 2). The game features a solid technical foundation: 60FPS Arcade physics, server-authoritative movement/combat/rewards, bi-directional React-Phaser bridge, persistent SQLite/JSON database, 3 faction capitals (Biện Kinh, Thục Thành, Ngụy Thành), 9 hunting grounds (levels 3–60), 1 shared cross-faction PvP battlefield (Trung Nguyên Chiến Trường), and an active Dã Tẩu newbie quest chain (`src/game/quests/catalog.js`).

While navigation, faction PvP, and early-game questing are functional, current playability faces four distinct design gaps:
1. **Economic Sink & Gear Upgrade Void:** Monsters pay silver coins and drop basic items, but silver is mostly spent on potions at Dược Sư; there is no gear-enhancement system or upgrade material sink yet.
2. **Combat Usability in Dense Camps & PvP:** Hunting grounds feature dense monster spawns (90 to 270 monsters per map). Target selection lacks explicit visual target lock rings and range indicators during intense PC hotbar or touch combat.
3. **Mid/High-Level Weapon Kit & Drop Pool Gap:** Level 30–60 species in Bắc Lĩnh, Tây Sơn, Kiếm Các, etc. grant EXP and silver but do not yet drop higher-tier weapons or advanced skill books, leaving late-game item progression flat (`docs/plan/faction-cities.md`).
4. **Repeatable Endgame Goals:** While the Level 1–10 Dã Tẩu talk chain guides newbies, players lack daily repeatable mob hunting contracts once they enter Level 15+ hunting grounds.

This document proposes 5 prioritized, evidence-backed features designed to deepen the core loop without introducing feature bloat or scope creep.

---

## Current game and core loop

The implemented gameplay loop follows a classic ARPG structure:

1. **Player Goal:** Select a faction (Hán, Thục, Ngụy), advance character level (up to 99), acquire silver coins and rare upgrade materials, learn weapon skills from monster book drops, acquire higher-tier gear, and engage in cross-faction PvP on Trung Nguyên Chiến Trường or conquer high-level hunting grounds (Bắc Lĩnh, Tây Sơn, Kiếm Các, Nga Mi, Quan Trung).
2. **Core Player Actions:** Direct movement (WASD, click-to-move, or mobile joystick), quick-slot skill casting (`1`–`9` hotbar or mobile radial fan), consumable usage, talking to market NPCs (`NPC_DUOC`, Dã Tẩu, shopkeepers), and completing newbie quests.
3. **Challenge / Opposition:** Aggressive and leashed enemy camps across 9 hunting grounds (Level 3 to 60 species in `src/game/enemyCatalog.js`), and hostile faction players on the central battlefield (`trung-nguyen`).
4. **Feedback and Rewards:** Server-calculated floating damage numbers, Web Audio synth sounds, EXP bar gains, silver coin payouts, and server-rolled skill-book/weapon drops (`rollEnemyReward` in `server/src/rewards.js`).
5. **Progression and Persistence:** Level vitals calculated in `src/game/progression.js`, equipment stat bonuses derived in `src/game/equipment.js` (`attack`, `defense`, `maxHp`, `maxMp`, `critRate`, `accuracy`), quest progression saved in `saves.quest_state`, all server-owned via `server/src/websocket/gameSocket.js`; local hotbar/mobile bindings live in `localStorage` (`src/game/storage.js`).

---

## Ranked feature shortlist

| Priority | Feature | Target Player Value | Effort | Confidence |
| --- | --- | --- | --- | --- |
| **P1** | **Equipment Enhancement System (Cường Hóa Trang Bị)** | Converts silver coins and material drops (Huyễn Kim Thạch) into gear stat growth (+1 to +10), solving silver inflation and deepening item chase. | M | High |
| **P1** | **Target Selection & Visual Lock Indicator (Khóa Mục Tiêu Chiêu Thức)** | Renders visual target ring & range feedback in dense mob camps and PvP, fixing targeting ambiguity on PC & mobile. | S | High |
| **P1** | **Weapon Kit Expansion & High-Tier Drops (Mở Rộng Bộ Võ Công & Trang Bị Cấp Cao)** | Extends book/weapon drop pools to Level 30–60 species, adding tier-2/3 weapons (Huyền Thiết Kiếm, Trảm Mã Đao) and new kit techniques. | M | High |
| **P2** | **Daily Bounty Quest System (Nhiệm Vụ Dã Tẩu Săn Bắt)** | Builds upon the Dã Tẩu newbie chain by adding repeatable daily mob-kill contracts with silver and material rewards. | M | High |
| **P2** | **Battlefield Objective & Faction Scoring System (Chiếm Căn Cứ Chiến Trường)** | Adds capture points and real-time faction score tracking on Trung Nguyên Chiến Trường, transforming raw deathmatches into strategic combat. | L | Medium |

---

## Feature proposals

### [P1] Equipment Enhancement System (Cường Hóa Trang Bị)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Gives silver coins and material drops a clear progression purpose. Allows players to continuously upgrade equipped gear (`weapon`, `armor`, `helmet`, `pants`, `boots`), giving tangible power progression (+1 to +10 stats) when fighting Level 30+ monsters in Bắc Lĩnh, Tây Sơn, or Kiếm Các.
- **Design summary:** Players visit a Blacksmith NPC (e.g. `chu-tiem-vu-khi`) or open an Enhancement tab in the equipment sheet. Inserting an equipped item costs silver coins and 1x upgrade material (Huyễn Kim Thạch). Enhancing increases item bonus stats (e.g. `attack +3` per rank for weapons, `defense +2` for armor) up to +10. Success rate starts at 100% (+1 to +3) and scales down to 40% (+10), with failure retaining the item but consuming materials.
- **Core loop connection:** Monster kill -> Silver & material drop -> Blacksmith Enhancement -> Higher stats (`attack`, `defense`, `maxHp`) -> Able to conquer higher-level hunting grounds.
- **MVP scope:**
  - Enhance equipped items up to +6 with deterministic silver + material cost.
  - Server-authoritative enhancement validation (`server/src/websocket/gameSocket.js`).
  - Stat multiplier/additive bonus applied in `deriveEquipmentBonuses()` in `src/game/equipment.js`.
  - Visual enhancement level indicator (`+1` .. `+6` badge) on equipment slots in `CharacterModal.jsx`.
- **Optional extensions:**
  - Visual glowing aura / particle effect on character rig for +7 and above weapons (`heroRigView.js`).
  - Protection talismans to prevent downgrade on higher tiers (+7 to +10).
- **Dependencies:** `src/game/equipment.js`, `src/game/items.js`, `server/src/websocket/gameSocket.js`.
- **Risks and trade-offs:** Must be server-authoritative to prevent cheated upgrades. Requires clear UI feedback for success/failure.
- **Effort:** M — Server validation logic, equipment modifier extension, and React modal integration.
- **Acceptance criteria:**
  - [ ] Player can submit an equipped item, required silver, and the upgrade material to enhance gear.
  - [ ] Enhancing an item updates `deriveEquipmentBonuses()` with upgraded stat values.
  - [ ] Server validates silver and material balance before confirming enhancement.
  - [ ] Failed attempts deduct materials without destroying or corrupting the equipped item.
- **Validation plan:** Unit test enhancement logic in `equipment.test.js`; integration test server websocket handler with mock silver/material quantities in `server/tests/websocket.test.js`.
- **Evidence:** `src/game/items.js` lists equipment items (`EQUIPMENT_ITEMS`) and `src/game/equipment.js` derives bonuses via `deriveEquipmentBonuses()`. Silver is currently only spent at shopkeepers (`src/game/shop.js`).
- **Assumptions / open questions:** Enhancement values are additive flat bonuses to item stats.

---

### [P1] Target Selection & Visual Lock Indicator (Khóa Mục Tiêu Chiêu Thức)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Prevents mis-clicks and wasted skill casts when fighting crowded monster camps (90–270 spawns per map) or enemy players on Trung Nguyên Chiến Trường. Provides immediate visual feedback on target selection and skill cast range.
- **Design summary:** Clicking or tapping an enemy or hostile player locks them as the active target, drawing a ground indicator ring (gold for monsters, red for enemy faction players) beneath their feet. Single-target skills automatically cast toward the locked target. The range indicator ring highlights whether the target is within skill cast range.
- **Core loop connection:** Improves combat precision, skill responsiveness, and targeting clarity during intense mob farming and faction PvP encounters.
- **MVP scope:**
  - Explicit active target lock state in Phaser scene (`JiangHuScene.activeTarget`).
  - Ground target ring drawn using `TargetRing` (`src/game/targetRing.js`) for both PC click selection and touch targeting.
  - Skill cast targets `activeTarget` if valid and alive; falls back to cursor direction or auto-proximity when no target is locked.
  - Pressing `Tab` or clicking empty ground cycles hostiles or clears selection.
- **Optional extensions:**
  - Target vitals HUD bar displaying target HP %, level, and faction icon.
  - Auto-switch target on target death to nearest hostile monster.
- **Dependencies:** `src/game/combat.js`, `src/game/targetRing.js`, `src/game/autoTarget.js`, `src/game/game.js`.
- **Risks and trade-offs:** Must handle target death, map transition, and despawn cleanly without leaving dangling references or crashing render loops.
- **Effort:** S — Client targeting and rendering integration using existing `TargetRing`.
- **Acceptance criteria:**
  - [ ] Clicking a monster or hostile player selects them and displays a ground target ring.
  - [ ] Single-target skills target the locked target if alive and within map bounds.
  - [ ] Target ring automatically disappears when the target dies, disconnects, or leaves sight range.
  - [ ] Pressing `Tab` cycles through visible hostiles within 400px radius.
- **Validation plan:** Manual verification in Đông Môn Thành and Trung Nguyên Chiến Trường; unit test target resolution in `autoTarget.test.js` and `pvpTargeting.test.js`.
- **Evidence:** `src/game/targetRing.js` exists for mobile touch targeting, but PC click targeting in `combat.js` resolves direction toward cursor without persistent ground lock ring.
- **Assumptions / open questions:** Target lock is client-side visual and selection logic; damage calculations remain server-authoritative.

---

### [P1] Weapon Kit Expansion & High-Tier Drops (Mở Rộng Bộ Võ Công & Trang Bị Cấp Cao)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Extends character specialization across sword (`kiem`), gloves (`baoTay`), and saber (`dao`) kits into high levels (30–60), providing players with rare high-tier weapon drops and advanced skill books in high-level hunting grounds.
- **Design summary:** Populate weapon and book drop pools for Level 30–60 species across Bắc Lĩnh, Tây Sơn, Kiếm Các, Nga Mi, Nghiệp Quan, Quan Trung (`docs/plan/faction-cities.md`). Add Tier-2 and Tier-3 weapons (e.g. Huyền Thiết Kiếm, Trảm Mã Đao, Hổ Trảo Bao Tay) and complementary skills for each weapon kit in `src/game/skills/catalog/`.
- **Core loop connection:** Farm Level 30+ monsters -> Rare book & high-tier weapon drops -> Learn advanced kit techniques & equip powerful weapons -> Dominate Trung Nguyên Chiến Trường.
- **MVP scope:**
  - Author additional skills per weapon kit in `src/game/skills/catalog/{baoTay,kiem,dao}.js`.
  - Add Tier-2/3 weapons to `EQUIPMENT_ITEMS` in `src/game/items.js`.
  - Assign drop tables for Level 30–60 species in `src/game/enemyCatalog.js`.
  - Add i18n strings (VI, EN, ZH) and icons for all new skills and weapons.
- **Optional extensions:**
  - Server-authoritative poison damage-over-time (DoT) status effect tick engine for the saber (`dao`) kit.
  - Weapon-specific elemental visual effects on skill impact.
- **Dependencies:** `src/game/skills.js`, `src/game/weapons.js`, `src/game/items.js`, `src/game/enemyCatalog.js`, `server/src/rewards.js`, `src/i18n/locales/`.
- **Risks and trade-offs:** Must maintain skill MP cost and cooldown balance so no kit dominates early/mid game.
- **Effort:** M — Catalog authoring, drop table wiring, i18n translations, and unit tests.
- **Acceptance criteria:**
  - [ ] Every learnable skill has a book item and appears in at least one monster drop pool (`skills.test.js`).
  - [ ] Every weapon drop maps to a valid item with `slot: "weapon"` and a `weaponType` (`rewards.test.js`).
  - [ ] All new skill names and descriptions resolve cleanly across VI, EN, and ZH.
  - [ ] `npm test` and `npm run server:test` remain 100% green.
- **Validation plan:** Unit test catalog invariants in `skills.test.js` and `enemyCatalog.test.js`; test server drop rolls in `rewards.test.js`.
- **Evidence:** `docs/plan/faction-cities.md` explicitly noted that Level 30–60 species pay EXP/coins only and need book/weapon drop table wiring.
- **Assumptions / open questions:** Drops are rolled server-side in `server/src/rewards.js` using existing drop rate math.

---

### [P2] Daily Bounty Quest System (Nhiệm Vụ Dã Tẩu Săn Bắt)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Expands the Dã Tẩu quest system beyond the Level 1–10 newbie talk chain (`src/game/quests/catalog.js`) into repeatable daily monster hunting contracts (e.g., "Defeat 20 Tuyết Lang in Bắc Lĩnh"), rewarding structured player effort with bonus EXP, silver, and Huyễn Kim Thạch upgrade materials.
- **Design summary:** Players interact with Dã Tẩu in any faction capital or click the Quest Tracker on the HUD. Accepting a bounty assigns a kill contract (0/20 target monsters). As targeted monsters are defeated on any map, server updates contract progress in real time. Turning in the contract grants EXP, silver, and upgrade materials.
- **Core loop connection:** Directs player hunting location -> Encourages exploration of Level 15–60 hunting grounds -> Grants enhancement materials needed for gear upgrading.
- **MVP scope:**
  - Single active bounty contract state persisted in server player data (`saves.bounty_state`).
  - Server listens to `enemy_killed` events in `gameSocket.js` and updates contract counters.
  - HUD Quest Tracker in `MinimapPanel.jsx` displays active bounty contract progress.
  - Contract turn-in via Dã Tẩu NPC grants silver, EXP, and 1x Huyễn Kim Thạch.
- **Optional extensions:**
  - Tiered bounty contracts based on player level brackets (3–14, 15–29, 30–44, 45–60).
  - Daily limit (5 contracts/day) with streak bonus rewards.
- **Dependencies:** `src/game/quests/catalog.js`, `src/components/HUD/MinimapPanel.jsx`, `server/src/websocket/gameSocket.js`.
- **Risks and trade-offs:** Quest state must persist in server player data so progress is never lost on disconnect or map transition.
- **Effort:** M — Server contract tracking logic, WebSocket payload extension, and Minimap UI integration.
- **Acceptance criteria:**
  - [ ] Player can accept a daily monster hunting contract matching their level.
  - [ ] Defeating target monsters increments contract progress in real time on the HUD.
  - [ ] Contract completion allows turning in for bonus EXP, silver, and upgrade materials.
  - [ ] Bounty state survives disconnects and map transitions cleanly.
- **Validation plan:** Unit test bounty progression helper; test WebSocket event handlers for contract update and turn-in in `server/tests/websocket.test.js`.
- **Evidence:** `src/game/quests/catalog.js` established the Dã Tẩu NPC structure and `MinimapPanel.jsx` contains the HUD quest tracker UI.
- **Assumptions / open questions:** Daily bounties complement the newbie talk chain without overwriting existing `tan-thu-1`..`tan-thu-6` quest IDs.

---

### [P2] Battlefield Objective & Faction Scoring System (Chiếm Căn Cứ Chiến Trường)

- **Status:** Proposed
- **Confidence:** Medium
- **Player value:** Gives players on Trung Nguyên Chiến Trường strategic objectives beyond individual PK kills, encouraging faction teamwork to capture territory flags and earn faction-wide stat buffs and bonus silver.
- **Design summary:** Place 3 territorial Control Posts (Căn Cứ Hán, Căn Cứ Thục, Căn Cứ Ngụy) on Trung Nguyên Chiến Trường. Standing inside an uncaptured post's 150px zone channels capture points for the player's faction over 10 seconds. Controlling a post grants all faction members on the map a +5% attack/defense buff and periodically ticks faction victory points.
- **Core loop connection:** End-game faction competition -> Strategic team combat -> Faction rewards and realm pride.
- **MVP scope:**
  - 3 capture zone areas defined on `trung-nguyen` map.
  - Server-authoritative capture point state and tick loop in `gameSocket.js`.
  - Visual banner/flag indicator in Phaser scene representing controlling faction color (Blue/Red/Yellow).
  - Real-time faction score overlay HUD widget on `trung-nguyen`.
- **Optional extensions:**
  - Hourly battlefield reward payout based on controlling faction points.
  - Server-wide system announcement when a control post changes hands.
- **Dependencies:** `src/game/factions.js`, `src/game/maps/trungNguyenMap.js`, `server/src/websocket/gameSocket.js`, `src/components/HUD/`.
- **Risks and trade-offs:** Must be carefully optimized on the server tick loop so zone collision checks for multiple players do not degrade server TPS.
- **Effort:** L — Server zone occupancy logic, state broadcast, Phaser banner rendering, and HUD widget.
- **Acceptance criteria:**
  - [ ] Players standing in a capture zone channel control points for their faction.
  - [ ] Controlling a post changes its visual banner color and grants active faction members a stat buff.
  - [ ] Faction score tally updates in real time on the battlefield HUD.
  - [ ] All capture state is server-authoritative and synced to joining clients.
- **Validation plan:** Server WebSocket test simulating multi-player capture channel and score accumulation in `server/tests/websocket.test.js`.
- **Evidence:** `docs/plan/faction-cities.md` explicitly identified battlefield objective/scoring as the primary uncompleted item for Phase 3.
- **Assumptions / open questions:** Score ticks occur every 5 seconds on the server loop while the map is active.

---

## Suggested roadmap

### Next
High-value, well-understood features ready for immediate development:
1. **Target Selection & Visual Lock Indicator [P1]:** Low risk, uses existing `TargetRing`, provides immediate combat precision.
2. **Equipment Enhancement System [P1]:** Provides essential silver/material sink and power progression for Level 30+ content.
3. **Weapon Kit Expansion & High-Tier Drops [P1]:** Fills the catalog and drop gap for Level 30–60 species (`docs/plan/faction-cities.md`).

### Validate first
Promising ideas that require balance playtests or technical prototypes before commitment:
1. **Daily Bounty Quest System [P2]:** Validate contract kill counts and material reward scaling against mob density.
2. **Battlefield Objective & Faction Scoring System [P2]:** Prototype server zone tick performance with multi-client WebSocket test.

### Later
Longer-term expansions and future content iterations:
1. **Server-Authoritative Poison / DoT Engine (Dao v2):** Dedicated status effect tick loop for poison damage over time.
2. **Guild / Faction Alliances & Territory Tax:** Meta-economy systems for faction leaders.

---

## Dependencies and milestones

```
[Milestone 1: Combat Precision & Equipment Sink]
  ├── Target Selection & Visual Lock Indicator (TargetRing integration)
  └── Equipment Enhancement System (+1..+6, Huyễn Kim Thạch material sink)

[Milestone 2: Content Expansion & Daily Objectives]
  ├── Weapon Kit Expansion & High-Tier Drops (Level 30-60 drop tables)
  └── Daily Bounty Quest System (Repeatable mob contracts & Minimap HUD)

[Milestone 3: Faction Meta-Gameplay]
  └── Battlefield Objective & Faction Scoring (Trung Nguyên capture points)
```

---

## Validation checklist

1. **Combat Usability Test:**
   - [ ] Click or tap monster/player -> Target ring renders cleanly beneath feet.
   - [ ] Cast single-target skill -> Skill lands on active locked target.
   - [ ] Target dies or leaves map -> Lock ring hides smoothly without errors.

2. **Equipment Enhancement Test:**
   - [ ] Submit gear + required silver + 1x Huyễn Kim Thạch -> Item rank increases (+1).
   - [ ] Stat bonuses update in `deriveEquipmentBonuses()` and character panel.
   - [ ] Server refuses enhancement if silver or material count is insufficient.

3. **Weapon Drops & Skills Test:**
   - [ ] Every learnable skill has a book item and appears in a drop table.
   - [ ] Level 30–60 species drop tier-2/3 weapons and books.
   - [ ] `npm test` and `npm run server:test` pass all catalog invariants.

4. **Daily Bounty System Test:**
   - [ ] Accept contract from Dã Tẩu -> Active progress shown on Minimap HUD tracker.
   - [ ] Defeat target mobs -> Counter increments 1/20 .. 20/20 in real time.
   - [ ] Turn in bounty -> Silver, EXP, and upgrade material awarded.

5. **Battlefield Objective Test:**
   - [ ] Stand in capture zone -> Progress channels toward hero's faction.
   - [ ] Capture completed -> Faction banner changes color and buff is applied.
   - [ ] Disconnect & rejoin -> Active battlefield score and capture state remain synced.

---

## Deferred ideas

- **Real-Time Auction House / Player Market:** Out of scope for current architecture; direct NPC shops and trade suffice.
- **Gacha / Paid Loot Boxes:** Explicitly rejected to preserve authentic wuxia MMORPG mechanics and avoid manipulative monetization loops.
- **Automated AFK Botting Engine:** Rejected to maintain active gameplay engagement and anti-cheat integrity.

---

## Open questions

1. Should Equipment Enhancement display visual glowing aura/particle effects on character rigs at +7 and above in the Phaser renderer?
2. Should Daily Bounty contracts have a hard daily reset limit (e.g. 5/day) or be infinitely repeatable with diminishing EXP returns?
