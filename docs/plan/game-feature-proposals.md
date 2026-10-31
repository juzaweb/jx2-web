# Game Feature Proposals

- **Date:** 2026-10-31
- **Project / engine:** React 19, Vite 8, Phaser 3.90 (Arcade Physics), Node.js WebSocket Server Authority
- **Genre / target platform:** Browser-playable 2.5D isometric wuxia MMORPG (PC desktop & mobile web touch)
- **Development stage:** Alpha / Content & Systems Expansion (13 playable maps across 3 factions Hán/Thục/Ngụy, 4 sect skill trees with custom VFX & F5 tree progression, server-authoritative combat, movement & inventory)
- **Audit scope:** `src/game/` (equipment, items, skills, enemyCatalog, combat, targetRing, autoTarget, pvpTargeting, maps, worldManager, quests), `src/components/` (HUD, Modals, MobileControls, MinimapPanel, ChatPanel), `server/src/` (gameSocket, rewards, playerDb, playerBag, state), and `docs/plan/`
- **Limitations:** High-concurrency WAN internet latency under live multi-player stress conditions (>200ms ping) has not been benchmarked; visual assets utilize procedural/vector-painted graphics and 2D sprite frames.

## Executive summary

Giang Hồ is a browser wuxia MMORPG inspired by classic Vietnamese martial arts titles (e.g., Võ Lâm Truyền Kỳ 2). Built with React and Phaser 3, the project possesses a mature server-authoritative architecture: movement validation with snap-backs, server-calculated damage formulas, server-owned inventory/equipment, 13 interconnected map zones (3 faction capitals, 9 tiered hunting grounds, 1 central PvP battlefield), and four distinct sect skill trees (Thiếu Lâm, Võ Đang, Nga My, Ngũ Độc) learned directly via the F5 tree panel.

An inspection of the current repository state reveals that while core combat mechanics, sect arts, and early navigation are in place, several key design gaps limit mid-to-late game engagement and economic health:
1. **Economic Sink & Gear Upgrade Void:** Silver is earned from mob kills and quests, but expenditure is almost exclusively limited to consumable potions at Dược Sư. There is currently no gear enhancement or refinement sink for equipment.
2. **Flat Equipment Ladder in High-Level Hunting Grounds:** Monsters in Level 30–60 hunting grounds (Bắc Lĩnh, Tây Sơn, Kiếm Các, Nga Mi, Quan Trung, Nghiệp Quan) drop silver and EXP, but only 2 low-level monsters (`hac-y-sat-thu` and `ma-giao-de-tu`) drop weapons (`bao-tay-lang-khach` and `dao-lang-khach`). Higher-tier weapons and armor pieces do not exist in the drop or equipment tables.
3. **Target Cycling & Selection Usability:** Although `TargetRing` and `TargetVitals` exist for display upon clicking or auto-targeting, players in dense monster camps (90–270 mobs) lack direct target-cycling keybinds (`Tab`) and mobile switch target controls, causing targeting friction during fast-paced mob grinding and PvP.
4. **Repeatable Endgame Daily Objectives:** The Dã Tẩu quest system provides an introduction for levels 1–10 (`src/game/quests/catalog.js`), but once players enter hunting grounds at level 15+, no structured daily contracts guide farming or reward sustained engagement.
5. **Static Battlefield Territory:** Trung Nguyên Chiến Trường currently allows free faction PvP, but lacks capturable territory objectives, point tallies, or faction-wide incentives to organize battles.

This document outlines 5 prioritized, high-fit feature proposals focused on reinforcing the core gameplay loop without bloating the project scope.

---

## Current game and core loop

The active gameplay loop operates as follows:

1. **Player Goal:** Choose a faction (Hán, Thục, Ngụy) and sect (Thiếu Lâm, Võ Đang, Nga My, Ngũ Độc). Train in hunting grounds (levels 3 to 60), gather silver and rare drops, master martial arts from the F5 tree, optimize equipment, and represent the faction in Trung Nguyên Chiến Trường.
2. **Core Player Actions:**
   - Movement: Direct WASD/arrow keys, click-to-move with cursor follow, or mobile virtual joystick.
   - Combat: Basic attack (`Space` or click/tap enemy) and quick-slot skill casting (hotbar `1`–`9` or mobile radial fan).
   - Progression: Studying and leveling sect techniques in the F5 tree using silver and EXP (`src/game/skills/levels.js`).
   - Interaction: Interacting with NPCs (`NPC_DUOC`, Dã Tẩu, shopkeepers), completing newbie quests, managing inventory (`F4`) and equipment (`F3`).
3. **Challenge / Opposition:** Aggressive and leashed monster camps across 9 hunting grounds (Level 3–60 monsters in `src/game/enemyCatalog.js`), and enemy faction players on `trung-nguyen` (`src/game/pvp.js`).
4. **Feedback and Rewards:** Server-echoed floating damage and crit indicators, Web Audio synth combat sound effects, EXP gain bar, silver currency increments, rare equipment drops (`server/src/rewards.js`), and target health displays (`TargetVitals.jsx`).
5. **Progression and Persistence:** Character vitals and stats derive server-side (`src/game/derivedStats.js`, `src/game/progression.js`). Equipment bonuses derive via `deriveEquipmentBonuses` (`src/game/equipment.js`). Inventory, equipped gear, vitals, and quest state are stored in the server SQLite/JSON database (`server/src/data/playerDb.js`), while quick-slot bindings are persisted locally (`src/game/storage.js`).

---

## Ranked feature shortlist

| Priority | Feature | Target Player Value | Effort | Confidence |
| --- | --- | --- | --- | --- |
| **P1** | **Equipment Enhancement System (Cường Hóa Trang Bị)** | Introduces a progressive gear enhancement mechanic (+1 to +10) consuming silver and upgrade stones, solving currency inflation and deepening the item progression chase. | M | High |
| **P1** | **High-Tier Equipment & Drop Ladder (Bậc Trang Bị Cấp Cao & Rơi Đồ Quái Vật)** | Expands equipment from starter tier (`lang-khach`) into Tier-2 and Tier-3 sets across weapons and armors, wiring them into Level 15–60 monster drop tables. | M | High |
| **P2** | **Target Cycling & Selection Controls (Chuyển Đổi & Khóa Mục Tiêu Nhanh)** | Implements `Tab` key cycling on PC and a target switch button on mobile touch controls to cycle through visible hostiles cleanly in dense mob camps and PvP. | S | High |
| **P2** | **Daily Bounty Hunting Contracts (Nhiệm Vụ Dã Tẩu Truy Nã Hàng Ngày)** | Adds repeatable daily mob elimination bounties from Dã Tẩu scaled to player level brackets, awarding silver, EXP, and enhancement materials. | M | High |
| **P2** | **Battlefield Outposts & Faction Scoring (Căn Cứ & Điểm Chiến Trường Trung Nguyên)** | Introduces 3 capturable territory flags on Trung Nguyên Chiến Trường that reward faction score and passive stat buffs to the holding faction. | L | Medium |

---

## Feature proposals

### [P1] Equipment Enhancement System (Cường Hóa Trang Bị)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Provides an essential currency sink for silver and creates a long-term power progression goal for equipment items (`weapon`, `armor`, `helmet`, `pants`, `boots`). Players feel tangible power growth when upgrading their gear to take on tougher monster tiers in Bắc Lĩnh, Tây Sơn, or Kiếm Các.
- **Design summary:** Players interact with the Blacksmith NPC (`chu-tiem-vu-khi`) or open an Enhancement tab inside the Character Modal (`F3`). Enhancing an equipped or inventory item requires silver and an upgrade catalyst material (Huyễn Kim Thạch). Each enhancement rank (+1 to +10) grants flat additive stat increases (e.g., +3 Attack per weapon rank; +2 Defense and +15 Max HP per armor rank). Enhancement success rates are 100% for ranks +1 to +3, decreasing progressively to 40% at +10. A failed enhancement consumes the materials and silver without destroying the base item.
- **Core loop connection:** Grinding monsters -> Earning silver and Huyễn Kim Thạch -> Enhancing gear -> Increased combat stats (`derivedStats.js`) -> Tackling higher-tier hunting grounds and competitive PvP.
- **MVP scope:**
  - Introduce upgrade material `huyen-kim-thach` in `src/game/items.js`.
  - Add enhancement rank metadata `enhancement: 0..10` to equipment item schema and persistence in `server/src/game/playerBag.js` and `server/src/data/playerDb.js`.
  - Server WebSocket handler `enhance_item { itemId, slot }` in `server/src/websocket/gameSocket.js` validating currency, material count, and success RNG.
  - Update `deriveEquipmentBonuses` (`src/game/equipment.js`) to apply enhancement multipliers/flat bonuses to attack, defense, and vitals.
  - Visual enhancement indicator (e.g., `+1`, `+5`) in `CharacterModal.jsx` and item tooltips.
- **Optional extensions:**
  - Visual weapon glow/aura effect in `heroRigView.js` for weapons at rank +7 and higher.
  - Lucky talismans (Bùa May Mắn) dropped by high-level bosses to boost success rates by +15%.
- **Dependencies:** `src/game/items.js`, `src/game/equipment.js`, `server/src/websocket/gameSocket.js`, `src/components/Modals/CharacterModal.jsx`.
- **Risks and trade-offs:** Must be strictly server-authoritative to prevent forged enhancement requests. RNG failure must feel fair; retaining the item on failure prevents catastrophic loss of player investment.
- **Effort:** M — Server validation logic, equipment bonus calculation, and React UI enhancement panel.
- **Acceptance criteria:**
  - [ ] Player with sufficient silver and Huyễn Kim Thạch can enhance equipped/inventory gear.
  - [ ] Successful enhancement increments the item rank and updates derived combat stats in `deriveEquipmentBonuses()`.
  - [ ] Failed enhancement consumes silver and material but leaves the base item intact.
  - [ ] Server rejects enhancement attempts when silver or material count is insufficient.
  - [ ] Item tooltips and character equipment slots display enhancement badges (`+1`..`+10`).
- **Validation plan:** Unit test enhancement stat derivations in `equipment.test.js`; test WebSocket enhancement handler with mock rolls in `server/tests/websocket.test.js`.
- **Evidence:** `src/game/items.js` lists equipment with static bonuses; `src/game/equipment.js` derives stats via `deriveEquipmentBonuses()`. Currently, silver has no sinks beyond low-cost potions at `NPC_DUOC` (`src/game/shop.js`).
- **Assumptions / open questions:** Enhancement ranks provide flat additive bonuses rather than percentage multipliers to preserve low-level arithmetic clarity.

---

### [P1] High-Tier Equipment & Drop Ladder (Bậc Trang Bị Cấp Cao & Rơi Đồ Quái Vật)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Bridges the item progression desert after level 10. Currently, only the starter `lang-khach` gear exists in `EQUIPMENT_ITEMS`. High-level monsters in maps up to level 60 drop silver and EXP but no equipment, leaving loot excitement flat after the initial hours of play.
- **Design summary:** Introduce Tier-2 (Levels 20–35) and Tier-3 (Levels 40–55) weapons and armors. Wire these new items into the drop tables of monsters in hunting grounds across all three factions (Đông Môn Thành, Ba Thục, Hứa Điền, Bắc Lĩnh, Kiếm Các, Nghiệp Quan, Tây Sơn, Nga Mi, Quan Trung).
  - Tier-2 Weapons: Thanh Phong Kiếm, Thiết Quyền Bao Tay, Phách Sơn Đao (Level req 20, higher base attack).
  - Tier-3 Weapons: Huyền Thiết Kiếm, Long Hổ Bao Tay, Trảm Mã Đao (Level req 40, advanced stat bonuses).
  - Tier-2/3 Armors: Thiết Giáp, Tử Vi Y, Hắc Báo Ngoa (providing progressive defense and HP).
- **Core loop connection:** Fighting mid-to-high level monsters -> Excitement of rare gear drop -> Equipping higher-tier weapons -> Visual and numerical combat upgrade.
- **MVP scope:**
  - Define Tier-2 and Tier-3 weapon and armor items in `src/game/items.js` with level equip requirements.
  - Wire drop chances in `MONSTER_WEAPON_DROPS` and expand `rollEnemyReward` in `server/src/rewards.js` to roll armor drops in addition to weapons.
  - Update `planEquip` (`src/game/equipment.js`) to enforce character level requirements when equipping gear.
  - Add localized names, descriptions, and icon mappings across VI, EN, and ZH locales (`src/i18n/locales/`).
- **Optional extensions:**
  - Rare blue/purple item affix rolls (+critRate, +attackSpeed) on monster drops.
  - Equipment recycling/salvaging at Blacksmith to yield Huyễn Kim Thạch fragments.
- **Dependencies:** `src/game/items.js`, `src/game/equipment.js`, `src/game/enemyCatalog.js`, `server/src/rewards.js`, `src/i18n/locales/`.
- **Risks and trade-offs:** Drop rates must be balanced (e.g., 2%–5% per kill) so that acquiring a full tier feels rewarding without saturating the inventory.
- **Effort:** M — Item definition, drop table expansion, equip validation, and localization entries.
- **Acceptance criteria:**
  - [ ] Level 20+ and Level 40+ monsters drop corresponding Tier-2 and Tier-3 equipment items.
  - [ ] Characters below the required item level cannot equip higher-tier gear.
  - [ ] Equipping high-tier gear reflects higher attack and defense values in `deriveCombatStats`.
  - [ ] All new items display proper icons and localized text in VI, EN, and ZH.
- **Validation plan:** Unit test equip requirements in `equipment.test.js`; test monster drop rolls in `rewards.test.js` and `enemyCatalog.test.js`.
- **Evidence:** `src/game/enemyCatalog.js` line 895 defines `MONSTER_WEAPON_DROPS` containing only 2 low-level monsters (`hac-y-sat-thu` and `ma-giao-de-tu`). All level 30–60 species in `docs/plan/faction-cities.md` currently have empty drop tables.
- **Assumptions / open questions:** Level requirements use existing `character.level` check during `planEquip`.

---

### [P2] Target Cycling & Selection Controls (Chuyển Đổi & Khóa Mục Tiêu Nhanh)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Eliminates combat frustration in crowded camps (where up to 270 monsters spawn) and during multi-player skirmishes on Trung Nguyên Chiến Trường. Allows PC players to quickly switch focus using `Tab` and mobile players to cycle targets with a dedicated touch button.
- **Design summary:** While single-target clicking sets `activeCombatTarget` via `setCombatTarget` (`src/game/game.js`), pressing `Tab` on desktop cycles through nearby visible hostiles within 400px radius in order of proximity or health percentage. On touch devices, a small target-cycle button adjacent to the attack cluster triggers target cycling. Pressing `Escape` or clicking empty ground deselects the current target.
- **Core loop connection:** Direct impact on core attack and skill execution speed during grinding and PvP skirmishes.
- **MVP scope:**
  - Keybind handler in `src/game/game.js` capturing `Tab` (overriding minimap zoom toggle or binding `Tab` specifically for target cycle when hostiles are present).
  - Target cycling algorithm that filters alive hostiles (monsters or hostile faction players on PvP maps) within cast range and sets `setCombatTarget`.
  - Mobile touch target cycle button added to `src/components/MobileControls.jsx`.
  - Pressing `Escape` clears `activeCombatTarget` and hides the target ring.
- **Optional extensions:**
  - Target priority preferences in game settings (e.g., "Prioritize Lowest HP", "Prioritize Enemy Players").
  - Visual directional arrow on screen edge if the locked target moves off-screen.
- **Dependencies:** `src/game/game.js`, `src/game/autoTarget.js`, `src/game/keybinds.js`, `src/components/MobileControls.jsx`.
- **Risks and trade-offs:** `Tab` is currently used as the minimap zoom shortcut in `src/i18n/locales/`; target cycling must cleanly co-exist (e.g., Tab targets nearby hostile; if no hostile nearby, toggles minimap, or assign dedicated keybind `Q`/`Tab`).
- **Effort:** S — Keyboard input mapping, proximity cycle helper, and mobile touch button.
- **Acceptance criteria:**
  - [ ] Pressing `Tab` cycles focus to the next nearest hostile target within range.
  - [ ] Target cycle respects PvP rules (never targets allies on faction maps).
  - [ ] Mobile players can tap the cycle target button to rotate locked targets.
  - [ ] Pressing `Escape` or clicking open ground deselects the target.
- **Validation plan:** Vitest unit test for proximity cycling logic; verify key event handlers in `game.test.js` and mobile button callback in `MobileControls.test.jsx`.
- **Evidence:** `src/game/game.js` lines 2080–2135 implement `setCombatTarget` and `clearCombatTarget`, but target selection currently requires individual pointer clicks or proximity auto-targeting.
- **Assumptions / open questions:** Standard ARPG `Tab` cycling convention is preferred over requiring mouse accuracy in high-density mob camps.

---

### [P2] Daily Bounty Hunting Contracts (Nhiệm Vụ Dã Tẩu Truy Nã Hàng Ngày)

- **Status:** Proposed
- **Confidence:** High
- **Player value:** Gives players structured, repeatable short-term goals after completing the newbie tutorial chain. Encourages exploration of higher-level hunting grounds and rewards consistent daily play with silver, EXP, and enhancement materials (Huyễn Kim Thạch).
- **Design summary:** Players speak to Dã Tẩu in any capital city (`market`, `thuc-thanh`, `nguy-thanh`) or interact with the Quest Tracker on the HUD. Dã Tẩu offers 3 daily bounty contracts tailored to the player's level tier (e.g., "Slay 25 Tuyết Lang in Bắc Lĩnh" or "Eliminate 20 Sơn Tặc in Đông Môn Thành"). As target monsters are defeated, the server increments contract progress and syncs to the HUD. Turning in completed contracts awards bonus EXP, silver, and upgrade stones.
- **Core loop connection:** Directs players to relevant hunting grounds -> Defeating monsters fulfills bounty objectives -> Handing in contracts yields upgrade stones -> Fuels Equipment Enhancement.
- **MVP scope:**
  - Daily contract catalog in `src/game/quests/bounties.js` categorized by level brackets (3–14, 15–29, 30–44, 45–60).
  - Server tracking of active bounty progress in `player_progress` / `saves` DB table.
  - Server event listener on `enemy_killed` in `server/src/websocket/gameSocket.js` incrementing active bounty counts.
  - HUD quest tracker update in `src/components/HUD/MinimapPanel.jsx` displaying bounty contract progress (e.g., `Tuyết Lang: 14/25`).
  - Completion turn-in via Dã Tẩu granting reward bundle (EXP, coins, 1x Huyễn Kim Thạch).
- **Optional extensions:**
  - Daily streak bonus (completing 3/3 daily bounties grants a rare equipment chest).
  - Faction-specific bounties requiring patrol or enemy player defeats on `trung-nguyen`.
- **Dependencies:** `src/game/quests/`, `src/components/HUD/MinimapPanel.jsx`, `server/src/websocket/gameSocket.js`, `server/src/data/playerDb.js`.
- **Risks and trade-offs:** Must maintain clean separation from the main Dã Tẩu newbie quest chain (`tan-thu-1`..`tan-thu-6`) so newbie story progression is not blocked.
- **Effort:** M — Server-authoritative contract persistence, kill-counter hook, and UI tracker integration.
- **Acceptance criteria:**
  - [ ] Dã Tẩu offers daily bounties matching the player's level bracket.
  - [ ] Defeating target monsters increments the bounty count in real-time on the HUD.
  - [ ] Completing the bounty permits turn-in with proper reward distribution.
  - [ ] Daily bounty progress persists across map transitions and server reconnects.
- **Validation plan:** Unit test bounty progression criteria in `bounties.test.js`; test WebSocket contract completion and reward credit in `server/tests/websocket.test.js`.
- **Evidence:** `src/game/quests/catalog.js` establishes the Dã Tẩu quest engine; `MinimapPanel.jsx` contains the existing quest tracker UI ready for multi-quest display.
- **Assumptions / open questions:** Contracts reset daily at 00:00 server time or operate on a 20-hour cooldown per account.

---

### [P2] Battlefield Outposts & Faction Scoring (Căn Cứ & Điểm Chiến Trường Trung Nguyên)

- **Status:** Proposed
- **Confidence:** Medium
- **Player value:** Transforms Trung Nguyên Chiến Trường from an unstructured deathmatch arena into an organized territorial battleground, giving faction members shared objectives, tactical focal points, and faction pride.
- **Design summary:** Three strategic outposts (Căn Cứ Hán, Căn Cứ Thục, Căn Cứ Ngụy) are established on `trung-nguyen`. Standing within a 160px zone around an outpost's flagpole channels capture points for the occupying faction over 10 seconds (contested if multiple factions are in zone). Holding an outpost periodically yields faction victory points and grants active faction players on the map a passive stat buff (+5% Attack/Defense per held base).
- **Core loop connection:** Endgame competitive objective -> Faction teamwork and coordinated pushes -> Faction rewards and status buffs.
- **MVP scope:**
  - 3 capture outpost zones positioned on `trung-nguyen` map (`src/game/maps/trungNguyenMap.js`).
  - Server-authoritative outpost state machine in `server/src/websocket/gameSocket.js` tracking occupancy and capture progression.
  - Phaser outpost banner entities displaying the controlling faction's color (Blue for Hán, Green for Thục, Gold for Ngụy, Gray for Neutral).
  - Top-screen battlefield HUD widget displaying current faction victory scores and captured outpost tallies.
- **Optional extensions:**
  - Periodic battlefield score rewards: faction with the highest hourly score receives bonus silver sent to members' mailbox/bag.
  - Faction guard NPCs spawned to defend captured outposts.
- **Dependencies:** `src/game/factions.js`, `src/game/maps/trungNguyenMap.js`, `server/src/websocket/gameSocket.js`, `src/components/HUD/`.
- **Risks and trade-offs:** Outpost occupancy checks on the server tick loop must be lightweight to prevent degradation of server tick rate (TPS) during large player gatherings.
- **Effort:** L — Server territory tick engine, Phaser banner rendering, and battlefield HUD overlay.
- **Acceptance criteria:**
  - [ ] Standing uncontested in an outpost zone captures the outpost after 10 seconds.
  - [ ] Banner graphic changes to the occupying faction's color upon capture.
  - [ ] Controlling an outpost awards periodic score points and applies a passive stat buff to faction members on the map.
  - [ ] Outpost state and faction scores sync reliably to all connected clients on `trung-nguyen`.
- **Validation plan:** Server-side multi-client WebSocket test simulating outpost contest, capture, and score accumulation in `server/tests/websocket.test.js`.
- **Evidence:** `docs/plan/faction-cities.md` specifically identified "Battlefield objective/scoring (capture points, per-faction score, rewards)" as the remaining uncompleted item from Phase 3.
- **Assumptions / open questions:** Scoring ticks run every 5 seconds on the server loop while at least one outpost is occupied.

---

## Suggested roadmap

### Next
High-value, feasible features with immediate positive impact on player progression and retention:
1. **Equipment Enhancement System [P1]:** Implements the required silver/material sink and establishes vertical progression.
2. **High-Tier Equipment & Drop Ladder [P1]:** Fills the Level 15–60 loot gap and brings equipment parity across all hunting grounds.
3. **Target Cycling & Selection Controls [P2]:** Quick usability win that significantly reduces combat friction.

### Validate first
Systems requiring prototype balancing and server tick performance verification:
1. **Daily Bounty Hunting Contracts [P2]:** Validate mob kill thresholds (e.g., 20 vs 30 kills) to ensure bounties feel engaging without excessive grinding.
2. **Battlefield Outposts & Faction Scoring [P2]:** Prototype server spatial checks for multiple players in outpost capture zones under simulated concurrency.

### Later
Long-term meta expansions for subsequent development phases:
1. **Guild / Bang Hội System:** Formal player-created guilds with shared guild treasuries and faction leadership elections.
2. **Specialized Weapon Sockets & Gem Inscription:** Horizontal gear customization allowing players to socket elemental gems into enhanced weapons.

---

## Dependencies and milestones

```
[Milestone 1: Equipment & Economic Core]
  ├── Equipment Enhancement System (Huyễn Kim Thạch, silver sink, +1..+10)
  └── High-Tier Equipment & Drop Ladder (Tier-2/3 weapons & armors, drop table wiring)

[Milestone 2: Combat Usability & Daily Flow]
  ├── Target Cycling & Selection Controls (Tab key & mobile target cycle button)
  └── Daily Bounty Hunting Contracts (Dã Tẩu mob bounties & Minimap HUD tracker)

[Milestone 3: Faction Warfare]
  └── Battlefield Outposts & Faction Scoring (Trung Nguyên capture zones, faction score HUD)
```

---

## Validation checklist

1. **Equipment Enhancement Verification:**
   - [ ] Equip starter weapon and open enhancement interface.
   - [ ] Confirm enhancement request with sufficient silver and Huyễn Kim Thạch increases item rank by +1.
   - [ ] Verify derived stats in `CharacterModal` reflect increased attack values.
   - [ ] Confirm server rejects enhancement if player silver or materials are deficient.
   - [ ] Verify failed attempts at high ranks consume materials without destroying the weapon.

2. **Equipment Drop Ladder Verification:**
   - [ ] Defeat Level 30+ monsters in Bắc Lĩnh/Kiếm Các; confirm rare Tier-2 weapon drop.
   - [ ] Attempt to equip Tier-2 weapon on a Level 5 character; confirm equip is rejected due to level requirement.
   - [ ] Level up to 20; confirm weapon equips and bonuses apply properly.
   - [ ] Confirm item names and descriptions display properly in VI, EN, and ZH.

3. **Target Cycling Verification:**
   - [ ] Enter a hunting ground with multiple monsters.
   - [ ] Press `Tab`; confirm active target locks to nearest monster and displays target ring.
   - [ ] Press `Tab` again; confirm focus cycles smoothly to the next closest monster.
   - [ ] Test mobile target cycle button; verify identical behavior on touch viewport.
   - [ ] Press `Escape`; confirm target deselects and target ring disappears.

4. **Daily Bounty Contracts Verification:**
   - [ ] Speak to Dã Tẩu; accept daily bounty contract matching player level.
   - [ ] Defeat designated monsters; confirm kill counter updates in real time on Minimap HUD tracker.
   - [ ] Complete bounty and speak to Dã Tẩu; verify EXP, silver, and Huyễn Kim Thạch are awarded.
   - [ ] Disconnect and reconnect; verify active bounty progress remains persisted.

5. **Battlefield Outpost Verification:**
   - [ ] Travel to Trung Nguyên Chiến Trường and enter an outpost capture zone.
   - [ ] Hold position for 10 seconds uncontested; confirm outpost captures for player faction.
   - [ ] Verify outpost banner color updates to faction hue.
   - [ ] Confirm faction score ticks upward on the battlefield HUD widget.
   - [ ] Bring enemy faction player into zone; verify capture pauses due to contest state.

---

## Deferred ideas

- **Player-to-Player Direct Trade & Auction House:** Deferred to avoid secondary market exploitation and botting until server-wide trade logging and anti-fraud checks are built.
- **Pay-to-Win Gacha / Loot Boxes:** Explicitly rejected to preserve authentic classic wuxia progression and player trust.
- **Full Automated Combat Botting:** Explicitly rejected; auto-targeting aids touch usability, but autonomous navigation/farming botting degrades active multiplayer immersion.

---

## Open questions

1. **Minimap Zoom Keybind Conflict:** `Tab` currently toggles the minimap 5x zoom. Should `Tab` be repurposed for Target Cycling while `Shift+Tab` or `M` handles map view, or should target cycling use `Q` / `E` by default?
2. **Enhancement Tier Thresholds:** Should higher enhancement tiers (+7 to +10) introduce a risk of rank degradation on failure (e.g., dropping to +6), or should failures simply retain the current rank to keep the progression accessible?
