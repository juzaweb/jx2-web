# Đông Môn Thành — second map, a level 3–29 forest hunting ground

Status: **implemented** (all phases shipped in one change). Replaces the single-map
assumption in `BACKLOG.md` item B1.

## Goal & scope

- Add a second, portal-linked map east of Biện Kinh: **Đông Môn Thành**, a
  24 000 × 14 000 forest.
- Fill it with a level 3–29 hunting ground: **18 camps, one species each**,
  **15 monsters per camp = 270 spawns**. No boss.
- The camps are laid out as six columns marching east from the entrance in level
  order — Sơn Cẩu (3) → Dã Lang (8) → Lâm Tặc (14) → Hắc Y (19) → Thiết Giáp (24)
  → Ma Giáo (29). Each column holds three camps, so the level is strictly
  non-decreasing with distance from the door; a registry test enforces that.
- `CAMPS` is the hand-authored data; `expandCamps` scatters each camp's monsters
  over a 1 500 px disc with a 400 px minimum gap (rejection sampling), so a camp
  reads as animals foraging and no two sprites or health bars overlap.
- Keep everything server-authoritative (health, death, respawn, reward, level).
- Reuse the existing art: no new image assets, no Tiled/tilemap pipeline.

Out of scope: NPCs, quests and shops — Đông Môn Thành has none, so nothing is
bought or sold there (that stays in Biện Kinh). A map registry test enforces that
no building sits in the level 1-10 belt, so the rule survives future edits.

## Architecture

### Map registry (client + server)

`src/game/maps/` holds pure data (no Phaser), so the Node server imports the same
numbers the client renders:

| File | Role |
| --- | --- |
| `mapRegistry.js` | `MAPS`, `getMap(id)`, `mapWorldConfig(map)`, `findPortal(mapId, portalId)`, `isInsideMap` |
| `marketMap.js` | Biện Kinh packaged as a `MapDefinition`, including the 8 legacy wolf spawns |
| `dongMonThanhMap.js` | Đông Môn Thành: 24 000 × 14 000 bounds, painted forest floor, trail, portal, 3 level zones, 18 same-level camps (270 spawns) — no buildings, walls, gates, decor or boss |
| `portals.js` | Pure trigger state machine (`portalAt`, `stepPortalTrigger`, cooldown, arrival lock) |

A `MapDefinition` carries: `id`, `name`, `safe`, `bounds`, `spawn`, `ground`
(palette, tile key, optional painted `regions`/`streets`, medallions), `buildings`,
`trees`, `grass`, `gates`, `portals`, `enemySpawns`, `zones`, `npcs`.

### Rendering

`src/game/marketWorld.js` became `src/game/worldManager.js`. `WorldManager` now
takes a `MapDefinition`, draws the map from it, and tracks every GameObject it
creates so `destroy()` can hand the scene back clean before the next map loads.
Draw passes: `drawGround` (base tile → painted regions → stains → streets →
medallions), `drawBuildings`, `drawVegetation`, `drawGates` (arch), `drawPortals`
(rune circle) and `drawWorldBorder`.

`ground.streets` entries are either **paving** (`tileKey` → masked, rotated strip,
kerbs unless `kerb: false`) or **painted earth** (`fill` → band with ragged edges).
Ground textures can also be painted in code (`PAINTED_GROUNDS`, e.g.
`ground-forest`), so a map ships without new art.

The wall/banner/brazier passes were deleted once no map declared them: dead
render code in a data-driven renderer is worse than one `git revert` away.

`src/game/mapStage.js` owns the lifecycle around the renderer: camera/physics
bounds, NPCs, and the static colliders. The scene decides *when* a map changes;
the stage knows *how* to put one up and take it down, so teardown order lives in
one place.

The enemy physics group is deliberately long-lived: `EnemyManager.clear()` empties
it instead of destroying it, because the world keeps colliders pointing at it.
Destroying the group mid-travel left those colliders dangling and crashed the
physics step (`PhysicsGroup.getLength` on a dead group).

### Scene

`JiangHuScene` resolves its map before drawing: `init({ mapId, spawn })` → saved
`mapId` → default. `loadMap(mapId, spawn, { notifyServer, portalId })` tears the
world, NPCs, enemies and colliders down, rebuilds the new map, re-spawns the hero,
redraws the minimap and emits `MAP_CHANGED`. Walking into a portal rect runs the
pure trigger rule, calls `loadMap`, then tells the server.

### Monsters

`src/game/enemyCatalog.js` is the single source of monster numbers, shared by both
runtimes. `Wolf` became `Enemy(scene, x, y, id, monsterId)` (the `Wolf` name stays
exported as an alias); `enemyVisuals.js` paints four vector body kinds. Every
monster uses the shared tuning; a monster may still override `ai` or `respawnMs`,
but none does today.

AI has a **leash** (`ENEMY_TUNING.leashRange`) measured on the *player's* distance
from the monster's spawn: a hero who leaves the camp ends the chase, and the
monster walks home. One camp can never follow a hero into the next.

| Tier | Monsters | Levels |
| --- | --- | --- |
| Ngoại thành | Sơn Cẩu, Dã Lang | 3, 8 |
| Trung thành | Lâm Tặc, Hắc Y Sát Thủ | 14, 19 |
| Nội thành | Thiết Giáp Binh, Ma Giáo Đệ Tử | 24, 29 |

Six species columns × three camps × fifteen monsters. A camp is always one
species, so a pack never mixes levels, and the species order matches the walk in
from the entrance. A monster shows its name anywhere in view (3 000 px); the
cutoff only drops labels for enemies far outside the viewport.

`soi-xam` (Sói Xám) keeps EXP 35 / 3–9 coins so the historical reward expectations
stay intact.

### Server

- `playerData.mapId`; `playerSnapshot` and `init_world` carry it.
- `enemiesByMap` + `enemyGridByMap`: one roster and one spatial grid per map.
  `this.enemies` / `this.enemyGrid` still point at the default map.
- Biện Kinh is safe: its legacy roster is only built when a harness passes
  `enemySpawns` / `enemyRespawnMs`. Every other map spawns its own roster.
- `map_change { portalId }` is validated against the portals of the map the player
  is standing on; the server owns the destination and replies `map_changed`
  (map, spawn, peers, roster) or `map_change_rejected`.
- AOI, `player_joined` / `player_left`, `enemy_moved`, `enemy_hit`, `enemy_reward`,
  `enemy_respawned`, bites and respawns are all scoped by map.
- Movement, join and attack aim clamp to the map's bounds (the market keeps the
  world-sized clamp for its legacy out-of-bounds spawns).
- `rollEnemyReward` reads EXP/coins from the catalog and echoes `monsterId`, `name`
  and `level`.

## Verification

1. `npm run build` — clean.
2. `npm test` — 61 files / 494 tests.
3. `npm run server:test` — 75 tests, including the map-travel and leash tests.
   (Run the two suites in separate steps; the server suite has multi-second waits
   and is timing-sensitive while 60 Vitest workers are still exiting.)
4. Manual: walk east through the Biện Kinh gate → Đông Môn Thành; fight each camp;
   the deep wood hits far harder than a level-3 stray; the return portal brings the
   hero back; the minimap follows the wider map; reload restores map and position.

## Decisions

- Map travel is an in-place rebuild, not a Phaser scene restart, so the HUD, chat
  and connection survive.
- Offline play spawns the local roster from the map definition but still earns no
  EXP/coins (server owns progression).
- No level-gap EXP scaling yet; the catalog EXP is paid in full.
- Boss respawns 180 s after death.
