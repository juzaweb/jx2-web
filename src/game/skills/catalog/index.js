/**
 * Authored skill catalog, split one file per sect.
 *
 * The flat {@link SKILLS} list is the catalog order used by registries and
 * tests: Thiếu Lâm, Võ Đang, Nga My, then Ngũ Độc.
 */

import { THIEU_LAM_SKILLS } from "./baoTay.js";
import { NGA_MY_SKILLS, VO_DANG_SKILLS } from "./kiem.js";
import { NGU_DOC_SKILLS } from "./dao.js";

/** Skill lists keyed by sect id. Key order is part of the public catalog. */
export const SKILL_KITS = Object.freeze({
  "thieu-lam": THIEU_LAM_SKILLS,
  "vo-dang": VO_DANG_SKILLS,
  "nga-my": NGA_MY_SKILLS,
  "ngu-doc": NGU_DOC_SKILLS
});

/** All authored skills, in catalog order. */
export const SKILLS = Object.freeze([
  ...THIEU_LAM_SKILLS,
  ...VO_DANG_SKILLS,
  ...NGA_MY_SKILLS,
  ...NGU_DOC_SKILLS
]);
