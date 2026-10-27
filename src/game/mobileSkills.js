/**
 * Per-character skill bindings for the mobile arc buttons.
 *
 * The mobile cluster has {@link MOBILE_SKILL_SLOTS} buttons and starts empty: a
 * player taps a "+" button, picks a weapon skill, and that button casts it. The
 * bindings are stored as an array of skill ids (null = empty button).
 *
 * Storage and sanitising rules live in `createSlotBindings`, shared with the
 * mobile consumable buttons.
 */

import { createSlotBindings } from "./slotBindings.js";

const STORAGE_PREFIX = "jx2_mobile_skills_";

export const MOBILE_SKILL_SLOTS = 4;

const bindings = createSlotBindings({
  slotCount: MOBILE_SKILL_SLOTS,
  storagePrefix: STORAGE_PREFIX
});

/** Empty bindings: every arc button starts as an unassigned "+". */
export const DEFAULT_MOBILE_SKILLS = bindings.DEFAULT;

/** Coerce raw storage into a fixed-length array of skill ids. */
export const sanitizeMobileSkills = bindings.sanitize;

/** Load a character's mobile skill bindings. */
export const loadMobileSkills = bindings.load;

/** Persist a character's mobile skill bindings. */
export const saveMobileSkills = bindings.save;

/** Assign (or clear) the skill bound to one arc button. */
export const assignMobileSkill = bindings.assign;

