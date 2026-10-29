/**
 * Localised "why is this skill still locked" label, shared by the skill tree,
 * the mouse-skill picker and combat logs.
 */

import { translate } from "../i18n/translator.js";
import { skillLockReason } from "./skills.js";

/**
 * Format an already-computed lock reason. Callers that need both the text and
 * the blocking level (e.g. the tree tile badge) should compute the reason once
 * with `skillLockReason` and pass it here.
 *
 * @param {ReturnType<typeof skillLockReason>} reason
 * @param {(key: string, params?: Object, fallback?: string) => string} [t]
 * @returns {string} Empty string when `reason` is null.
 */
export function formatSkillLock(reason, t = translate) {
  if (!reason) return "";

  if (reason.kind === "learn") {
    return t("skills.picker.learnable");
  }

  if (reason.kind === "prereq") {
    return t("skills.tree.requires", {
      name: t(reason.nameKey, undefined, reason.id),
      level: reason.level
    });
  }

  return t("skills.picker.locked", { level: reason.level });
}

/**
 * @param {Object} skill Catalog entry.
 * @param {number} level Character level.
 * @param {Iterable<string>|Set<string>|null} [learned=null] learned skill ids.
 * @param {(key: string, params?: Object, fallback?: string) => string} [t]
 *   Translator; defaults to the active runtime language.
 * @returns {string} Empty string when the skill is available.
 */
export function skillLockLabel(skill, level, learned = null, t = translate) {
  return formatSkillLock(skillLockReason(skill, level, learned), t);
}
