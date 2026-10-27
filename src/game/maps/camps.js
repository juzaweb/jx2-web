/**
 * Camp expansion shared by every hunting ground.
 *
 * A map authors a short table of camps (`{monsterId, x, y, count}`); this module
 * scatters each camp's monsters over a disc with rejection sampling so a camp
 * reads as animals foraging in a clearing rather than a formation on parade.
 *
 * Pure data + noise, no Phaser imports: the same spawn list drives the client
 * renderer, the minimap and the server roster.
 */

import { noise01 } from "../noise.js";

/**
 * How far from its centre a camp's monsters may scatter. Wide enough that a camp
 * reads as animals foraging in a clearing, not a formation on parade.
 */
export const CAMP_RADIUS = 1500;
/**
 * Closest two monsters of a camp may stand, in world pixels. Kept above the
 * health-bar width (38 × S = 190) so a pack never turns into a pile of bars.
 */
export const CAMP_MIN_GAP = 400;
/**
 * Placement attempts per monster before a camp settles for a crowded spot. The
 * disc fits fifteen at this gap with room to spare, so this is only a safety net.
 */
const CAMP_ATTEMPTS_PER_MONSTER = 80;

/**
 * Spread each camp's `count` monsters in a loose ring around its centre.
 * @param {Array<{monsterId: string, x: number, y: number, count: number}>} camps
 * @returns {Array<{id: number, monsterId: string, x: number, y: number}>}
 */
export function expandCamps(camps) {
  const spawns = [];
  // The gap is enforced per species, not per camp: two camps of the same monster
  // may overlap into one long hunting ground, and even then no two stand close.
  const placedByMonster = new Map();

  camps.forEach((camp) => {
    if (!placedByMonster.has(camp.monsterId)) placedByMonster.set(camp.monsterId, []);
    const occupied = placedByMonster.get(camp.monsterId);
    const placed = [];
    const seedBase = camp.x * 0.37 + camp.y * 0.11;

    // Rejection sampling on a disc: scattered, but never closer than the gap.
    for (let attempt = 0; placed.length < camp.count; attempt++) {
      const seed = seedBase + attempt * 1.7;
      const angle = noise01(seed) * Math.PI * 2;
      const radius = Math.sqrt(noise01(seed + 1)) * CAMP_RADIUS;
      const x = Math.round((camp.x + Math.cos(angle) * radius) / 10) * 10;
      const y = Math.round((camp.y + Math.sin(angle) * radius) / 10) * 10;

      const clear = occupied.every((spot) => Math.hypot(spot.x - x, spot.y - y) >= CAMP_MIN_GAP);
      // Give up searching eventually and take the spot, so a camp never silently
      // ships fewer monsters than it asks for.
      if (clear || attempt > camp.count * CAMP_ATTEMPTS_PER_MONSTER) {
        const spot = { x, y };
        placed.push(spot);
        occupied.push(spot);
      }
    }

    placed.forEach((spot) => {
      spawns.push({
        id: spawns.length,
        monsterId: camp.monsterId,
        x: spot.x,
        y: spot.y
      });
    });
  });

  return spawns;
}
