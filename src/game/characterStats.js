/**
 * Character sheet derivation.
 *
 * The game currently persists only a small set of live values (level, HP, MP,
 * stamina, exp, kills). The full JX2 sheet exposes many combat attributes that
 * have no backing model yet, so for this phase every derived value is computed
 * from the character level by a deterministic formula. Nothing here affects
 * combat — it is presentation only, and the shape is kept flat/testable so a
 * real attribute + equipment model can replace the formulas later without
 * touching the modal.
 */

const MIN_LEVEL = 1;
const MAX_LEVEL = 999;

const toInt = (value, fallback, min = Number.NEGATIVE_INFINITY) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.round(n));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const range = (min, max) => `${min}-${max}`;
const percentFlat = (percent, flat) => `${percent}%+${flat}`;

/**
 * Coerce any input into a usable, in-range character level.
 * @param {unknown} level
 * @returns {number}
 */
export function normalizeLevel(level) {
  return clamp(toInt(level, MIN_LEVEL, MIN_LEVEL), MIN_LEVEL, MAX_LEVEL);
}

/**
 * Attributes grow with level. `base` is the untrained floor (1) and `bonus` is
 * the level-driven growth; a future equipment model would add a second bonus.
 * @param {number} level
 */
function deriveAttributes(level) {
  const steps = level - 1;
  return [
    { key: "strength", label: "Sức mạnh", base: 1, bonus: steps },
    { key: "internal", label: "Nội công", base: 1, bonus: steps * 2 },
    { key: "bone", label: "Gân cốt", base: 1, bonus: Math.floor(steps * 0.8) },
    { key: "agility", label: "Thân pháp", base: 1, bonus: Math.floor(steps * 1.2) },
    { key: "flexibility", label: "Linh hoạt", base: 1, bonus: 0 }
  ];
}

/**
 * Combat readouts derived from level. Ranges (min-max) and "percent+flat"
 * defences mirror how the original JX2 sheet formats these values.
 * @param {number} level
 */
function deriveCombat(level) {
  const steps = level - 1;

  const physicalAtkMin = 240 + steps * 4;
  const physicalAtkMax = physicalAtkMin + 40 + steps * 8;
  const chiAtkMin = 245 + steps * 4;
  const chiAtkMax = chiAtkMin + 40 + steps * 6;

  return [
    { key: "physicalAtk", label: "Ngoại công", value: range(physicalAtkMin, physicalAtkMax) },
    { key: "chiAtk", label: "Nội kích", value: range(chiAtkMin, chiAtkMax) },
    { key: "damage", label: "Sát thương", value: String(0) },
    { key: "accuracy", label: "Chính xác", value: String(900 + steps * 5) },
    { key: "physicalDef", label: "Ngoại phòng", value: percentFlat(0, 8 + steps) },
    { key: "magicDef", label: "Nội phòng", value: percentFlat(0, 20 + steps * 2) },
    { key: "dodge", label: "Né tránh", value: String(10 + steps * 2) },
    { key: "crit", label: "Chí mạng", value: String(1 + Math.floor(steps / 5)) },
    { key: "critResist", label: "Khắc nộ", value: String(1 + Math.floor(steps / 10)) },
    { key: "cast", label: "Xuất chiêu", value: String(0) },
    { key: "attackSpeed", label: "Tốc độ đánh", value: String(60 + steps * 3) },
    { key: "moveSpeed", label: "Tốc độ di chuyển", value: "5/14" }
  ];
}

/**
 * Build the full, render-ready character sheet from the live stats object.
 * @param {object} [stats]
 * @returns {{
 *   level: number,
 *   name: string,
 *   vitals: Array<{ key: string, label: string, value: string }>,
 *   combat: Array<{ key: string, label: string, value: string }>,
 *   attributes: Array<{ key: string, label: string, base: number, bonus: number }>,
 *   footer: { points: number, nextLevelExp: number, potential: number }
 * }}
 */
export function deriveCharacterSheet(stats = {}) {
  const level = normalizeLevel(stats.level);

  const maxHp = toInt(stats.maxHp, 100, 1);
  const maxMp = toInt(stats.maxMp, 60, 0);
  const maxSta = toInt(stats.maxSta, 100, 1);
  const hp = clamp(toInt(stats.hp, maxHp, 0), 0, maxHp);
  const mp = clamp(toInt(stats.mp, maxMp, 0), 0, maxMp);
  const sta = clamp(toInt(stats.sta, maxSta, 0), 0, maxSta);

  return {
    level,
    name: typeof stats.name === "string" ? stats.name : "",
    vitals: [
      { key: "hp", label: "Sinh", value: `${hp}/${maxHp}` },
      { key: "mp", label: "Nội", value: `${mp}/${maxMp}` },
      { key: "sta", label: "Thể", value: `${sta}/${maxSta}` }
    ],
    combat: deriveCombat(level),
    attributes: deriveAttributes(level),
    footer: {
      points: 0,
      nextLevelExp: toInt(stats.nextExp, 100, 0),
      potential: level * 3
    }
  };
}
