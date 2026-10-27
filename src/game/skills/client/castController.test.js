import { describe, it, expect, vi } from "vitest";

// The controller only uses Phaser's distance maths; mocking keeps this a fast,
// DOM-free unit test.
vi.mock("phaser", () => ({
  Math: {
    Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) }
  }
}));

import { SkillCastController, isPeerTarget } from "./castController.js";
import { skillById } from "../index.js";
import { PVP_CAST_DISTANCE } from "../../pvp.js";

/**
 * Minimal stand-in for `CombatSystem`: only the state and the cross-methods the
 * controller reaches for. Cross-methods are bound to the controller so the test
 * exercises the real reach/targeting maths.
 */
function makeCombat(overrides = {}) {
  const combat = {
    player: {
      x: 0,
      y: 0,
      pkFlag: false,
      weaponType: "kiem",
      stats: { level: 10, mp: 100 },
      moveTo: vi.fn(),
      stopMovement: vi.fn(),
      showFormation: vi.fn(),
      showOverhead: vi.fn(),
      hideFormation: vi.fn(),
      hideOverhead: vi.fn()
    },
    scene: {
      time: { now: 0 },
      cameras: { main: { zoom: 1 } },
      remotePlayerManager: { getAll: () => [] }
    },
    ui: { addLog: vi.fn(), updateHud: vi.fn() },
    enemyManager: { getAlive: () => [] },
    skillCooldowns: new Map(),
    buffs: [],
    channel: null,
    pendingCast: null,
    lastChaseAt: 0,
    learnedSkills: new Set(["kiem_khi"]),
    localPlayerId: "me",
    screenCastRange: () => 10000,
    ...overrides
  };

  const cast = new SkillCastController(combat, { playTone: vi.fn() });
  combat.cast = cast;
  combat.skillReach = (skill) => cast.skillReach(skill);
  combat.castReach = (skill, target) => cast.castReach(skill, target);
  combat.resolveTargets = (skill, center) => cast.resolveTargets(skill, center);
  combat.resolvePeerTargets = (skill, center) => cast.resolvePeerTargets(skill, center);
  combat.applySelfEffects = (skill, now) => cast.applySelfEffects(skill, now);
  combat.updateBuffs = (now) => cast.updateBuffs(now);
  combat.clearBuffs = () => cast.clearBuffs();

  return { combat, cast };
}

describe("SkillCastController", () => {
  it("caps reach to the camera view and to PvP distance for peers", () => {
    const { combat, cast } = makeCombat();
    const sword = skillById("kiem_khi");

    expect(cast.skillReach(sword)).toBe(sword.range);
    combat.screenCastRange = () => 100;
    expect(cast.skillReach(sword)).toBe(100);

    // A monster keeps the (capped) reach; a peer is limited to the PvP cast distance.
    combat.screenCastRange = () => 10000;
    expect(cast.castReach(sword, { monsterId: "wolf", x: 800, y: 0 })).toBe(sword.range);
    expect(cast.castReach(sword, { x: 800, y: 0 })).toBe(
      Math.min(sword.range, PVP_CAST_DISTANCE)
    );
  });

  it("resolves AoE targets inside the radius, nearest first", () => {
    const wolves = [
      { id: "far", x: 120, y: 0 },
      { id: "near", x: 40, y: 0 },
      { id: "outside", x: 500, y: 0 }
    ];
    const { cast } = makeCombat({ enemyManager: { getAlive: () => wolves } });

    const targets = cast.resolveTargets({ radius: 140, range: 600 }, { x: 0, y: 0 });
    expect(targets.map((wolf) => wolf.id)).toEqual(["near", "far"]);
  });

  it("resolves single-target casts to the nearest enemy in reach", () => {
    const wolves = [
      { id: "far", x: 300, y: 0 },
      { id: "near", x: 120, y: 0 }
    ];
    const { cast } = makeCombat({ enemyManager: { getAlive: () => wolves } });

    expect(cast.resolveTargets(skillById("kiem_khi")).map((wolf) => wolf.id)).toEqual(["near"]);
  });

  it("only returns flagged peers inside the area, and none for a peaceful hero", () => {
    const peers = [
      { id: "flagged", x: 50, y: 0, pkFlag: true, container: { active: true } },
      { id: "peaceful", x: 40, y: 0, pkFlag: false, container: { active: true } },
      { id: "out", x: 900, y: 0, pkFlag: true, container: { active: true } }
    ];
    const { combat, cast } = makeCombat();
    combat.scene.remotePlayerManager = { getAll: () => peers };

    expect(cast.resolvePeerTargets({ radius: 140 })).toEqual([]);

    combat.player.pkFlag = true;
    expect(cast.resolvePeerTargets({ radius: 140 }).map((peer) => peer.id)).toEqual(["flagged"]);
  });

  it("records buffs with their VFX hints and prunes them on expiry", () => {
    const { combat, cast } = makeCombat();

    cast.applySelfEffects(skillById("la_han_tran"), 1000);
    expect(combat.buffs).toHaveLength(3);
    expect(combat.buffs[0]).toMatchObject({
      skillId: "la_han_tran",
      stat: "attackPct",
      amount: 0.1,
      until: 181000,
      formationSprite: "vfx-la-han-tran"
    });
    expect(combat.player.showFormation).toHaveBeenCalledWith("vfx-la-han-tran", 0.6);

    cast.updateBuffs(9999);
    expect(combat.buffs).toHaveLength(3);
    cast.updateBuffs(181001);
    expect(combat.buffs).toHaveLength(0);
    expect(combat.player.hideFormation).toHaveBeenCalled();
  });

  it("distinguishes a peer from a monster", () => {
    expect(isPeerTarget({ monsterId: "soi-xam" })).toBe(false);
    expect(isPeerTarget({ id: "p2" })).toBe(true);
    expect(isPeerTarget(null)).toBe(false);
  });
});
