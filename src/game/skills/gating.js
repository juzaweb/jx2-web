/**
 * Skill learning and cast gating.
 *
 * A hero only knows the starter skill for free; every other skill is learned
 * from a book (character level 10+), and `requires` lists the skills that must
 * already be learned. Casting a known art is gated by its own `unlockLevel`.
 * These helpers are shared by the client (hotbar/tree gates) and the server
 * (authoritative cast and book validation).
 */

import { SKILLS_BY_ID } from "./registry.js";
import { characterLevelForSkillLevel } from "./levels.js";

/**
 * Prerequisite list of a skill (empty when it is a tree root).
 * @param {Object|string} skill
 * @returns {{ id: string, level: number }[]}
 */
export function skillRequires(skill) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  return Array.isArray(entry?.requires) ? entry.requires : [];
}

/**
 * Normalise a caller-supplied level to a usable integer.
 * @param {*} level
 * @returns {number}
 */
function normalizedLevel(level) {
  return Number.isFinite(level) ? Math.floor(level) : 1;
}

/** Depth guard so a malformed (cyclic) catalog can never hang a reader. */
const MAX_REQUIRE_DEPTH = 8;

/**
 * Coerce the learned-skill payload into a Set, or null when the caller did not
 * provide one (legacy level-only callers).
 * @param {*} learned
 * @returns {Set<string>|null}
 */
function toLearnedSet(learned) {
  if (learned instanceof Set) return learned;
  if (Array.isArray(learned)) {
    return new Set(learned.filter((id) => typeof id === "string"));
  }
  return null;
}

/** Whether `entry` is known, treating starter skills as always known. */
function knowsEntry(entry, learnedSet) {
  if (!entry) return false;
  if (entry.starter === true) return true;
  return Boolean(learnedSet && learnedSet.has(entry.id));
}

function isEntryUnlocked(entry, level, depth, seen) {
  if (!entry || depth > MAX_REQUIRE_DEPTH || seen.has(entry.id)) return false;
  if (level < entry.unlockLevel) return false;

  const requires = Array.isArray(entry.requires) ? entry.requires : [];
  if (requires.length === 0) return true;

  const nextSeen = new Set(seen).add(entry.id);
  return requires.every((req) => {
    const prerequisite = SKILLS_BY_ID.get(req.id);
    if (!prerequisite) return false;
    const requiredLevel = req.level ?? prerequisite.unlockLevel;
    if (level < requiredLevel) return false;
    return isEntryUnlocked(prerequisite, level, depth + 1, nextSeen);
  });
}

/**
 * Whether a skill's level and prerequisite levels are satisfied (legacy,
 * level-only gate used before book learning existed).
 * @param {Object|string} skill
 * @param {number} level
 * @returns {boolean}
 */
export function skillUnlocked(skill, level) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  return isEntryUnlocked(entry, normalizedLevel(level), 0, new Set());
}

/**
 * Whether the hero knows a skill. Starter skills are always known.
 * @param {Object|string} skill
 * @param {Iterable<string>|Set<string>} learned learned skill ids
 * @returns {boolean}
 */
export function skillLearned(skill, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  return knowsEntry(entry, toLearnedSet(learned));
}

/** Whether a catalog entry is the free starter skill. */
export function skillStarter(skill) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  return Boolean(entry?.starter);
}

/**
 * The first prerequisite of `skill` the hero has not learned yet, or null.
 * @param {Object|string} skill
 * @param {Iterable<string>|Set<string>} learned
 * @returns {{ id: string, nameKey?: string, level: number }|null}
 */
export function skillMissingPrereq(skill, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return null;
  const learnedSet = toLearnedSet(learned) || new Set();

  for (const req of skillRequires(entry)) {
    const prerequisite = SKILLS_BY_ID.get(req.id);
    if (!prerequisite) {
      return { id: req.id, level: req.level ?? 1 };
    }
    if (!knowsEntry(prerequisite, learnedSet)) {
      return {
        id: prerequisite.id,
        nameKey: prerequisite.nameKey,
        level: prerequisite.unlockLevel
      };
    }
  }
  return null;
}

/**
 * Whether a book for this skill can be studied right now: the character level is
 * high enough (never below the study floor) and every prerequisite is learned.
 * @param {Object|string} skill
 * @param {number} level
 * @param {Iterable<string>|Set<string>} learned
 * @returns {boolean}
 */
export function skillLearnable(skill, level, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  if (normalizedLevel(level) < characterLevelForSkillLevel(entry, 1)) return false;
  return skillMissingPrereq(entry, learned) === null;
}

/**
 * Whether the hero may cast this skill: it is learned (or starter) and the
 * character level is high enough.
 * @param {Object|string} skill
 * @param {number} level
 * @param {Iterable<string>|Set<string>} learned
 * @returns {boolean}
 */
export function skillUsable(skill, level, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  if (normalizedLevel(level) < entry.unlockLevel) return false;
  return knowsEntry(entry, toLearnedSet(learned));
}

/**
 * Why a skill is still locked, or `null` when the skill is available.
 *
 * `{ kind: "level", level }` means the character level is still too low;
 * `{ kind: "prereq", id, nameKey, level }` means another skill must be learned
 * first; `{ kind: "book" }` means the prerequisites are met but the skill has
 * not been studied from its book yet. An unknown skill id yields `null`.
 *
 * @param {Object|string} skill
 * @param {number} level
 * @param {Iterable<string>|Set<string>|null} [learned=null] learned skill ids;
 *   pass null for the legacy level-only gate.
 * @returns {{ kind: "level"|"prereq"|"book", level?: number, id?: string,
 *   nameKey?: string }|null}
 */
export function skillLockReason(skill, level, learned = null) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return null;

  const current = normalizedLevel(level);
  const learnedSet = toLearnedSet(learned);
  const known = knowsEntry(entry, learnedSet);

  // An art the hero does not know yet is gated by its book requirement (the
  // catalog level, floored at the study minimum); a known art only by its own
  // unlockLevel, so a legacy save that learned early stays castable.
  const requiredLevel = learnedSet && !known
    ? characterLevelForSkillLevel(entry, 1)
    : entry.unlockLevel;
  if (current < requiredLevel) {
    return { kind: "level", level: requiredLevel };
  }

  if (learnedSet) {
    if (!known) {
      const missing = skillMissingPrereq(entry, learnedSet);
      if (missing) return { kind: "prereq", ...missing };
      return { kind: "book" };
    }
    return null;
  }

  for (const req of skillRequires(entry)) {
    const prerequisite = SKILLS_BY_ID.get(req.id);
    const requiredLevel = req.level ?? prerequisite?.unlockLevel ?? 1;

    if (current < requiredLevel) {
      return {
        kind: "prereq",
        id: prerequisite?.id ?? req.id,
        nameKey: prerequisite?.nameKey,
        level: requiredLevel
      };
    }
    if (prerequisite && !isEntryUnlocked(prerequisite, current, 1, new Set([entry.id]))) {
      return {
        kind: "prereq",
        id: prerequisite.id,
        nameKey: prerequisite.nameKey,
        level: prerequisite.unlockLevel
      };
    }
  }

  return null;
}
