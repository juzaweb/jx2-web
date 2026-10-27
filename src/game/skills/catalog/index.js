/**
 * Authored skill catalog, split one file per weapon kit.
 *
 * The flat {@link SKILLS} list is the catalog order used by registries, books
 * and tests: bao tay first, then sword, then saber.
 */

import { BAO_TAY_SKILLS } from "./baoTay.js";
import { KIEM_SKILLS } from "./kiem.js";
import { DAO_SKILLS } from "./dao.js";

/** Skill lists keyed by weapon type id. Key order is part of the public catalog. */
export const SKILL_KITS = Object.freeze({
  "bao-tay": BAO_TAY_SKILLS,
  kiem: KIEM_SKILLS,
  dao: DAO_SKILLS
});

/** All authored skills, in catalog order. */
export const SKILLS = Object.freeze([...BAO_TAY_SKILLS, ...KIEM_SKILLS, ...DAO_SKILLS]);
