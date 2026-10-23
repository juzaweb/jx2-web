/**
 * Herb-shop NPC ("Dược Sư"). The art is the first row of the shopkeeper sheet
 * (see scripts/build_npc_duoc.py): ten 280x520 poses with the feet anchored on
 * the same ground line. A subset of front-facing poses is played as a slow idle
 * loop so the shopkeeper feels alive without walking anywhere.
 */
import { WORLD_SCALE } from "./worldConfig.js";
import { toIso, isoDepth } from "./isoProjection.js";

const S = WORLD_SCALE;

export const NPC_DUOC = {
  textureKey: "npc-duoc",
  url: "/npc-duoc.png",
  frameWidth: 280,
  frameHeight: 520,
  bottomMargin: 10,
  contentHeight: 480,
  /** Rendered height in rig units; close to the hero's 92.5. */
  heightUnits: 88,
  /** Name tag floating offset in rig units so it clears the head. */
  nameOffsetUnits: 102,
  /** Front-facing poses only; the back views stay unused in the sheet. */
  idleFrames: [0, 1, 2, 3, 2, 1],
  idleFrameRate: 2
};

export const NPC_DUOC_ANIM = "npc-duoc-idle";

/**
 * How close (ground px) the hero must stand before an NPC can be talked to.
 *
 * The shopkeeper sprite is ~257 world px wide (280 px frame at WORLD_SCALE),
 * so a smaller radius made the hero stand visually on top of the NPC before the
 * game agreed it was "near". The server already validates shop purchases with
 * the same 260 px radius (see `SHOP_INTERACT_RANGE` in gameSocket.js), so the
 * client matches it instead of rejecting valid interactions.
 */
export const NPC_INTERACT_RANGE = 260;

/** Clickable body box, measured in ground px around the NPC's feet. */
const HIT_HALF_WIDTH = 90;
const HIT_ABOVE_FEET = 460;
const HIT_BELOW_FEET = 45;
/** Where the hero stops so the NPC is inside talking range, not underfoot. */
const APPROACH_OFFSET = 60;

/** Sprite scale inside a rig-space container (WORLD_SCALE is applied by the scene). */
export function npcScale() {
  return NPC_DUOC.heightUnits / NPC_DUOC.contentHeight;
}

/** Origin that puts the frame's content baseline (not its margin) at the ground. */
export function npcOriginY() {
  return (NPC_DUOC.frameHeight - NPC_DUOC.bottomMargin) / NPC_DUOC.frameHeight;
}

/**
 * Whether a ground-space point lands on the NPC's drawn body. The sprite is
 * anchored at the feet and extends upward, so using the anchor alone would make
 * the visible torso unclickable.
 * @param {{gx:number, gy:number}} npc
 * @param {number} x ground-space x
 * @param {number} y ground-space y
 * @returns {boolean}
 */
export function isPointOnNpc(npc, x, y) {
  return (
    Math.abs(x - npc.gx) < HIT_HALF_WIDTH &&
    y < npc.gy + HIT_BELOW_FEET &&
    y > npc.gy - HIT_ABOVE_FEET
  );
}

/**
 * Whether a ground point is close enough to talk to this NPC. The drawn sprite is
 * much wider than the NPC's collision body, so a feet-to-feet radius alone reads
 * as "I'm standing right next to him" while still being out of range. Overlapping
 * the drawn body always counts.
 * @param {{gx:number, gy:number}} npc
 * @param {number} x ground-space x
 * @param {number} y ground-space y
 * @returns {boolean}
 */
export function isInTalkRange(npc, x, y) {
  if (isPointOnNpc(npc, x, y)) return true;
  const dx = x - npc.gx;
  const dy = y - npc.gy;
  return dx * dx + dy * dy <= NPC_INTERACT_RANGE * NPC_INTERACT_RANGE;
}

/**
 * Ground point just in front of the NPC that the hero should walk to before
 * talking. Targeting the feet would make the hero collide with the NPC's body.
 * @param {{gx:number, gy:number}} npc
 * @returns {{x:number, y:number}}
 */
export function npcApproachPoint(npc) {
  return { x: npc.gx, y: npc.gy + APPROACH_OFFSET };
}

/**
 * Register the idle animation once per scene. Safe to call multiple times.
 * @param {import("phaser").Scene} scene
 */
export function ensureNpcAnimations(scene) {
  if (scene.anims.exists(NPC_DUOC_ANIM)) return;
  scene.anims.create({
    key: NPC_DUOC_ANIM,
    frames: NPC_DUOC.idleFrames.map((frame) => ({ key: NPC_DUOC.textureKey, frame })),
    frameRate: NPC_DUOC.idleFrameRate,
    repeat: -1
  });
}

/**
 * Ground-anchored shopkeeper sprite plus its floating name label.
 * @param {import("phaser").Scene} scene
 * @param {{id:string, name:string, x:number, y:number}} def
 */
export function createPharmacyNpc(scene, def) {
  ensureNpcAnimations(scene);

  const iso = toIso(def.x, def.y);
  const sprite = scene.add.sprite(iso.x, iso.y, NPC_DUOC.textureKey);
  sprite.setOrigin(0.5, npcOriginY());
  sprite.setScale(S * npcScale());
  sprite.setDepth(isoDepth(def.x, def.y));
  sprite.play(NPC_DUOC_ANIM);

  const nameOffsetUnits = NPC_DUOC.nameOffsetUnits || 102;
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

  return {
    id: def.id,
    name: def.name,
    gx: def.x,
    gy: def.y,
    sprite,
    nameText
  };
}
