import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyCastSelfEffects,
  castRejection,
  isInsideCastArea,
  resolveSkillHit,
  splashDamage,
  learnRejection,
  upgradeRejection
} from "../src/game/skillCast.js";
import { MAX_SKILL_LEVEL, characterLevelForSkillLevel, skillById } from "../../src/game/skills.js";
import { NORMAL_ATTACK_MULT } from "../../src/game/combatConfig.js";

/** A server player object with just the fields the cast rules read. */
const player = (overrides = {}) => ({
  id: "p1",
  weaponType: "kiem",
  level: 10,
  learnedSkills: [],
  hp: 50,
  maxHp: 100,
  buffs: [],
  ...overrides
});

describe("server skill cast rules", () => {
  it("refuses passives before anything else", () => {
    const passive = skillById("thieu_lam_tam_phap");
    assert.equal(castRejection(passive, player({ weaponType: "bao-tay", learnedSkills: [] })), "passive");
  });

  it("refuses a skill from another weapon kit", () => {
    const sword = skillById("thieu_duong_kiem_phap");
    assert.equal(castRejection(sword, player({ weaponType: "dao" })), "weapon");
  });

  it("refuses a skill the hero has not learned", () => {
    const starter = skillById("thieu_duong_kiem_phap");
    const unlearned = skillById("thai_cuc_quyen");
    // The sect starter is always known, so a fresh hero may cast it.
    assert.equal(castRejection(starter, player()), null);
    assert.equal(castRejection(unlearned, player({ level: 30 })), "locked");
    assert.equal(
      castRejection(unlearned, player({ level: 30, learnedSkills: ["thai_cuc_quyen"] })),
      null
    );
  });

  it("allows a plain swing (null skill)", () => {
    assert.equal(castRejection(null, player()), null);
  });

  it("explains why an art cannot be studied", () => {
    assert.deepEqual(learnRejection(null, 10, []), { reason: "not_usable" });
    assert.deepEqual(learnRejection(skillById("thieu_duong_kiem_phap"), 10, []), {
      reason: "already_learned"
    });

    const gated = skillById("tam_thanh_kiem_phap");
    // Own level met, prerequisite missing.
    assert.equal(learnRejection(gated, 26, [])?.reason, "prereq");
    // Prerequisite learned, own level still too low (the third sword art needs 26).
    assert.equal(learnRejection(gated, 25, ["thai_cuc_quyen"])?.reason, "level");
    assert.equal(learnRejection(gated, 26, ["thai_cuc_quyen"]), null);
  });

  it("applies buffs and heals to the caster", () => {
    const buffed = player();
    const buff = applyCastSelfEffects(buffed, skillById("la_han_tran"), 1000);
    assert.equal(buff.statsChanged, true);
    assert.equal(buff.healed, 0);
    assert.equal(buffed.buffs.length, 3);
    assert.equal(buffed.buffs[0].until, 1000 + 180000);
    // Formation VFX hints travel with the buff so the client can draw the ring.
    assert.equal(buffed.buffs[0].formationSprite, "vfx-la-han-tran");

    const healed = player({ hp: 50, maxHp: 100 });
    const result = applyCastSelfEffects(healed, skillById("tu_hang_pho_do"), 0);
    assert.equal(result.healed, 50);
    assert.equal(healed.hp, 100);
  });

  it("never heals past the HP ceiling", () => {
    const full = player({ hp: 100, maxHp: 100 });
    assert.equal(applyCastSelfEffects(full, skillById("tu_hang_pho_do"), 0).healed, 0);
    assert.equal(full.hp, 100);
  });

  it("authorizes a hit only inside the cast's window and hit budget", () => {
    const skill = skillById("thieu_duong_kiem_phap");
    const attacker = player({
      weaponType: "kiem",
      learnedSkills: ["thieu_duong_kiem_phap"],
      lastCast: { skillId: skill.id, at: 1000, hits: 0, aim: { x: 10, y: 10 } }
    });
    const stats = { attack: 100, critRate: 0, critDamage: 1.5 };

    const first = resolveSkillHit(attacker, stats, 10, skill.id, 1200, () => 0.99);
    assert.ok(first);
    assert.equal(first.skill.id, skill.id);
    assert.ok(first.damage > 0);

    // The cast only authorizes its own hit budget.
    attacker.lastCast.hits = 999;
    assert.equal(resolveSkillHit(attacker, stats, 10, skill.id, 1300, Math.random), null);
  });

  it("rejects a hit that does not follow an accepted cast", () => {
    const attacker = player({ lastCast: null, lastSwing: null });
    assert.equal(
      resolveSkillHit(attacker, { attack: 10 }, 0, "thieu_duong_kiem_phap", 0, Math.random),
      null
    );
  });

  it("consumes a plain swing exactly once", () => {
    const attacker = player({ lastSwing: { at: 1000, used: false } });
    const stats = { attack: 100 };
    assert.ok(resolveSkillHit(attacker, stats, 10, null, 1100, () => 0.99));
    assert.equal(resolveSkillHit(attacker, stats, 10, null, 1200, Math.random), null);
  });

  it("lands a plain swing softer than a studied art", () => {
    const attacker = player({ lastSwing: { at: 1000, used: false } });
    const stats = { attack: 100 };
    // 0.5 is above the default crit rate and sits exactly in the middle of the
    // variance roll, so the cleaned-up hit is (attack - defence) * mult.
    const hit = resolveSkillHit(attacker, stats, 10, null, 1100, () => 0.5);
    assert.equal(hit.damage, Math.round((100 - 10) * NORMAL_ATTACK_MULT));
    assert.ok(hit.damage < 100 - 10, "a free swing no longer deals the full attack-minus-defence");
  });

  it("deals a fraction of the primary damage on splash", () => {
    const skill = skillById("la_han_quyen");
    const stats = { attack: 100, critRate: 0, critDamage: 1.5 };
    const primary = resolveSkillHit(
      player({
        weaponType: "bao-tay",
        level: 20,
        learnedSkills: ["la_han_quyen"],
        lastCast: { skillId: skill.id, at: 0, hits: 0, aim: { x: 0, y: 0 } }
      }),
      stats,
      10,
      skill.id,
      100,
      () => 0.99
    );
    const splash = splashDamage(skill, stats, 10, () => 0.99);
    assert.ok(splash > 0);
    assert.ok(splash < primary.damage);
  });

  it("keeps the splash fraction constant as the skill levels up", () => {
    const skill = skillById("la_han_quyen");
    // A large attack keeps whole-damage rounding from distorting the ratio.
    const stats = { attack: 1000, critRate: 0, critDamage: 1.5 };
    // Defense is subtracted after the multiplier, so use an unarmoured target to
    // isolate the multiplier scaling the level is responsible for.
    const ratioAt = (level) => {
      const primary = resolveSkillHit(
        player({
          weaponType: "bao-tay",
          level: 20,
          learnedSkills: ["la_han_quyen"],
          skillLevels: { la_han_quyen: level },
          lastCast: { skillId: skill.id, at: 0, hits: 0, aim: { x: 0, y: 0 } }
        }),
        stats,
        0,
        skill.id,
        100,
        () => 0.99
      );
      return splashDamage(skill, stats, 0, () => 0.99, level) / primary.damage;
    };

    // Rounding to whole damage points moves the ratio slightly; a squared
    // multiplier would roughly double it, far beyond this tolerance.
    assert.ok(Math.abs(ratioAt(MAX_SKILL_LEVEL) - ratioAt(1)) < 0.02);
  });

  it("only contains AoE hits inside the authorized area", () => {
    const skill = skillById("nhu_lai_than_chuong");
    const cast = { skillId: skill.id, aim: { x: 1000, y: 1000 } };
    assert.equal(isInsideCastArea(cast, skill, { x: 1000, y: 1000 }, { x: 0, y: 0 }), true);
    assert.equal(isInsideCastArea(cast, skill, { x: 1000 + skill.radius + 500, y: 1000 }, { x: 0, y: 0 }), false);
    // A non-AoE cast is not constrained here.
    assert.equal(isInsideCastArea(cast, skillById("thieu_duong_kiem_phap"), { x: 0, y: 0 }, { x: 0, y: 0 }), true);
  });

  it("scales a hit with the caster's level in the skill", () => {
    const skill = skillById("thieu_duong_kiem_phap");
    const stats = { attack: 100, critRate: 0, critDamage: 1.5 };
    const hitAt = (level) =>
      resolveSkillHit(
        player({
          learnedSkills: ["thieu_duong_kiem_phap"],
          skillLevels: { thieu_duong_kiem_phap: level },
          lastCast: { skillId: skill.id, at: 0, hits: 0, aim: { x: 0, y: 0 } }
        }),
        stats,
        10,
        skill.id,
        100,
        () => 0.99
      );

    const low = hitAt(1);
    const high = hitAt(MAX_SKILL_LEVEL);
    assert.ok(high.damage > low.damage);
    assert.ok(high.skill.mult > low.skill.mult);
    assert.equal(high.skill.id, skill.id);
  });

  it("scales self buffs with the caster's level", () => {
    const base = player({ learnedSkills: ["la_han_tran"] });
    const strong = player({ learnedSkills: ["la_han_tran"], skillLevels: { la_han_tran: 10 } });
    applyCastSelfEffects(base, skillById("la_han_tran"), 0);
    applyCastSelfEffects(strong, skillById("la_han_tran"), 0);
    assert.ok(strong.buffs[0].amount > base.buffs[0].amount);
  });

  it("refuses an upgrade the hero cannot pay for, and stops at the cap", () => {
    const skill = skillById("thieu_duong_kiem_phap");

    assert.deepEqual(upgradeRejection(null, player()), { reason: "not_usable" });
    assert.equal(upgradeRejection(skillById("thai_cuc_quyen"), player())?.reason, "not_learned");

    const maxed = player({
      learnedSkills: ["thieu_duong_kiem_phap"],
      skillLevels: { thieu_duong_kiem_phap: MAX_SKILL_LEVEL },
      progress: { coins: 1e9, exp: 1e9 }
    });
    assert.equal(upgradeRejection(skill, maxed)?.reason, "max_level");

    const broke = player({
      level: 20,
      learnedSkills: ["thieu_duong_kiem_phap"],
      progress: { coins: 0, exp: 0 }
    });
    assert.equal(upgradeRejection(skill, broke)?.reason, "coins");

    const noExp = player({
      level: 20,
      learnedSkills: ["thieu_duong_kiem_phap"],
      progress: { coins: 1e6, exp: 0 }
    });
    assert.equal(upgradeRejection(skill, noExp)?.reason, "exp");

    const rich = player({
      level: 20,
      learnedSkills: ["thieu_duong_kiem_phap"],
      skillLevels: { thieu_duong_kiem_phap: 1 },
      progress: { coins: 1e6, exp: 1e6 }
    });
    assert.equal(upgradeRejection(skill, rich), null);
  });

  it("gates each skill rank behind a minimum character level", () => {
    const skill = skillById("thieu_duong_kiem_phap");
    const progress = { coins: 1e6, exp: 1e6 };

    // Rank 2 needs character level 14, rank 6 needs 30 (study floor 10 + 4 * 5).
    assert.equal(characterLevelForSkillLevel(skill, 6), 30);

    const tooLow = player({
      level: 29,
      learnedSkills: ["thieu_duong_kiem_phap"],
      skillLevels: { thieu_duong_kiem_phap: 5 },
      progress
    });
    const gated = upgradeRejection(skill, tooLow);
    assert.equal(gated?.reason, "level");
    assert.equal(gated.level, 30);
    assert.equal(gated.skillLevel, 6);
    assert.equal(gated.current, 29);

    const highEnough = player({
      level: 30,
      learnedSkills: ["thieu_duong_kiem_phap"],
      skillLevels: { thieu_duong_kiem_phap: 5 },
      progress
    });
    assert.equal(upgradeRejection(skill, highEnough), null);
  });
});
