# Server-authoritative game state — migration plan

Status: **implemented** (phases 0–6). Verified with `npm test` (655 client tests),
`npm --prefix server test` (73 server tests) and `npm run build`.

The client is now a renderer/input layer. The server owns damage, stats, buffs,
regen, HP/MP, inventory, equipment, position validation, and the login policy.

## 0. Implementation status

| Phase | State | Notes |
| --- | --- | --- |
| 0 — Shared pure model | done | `derivedStats.js`, `combatRules.js`, `CONSUMABLE_EFFECTS`, `EQUIPMENT_SLOTS` |
| 1 — Server persistence and identity | done | schema v4 (`equipment`/`hp`/`mp`/`state_imported`), `playerBag.js`, authenticated join, `POST /api/state/import` |
| 2 — Server combat authority | done | custom swing/cast authorisation, derived stats, server ticks regen and buffs, `player_stats` outbound |
| 3 — Server inventory/equipment/consumables | done | `use_item` / `equip_item` / `unequip_slot`, `inventory_sync`, `equipment_sync`, persisted vitals |
| 4 — Movement validation | done | `maxTravelDistance` with snap-back; server teleports reset the baseline |
| 5 — Client rewrite | done | join packet trimmed to token + character; damage numbers come from the server echo |
| 6 — Tests, docs, cleanup | done | rewritten WS/Auth tests, `state.test.js`, dead offline/loot code removed |

Deviations from the original sketch:

- `PUT /api/inventory` and `POST /api/leaderboard/submit` are removed. The
  leaderboard now reads the persisted `saves` ledger, and `GET /api/inventory/:id`
  is an authenticated, owner-only read.
- localStorage still stores the legacy bag/equipment keys, but only as the
  one-time import source (`POST /api/state/import`). Runtime state, stats and
  gear are never persisted client-side.
- The client keeps an in-memory copy of the bag/gear for rendering; every change
  originates from a server `inventory_sync` / `equipment_sync`.
- Monster control effects (stun/slow) are server-owned too: `src/game/enemyEffects.js`
  is applied on an accepted skill hit and honoured by the AI tick and the bite
  tick, so a stunned monster cannot move or bite. The client only follows the
  resulting positions (`Enemy` no longer keeps local stun/slow timers).

## 1. Why

These values are still decided by the client today:

| State | Today | Server check |
| --- | --- | --- |
| Normal attack damage vs monsters | client `computeDamage` → `enemy_hit.damage` | cap 200 only, no range check |
| PvP damage (basic + skill) | client rolls `damage` → `player_hit.damage` | clamp 200, no recompute |
| attack / defense / critRate | client `player_stats` + join payload | wide clamps, trusted |
| Heal / MP restore amount | client `player_heal` / `player_restore_mp` | clamped to ceiling, no item check |
| Inventory | client in-memory bag; `PUT /api/inventory` overwrites | unauthenticated, last-write-wins |
| Equipment | client localStorage only; server not persisted | sanitize + broadcast only |
| Position | `player_move` | map bounds only, teleportable |
| Buffs / passive regen | client only | saw indirectly via `player_stats` |

Server-owned already: level/EXP/coins/kills, max HP/MP, enemy HP/death/respawn,
enemy AI and bites, skill MP cost/cooldown, skill damage (monsters), shop price,
portals, quest claim.

## 2. Decisions

- **Server-only gameplay.** Delete offline branches and dead loot code; the
  world already freezes when the socket drops.
- **Full inventory + equipment authority.** Persist equipment, bag, HP and MP per
  character. Remove `PUT /api/inventory`. One-time import from localStorage.
- **Movement validation.** Speed check with snap-back; server-driven teleports
  (portal, respawn, Hồi Thành Phù, GM).
- **No guests.** A verified session token and an owned character are required to
  join.
- **Client-local:** quick slots, mobile bindings, audio/settings, VFX, camera.
- **Balance unchanged:** equipment `maxHp` / `maxMp` / `movementSpeed` bonuses
  stay unused.
- **Vitals persisted:** joining resumes stored HP/MP instead of a free full heal.

## 3. Phases

### Phase 0 — Shared pure model

1. Add `src/game/derivedStats.js`: `deriveCombatStats({ level, equipment, buffs, now })`,
   the single source of attack/defense/critRate/critDamage/attackSpeed/maxHp/maxMp.
2. Add `src/game/combatRules.js`: `MELEE_REACH` (moved out of `combat.js`),
   `MAX_HIT_WINDOW_MS`, `attackIntervalFor`, `maxTravelDistance`.
3. Extend `src/game/items.js` with `CONSUMABLE_EFFECTS` (`hp`, `mp`, `teleport`).
4. `src/game/equipment.js`: `EQUIPMENT_SLOTS` (5 slots, including `pants`) becomes
   the server whitelist.
5. Tests: `derivedStats.test.js`, `combatRules.test.js`, extend `items.test.js`.

### Phase 1 — Server persistence and identity

1. `server/src/data/playerDb.js` schema v4: add `equipment TEXT`, `hp INTEGER`,
   `mp INTEGER`, `state_imported INTEGER`; add `getEquipment/setEquipment`,
   `getVitals/setVitals`, `markStateImported`.
2. New `server/src/game/playerBag.js`: read/modify/persist bag through `store`;
   `grantItem`, `consumeItem`, `equipFromBag`, `unequipToBag`, all validated by
   `getItemById` and `planEquip`.
3. `handlePlayerJoin`: reject without a verified token and owned character
   (`join_rejected`); derive sect, gender, equipment, level, HP/MP and stats from
   the DB; ignore the client's `hp/mp/equipment/defense/attack/critRate/gender`.
   Send `player_progress`, `inventory_sync`, `equipment_sync`, `player_stats`.
4. New authenticated `POST /api/state/import`, gated by `state_imported`: validate
   bag ids/quantities and equipment ownership, persist, return canonical state.
5. Remove guest fallbacks from join, reward and shop paths.

### Phase 2 — Server combat authority

1. `handlePlayerAttack`: accept only owned and unlocked skills (`skillUnlocked`),
   derive attack cadence from attack speed, apply self heal/buff effects on the
   server, record `lastCast` / `lastSwing`.
2. `handleEnemyHit`: normal attacks recompute with `computeDamage(derived, enemy)`,
   enforce melee reach and a recent swing, and ignore `payload.damage`; the skill
   branch uses derived stats.
3. `handlePlayerHit`: recompute basic or skill damage from server stats and the
   target's derived defense; ignore `payload.damage`; keep flag/range/dodge/iframe.
4. Track `player.buffs` and tick passive regen server-side with
   `passiveRegenRate` / `advanceRegen`; broadcast `player_hp` on whole HP ticks.
   Buffs apply to damage, defense against bites, and movement speed.
5. `tickBites` uses the target's derived defense.
6. New outbound `player_stats` and `player_buffs`.
7. Remove inbound `player_stats`, `player_equipment`, `player_heal`,
   `player_restore_mp`.

### Phase 3 — Server inventory, equipment, consumables

1. New WS messages `use_item {itemId}`, `equip_item {itemId}`,
   `unequip_slot {slot}`: validate, mutate bag/equipment/vitals, persist, then
   broadcast `inventory_sync`, `equipment_sync`, `player_stats`,
   `player_hp`/`player_mp`, and `map_changed` for Hồi Thành Phù.
2. `shop_buy` and GM `add_items` use `playerBag` and send `inventory_sync`.
3. Delete `PUT /api/inventory/:id`; keep an authenticated read-only `GET` or
   remove it.
4. Remove `POST /api/leaderboard/submit`; the leaderboard reads `saves` only.
5. Persist vitals on damage/heal/level-up (dirty flag + periodic flush) and on
   disconnect.

### Phase 4 — Movement validation

1. Track `player.lastMoveAt/lastX/lastY`; compare against `maxTravelDistance`
   with tolerance and slack.
2. On violation: keep the server position, send a snap-back `player_moved` to
   the sender, do not broadcast.
3. Server-initiated teleports reset the baseline: portal, respawn, Hồi Thành
   Phù, GM teleport.

### Phase 5 — Client rewrite

1. `src/game/combat.js`: remove outgoing `computeDamage` / `computeSkillDamage`;
   `damageEnemy` sends only `{ id, skill? }`; PvP sends only `{ targetId, skill? }`;
   draw damage numbers from the server echo; keep VFX.
2. `src/game/game.js`: delete the stat-report block; consumable/equip/unequip use
   WS actions; remove offline spawn/respawn loops and local GM mutations; handle
   `player_stats`, `inventory_sync`, `equipment_sync`, `item_result`,
   `join_rejected`, and snap-back `player_moved`.
3. `src/game/player.js`: stats come only from the server; delete
   `refreshEquipmentBonuses`.
4. `src/game/enemy.js`: remove the offline respawn/local AI branch.
5. `src/game/networkClient.js`: add `useItem/equipItem/unequipSlot`; change
   `sendEnemyHit`/`sendPlayerHit`; remove `sendStats`.
6. `src/game/items.js` becomes a read-only mirror; delete
   `src/game/inventorySync.js` and its test.
7. `src/game/storage.js`: stop persisting stats/inventory/equipment; keep
   audio/settings; clear legacy keys after import.
8. `src/App.jsx`: require login and an active character, remove guest fallbacks,
   surface `join_rejected`.
9. `src/game/shopFlow.js`: keep the server-confirmed flow; drop the offline path.

### Phase 6 — Tests, docs, cleanup

1. Update client tests: `combat.test.js`, `game.test.js`, `player.test.js`,
   `items.test.js`, `equipment.test.js`, `networkClient.test.js`,
   `shopFlow.test.js`, `App.test.jsx`.
2. Add server tests (`server/tests/websocket.test.js` or a new `authority.test.js`):
   forged normal/PvP damage ignored, stat/equipment spoof ignored, locked skill
   refused, potion decrement and persistence, equipment persistence, teleport
   rejected, guest rejected, import-once.
3. Remove dead code: `spawnDrop`, `collectDrop`, `rollDrop`,
   `OFFLINE_RESPAWN_MS`, `usesServerMovement`, `usesServerRewards`,
   `offlineSpawns`, the dead GM `playerGrid` branch.
4. Keep this document updated during implementation.

## 4. Protocol changes

| Direction | Message | Change |
| --- | --- | --- |
| C→S | `player_join` | drops hp/mp/equipment/stats/gender; requires token + character |
| C→S | `player_stats`, `player_equipment`, `player_heal`, `player_restore_mp` | removed |
| C→S | `enemy_hit` | `{ id, skill? }` only |
| C→S | `player_hit` | `{ targetId, skill? }` only |
| C→S | `use_item`, `equip_item`, `unequip_slot` | new |
| S→C | `player_stats`, `equipment_sync`, `item_result`, `join_rejected` | new |
| S→C | `inventory_sync` | sent to every player on join and after every bag change |
| S→C | `player_hp` / `player_mp` | authoritative only; also from regen ticks |

## 5. Verification

1. `npm test` — all client tests pass (fix the stale `apiClient.test.js` as part
   of the inventory REST change).
2. `npm --prefix server test` — all server tests pass.
3. `npm run build` — clean production build.
4. Manual two-tab run: kill a monster, PvP duel, use a potion, equip/unequip,
   use a portal, reload and confirm the state persisted.
5. Tamper checks from the browser console:
   - `enemy_hit` with 9999 damage → ignored.
   - `player_hit` with 9999 damage → ignored.
   - `PUT /api/inventory` → 404.
   - forged `player_move` jump → snap-back.
   - forged `player_stats` / equipment → ignored.
6. Legacy account: first login imports the localStorage bag/equipment once; the
   second login does not import again.

## 6. Risks and notes

- HP/MP persistence removes the "logout to heal" behaviour. If that is not
  wanted, seed full HP on join instead.
- Movement tolerance starts at 1.75× max speed + 120px slack; tune it against
  click-to-move under lag.
- The one-time import endpoint is the only place a client can submit a bag; it is
  authenticated, validated against the catalog, and gated by `state_imported`.
- Keep `src/game/passiveRegen.js`, `skillDamage.js`, `pvp.js`, `equipment.js`,
  `items.js`, `progression.js` Phaser-free so the server keeps importing them.