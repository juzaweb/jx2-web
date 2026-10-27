# Giang Hồ — React & Phaser 3 Wuxia RPG

A browser-playable wuxia RPG inspired by classic Vietnamese martial-arts MMORPGs, built with **React**, **Vite**, and **Phaser 3**.

## Features
- **Modern React UI Overlay:** Decoupled HUD components for Player Vitals (HP/MP/Stamina/EXP/Buff Aura), Minimap Radar & Quest tracker, Giang Ho Chat feed, and Authentic Hotbar Dock.
- **Weapon-Based Skills & Books:** A hero may only cast the skills of the weapon worn in the `weapon` slot (sword, gloves, saber). Every new character starts with a sword and **Kiếm Khí**; other skills are learned by studying books dropped by monsters, and the gloves/saber themselves drop from late-game monsters.
- **Mixed Skill & Item Hotbar:** Slots `1`–`9` hold either a consumable or a weapon skill. Drag techniques from the `F5` skill tree onto a slot, then press that number to cast.
- **Phaser 3 Game Engine:** 60FPS Arcade physics, world map, collision detection, and entity management.
- **Event-Driven Bridge:** Reactive bi-directional communication between Phaser game loop and React components.
- **Sound & Combat:** Web Audio API synth effects for attacks, skills, potion drinking, and sound toggle.
- **Persistent Progress:** Progress, inventory, equipment and learned skills are server-owned and saved per character; hotbar and mobile skill/consumable bindings are stored per character in `localStorage`.
- **Responsive & Touch Friendly:** Virtual joystick plus a radial skill fan around the Attack button, and a bindable HP/MP column outside it. Empty slots show `+`, a hold (780 ms, with a filling ring) rebinds one, and every arc button mirrors the desktop cooldown.

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

### Design Notes
See `docs/weapon-skills.md` for the weapon-kit model, book learning, drop tables and how to add a new skill, weapon or book.

## Controls
- **Move:** `W`, `A`, `S`, `D`, Arrow keys, or left-click the map (hold to follow the cursor)
- **Basic Attack:** `Space` or left-click an enemy
- **Kiếm Khí (sword):** a ranged art (840 px) that throws a blade-shaped shard of qi at the victim, exploding in a spreading blast that also damages every monster caught in its 170 px radius for a fraction of the hit. It is the starter skill, so it is cast from the hotbar like any other technique.
- **Skills (hotbar `1`–`9`):** open `F5` (Võ Công), drag a technique onto a numbered slot, then press that number to cast towards the cursor / nearest enemy. Right-click a slot to unbind. A hero may only cast the skills of the weapon in the `weapon` slot; study books dropped by monsters to learn the rest.
- **Consumables (hotbar `1`–`9`):** drag potions or scrolls from the bag onto a slot, then press the number to use them.
- **Talk to NPC:** `F`
- **Character:** `F3` · **Inventory:** `F4` · **Skills:** `F5`
- **Minimap zoom:** `Tab` · **City map:** `M` · **Pause/Guide:** `Esc`
- **Mobile:** virtual joystick (bottom-left), then a fan around the central Attack button with four configurable skills (tap an empty `+` to choose a technique, hold a bound button 780 ms to change it — a ring shows the hold building), plus a separate column of two consumable buttons outside the fan. Both kinds start empty: tap `+` to pick a skill, or an item from the bag (HP/MP potions, Nữ Nhi Hồng, Hồi Thành Phù; anything out of stock shows as "Hết"). Skill buttons draw their cooldown, item buttons their stack count. The numbered `1`–`9` bar is hidden on touch — the arc replaces it — and the menu tray shrinks to icon-only buttons between the two thumbs.

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
│   ├── MobileControls.jsx     # Joystick + CSS-driven skill/consumable cluster
│   ├── MobileSkillPicker.jsx  # Assign a skill to a mobile arc button
│   ├── MobileItemPicker.jsx   # Assign a consumable to a mobile HP/MP button
│   └── hooks/
│       └── useSkillCooldowns.js  # Shared cast-cooldown timers (bar + arc)
└── game/
    ├── bridge.js         # Pub/Sub bridge between React & Phaser
    ├── game.js           # Phaser Scene & game factory
    ├── combat.js         # Combat system, casting and sound synth
    ├── skills.js         # Weapon skill catalog (id, weapon, slot, cost, effects)
    ├── weapons.js        # Weapon types and weapon-type helpers
    ├── items.js          # Items: consumables, gear, weapons and generated skill books
    ├── enemyCatalog.js   # Monsters, rewards and book/weapon drop tables
    ├── quickSlots.js     # Hotbar slots 1-9: item id or `skill:<skillId>`
    ├── mobileSkills.js   # Four per-character mobile skill bindings
    ├── mobileItems.js    # Two per-character mobile consumable bindings
    ├── slotBindings.js   # Shared per-character slot storage (used by both)
    ├── skillVfx.js       # Skill cast/impact visual effects
    └── storage.js        # Local settings/position persistence (gameplay is server-owned)
```
