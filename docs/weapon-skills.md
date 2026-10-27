# Weapon Skills, Books & Weapon Drops

- **Status:** Implemented (replaces the former sect system)
- **Scope:** `src/game/weapons.js`, `src/game/skills.js`, `src/game/items.js`,
  `src/game/enemyCatalog.js`, `server/src/rewards.js`,
  `server/src/websocket/gameSocket.js`, `server/src/data/playerDb.js`
- **Supersedes:** `docs/plan/sect-skills.md`, `docs/plan/thieu-lam-chuong-phap.md`

## 1. Model

There are no sects any more. Character creation only asks for a **name** and a
**gender**. The skill kit a hero can use is decided by the weapon worn in the
`weapon` equipment slot:

> `skill.weapon === equippedWeaponType(equipment)`

A hero wearing gloves cannot cast sword skills, and vice versa. Weapon type is
derived from the item (`item.weaponType`), never from a character class.

| Weapon id | Label | Skill count | Root skill(s) |
| --- | --- | --- | --- |
| `kiem` | Kiếm (sword) | 9 | `kiem_khi` (starter), `thieu_duong_kiem_phap`, `nga_my_kiem_phap` |
| `bao-tay` | Bao Tay (gloves) | 6 | `thieu_lam_tam_phap` (passive) |
| `dao` | Đao (saber) | 4 | `ngu_doc_tam_phap` |

The old catalogs were folded into these kits:

- Thiếu Lâm palm kit → **bao tay**
- Võ Đang + Nga My sword kits → **kiếm** (slots renumbered 1–8 after `kiem_khi`)
- Ngũ Độc kit → **đao**

## 2. Starter kit

Every new character receives and auto-equips `kiem-lang-khach` (sword, +6 attack)
and knows **Kiếm Khí** (`kiem_khi`, `starter: true`):

- `kiem_khi` is always known; it has no book and never drops.
- Existing characters that predate the weapon system are back-filled on join
  (grant + equip the starter sword, learn `kiem_khi`), so old saves stay playable.
- `starter: true` skills bypass the learned check in `skillLearned()`.

### Kiếm Khí

`kiem_khi` reaches **840 px** and its VFX is a vector projectile: `vfx.projectile:
"sword"` makes `playSkillCastVfx` draw a blade-shaped shard that flies from the hero
to the aimed point (clamped to `skill.range`) and bursts on arrival. Because the art
owns its own impact, `vfx.impact` is `null` — no separate spark is spawned at the
victim.

The art is cast from the hotbar like any other technique; the plain attack
(`performAttack`, `MELEE_REACH` = 280 px) is unchanged.

## 3. Learning from books

- One book item exists per learnable skill: `book_<skillId>` (generated in
  `src/game/items.js` from `SKILLS`; the starter skill is excluded).
- Books drop from monsters (`MONSTER_BOOK_DROPS` in `src/game/enemyCatalog.js`).
  Every learnable skill appears in at least one pool; a test enforces this.
- Using a book (`use_item` with a book id) is server-authoritative:
  1. resolve the skill id from the catalog (`skillIdForBook`);
  2. reject if already learned or the level is too low;
  3. reject if a prerequisite skill is not learned yet;
  4. consume one copy and append the id to the character's learned list;
  5. reply `item_result { action: "learn" }` + `skills_sync`.
- Learned ids are stored per character in `saves.learned_skills` (JSON array,
  schema version 5) and sent to the client as `skills_sync`.

`requires` on a skill means “must already be learned before its book can be
studied”, not “must be at level X”. `unlockLevel` is still the minimum character
level to study/cast.

## 4. Cast gating

The server validates every cast in this order:

1. the skill exists;
2. it is not passive (`passive` → rejected, passives run on their own);
3. `skill.weapon === player.weaponType` (`weapon` → rejected);
4. the skill is learned and the level is high enough (`locked` → rejected);
5. cooldown and MP are spent from the server-owned pools.

The client mirrors the same rules (`combat.castSkillById` only resolves skills
from the equipped weapon's kit, and `canCast` checks the learned set), so a
mismatch is explained locally before the server refusal arrives.

## 5. Drops

### Books (per monster tier)

| Monster | Chance | Pool |
| --- | --- | --- |
| `son-ca` (3) | 3% | `thieu_duong_kiem_phap`, `nga_my_kiem_phap` |
| `soi-xam` (5) | 3% | `thieu_lam_tam_phap`, `dai_tu_di_chuong` |
| `da-lang` (8) | 4% | `la_han_quyen`, `thai_cuc_quyen`, `mong_diep_thoi_tam`, `ngu_doc_tam_phap`, `truy_tam_doc` |
| `lam-tac` (14) | 5% | `la_han_tran`, `tam_thanh_kiem_phap`, `tu_hang_pho_do`, `van_doc_chieu_hong` |
| `hac-y-sat-thu` (19) | 6% | `kim_cang_bat_hoai`, `toat_hong_quan_khuyet`, `luu_thuy_khanh_van`, `u_hong_phiet_anh` |
| `thiet-giap-binh` (24) | 8% | `nhu_lai_than_chuong`, `tam_thanh_kiem_phap`, `van_doc_chieu_hong` |
| `ma-giao-de-tu` (29) | 10% | `nhu_lai_than_chuong`, `kim_cang_bat_hoai`, `u_hong_phiet_anh` |

### Weapons (rarer than books)

| Monster | Chance | Item |
| --- | --- | --- |
| `hac-y-sat-thu` (19) | 6% | `bao-tay-lang-khach` (Bao Tay) |
| `ma-giao-de-tu` (29) | 8% | `dao-lang-khach` (Đao) |

Loot is rolled on the server in `server/src/rewards.js` (`rollBookDrop`,
`rollWeaponDrop`) and granted straight into the killer's bag in `rewardKill`;
the `enemy_reward` broadcast only carries the loot for rendering. The starter
sword is never dropped.

## 6. Modules

| Layer | File | Responsibility |
| --- | --- | --- |
| Weapon ids | `src/game/weapons.js` | `WEAPON_TYPES`, `normalizeWeaponType`, `weaponTypeOfItem`, label keys |
| Catalog | `src/game/skills.js` | `SKILLS_BY_WEAPON`, `skillsForWeapon`, learned/usable/lock helpers |
| Items | `src/game/items.js` | weapon items (`weaponType`), generated `BOOK_ITEMS`, book helpers |
| Equipment | `src/game/equipment.js` | `equippedWeaponType(equipment)` |
| Rig | `src/game/heroRig.js` | `weaponKindFor` → `jian` / `claw` / `blade` |
| Loot tables | `src/game/enemyCatalog.js` | `MONSTER_BOOK_DROPS`, `MONSTER_WEAPON_DROPS` |
| Reward roll | `server/src/rewards.js` | `rollBookDrop`, `rollWeaponDrop`, `rollEnemyReward` |
| Persistence | `server/src/data/playerDb.js` | `learned_skills` column + getters/setters |
| Cast gate | `server/src/websocket/gameSocket.js` | weapon/learned/level validation, book study |
| UI | `SkillsModal.jsx`, `MobileSkillPicker.jsx`, `InventoryModal.jsx` | kit tree, learned locks, using books |

## 7. Adding content

### A new skill to an existing kit

1. Add an entry to the right array in `src/game/skills.js` with
   `weapon`, `slot`, `unlockLevel`, `mp`, `cooldown`, `target`, `range`,
   `radius`, `mult`, `effects`, `vfx`, `nameKey`/`descKey`.
2. Add name/description to `skills.*` in `src/i18n/locales/{vi,en,zh}.js`.
3. Optional: ship an icon in `public/skills/<id>.png` and set `icon`.
4. Add the skill id to at least one `MONSTER_BOOK_DROPS` pool (a test enforces
   this) and add its Vietnamese book name to `BOOK_NAMES` in `src/game/items.js`.
5. Run `npm test` and `npm run server:test`.

### A new weapon type

1. Add the id to `WEAPON_TYPES` and `WEAPON_LABEL_KEYS` in
   `src/game/weapons.js`, plus `weapons.*` copy in every locale.
2. Add at least one weapon item with `slot: "weapon"` and that `weaponType` in
   `src/game/items.js` (icon class in `src/styles/item-icons.css`).
3. Add its kit to `SKILLS_BY_WEAPON` and extend `weaponKindFor` if the rig needs
   a new silhouette.
4. Give it a drop source in `MONSTER_WEAPON_DROPS` (or a shop, once one sells
   weapons).

## 8. Tests

- `src/game/skills.test.js` — kit contents/slots, learned/usable/lock rules,
  every learnable skill has a book and a monster that drops it.
- `src/game/items.test.js` — starter kit, weapon/book catalog integrity.
- `src/game/passiveRegen.test.js` — passive regen only from learned arts.
- `server/tests/rewards.test.js` — book/weapon rolls, catalog-backed weapon ids.
- `server/tests/websocket.test.js` — weapon-gated casts, passive refusal, book
  study and `skills_sync`.

## 9. Known limitations / follow-ups

- Only one weapon exists per type; there is no blacksmith or weapon shop yet.
  Gloves and sabers are obtainable only from the late-game monsters above (or
  the GM panel).
- Books have Vietnamese display names (like the rest of the static item names)
  even when the UI language is English/Chinese.
- The old sect plan documents are kept for history and marked **Superseded**;
  do not follow them.
