# Giang Hồ — HTML5 Phaser 3 Mini RPG

A small browser-playable wuxia RPG demo inspired by classic Vietnamese martial-arts MMORPGs.

## Features
- Phaser 3 scene rendered on HTML5 Canvas
- Scrollable forest village map with buildings and road
- Player movement using WASD / arrow keys
- Basic sword attack and Q skill (Kiếm Khí)
- Wolf enemies chase and attack the player
- HP, MP, EXP, level-ups, coin rewards and collectible drops
- Beginner quest: defeat three wolves
- Responsive HUD and simple touch controls
- No build step or package installation required

## Run locally
Because the game loads Phaser from a CDN, you need an internet connection on first load.

### Option A: Python
From this folder run:
```bash
python -m http.server 8000
```
Open http://localhost:8000 in your browser.

### Option B: PHP (Laravel developer friendly)
From this folder run:
```bash
php -S localhost:8000
```
Open http://localhost:8000.

You can also deploy the three files to any static web host.

## Controls
- Move: WASD or arrow keys
- Attack: Space or click/tap the game area
- Skill: Q
- On mobile: use the on-screen directional pad and sword button

## Project files
- `index.html` — page structure, importmap for Phaser ESM
- `style.css` — modern wuxia-inspired UI
- `game.js` — main entry point, Phaser game configuration, and scene orchestration
- `world.js` — world configuration, terrain, roads, river, buildings, lanterns, and decorations
- `player.js` — Player class, movement input (keyboard/touch), avatar rendering, stats, and respawn
- `enemy.js` — Wolf AI entity, health bar, chase/aggro behavior, and EnemyManager
- `combat.js` — CombatSystem, sword attack, Kiếm Khí skill, drops, and Web Audio synthesizer
- `ui.js` — UIManager, HUD status bars, quest progression tracker, and combat feed log
- `storage.js` — StorageManager for saving/loading game state with localStorage

## Notes
This is an original demo inspired by classic wuxia RPG mechanics. It does not include original VLTK assets, servers, networking, or official game content.
