/**
 * Skill catalog schema and authoring helpers.
 *
 * Every catalog entry is authored through {@link defineSkill}, which validates the
 * entry's shape and freezes it. The full catalog is then cross-checked by
 * {@link validateSkillCatalog}: unique ids, unique slots per weapon kit, the
 * weapon matching its kit, and prerequisites resolving inside the same kit.
 *
 * Validation runs in development and test builds only, so a settled production
 * build pays nothing for it.
 */

import { VFX_PRESETS, expandVfxPreset } from "./presets.js";
import { SECTS } from "../sects.js";

/** Effect kinds the engine understands. Unknown kinds are ignored by readers. */
export const EFFECT_KINDS = Object.freeze(["regen", "stun", "buff", "heal", "slow"]);

/** Target kinds a skill may declare. */
export const TARGET_KINDS = Object.freeze(["self", "enemy"]);

/** Fields every skill must declare, with their numeric/string expectations. */
const REQUIRED_STRINGS = Object.freeze(["id", "weapon", "glyph", "nameKey", "descKey"]);
const REQUIRED_NUMBERS = Object.freeze([
  "slot",
  "unlockLevel",
  "mp",
  "cooldown",
  "range",
  "radius",
  "mult"
]);

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Whether schema assertions should run (everything except a production build). */
const assertionsEnabled = () => {
  const env = globalThis.process?.env?.NODE_ENV;
  return env !== "production";
};

/**
 * Validate a single skill definition.
 * @param {Object} skill
 * @returns {string[]} human-readable problems; empty when valid
 */
export function validateSkill(skill) {
  if (!skill || typeof skill !== "object") return ["skill entry must be an object"];

  const problems = [];

  if (typeof skill.id !== "string" || !ID_PATTERN.test(skill.id)) {
    problems.push(`id must match ${ID_PATTERN} (got ${JSON.stringify(skill.id)})`);
  }
  for (const key of REQUIRED_STRINGS) {
    if (typeof skill[key] !== "string" || skill[key].length === 0) {
      problems.push(`${key} must be a non-empty string`);
    }
  }
  if (!TARGET_KINDS.includes(skill.target)) {
    problems.push(`target must be one of ${TARGET_KINDS.join(", ")}`);
  }
  for (const key of REQUIRED_NUMBERS) {
    if (!isFiniteNumber(skill[key]) || skill[key] < 0) {
      problems.push(`${key} must be a non-negative finite number`);
    }
  }
  if (isFiniteNumber(skill.slot) && !Number.isInteger(skill.slot)) {
    problems.push("slot must be an integer");
  }
  if (isFiniteNumber(skill.unlockLevel) && skill.unlockLevel < 1) {
    problems.push("unlockLevel must be at least 1");
  }
  if (skill.icon !== undefined && typeof skill.icon !== "string") {
    problems.push("icon must be a string when set");
  }
  if (skill.vfx?.preset !== undefined && !VFX_PRESETS[skill.vfx.preset]) {
    problems.push(`unknown vfx preset ${JSON.stringify(skill.vfx.preset)}`);
  }
  // Arts are studied in the F5 tree now, so a book declaration is stale metadata.
  if (skill.book !== undefined) {
    problems.push("book metadata is no longer supported (arts are studied in the F5 tree)");
  }
  if (skill.requires !== undefined) {
    if (!Array.isArray(skill.requires)) {
      problems.push("requires must be an array");
    } else {
      for (const req of skill.requires) {
        if (!req || typeof req.id !== "string" || req.id.length === 0) {
          problems.push("requires entries need a non-empty string id");
        } else if (req.level !== undefined && (!isFiniteNumber(req.level) || req.level < 1)) {
          problems.push(`requires.level for ${req.id} must be a positive number`);
        }
      }
    }
  }
  if (skill.effects !== undefined) {
    if (!Array.isArray(skill.effects)) {
      problems.push("effects must be an array");
    } else {
      for (const effect of skill.effects) {
        if (!effect || !EFFECT_KINDS.includes(effect.kind)) {
          problems.push(`unknown effect kind ${JSON.stringify(effect?.kind)}`);
        }
      }
    }
  }

  return problems;
}

/**
 * Declare one catalog entry: validated in development/test, then frozen so a
 * reader can never mutate shared catalog data.
 * @template T
 * @param {T} entry
 * @returns {Readonly<T>}
 */
export function defineSkill(entry) {
  if (assertionsEnabled()) {
    const problems = validateSkill(entry);
    if (problems.length > 0) {
      throw new Error(`Invalid skill "${entry?.id}": ${problems.join("; ")}`);
    }
  }
  // Expand `vfx.preset` at the authoring boundary so every reader sees concrete
  // fields and no consumer needs to resolve presets itself.
  const vfx = expandVfxPreset(entry?.vfx);
  if (vfx === entry?.vfx) return Object.freeze(entry);
  return Object.freeze({ ...entry, vfx: Object.freeze(vfx) });
}

/**
 * Cross-check a full catalog: unique ids, one slot per kit, weapon/kit match and
 * prerequisite integrity.
 *
 * @param {ReadonlyArray<Object>} skills flat catalog
 * @param {Record<string, ReadonlyArray<Object>>} [kits] sect id -> entries
 * @returns {string[]} human-readable problems; empty when valid
 */
export function validateSkillCatalog(skills = [], kits = {}) {
  const problems = [];
  const byId = new Map();
  const slotOwners = new Map();
  const kitIds = new Set(Object.keys(kits));

  for (const skill of skills) {
    for (const problem of validateSkill(skill)) {
      problems.push(`${skill?.id ?? "<unknown>"}: ${problem}`);
    }
    if (byId.has(skill.id)) {
      problems.push(`${skill.id}: duplicate id`);
    }
    byId.set(skill.id, skill);
    if (kitIds.size > 0) {
      let owner = null;
      for (const [sect, entries] of Object.entries(kits)) {
        if (entries.some((entry) => entry?.id === skill.id)) {
          owner = sect;
          break;
        }
      }
      if (!owner) problems.push(`${skill.id}: belongs to no sect kit`);
    }
  }

  for (const [sect, entries] of Object.entries(kits)) {
    const expectedWeapon = SECTS[sect]?.weapon;
    if (!expectedWeapon) problems.push(`unknown sect kit "${sect}"`);

    for (const skill of entries) {
      if (expectedWeapon && skill.weapon !== expectedWeapon) {
        problems.push(
          `${skill.id}: weapon "${skill.weapon}" does not match sect "${sect}" (${expectedWeapon})`
        );
      }
      const slotKey = `${sect}:${skill.slot}`;
      if (slotOwners.has(slotKey)) {
        problems.push(
          `${skill.id}: slot ${skill.slot} in kit "${sect}" is already used by ${slotOwners.get(slotKey)}`
        );
      }
      slotOwners.set(slotKey, skill.id);
    }

    const starters = entries.filter((skill) => skill?.starter === true);
    if (starters.length !== 1) {
      problems.push(`kit "${sect}": exactly one starter is required (got ${starters.length})`);
    } else if (starters[0].slot !== 0) {
      problems.push(`kit "${sect}": starter ${starters[0].id} must sit in slot 0`);
    }
  }

  for (const skill of skills) {
    for (const req of skill.requires || []) {
      const parent = byId.get(req.id);
      if (!parent) {
        problems.push(`${skill.id}: unknown prerequisite "${req.id}"`);
      } else if (parent.weapon !== skill.weapon) {
        problems.push(
          `${skill.id}: prerequisite "${req.id}" belongs to weapon "${parent.weapon}"`
        );
      }
    }
  }

  return problems;
}
