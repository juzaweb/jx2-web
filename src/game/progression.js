/**
 * Character progression model, shared by the client and the server.
 *
 * The server is the authority for a character's ledger (level, exp, coins,
 * kills): it applies every reward and derives the vitals (max HP/MP, EXP to the
 * next level) from the level alone. The client mirrors whatever the server
 * broadcasts, so it never decides its own progression. Keeping the curve here —
 * one module imported by both sides — is what keeps them in step.
 */

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 150;

/** Vitals of a level-1 character. */
export const BASE_MAX_HP = 100;
export const BASE_MAX_MP = 60;
export const BASE_NEXT_EXP = 100;

/** Growth applied on every level-up. */
export const NEXT_EXP_GROWTH = 1.45;
export const MAX_HP_GROWTH = 20;
export const MAX_MP_GROWTH = 10;

const toCount = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const clampLevel = (level) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, toCount(level, MIN_LEVEL)));

/**
 * EXP required to advance from `level` to the next one. `Math.floor` is applied
 * at each step, so the value is deterministic for a given level (and identical
 * on both sides of the wire).
 * @param {number} level
 * @returns {number}
 */
export function nextExpForLevel(level) {
  let nextExp = BASE_NEXT_EXP;
  for (let current = MIN_LEVEL; current < clampLevel(level); current += 1) {
    nextExp = Math.floor(nextExp * NEXT_EXP_GROWTH);
  }
  return nextExp;
}

/**
 * The vitals a level implies: HP/MP ceilings and the EXP needed to level up.
 * @param {number} level
 * @returns {{ maxHp: number, maxMp: number, nextExp: number }}
 */
export function vitalsForLevel(level) {
  const steps = clampLevel(level) - MIN_LEVEL;
  return {
    maxHp: BASE_MAX_HP + steps * MAX_HP_GROWTH,
    maxMp: BASE_MAX_MP + steps * MAX_MP_GROWTH,
    nextExp: nextExpForLevel(level)
  };
}

/**
 * Coerce untrusted input into a safe ledger, dropping anything malformed.
 * @param {{level?:number, exp?:number, coins?:number, kills?:number}} [input]
 * @returns {{ level: number, exp: number, coins: number, kills: number }}
 */
export function normalizeProgress(input = {}) {
  return {
    level: clampLevel(input.level),
    exp: toCount(input.exp),
    coins: toCount(input.coins),
    kills: toCount(input.kills)
  };
}

/**
 * Apply a reward to a ledger, resolving any level-ups. Pure: the same ledger and
 * reward always produce the same result. `levelUps` lets the caller announce the
 * promotion (and heal) without re-deriving it.
 * @param {{level:number, exp:number, coins:number, kills:number}} progress
 * @param {{exp?:number, coins?:number, kills?:number}} reward
 * @returns {{ level:number, exp:number, coins:number, kills:number, levelUps:number }}
 */
export function applyReward(progress, reward = {}) {
  const start = normalizeProgress(progress);
  let level = start.level;
  let exp = start.exp + toCount(reward.exp);
  const coins = start.coins + toCount(reward.coins);
  const kills = start.kills + toCount(reward.kills);

  let levelUps = 0;
  let needed = nextExpForLevel(level);
  while (exp >= needed && level < MAX_LEVEL) {
    exp -= needed;
    level += 1;
    levelUps += 1;
    needed = nextExpForLevel(level);
  }

  return { level, exp, coins, kills, levelUps };
}

/**
 * A ledger plus its derived vitals, shaped for the `player_progress` message and
 * for writing straight into the client's stats object.
 * @param {{level:number, exp:number, coins:number, kills:number}} progress
 * @returns {{ level:number, exp:number, nextExp:number, coins:number, kills:number, maxHp:number, maxMp:number }}
 */
export function progressPayload(progress) {
  const ledger = normalizeProgress(progress);
  return { ...ledger, ...vitalsForLevel(ledger.level) };
}
