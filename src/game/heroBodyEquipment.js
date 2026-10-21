/**
 * Equipment overlays for the baked hero body (see heroBody.js).
 *
 * The body sheet has chibi proportions, so the vector rig's equipment anchors
 * do not fit. These primitives are drawn in the same rig space but sized for
 * the sheet: armor on the torso, helmet on the crown, and weapon/accessory on
 * the hands. They use the same slot order as heroRig.js.
 */

import { EQUIP_SLOT_ORDER, circ, line, poly, poseFor, rect, weaponKindFor } from "./heroRig.js";

const E = {
  armor: 0x2f5fd0,
  armorDark: 0x1f3f96,
  armorEdge: 0x16307a,
  armorLight: 0x5b8ae6,
  belt: 0x2b2b2b,
  helmet: 0xc9a24a,
  helmetEdge: 0x9c7420,
  gold: 0xe6b23c,
  steel: 0xdfe7ee,
  steelEdge: 0x8fa0ad,
  jade: 0x36b993,
  jadeEdge: 0x16694f
};

/** Hand centres for the facing direction, in rig units. */
function handCentres(pose) {
  if (pose.side === 0) return { left: -19, right: 19 };
  const side = Math.sign(pose.side);
  return { left: -side * 14, right: side * 14 };
}

function armor(parts, pose) {
  const x = pose.side * 0.8;
  parts.push(
    poly(
      [
        [x - 15.5, -55],
        [x + 15.5, -55],
        [x + 16, -42],
        [x + 14, -28],
        [x - 14, -28],
        [x - 16, -42]
      ],
      E.armor,
      { stroke: E.armorEdge, lineWidth: 1, slot: "armor" }
    )
  );
  parts.push(circ(x - 16, -51, 4.2, E.armorDark, { stroke: E.armorEdge, lineWidth: 0.8, slot: "armor" }));
  parts.push(circ(x + 16, -51, 4.2, E.armorDark, { stroke: E.armorEdge, lineWidth: 0.8, slot: "armor" }));

  if (pose.back < 0.6) {
    parts.push(poly([[x - 6, -55], [x + 6, -55], [x, -46]], E.armorLight, { slot: "armor" }));
    parts.push(circ(x, -45, 2.4, E.gold, { slot: "armor" }));
  } else {
    parts.push(line(x, -54, x, -29, E.armorEdge, { lineWidth: 1, slot: "armor" }));
  }

  parts.push(rect(x, -31, 29, 3, E.belt, { slot: "armor" }));
  parts.push(rect(x, -31, 9, 2, E.gold, { slot: "armor" }));
}

function helmet(parts, pose) {
  const x = pose.side * 0.8;
  parts.push(
    poly(
      [
        [x - 18, -77],
        [x - 17, -86],
        [x - 9, -93],
        [x + 9, -93],
        [x + 17, -86],
        [x + 18, -77],
        [x + 13, -75],
        [x - 13, -75]
      ],
      E.helmet,
      { stroke: E.helmetEdge, lineWidth: 1.2, slot: "helmet" }
    )
  );
  parts.push(rect(x, -76, 38, 3, E.gold, { stroke: E.helmetEdge, lineWidth: 0.6, slot: "helmet" }));
  parts.push(poly([[x - 2, -93], [x + 2, -93], [x, -99]], E.gold, { slot: "helmet" }));
  parts.push(circ(x, -84, 1.6, E.jade, { stroke: E.jadeEdge, lineWidth: 0.5, slot: "helmet" }));
}

function accessory(parts, pose) {
  const x = handCentres(pose).left;
  parts.push(circ(x, -24, 2.8, E.jade, { stroke: E.jadeEdge, lineWidth: 0.8, slot: "accessory" }));
  parts.push(circ(x, -24, 1, E.gold, { slot: "accessory" }));
}

function weapon(parts, pose, weaponId) {
  const x = handCentres(pose).right;
  const y = -24;
  const kind = weaponKindFor(weaponId);

  if (kind === "claw") {
    parts.push(circ(x, y, 2.8, E.steel, { stroke: E.steelEdge, lineWidth: 0.8, slot: "weapon" }));
    parts.push(line(x + 1.4, y - 2, x + 5, y - 7, E.steel, { lineWidth: 1.1, stroke: E.steelEdge, slot: "weapon" }));
    parts.push(line(x + 2.8, y - 0.6, x + 7, y - 4.4, E.steel, { lineWidth: 1.1, stroke: E.steelEdge, slot: "weapon" }));
    parts.push(line(x + 3.8, y + 1.2, x + 8, y - 1.8, E.steel, { lineWidth: 1.1, stroke: E.steelEdge, slot: "weapon" }));
    return;
  }

  parts.push(circ(x, y, 1.7, E.gold, { slot: "weapon" }));
  parts.push(rect(x, y + 2.2, 2.4, 5, E.gold, { stroke: E.helmetEdge, lineWidth: 0.4, slot: "weapon" }));
  parts.push(rect(x, y + 5.4, 8, 2, E.gold, { stroke: E.helmetEdge, lineWidth: 0.5, slot: "weapon" }));

  if (kind === "blade") {
    parts.push(
      poly(
        [
          [x - 1.2, y + 6.4],
          [x + 2.8, y + 6.4],
          [x + 5.2, -2],
          [x + 2.2, -2]
        ],
        E.steel,
        { stroke: E.steelEdge, lineWidth: 0.8, slot: "weapon" }
      )
    );
    return;
  }

  parts.push(line(x + 1, y + 6.4, x + 3.2, -2, E.steel, { lineWidth: 2.4, stroke: E.steelEdge, slot: "weapon" }));
  parts.push(circ(x + 3.2, -2, 1, 0xffffff, { slot: "weapon" }));
}

const SLOT_DRAW = { armor, accessory, weapon, helmet };

/**
 * Build the equipment overlays for a baked body pose.
 * @param {{direction?:number, equipment?:Record<string,string|null>}} [opts]
 * @returns {Array<Object>} primitives tagged with their equipment slot
 */
export function buildBodyEquipment({ direction = 0, equipment = {} } = {}) {
  if (!equipment || typeof equipment !== "object") return [];
  const pose = poseFor(direction);
  const parts = [];

  for (const slot of EQUIP_SLOT_ORDER) {
    if (equipment[slot]) SLOT_DRAW[slot](parts, pose, equipment[slot]);
  }

  return parts;
}
