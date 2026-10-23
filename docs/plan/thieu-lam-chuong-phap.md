# Thiếu Lâm chưởng pháp — rebuild plan

Status: **in progress**. The old Thiếu Lâm Võ Tông (TLQ) kit has been removed.
Row 1 of the supplied palm sheet is wired as **Đại Tu Di Chưởng** (slot 2,
icon + four-frame VFX); Row 2 is wired as **La Hán Trận** (slot 3,
icon + four-frame stationary formation VFX); slots 0, 1, 4 and 5 are still pending.

## 1. What was removed (done)

TLQ was the fist/kick kit of Thiếu Lâm Võ Tông in VLTK2. The following were
deleted so nothing from that kit survives in the client, server, or assets:

| Item | Where | State |
| --- | --- | --- |
| 6 skill icons (`la_han_quyen`, `ca_diep_thoai`, `vi_da_quyen`, `dai_tu_di_chuong`, `hue_nhan_chu`, `nhu_lai_than_thuong`) | `public/skills/*.png` | deleted |
| 6 catalog entries | `src/game/skills.js` (`THIEU_LAM_SKILLS`) | removed; one palm entry restored |
| VI/EN/ZH names + descriptions | `src/i18n/locales/{vi,en,zh}.js` (`skills.thieuLam`) | deleted |
| Catalog assertions on TLQ ids | `src/game/skills.test.js`, `src/game/skillDamage.test.js` | rewritten to use ad-hoc fixtures |
| Server skill-cost/damage assertions that require a live catalog | `server/tests/websocket.test.js` | skipped with `SKIP_NO_KIT`, must be re-enabled when the full kit lands; a focused single-skill MP test runs today |

When a sect has no kit, `skillsForSect()` returns `[]`, the hotbar renders empty
slots, and casting logs "Chưa gán chiêu thức vào tay phải." instead of throwing.
Thiếu Lâm now owns one palm skill; the other three sects remain skill-less until
their kits land.

Two palm names from the old kit (`dai_tu_di_chuong`, `nhu_lai_than_thuong`) are
reused as palm skills in the new kit, but their old entries, icons and copy are
gone; they are re-authored with new art (row 1 of the supplied palm sheet for
Đại Tu Di Chưởng).

## 2. Target: Thiếu Lâm Chưởng Pháp

Keep the existing six-slot model (slots `0..5`, unlock levels `1 / 1 / 3 / 5 / 7 /
10`, server-authoritative MP/cooldown/range/damage). Replace the TLQ identity
(fist, kick, claw) with a **palm (掌)** identity: every active skill is a hand
strike, VFX uses the palm pose, and the two non-strike slots are buffs: an
offensive formation and a defensive internal art.

Names are taken from the VLTK2 Thiếu Lâm Võ Tông tree where a canonical palm/hand
name exists (`Vi Đà Chưởng`, `Đại Tu Di Chưởng`, `La Hán Trận`,
`Kim Cang Bất Hoại`, `Như Lai Thần Thưởng`). Slot 0 is the entry palm, adapted
from the entry move so new characters have a 1 MP-cheap opener.

| Slot | Skill | Id | Lvl | MP | CD (ms) | Target | Effect | VFX cast / impact | Provenance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | La Hán Chưởng | `la_han_chuong` | 1 | 5 | 1500 | enemy r85 | — | palm / spark | adapted from La Hán Quyền |
| 1 | Vi Đà Chưởng | `vi_da_chuong` | 1 | 7 | 4000 | enemy r95 | slow 30% / 2s | palm / dust | VLTK2 (Vi Đà Chưởng) |
| 2 | Đại Tu Di Chưởng | `dai_tu_di_chuong` | 3* | 12 | 6000 | enemy r6000 (ranged, reaches camera edge) | stun 800ms (mult 1.3) | sprite row 1 flies to target / burst | VLTK2 |
| 3 | La Hán Trận | `la_han_tran` | 5* | 18 | 9000 | self | **buff** `attackPct` 0.10 + `speedPct` 0.20 + `critRate` 0.05, 180s | sprite row 2 (formation) / — | VLTK2 |
| 4 | Kim Cang Bất Hoại | `kim_cang_bat_hoai` | 7 | 15 | 15000 | self | **buff** `defensePct` 0.25, 8s | aura / — | VLTK2 |
| 5 | Như Lai Thần Thưởng | `nhu_lai_than_thuong` | 10 | 35 | 30000 | enemy, AoE r140 | stun 1200ms (mult 2.4) | shockwave / burst | VLTK2 |

Design rules:

- `*` Đại Tu Di Chưởng currently ships with `unlockLevel: 1` because it is the
  only authored palm skill; restore it to 3 once slots 0–1 land.
- Known limitation: damage/stun resolve at cast time, while the projectile can
  arrive up to 1.2 s later. Delaying the authoritative hit needs a projectile
  lifecycle/impact-time model; keep that as a separate change.
- Đại Tu Di Chưởng is a ranged single-target strike (`radius: 0`, `range: 6000`,
  a max that comfortably covers the visible camera edge). The client caps the
  effective range at the camera's half-diagonal (`screenCastRange`) so it never
  auto-targets wolves outside the viewport; the server keeps 6000 as the hard
  cap. With no target, the projectile flies to the camera edge in the facing
  direction and its travel time scales with distance (220–1200 ms):
  the palm flies to the target and stuns it. Do not add a caster-centred radius
  or `skillReach` will drop back to the radius and the cast will require melee
  distance.

- All damaging palm skills use `target: "enemy"`, including AoE ones: a cast with
  `radius > 0` is resolved as an area centred on the caster by `resolveTargets()`.
  Setting `target: "self"` would short-circuit to self buffs and skip damage.
- Slots 3 and 4 are self buffs; both keep the existing `buff` effect kind, so no
  server change is needed. La Hán Trận is the offensive formation
  (`attackPct` + `critRate`); Kim Cang Bất Hoại is the defensive art
  (`defensePct`).
- A real party-wide formation would need an ally-buff model; this rebuild keeps
  both buffs self-only and treats party sharing as later engine work.
- Do not introduce a new effect kind (poison/DoT/lifesteal) in this rebuild.
- Keep `mult` on the same scale as the removed kit so balance stays comparable.
- `BASIC_ATTACK_ID` (`normal`) remains the fallback for unknown ids.

## 3. Icons and VFX art

The palm-art sheet supplies one row per skill. **Row 1 is assigned to Đại Tu Di
Chưởng.** It ships as a 64×64 PNG icon plus a four-frame animated VFX:

- Icon: `public/skills/dai_tu_di_chuong.png` (derived from the clean entry palm
  in row 1, background keyed out, 64×64 RGBA).
- Frames: `public/skills/vfx/dai_tu_di_chuong/frame-1..4.png` (256×256 RGBA),
  plus `sheet.png` and `sheet.json` (`frameWidth/Height: 256`, `fps: 12`).
- The source Gemini sheet has the checkerboard baked into the pixels; the export
  above keys out neutral greys and trims the leftover rim. If a transparent
  source is available later, regenerate the frames from it without changing paths.
- Catalog `icon` points to `/skills/dai_tu_di_chuong.png`.
- The remaining five skills start with glyph fallbacks; assign rows 2–4 of the
  sheet when their art direction is confirmed (row 2 is the spiral/beam set,
  rows 3–4 are impact variants).
- Verify no 404s in `npm run build` and in the running HUD.

## 4. VFX and rig animation

Two VFX tracks are needed:

### 4a. Sprite VFX for Đại Tu Di Chưởng

- Preload the sheet in `JiangHuScene.preload()` as
  `this.load.spritesheet("vfx-dai-tu-di-chuong", "/skills/vfx/dai_tu_di_chuong/sheet.png", { frameWidth: 256, frameHeight: 256 })`.
- In `playSkillCastVfx`, when `skill.vfx.sprite` is set, spawn the sprite at the
  caster and tween it toward the target, or to the camera edge in the facing
  direction when there is no target. Frames 0–1 loop as the travelling palm;
  frames 2+ play once on arrival as the impact. The tween lasts
  `clamp(distance/3, 220, 1200)` ms, and the impact frames use `vfx.fps`
  (default 12). Scale it from the texture's frame width using
  `vfx.size`/radius (not range, so long-range casts do not render huge), and
  destroy it when the impact completes (`vfx.scale` optional). Keep the vector pulse as the fallback if the texture
  or frames are missing.
- Catalog entry sets `vfx: { sprite: "vfx-dai-tu-di-chuong", cast: "shockwave",
  impact: null, color: 0xffb347, shake: 0.004 }`; the sprite's own impact frames
  provide the burst, so no second `burst` should fire at cast time. `fps` and
  `scale` are optional overrides.
- Start with normal alpha blending; if the glow looks flat, try
  `Phaser.BlendModes.ADD`. Verify the keyed edges do not show a grey box on the
  dark ground.

### 4b. Vector VFX for the rest of the kit

`heroRigView.attack()` already maps `shockwave → palm`. To make the kit read as
palm rather than sword:

1. Add a `palm` cast primitive to `src/game/skillVfx.js`: a forward palm blast
   (capsule/arc) aimed at the target, reusing the existing angle math.
2. Keep `shockwave` for AoE casts and the La Hán Trận formation ring; keep
   `aura` for Kim Cang Bất Hoại.
3. Impact: reuse `spark`, `dust`, `burst`; no new impact primitive required.
4. Add `palm` to the `heroRigView` cast map so it resolves to the palm pose.
5. No `slash` or `kick` may remain in the Thiếu Lâm catalog.

## 5. Files to touch

| Layer | File | Change |
| --- | --- | --- |
| Catalog | `src/game/skills.js` | Populate `THIEU_LAM_SKILLS` with the six palm skills; ids/slots as above |
| i18n | `src/i18n/locales/{vi,en,zh}.js` | Re-add `skills.thieuLam.<camelId>.{name,desc}` for all six |
| Icons | `public/skills/dai_tu_di_chuong.png` | 64×64 icon derived from row 1 |
| VFX art | `public/skills/vfx/dai_tu_di_chuong/*` | Four 256×256 frames + sheet + json |
| VFX | `src/game/skillVfx.js` | `palm` primitive + sprite playback |
| Scene | `src/game/game.js` | Preload the Đại Tu Di Chưởng spritesheet |
| Rig | `src/game/heroRigView.js` | Map `palm` cast to the palm pose |
| HUD | `src/components/HUD/HotbarDock.jsx` | Already switched to `SkillIcon` so slots render a glyph when `icon` is absent |
| Client tests | `src/game/skills.test.js` | Restore six-slot invariants for Thiếu Lâm |
| Client tests | `src/game/skillDamage.test.js` | Add one damage + one effect case per new skill |
| Server tests | `server/tests/websocket.test.js` | Remove `SKIP_NO_KIT`; use palm ids for MP/damage authority |
| Docs | `docs/plan/sect-skills.md` | Keep cross-reference; Thiếu Lâm no longer empty |

Do **not** touch sect ids, gender rules, character DB defaults, or the loadout
schema. `thieu-lam` stays the default sect; saved loadouts `{left,right}` remain
valid because slot numbers are stable.

## 6. Testing and definition of done

- **Catalog invariants**: `skillsForSect("thieu-lam")` has six entries, slots
  `0..5` unique, every `unlockLevel` in `{1,3,5,7,10}`, ids unique across all
  sects, every `icon` file exists.
- **i18n**: every `nameKey`/`descKey` resolves in `vi`, `en`, and `zh`.
- **Damage/effects**: one test for a plain strike, one for slow, one for AoE
  stun, one for the offensive formation buff, one for the defensive buff, one for
  the ultimate.
- **Server**: MP cost, cooldown, range rejection, recomputed damage, and
  per-cast hit cap all re-enabled (remove the temporary skip).
- **Manual**: pick each hand skill, cast on a wolf from each direction, confirm
  the palm pose, the Đại Tu Di Chưởng four-frame animation (no grey checker
  box), VFX colour, cooldown overlay, and no leftover TLQ name/icon.
- `npx vitest run`, `npm --prefix server test`, `npm run build` all green.

## 7. Delivery order

| Phase | Content | Exit criteria |
| --- | --- | --- |
| P1 | Remaining catalog entries + i18n (glyphs for slots 0, 1, 3, 4, 5) | Six slots castable; full-kit server tests un-skipped |
| P2 | Đại Tu Di Chưởng icon + sprite sheet, glyph fallbacks elsewhere | No missing assets; HUD renders the icon |
| P3 | `palm` vector VFX, sprite playback, rig mapping | No `slash`/`kick` in the Thiếu Lâm kit |
| P4 | Balance pass + manual playtest | MP/CD/mult tuned against wolves |

Each phase is independently shippable and keeps the other three sects untouched.

## 8. Open decisions

1. La Hán Trận: **resolved** — stays self-only (buffs only the caster, no party-wide sharing, and restricted from Left Hand).
2. Kim Cang Bất Hoại: keep it as pure `defensePct`, or add a small
   `heal`/`pctMaxHp` component so the defensive art also restores HP?
3. Is the official spelling `Như Lai Thần Thưởng` (current VLTK2 copy) or
   `Như Lai Thần Chưởng` preferred for the rebuilt kit?
