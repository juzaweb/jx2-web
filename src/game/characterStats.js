/**
 * Character sheet derivation.
 *
 * Every row is read from the same numbers the combat loop uses: the live stats
 * snapshot (`attack`, `defense`, `critRate`, `critDamage`, `attackSpeed`)
 * falling back to the base values in `combatConfig.js`. Attributes that have no
 * backing model are not shown at all, so the sheet cannot claim a number the
 * game does not actually roll.
 */

import {
  BASE_ATTACK,
  BASE_ATTACK_SPEED,
  BASE_CRIT_DAMAGE,
  BASE_CRIT_RATE,
  BASE_DEFENSE
} from "./combatConfig.js";
import { MAX_LEVEL, MIN_LEVEL } from "./progression.js";

const toInt = (value, fallback, min = Number.NEGATIVE_INFINITY) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.round(n));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** A non-negative float (crit chance is 0..1, crit damage 1.5 = +50%). */
const toRate = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const asPercent = (rate) => `${Math.round(rate * 100)}%`;
/** Crit damage is a multiplier on the hit: 1.5 -> "×1.5" (+50% extra). */
const asMultiplier = (factor) => `×${Number(factor.toFixed(2))}`;

/**
 * Coerce any input into a usable, in-range character level.
 * @param {unknown} level
 * @returns {number}
 */
export function normalizeLevel(level) {
  return clamp(toInt(level, MIN_LEVEL, MIN_LEVEL), MIN_LEVEL, MAX_LEVEL);
}

/**
 * Combat readouts, taken straight from the live stats and the shared combat
 * constants. Level does not scale these — the game does not scale them either.
 * @param {object} stats
 */
function deriveCombat(stats) {
  return [
    { key: "physicalAtk", label: "Ngoại công", value: String(toInt(stats.attack, BASE_ATTACK, 0)) },
    { key: "physicalDef", label: "Ngoại phòng", value: String(toInt(stats.defense, BASE_DEFENSE, 0)) },
    { key: "crit", label: "Chí mạng", value: asPercent(Math.min(1, toRate(stats.critRate, BASE_CRIT_RATE))) },
    {
      key: "critDamage",
      label: "Đòn chí mạng",
      value: asMultiplier(toRate(stats.critDamage, BASE_CRIT_DAMAGE))
    },
    {
      key: "attackSpeed",
      label: "Tốc độ đánh",
      value: asMultiplier(toRate(stats.attackSpeed, BASE_ATTACK_SPEED))
    }
  ];
}

/**
 * Build the full, render-ready character sheet from the live stats object.
 * @param {object} [stats]
 * @returns {{
 *   level: number,
 *   vitals: Array<{ key: string, label: string, value: string }>,
 *   combat: Array<{ key: string, label: string, value: string }>,
 *   footer: { points: number, nextLevelExp: number }
 * }}
 */
export function deriveCharacterSheet(stats = {}) {
  const level = normalizeLevel(stats.level);

  const maxHp = toInt(stats.maxHp, 100, 1);
  const maxMp = toInt(stats.maxMp, 60, 0);
  const hp = clamp(toInt(stats.hp, maxHp, 0), 0, maxHp);
  const mp = clamp(toInt(stats.mp, maxMp, 0), 0, maxMp);

  return {
    level,
    vitals: [
      { key: "hp", label: "Sinh lực", value: `${hp}/${maxHp}` },
      { key: "mp", label: "Nội lực", value: `${mp}/${maxMp}` }
    ],
    combat: deriveCombat(stats),
    footer: {
      points: 0,
      nextLevelExp: toInt(stats.nextExp, 100, 0)
    }
  };
}
