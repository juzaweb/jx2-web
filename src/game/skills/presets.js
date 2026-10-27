/**
 * Presentation presets for skill VFX and icons.
 *
 * A catalog entry may name a shared recipe with `vfx: { preset: "aura" }` and
 * override only what differs. {@link expandVfxPreset} is applied by `defineSkill`,
 * so every reader sees a concrete `vfx` block — no reader has to know about
 * presets, and a preset cannot be honoured by one code path but forgotten by
 * another.
 */

/** Reusable VFX recipes keyed by preset name. */
export const VFX_PRESETS = Object.freeze({
  /** Quick melee slash: a short arc followed by a spark. */
  slash: Object.freeze({ cast: "slash", impact: "spark" }),
  /** Palm burst: a shockwave ring released at the caster. */
  palm: Object.freeze({ cast: "shockwave", color: 0xffb347 }),
  /** Ground formation ring that follows the caster while the buff runs. */
  formation: Object.freeze({ type: "formation", cast: "shockwave", impact: null }),
  /** Overhead seal above the hero while the buff runs. */
  aura: Object.freeze({ type: "overhead", cast: "aura", impact: null })
});

/**
 * Expand a `vfx.preset` into its concrete recipe, letting the entry's own keys
 * win. Unknown presets are left untouched; `validateSkill` reports them.
 * @param {Object|undefined} vfx
 * @returns {Object|undefined} an expanded copy, or the input when there is nothing to expand
 */
export function expandVfxPreset(vfx) {
  if (!vfx?.preset) return vfx;
  const { preset, ...overrides } = vfx;
  const recipe = VFX_PRESETS[preset];
  if (!recipe) return vfx;
  return { ...recipe, ...overrides };
}

/**
 * Icon path a skill declares, or null.
 *
 * Icons stay optional: `SkillIcon` falls back to the skill glyph, so art can be
 * shipped after the skill exists. The content validator reports a declared icon
 * whose file is missing.
 * @param {Object} skill
 * @returns {string|null}
 */
export function resolveSkillIcon(skill) {
  return typeof skill?.icon === "string" && skill.icon.length > 0 ? skill.icon : null;
}

