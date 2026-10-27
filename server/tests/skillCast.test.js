import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyCastSelfEffects,
  castRejection,
  isInsideCastArea,
  resolveSkillHit,
  splashDamage,
  studyRejection
} from "../src/game/skillCast.js";
import { skillById } from "../../src/game/skills.js";

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
    const sword = skillById("kiem_khi");
    assert.equal(castRejection(sword, player({ weaponType: "dao" })), "weapon");
  });

  it("refuses a skill the hero has not learned", () => {
    const sword = skillById("kiem_khi");
    // The starter is always known, so use a book skill instead.
    const bookSkill = skillById("thieu_duong_kiem_phap");
    assert.equal(castRejection(bookSkill, player()), "locked");
    assert.equal(castRejection(bookSkill, player({ learnedSkills: ["thieu_duong_kiem_phap"] })), null);
    assert.equal(castRejection(sword, player()), null);
  });

  it("allows a plain swing (null skill)", () => {
    assert.equal(castRejection(null, player()), null);
  });

  it("explains why a book cannot be studied", () => {
    assert.deepEqual(studyRejection(null, 10, []), { reason: "not_usable" });
    assert.deepEqual(studyRejection(skillById("kiem_khi"), 10, []), { reason: "already_learned" });

    const gated = skillById("tam_thanh_kiem_phap");
    assert.equal(studyRejection(gated, 10, [])?.reason, "prereq");
    assert.equal(studyRejection(gated, 1, ["thai_cuc_quyen"])?.reason, "level");
    assert.equal(studyRejection(gated, 2, ["thai_cuc_quyen"]), null);
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
    const skill = skillById("kiem_khi");
    const attacker = player({
      weaponType: "kiem",
      learnedSkills: ["kiem_khi"],
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
    assert.equal(resolveSkillHit(attacker, { attack: 10 }, 0, "kiem_khi", 0, Math.random), null);
  });

  it("consumes a plain swing exactly once", () => {
    const attacker = player({ lastSwing: { at: 1000, used: false } });
    const stats = { attack: 100 };
    assert.ok(resolveSkillHit(attacker, stats, 10, null, 1100, () => 0.99));
    assert.equal(resolveSkillHit(attacker, stats, 10, null, 1200, Math.random), null);
  });

  it("deals a fraction of the primary damage on splash", () => {
    const skill = skillById("kiem_khi");
    const stats = { attack: 100, critRate: 0, critDamage: 1.5 };
    const primary = resolveSkillHit(
      player({
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

  it("only contains AoE hits inside the authorized area", () => {
    const skill = skillById("nhu_lai_than_chuong");
    const cast = { skillId: skill.id, aim: { x: 1000, y: 1000 } };
    assert.equal(isInsideCastArea(cast, skill, { x: 1000, y: 1000 }, { x: 0, y: 0 }), true);
    assert.equal(isInsideCastArea(cast, skill, { x: 1000 + skill.radius + 500, y: 1000 }, { x: 0, y: 0 }), false);
    // A non-AoE cast is not constrained here.
    assert.equal(isInsideCastArea(cast, skillById("kiem_khi"), { x: 0, y: 0 }, { x: 0, y: 0 }), true);
  });
});
