# 2D Game UI/UX Improvement Plan

- **Date:** 2026-10-31
- **Project / engine:** JX2 Wuxia RPG ("Giang Hồ") — React 18 + Phaser 3.80 (Vite build system)
- **Audit scope:** React HUD Overlay (`src/components/HUD/*`), Modals (`src/components/Modals/*`), Touch Controls (`src/components/MobileControls.jsx`, `src/components/MobileSkillPicker.jsx`, `src/components/MobileItemPicker.jsx`), Game Canvas & Scene lifecycle (`src/components/GameCanvas.jsx`, `src/App.jsx`), Styling & Design Tokens (`src/index.css`, `src/styles/*`), Phaser-React Event Bridge (`src/game/bridge.js`, `src/game/uiBridgeAdapter.js`), combat feedback & VFX (`src/game/combat.js`, `src/game/skillVfx.js`, `src/game/pvpTargeting.js`, `src/game/targetRing.js`), and Vitest test suite (`src/**/*.test.js`, `src/**/*.test.jsx`).
- **Limitations:** Static code analysis, architectural review, and headless Vitest execution in a Linux container. Live browser audio synthesizer timbre, physical multi-touch feel on actual mobile hardware, and GPU shader performance were evaluated via CSS inspection, responsive media queries, and simulation rather than physical touch hardware.

---

## Executive summary

"Giang Hồ" is a browser-playable 2D Wuxia MMORPG combining a Phaser 3 canvas engine with a rich React 18 UI overlay. The game delivers an authentic Wuxia aesthetic with parchment modals, CJK glyphs, metallic brackets, radial touch fans, and traditional health/mana vitals.

While recent iterations successfully introduced essential combat HUD elements (such as `TargetVitals` frame, selection reticles, and conic radial cooldown sweeps), auditing the end-to-end player journeys reveals noticeable friction in **information legibility**, **inventory decision-making**, **critical state awareness**, and **input discoverability**:

1. **Equipment Decision Paralysis:** The inventory modal lacks comparative stat delta tooltips (Equipped vs. Bagged item), forcing players to continuously toggle between `F3` (Character) and `F4` (Inventory).
2. **Keyboard Shortcut Discoverability:** Desktop hotkeys (`F3`, `F4`, `F5`, `Tab`, `M`, `J`, `Esc`) are buried in `HelpModal` or hidden in mouse hover tooltips, slowing down navigation for new players.
3. **Critical State & Health Urgency Communication:** Player HP depletion below 25% produces no distinct peripheral alert (no low-health pulsing vignette or heartbeat audio cue), leading to unanticipated deaths in mob swarms.
4. **Combat Floating Text Differentiation:** Damage, healing, MP recovery, and critical strikes lack distinct typography, color grading, and scale dynamics, reducing the tactical satisfaction of martial arts skills.
5. **NPC Interaction & Quest Affordance in World:** In-world NPC nameplates and overhead indicators lack visual distinction for quest givers (Available `!` vs. In-progress `?` vs. Shop icon), requiring players to walk up and interact blindly.

Addressing these prioritized opportunities will substantially elevate player comprehension, reduce navigation cognitive load, and heighten combat satisfaction without compromising the game's authentic Wuxia identity.

---

## Current experience and evidence

### Audited Player Journeys & Architecture Evidence

1. **Launch, Login & Character Creation:**
   - Managed in `src/App.jsx`, `src/components/Modals/LoginModal.jsx`, and `src/components/Modals/CharacterSelectModal.jsx`.
   - Smooth guest flow, server authentication, and character slot selection with gender and sect alignment.
2. **HUD Overlay & Tactical Information:**
   - `PlayerVitals.jsx` (top-left): displays Level, EXP, HP, MP, Stamina, and Martial Aura.
   - `TargetVitals.jsx` (top-center): displays active monster/player target name, level, HP percentage, boss/pvp badge, and dismiss button (`ACTION_CLEAR_TARGET`).
   - `MinimapPanel.jsx` (top-right): radar canvas, active quest tracker, subzone, coordinates, and zoom/collapse toggle.
   - `ChatPanel.jsx` (bottom-left): multi-tab chat feed (All, Near, Combat, System) with send input.
   - `HotbarDock.jsx` (bottom-dock): 9 quick-slots holding consumables or dragged skills with conic cooldown sweeps and MP deficiency styling (`.insufficient-mp`), plus system tray buttons (`🧍`, `🎒`, `🥋`, `📜`, `⚔️`, `🚪`).
3. **Mobile & Touch Experience:**
   - `MobileControls.jsx`: Virtual joystick (bottom-left) and radial arc (bottom-right) surrounding the central Attack button with 4 configurable skill slots and 2 outer consumable slots (`MobileSkillPicker`, `MobileItemPicker`).
   - Dynamic touch token scaling via `--mctrl-scale` and `@media (pointer: coarse)`.
4. **Inventory & Progression Management:**
   - `InventoryModal.jsx` (`F4`): 42-slot grid with drag-and-drop pointer support (`pointerItemDrag.js`), currency breakdown (Vàng, Bạc, Đồng), and hover tooltip (`inv-tooltip`).
   - `CharacterModal.jsx` (`F3`): Paper-doll 12-slot equipment view, derived combat stats (Attack, Defense, Crit, Evasion), and unequip handlers.
   - `SkillsModal.jsx` (`F5`): Sect martial arts tree with drag-to-hotbar triggers and skill upgrade buttons.
   - `QuestLogModal.jsx` (`J`): Newbie chain tracker with objectives, status chips, and reward previews.
   - `ShopModal.jsx`: NPC herb dispensary with price checks in Bạc.

---

## Prioritized improvements

### [P1] Comparative Equipment Tooltips & Stat Delta Highlights
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/Modals/InventoryModal.jsx` (lines 249–275), `src/components/Modals/CharacterModal.jsx`, `src/game/equipment.js` (`bonusRows`)
- **Player Impact:** When players inspect equipment in their inventory, the tooltip only displays the hovered item's raw attributes. Players cannot determine whether a newly looted sword or armor is an upgrade without manually opening `CharacterModal` (`F3`), memorizing current equipment stats, and switching back to `InventoryModal` (`F4`).
- **Recommendation:**
  1. In `InventoryModal.jsx`, check if `hovered.slot` matches an equipped item in `equipment[hovered.slot]`.
  2. If an item is currently equipped in that slot, render a side-by-side or stacked comparative tooltip card:
     - "Đang trang bị" (Currently equipped item name and stats).
     - "Vật phẩm mới" (Hovered item name and stats).
     - Stat deltas in clear contrasting colors: `+X` in green (`#4ade80`), `-X` in red (`#f87171`), or neutral grey for identical stats.
- **Acceptance criteria:**
  - [ ] Hovering over equippable gear in `InventoryModal` displays comparative stats against currently worn gear in that slot.
  - [ ] Differences in Attack, Defense, Max HP, and Speed display color-coded delta values (`+` green, `-` red).
  - [ ] If the slot is empty, displays a clear tag: "Chưa trang bị ô này".
- **Validation:** Open inventory with equipped starter sword; hover over a dropped saber/sword in inventory; confirm comparison tooltip renders with correct stat deltas.
- **Effort:** S (Tooling logic in `InventoryModal.jsx` using existing `bonusRows` helper from `equipment.js`).
- **Dependencies / risks:** Low risk; UI-only presentation using existing `equipment` props.

---

### [P1] Low-Health (<25% HP) Urgency Vignette and Audio Pulse
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/PlayerVitals.jsx`, `src/App.jsx` (`stats.hp`, `stats.maxHp`), `src/game/combat.js` (`playTone`), `src/index.css`
- **Player Impact:** In dense mob farming (e.g. against packs of Dã Lang), players frequently take sustained damage without noticing their health bar draining until death occurs, because status bars reside in the peripheral top-left corner of the viewport.
- **Recommendation:**
  1. Add a screen-space red radial pulsing vignette overlay (`.low-hp-vignette`) that triggers when `hp / maxHp < 0.25`.
  2. Pulsing animation intensity scales with danger (faster pulse below 15% HP).
  3. Emit a soft low-frequency warning heartbeat sound via `playTone` (or Web Audio synth) when entering critical health state (with a 3-second debounce).
  4. Respect accessibility preferences: disable screen shake/vignette if `prefers-reduced-motion` is active.
- **Acceptance criteria:**
  - [ ] When player HP drops below 25%, a soft red vignette pulses around the edges of `#game-shell`.
  - [ ] Vignette smoothly fades out immediately when HP is restored above 25% (e.g. by drinking an HP potion).
  - [ ] Vignette does not capture pointer events (`pointer-events: none`).
- **Validation:** Take damage from wolves until HP < 25; verify red pulse triggers; use Kim Sáng Dược; verify pulse clears.
- **Effort:** XS (CSS keyframe vignette in `index.css` conditioned on `stats.hp / stats.maxHp <= 0.25` in `App.jsx`).
- **Dependencies / risks:** None.

---

### [P2] In-Game Keybind Discoverability Badges on HUD Controls
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/HotbarDock.jsx` (lines 145–205), `src/components/HUD/MinimapPanel.jsx` (lines 100–120), `src/App.jsx` (lines 485–550)
- **Player Impact:** Essential keyboard shortcuts (`F3` Nhân Vật, `F4` Hành Trang, `F5` Võ Công, `J` Nhiệm Vụ, `Tab` Phóng to Bản đồ, `M` Bản đồ thành, `Space` Đánh thường) are hidden in mouseover tooltips or `HelpModal`. New desktop players repeatedly click small buttons rather than utilizing fluid hotkeys.
- **Recommendation:**
  1. Render subtle metallic keycap badges on system tray buttons in `HotbarDock.jsx`:
     - Character button: badge `F3`
     - Inventory button: badge `F4`
     - Skills button: badge `F5`
  2. Add keycap badge `[Tab]` on the minimap zoom button in `MinimapPanel.jsx`.
  3. Add keycap badge `[J]` next to the quest tracker header in `MinimapPanel.jsx`.
  4. Ensure badges are hidden automatically when touch controls are active (`@media (pointer: coarse)` or mobile mode).
- **Acceptance criteria:**
  - [ ] Desktop viewport renders legible `F3`, `F4`, `F5`, `Tab`, and `J` keycap badges on corresponding HUD elements.
  - [ ] Mobile/touch viewports hide all keyboard badges to avoid visual clutter.
- **Validation:** Launch game on desktop resolution; observe clear hotkey indicators on dock and minimap; toggle mobile emulation; verify badges disappear.
- **Effort:** XS (Minor JSX badge elements with `.hotkey-badge` styling in `index.css`).
- **Dependencies / risks:** None.

---

### [P2] Overhead NPC Quest Markers & Nameplate Visual Distinction
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/game/npc.js`, `src/game/npcRoster.js`, `src/game/questView.js` (`npcDialogView`), `src/components/Modals/NpcDialogModal.jsx`
- **Player Impact:** Players exploring Biện Kinh or hunting areas cannot distinguish between a quest giver with an active task, a quest target ready for turn-in, and an ordinary merchant without manually walking up and initiating dialogue.
- **Recommendation:**
  1. Render overhead animated quest marker icons above NPC sprites in Phaser:
     - Golden exclamation mark `!` when NPC has an available quest (`npcDialogView.available`).
     - Golden question mark `?` when NPC has an objective ready for turn-in (`npcDialogView.turnIn`).
     - Silver question mark `?` when quest is currently in progress.
     - Herbal dispensary icon or purse symbol above merchants (`Dược Sư`, `Chủ Tiệm`).
  2. Distinct nameplate colors: NPCs with quests render names in bright gold (`#ffd700`), merchants in jade green (`#4ade80`), and standard lore NPCs in ivory (`#e2e8f0`).
- **Acceptance criteria:**
  - [ ] NPCs with turn-in ready quests display a pulsating `?` above their overhead nameplate.
  - [ ] NPCs offering a new quest display a bright `!` marker.
  - [ ] Merchants display shop affordance badge on nameplates.
- **Validation:** Talk to Dược Sư or Thôn Trưởng; verify overhead markers reflect quest lifecycle changes.
- **Effort:** M (Phaser overhead container rendering in `src/game/npc.js` linked with `questState` updates).
- **Dependencies / risks:** Depends on quest state propagation to Phaser NPC entities.

---

### [P2] Differentiated Floating Combat Text & Critical Strike Feedback
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/game/combat.js` (`showFloatText`), `src/game/enemy.js`, `src/game/skillVfx.js`
- **Player Impact:** Combat damage numbers currently float upward in uniform yellow/white text. Critical strikes, skill attacks, normal sword slashes, and incoming mob hits blend together, making combat feel flat and reducing tactile hit feedback.
- **Recommendation:**
  1. Differentiate floating text categories with dedicated color palettes and animations:
     - Normal damage: Clean ivory/yellow (`#fef08a`), subtle upward float.
     - Critical strike: Bold gold-red outline (`#ef4444`), 1.4x scale pop with spring overshoot animation and "Bạo kích!" prefix.
     - Healing (HP Potions / Skills): Vibrant green (`#22c55e`) with `+` prefix and gentle upward drift.
     - Mana recovery (MP Potions): Cyan-blue (`#38bdf8`) with `+` prefix.
     - Miss / Dodge: Muted grey-blue (`#94a3b8`) italic "Né tránh".
  2. Add slight random horizontal scatter (±14px) so rapid multi-hit flurries (e.g. Phong Ma Côn Pháp) do not stack illegibly on top of each other.
- **Acceptance criteria:**
  - [ ] Critical hits render at 1.4x font size with distinct red/gold coloration and pop animation.
  - [ ] Healing and mana restoration render in green and cyan with clear `+` indicators.
  - [ ] Multi-hit attacks scatter horizontally to prevent text overlap.
- **Validation:** Execute multi-hit skill attacks and drink HP/MP potions in combat; inspect floating text styling and readability.
- **Effort:** S (Enhancement of `showFloatText` in `combat.js`).
- **Dependencies / risks:** None.

---

### [P3] Item Rarity Visual Borders & Inventory Auto-Sort Affordance
- **Status:** Proposed
- **Confidence:** Medium
- **Type:** Observed issue
- **Evidence:** `src/components/Modals/InventoryModal.jsx`, `src/game/items.js`, `src/components/Modals/inventory.css`
- **Player Impact:** Inventory grid displays items with identical dark wood slot borders regardless of item tier (Common consumable vs. Rare martial manual vs. High-tier weapon). Bag organization after long hunting sessions is cumbersome without a quick-sort option.
- **Recommendation:**
  1. Add colored border tokens according to item rarity or category:
     - Consumable (Dược phẩm): Green accent (`#22c55e`).
     - Weapon / Armor (Trang bị): Bronze/Silver/Gold tier borders (`#e0a96d`, `#94a3b8`, `#f59e0b`).
     - Martial Arts Books (Bí kíp): Mystical purple glow (`#a855f7`).
     - Quest item (Vật phẩm nhiệm vụ): Amber-gold badge (`#f59e0b`).
  2. Add an "Sắp xếp" (Auto-sort) button in the inventory title bar that groups consumables, equipment, and books systematically.
- **Acceptance criteria:**
  - [ ] Skill books, weapons, and consumables have distinct border accents in `InventoryModal`.
  - [ ] Clicking "Sắp xếp" organizes inventory slots by item type and tier.
- **Validation:** Fill bag with assorted potions, books, and weapons; verify visual border tiers; click sort and check grid consistency.
- **Effort:** S (CSS styling for item borders + inventory sorting helper function).
- **Dependencies / risks:** Server-side inventory sync must accept reordered bag slots.

---

### [P3] Chat Panel Drag-to-Resize & Quick Tab Filter Notifications
- **Status:** Proposed
- **Confidence:** Medium
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/ChatPanel.jsx`, `src/index.css` (`.chat-content`, `.chat-tabs`)
- **Player Impact:** Chat log height is fixed at 105px. During party combat or active PvP, combat messages rapidly push system and direct messages off-screen. Additionally, unread messages in inactive tabs (e.g. "Gần" or "Hệ thống") do not provide unread pings.
- **Recommendation:**
  1. Add an unread dot notification (`.tab-unread-dot`) on inactive chat tabs when new messages arrive.
  2. Provide a subtle top-edge resize handle allowing desktop players to expand chat height between 100px and 260px.
- **Acceptance criteria:**
  - [ ] Incoming messages in non-active tabs trigger an unread gold dot on the respective tab header.
  - [ ] Clicking the tab clears the unread indicator.
- **Validation:** Switch to "Gần" tab while receiving "Hệ thống" logs; verify unread dot appears and clears on tab click.
- **Effort:** S (State tracking in `ChatPanel.jsx`).
- **Dependencies / risks:** None.

---

### [P1] Target Selection Ring and Target Vitals HUD Frame (Completed)
- **Status:** Done
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/TargetVitals.jsx`, `src/game/targetRing.js`, `src/game/bridge.js`
- **Accomplishment:** Integrated gold/red Phaser selection rings and top-center `TargetVitals` HUD displaying live HP%, target level, boss/pvp badges, and deselect triggers.

---

### [P1] Conic Radial Cooldown Sweep & Out-of-Resource States (Completed)
- **Status:** Done
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/HotbarDock.jsx`, `src/components/MobileControls.jsx`, `src/index.css`
- **Accomplishment:** Added smooth clockwise conic gradient cooldown overlays on desktop slots and mobile arc buttons, alongside `.insufficient-mp` desaturation and blue tint states.

---

### [P1] Mobile Joystick and Chat Collision Prevention (Completed)
- **Status:** Done
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/MobileControls.jsx`, `src/index.css`
- **Accomplishment:** Dynamic CSS tokens (`--mctrl-*`), elevated chat panel above joystick thumb zone, hidden numbered bar on touch devices, and 48x48px minimum touch hitboxes.

---

## Implementation phases

### Phase 1: High Impact Combat Clarity (Completed)
- [x] Implement Target Selection Ring & Target Vitals HUD Frame (`[P1]`).
- [x] Implement Conic Radial Cooldown Sweep & Insufficient Resource Styling (`[P1]`).
- [x] Resolve Mobile Joystick / Chat Panel Collision and Touch Hitbox Scaling (`[P1]`).

### Phase 2: Immediate Information & Ergonomics (Now)
- [ ] Implement Comparative Equipment Tooltips & Stat Delta Highlights in Inventory (`[P1]`).
- [ ] Add Low-Health (<25% HP) Urgency Vignette and Audio Pulse (`[P1]`).
- [ ] Add In-Game Keybind Badges (`F3`, `F4`, `F5`, `Tab`, `J`) on Desktop HUD Controls (`[P2]`).

### Phase 3: World Immersion & Combat Polish (Next)
- [ ] Implement Overhead NPC Quest Markers (`!`, `?`) and Nameplate Styling (`[P2]`).
- [ ] Differentiate Floating Combat Text (Critical strikes, Healing, Mana recovery) (`[P2]`).

### Phase 4: Inventory & Chat Enhancements (Later)
- [ ] Add Item Rarity Borders and Inventory Auto-Sort (`[P3]`).
- [ ] Add Chat Tab Unread Indicators and Vertical Resize (`[P3]`).

---

## Validation checklist

- [ ] **Target Resolutions:**
  - Desktop 1920x1080 (Full HD): All HUD panels, hotbar badges, and comparative tooltips render without overlapping.
  - Laptop 1366x768 & 1280x720: Dock and vitals fit cleanly; tooltips do not clip off screen edges.
  - Tablet 1024x768: Touch controls adapt gracefully; modals remain centered.
  - Mobile Landscape 844x390, 667x375, 568x320: Joystick, attack fan, and potion buttons maintain non-overlapping ergonomics.
- [ ] **Input Methods:**
  - Keyboard: `F3`, `F4`, `F5`, `Tab`, `M`, `J`, `Esc`, `1-9`, `Space`, `W/A/S/D`.
  - Mouse: Left click to move/attack, right click to unbind quickslots, hover tooltips for equipment comparisons.
  - Touch: Virtual joystick drag, tap to attack/cast, hold 780ms to rebind mobile skills/potions.
- [ ] **Accessibility & Feedback:**
  - Red low-HP vignette respects `prefers-reduced-motion` settings.
  - Color is paired with iconography or text prefixes (e.g. `+` for heals, `Bạo kích` for crits, `!` / `?` for quests).
- [x] **Localization:**
  - All newly proposed tooltips and badge labels exist or are mapped in `src/i18n/vi.json`, `src/i18n/en.json`, and `src/i18n/zh.json`.
- [x] **Regression & Performance:**
  - `npm test` passes with zero failures across the entire test suite.

---

## Open questions

1. *Equipment Comparison Layout:* Should the comparative tooltip render as a dual side-by-side card (classic PC MMORPG) or a single unified card showing current equipment stats with inline green/red delta badges?
2. *Overhead Quest Indicators:* For Phaser overhead markers (`!`, `?`), should they bounce with an arcade sine wave tween or remain static pinned to the entity nameplate to minimize screen distraction?

---

## Out of scope

- Direct alteration of core combat formulas, character attribute tables, or server damage calculation.
- Replacement of authentic wuxia pixel art or sprite sheet generation.
- Full rework of the WebSocket multiplayer protocol or database schema.

---

## Completion criteria

The UI/UX Improvement Plan is complete when findings are evidence-linked, prioritized with clear player impact, testable via acceptance criteria, saved in `docs/plan/ui-ux-improvement-plan.md`, and validated by running `npm test`.
