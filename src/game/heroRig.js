/**
 * Layered 2D hero rig.
 *
 * Replaces the baked sprite sheet with a parametric vector character: the body
 * is composed from primitive shapes, and equipment is drawn as slot layers on
 * top of the anchors they belong to (helmet on the head, armor on the torso,
 * weapon/accessory on the hand). Because everything is
 * generated from one pose model, equipment follows the body in all 8 directions
 * for free — no per-direction art.
 *
 * The module is framework-agnostic: `buildHero()` returns an ordered list of
 * draw primitives (back to front) that a renderer maps to its own drawing API.
 * Coordinates are in rig space: origin at the character's feet-centre, +x right,
 * +y down, character ~90 units tall (the head crown is near y = -90).
 */

import { HERO_DIRECTIONS } from "./heroDirections.js";
import { normalizeGender } from "./gender.js";
import { getItemById } from "./items.js";

/** Equipment slot colours (opaque ids; the rig only fills the worn slots). */
const EQUIP_COLORS = {
  helmet: 0xc9a24a,
  armor: 0x2f5fd0,
  weapon: 0xdfe7ee,
  accessory: 0x36b993
};

/** Draw order: body-hugging layers first, helmet last (it sits highest). */
export const EQUIP_SLOT_ORDER = ["armor", "accessory", "weapon", "helmet"];

const C = {
  tunic: 0x2f5fd0,
  tunicDark: 0x1f3f96,
  tunicEdge: 0x16307a,
  collar: 0xc23b3b,
  belt: 0x2b2b2b,
  pants: 0x9e2b2b,
  pantsDark: 0x7c1f1f,
  boot: 0x3f2d63,
  bootEdge: 0x241640,
  apron: 0xeef1f4,
  apronEdge: 0xaab4bf,
  apronHem: 0x2f5fd0,
  skin: 0xf1c27d,
  skinEdge: 0xcf9a55,
  skinDark: 0xd9a15c,
  hair: 0x14100f,
  hairHi: 0x2a2320,
  eye: 0x1a1410,
  bracer: 0x3a332c,
  bracerEdge: 0x1f1a15,
  stud: 0xd9d2c4,
  gold: 0xe6b23c,
  goldEdge: 0x9c7420,
  steel: 0xdfe7ee,
  steelEdge: 0x8fa0ad,
  jade: 0x2fae86,
  jadeEdge: 0x16694f,
  shoe: 0x241a33
};

/** Female palette: a rose gown with a light lining and a gold sash. */
const F = {
  robe: 0xd75a8f,
  robeDark: 0xa93b68,
  robeEdge: 0x78244a,
  lining: 0xf7d3e3,
  sash: 0xe8c25a,
  sashEdge: 0xa8852f,
  skin: 0xf8cfa9,
  skinEdge: 0xd59c70,
  hair: 0x1a1210,
  hairHi: 0x37251d,
  shoe: 0x6a2f4a
};

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export const poly = (points, fill, opts = {}) => ({ kind: "poly", points, fill, ...opts });
export const rect = (x, y, w, h, fill, opts = {}) => ({ kind: "rect", x, y, w, h, fill, ...opts });
const ell = (x, y, w, h, fill, opts = {}) => ({ kind: "ellipse", x, y, w, h, fill, ...opts });
export const circ = (x, y, r, fill, opts = {}) => ({ kind: "circle", x, y, r, fill, ...opts });
export const line = (x1, y1, x2, y2, stroke, opts = {}) => ({ kind: "line", x1, y1, x2, y2, stroke, ...opts });

/** A tapered bar from (x0,y0) width w0 to (x1,y1) width w1 (limbs, coat tails). */
const taper = (x0, y0, w0, x1, y1, w1, fill, opts = {}) =>
  poly(
    [[x0 - w0 / 2, y0], [x0 + w0 / 2, y0], [x1 + w1 / 2, y1], [x1 - w1 / 2, y1]],
    fill,
    opts
  );

const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ *
 * Pose model
 * ------------------------------------------------------------------ */

/**
 * Turn a direction index (0..7, 0 = facing camera/down) into the continuous
 * pose parameters the drawing helpers use.
 * @param {number} direction
 * @returns {{side:number, back:number, depth:number}}
 *   side: -1 (left) .. +1 (right); back: 0 (toward camera) .. 1 (facing away);
 *   depth: how side-on the pose is (|side|).
 */
export function poseFor(direction) {
  const d = ((Math.round(direction) % HERO_DIRECTIONS) + HERO_DIRECTIONS) % HERO_DIRECTIONS;
  const angle = d * (Math.PI / 4);
  const side = Math.sin(angle);
  const back = (1 - Math.cos(angle)) / 2;
  return { side, back, depth: Math.abs(side) };
}

/** Shoulder width per gender: [head-on, side-on] half-widths. */
const SHOULDER = {
  male: { front: 9, side: 5 },
  female: { front: 7.4, side: 4.6 }
};

/** Shoulder half-width for the current pose (shrinks as the body turns side-on). */
const shoulderHalf = (pose, gender = "male") => {
  const s = SHOULDER[normalizeGender(gender)];
  return lerp(s.front, s.side, pose.depth);
};

/**
 * Joint anchors the limbs pivot around when walking, in rig space. Shared by the
 * body builder and the view's animator so the swing stays attached to the body.
 * @param {ReturnType<typeof poseFor>} pose
 * @param {"male"|"female"} [gender]
 * @returns {{legL:{x:number,y:number}, legR:{x:number,y:number}, armL:{x:number,y:number}, armR:{x:number,y:number}}}
 */
export function limbPivots(pose, gender = "male") {
  const { side, depth } = pose;
  const sh = shoulderHalf(pose, gender);
  const spread = lerp(4.2, 1.4, depth);
  const bump = side === 0 ? 0 : 1.2;
  const sg = Math.sign(side);
  return {
    legL: { x: -spread + (side === 0 ? 0 : (sg === -1 ? bump : -bump)), y: -39 },
    legR: { x: spread + (side === 0 ? 0 : (sg === 1 ? bump : -bump)), y: -39 },
    armL: { x: -(sh + 1), y: -56 },
    armR: { x: sh + 1, y: -56 }
  };
}

/* ------------------------------------------------------------------ *
 * Body parts
 * ------------------------------------------------------------------ */

function coat(parts, pose) {
  const { back, side } = pose;
  const x = side * 0.8;
  const w = shoulderHalf(pose);
  const flare = lerp(5, 9, back); // tails open wider when seen from behind
  parts.push(poly(
    [[x - w, -58], [x + w, -58], [x + w + flare, -14], [x - w - flare, -14]],
    C.tunicDark, { stroke: C.tunicEdge, lineWidth: 1 }
  ));
  // Lighter inner lining
  parts.push(poly(
    [[x - w * 0.5, -54], [x + w * 0.5, -54], [x + 3, -18], [x - 3, -18]],
    C.tunic, { alpha: 0.35 }
  ));
}

function legs(parts, pose) {
  const { side } = pose;
  const pivots = limbPivots(pose);
  const order = side === 0 ? [-1, 1] : [Math.sign(side), -Math.sign(side)];

  for (const s of order) {
    const g = s < 0 ? "legL" : "legR";
    const hipX = (s < 0 ? pivots.legL : pivots.legR).x;
    const kneeX = hipX + side * 0.8;
    const ankleX = hipX + side * 0.4;
    // Pant: hip -> knee (tapered)
    parts.push(taper(hipX, -39, 7, kneeX, -20, 5.5, C.pants, { stroke: C.pantsDark, lineWidth: 0.7, group: g }));
    // Boot: knee -> ankle
    parts.push(taper(kneeX, -20, 6, ankleX, -5, 5, C.boot, { stroke: C.bootEdge, lineWidth: 0.7, group: g }));
    // Foot
    parts.push(ell(ankleX + side * 1.2, -3, 9, 4, C.shoe, { group: g }));
    if (pose.back < 0.6) {
      parts.push(circ(kneeX, -31, 2.2, C.steel, { stroke: C.steelEdge, lineWidth: 0.5, group: g }));
    }
  }
}

function torso(parts, pose) {
  const { back, side, depth } = pose;
  const x = side * 0.8;
  const sh = shoulderHalf(pose);
  const waist = lerp(6, 4, depth);
  const hip = lerp(7, 4.6, depth);

  // Sloped-shoulder body outline
  parts.push(poly(
    [[x - sh, -60], [x + sh, -60], [x + sh - 0.5, -54], [x + waist, -43],
      [x + hip, -38], [x - hip, -38], [x - waist, -43], [x - sh + 0.5, -54]],
    C.tunic, { stroke: C.tunicEdge, lineWidth: 1 }
  ));

  // Belt
  parts.push(rect(x, -42, waist * 2 + 1, 3, C.belt));

  if (back < 0.75) {
    // Chest V collar
    parts.push(poly([[x - sh + 1, -60], [x + sh - 1, -60], [x, -51]], C.collar));
    // Apron
    const aw = hip * 1.7;
    parts.push(poly(
      [[x - aw / 2, -40], [x + aw / 2, -40], [x + aw / 2 - 1, -15], [x - aw / 2 + 1, -15]],
      C.apron, { stroke: C.apronEdge, lineWidth: 0.8 }
    ));
    parts.push(rect(x, -19, aw - 1, 2.4, C.apronHem));
    parts.push(line(x - aw / 4, -37, x - aw / 4, -20, C.collar, { lineWidth: 1.3 }));
    parts.push(line(x + aw / 4, -37, x + aw / 4, -20, C.collar, { lineWidth: 1.3 }));
  }

  return { x, sh, aw: hip * 1.7 };
}

function arms(parts, pose) {
  const { side } = pose;
  const pivots = limbPivots(pose);
  const order = side === 0 ? [-1, 1] : [Math.sign(side), -Math.sign(side)];

  for (const s of order) {
    const g = s < 0 ? "armL" : "armR";
    const shoulderX = (s < 0 ? pivots.armL : pivots.armR).x;
    const elbowX = shoulderX + side * 0.4;
    const wristX = shoulderX + side * 0.8;
    // Shoulder cap
    parts.push(circ(shoulderX, -57, 3.2, C.tunic, { stroke: C.tunicEdge, lineWidth: 0.8 }));
    // Upper arm
    parts.push(taper(shoulderX, -56, 5.4, elbowX, -47, 4.6, C.tunic, { stroke: C.tunicEdge, lineWidth: 0.6, group: g }));
    // Forearm bracer
    parts.push(taper(elbowX, -47, 4.8, wristX, -39, 4.2, C.bracer, { stroke: C.bracerEdge, lineWidth: 0.6, group: g }));
    parts.push(circ(wristX, -44.5, 0.8, C.stud, { group: g }));
    parts.push(circ(wristX, -42, 0.8, C.stud, { group: g }));
    // Hand
    parts.push(circ(wristX, -37.5, 2.2, C.skin, { stroke: C.skinEdge, lineWidth: 0.5, group: g }));
  }
}

function head(parts, pose) {
  const { back, side, depth } = pose;
  const x = side * 1.6;
  const rx = lerp(6, 5.2, depth);
  const faceVisible = back < 0.6;

  // Neck
  parts.push(rect(x, -62, 5, 6, C.skinDark));

  // Hair mass behind the head
  parts.push(ell(x, -73, rx * 2 + 2.5, 15, C.hair));

  if (faceVisible) {
    // Face + jaw
    parts.push(poly(
      [[x - rx, -75], [x + rx, -75], [x + rx - 1, -67.5], [x, -64.5], [x - rx + 1, -67.5]],
      C.skin, { stroke: C.skinEdge, lineWidth: 0.5 }
    ));
    parts.push(ell(x, -74, rx * 2 - 0.5, 12, C.skin));

    const eo = side * 1.8;
    parts.push(ell(x - 2.2 + eo, -73.5, 2, 2.3, C.eye));
    parts.push(ell(x + 2.2 + eo, -73.5, 2, 2.3, C.eye));
    parts.push(line(x - 3.8 + eo, -76.2, x - 1.1 + eo, -75.9, C.hair, { lineWidth: 0.7 }));
    parts.push(line(x + 1.1 + eo, -75.9, x + 3.8 + eo, -76.2, C.hair, { lineWidth: 0.7 }));
    // Nose hint for near-side views
    if (depth > 0.4) parts.push(line(x + eo, -72.5, x + eo + side * 1.4, -71.2, C.skinDark, { lineWidth: 0.7 }));
  }

  // Hair cap over the crown, sidelocks just outside the face
  parts.push(poly(
    [[x - rx - 1, -73], [x - rx - 1, -78], [x, -82.5], [x + rx + 1, -78], [x + rx + 1, -73],
      [x + rx - 1.5, -77.5], [x, -80.5], [x - rx + 1.5, -77.5]],
    C.hair
  ));
  parts.push(taper(x - rx + 0.3, -78, 2.4, x - rx - 0.5, -66, 1.8, C.hair));
  parts.push(taper(x + rx - 0.3, -78, 2.4, x + rx + 0.5, -66, 1.8, C.hair));

  // Top knot + jade ring
  parts.push(ell(x, -81, rx * 1.6, 5, C.hairHi));
  parts.push(circ(x, -84, 3.4, C.hair));
  parts.push(rect(x, -82.5, 4.4, 2, C.jade, { stroke: C.jadeEdge, lineWidth: 0.6 }));
  parts.push(poly([[x - 2, -87], [x + 2, -87], [x, -90]], C.hair));

  return { x, rx };
}

/* ------------------------------------------------------------------ *
 * Female body (long gown, flowing hair, slimmer silhouette)
 * ------------------------------------------------------------------ */

/** Slim stockinged legs + slippers, mostly hidden under the gown hem. */
function legsFemale(parts, pose) {
  const { side } = pose;
  const pivots = limbPivots(pose, "female");
  const order = side === 0 ? [-1, 1] : [Math.sign(side), -Math.sign(side)];

  for (const s of order) {
    const g = s < 0 ? "legL" : "legR";
    const hipX = (s < 0 ? pivots.legL : pivots.legR).x;
    const kneeX = hipX + side * 0.8;
    const ankleX = hipX + side * 0.4;
    // Silken leg under the gown
    parts.push(taper(hipX, -39, 5.4, kneeX, -20, 4.2, F.robeDark, { stroke: F.robeEdge, lineWidth: 0.6, group: g }));
    parts.push(taper(kneeX, -20, 4.6, ankleX, -5, 3.8, F.skin, { stroke: F.skinEdge, lineWidth: 0.5, group: g }));
    // Embroidered slipper
    parts.push(ell(ankleX + side * 1.2, -3, 7.4, 3.4, F.shoe, { group: g }));
  }
}

/** Long back panel of the gown, flaring from the shoulders to a hem near the feet. */
function robeFemale(parts, pose) {
  const { back, side, depth } = pose;
  const x = side * 0.8;
  const w = shoulderHalf(pose, "female");
  const hipW = lerp(7.6, 5, depth);
  const flare = lerp(6.5, 11, back);

  parts.push(poly(
    [[x - w, -58], [x + w, -58], [x + hipW + flare, -9], [x - hipW - flare, -9]],
    F.robeDark, { stroke: F.robeEdge, lineWidth: 1 }
  ));
  // Lighter inner lining down the middle
  parts.push(poly(
    [[x - w * 0.45, -56], [x + w * 0.45, -56], [x + 4, -13], [x - 4, -13]],
    F.robe, { alpha: 0.4 }
  ));
  // Embroidered hem band
  parts.push(poly(
    [[x - hipW - flare + 1, -13], [x + hipW + flare - 1, -13], [x + hipW + flare, -9], [x - hipW - flare, -9]],
    F.lining, { alpha: 0.35 }
  ));
}

/** Slim arms with a flowing bell sleeve; keeps the arm groups for the walk cycle. */
function armsFemale(parts, pose) {
  const { side } = pose;
  const pivots = limbPivots(pose, "female");
  const order = side === 0 ? [-1, 1] : [Math.sign(side), -Math.sign(side)];

  for (const s of order) {
    const g = s < 0 ? "armL" : "armR";
    const shoulderX = (s < 0 ? pivots.armL : pivots.armR).x;
    const elbowX = shoulderX + side * 0.4;
    const wristX = shoulderX + side * 0.8;
    // Shoulder cap
    parts.push(circ(shoulderX, -57, 3, F.robe, { stroke: F.robeEdge, lineWidth: 0.8 }));
    // Upper arm
    parts.push(taper(shoulderX, -56, 4.8, elbowX, -47, 3.8, F.robe, { stroke: F.robeEdge, lineWidth: 0.6, group: g }));
    // Wide bell sleeve
    parts.push(taper(elbowX, -47, 5.6, wristX, -39, 7.4, F.robe, { stroke: F.robeEdge, lineWidth: 0.7, group: g }));
    parts.push(taper(elbowX, -47, 3, wristX, -39, 4.4, F.lining, { alpha: 0.5, group: g }));
    // Hand
    parts.push(circ(wristX, -36, 1.9, F.skin, { stroke: F.skinEdge, lineWidth: 0.5, group: g }));
  }
}

/** Cinched-waist bodice, gold sash and a hint of a bust. */
function torsoFemale(parts, pose) {
  const { back, side, depth } = pose;
  const x = side * 0.8;
  const sh = shoulderHalf(pose, "female");
  const waist = lerp(4.6, 3.4, depth);
  const hip = lerp(7.6, 5, depth);

  // Sloped-shoulder bodice, cinched waist, flared hips
  parts.push(poly(
    [[x - sh, -60], [x + sh, -60], [x + sh - 0.4, -54], [x + waist, -44],
      [x + hip, -38], [x - hip, -38], [x - waist, -44], [x - sh + 0.4, -54]],
    F.robe, { stroke: F.robeEdge, lineWidth: 1 }
  ));

  // Gold sash at the waist
  parts.push(rect(x, -43.5, waist * 2 + 1.2, 3, F.sash));
  parts.push(line(x - waist, -42, x + waist, -42, F.sashEdge, { lineWidth: 0.6 }));

  if (back < 0.75) {
    // Crossed collar
    parts.push(poly([[x - sh + 1, -60], [x + sh - 1, -60], [x, -51]], F.lining));
    parts.push(poly([[x - sh + 1, -60], [x, -60], [x, -51]], F.robeDark, { alpha: 0.5 }));
    // Bust hint
    parts.push(ell(x - 3.2, -53, 4.6, 4, F.robe, { stroke: F.robeEdge, lineWidth: 0.5 }));
    parts.push(ell(x + 3.2, -53, 4.6, 4, F.robe, { stroke: F.robeEdge, lineWidth: 0.5 }));
    // Sash knot and hanging ribbons
    parts.push(ell(x, -43.5, 3.4, 3, F.sash, { stroke: F.sashEdge, lineWidth: 0.5 }));
    parts.push(taper(x - 0.6, -42, 1.6, x - 3, -35, 1.2, F.sash));
    parts.push(taper(x + 0.6, -42, 1.6, x + 3, -35, 1.2, F.sash));
  }

  return { x, sh, aw: hip * 1.9 };
}

/** Smaller face, long flowing hair and a jade hairpin. */
function headFemale(parts, pose) {
  const { back, side, depth } = pose;
  const x = side * 1.6;
  const rx = lerp(5.4, 4.7, depth);
  const faceVisible = back < 0.6;

  // Neck
  parts.push(rect(x, -62, 4.4, 6, F.skinEdge));

  // Hair mass behind the head, flowing down the back
  parts.push(ell(x, -73, rx * 2 + 3, 15, F.hair));
  parts.push(poly(
    [[x - rx - 1, -76], [x + rx + 1, -76], [x + rx + 2, -52], [x - rx - 2, -52]],
    F.hair
  ));

  if (faceVisible) {
    // Face + jaw
    parts.push(poly(
      [[x - rx, -75], [x + rx, -75], [x + rx - 1.2, -67.5], [x, -64.5], [x - rx + 1.2, -67.5]],
      F.skin, { stroke: F.skinEdge, lineWidth: 0.5 }
    ));
    parts.push(ell(x, -74, rx * 2 - 0.4, 12, F.skin));

    const eo = side * 1.8;
    parts.push(ell(x - 2 + eo, -73.5, 2.2, 2.6, C.eye));
    parts.push(ell(x + 2 + eo, -73.5, 2.2, 2.6, C.eye));
    // Lashes
    parts.push(line(x - 3.6 + eo, -76.4, x - 0.9 + eo, -76.1, F.hair, { lineWidth: 0.7 }));
    parts.push(line(x + 0.9 + eo, -76.1, x + 3.6 + eo, -76.4, F.hair, { lineWidth: 0.7 }));
    // Lips
    parts.push(line(x - 1 + eo, -69.3, x + 1 + eo, -69.3, 0xc23b56, { lineWidth: 0.7 }));
    if (depth > 0.4) parts.push(line(x + eo, -72.5, x + eo + side * 1.2, -71.4, F.skinEdge, { lineWidth: 0.6 }));
  }

  // Hair cap over the crown
  parts.push(poly(
    [[x - rx - 1, -73], [x - rx - 1, -78], [x, -82.5], [x + rx + 1, -78], [x + rx + 1, -73],
      [x + rx - 1.4, -77.5], [x, -80.5], [x - rx + 1.4, -77.5]],
    F.hair
  ));
  // Long sidelocks framing the face
  parts.push(taper(x - rx + 0.3, -78, 2.2, x - rx - 0.6, -58, 1.6, F.hair));
  parts.push(taper(x + rx - 0.3, -78, 2.2, x + rx + 0.6, -58, 1.6, F.hair));
  // Crown highlight
  parts.push(ell(x, -80, rx * 1.3, 4, F.hairHi, { alpha: 0.6 }));
  // Jade hairpin with a dangling bead
  parts.push(rect(x + rx - 1, -84, 4.6, 1.6, C.jade, { stroke: C.jadeEdge, lineWidth: 0.5 }));
  parts.push(circ(x + rx + 1, -85, 1.1, C.jade));

  return { x, rx };
}

/**
 * The rig shape family for a weapon item, derived from its `weaponType`. The
 * held weapon is rebuilt whenever the `weapon` slot changes, so the same item
 * id shows the matching blade/claw in every direction. An unknown weapon id
 * falls back to the sword shape rather than leaving the hand empty.
 * @param {string|null|undefined} weaponId
 * @returns {"jian"|"blade"|"claw"|null}
 */
export function weaponKindFor(weaponId) {
  if (typeof weaponId !== "string" || !weaponId) return null;
  const weaponType = getItemById(weaponId)?.weaponType;
  if (weaponType === "bao-tay") return "claw";
  if (weaponType === "dao") return "blade";
  return "jian";
}

/* ------------------------------------------------------------------ *
 * Equipment layers
 * ------------------------------------------------------------------ */

function equipHelmet(parts, pose, ctx) {
  const { x, rx } = ctx.head;
  parts.push(poly(
    [[x - rx - 1.2, -77], [x - rx - 1.2, -82], [x - rx + 2, -86], [x, -89.5],
      [x + rx - 2, -86], [x + rx + 1.2, -82], [x + rx + 1.2, -77]],
    EQUIP_COLORS.helmet, { stroke: C.goldEdge, lineWidth: 1.3 }
  ));
  parts.push(rect(x, -77.5, rx * 2 + 2.4, 3, C.gold, { stroke: C.goldEdge, lineWidth: 0.6 }));
  parts.push(poly([[x - 1.6, -89.5], [x + 1.6, -89.5], [x, -94]], C.gold, { stroke: C.goldEdge, lineWidth: 0.6 }));
}

function equipArmor(parts, pose, ctx) {
  const { x, sh, aw } = ctx.torso;
  // Chest plate + shoulder pads
  parts.push(poly(
    [[x - sh + 0.5, -59], [x - sh - 2.5, -53], [x - sh + 0.5, -47], [x - aw / 2 + 1, -41],
      [x + aw / 2 - 1, -41], [x + sh - 0.5, -47], [x + sh + 2.5, -53], [x + sh - 0.5, -59]],
    EQUIP_COLORS.armor, { stroke: C.gold, lineWidth: 1.4, alpha: 0.94 }
  ));
  parts.push(ell(x, -51, 6, 5, C.gold, { alpha: 0.9 }));
}

function equipAccessory(parts, pose, ctx) {
  const hx = limbPivots(pose, ctx.gender).armL.x - 0.5;
  parts.push(circ(hx, -37.5, 2, EQUIP_COLORS.accessory, { stroke: C.jadeEdge, lineWidth: 0.7, group: "armL" }));
}

function equipWeapon(parts, pose, ctx, equipment) {
  const kind = weaponKindFor(equipment.weapon);
  if (!kind) return;
  const hx = limbPivots(pose, ctx.gender).armR.x + 1.5; // right hand
  const g = "armR"; // the weapon rides the right arm

  if (kind === "claw") {
    // Bladed fist: three short talons over the knuckles.
    parts.push(circ(hx, -37.5, 2.6, EQUIP_COLORS.weapon, { stroke: C.steelEdge, lineWidth: 0.9, group: g }));
    parts.push(line(hx + 1.2, -39.6, hx + 4.2, -45, C.steel, { lineWidth: 1.1, stroke: C.steelEdge, group: g }));
    parts.push(line(hx + 2.6, -38.8, hx + 6.2, -43.4, C.steel, { lineWidth: 1.1, stroke: C.steelEdge, group: g }));
    parts.push(line(hx + 3.8, -37.2, hx + 7.6, -40.6, C.steel, { lineWidth: 1.1, stroke: C.steelEdge, group: g }));
    return;
  }

  // Shared hilt: pommel, grip and cross-guard.
  parts.push(circ(hx, -37.5, 1.6, C.gold, { group: g }));
  parts.push(rect(hx, -35.5, kind === "blade" ? 7 : 6.5, 2.2, C.gold, { stroke: C.goldEdge, lineWidth: 0.5, group: g }));

  if (kind === "blade") {
    // Broad single-edged dao, slightly curved toward the back.
    parts.push(poly(
      [[hx + 1.4, -33.6], [hx + 3.2, -24], [hx + 4.8, -13], [hx + 6, -5.5],
        [hx + 4.2, -5.8], [hx + 3, -13], [hx + 1.7, -24]],
      C.steel, { stroke: C.steelEdge, lineWidth: 0.9, group: g }
    ));
    parts.push(circ(hx + 5.2, -7, 1, 0xffffff, { group: g }));
    return;
  }

  // Straight double-edged jian.
  parts.push(line(hx + 2, -33.5, hx + 4.5, -10, C.steel, { lineWidth: 2.4, group: g }));
  parts.push(circ(hx + 4.5, -10, 1.1, 0xffffff, { group: g }));
}

const EQUIP_DRAW = {
  helmet: equipHelmet,
  armor: equipArmor,
  accessory: equipAccessory,
  weapon: equipWeapon
};

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

/**
 * Build the ordered draw list for the hero (back to front).
 * @param {{direction?:number, equipment?:Record<string, string|null|boolean>, gender?:"male"|"female"}} [opts]
 * @returns {Array<Object>} primitives
 */
export function buildHero(opts = {}) {
  const gender = normalizeGender(opts.gender);
  const pose = poseFor(opts.direction ?? 0);
  const equipment = opts.equipment || {};
  const out = [];

  let torsoAnchor;
  let headAnchor;
  if (gender === "female") {
    legsFemale(out, pose);
    robeFemale(out, pose);
    armsFemale(out, pose);
    torsoAnchor = torsoFemale(out, pose);
    headAnchor = headFemale(out, pose);
  } else {
    coat(out, pose);
    legs(out, pose);
    arms(out, pose);
    torsoAnchor = torso(out, pose);
    headAnchor = head(out, pose);
  }
  const ctx = { torso: torsoAnchor, head: headAnchor, gender };
  for (const slot of EQUIP_SLOT_ORDER) {
    if (!equipment[slot]) continue;
    EQUIP_DRAW[slot]?.(out, pose, ctx, equipment);
  }

  return out;
}
