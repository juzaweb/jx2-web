/**
 * Friendly NPC display definitions and sprite factory.
 *
 * The shopkeeper sheet (`npc-duoc`) and the temporary citizen sheet
 * (`npc-citizen`, drawn by `scripts/build_npc_citizen.py`) share one frame
 * geometry, so a map definition only needs `sprite: "npc-citizen"` plus an
 * optional `tint` to pick a look. Both are a single row of front-facing poses
 * played as a slow idle loop.
 */
import { WORLD_SCALE } from "./worldConfig.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { NPC_INTERACT_RANGE, isInTalkRange, isPointOnNpc, npcApproachPoint } from "./npcRange.js";

const S = WORLD_SCALE;

/** Pixel geometry shared by every NPC sheet. */
export const NPC_FRAME = Object.freeze({
  frameWidth: 280,
  frameHeight: 520,
  bottomMargin: 10,
  contentHeight: 480,
  /** Rendered height in rig units; close to the hero's 92.5. */
  heightUnits: 88,
  /** Name tag floating offset in rig units so it clears the head. */
  nameOffsetUnits: 102
});

/** Herb-shop NPC ("Dược Sư"). */
export const NPC_DUOC = {
  textureKey: "npc-duoc",
  url: "/npc-duoc.png",
  ...NPC_FRAME,
  /** Front-facing poses only; the back views stay unused in the sheet. */
  idleFrames: [0, 1, 2, 3, 2, 1],
  idleFrameRate: 2
};

export const NPC_DUOC_ANIM = "npc-duoc-idle";

/**
 * Temporary citizen sheet, generated procedurally until real art is available.
 * Four frames, same 280x520 geometry; per-NPC tint gives each role its colours.
 */
export const NPC_CITIZEN = {
  textureKey: "npc-citizen",
  url: "/npc-citizen.png",
  ...NPC_FRAME,
  idleFrames: [0, 1, 2, 3, 2, 1],
  idleFrameRate: 2
};

/** Sprite sheets a map NPC may reference by `def.sprite`. */
export const NPC_SPRITES = Object.freeze({
  "npc-duoc": NPC_DUOC,
  "npc-citizen": NPC_CITIZEN
});

export { NPC_INTERACT_RANGE, isInTalkRange, isPointOnNpc, npcApproachPoint };

/**
 * Sprite scale inside a rig-space container (WORLD_SCALE is applied by the scene).
 * @param {typeof NPC_DUOC} [sheet]
 * @returns {number}
 */
export function npcScale(sheet = NPC_DUOC) {
  return sheet.heightUnits / sheet.contentHeight;
}

/**
 * Origin that puts the frame's content baseline (not its margin) at the ground.
 * @param {typeof NPC_DUOC} [sheet]
 * @returns {number}
 */
export function npcOriginY(sheet = NPC_DUOC) {
  return (sheet.frameHeight - sheet.bottomMargin) / sheet.frameHeight;
}

/**
 * Register one sheet's idle animation. Safe to call multiple times.
 * @param {import("phaser").Scene} scene
 * @param {typeof NPC_DUOC} [sheet]
 * @returns {string} animation key
 */
export function ensureNpcAnimations(scene, sheet = NPC_DUOC) {
  const key = `${sheet.textureKey}-idle`;
  if (!scene.anims.exists(key)) {
    scene.anims.create({
      key,
      frames: sheet.idleFrames.map((frame) => ({ key: sheet.textureKey, frame })),
      frameRate: sheet.idleFrameRate,
      repeat: -1
    });
  }
  return key;
}

/**
 * Ground-anchored NPC sprite plus its floating name label and talk prompt.
 * @param {import("phaser").Scene} scene
 * @param {{id:string, name:string, x:number, y:number, sprite?:string, tint?:number}} def
 * @returns {object}
 */
export function createNpcSprite(scene, def) {
  const sheet = NPC_SPRITES[def.sprite] || NPC_DUOC;
  const animKey = ensureNpcAnimations(scene, sheet);

  const iso = toIso(def.x, def.y);
  const sprite = scene.add.sprite(iso.x, iso.y, sheet.textureKey);
  sprite.setOrigin(0.5, npcOriginY(sheet));
  sprite.setScale(S * npcScale(sheet));
  sprite.setDepth(isoDepth(def.x, def.y));
  if (Number.isFinite(def.tint)) sprite.setTint(def.tint);
  sprite.play(animKey);

  const nameOffsetUnits = sheet.nameOffsetUnits || 102;
  const nameText = scene.add
    .text(iso.x, iso.y - nameOffsetUnits * S, def.name, {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "12px",
      color: "#ffd76b",
      stroke: "#1b1408",
      strokeThickness: 2,
      fontStyle: "bold"
    })
    .setOrigin(0.5)
    .setScale(S)
    .setDepth(isoDepth(def.x, def.y) + 100);

  const promptText = scene.add
    .text(iso.x, iso.y - (nameOffsetUnits + 16) * S, "Nhấn F để trò chuyện", {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "11px",
      color: "#5cfc5c",
      stroke: "#1b1408",
      strokeThickness: 2,
      fontStyle: "bold"
    })
    .setOrigin(0.5)
    .setScale(S)
    .setDepth(isoDepth(def.x, def.y) + 101)
    .setVisible(false);

  return {
    id: def.id,
    name: def.name,
    gx: def.x,
    gy: def.y,
    sprite,
    nameText,
    promptText
  };
}

/**
 * Backwards-compatible name used by older map code.
 * @param {import("phaser").Scene} scene
 * @param {object} def
 * @returns {object}
 */
export function createPharmacyNpc(scene, def) {
  return createNpcSprite(scene, { sprite: "npc-duoc", ...def });
}
