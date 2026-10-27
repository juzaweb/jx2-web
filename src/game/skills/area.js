/**
 * Cast reach and cast-area maths shared by the client and the server.
 *
 * Kept free of Phaser/DOM so the server can validate an `enemy_hit` /
 * `player_hit` against exactly the area the client drew and aimed at.
 */

import { HIT_RADIUS_SLACK } from "../combatRules.js";

/**
 * Distance at which a skill can release.
 *
 * For an AoE the cast range is how far the caster may aim, falling back to the
 * radius for a self-centred skill with `range: 0`.
 *
 * @param {Object} skill
 * @returns {number} world-space reach in px
 */
export function skillCastReach(skill) {
  const range = Number(skill?.range);
  if (Number.isFinite(range) && range > 0) return range;
  const radius = Number(skill?.radius);
  return Number.isFinite(radius) && radius > 0 ? radius : 0;
}

/**
 * Whether a target stands inside the area the server authorized for an AoE
 * cast. Non-AoE casts and casts that do not match are left to their own checks.
 *
 * @param {{ skillId?: string, aim?: { x: number, y: number }|null }|null} cast
 *   server-side `lastCast`
 * @param {Object|null} skill
 * @param {{ x: number, y: number }} target
 * @param {{ x: number, y: number }} fallback caster position when the cast has no aim
 * @returns {boolean}
 */
export function isInsideCastArea(cast, skill, target, fallback) {
  if (!(skill?.radius > 0) || cast?.skillId !== skill.id) return true;
  const center = cast.aim || fallback;
  return (
    Math.hypot(center.x - target.x, center.y - target.y) <= skill.radius + HIT_RADIUS_SLACK
  );
}
