# Faction cities, four gates and the central battlefield

Status: **phase 1 implemented**; phase 2 (the other two capitals' hunting
grounds) not started.

## Task checklist

### Done (phase 1)

- [x] Faction model shared by client and server (`src/game/factions.js`) and the
      `faction` column on `characters` (migration defaults to `han`).
- [x] Faction picker on the character-creation screen (VI/EN/ZH strings).
- [x] A new hero boots into their own faction capital.
- [x] Biện Kinh (Hán) has four gates and four working portals.
- [x] Shared battlefield `trung-nguyen` with one return gate per capital.
- [x] Bắc Lĩnh (30–44) and Tây Sơn (45–60) hunting grounds, 90 spawns each,
      with six new vector-painted species.
- [x] Thục Thành / Ngụy Thành minimal capitals: herb-shop Dược Sư, four gate
      arches, south gate open onto the battlefield.
- [x] Faction PvP **only** on the battlefield: different camps fight without the
      PK flag, allies never do; every other map keeps the legacy flag rule and
      the three capitals stay no-combat.
- [x] Client and server both enforce the map's `pvpMode` (click, cursor,
      auto-target, skills, channel ticks, splash).
- [x] Nameplates turn red for an enemy camp on the battlefield.
- [x] Defeat respawns the hero in their own faction capital.
- [x] Full-city map title follows the active map.
- [x] Tests: client 82 files / 840 tests, server 116 tests; `npm run build`
      clean.

### Not done (phase 2+)

- [ ] Open the north/east/west gates of Thục Thành and Ngụy Thành and ship their
      six hunting maps (to reach the full 9 hunting grounds).
- [ ] Feedback when walking into a still-closed gate (today it is a plain arch
      with no portal, so nothing happens).
- [ ] Battlefield objective/scoring (capture points, per-faction score, rewards);
      this needs its own plan because it adds server state.
- [ ] A way to change faction (currently fixed at creation; no item, no UI,
      GM-only would need an action).
- [ ] Book/weapon drops for the level 30–60 species (they pay EXP and coins
      only, so the weapon kits stay unchanged).
- [ ] Manual in-game walkthrough: one hero per camp, all four Hán gates, a
      cross-camp fight on the battlefield, and a defeat returning home.
- [ ] Optional performance work: load per-map enemy rosters lazily at boot
      instead of preloading every hunting ground.
- [ ] Localised map names (map names are still Vietnamese data strings in every
      locale, matching the pre-existing maps).

## Goal & scope

- Three political camps, each with a capital: **Hán** (Biện Kinh), **Thục**
  (Thục Thành) and **Ngụy** (Ngụy Thành). A faction is a city/camp, not the
  removed martial-sect system.
- Every capital has **four gates**. The **south gate** opens onto the shared
  central battlefield; the other gates lead to hunting grounds.
- **Trung Nguyên Chiến Trường** is the only map with free faction PvP: players
  from different camps may fight without the PK flag. Same camp never fights.
  Every other map keeps the legacy PK-flag rules, and the three capitals stay
  no-combat safe zones.
- Phase 1 ships Hán in full and the other two capitals as minimal stubs (herb
  shop + gates, south gate open). Their north/east/west gates are built but shut
  until their hunting grounds ship.
- A defeated hero respawns in **their own faction capital**, on every map.
- No new art: monsters are vector-painted, the battlefield floor is painted in
  code, and the capitals reuse the existing brick/alley/shop art.

## World map

| Map id | Name | Role | PvP |
| --- | --- | --- | --- |
| `market` | Biện Kinh (Hán) | capital, 4 gates | none (safe) |
| `dong-mon-thanh` | Đông Môn Thành | east gate, levels 3–29, 270 spawns | flag |
| `bac-linh` | Bắc Lĩnh | north gate, levels 30–44, 90 spawns | flag |
| `tay-son` | Tây Sơn | west gate, levels 45–60, 90 spawns | flag |
| `trung-nguyen` | Trung Nguyên Chiến Trường | shared battlefield, no monsters | **faction** |
| `thuc-thanh` | Thục Thành | Thục capital, south gate only | none (safe) |
| `nguy-thanh` | Ngụy Thành | Ngụy capital, south gate only | none (safe) |

Topology is a star: every capital reaches the others only by crossing the
battlefield through its south gate.

## Architecture

- `src/game/factions.js` — pure `FACTIONS` table (`han`/`thuc`/`nguy`),
  `normalizeFaction`, `factionHomeMap`, `isHostileFaction`. Shared by client and
  server.
- `MapDefinition` gained `pvpMode` (`none` / `flag` / `faction`) and
  `homeFaction`; `mapPvpMode(map)` resolves the policy (legacy maps without the
  field keep the PK-flag rule).
- `src/game/pvp.js` — `pvpFoes`/`mayDuel`/`canPvpAttack(..., pvpMode)`.
  `faction` mode replaces the flag with camp hostility.
- Every client consumer (click targeting, cursor, auto-target, skill casting,
  channel strikes) asks the map for its mode; every server consumer
  (`handlePlayerHit`, splash targets) does the same.
- `src/game/maps/camps.js` — the camp expander extracted from Đông Môn Thành so
  all three hunting grounds share one scatter rule.
- Character creation now stores `faction` (`characters.faction`, migrated with a
  `han` default). The join snapshot carries `faction`, so nameplates can show
  enemies red on the battlefield.
- A new character boots into their faction capital; the city's hero shop is the
  shared Dược Sư.
- `respawnPlayer` uses `factionHomeMap(victim.faction)`.

## Verification

1. `npm test` — 82 files / 840 tests.
2. `npm --prefix server test` — 116 tests.
3. `npm run build` — clean.
4. Manual: create one hero per camp; each boots into their own capital; Hán has
   four working gates; two different camps can fight on the battlefield without
   the PK flag; allies cannot; a defeat returns the hero to their own capital.