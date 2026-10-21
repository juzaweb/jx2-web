# Sect skills — remaining sects (Võ Đang, Nga My, Ngũ Độc)

Status: **planned** (not started). The old Thiếu Lâm Võ Tông (TLQ) fist/kick kit
was removed and is being rebuilt as a palm-technique kit
(see `thieu-lam-chuong-phap.md`); this document plans the other three sects so
each ships as its own reviewable change.

## Goal & scope

- Give each remaining sect a kit of six skills on the same six-slot model:
  slots `0..5`, unlock levels `1 / 1 / 3 / 5 / 7 / 10`, bound to the two mouse
  hands through `SkillPickerModal`.
- Keep the existing model: server-authoritative MP, cooldown, range and damage;
  client-side VFX and animation.
- Ship real icons plus VI/EN/ZH copy.
- Do not regress the palm-technique Thiếu Lâm rebuild or the current characters.

## What already exists (reuse, do not rewrite)

| Layer | Where | Notes |
| --- | --- | --- |
| Catalog | `src/game/skills.js` | `SKILLS_BY_SECT` lists the 4 sects; all four are empty arrays until their kits are authored |
| Effect kinds | `skills.js` + `combat.js` | `buff` (`attackPct`, `defensePct`, `critRate`), `heal` (`amount`, `pctMaxHp`), `slow`, `stun` |
| Damage maths | `src/game/skillDamage.js` | Shared by client and server |
| Targeting | `combat.js::resolveTargets` | AoE (`radius > 0`) is centred on the **caster**; otherwise nearest enemy within `range` |
| Server validation | `server/src/websocket/gameSocket.js` | `skillById` / `skillMpCost` / `skillCooldown`, `lastCast` window, `MAX_HITS_PER_CAST`, authoritative enemy HP |
| VFX primitives | `src/game/skillVfx.js` | cast `slash` / `kick` / `shockwave` / `aura`; impact `spark` / `burst` / `dust` |
| Rig animation | `src/game/heroRigView.js` | animation kind derived from `vfx.cast` |
| Loadout | `src/game/skillLoadout.js` | default `{ left: 0, right: 1 }` already valid for every sect with slots 0/1 |
| Keybinds | `src/game/keybinds.js` | default `Q W E R T Y` assign the right hand |
| Sect / gender | `CharacterSelectModal` + `server/src/data/characterDb.js` | Nga My is female-only; the other three are male |
| Icons | `public/skills/<id>.png` | sourced from the VLTK2 CDN (see "Icons") |

## Engine gaps to decide

The authentic Ngũ Độc kit is necromancy (raise corpses, summon zombies, poison).
None of that fits the current model. Two tracks:

| Track | Contents | Cost | Recommendation |
| --- | --- | --- | --- |
| **v1 (no engine change)** | Reuse `slow`/`stun`/`heal`/`buff`; adapt Ngũ Độc to a poison-flavoured kit | Low — catalog + i18n + icons only | Ship this first |
| **v2 (engine change)** | Add server-authoritative `poison` (damage-over-time) and `lifesteal` | High — server enemy loop, new effect kinds, tests | Separate later change |

Why v2 is non-trivial: enemy HP is server-authoritative, and a DoT ticks outside
the `lastCast` window, so it cannot be reported as repeated `enemy_hit` without a
real server-side effect model (enemy state + tick in the enemy loop + HP
broadcast). Client-only DoT would be overwritten by the next snapshot.

## Proposed kits

All values are starting points for a balance pass; `mult` follows the six-slot
scale used by the removed Thiếu Lâm kit. AoE skills (`radius > 0`) are centred on
the caster.

### Võ Đang — sword dao (male)

| Slot | Skill | Lvl | MP | CD (ms) | Target | Effect | VFX cast/impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Võ Đang Kiếm Pháp | 1 | 5 | 1500 | enemy r85 | — | slash / spark |
| 1 | Lưu Quang Kiếm Pháp | 1 | 8 | 4000 | enemy r100 | — | slash / spark |
| 2 | Triền Mộng Kiếm Ý | 3 | 12 | 6000 | enemy r95 | slow 30% / 2s | slash / dust |
| 3 | Lạc Sương Kiếm Ý | 5 | 18 | 9000 | self AoE r110 | — | shockwave / burst |
| 4 | Thái Cực Thần Công | 7 | 15 | 15000 | self | buff `defensePct` 0.2 + `critRate` 0.1, 8s | aura / — |
| 5 | Vô Ngã Vô Kiếm | 10 | 35 | 30000 | self AoE r140 | stun 1.2s | shockwave / burst |

### Nga My — sword & palm, healing (female)

| Slot | Skill | Lvl | MP | CD (ms) | Target | Effect | VFX cast/impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Nga My Kiếm Pháp | 1 | 5 | 1500 | enemy r85 | — | slash / spark |
| 1 | Phiêu Tuyết Xuyên Vân | 1 | 8 | 4000 | enemy r100 | — | slash / spark |
| 2 | Túy Tiên Vong Nguyệt | 3 | 12 | 6000 | enemy r95 | slow 30% / 2s | kick / dust |
| 3 | Phong Vũ Phiêu Hương | 5 | 18 | 9000 | self AoE r110 | — | shockwave / burst |
| 4 | Phật Quang Phổ Chiếu | 7 | 20 | 16000 | self | heal 15% maxHp + buff `defensePct` 0.15, 8s | aura / — |
| 5 | Phật Pháp Vô Biên | 10 | 35 | 30000 | self AoE r140 | stun 1.2s | shockwave / burst |

### Ngũ Độc — poison & saber (male), v1 adaptation

| Slot | Skill | Lvl | MP | CD (ms) | Target | Effect | VFX cast/impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Ngũ Độc Đao Pháp | 1 | 5 | 1500 | enemy r85 | — | slash / spark |
| 1 | Vạn Độc Đoạt Mệnh Đao | 1 | 8 | 4000 | enemy r90 | slow 25% / 2s | slash / dust |
| 2 | Thi Độc Thuật | 3 | 12 | 6000 | enemy r95 | — | kick / dust |
| 3 | Bộc Thi Đại Pháp | 5 | 18 | 9000 | self AoE r115 | stun 0.8s | shockwave / burst |
| 4 | Âm Tà Hấp Hồn Khí | 7 | 18 | 15000 | self | heal 12% maxHp + buff `attackPct` 0.1, 8s | aura / — |
| 5 | Vô Thiên Ma Công | 10 | 35 | 30000 | self AoE r140 | slow 40% / 2.5s + stun 1s | shockwave / burst |

If v2 lands, replace slot 1/2 with a `poison` DoT and slot 4 with a `lifesteal`
strike; keep the same ids so saved loadouts stay valid.

## Icons

The removed Thiếu Lâm icons were sourced from the VLTK2 CDN; the palm rebuild uses
self-authored icons. For the other sects, the VLTK2 CDN still serves per-sect skill icons.

- Ngũ Độc (URLs confirmed from the viet33 page):
  `http://img.zing.vn/volam2/images/danhsachbaiviet/monphai/ngudoc/ndkynangchieuthuc_clip_image0NN_0000.jpg`
  (NN `001` Vạn Độc Tâm Pháp, `002` Ngũ Độc Đao Pháp, `006` Bộc Thi Đại Pháp,
  `009` Vạn Độc Đoạt Mệnh Đao, `010` Âm Tà Hấp Hồn Khí, `015` Vô Thiên Ma Công …).
- Võ Đang / Nga My: pull the icons from the official sect pages
  (`volam2.vnggames.com/cam-nang/mon-phai/vo-dang.html`, `.../nga-mi.html`) or
  the equivalent viet33 pages; confirm the image URLs before downloading.
- Save as `public/skills/<skill_id>.png` and set `icon: "/skills/<skill_id>.png"`
  on each catalog entry. `SkillIcon` falls back to `glyph` when `icon` is absent.

## Cross-cutting work per sect

1. **Catalog** — add the skill array in `src/game/skills.js` (id, sect, slot,
   icon, glyph, nameKey/descKey, unlockLevel, mp, cooldown, target, range,
   radius, mult, effects, vfx) and wire it into `SKILLS_BY_SECT`.
2. **i18n** — add a `voDang` / `ngaMy` / `nguDoc` branch under `skills` in
   `src/i18n/locales/{vi,en,zh}.js` (name + desc per skill).
3. **Icons** — download + place under `public/skills/`, set `icon`.
4. **Weapon visual (optional)** — Võ Đang / Nga My draw the existing `jian`;
   Ngũ Độc could use a new `dual-blade` kind in `heroRig.weaponKindFor`
   (temporarily map to `blade`).

## Delivery order

Each phase is a self-contained change (~100–300 lines) that keeps the game
working on its own. P1–P3 are independent and can be done in any order.

| Phase | Content | Depends on |
| --- | --- | --- |
| P1 | Võ Đang kit: catalog + i18n + icons + tests | — |
| P2 | Nga My kit: catalog + i18n + icons + tests | — |
| P3 | Ngũ Độc v1 kit: catalog + i18n + icons + tests | — |
| P4 | Engine: server-authoritative `poison` (DoT) + `lifesteal` | — |
| P5 | Upgrade Ngũ Độc to DoT/lifesteal + balance pass | P3, P4 |

## Testing & definition of done

- **Catalog invariants test** (add once, covers all sects): every sect has six
  skills, slots `0..5` unique, valid `unlockLevel`, every skill has an `icon`
  whose file exists under `public/skills/`, and `nameKey`/`descKey` resolve in
  all three locales.
- **Effect tests**: self `heal`, `defensePct`/`attackPct` buff, `slow`, `stun`
  per sect.
- **Server tests**: skill cast requires `lastCast`, range is enforced, damage is
  recomputed — extend the existing cases with one per sect; add DoT tests in P4.
- **Manual check**: pick each hand skill, cast on a wolf, confirm icon, cooldown
  overlay, VFX and animation.
- `npx vitest run`, `npm --prefix server test` and `npm run build` all green
  after each phase.

## Open decisions

1. Ngũ Độc: ship **v1 now** (existing effects) or wait for **v2** (DoT/lifesteal,
   P4 first)?
2. Add a `dual-blade` weapon shape for Ngũ Độc, or reuse `blade` for now?
3. Confirm the icon URLs for Võ Đang and Nga My before P1/P2.
