#!/usr/bin/env node
/**
 * Content audit for the skill catalog.
 *
 * Run with `npm run validate:skills`. Beyond the structural schema
 * (`validateSkillCatalog`), it checks the things that only make sense against the
 * whole repo:
 *
 * - every skill has a translated name and description in vi/en/zh;
 * - every learnable skill has book metadata with at least one hunting tier;
 * - every drop tier names a real monster;
 * - a declared icon / VFX sprite / overhead image exists under `public/`;
 * - every VFX preset reference exists.
 *
 * Exported as {@link auditSkillContent} so the unit tests can reuse it without
 * shelling out.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SKILLS,
  SKILLS_BY_WEAPON,
  validateSkillCatalog
} from "../src/game/skills/index.js";
import { MONSTERS, MONSTER_BOOK_CHANCES } from "../src/game/enemyCatalog.js";
import { OVERHEAD_IMAGES, VFX_SPRITES } from "../src/game/lazyAssets.js";
import { translateFor } from "../src/i18n/translator.js";

const LANGUAGES = ["vi", "en", "zh"];

/**
 * @param {string} rootDir absolute repository root
 * @param {string} publicUrl a `/`-prefixed asset URL
 * @returns {boolean}
 */
const assetExists = (rootDir, publicUrl) =>
  fs.existsSync(path.join(rootDir, "public", publicUrl.replace(/^\//, "")));

/**
 * Audit the catalog against the repo assets and translations.
 * @param {{ rootDir: string, skills?: ReadonlyArray<Object>, kits?: Record<string, ReadonlyArray<Object>> }} options
 * @returns {{ problems: string[], warnings: string[] }}
 */
export function auditSkillContent({ rootDir, skills = SKILLS, kits = SKILLS_BY_WEAPON }) {
  const problems = validateSkillCatalog(skills, kits).map((problem) => `catalog: ${problem}`);
  const warnings = [];
  const monsterIds = new Set(Object.keys(MONSTERS));

  for (const skill of skills) {
    const label = `skill "${skill.id}"`;

    for (const lang of LANGUAGES) {
      const name = translateFor(lang, skill.nameKey, undefined, null);
      const desc = translateFor(lang, skill.descKey, undefined, null);
      if (!name || name === skill.nameKey) problems.push(`${label}: missing ${lang} name`);
      if (!desc || desc === skill.descKey) problems.push(`${label}: missing ${lang} desc`);
    }

    if (skill.starter) {
      if (skill.book) problems.push(`${label}: starter skills must not declare a book`);
    } else if (!skill.book) {
      problems.push(`${label}: missing book metadata (viName + dropTiers)`);
    } else {
      for (const tier of skill.book.dropTiers || []) {
        if (!monsterIds.has(tier)) problems.push(`${label}: unknown drop tier "${tier}"`);
      }
    }

    if (skill.icon && !assetExists(rootDir, skill.icon)) {
      problems.push(`${label}: icon file missing (${skill.icon})`);
    }

    const sprite = skill.vfx?.sprite;
    if (sprite) {
      const def = VFX_SPRITES[sprite];
      if (!def) problems.push(`${label}: unknown vfx sprite "${sprite}"`);
      else if (!assetExists(rootDir, def.url)) {
        problems.push(`${label}: vfx sheet missing (${def.url})`);
      }
    }

    const overhead = skill.vfx?.overhead;
    if (overhead) {
      const url = OVERHEAD_IMAGES[overhead];
      if (!url) problems.push(`${label}: unknown overhead image "${overhead}"`);
      else if (!assetExists(rootDir, url)) {
        problems.push(`${label}: overhead image missing (${url})`);
      }
    }
  }

  for (const monsterId of Object.keys(MONSTER_BOOK_CHANCES)) {
    const pool = skills.filter((skill) => skill.book?.dropTiers?.includes(monsterId));
    if (pool.length === 0) {
      warnings.push(`monster "${monsterId}": book chance configured but no skill drops there`);
    }
  }

  return { problems, warnings };
}

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
};

if (isDirectRun()) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { problems, warnings } = auditSkillContent({ rootDir });

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`error: ${problem}`);
    console.error(`\n✖ ${problems.length} problem(s) in the skill catalog.`);
    process.exitCode = 1;
  } else {
    console.log(`✔ Skill catalog OK (${SKILLS.length} skills, ${warnings.length} warning(s)).`);
  }
}
