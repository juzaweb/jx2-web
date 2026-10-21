# Thiếu Lâm chưởng pháp — rebuild plan

Status: **in progress**. The old Thiếu Lâm Võ Tông (TLQ) kit has been removed and
the sect currently has no authored skills. This document plans the palm-technique
kit that replaces it.

## 1. What was removed (done)

TLQ was the fist/kick kit of Thiếu Lâm Võ Tông in VLTK2. The following were
deleted so nothing from that kit survives in the client, server, or assets:

| Item | Where | State |
| --- | --- | --- |
| 6 skill icons (`la_han_quyen`, `ca_diep_thoai`, `vi_da_quyen`, `dai_tu_di_chuong`, `hue_nhan_chu`, `nhu_lai_than_thuong`) | `public/skills/*.png` | deleted |
| 6 catalog entries | `src/game/skills.js` (`THIEU_LAM_SKILLS`) | now `[]` |
| VI/EN/ZH names + descriptions | `src/i18n/locales/{vi,en,zh}.js` (`skills.thieuLam`) | deleted |
| Catalog assertions on TLQ ids | `src/game/skills.test.js`, `src/game/skillDamage.test.js` | rewritten to use ad-hoc fixtures |
| Server skill-cost/damage assertions that require a live catalog | `server/tests/websocket.test.js` | skipped with `SKIP_NO_KIT`, must be re-enabled in P1 |

The game stays safe with an empty kit: `skillsForSect()` returns `[]`, the hotbar
renders empty slots, and casting logs "Chưa gán chiêu thức vào tay phải." instead
of throwing. Everyone (including Thiếu Lâm) is temporarily skill-less until P1.

Two palm names from the old kit (`dai_tu_di_chuong`, `nhu_lai_than_thuong`) are
reused as palm skills in the new kit, but their old entries, icons and copy are
gone; they will be re-authored from scratch with new SVG art.

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
| 2 | Đại Tu Di Chưởng | `dai_tu_di_chuong` | 3 | 12 | 6000 | enemy, AoE r110 | stun 800ms (mult 1.3) | shockwave / burst | VLTK2 |
| 3 | La Hán Trận | `la_han_tran` | 5 | 18 | 9000 | self | **buff** `attackPct` 0.15 + `critRate` 0.05, 8s | shockwave (formation) / — | VLTK2 |
| 4 | Kim Cang Bất Hoại | `kim_cang_bat_hoai` | 7 | 15 | 15000 | self | **buff** `defensePct` 0.25, 8s | aura / — | VLTK2 |
| 5 | Như Lai Thần Thưởng | `nhu_lai_than_thuong` | 10 | 35 | 30000 | enemy, AoE r140 | stun 1200ms (mult 2.4) | shockwave / burst | VLTK2 |

Design rules:

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

## 3. Icons (self-authored)

No CDN or copyrighted art. Ship six hand-authored SVG icons:

- Path: `public/skills/<skill_id>.svg`, 64×64 viewBox, transparent background.
- Style: ink-black strokes + HUD gold (`#d9b25f`) accents, one palm/finger mark
  per icon, readable at 28–34 px.
- Catalog `icon` points to `/skills/<skill_id>.svg`; `SkillIcon` and the hotbar
  `<img>` both render SVG natively, so no raster build step is needed.
- Pixel/raster assets are intentionally not used, keeping the kit dependency-free.
- Verify no 404s in `npm run build` and in the running HUD.

If SVG proves too plain, a later pass may export 2× PNGs from the same artwork;
do not change the ids.

## 4. VFX and rig animation

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
| Icons | `public/skills/*.svg` | Six new files |
| VFX | `src/game/skillVfx.js` | `palm` cast primitive |
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
  palm pose, VFX colour, cooldown overlay, and no leftover TLQ name/icon.
- `npx vitest run`, `npm --prefix server test`, `npm run build` all green.

## 7. Delivery order

| Phase | Content | Exit criteria |
| --- | --- | --- |
| P1 | Catalog + i18n using glyphs only (`icon` omitted) | Six slots castable; server tests un-skipped |
| P2 | Six SVG icons + `icon` paths | No missing assets; HUD renders images |
| P3 | `palm` VFX + rig mapping | No `slash`/`kick` in the Thiếu Lâm kit |
| P4 | Balance pass + manual playtest | MP/CD/mult tuned against wolves |

Each phase is independently shippable and keeps the other three sects untouched.

## 8. Open decisions

1. La Hán Trận: confirm it stays a self-only offensive buff, or invest in an
   ally-buff model so the formation also empowers nearby party members.
2. Kim Cang Bất Hoại: keep it as pure `defensePct`, or add a small
   `heal`/`pctMaxHp` component so the defensive art also restores HP?
3. Is the official spelling `Như Lai Thần Thưởng` (current VLTK2 copy) or
   `Như Lai Thần Chưởng` preferred for the rebuilt kit?
