# 2D Game UI/UX Improvement Plan

- **Date:** 2025-05-18
- **Project / engine:** JX2 Wuxia RPG ("Giang Hồ") — React 18 + Phaser 3.80 (Vite build system)
- **Audit scope:** Full UI/UX architecture including HUD overlay (`src/components/HUD/*`), Modals (`src/components/Modals/*`), Mobile Controls (`src/components/MobileControls.jsx`), Styling & Design Tokens (`src/index.css`), and Phaser/React Event Bridge (`src/game/bridge.js`, `src/game/uiBridgeAdapter.js`).
- **Limitations:** Static analysis and unit test inspection performed in sandbox environment. Live visual testing on physical mobile hardware / touch devices was simulated via CSS breakpoints and unit tests.

---

## Executive summary

The "Giang Hồ" project delivers an authentic Wuxia MMORPG (Vo Lam Truyen Ky 2 inspired) experience blending Phaser 3 canvas rendering with a rich React UI overlay. The interface successfully captures the aesthetic of retro Wuxia RPGs (wood/metal borders, parchment modals, CJK glyphs, and status brackets).

However, as the game scales in combat features, multi-faction skill systems, and cross-platform device support, several key UI/UX friction points impact player responsiveness, information clarity, and accessibility:

1. **Targeting & Enemy Combat Feedback:** Lack of an explicit target selection frame / enemy lock-on indicator, making multi-target combat and click-to-attack ambiguous.
2. **Skill Cooldown & Resource Availability Readability:** Cooldown timer numbers in hotbar and skill slots lack visual radial sweep overlays or distinct styling when player MP/Stamina is insufficient for skill execution.
3. **Mobile & Touch Ergonomics:** Overlap between virtual joystick, chat log, and hotbar dock on low-resolution mobile devices and small viewports (<720px).
4. **Keybind Discoverability & Onboarding:** Critical keyboard shortcuts (`F3`, `F4`, `F5`, `Tab`, `M`) are hidden within tooltips or modal windows without interactive keybind overlays or first-time player prompts.

Implementing these prioritized recommendations will significantly reduce combat friction, increase visual responsiveness during high-intensity encounters, and improve playability on both desktop and touch devices.

---

## Current experience and evidence

### Observed Player Flows & Architecture

1. **Title & Entry Flow:** `LoginModal` -> `CharacterSelectModal` -> Game World. Seamless transition with localized language switcher (VI/EN) and responsive orientation warning for mobile portrait mode (`src/App.jsx`).
2. **HUD & Vitals:** Top-Left `PlayerVitals` displays Level, EXP, HP, MP, Stamina, and Martial Aura slot. Top-Right `MinimapPanel` shows subzone, radar canvas, quest objective, and toggle controls (`src/components/HUD/`).
3. **Action Dock & Hotbar:** Bottom `HotbarDock` houses 9 quick-slots (potions/items), 4 sect skill hotkeys (`U`, `I`, `O`, `P`), and system tray buttons (`F3` Char, `F4` Inv, `F5` Skills, Help, PK mode).
4. **Mobile Controls:** `MobileControls` displays a virtual joystick on bottom-left and radial arc skill buttons on bottom-right when viewed on touch devices (`src/components/MobileControls.jsx`).
5. **Modals & Dialogs:** `CharacterModal`, `InventoryModal`, `SkillsModal`, `CityMapModal`, `ShopModal`, `SkillPickerModal`. Panels support drag-and-drop (`useDraggablePanel.js`, `dragItem.js`).

---

## Prioritized improvements

### [P1] Target Frame and Targeted Enemy Selection Indicator
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/game/player.js`, `src/game/enemy.js`, `src/components/HUD/PlayerVitals.jsx`
- **Player Impact:** When attacking wolves or NPCs, players cannot easily confirm which enemy is currently targeted or evaluate the enemy's remaining HP without closely observing floating damage text.
- **Recommendation:**
  1. Add an overhead selection ring or target indicator in Phaser around the active target.
  2. Implement an optional top-center or top-left "Target Vitals" HUD panel showing the targeted enemy/NPC name, level, HP bar, and status effects.
- **Acceptance criteria:**
  - [ ] Clicking or auto-targeting an enemy displays a distinct gold/red selection reticle around the entity sprite.
  - [ ] Target HUD bar updates dynamically with real-time target HP percentage.
  - [ ] Target frame clears immediately when the target dies or moves out of range.
- **Validation:** Select enemies in Bien Kinh map; verify selection indicator alignment and real-time HP depletion during combat.
- **Effort:** M (Requires Phaser entity selection logic + React bridge event `TARGET_UPDATED`)
- **Dependencies / risks:** Minimal risk; bridge event needed for Target Vitals component.

---

### [P1] Radial Cooldown Sweep & Insufficient Resource State for Hotbar Skills
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/HUD/HotbarDock.jsx`, `src/components/SkillIcon.jsx`, `src/index.css`
- **Player Impact:** Skill cooldowns currently render as plain text numbers overlaying skill glyphs (`<span className="hand-cd">3</span>`). Players cannot intuitively gauge cooldown progress at a glance or distinguish between a skill on cooldown vs. a skill unusable due to low MP/Stamina.
- **Recommendation:**
  1. Add a CSS/SVG radial conic-gradient sweep overlay on skill slots during cooldown.
  2. Apply a semi-transparent blue tint or desaturation filter (`.insufficient-mp`) when player current MP < skill MP cost.
- **Acceptance criteria:**
  - [ ] Skill slots display a clockwise radial dark sweep indicating remaining cooldown fraction.
  - [ ] Skills with MP cost exceeding current player MP show a visually distinct out-of-resource state (blue/gray shade + subtle MP warning tooltip).
- **Validation:** Cast skills in quick succession; verify radial animation smooth countdown and resource cost validation.
- **Effort:** S (CSS styling updates in `src/index.css` + MP cost check in `HotbarDock.jsx`)
- **Dependencies / risks:** None.

---

### [P1] Mobile Ergonomics and HUD Viewport Collision Prevention
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/components/MobileControls.jsx`, `src/index.css` (media queries `@media (max-width: 720px)`), `src/components/HUD/ChatPanel.jsx`
- **Player Impact:** On mobile devices or narrow browser windows (<768px width), the virtual joystick overlaps with the bottom-left chat panel or hotbar buttons, leading to accidental touch triggers during movement.
- **Recommendation:**
  1. Auto-collapse or minimize `ChatPanel` into a small icon tab when mobile controls are active.
  2. Increase touch target hitboxes for `MobileControls` radial arc buttons to at least 48x48px with 8px padding gaps.
  3. Ensure virtual joystick base touch zone does not overlap with hotbar or bottom panel boundaries.
- **Acceptance criteria:**
  - [ ] On touch screens, `ChatPanel` defaults to minimized state to keep the joystick area clear.
  - [ ] Skill arc buttons have minimum 48x48px touch boundaries without overlap.
- **Validation:** Test on mobile viewport simulations (375x667, 414x896, 768x1024) and verify touch input isolation.
- **Effort:** S (CSS layout & default collapsed state in `App.jsx`)
- **Dependencies / risks:** None.

---

### [P2] In-Game Keybind Discoverability & HUD Shortcut Overlays
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/App.jsx` (Global keydown listener), `src/components/HUD/HotbarDock.jsx`
- **Player Impact:** Essential keyboard shortcuts (`F3` Character, `F4` Inventory, `F5` Skills, `Tab` Zoom Minimap, `M` City Map) are listed in tooltips or `HelpModal`, but new players frequently miss them during active gameplay.
- **Recommendation:**
  1. Add visible hotkey badge overlays on system dock buttons (`[F3]`, `[F4]`, `[F5]`).
  2. Display a brief floating keybind prompt (e.g. "Nhấn [M] để mở bản đồ thành thị") upon first entering Bien Kinh city.
- **Acceptance criteria:**
  - [ ] System buttons in `HotbarDock` display small legible shortcut labels (`F3`, `F4`, `F5`).
  - [ ] Minimap header displays `[Tab]` shortcut hint next to the zoom button.
- **Validation:** Verify visual rendering of hotkey badges across screen resolutions.
- **Effort:** XS (Minor JSX badge additions and CSS tweaks)
- **Dependencies / risks:** None.

---

### [P2] Enhanced Inventory Tooltips & Item Comparison
- **Status:** Proposed
- **Confidence:** Medium
- **Type:** Hypothesis to validate
- **Evidence:** `src/components/Modals/InventoryModal.jsx`, `src/components/Modals/CharacterModal.jsx`, `src/game/items.js`
- **Player Impact:** Hovering over equipment items in the inventory shows basic stats, but players cannot easily compare the hovered item against their currently equipped gear in that slot.
- **Recommendation:**
  1. Expand inventory hover tooltips to render a dual-card comparison view (Equipped vs. Hovered Item) showing stat deltas (+HP, +Def, +Atk in green/red text).
  2. Add visual rarity border highlights (Common = Grey, Rare = Blue, Epic = Purple, Legendary = Gold).
- **Acceptance criteria:**
  - [ ] Hovering over inventory equipment renders comparative stat differences against equipped item.
  - [ ] Item border colors reflect item tier/quality.
- **Validation:** Hover over weapons/armor in inventory and verify side-by-side stat delta calculation.
- **Effort:** S (Tooltip component enhancement in `InventoryModal.jsx`)
- **Dependencies / risks:** Dependent on item stat definition structure in `src/game/items.js` and `src/game/equipment.js`.

---

### [P3] Damage Floating Text & Floating Combat Feedback Polish
- **Status:** Proposed
- **Confidence:** High
- **Type:** Observed issue
- **Evidence:** `src/game/combat.js`, `src/game/skillVfx.js`
- **Player Impact:** Floating combat damage numbers pop up above targets, but critical hits, skill damage types, and healing numbers look visually homogenous.
- **Recommendation:**
  1. Differentiate floating text animations: Normal damage (yellow/white float up), Critical hits (larger red/gold bold pop with subtle scale spring), Healing (green float up with `+` prefix), Mana restoration (blue float up).
- **Acceptance criteria:**
  - [ ] Critical hits scale up to 1.4x size with red/gold styling.
  - [ ] Healing and MP recovery text are colored green and blue respectively.
- **Validation:** Engage enemies with skills and health potions; verify floating text colors and animation scaling.
- **Effort:** S (Phaser text styling in `src/game/combat.js`)
- **Dependencies / risks:** None.

---

## Implementation phases

### Phase 1: High Impact Combat Clarity (Now)
- Implement Target Selection Ring & Target Vitals HUD Panel (`[P1]`).
- Implement Radial Cooldown Sweep & Insufficient Resource styling (`[P1]`).

### Phase 2: Mobile Ergonomics & Discoverability (Next)
- Resolve Mobile Joystick / Chat Panel collision and touch target scaling (`[P1]`).
- Add Hotkey Badges (`F3`, `F4`, `F5`, `Tab`, `M`) to HUD buttons (`[P2]`).

### Phase 3: Inventory Polish & Combat Visuals (Later)
- Implement Item Comparison Tooltips & Rarity Borders (`[P2]`).
- Enhance Floating Damage & Healing Text Animations (`[P3]`).

---

## Validation checklist

- [ ] **Target Resolutions:** Verify HUD rendering at 1920x1080 (Desktop Full HD), 1366x768 (Laptop), 1024x768 (Tablet), and 375x812 (Mobile Landscape/Portrait).
- [ ] **Input Methods:** Verify full functionality via Keyboard (`W/A/S/D`, `Space`, `1-4`, `F3-F5`, `Tab`, `M`), Mouse (Left/Right click skills & movement), and Mobile Touch (Virtual Joystick + Skill Arc).
- [ ] **Localization:** Confirm all newly added HUD labels and tooltips exist in both Vietnamese (`vi`) and English (`en`) translation keys (`src/i18n/`).
- [ ] **Performance:** Ensure no frame drops or memory leaks occur during rapid skill casting or chat log spam (run unit test suite `npm test`).

---

## Open questions

1. *Targeting System:* Should target selection prioritize enemy entities under the mouse cursor, or automatically snap to the nearest aggressive enemy when a skill hotkey is pressed?
2. *Target Vitals Placement:* Should the targeted enemy's vitals bar be anchored top-center (classic MMORPG style) or pinned attached to the entity's overhead in the Phaser canvas?

---

## Out of scope

- Full graphic asset redesign or replacement of original Wuxia UI sprite assets.
- Backend server architecture or multiplayer synchronization protocol changes (unless emitting standard client bridge events).
- Balance adjustments to character stats, skill damage formulas, or mob spawn rates.

---

## Completion criteria

The UI/UX Improvement Plan is complete when findings are evidence-linked, prioritized with clear player impact, testable via acceptance criteria, and saved in `docs/plan/ui-ux-improvement-plan.md`.
