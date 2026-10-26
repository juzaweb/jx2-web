# Implementation Plan: Compact Character Sheet (F3)

- **Date:** 2026-10-26
- **Target:** `CharacterModal.jsx`, `character.css`, and related unit tests
- **Scope:** Remove the full-body character preview (`CharacterPreview`), reorganize equipment slots into a streamlined 2-column or grid layout, and reduce modal footprint for optimal desktop & mobile multitasking.

---

## 1. Executive Summary & Problem Analysis

### 1.1 Current Architecture & Pain Points
Currently, the character modal (`CharacterModal.jsx` / F3 hotkey) uses a classic Diablo/JX paper-doll pattern:
- **Left Column:** 7 combat equipment slots (`helm`, `armor`, `belt`, `accessory`, `bracers`, `weapon`, `secretManual`).
- **Corner & Bottom Row:** 5 fashion/sub-equipment slots (`subManual`, `cosHat`, `cosTop`, `cosPants`, `mount`).
- **Center Area:** Static 2D paper-doll render (`<CharacterPreview />`) sized up to 300px height.
- **Side Panel:** Vitals (`hp`, `mp`) and combat stats (`physicalAtk`, `physicalDef`, `crit`, `critDamage`, `attackSpeed`).

**Identified Issues:**
1. **Modal Screen Footprint (520px+ width):**
   - Opening both `CharacterModal` (F3) and `InventoryModal` (F4) causes severe visual collision and overlap on standard 720p/1080p screens, making drag-to-equip cumbersome.
2. **Mobile Screen Choke (<720px):**
   - On mobile, `@media (max-width: 720px)` stacks `.char-side` and `.char-main` vertically. The paper-doll canvas pushes the total height past 620px, causing scrollbars and obscuring the game viewport.
3. **Asset Debt:**
   - The paper doll requires specialized layered PNG textures for every single wearable item across male and female body frames. Missing textures result in an empty base silhouette.

---

## 2. Proposed Architecture (Option 4: Compact Dual-Column Layout)

### 2.1 Layout Comparison

#### Current Layout (~520px wide):
```
+-------------------------------------------------------------+
| Character Sheet (F3)                                  ?  [X]|
+-------------------------------------------------------------+
| [Equip Tab]                                                 |
+-------------------+-----------------------------------------+
| [Vitals & Stats]  | [Slot 1]   +----------------+           |
|  HP: 100/100      | [Slot 2]   |                |           |
|  MP: 60/60        | [Slot 3]   | Character      |           |
|  Physical Atk: 12 | [Slot 4]   | Paper-Doll     |           |
|  Physical Def: 5  | [Slot 5]   | Preview        |           |
|  Crit: 5%         | [Slot 6]   | (200-300px)    |           |
|  Crit Dmg: x1.50  | [Slot 7]   +----------------+           |
|  Atk Speed: x1.00 | [Corner]   [Row 1] [Row 2] [Row 3] [Row 4|
+-------------------+-----------------------------------------+
| Points: 0                            Next Level EXP: 100    |
+-------------------------------------------------------------+
```

#### Proposed Dual-Column Layout: Thuộc tính / Trang bị (~330px wide):
```
+-------------------------------------------------------------+
| [Lvl 1] PlayerName                                   ?  [X] |
+-------------------------------------------------------------+
| [Equip Tab]                                                 |
+-----------------------------------+-------------------------+
| Thuộc tính (Bên trong / Trái)     | Trang bị (Bên ngoài / Phải)
|                                   | +----+  +----+          |
|  Sinh lực:               100/100  | |Helm|  |SecM|          |
|  Nội lực:                  60/60  | +----+  +----+          |
|  -------------------------------- | |Armr|  |SubM|          |
|  Ngoại công:                  12  | +----+  +----+          |
|  Ngoại phòng:                  5  | |Pant|  |Belt|          |
|  Chí mạng:                    5%  | +----+  +----+          |
|  Đòn chí mạng:             x1.50  | |Acce|  |CosH|          |
|  Tốc độ đánh:              x1.00  | +----+  +----+          |
|  -------------------------------- | |Brac|  |CosT|          |
|  Điểm tiềm năng:               0  | +----+  +----+          |
|                                   | |Weap|  |Moun|          |
|                                   | +----+  +----+          |
+-----------------------------------+-------------------------+
| Kéo trang bị từ Hành trang (F4) vào để mặc                  |
+-------------------------------------------------------------+
```

---

## 3. Structural & Component Specifications

### 3.1 Two-Column Partition: Thuộc tính (Left / Inside) & Trang bị (Right / Outside)

The character modal is organized into two distinct sections:
1. **Left Section (Thuộc tính - Inside):** Character attributes, vitals, and potential points. Positioned on the left (inner screen edge when docked at `left: 12px`).
2. **Right Section (Trang bị - Outside):** 12 equipment slots arranged in a compact 2x6 grid. Positioned on the right (facing the game center and adjacent to the F4 Bag modal for effortless drag-and-drop).

#### Slot Grid Breakdown (Right Column / Trang bị - 2x6 Grid):
| Sub-column 1 (Combat Gear) | Sub-column 2 (Manuals, Belt & Cosmetics) |
| :--- | :--- |
| 1. `helm` (Nón - `helmet`) | 7. `secretManual` (Mật tịch) |
| 2. `armor` (Áo - `armor`) | 8. `subManual` (Phó mật tịch) |
| 3. `pants` (Quần - `pants`) | 9. `belt` (Thắt lưng / Đai lưng) |
| 4. `accessory` (Trang sức - `accessory`) | 10. `cosHat` (Ngoại trang - Nón) |
| 5. `bracers` (Bao tay / Hộ uyển) | 11. `cosTop` (Ngoại trang - Áo) |
| 6. `weapon` (Vũ khí - `weapon`) | 12. `mount` (Tọa kỵ) |

- **Touch Size:** Each slot is sized `42px × 42px` (meeting WCAG 2.5.5 touch target minimum).
- **Interactions:**
  - Retain `data-equip-slot={slot.source}` for pointer and HTML5 drop targeting from `InventoryModal` (covers all 5 active equipment slots: `helmet`, `armor`, `pants`, `accessory`, `weapon`).
  - Retain click-to-unequip (`onUnequipSlot`).
  - Retain SVG silhouettes (`SLOT_ICONS`) for empty states.

### 3.2 Attributes & Vitals (Left Column / Thuộc tính)
- **Header / Identity:** Player Name and Level displayed cleanly in the titlebar or top of the stats panel.
- **Vitals Readout:**
  - Sinh lực (HP) & Nội lực (MP) with numeric ratio (`current/max`) and subtle background gauge.
- **Combat Stats:**
  - Ngoại công, Ngoại phòng, Chí mạng, Đòn chí mạng, Tốc độ đánh.
- **Progression / Points (Kinh nghiệm removed):**
  - **Điểm tiềm năng (`points`)**: Kept for distributing stat points upon leveling up.
  - **Kinh nghiệm (`nextLevelExp`)**: **Removed completely** from F3 since EXP is already prominently tracked on the main HUD (`PlayerVitals` top-left EXP bar). This saves vertical space and avoids duplicate information.

---

## 4. Technical Implementation Steps

### Step 1: Update `src/components/Modals/CharacterModal.jsx`
1. Re-structure slot array definition into 2 sub-columns for the 2x6 grid:
   ```javascript
   const COMPACT_SLOTS = [
     // Col 1: Combat gear (includes all 5 core equippable slots + bracers)
     { key: "helm", source: "helmet", labelKey: "slots.helmet", icon: "helm" },
     { key: "armor", source: "armor", labelKey: "slots.armor", icon: "armor" },
     { key: "pants", source: "pants", labelKey: "slots.pants", icon: "cosPants" },
     { key: "accessory", source: "accessory", labelKey: "slots.accessory", icon: "accessory" },
     { key: "bracers", labelKey: "character.slots.bracers", icon: "bracers" },
     { key: "weapon", source: "weapon", labelKey: "slots.weapon", icon: "weapon" },
     // Col 2: Special, Belt & Cosmetics
     { key: "secretManual", labelKey: "character.slots.secretManual", icon: "manual" },
     { key: "subManual", labelKey: "character.slots.subManual", icon: "subManual" },
     { key: "belt", labelKey: "character.slots.belt", icon: "belt" },
     { key: "cosHat", labelKey: "character.slots.cosHat", icon: "cosHat" },
     { key: "cosTop", labelKey: "character.slots.cosTop", icon: "cosTop" },
     { key: "mount", labelKey: "character.slots.mount", icon: "mount" }
   ];
   ```
2. Remove `<CharacterPreview />` from the modal render tree.
3. Render dual-column layout within `.char-body`:
   - Left side (`.char-side`): Vitals + combat stats + Điểm tiềm năng (Kinh nghiệm removed).
   - Right side (`.char-main`): `.char-equip-grid` containing the 12 slots (2x6 grid).
4. Remove the "Kinh nghiệm" row from the footer / stats readout.

### Step 2: Update `src/styles/character.css`
1. Adjust `.char-panel`:
   - `max-width`: Clamped to `330px`.
   - `.char-body`: `display: flex; flex-direction: row; gap: 8px; padding: 8px;`
2. Remove paper-doll specific CSS rules:
   - `.char-model`, `.char-model-preview`, `.char-model-body`, `.char-model-layer`, `.char-model-name`.
3. Style the two sections:
   - Left (`.char-side`): `flex: 1 1 auto; width: 175px; min-width: 160px;`
   - Right (`.char-equip-grid`): `display: grid; grid-template-columns: repeat(2, 42px); gap: 4px; flex: 0 0 auto;`

### Step 3: Test Suite Updates & Validation
1. Verify `src/components/Modals/CharacterModal.test.jsx`:
   - Ensure all `data-stat` checks (`physicalAtk`, `physicalDef`, `crit`, `critDamage`, `attackSpeed`) pass.
   - Ensure all `data-equip-slot` drop-zones (`weapon`, `armor`, `helmet`, `accessory`, `pants`) remain intact.
2. Run full Vitest suite:
   ```bash
   npm test
   ```
3. Verify that `CharacterPreview.jsx` and `src/game/characterPreview.js` tests remain intact (can be kept as a reusable component or character selection preview).

---

## 5. Potential Edge Cases & Mitigations

| Edge Case | Risk | Mitigation |
| :--- | :--- | :--- |
| **Drag & Drop Target Collision** | Smaller slot targets might make dragging from F4 bag harder on touch. | Ensure each slot has at least `42px` touch area with `3px` padding and visible `.is-drop-target` hover state. |
| **Long Player Names** | Names > 14 characters could wrap and distort the titlebar. | Use `text-overflow: ellipsis; overflow: hidden; white-space: nowrap;` for name display. |
| **Localization (VI / EN / ZH)** | Longer stat labels in English (e.g. "Physical Defense") might wrap. | Set `stat-label` flex properties with `font-size: 11px` and ensure `stat-value` never truncates. |
| **Simultaneous F3 + F4 Dragging** | User drags item across screen from Bag to Character sheet. | Compact F3 (~350px) placed at `left: 12px` and F4 (~360px) placed at `left: 374px` allow both windows to sit side-by-side with zero overlap on 1024px+ displays. |

---

## 6. Definition of Done (Acceptance Criteria)

- [ ] Character modal width is clamped between `320px` and `340px`.
- [ ] Character preview art is removed, freeing up screen space.
- [ ] Modal is cleanly divided into 2 sections: Left = Thuộc tính (Vitals + Stats + Points), Right = Trang bị (12 slots in 2x6 grid).
- [ ] Duplicate "Kinh nghiệm" (EXP) row is removed from F3.
- [ ] All 12 equipment slots accept item drag-and-drop from F4 and click-to-unequip.
- [ ] Modal displays without requiring vertical scroll on viewports down to 360px width.
- [ ] All Vitest tests pass without regressions (`npm test`).

