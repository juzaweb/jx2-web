# Giang Hồ — React & Phaser 3 Wuxia RPG

A browser-playable wuxia RPG inspired by classic Vietnamese martial-arts MMORPGs, built with **React**, **Vite**, and **Phaser 3**.

## Features
- **Modern React UI Overlay:** Decoupled HUD components for Player Vitals (HP/MP/Stamina/EXP/Buff Aura), Minimap Radar & Quest tracker, Giang Ho Chat feed, and Authentic Hotbar Dock.
- **Mixed Skill & Item Hotbar:** Slots `1`–`9` hold either a consumable or a sect skill. Drag techniques from the `F5` skill tree onto a slot, then press that number to cast.
- **Phaser 3 Game Engine:** 60FPS Arcade physics, world map, collision detection, and entity management.
- **Event-Driven Bridge:** Reactive bi-directional communication between Phaser game loop and React components.
- **Sound & Combat:** Web Audio API synth effects for attacks, skills, potion drinking, and sound toggle.
- **Persistent Progress:** Progress, hotbar bindings, mobile skill layout, inventory and equipment are saved per character with `localStorage`.
- **Responsive & Touch Friendly:** Virtual joystick, attack button, and four configurable skill buttons (tap `+` to assign a technique, hold to rebind).

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
```bash
npm install
```

### Development
Start the local Vite development server:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Production Build
Build optimized production bundle:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```

### Tests
Run the Vitest suite once:
```bash
npm test
```
Watch mode:
```bash
npm run test:watch
```

## Controls
- **Move:** `W`, `A`, `S`, `D`, Arrow keys, or left-click the map (hold to follow the cursor)
- **Basic Attack:** `Space` or left-click an enemy
- **Skills (hotbar `1`–`9`):** open `F5` (Võ Công), drag a technique onto a numbered slot, then press that number to cast towards the cursor / nearest enemy. Right-click a slot to unbind.
- **Consumables (hotbar `1`–`9`):** drag potions or scrolls from the bag onto a slot, then press the number to use them.
- **Talk to NPC:** `F`
- **Character:** `F3` · **Inventory:** `F4` · **Skills:** `F5`
- **Minimap zoom:** `Tab` · **City map:** `M` · **Pause/Guide:** `Esc`
- **Mobile:** virtual joystick, central Attack button, four skill buttons (tap an empty `+` to choose a technique, hold a bound button to change it), and two fixed potion buttons (Kim Sáng Dược / Đại Hoàn Đan).

## Architecture
```
src/
├── main.jsx              # React entry point
├── App.jsx               # Main state orchestrator & layout
├── index.css             # Authentic wuxia MMORPG styling & tokens
├── components/
│   ├── GameCanvas.jsx    # Hosts Phaser game lifecycle
│   ├── HUD/
│   │   ├── PlayerVitals.jsx   # Top-left HP/MP/EXP/Buff HUD
│   │   ├── MinimapPanel.jsx   # Top-right radar & quest tracker
│   │   ├── ChatPanel.jsx      # Bottom-left multi-tab chat feed
│   │   └── HotbarDock.jsx     # Bottom quick-slots (items/skills) & system dock
│   ├── Modals/
│   │   ├── LoginModal.jsx / CharacterSelectModal.jsx
│   │   ├── CharacterModal.jsx / InventoryModal.jsx
│   │   ├── SkillsModal.jsx    # F5 tree; skill drag sources for slots 1-9
│   │   ├── ShopModal.jsx / CityMapModal.jsx / HelpModal.jsx / GmModal.jsx
│   │   └── pointerItemDrag.js # Pointer drag shared by inventory & hotbar
│   ├── MobileControls.jsx     # Joystick, attack, configurable skill arc
│   └── MobileSkillPicker.jsx  # Assign a skill to a mobile arc button
└── game/
    ├── bridge.js         # Pub/Sub bridge between React & Phaser
    ├── game.js           # Phaser Scene & game factory
    ├── combat.js         # Combat system, casting and sound synth
    ├── skills.js         # Sect skill catalog (id, slot, cost, effects)
    ├── quickSlots.js     # Hotbar slots 1-9: item id or `skill:<skillId>`
    ├── mobileSkills.js   # Four per-character mobile skill bindings
    ├── skillVfx.js       # Skill cast/impact visual effects
    ├── inventorySync.js  # Mirrors the bag with the server
    └── storage.js        # Progress persistence
```
