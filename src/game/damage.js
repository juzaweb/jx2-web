/**
 * Pure combat damage calculation, shared by the client (`combat.js`) and the
 * server (`server/src/websocket/gameSocket.js`). Kept free of Phaser so the server
 * can import it directly when it owns a monster's bite or an authoritative hit.
 */

/**
 * Apply attack-minus-defense mitigation, a critical strike roll, variance, and a
 * minimum floor of 1 damage.
 *
 * @param {Object} attacker - Attacker entity or stats object
 * @param {Object} defender - Defender entity or stats object
 * @param {Function|number} [rng=Math.random] - RNG function returning [0, 1) or static number
 * @param {Object} [options={}] - Optional modifiers and overrides
 * @param {number} [options.attack] - Override attacker attack power
 * @param {number} [options.baseDamage] - Alias override for attack power
 * @param {number} [options.defense] - Override defender defense
 * @param {number} [options.critRate] - Override attacker crit rate
 * @param {number} [options.critDamage] - Override attacker crit multiplier
 * @param {number} [options.skillMult=1] - Skill multiplier applied to mitigated damage
 * @param {number} [options.variance=0.1] - Variance fraction (e.g. 0.1 for ±10%, 0 to disable)
 * @param {number} [options.critRoll] - Explicit roll for crit check (< critRate)
 * @param {number} [options.varianceRoll] - Explicit roll for variance ([0, 1])
 * @returns {{ damage: number, crit: boolean }}
 */
export function computeDamage(attacker, defender, rng = Math.random, options = {}) {
  const nextRng = () => {
    if (typeof rng === "function") return rng();
    if (typeof rng === "number") return rng;
    return Math.random();
  };

  const attackerAttack =
    options.attack ??
    options.baseDamage ??
    attacker?.attack ??
    attacker?.stats?.attack ??
    10;
  const defenderDefense =
    options.defense ??
    defender?.defense ??
    defender?.stats?.defense ??
    0;
  const skillMult = typeof options.skillMult === "number" ? options.skillMult : 1;

  const critRate =
    options.critRate ??
    attacker?.critRate ??
    attacker?.stats?.critRate ??
    0.05;
  const critDamage =
    options.critDamage ??
    attacker?.critDamage ??
    attacker?.stats?.critDamage ??
    1.5;

  // 1. Critical strike roll (< critRate)
  const critRoll = options.critRoll !== undefined ? options.critRoll : nextRng();
  const isCrit = critRoll < critRate;

  // 2. Base mitigated damage with floor of 1
  const rawMitigated = Math.max(1, (attackerAttack - defenderDefense) * skillMult);

  // 3. Variance roll (e.g. ±10%)
  const variance = options.variance !== undefined ? options.variance : 0.1;
  let varianceFactor = 1;
  if (variance > 0) {
    const varRoll = options.varianceRoll !== undefined ? options.varianceRoll : nextRng();
    varianceFactor = 1 + (varRoll * 2 - 1) * variance;
  }

  let finalDamage = Math.max(1, rawMitigated * varianceFactor);

  // 4. Critical damage multiplier applied on crit
  if (isCrit) {
    finalDamage = Math.max(1, finalDamage * critDamage);
  }

  return {
    damage: Math.max(1, Math.round(finalDamage)),
    crit: Boolean(isCrit)
  };
}
