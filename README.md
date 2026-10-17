# Giang Hồ — React & Phaser 3 Wuxia RPG

A browser-playable wuxia RPG inspired by classic Vietnamese martial-arts MMORPGs (Vo Lam Truyen Ky 2), built with **React**, **Vite**, and **Phaser 3**.

## Features
- **Modern React UI Overlay:** Decoupled HUD components for Player Vitals (HP/MP/Stamina/EXP/Buff Aura), Minimap Radar & Quest tracker, Giang Ho Chat feed, and Authentic Hotbar Dock.
- **Phaser 3 Game Engine:** 60FPS Arcade physics, world map, collision detection, and entity management.
- **Event-Driven Bridge:** Reactive bi-directional communication between Phaser game loop and React components.
- **Sound & Combat:** Web Audio API synth effects for attacks, skills, potion drinking, and sound toggle.
- **Persistent Progress:** Automatic and manual progress saving with `localStorage`.
- **Responsive & Touch Friendly:** On-screen mobile d-pad and combat buttons for mobile screens.

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
- **Move:** `W`, `A`, `S`, `D` or Arrow keys
- **Basic Attack:** `Space` or Left Click on the map
- **Kiếm Khí Skill:** `Q` or `8` or Right Click
- **Quick Potions:**
  - `1`: Kim Sáng Dược (+35 HP)
  - `2`: Đại Hoàn Đan (+25 MP)
  - `3`: Nữ Nhi Hồng (+50 HP & +30 MP)
  - `4`: Hồi Thành Phù (Return to central Truong An)
- **Pause & Guide:** `Esc` or click the Guide button
- **Mobile:** Touch directional pad and action buttons

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
│   │   └── HotbarDock.jsx     # Bottom quick-slots & system dock
│   ├── Modals/
│   │   ├── StartModal.jsx     # Entry modal
│   │   └── HelpModal.jsx      # Guide & progress reset modal
│   └── MobileControls.jsx     # Touch d-pad and skill buttons
└── game/
    ├── bridge.js         # Pub/Sub bridge between React & Phaser
    ├── uiBridgeAdapter.js# Bridge adapter for HUD and minimap radar
    ├── game.js           # Phaser Scene & game factory
    ├── world.js          # Map rendering & terrain layout
    ├── player.js         # Player physics, sprite, and controls
    ├── enemy.js          # Wolf entities and AI aggro
    ├── combat.js         # Combat system, sound synth, and drops
    └── storage.js        # Progress persistence
```
