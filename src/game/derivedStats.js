/**
 * Server-owned combat stats derived from a character's level, gear and buffs.
 *
 * The server is the only caller that decides a player's attack, defense, crit
 * rate and HP/MP ceilings; the client receives the result (see `player_stats`)
 * and renders it. The formulas live here so both sides agree on how a value is
 * produced without duplicating it.
 */

import {
  BASE_ATTACK,
  BASE_ATTACK_SPEED,
  BASE_CRIT_DAMAGE,
  BASE_CRIT_RATE,
  BASE_DEFENSE
} from "./combatConfig.js";
import { deriveEquipmentBonuses } from "./equipment.js";
import { MAX_LEVEL, MIN_LEVEL, vitalsForLevel } from "./progression.js";
import { applyBuffsToStats } from "./skillDamage.js";

/**
 * Equipment-only combat bonus totals, in the same shape as the base stats.
 * @param {Record<string, string|null>} [equipment]
 * @returns {{ attack: number, defense: number, critRate: number }}
 */
export function deriveGearCombatBonuses(equipment = {}) {
  const bonuses = deriveEquipmentBonuses(equipment);
  return {
    attack: Number(bonuses.attack) || 0,
    defense: Number(bonuses.defense) || 0,
    critRate: Number(bonuses.critRate) || 0
  };
}

/**
 * Full server-owned stat block for a character.
 *
 * @param {Object} [input]
 * @param {number} [input.level=1]
 * @param {Record<string, string|null>} [input.equipment] worn items
 * @param {Array<{ stat: string, amount: number, until: number }>} [input.buffs] active buffs
 * @param {number} [input.now] timestamp used to expire buffs
 * @returns {{
 *   level: number,
 *   attack: number,
 *   defense: number,
 *   critRate: number,
 *   critDamage: number,
 *   attackSpeed: number,
 *   speedPct: number,
 *   maxHp: number,
 *   maxMp: number,
 *   nextExp: number
 * }}
 */
export function deriveCombatStats({ level = 1, equipment = {}, buffs = [], now = Date.now() } = {}) {
  const gear = deriveGearCombatBonuses(equipment);
  const vitals = vitalsForLevel(level);
  const base = {
    attack: Math.max(0, Math.round(BASE_ATTACK + gear.attack)),
    defense: Math.max(0, Math.round(BASE_DEFENSE + gear.defense)),
    critRate: clampRate(BASE_CRIT_RATE + gear.critRate),
    critDamage: BASE_CRIT_DAMAGE,
    attackSpeed: BASE_ATTACK_SPEED
  };

  const buffed = applyBuffsToStats(base, buffs, now);
  return {
    level: normalizeLevel(level),
    attack: Math.max(0, Math.round(buffed.attack || 0)),
    defense: Math.max(0, Math.round(buffed.defense || 0)),
    critRate: clampRate(buffed.critRate),
    critDamage: BASE_CRIT_DAMAGE,
    attackSpeed: BASE_ATTACK_SPEED,
    speedPct: Number.isFinite(buffed.speedPct) ? buffed.speedPct : 0,
    maxHp: vitals.maxHp,
    maxMp: vitals.maxMp,
    nextExp: vitals.nextExp
  };
}

/**
 * Clamp a crit rate into [0, 1] and round away floating-point drift.
 * @param {unknown} value
 * @returns {number}
 */
function clampRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 0;
  return Math.min(1, Math.max(0, Number(rate.toFixed(4))));
}

/**
 * Coerce a level into the progression range.
 * @param {unknown} level
 * @returns {number}
 */
function normalizeLevel(level) {
  const value = Number(level);
  if (!Number.isFinite(value)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(value)));
}
