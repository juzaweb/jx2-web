import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EFFECT_KINDS,
  SKILLS,
  SKILLS_BY_SECT,
  skillById,
  validateSkillCatalog
} from "./index.js";
import { auditSkillContent } from "../../../scripts/validate-skills.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Every `.js` file under `dir`, recursively. */
function collectJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectJsFiles(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

describe("skill catalog schema", () => {
  it("keeps the catalog structurally valid", () => {
    expect(validateSkillCatalog(SKILLS, SKILLS_BY_SECT)).toEqual([]);
  });

  it("has sect kits, assets and translations for every skill", () => {
    const { problems } = auditSkillContent({ rootDir: ROOT });
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("only uses effect kinds the engine understands", () => {
    for (const skill of SKILLS) {
      for (const effect of skill.effects || []) {
        expect(EFFECT_KINDS, `${skill.id} uses ${effect.kind}`).toContain(effect.kind);
      }
    }
  });

  it("expands vfx presets into concrete fields at authoring time", () => {
    const palm = skillById("la_han_quyen")?.vfx;
    expect(palm).toMatchObject({ cast: "shockwave", color: 0xffc94d });
    expect(palm.preset).toBeUndefined();

    const aura = skillById("kim_cang_bat_hoai")?.vfx;
    expect(aura).toMatchObject({
      type: "overhead",
      cast: "aura",
      overhead: "buff-phat-an"
    });
    expect(aura.preset).toBeUndefined();
  });

  it("keeps the server-safe skill modules free of Phaser and DOM access", () => {
    const dir = path.join(ROOT, "src/game/skills");
    const serverSafeFiles = collectJsFiles(dir).filter(
      (file) => !file.includes(`${path.sep}client${path.sep}`)
    );

    expect(serverSafeFiles.length).toBeGreaterThan(0);
    for (const file of serverSafeFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, `${file} must not import Phaser`).not.toMatch(/from\s+["']phaser["']/);
      expect(source, `${file} must not touch the DOM`).not.toMatch(/\b(document|window)\./);
    }
  });
});
