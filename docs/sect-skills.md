# Sect Skills & Weapon Drops

- **Status:** Implemented (replaces the weapon-kit + skill-book system)
- **Scope:** `src/game/sects.js`, `src/game/skills.js`, `src/game/items.js`,
  `src/game/enemyCatalog.js`, `server/src/rewards.js`, `server/src/game/skillCast.js`,
  `server/src/websocket/gameSocket.js`, `server/src/data/{characterDb,playerDb}.js`
- **Supersedes:** `docs/weapon-skills.md`

## 1. Model

A character belongs to one of four **martial sects**. Character creation asks for
a **name**, a **gender**, a **faction** (home city + PvP camp) and a **sect**.
The sect owns the skill kit **and** the weapon that kit is built around:

> `skill.weapon === equippedWeaponType(equipment)`

A hero wearing gloves cannot cast sword arts, and the sect never changes in play.

| Sect id | Sect | Weapon | Arts | Starter |
| --- | --- | --- | --- | --- |
| `thieu-lam` | Thiếu Lâm | `bao-tay` | 6 | `thieu_lam_tam_phap` (passive) |
| `vo-dang` | Võ Đang | `kiem` | 4 | `thieu_duong_kiem_phap` |
| `nga-my` | Nga My | `kiem` | 4 | `nga_my_kiem_phap` |
| `ngu-doc` | Ngũ Độc | `dao` | 4 | `ngu_doc_tam_phap` |

`src/game/sects.js` is the single source of truth (`SECT_IDS`, `SECTS`,
`normalizeSect`, `sectWeapon`, `sectStarterSkillId`, `sectWeaponItemId`,
`sectForSkill`). Factions (`src/game/factions.js`) stay a separate, political
concept: they decide the home city and hostility on the central battlefield,
never the skill kit.

## 2. Catalogs

| File | Kit |
| --- | --- |
| `src/game/skills/catalog/baoTay.js` | `THIEU_LAM_SKILLS` (6) |
| `src/game/skills/catalog/kiem.js` | `VO_DANG_SKILLS` (4) + `NGA_MY_SKILLS` (4) |
| `src/game/skills/catalog/dao.js` | `NGU_DOC_SKILLS` (4) |
| `src/game/skills/catalog/index.js` | `SKILL_KITS` keyed by sect id + flat `SKILLS` |

Every kit carries exactly one `starter: true` art in **slot 0** with
`unlockLevel: 1`. The validator (`validateSkillCatalog`) enforces that, plus
unique slots per kit, the sect's weapon on every entry, unique ids and
prerequisite integrity. Slots index the skill tree and the hotbar (max 6).

## 3. Starter kit

A fresh character is created with:

1. the shared consumable kit (`STARTER_ITEMS`: potions + return talismans);
2. the **sect's** starting weapon, granted and auto-equipped
   (`kiem-lang-khach`, `bao-tay-lang-khach` or `dao-lang-khach`);
3. the **sect's** starter art recorded in `saves.learned_skills`.

`starter: true` skills bypass the learned check in `skillLearned()`, so a hero
can always cast their first art. On join the server back-fills both halves for
older saves: a missing weapon is granted and equipped, and a missing starter art
is added to the learned list.

Thiếu Lâm's starter is a **passive internal art** (no cast, no MP, restores
2 HP/s through `src/game/passiveRegen.js`); at level 1 its damage comes from the
plain attack. Every other sect opens with an active strike.

## 4. Learning from the F5 tree

There are no skill books any more.

- `learn_skill` (`{ skillId }`) → `handleLearnSkill` on the server.
- The server rejects anything outside the hero's own kit (`reason: "sect"`),
  then applies `learnRejection`: `already_learned`, or the level/prerequisite
  gate (`level`, `prereq`).
- Price is `skillLearnCost(skill)` in silver (bạc) + EXP; a shortfall is refused
  before anything is written.
- On success the id is appended to `saves.learned_skills`, the level is set to 1,
  the ledger is debited and `skills_sync` publishes the new list.
- `skills.learned_skills` keeps per-character ids; `skills.skill_levels` (both in
  the `saves` table) keeps the ranks.

`requires` on a skill means “must already be learned before this art can be
studied”, not “must be at level X”. `unlockLevel` is the minimum character level
to cast and to study, and `characterLevelForSkillLevel` gates each upgrade rank.

The F5 panel (`SkillsModal`) shows the study button when `skillLockReason`
returns `{ kind: "learn" }`, using the same price/shortfall maths as upgrades.

## 5. Cast gating

The server validates every cast in this order:

1. the skill exists;
2. it is not passive (`passive` → rejected, passives run on their own);
3. `skill.weapon === player.weaponType` (`weapon` → rejected);
4. the skill is learned (or is the sect starter) and the level is high enough
   (`locked` → rejected);
5. cooldown and MP are spent from the server-owned pools.

The client mirrors the rules: `combat.castSkillById` resolves the id in the
catalog and refuses a cast whose weapon does not match the worn one, so a stale
hotbar binding is explained locally before the server refusal arrives.

## 6. Drops

Skills are never items: a kill can only drop a **weapon** (and pays EXP + đồng).

| Monster | Chance | Item |
| --- | --- | --- |
| `hac-y-sat-thu` (19) | 6% | `bao-tay-lang-khach` (Bao Tay) |
| `ma-giao-de-tu` (29) | 8% | `dao-lang-khach` (Đao) |

Loot is rolled on the server in `server/src/rewards.js` (`rollWeaponDrop`) and
granted straight into the killer's bag in `rewardKill`; the `enemy_reward`
broadcast only carries the loot for rendering, and the client strips it
(`src/game/rewardSync.js`).

## 7. Modules

| Layer | File | Responsibility |
| --- | --- | --- |
| Sect catalog | `src/game/sects.js` | sect ids, weapons, starters, normalisation |
| Weapon ids | `src/game/weapons.js` | `WEAPON_TYPES`, `normalizeWeaponType`, label keys |
| Catalog | `src/game/skills/catalog/{baoTay,kiem,dao}.js` | authored arrays per sect kit |
| Registry | `src/game/skills/registry.js` | flat `SKILLS`, `SKILLS_BY_SECT`, id/slot lookups |
| Gating | `src/game/skills/gating.js` | learned / learnable / usable / lock reason |
| Cost | `src/game/skills/cost.js` | MP and cooldown, with test-mode overrides |
| Levels | `src/game/skills/levels.js` | rank scaling, study/upgrade price, funds checks |
| Schema | `src/game/skills/schema.js` | `defineSkill`, catalog validation |
| Client casting | `src/game/skills/client/castController.js` | gating, aim, targeting, channel, buffs |
| Items | `src/game/items.js` | starter weapons, consumables, equipment |
| Loot tables | `src/game/enemyCatalog.js` | `MONSTER_WEAPON_DROPS` |
| Reward roll | `server/src/rewards.js` | `rollWeaponDrop`, `rollEnemyReward` |
| Persistence | `server/src/data/playerDb.js` | `learned_skills` / `skill_levels`, migration v9 |
| Server casting | `server/src/game/skillCast.js` | `castRejection`, `learnRejection`, `upgradeRejection`, hits |
| Socket wiring | `server/src/websocket/gameSocket.js` | `learn_skill`, back-fill, GM shortcut |
| UI | `SkillsModal.jsx`, `MobileSkillPicker.jsx`, `CharacterSelectModal.jsx` | sect tree + study button, sect picker |

```
src/game/skills/
  catalog/   baoTay.js  kiem.js  dao.js  index.js
  index.js   registry.js  gating.js  cost.js  levels.js  effects.js  area.js  schema.js
  client/    vfx.js  tree.js  castController.js
src/game/sects.js            # sect <-> weapon <-> starter
src/game/skills.js           # barrel (server-safe)
```

## 8. Migration (schema version 9)

`PlayerDatabase._migrate()` version 9 (`_migrateSects`):

1. strips every `book_*` stack from all stored bags;
2. assigns a sect to characters still holding the legacy `sect` value — from the
   school most of their old arts belonged to (`sectForSkill`, which ignores the
   retired `kiem_khi`), then the worn weapon, then the legacy gender mapping
   (female → Nga My);
3. narrows `learned_skills` to that sect's kit plus its starter and keeps the
   ranks already paid for in `skill_levels`.

## 9. Adding content

### A new art for an existing sect

1. Add one `defineSkill({...})` entry to the kit array in
   `src/game/skills/catalog/*.js` with `weapon` (must match the sect),
   `slot`, `unlockLevel`, `mp`, `cooldown`, `target`, `range`, `radius`, `mult`,
   optional `effects`/`vfx`, and `nameKey`/`descKey`.
2. Add name/description under `skills.*` in `src/i18n/locales/{vi,en,zh}.js`.
3. Optional: ship an icon in `public/skills/<id>.png` and set `icon`.
4. Run `npm run validate:skills`, `npm test` and `npm --prefix server test`.

### A new sect

1. Add the id to `SECT_IDS` and an entry to `SECTS` in `src/game/sects.js`
   (weapon, starter art, starting weapon item).
2. Author its kit in a catalog file and register it in `SKILL_KITS`.
3. Add `sects.*` copy to the three locales and `weapons.*` if the weapon is new.
4. Extend the migration's legacy mapping if an old skill id should land there.
