# Thiếu Lâm chưởng pháp — rebuild plan

Status: **in progress**. The old Thiếu Lâm Võ Tông (TLQ) kit has been removed.
The kit now has **five** skills in slots `0..4`: slot 0 is **Thiếu Lâm Tâm Pháp**
(`thieu_lam_tam_phap`), an always-on passive internal art that restores 2 HP per
second; slot 1 is **Đại Tu Di Chưởng** (icon + four-frame VFX), slot 2 **La Hán
Trận** (icon + four-frame formation VFX), slot 3 **Kim Cang Bất Hoại**, slot 4
**Như Lai Thần Chưởng** (icon + four-frame impact VFX).

La Hán Chưởng and Vi Đà Chưởng (the interim entry palms) were dropped, and the
remaining slots were renumbered so the kit has no gaps. Slots are cast by
binding a technique to a hotbar slot (drag from `F5`) or to a mobile arc button;
unknown saved bindings resolve to an empty slot instead of throwing.

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
slots, and casting logs "Môn phái này chưa có chiêu thức ở ô đó." instead of
throwing.
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
`Kim Cang Bất Hoại`, `Như Lai Thần Chưởng`). Slot 0 is the entry palm, adapted
from the entry move so new characters have a 1 MP-cheap opener.

| Slot | Skill | Id | Lvl | MP | CD (ms) | Target | Effect | VFX cast / impact | Provenance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Thiếu Lâm Tâm Pháp | `thieu_lam_tam_phap` | 1 | 0 | 0 | self | **passive** `regen` 2 HP/s, always on | none (never cast) | adapted for the new kit |
| 1 | Đại Tu Di Chưởng | `dai_tu_di_chuong` | 1 | 12 | 6000 | enemy r6000 (ranged, reaches camera edge) | stun 800ms (mult 1.3) | sprite row 1 flies to target / burst | VLTK2 |
| 2 | La Hán Trận | `la_han_tran` | 1 | 18 | 9000 | self | **buff** `attackPct` 0.10 + `speedPct` 0.20 + `critRate` 0.05, 180s | sprite row 2 (formation) / — | VLTK2 |
| 3 | Kim Cang Bất Hoại | `kim_cang_bat_hoai` | 1 | 20 | 18000 | self | **buff** `defensePct` 0.30, 30s | aura + 卍 overhead / — | VLTK2 |
| 4 | Như Lai Thần Chưởng | `nhu_lai_than_chuong` | 10 | 35 | 30000 | enemy r6000 (capped to camera), AoE r900 at impact | stun 1200ms (mult 2.4) | cast at hero / palm drops and blooms on impact | VLTK2 |

Design rules:

- **Thiếu Lâm Tâm Pháp is a passive, not a cast.** It carries no `mp`, no
  `cooldown` and no `vfx`; `passive: true` plus an
  `effects: [{ kind: "regen", hpPerSecond: 2 }]` entry is all the game loop
  needs. `combat.castSkill()` refuses it with a log line, passive arts are
  excluded from the `F5` drag sources and the mobile picker so they cannot be
  bound, and `passiveRegen.js` sums the unlocked
  passive arts of the sect every frame.
- The regen tick runs on the **server** (`tickRegen` in `gameSocket.js`) using
  the same `passiveRegen.js` maths, and streams `player_hp` on each whole HP
  point. The client no longer heals itself or reports heals, so HP stays
  server-authoritative and clamped to the server's own ceiling. Fractional HP is
  carried between ticks: 2 HP/s at a 250 ms tick heals 1 HP every 500 ms instead
  of being rounded away.
- Time spent paused is never billed. `billableDeltaMs()` drops any gap longer
  than `MAX_TICK_MS` (1 s), so opening a modal or backgrounding the tab cannot
  bank minutes of regen and refill the hero the moment play resumes.
- `maxHp` is **not** buffed: the ceiling is server-owned (derived from level), so
  a client-side max-HP buff would desync the health bar. A temporary max-HP
  component would need a server-side ceiling model first.
- Known limitation: damage/stun resolve at cast time, while the projectile or
  the Như Lai slam can land later (~0.45 s after the cast gesture plus 0.28 s
  drop). Delaying the authoritative hit needs a projectile lifecycle/impact-time
  model; keep that as a separate change.
- Đại Tu Di Chưởng is a ranged single-target strike (`radius: 0`, `range: 6000`,
  a max that comfortably covers the visible camera edge). The client caps the
  effective range at the camera's half-diagonal (`screenCastRange`) so it never
  auto-targets wolves outside the viewport; the server keeps 6000 as the hard
  cap. With no target, the projectile flies to the camera edge in the facing
  direction and its travel time scales with distance (220–1200 ms):
  the palm flies to the target and stuns it. Do not add a caster-centred radius
  or `skillReach` will drop back to the radius and the cast will require melee
  distance.

- All damaging palm skills use `target: "enemy"`, including AoE ones. A cast
  with `radius > 0` resolves its area around the chosen impact point (clicked
  target, cursor, or the hero when there is neither), not around the caster:
  `resolveCastCenter()` clamps that point to the skill's `range` and
  `resolveTargets()` filters enemies around it. `skillReach()` therefore uses
  `range` when present and only falls back to `radius` for radius-only skills.
  Setting `target: "self"` would short-circuit to self buffs and skip damage.
- Slots 2 and 3 are self buffs; both keep the existing `buff` effect kind, so no
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
- Thiếu Lâm Tâm Pháp ships as `public/skills/thieu_lam_tam_phap.png`, a 128×128
  RGBA icon built from the supplied `docs/example/thieu-lam.png` illustration
  (full-bleed art, so it is a centred square crop rather than a keyed emblem) by
  `python3 scripts/build_skill_thieu_lam_tam_phap.py`. It has no VFX of its own:
  the art is always on, so an aura would misrepresent a permanent state.
- La Hán Trận and Kim Cang Bất Hoại keep their own icons; no interim glyph or
  emblem slots remain in the kit.
- Như Lai Thần Chưởng ships as `public/skills/nhu_lai_than_chuong.png` (64×64
  icon, frame 1) and `public/skills/vfx/nhu_lai_than_chuong/`
  (`frame-1..4.png`, `sheet.png` 1024×256, `sheet.json` fps 12), generated from
  `docs/example/nhu-lai-than-chuong.png` with
  `python3 scripts/build_skill_nhu_lai_than_chuong.py`. The four panels are
  normalised to one scale, and the baked cream backdrop on panels 2–4 is
  feathered at the straight cut edges so no beige rectangle shows on the dark
  ground.
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

### 4a-bis. Sprite VFX for Như Lai Thần Chưởng

- `lazyAssets.js` registers `vfx-nhu-lai-than-chuong` (256×256, same sheet
  contract as Đại Tu Di Chưởng), so `ensureSectVfx` downloads it with the rest of
  the Thiếu Lâm sheets.
- Frames 0–1 play once at the hero as the cast gesture at `castScale` (40% of
  the impact size). Frames 2–3 then drop from above onto the strike area at full
  size (`type: "slam"`): frame 2 falls with the arm and frame 3 lands as the
  ground impact, blooming to 150% before a short fade. The drop is delayed until
  the cast gesture finishes so the two beats read separately.
- The catalog sets `size: 800`, `castScale: 0.4`, `impactScale: 1.5` and
  `type: "slam"`. The cast gesture stays small, the falling/landing palm uses the
  full size, and the landing frame starts at 85% of the impact scale and blooms
  to 150% over 140ms, so the ground palm visibly grows to cover the r900 AoE.
  `dropHeight`/`dropDuration` are optional overrides (default
  `max(140, size*0.8)` and 280ms).
- `impact: null` on purpose: damage resolves at cast time, so an extra burst
  would fire before the palm lands. The landing frames carry the hit.
- The client sends the resolved impact centre (`aimX`/`aimY`) with the cast.
  The server clamps it to the skill range from its own player position, stores
  it on `lastCast`, and validates every AoE `enemy_hit` against that centre
  (±40 units). A forged hit far from the palm is dropped even when it is inside
  the nominal 6000 cast range.

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
| Catalog | `src/game/skills.js` | `THIEU_LAM_SKILLS` = Tâm Pháp (slot 0, passive) + four palm skills in slots 1-4 |
| Regen | `src/game/passiveRegen.js` | `regenPerSecond`, `passiveRegenRate`, `advanceRegen` (pure, shared maths) |
| Combat | `src/game/combat.js` | `updatePassiveRegen` tick + `castSkill` refusal for passive arts |
| i18n | `src/i18n/locales/{vi,en,zh}.js` | `skills.thieuLam.<camelId>.{name,desc}` for all five + `skills.passiveTag` / `skills.regenTag` |
| Icons | `public/skills/thieu_lam_tam_phap.png` | 128×128 icon derived from `docs/example/thieu-lam.png` |
| Icons | `public/skills/dai_tu_di_chuong.png` | 64×64 icon derived from row 1 |
| VFX art | `public/skills/vfx/dai_tu_di_chuong/*` | Four 256×256 frames + sheet + json |
| VFX art | `public/skills/nhu_lai_than_chuong.png` | 64×64 icon derived from the Như Lai sheet |
| VFX art | `public/skills/vfx/nhu_lai_than_chuong/*` | Four 256×256 frames + sheet + json |
| Icon tooling | `scripts/build_skill_thieu_lam_tam_phap.py` | Square-crop and resize the supplied art |
| VFX tooling | `scripts/build_skill_nhu_lai_than_chuong.py` | Extract, normalise and feather the Như Lai sheet |
| VFX | `src/game/skillVfx.js` | `palm` primitive + sprite playback |
| Scene | `src/game/game.js` | Preload the Đại Tu Di Chưởng spritesheet |
| Rig | `src/game/heroRigView.js` | Map `palm` cast to the palm pose |
| HUD | `src/components/HUD/HotbarDock.jsx` | Already switched to `SkillIcon` so slots render a glyph when `icon` is absent |
| Modal | `src/components/Modals/SkillsModal.jsx` | Show `skills.passiveTag` / `skills.regenTag` instead of an MP cost for a passive |
| Client tests | `src/game/skills.test.js` | Five-slot invariants for Thiếu Lâm; passive entry assertions |
| Client tests | `src/game/passiveRegen.test.js` | Rate sum, level gate and fraction-carry coverage |
| Client tests | `src/game/combat.test.js` | Passive regen tick, no-regen sects, ceiling clamp, cast refusal |
| Client tests | `src/game/skillDamage.test.js` | Add one damage + one effect case per new skill |
| Server | `server/src/websocket/gameSocket.js` | Store the cast impact centre and validate AoE hits around it |
| Server tests | `server/tests/websocket.test.js` | Remove `SKIP_NO_KIT`; use the new kit ids for MP/damage authority; cover AoE-centre rejection |
| Docs | `docs/plan/sect-skills.md` | Keep cross-reference; Thiếu Lâm no longer empty |

Do **not** touch sect ids, gender rules, character DB defaults, or the loadout
schema. `thieu-lam` stays the default sect; saved loadouts `{left,right}` are
repaired on mount when a slot no longer exists in the kit.

## 6. Testing and definition of done

- **Catalog invariants**: `skillsForSect("thieu-lam")` has five entries, slots
  `0..4` unique, ids unique across all sects, every `icon` file exists, and
  exactly one skill is `passive`.
- **i18n**: every `nameKey`/`descKey` resolves in `vi`, `en`, and `zh`.
- **Regen**: `passiveRegenRate("thieu-lam", 1) === 2`, an unlocked-gate case,
  and the fraction-carry cadence (2 HP/s → 1 HP per 500 ms).
- **Damage/effects**: one test for an AoE stun, one for the offensive formation
  buff, one for the defensive buff, one for the ultimate.
- **Server**: MP cost, cooldown, range rejection, recomputed damage, and
  per-cast hit cap all re-enabled (the temporary skip is gone).
- **Manual**: pick each hand skill, cast on a wolf from each direction, confirm
  the palm pose, the Đại Tu Di Chưởng four-frame animation (no grey checker
  box), VFX colour, cooldown overlay, and no leftover TLQ name/icon.
- `npx vitest run`, `npm --prefix server test`, `npm run build` all green.

## 7. Delivery order

| Phase | Content | Exit criteria |
| --- | --- | --- |
| P1 | Five catalog entries + i18n + renumbered slots | Five slots castable; passive regen live; full-kit server tests un-skipped |
| P2 | Tâm Pháp icon, Đại Tu Di Chưởng icon + sprite sheet | No missing assets; HUD renders every icon |
| P3 | `palm` vector VFX, sprite playback, rig mapping | No `slash`/`kick` in the Thiếu Lâm kit |
| P4 | Balance pass + manual playtest | HP/s, MP/CD/mult tuned against wolves |

Each phase is independently shippable and keeps the other three sects untouched.

## 8. Open decisions

1. La Hán Trận: **resolved** — stays self-only (buffs only the caster, no party-wide sharing, and restricted from Left Hand).
2. Kim Cang Bất Hoại: keep it as pure `defensePct`, or add a small
   `heal`/`pctMaxHp` component so the defensive art also restores HP?
3. Spelling: **resolved** — the rebuilt kit uses `Như Lai Thần Chưởng` /
   `nhu_lai_than_chuong`, matching the supplied art. The old
   `nhu_lai_than_thuong` id is gone from the client catalog and server tests.
4. Thiếu Lâm Tâm Pháp: **resolved** — passive and always on, free of MP, heals a
   flat 2 HP/s and does not raise the HP ceiling. A `maxHp` buff is deferred
   until the server owns a buffable ceiling; a party-wide or toggleable variant
   would need the same engine work as the formation.
