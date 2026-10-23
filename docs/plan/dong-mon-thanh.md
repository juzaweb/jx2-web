# Đông Môn Thành — second map with a level 1–30 hunting ground

Status: **implemented** (all phases shipped in one change). Replaces the single-map
assumption in `BACKLOG.md` item B1.

## Goal & scope

- Add a second, portal-linked map east of Biện Kinh: **Đông Môn Thành**.
- Fill it with a level 1–30 hunting ground: three courtyards, two monster species
  per band, and one level-30 boss in the keep.
- Keep everything server-authoritative (health, death, respawn, reward, level).
- Reuse the existing art: no new image assets, no Tiled/tilemap pipeline.

Out of scope: NPCs, quests and shops inside the new town, loot drops, level-gap
EXP scaling, and offline progression (still frozen, matching the existing test).

## Architecture

### Map registry (client + server)

`src/game/maps/` holds pure data (no Phaser), so the Node server imports the same
numbers the client renders:

| File | Role |
| --- | --- |
| `mapRegistry.js` | `MAPS`, `getMap(id)`, `mapWorldConfig(map)`, `findPortal(mapId, portalId)`, `isInsideMap` |
| `marketMap.js` | Biện Kinh packaged as a `MapDefinition`, including the 8 legacy wolf spawns |
| `dongMonThanhMap.js` | Đông Môn Thành: bounds, walls, gates, props, portals, 3 level zones, 23 spawns |
| `portals.js` | Pure trigger state machine (`portalAt`, `stepPortalTrigger`, cooldown, arrival lock) |

A `MapDefinition` carries: `id`, `name`, `safe`, `bounds`, `spawn`, `ground`
(palette + tile keys + optional walkway/medallions), `buildings`, `trees`, `grass`,
`walls`, `gates`, `banners`, `braziers`, `portals`, `enemySpawns`, `zones`, `npcs`.

### Rendering

`src/game/marketWorld.js` became `src/game/worldManager.js`. `WorldManager` now
takes a `MapDefinition`, draws the map from it, and tracks every GameObject it
creates so `destroy()` can hand the scene back clean before the next map loads.
New draw passes: `drawWalls` (slate blocks + collision bodies + minimap), `drawGates`
(arch), `drawBanners`, `drawBraziers`, `drawPortals` (glowing trigger strips).

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
exported as an alias); `enemyVisuals.js` paints four vector body kinds. Each
monster carries its own AI tuning and respawn delay, so the boss waits 180 s while
regular monsters use the default.

| Tier | Monsters | Levels |
| --- | --- | --- |
| Ngoại thành | Sơn Cẩu, Dã Lang | 3, 8 |
| Trung thành | Lâm Tặc, Hắc Y Sát Thủ | 14, 19 |
| Nội thành | Thiết Giáp Binh, Ma Giáo Đệ Tử | 24, 29 |
| Boss | Đông Môn Tướng Quân | 30 |

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
2. `npm test` — 60 files / 489 tests.
3. `npm run server:test` — 71 tests, including the new map-travel test.
   (Run the two suites in separate steps; the server suite has multi-second waits
   and is timing-sensitive while 60 Vitest workers are still exiting.)
4. Manual: walk east through the Biện Kinh gate → Đông Môn Thành; fight each tier;
   the boss hits far harder than a level-3 stray; return portal brings the hero back;
   the minimap labels the town and marks the boss in orange; reload restores the map
   and position.

## Decisions

- Map travel is an in-place rebuild, not a Phaser scene restart, so the HUD, chat
  and connection survive.
- Offline play spawns the local roster from the map definition but still earns no
  EXP/coins (server owns progression).
- No level-gap EXP scaling yet; the catalog EXP is paid in full.
- Boss respawns 180 s after death.
