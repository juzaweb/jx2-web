/**
 * Skill effect helpers shared by the client and the server.
 *
 * Effects are pure data on a catalog entry (`{ kind, ... }`). This module owns
 * the single interpretation of the self-targeted kinds (`buff`, `heal`) so the
 * authoritative server and the predictive client cannot disagree.
 *
 * Kinds that act on a *target* (`stun`, `slow`) and the always-on `regen` art are
 * resolved by their own modules (`enemyEffects.js`, `passiveRegen.js`).
 */

/**
 * Effects declared by a skill.
 * @param {Object} skill
 * @returns {Object[]}
 */
export function skillEffects(skill) {
  return Array.isArray(skill?.effects) ? skill.effects : [];
}

/**
 * Effects of one kind declared by a skill.
 * @param {Object} skill
 * @param {string} kind
 * @returns {Object[]}
 */
export function skillEffectsOfKind(skill, kind) {
  return skillEffects(skill).filter((effect) => effect?.kind === kind);
}

/**
 * Health per second an always-on regen art restores (0 when the skill has none).
 * @param {Object} skill
 * @returns {number}
 */
export function skillPassiveRegen(skill) {
  return skillEffectsOfKind(skill, "regen").reduce((total, effect) => {
    const rate = Number(effect.hpPerSecond);
    return total + (Number.isFinite(rate) && rate > 0 ? rate : 0);
  }, 0);
}

/**
 * Buffs a self-cast should record, including the optional VFX hints the client
 * uses to draw a formation ring or overhead seal for the buff's lifetime.
 * @param {Object} skill
 * @param {number} [now]
 * @returns {Object[]}
 */
export function selfBuffEntries(skill, now = Date.now()) {
  const vfx = skill?.vfx || {};
  const hints = {};
  if (vfx.type === "formation" && vfx.sprite) {
    hints.formationSprite = vfx.sprite;
    if (typeof vfx.scale === "number") hints.formationScale = vfx.scale;
  }
  if (vfx.type === "overhead" && vfx.overhead) {
    hints.overheadSprite = vfx.overhead;
    if (typeof vfx.overheadScale === "number") hints.overheadScale = vfx.overheadScale;
    if (typeof vfx.overheadOffsetY === "number") hints.overheadOffsetY = vfx.overheadOffsetY;
  }

  const entries = [];
  for (const effect of skillEffectsOfKind(skill, "buff")) {
    const amount = Number(effect.amount) || 0;
    const duration = Number(effect.duration) || 0;
    if (!effect.stat || duration <= 0) continue;
    entries.push({
      skillId: skill.id,
      stat: effect.stat,
      amount,
      until: now + duration,
      ...hints
    });
  }
  return entries;
}

/**
 * Health a self-cast restores, as `flat + pctMaxHp * maxHp` per heal effect.
 * @param {Object} skill
 * @param {number} [maxHp]
 * @returns {number}
 */
export function selfHealAmount(skill, maxHp = 0) {
  return skillEffectsOfKind(skill, "heal").reduce((total, effect) => {
    const flat = Number(effect.amount) || 0;
    const pct = Number(effect.pctMaxHp) || 0;
    const amount = Math.round(flat + maxHp * pct);
    return total + (amount > 0 ? amount : 0);
  }, 0);
}

/**
 * Apply a self-cast's effects to a combatant-like object.
 *
 * Buffs are appended to `target.buffs`; healing is clamped to `target.maxHp`.
 * The caller is responsible for broadcasting/persisting the result.
 *
 * @param {Object} skill
 * @param {{ hp?: number, maxHp?: number, buffs?: Object[] }} target
 * @param {number} [now]
 * @returns {{ statsChanged: boolean, healed: number }}
 */
export function applySelfEffects(skill, target, now = Date.now()) {
  if (!target || typeof target !== "object") return { statsChanged: false, healed: 0 };

  const buffs = selfBuffEntries(skill, now);
  let statsChanged = false;
  if (buffs.length > 0) {
    if (!Array.isArray(target.buffs)) target.buffs = [];
    target.buffs.push(...buffs);
    statsChanged = true;
  }

  const heal = selfHealAmount(skill, Number(target.maxHp) || 0);
  let healed = 0;
  if (heal > 0) {
    const maxHp = Number(target.maxHp) || 0;
    const before = Number(target.hp) || 0;
    target.hp = Math.min(maxHp, before + heal);
    healed = Math.max(0, target.hp - before);
  }

  return { statsChanged, healed };
}
