/**
 * On-demand spritesheets.
 *
 * `preload()` used to download every heavy sheet before the world could start:
 * both hero walk sheets and every skill VFX (~1.6 MB of VFX alone), even though
 * a session only ever needs the active character's gender and the VFX of its own
 * sect. These helpers queue a sheet on the running scene loader the first time
 * something actually asks for it.
 *
 * Callers already guard with `textures.exists()`, so a sheet that is still
 * downloading degrades to "no effect this frame" and starts working as soon as
 * the load completes. Phaser's loader dedupes by texture key, so calling these
 * repeatedly (for example every frame from `showFormation`) is safe.
 */

import { HERO_BODY, HERO_BODY_TEXTURES, equipmentTextureDef } from "./heroBody.js";
import { normalizeGender } from "./gender.js";

/**
 * Skill VFX sprite sheets. A session downloads only the sheets its own sect can
 * cast (see `ensureSectVfx`), plus any sheet a remote player asks for mid-fight.
 */
export const VFX_SPRITES = {
  "vfx-la-han-tran": {
    url: "/skills/vfx/la_han_tran/sheet.png",
    frameWidth: 256,
    frameHeight: 256
  },
  "vfx-dai-tu-di-chuong": {
    url: "/skills/vfx/dai_tu_di_chuong/sheet.png",
    frameWidth: 256,
    frameHeight: 256
  }
};

/**
 * Add a spritesheet to the scene loader without starting it. Starting is a
 * separate step so a batch of sheets can be queued and downloaded together.
 * @param {import("phaser").Scene} scene
 * @param {string} key Phaser texture key
 * @param {{ url: string, frameWidth: number, frameHeight: number }} [def]
 * @returns {"ready"|"queued"|"unavailable"}
 */
function queueSpritesheet(scene, key, def) {
  if (!key || !def) return "unavailable";
  if (typeof scene?.textures?.exists !== "function") return "unavailable";
  if (scene.textures.exists(key)) return "ready";
  if (typeof scene.load?.spritesheet !== "function" || typeof scene.load.start !== "function") {
    return "unavailable";
  }

  scene.load.spritesheet(key, def.url, {
    frameWidth: def.frameWidth,
    frameHeight: def.frameHeight
  });
  return "queued";
}

/**
 * Queue a spritesheet on the scene loader unless it is already available.
 * @param {import("phaser").Scene} scene
 * @param {string} key Phaser texture key
 * @param {{ url: string, frameWidth: number, frameHeight: number }} [def]
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureSpritesheet(scene, key, def) {
  const state = queueSpritesheet(scene, key, def);
  if (state === "queued") scene.load.start();
  return state === "ready";
}

/**
 * Queue one skill-VFX sheet.
 * @param {import("phaser").Scene} scene
 * @param {string} key
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureVfxTexture(scene, key) {
  return ensureSpritesheet(scene, key, VFX_SPRITES[key]);
}

/**
 * Queue every VFX sheet a sect can cast, so the first cast already has art.
 * All sheets go out in one loader batch; sects without sprite VFX queue nothing.
 * @param {import("phaser").Scene} scene
 * @param {Object[]} [skills]
 * @returns {boolean} `true` when every sheet is usable right now
 */
export function ensureSectVfx(scene, skills = []) {
  let allReady = true;
  let queued = false;
  for (const skill of skills) {
    const sprite = skill?.vfx?.sprite;
    if (!sprite) continue;
    const state = queueSpritesheet(scene, sprite, VFX_SPRITES[sprite]);
    if (state === "queued") queued = true;
    if (state !== "ready") allReady = false;
  }
  if (queued) scene.load.start();
  return allReady;
}

/**
 * Queue the walk sheet for a gender that was not the one loaded at boot.
 * @param {import("phaser").Scene} scene
 * @param {"male"|"female"|string} gender
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureHeroBodyTexture(scene, gender) {
  const def = HERO_BODY_TEXTURES[normalizeGender(gender)];
  if (!def) return false;
  return ensureSpritesheet(scene, def.key, {
    url: def.url,
    frameWidth: HERO_BODY.frameWidth,
    frameHeight: HERO_BODY.frameHeight
  });
}

/**
 * Queue an equipment spritesheet on demand unless it is already usable.
 * @param {import("phaser").Scene} scene
 * @param {string} slot - Equipment slot ("helmet", "armor", etc.)
 * @param {string} itemId - Item ID ("non-truc", "ao-lang-khach", etc.)
 * @param {"male"|"female"|string} [gender="male"]
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureEquipmentTexture(scene, slot, itemId, gender = "male") {
  const def = equipmentTextureDef(slot, itemId, gender);
  if (!def) return false;
  return ensureSpritesheet(scene, def.key, {
    url: def.url,
    frameWidth: HERO_BODY.frameWidth,
    frameHeight: HERO_BODY.frameHeight
  });
}
