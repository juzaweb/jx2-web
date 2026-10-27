# Asset & delivery optimization — plan

Status: **phase 1–2 shipped**, phase 3–4 pending. Goal: cut what the browser has
to download and decode before the world is playable, without changing gameplay or
the rendered look.

Scope: client bundle (`vite.config.js`, `src/App.jsx`), Phaser scene loader
(`src/game/game.js`, `src/game/lazyAssets.js`), and the art shipped from
`public/`.

## 1. Baseline measurements

Recorded with `npm run build` and a production preview (`vite preview`) plus
`performance.getEntriesByType("resource")` in the browser.

| Metric | Before | After phase 1–2 | Target |
| --- | --- | --- | --- |
| JS shipped in the entry chunk | 1,642.76 kB (458 kB gzip) | 126.38 kB app + 218.75 kB react | ≤ 350 kB raw combined |
| Largest JS chunk | 1,642.76 kB | 1,196.46 kB (`phaser`, lazy) | unchanged (engine floor) |
| Engine chunk blocking first paint | yes | no (behind `React.lazy`) | no |
| Image bytes fetched before the world runs | ~6.0 MB | ~2.7 MB | ≤ 3 MB |
| Skill VFX fetched on boot | 1.56 MB (always) | 0 for a session without a weapon; weapon sheets only | per-weapon only |
| Hero walk sheets fetched on boot | both genders (456 kB) | active gender only (228 kB) | 1 sheet |

Phaser is resolved from `dist/phaser.esm.js`: **one pre-bundled ES module**
(~1.2 MB min). It cannot be split into smaller chunks, and `phaser/src` is
CommonJS (`module.exports` + `global.Phaser`), so source-level tree-shaking is not
an option. A ~1.2 MB engine chunk is the accepted floor for this app.

## 2. Phase 1 — chunk splitting (done)

Files: `vite.config.js`, `src/App.jsx`.

- Rolldown `advancedChunks` groups split `phaser`, `react` and `vendor`
  (Vite 8 uses Rolldown; `manualChunks` is not the right knob here).
- `GameCanvas` is loaded through `React.lazy` + `<Suspense>` with a
  size-neutral fallback `<div>` (same absolute box, `#0f0b08`), so the login UI
  never waits for the engine.
- `chunkSizeWarningLimit: 1400` exists only because the single engine chunk
  exceeds the default 500 kB; do not raise it further.
- Lazy mounting is behaviourally safe: `game.js` re-seeds name, gender, weapon
  kit, quick slots and skill loadout from `readSession()` + `StorageManager` inside
  `create()`, and `App` re-emits `SET_PLAYER_NAME` on `GAME_STARTED`. Bridge
  events emitted before the scene mounts are not replayed, so **any new
  `React → Phaser` event must be derived from storage or re-emitted**, not
  assumed to arrive once.

## 3. Phase 2 — on-demand textures (done)

Files: `src/game/lazyAssets.js` (new), `game.js`, `skillVfx.js`, `player.js`,
`remotePlayer.js`.

Rules implemented:

- `preload()` loads only the active character's walk sheet. The other gender is
  queued by `ensureHeroBodyTexture()` on `SET_PLAYER_GENDER`; the change is
  applied on the loader's `complete` event, so the hero keeps its current look
  until the sheet arrives.
- Skill VFX are **not** preloaded. `ensureWeaponVfx(scene, skillsForWeapon(weapon))`
  runs in `handleEquipmentSync` and on `SET_PLAYER_WEAPON`, only when a weapon is
  equipped, and queues every sheet in a single loader batch.
- Per-use fallbacks (`playSkillCastVfx`, `Player.showFormation`,
  `RemotePlayer.showFormation`) call `ensureVfxTexture()`; every consumer already
  bails out when `textures.exists()` is false, so a sheet in flight simply skips
  its visual for that frame and appears once loaded.
- The loader dedupes by texture key, so repeated calls (formation retries every
  frame) are free.

Follow-up (not blocking): VFX are only fetched once a weapon is equipped. Joins
back-fill the starter sword and publish `equipment_sync`, so a character always
has a weapon kit; a guest world without a weapon simply casts nothing.

## 4. Phase 3 — reduce image weight (pending, needs art review)

### 4.1 Why the art is heavy

| Asset | Size | Format / dimensions | Cause |
| --- | --- | --- | --- |
| `public/skills/vfx/la_han_tran/sheet.png` | 1.24 MB | PNG RGBA 1024×1024 (16× 256²) | lossless PNG of soft glow + full alpha; 4 MB VRAM |
| `public/skills/vfx/dai_tu_di_chuong/sheet.png` | 316 kB | PNG RGBA 1024×256 (4× 256²) | mostly transparent padding |
| `public/tap-hoa.png` | 586 kB | PNG RGBA 727×432 | 586 kB for 727×432 is far above what PNG should produce |
| `public/duoc-diem.png` | 526 kB | PNG RGBA 714×422 | same |
| `public/npc-duoc.png` | 254 kB | PNG colormap 2800×520 (7 frames) | already palette-quantized, acceptable |
| `public/hero-body-male.png` / `-female.png` | 238 kB / 228 kB | PNG RGBA 512×640 (4×4 frames) | lossless |
| `public/gach-tile.webp` | 499 kB | WebP VP8 **2752×1536** | **17 MB VRAM** for a repeating tile |
| `public/gach-seamless.webp` | 202 kB | WebP **5504×420** | **9 MB VRAM** for a repeating tile |

Root causes, in order of impact: (1) oversized source dimensions, (2) lossless
PNG for art with gradients and alpha, (3) no atlas trimming (each VFX frame
reserves the full 256² even when mostly empty).

### 4.2 Tasks

- [ ] **P3.1 WebP conversion (lossy q90, alpha preserved)**
  - VFX sheets, shop buildings, hero walk sheets, NPC sheet.
  - Update references: `lazyAssets.js` (`VFX_SPRITES`), `marketBuildings.js`
    (`SHOP_BUILDINGS.url`), `heroBody.js` (`HERO_BODY_TEXTURES`,
    `HERO_PREVIEW_ART`), `npc.js` (`NPC_DUOC.url`).
  - Bump `BODY_ASSET_VERSION` in `heroBody.js` so clients drop cached PNGs.
  - Keep the PNG originals until the WebP is visually approved.
  - Expected (estimate, to be measured): VFX 1.56 MB → 250–400 kB; buildings
    1.11 MB → ~200 kB; hero sheets 456 kB → ~150 kB.
- [ ] **P3.2 Trim VFX atlases**
  - Re-pack each sheet with `la_han_tran/sheet.json` as metadata; shrink frames
    to their content box and regenerate `sheet.png` + `frameWidth/frameHeight`
    in `VFX_SPRITES` (consumers read frame size from the texture, so only the
    loader config changes).
  - Expected: 40–60 % less texture area, which also cuts VRAM.
- [ ] **P3.3 Downscale ground tiles**
  - `gach-tile.webp` → ~1024×576, `gach-seamless.webp` → ~2048×156. Both are
    used through `tileSprite`, so on-screen scale is unchanged but VRAM drops
    from ~26 MB to ~5 MB.
  - Verify by screenshotting the plaza and the walkway at several camera
    positions before/after.
- [ ] **P3.4 Optional: Phaser custom build**
  - The catalog only uses `Phaser.Scene`, `Phaser.Game`, `Phaser.Math`,
    `Phaser.Scale`, `Phaser.AUTO` and arcade physics. A custom Phaser build
    without Spine, 3D camera and Facebook Instant would cut the engine chunk.
  - This is a dependency-level change and needs an explicit decision; skip until
    phase 3.1–3.3 has been measured.

### 4.3 Acceptance criteria

- Initial image transfer ≤ 1.2 MB for a logged-in character (currently ~2.7 MB).
- Per-weapon VFX payload ≤ 400 kB.
- No visible quality regression on the plaza, walkway, both shops, NPC, hero in
  all 8 directions, and both VFX animations.
- `npm test` and `npm run build` stay green; build still prints no chunk warning.

## 5. Phase 4 — repository hygiene (pending)

These files ship in `public/` but are not requested by the runtime:

| File(s) | Size | Role |
| --- | --- | --- |
| `public/skills/vfx/*/frame-1..N.png` | ~1.5 MB | intermediate frames written by `scripts/build_skill_la_han_tran.py` |
| `public/hero-body-new.png` | 1.13 MB | source for `scripts/build_preview_art.py` |
| `public/hero-body-male2.png`, `public/hero-body-female2.png` | ~440 kB | not referenced anywhere |

- [ ] **P4.1** Move them to a non-served folder (e.g. `assets-src/`) and update the
  build scripts that read/write them.
- [ ] **P4.2** Add `netlify`/host-level ignore or delete the `*2.png` leftovers
  after confirming no design work depends on them.
- [ ] **P4.3** PWA: the default Workbox `globPatterns` only precaches
  `js/css/html`, so images rely on the HTTP cache. Decide whether to add a
  runtime cache rule for `/veg/`, the shop and hero art (offline play currently
  does not need them beyond what the HTTP cache holds).

## 6. Verification

```bash
npm test          # 79 files / 745 tests
npm run build     # expect no >500 kB warning, phaser chunk stays lazy
npm run dev       # manual visual check
```

Browser probe used for the measurements above (production preview):

```js
performance.getEntriesByType("resource")
  .map((r) => [r.name.replace(location.origin, ""), Math.round((r.transferSize || 0) / 1024)]);
```

Two traps that invalidated an early measurement:

1. The PWA service worker serves the **previous** build from precache. Unregister
   it and clear `caches` before measuring a fresh `dist`.
2. `vite preview` has no `/api` proxy, so a stored session fails backend
   validation, is cleared, and the app falls back to a guest world. Weapon-dependent
   measurements need `npm run dev` with the backend running.

## 7. Open questions

1. Are VFX ships allowed to become lossy WebP, or must the glows stay lossless?
2. Does the source art for the shop buildings exist at a higher resolution than
   727×432? If yes, re-export at 2× and downscale instead of upscaling.
3. Is a custom Phaser build acceptable as a dependency change?
