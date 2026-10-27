/**
 * On-demand spritesheets.
 *
 * `preload()` used to download every heavy sheet before the world could start:
 * both hero walk sheets and every skill VFX (~1.6 MB of VFX alone), even though
 * a session only ever needs the active character's gender and the VFX of its own
 * weapon kit. These helpers queue a sheet on the running scene loader the first time
 * something actually asks for it.
 *
 * Callers already guard with `textures.exists()`, so a sheet that is still
 * downloading degrades to "no effect this frame" and starts working as soon as
 * the load completes. Phaser's loader dedupes by texture key, so calling these
 * repeatedly (for example every frame from `showFormation`) is safe.
 */

import { HERO_BODY, HERO_BODY_TEXTURES, equipmentTextureDef, weaponBodyTextureDef } from "./heroBody.js";
import { normalizeGender } from "./gender.js";

/**
 * Skill VFX sprite sheets. A session downloads only the sheets its own weapon can
 * cast (see `ensureWeaponVfx`), plus any sheet a remote player asks for mid-fight.
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
  },
  "vfx-nhu-lai-than-chuong": {
    url: "/skills/vfx/nhu_lai_than_chuong/sheet.png",
    frameWidth: 256,
    frameHeight: 256
  }
};

/** Static images that hover above a buffed character (not sprite sheets). */
export const OVERHEAD_IMAGES = {
  "buff-phat-an": "/skills/kim_cang_bat_hoai.png"
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
 * Add a static image to the scene loader without starting it.
 * @param {import("phaser").Scene} scene
 * @param {string} key Phaser texture key
 * @param {string} [url]
 * @returns {"ready"|"queued"|"unavailable"}
 */
function queueImage(scene, key, url) {
  if (!key || !url) return "unavailable";
  if (typeof scene?.textures?.exists !== "function") return "unavailable";
  if (scene.textures.exists(key)) return "ready";
  if (typeof scene.load?.image !== "function" || typeof scene.load.start !== "function") {
    return "unavailable";
  }

  scene.load.image(key, url);
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
 * Queue the static overhead image for a buff (e.g. the 卍 seal of Kim Cang Bất Hoại).
 * @param {import("phaser").Scene} scene
 * @param {string} key
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureOverheadTexture(scene, key) {
  const state = queueImage(scene, key, OVERHEAD_IMAGES[key]);
  if (state === "queued") scene.load.start();
  return state === "ready";
}

/**
 * Queue every VFX sheet and overhead buff image a weapon kit can use, so the
 * first cast already has art. All assets go out in one loader batch; skills
 * without sprite/overhead art queue nothing.
 * @param {import("phaser").Scene} scene
 * @param {Object[]} [skills]
 * @returns {boolean} `true` when every asset is usable right now
 */
export function ensureWeaponVfx(scene, skills = []) {
  let allReady = true;
  let queued = false;
  for (const skill of skills) {
    const sprite = skill?.vfx?.sprite;
    if (sprite) {
      const state = queueSpritesheet(scene, sprite, VFX_SPRITES[sprite]);
      if (state === "queued") queued = true;
      if (state !== "ready") allReady = false;
    }

    const overhead = skill?.vfx?.overhead;
    if (overhead) {
      const state = queueImage(scene, overhead, OVERHEAD_IMAGES[overhead]);
      if (state === "queued") queued = true;
      if (state !== "ready") allReady = false;
    }
  }
  if (queued) scene.load.start();
  return allReady;
}

/**
 * Queue a body sheet (a gender sheet or one that already holds a weapon).
 * @param {import("phaser").Scene} scene
 * @param {{ url: string }} def
 * @returns {boolean} `true` when the texture is usable right now
 */
function queueBodySheet(scene, def) {
  if (!def) return false;
  return ensureSpritesheet(scene, def.key, {
    url: def.url,
    frameWidth: HERO_BODY.frameWidth,
    frameHeight: HERO_BODY.frameHeight
  });
}

/**
 * Queue the walk sheet for a gender that was not the one loaded at boot.
 * @param {import("phaser").Scene} scene
 * @param {"male"|"female"|string} gender
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureHeroBodyTexture(scene, gender) {
  return queueBodySheet(scene, HERO_BODY_TEXTURES[normalizeGender(gender)]);
}

/**
 * Queue the body sheet that already holds the worn weapon (see
 * WEAPON_BODY_TEXTURES). Weapons without their own sheet - every kit but the
 * sword for now - resolve to `null` and nothing is queued.
 * @param {import("phaser").Scene} scene
 * @param {"male"|"female"|string} gender
 * @param {string|null} [weaponType]
 * @returns {boolean} `true` when the texture is usable right now
 */
export function ensureWeaponBodyTexture(scene, gender, weaponType = null) {
  return queueBodySheet(scene, weaponBodyTextureDef(gender, weaponType));
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
