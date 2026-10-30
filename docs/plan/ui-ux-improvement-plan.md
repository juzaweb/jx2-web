# 2D Game UI/UX Improvement Plan

- **Date:** 2026-10-26
- **Project / engine:** JX2 Wuxia RPG ("Giang Hồ") — React 18 + Phaser 3.80 (Vite build system)
- **Audit scope:** React HUD Overlay (`src/components/HUD/*`), Modals (`src/components/Modals/*`), Touch Controls (`src/components/MobileControls.jsx`), Game Orchestrator (`src/App.jsx`), Styling & Design Tokens (`src/index.css`, `inventory.css`, `quests.css`), Phaser-React Event Bridge (`src/game/bridge.js`, `src/game/uiBridgeAdapter.js`), combat feedback & VFX (`src/game/combat.js`, `src/game/skillVfx.js`), and Vitest test suite (`src/**/*.test.js`, `src/**/*.test.jsx`).
- **Limitations:** Static code inspection, architectural review, and Vitest suite execution performed in headless Linux sandbox environment. Physical mobile device touch response and actual OLED screen rendering could not be directly playtested; verified via CSS media queries, responsive logic, layout tokens, and unit tests.

---

## Executive summary

"Giang Hồ" is a browser-playable 2D Wuxia RPG combining a Phaser 3 canvas engine with a React 18 UI overlay. The game delivers an authentic Wuxia aesthetic with parchment modals, CJK icon glyphs, metallic brackets, and classic status bars.

As the gameplay expands across weapon-based skill kits, inventory management, NPC shops, quest chains, and mobile touch controls, several key UI/UX friction points impact player clarity and responsiveness:

1. **Targeting & Enemy Combat Feedback:** Lack of an explicit target selection frame / overhead ring and target health HUD, causing ambiguity during target selection and mob combat (Resolved in P1).
2. **Skill Cooldown & Resource Readiness:** Cooldown timers previously rendered as plain text numbers without radial conic sweep overlays or distinct visual states when MP/Stamina is insufficient for skill execution (Resolved in P1).
3. **Mobile & Touch Ergonomics:** Spatial collision between the virtual joystick, chat panel, and hotbar dock on low-resolution mobile viewports (<720px width) (Resolved in P1).
4. **Shortcut Discoverability:** Essential keyboard hotkeys (`F3`, `F4`, `F5`, `Tab`, `M`) rely on tooltips or help modals rather than persistent shortcut badge overlays on HUD controls (`[P2]` Proposed).
5. **Inventory Comparative Tooltips:** Lack of side-by-side equipment comparison tooltips when inspecting inventory items against equipped gear (`[P2]` Proposed).
6. **NPC Quest Dialog Hierarchy:** Primary quest advancement buttons share uniform styling with secondary actions, reducing dialogue choice clarity (`[P2]` Proposed).
7. **Floating Combat Feedback:** Combat numbers (damage, critical hits, healing) lack distinct animation and visual hierarchy (`[P3]` Proposed).

Addressing these remaining prioritized recommendations will enhance combat clarity, streamline input discoverability, and improve dialogue and inventory interaction without changing core game mechanics or art direction.

---

## Current experience and evidence

### Observed Player Flows & Architecture

1. **Launch & Entry Flow:** `LoginModal` -> `CharacterSelectModal` -> Game World. Managed smoothly in `src/App.jsx` with guest session handling, i18n support (VI/EN/ZH), and mobile orientation prompts.
2. **HUD Overlay:** `PlayerVitals` top-left displays Level, EXP, HP, MP, Stamina, and Martial Aura. `TargetVitals` top-center displays active target name, level, HP%, and status badges. `MinimapPanel` top-right shows radar canvas, quest tracker, subzone, and zoom/collapse controls.
3. **Hotbar Dock:** `HotbarDock` bottom-center houses 9 mixed quick-slots (each holds a consumable item or a weapon skill), plus system tray buttons (`F3` Character, `F4` Inventory, `F5` Skills, Help, PK mode). Techniques are dragged from the `F5` skill tree onto a slot and cast with its number key; consumables are dragged from the bag.
4. **Mobile Controls:** `MobileControls` displays a virtual joystick on the bottom-left and a radial arc on the bottom-right with an Attack button and four configurable skill buttons (empty by default, shown as `+`; `MobileSkillPicker` assigns them). Two consumable buttons (`MobileItemPicker`) sit in their own column outside the fan. Touch layout uses CSS layout tokens and lifts the chat panel above the joystick.
5. **Modals & Dialogs:** `CharacterModal`, `InventoryModal`, `SkillsModal`, `CityMapModal`, `ShopModal`, `NpcDialogModal`, `QuestLogModal`. Pointer drag support is provided via `useDraggablePanel.js`, `dragItem.js`, and `pointerItemDrag.js` (skills and items share the same drag pipeline).

---

## Prioritized improvements

### [P1] Target Selection Ring and Target Vitals HUD Frame
- **Status:** Done
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/game/player.js`, `src/game/enemy.js`, `src/components/HUD/PlayerVitals.jsx`, `src/components/HUD/TargetVitals.jsx`, `src/game/bridge.js`
- **Player Impact:** When attacking wolves or NPCs, players cannot easily confirm which entity is currently locked on or evaluate enemy remaining health without watching floating damage numbers.
- **Recommendation:**
  1. Emit `TARGET_UPDATED` events over `bridge.js` when player selects or switches targets in Phaser.
  2. Draw an overhead selection ring in Phaser around the active target entity.
  3. Render a top-center "Target Vitals" HUD component displaying the target name, level, HP bar percentage, and status effects.
- **What shipped:** Added `TargetVitals.jsx` HUD frame anchored at top-center displaying target name, level, HP% with smooth bar, boss/duelist badges, and close button. Linked Phaser selection ring (`TargetRing`) in `game.js` for both monsters (gold) and rivals (red), emitting `TARGET_UPDATED` and handling `ACTION_CLEAR_TARGET` / `Esc` key deselect. Target auto-clears on entity death or leaving range (>1600px).
- **Acceptance criteria:**
  - [x] Selecting an enemy displays a golden/red selection ring around the entity sprite in Phaser.
  - [x] Target Vitals HUD frame appears top-center with live updating target health percentage.
  - [x] Target frame auto-clears when the target dies or moves beyond interaction range.
- **Validation:** Select mobs in Biện Kinh map; verify selection reticle position and real-time HP depletion.
- **Effort:** M (Requires Phaser selection tracking + React HUD bridge integration)
- **Dependencies / risks:** Minimal risk; depends on target payload emitted via `bridge.js`.

---

### [P1] Conic Radial Cooldown Sweep & Out-of-Resource States for Skill Icons
- **Status:** Done
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/HotbarDock.jsx`, `src/components/MobileControls.jsx`, `src/components/SkillIcon.jsx`, `src/index.css`
- **Player Impact:** Skill cooldowns previously rendered as plain integer overlays (`<span className="slot-cd">3</span>`). Players could not intuitively gauge cooldown sweep progress or distinguish between a skill on cooldown vs. a skill unusable due to insufficient MP.
- **Recommendation:**
  1. Add a CSS conic-gradient dark radial sweep overlay on skill icons during cooldown countdown.
  2. Apply an out-of-resource visual state (`.insufficient-mp` desaturation / blue tint) when current player MP < skill MP cost.
- **What shipped:** Added CSS `conic-gradient` overlay (`--cd-sweep`) on `.slot-cd` and `.arc-cd` with smooth clock ticking in `useSkillCooldowns`. Implemented `.insufficient-mp` visual state with desaturation, drop shadow, and blue tint overlay when character MP is lower than skill MP cost across both Desktop Hotbar and Mobile Controls.
- **Acceptance criteria:**
  - [x] Skill icons render a smooth clockwise radial dark overlay representing remaining cooldown percentage.
  - [x] Skills with MP cost exceeding player MP display a visually distinct out-of-resource state.
- **Validation:** Trigger skills in rapid succession; confirm radial sweep animation and low-MP visual feedback.
- **Effort:** S (CSS conic gradient styling + MP check in `HotbarDock.jsx` and `SkillIcon.jsx`)
- **Dependencies / risks:** None.

---

### [P1] Mobile Joystick and Chat Panel Collision Prevention & Touch Hitbox Scaling
- **Status:** Done
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/MobileControls.jsx`, `src/components/HUD/ChatPanel.jsx`, `src/index.css` (`:root` touch tokens, `@media (pointer: coarse), (max-height: 500px)`)
- **Player Impact:** On mobile screens or narrow viewports (<768px), the virtual joystick base on the bottom-left overlapped with the expanded chat panel, causing accidental chat opens or stuck movement gestures.
- **Recommendation:**
  1. Automatically minimize `ChatPanel` into a compact icon tab when touch mobile controls are active.
  2. Increase touch target hitboxes for `MobileControls` arc buttons to a minimum of 48x48px with 8px padding gaps.
  3. Ensure virtual joystick touch capture zone is isolated from hotbar dock boundaries.
- **What shipped:** All control sizes are layout tokens (`--mctrl-*` on `:root`, scaled by `--mctrl-scale` on short viewports), the chat panel is lifted above the joystick (`bottom: calc(var(--mctrl-joy) + var(--mctrl-edge) * 2)`), the numbered `1`–`9` bar is hidden on touch so the joystick has no dock to overlap, and the menu tray re-centres as icon-only 48x44 buttons between the two thumbs.
- **Acceptance criteria:**
  - [x] On mobile touch viewports, `ChatPanel` no longer overlaps the joystick.
  - [x] Skill arc buttons maintain minimum 48x48px touch boundaries without touch event overlap (56px skills, 48px potions, 74px attack).
- **Validation:** Measured with the dev server in an 844x390, 667x375 and 568x320 viewport: no rect intersection between joystick, skill fan, potion ring, menu tray, minimap and chat.
- **Effort:** S (CSS breakpoint adjustments and default state in `App.jsx`)
- **Dependencies / risks:** None.

---

### [P2] In-Game Keybind Discoverability & HUD Shortcut Overlays
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/App.jsx` (Global keydown listener), `src/components/HUD/HotbarDock.jsx`, `src/components/HUD/MinimapPanel.jsx`
- **Player Impact:** Essential keyboard shortcuts (`F3` Character, `F4` Inventory, `F5` Skills, `Tab` Zoom Minimap, `M` City Map) are listed in tooltips or `HelpModal`, but new players frequently miss them during active gameplay.
- **Recommendation:**
  1. Add legible hotkey badge overlays (`[F3]`, `[F4]`, `[F5]`) on system tray buttons in `HotbarDock.jsx`.
  2. Add a `[Tab]` shortcut label on the minimap zoom button in `MinimapPanel.jsx`.
  3. Display a floating contextual hint prompt (e.g., "Nhấn [M] để mở bản đồ thành thị") upon first city entry.
- **Acceptance criteria:**
  - [ ] Hotbar system tray buttons render distinct hotkey badges (`F3`, `F4`, `F5`).
  - [ ] Minimap zoom button displays `[Tab]` label.
  - [ ] Badges remain readable across desktop resolutions without cluttering icon labels.
- **Validation:** Confirm hotkey badge rendering across multiple screen resolutions and language options.
- **Effort:** XS (Minor JSX badge additions and CSS styling)
- **Dependencies / risks:** None.

---

### [P2] Comparative Inventory Tooltips & Rarity Border Highlights
- **Status:** Proposed
- **Confidence:** Medium
- **Type:** Observed issue
- **Evidence:** `src/components/Modals/InventoryModal.jsx`, `src/components/Modals/CharacterModal.jsx`, `src/game/items.js`, `src/game/equipment.js`
- **Player Impact:** Hovering over equipment items in the inventory displays basic item stats, but players cannot easily compare the item against currently worn gear in that equipment slot.
- **Recommendation:**
  1. Expand inventory hover tooltips to render a dual comparison card (Equipped vs. Hovered Item) showing stat deltas (+HP, +Def, +Atk in green/red text).
  2. Add visual rarity border highlights (Common = Grey, Rare = Blue, Epic = Purple, Legendary = Gold) on item slots.
- **Acceptance criteria:**
  - [ ] Hovering equipment items in inventory displays side-by-side comparison against equipped gear.
  - [ ] Stat deltas (+5 Atk green, -2 Def red) render clearly in the comparison panel.
  - [ ] Item icon borders reflect item rarity tier.
- **Validation:** Hover over weapons and armor in inventory; verify comparison calculations and delta styling.
- **Effort:** S (Tooltip component enhancement in `InventoryModal.jsx`)
- **Dependencies / risks:** Depends on equipment stat definitions in `src/game/equipment.js`.

---

### [P2] NPC Quest Dialog Action Hierarchy & Visual Icons
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/Modals/NpcDialogModal.jsx`, `src/game/questView.js`
- **Player Impact:** When speaking to NPCs, buttons for accepting quests, turning in quests, opening shops, and closing dialogue share similar visual weight, leading to accidental misclicks or confusion.
- **Recommendation:**
  1. Style primary quest advancement buttons (`Nhận nhiệm vụ`, `Trả nhiệm vụ`) with high-contrast primary gold theme and quest status icons (📜 / ❓ / ❗️).
  2. Maintain neutral secondary styling for ambient actions like opening shops or closing dialog.
- **Acceptance criteria:**
  - [ ] Primary quest progression actions in `NpcDialogModal` render with primary gold button styling and quest state icons.
  - [ ] Secondary actions retain neutral secondary button styling.
- **Validation:** Interact with village NPCs across different quest states; verify button visual hierarchy.
- **Effort:** XS (JSX styling & button variant updates in `NpcDialogModal.jsx`)
- **Dependencies / risks:** None.

---

### [P3] Floating Damage Text Styling & Critical Hit Animation Polish
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/game/combat.js`, `src/game/skillVfx.js`
- **Player Impact:** Floating combat damage text pops up above targets, but critical hits, skill damage types, and healing numbers look visually homogeneous.
- **Recommendation:**
  1. Differentiate floating combat text styling: Normal damage (yellow/white float up), Critical hits (larger red/gold pop with scale spring animation), Healing (green float up with `+` prefix), MP recovery (blue float up).
- **Acceptance criteria:**
  - [ ] Critical hits scale up to 1.4x size with bold red/gold text outline.
  - [ ] Healing and MP restoration numbers render in distinct green and blue colors.
- **Validation:** Attack mobs and use health/mana potions; verify combat text colors and scale animations.
- **Effort:** S (Phaser text styling in `src/game/combat.js`)
- **Dependencies / risks:** None.

---

### [P3] Reconnection Status & Network Hiccup Grace Overlay
- **Status:** Proposed
- **Confidence:** Medium
- **Type:** Observed issue
- **Evidence:** `src/components/ConnectionLostOverlay.jsx`, `src/game/networkClient.js`
- **Player Impact:** Transient network lag spikes immediately trigger full-screen blur overlays, breaking combat immersion during brief connection hiccups.
- **Recommendation:**
  1. Introduce a 1.5-second grace window before displaying full modal overlay during socket reconnects.
  2. Show a compact top-bar reconnection indicator ("Đang kết nối lại...") during active retry attempts.
- **Acceptance criteria:**
  - [ ] Short connection hiccups (<1.5s) show a non-intrusive top-bar status banner rather than full-screen modal lockup.
  - [ ] Extended disconnects display the full `ConnectionLostOverlay` modal with clear retry controls.
- **Validation:** Simulate brief network dropouts in browser DevTools; verify top-bar reconnection feedback.
- **Effort:** S (Overlay timing adjustments in `ConnectionLostOverlay.jsx` and `App.jsx`)
- **Dependencies / risks:** None.

---

## Implementation phases

### Phase 1: High Impact Combat & Ergonomics (Completed)
- [x] Implement Target Selection Ring & Target Vitals HUD Frame (`[P1]`).
- [x] Implement Conic Radial Cooldown Sweep & Insufficient Resource Styling (`[P1]`).
- [x] Resolve Mobile Joystick / Chat Panel Collision and Touch Hitbox Scaling (`[P1]`).

### Phase 2: Input Discoverability & Dialogue Polish (Next)
- [ ] Add Hotkey Badges (`F3`, `F4`, `F5`, `Tab`, `M`) to HUD Controls (`[P2]`).
- [ ] Upgrade NPC Quest Dialog Button Hierarchy & Icons (`[P2]`).

### Phase 3: Inventory Polish & Combat Visuals (Later)
- [ ] Implement Comparative Inventory Tooltips & Item Rarity Borders (`[P2]`).
- [ ] Enhance Floating Combat Text Animations & Critical Hit Pop (`[P3]`).
- [ ] Add Network Hiccup Grace Window & Reconnection Status UX (`[P3]`).

---

## Validation checklist

- [x] **Target Resolutions:** Verify HUD layout across 1920x1080 (Desktop Full HD), 1366x768 (Laptop), 1024x768 (Tablet), and 375x812 (Mobile Portrait/Landscape).
- [x] **Input Methods:** Test functionality across Keyboard (`W/A/S/D`, `Space`, `1-9`, `F3-F5`, `Tab`, `M`), Mouse (Left/Right click combat & movement), and Touch (Virtual Joystick + Skill Arc).
- [x] **Localization:** Confirm all newly added HUD labels and tooltips exist in Vietnamese (`vi`), English (`en`), and Chinese (`zh`) translation dictionaries (`src/i18n/`).
- [x] **Performance & Tests:** Verify `npm test` passes cleanly with zero regressions (973 tests passing across 95 test suites).

---

## Open questions

1. *Targeting System:* Should target selection prioritize enemy entities under the mouse cursor, or automatically snap to the nearest aggressive enemy when a skill hotkey is pressed?
2. *Target Vitals Placement:* Should the targeted enemy's vitals bar be anchored top-center (classic MMORPG style) or pinned directly attached to the entity's overhead sprite in Phaser?

---

## Out of scope

- Full graphical asset replacement or visual overhaul of authentic Wuxia UI sprite assets.
- Backend server multiplayer synchronization protocol modifications.
- Combat balance adjustments to character stats, skill damage formulas, or mob spawn rates.

---

## Completion criteria

The UI/UX Improvement Plan is complete when findings are evidence-linked, prioritized with clear player impact, testable via acceptance criteria, saved in `docs/plan/ui-ux-improvement-plan.md`, and validated by running `npm test`.
