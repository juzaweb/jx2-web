import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
    },
    Angle: {
      Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1)
    },
    Linear: (p0, p1, t) => p0 + t * (p1 - p0)
  }
}));

import { CombatSystem } from "./combat.js";
import { computeDamage } from "./damage.js";
import { Player } from "./player.js";
import { Wolf } from "./enemy.js";
import { PVP_ATTACK_RANGE, PVP_CAST_DISTANCE, PVP_HIT_COOLDOWN_MS } from "./pvp.js";
import { skillById } from "./skills.js";

describe("computeDamage", () => {
  const baseAttacker = {
    attack: 24,
    defense: 6,
    critRate: 0.12,
    critDamage: 1.5
  };

  const baseDefender = {
    attack: 12,
    defense: 6
  };

  describe("attack-minus-defense mitigation", () => {
    it("mitigates damage by subtracting defender defense from attacker attack", () => {
      // 24 attack - 6 defense = 18 base damage (with variance disabled)
      const result = computeDamage(baseAttacker, baseDefender, () => 0.5, {
        variance: 0,
        critRoll: 0.99 // ensure no crit
      });

      expect(result.crit).toBe(false);
      expect(result.damage).toBe(18);
    });

    it("enforces minimum damage floor of 1 when defense exceeds attack", () => {
      const weakAttacker = { attack: 4, defense: 2 };
      const tankDefender = { attack: 10, defense: 50 };

      // With variance = 0
      const resultNoVar = computeDamage(weakAttacker, tankDefender, () => 0.5, { variance: 0 });
      expect(resultNoVar.damage).toBe(1);

      // Even with maximum negative variance, floor remains 1
      const resultNegVar = computeDamage(weakAttacker, tankDefender, () => 0.5, {
        variance: 0.5,
        varianceRoll: 0
      });
      expect(resultNegVar.damage).toBe(1);

      // When attack equals defense, floor is 1
      const equalResult = computeDamage({ attack: 10 }, { defense: 10 }, () => 0.5, { variance: 0 });
      expect(equalResult.damage).toBe(1);
    });

    it("supports stats property on attacker and defender", () => {
      const nestedAttacker = { stats: { attack: 30, critRate: 0.2, critDamage: 2.0 } };
      const nestedDefender = { stats: { defense: 10 } };

      const result = computeDamage(nestedAttacker, nestedDefender, () => 0.5, {
        variance: 0,
        critRoll: 0.99
      });

      expect(result.crit).toBe(false);
      expect(result.damage).toBe(20); // 30 - 10 = 20
    });
  });

  describe("critical strikes", () => {
    it("applies crit multiplier when rng roll is below critRate", () => {
      // critRate is 0.12, rng returns 0.05 (< 0.12) -> crit
      // base damage = 24 - 6 = 18. Crit damage = 18 * 1.5 = 27.
      const result = computeDamage(baseAttacker, baseDefender, () => 0.05, { variance: 0 });

      expect(result.crit).toBe(true);
      expect(result.damage).toBe(27);
    });

    it("does not crit when rng roll is greater than or equal to critRate", () => {
      // critRate is 0.12, rng returns 0.12 (>= 0.12) -> not crit
      const resultAtThreshold = computeDamage(baseAttacker, baseDefender, () => 0.12, { variance: 0 });
      expect(resultAtThreshold.crit).toBe(false);
      expect(resultAtThreshold.damage).toBe(18);

      const resultAbove = computeDamage(baseAttacker, baseDefender, () => 0.85, { variance: 0 });
      expect(resultAbove.crit).toBe(false);
      expect(resultAbove.damage).toBe(18);
    });

    it("respects custom critDamage multiplier", () => {
      const critAttacker = {
        attack: 20,
        critRate: 0.5,
        critDamage: 2.5
      };
      const defender = { defense: 10 };

      // (20 - 10) * 2.5 = 25
      const result = computeDamage(critAttacker, defender, () => 0.1, { variance: 0 });
      expect(result.crit).toBe(true);
      expect(result.damage).toBe(25);
    });
  });

  describe("deterministic RNG and variance", () => {
    it("runs deterministically with a sequence generator", () => {
      const sequence = [0.02, 0.5]; // 0.02 for crit (true), 0.5 for variance (neutral)
      let index = 0;
      const customRng = () => sequence[index++];

      const result = computeDamage(baseAttacker, baseDefender, customRng, { variance: 0.1 });
      expect(result.crit).toBe(true);
      expect(result.damage).toBe(27);
    });

    it("scales damage according to variance roll", () => {
      // (24 - 6) = 18 base
      // With variance = 0.1:
      // - roll 0.0 -> factor 0.9 -> 18 * 0.9 = 16.2 -> round to 16
      // - roll 0.5 -> factor 1.0 -> 18 * 1.0 = 18
      // - roll 1.0 -> factor 1.1 -> 18 * 1.1 = 19.8 -> round to 20
      const lowResult = computeDamage(baseAttacker, baseDefender, () => 0.9, {
        variance: 0.1,
        critRoll: 0.9,
        varianceRoll: 0.0
      });
      expect(lowResult.damage).toBe(16);

      const midResult = computeDamage(baseAttacker, baseDefender, () => 0.9, {
        variance: 0.1,
        critRoll: 0.9,
        varianceRoll: 0.5
      });
      expect(midResult.damage).toBe(18);

      const highResult = computeDamage(baseAttacker, baseDefender, () => 0.9, {
        variance: 0.1,
        critRoll: 0.9,
        varianceRoll: 1.0
      });
      expect(highResult.damage).toBe(20);
    });

    it("rounds damage to integer values properly", () => {
      const attacker = { attack: 15 };
      const defender = { defense: 8 };
      // 15 - 8 = 7. If critDamage = 1.5: 7 * 1.5 = 10.5 -> Math.round -> 11
      const result = computeDamage(attacker, defender, () => 0.01, {
        variance: 0,
        critRate: 1.0,
        critDamage: 1.5
      });
      expect(result.damage).toBe(11);
    });
  });

  describe("options and fallback defaults", () => {
    it("handles null and undefined attacker or defender gracefully", () => {
      const resNull = computeDamage(null, null, () => 0.9, { variance: 0 });
      expect(resNull.damage).toBeGreaterThanOrEqual(1);
      expect(typeof resNull.crit).toBe("boolean");

      const resEmpty = computeDamage({}, {}, () => 0.9, { variance: 0 });
      // Default attack is 10, default defense is 0 -> 10 damage
      expect(resEmpty.damage).toBe(10);
      expect(resEmpty.crit).toBe(false);
    });

    it("allows options overrides for attack, defense, critRate, and critDamage", () => {
      const result = computeDamage({}, {}, () => 0.02, {
        attack: 40,
        defense: 10,
        critRate: 0.1,
        critDamage: 2.0,
        variance: 0
      });
      // (40 - 10) * 2.0 = 60
      expect(result.crit).toBe(true);
      expect(result.damage).toBe(60);
    });

    it("applies skillMult to power up skill damage", () => {
      // (24 - 6) * 1.4 = 25.2 -> 25 without crit
      const skillNormal = computeDamage(baseAttacker, baseDefender, () => 0.9, {
        skillMult: 1.4,
        variance: 0
      });
      expect(skillNormal.crit).toBe(false);
      expect(skillNormal.damage).toBe(25);

      // (24 - 6) * 1.4 * 1.5 = 37.8 -> 38 with crit
      const skillCrit = computeDamage(baseAttacker, baseDefender, () => 0.01, {
        skillMult: 1.4,
        variance: 0
      });
      expect(skillCrit.crit).toBe(true);
      expect(skillCrit.damage).toBe(38);
    });
  });

  describe("entity stat contracts", () => {
    it("Player getters expose base combat attributes", () => {
      const dummyPlayer = Object.create(Player.prototype);
      dummyPlayer.stats = {
        attack: 24,
        defense: 6,
        critRate: 0.12,
        critDamage: 1.5
      };

      expect(dummyPlayer.attack).toBe(24);
      expect(dummyPlayer.defense).toBe(6);
      expect(dummyPlayer.critRate).toBe(0.12);
      expect(dummyPlayer.critDamage).toBe(1.5);
    });

    it("Wolf entity contract defines default attack, defense, critRate, and critDamage", () => {
      const dummyWolf = Object.create(Wolf.prototype);
      dummyWolf.attack = 12;
      dummyWolf.defense = 3;
      dummyWolf.critRate = 0.05;
      dummyWolf.critDamage = 1.5;

      const playerAttackingWolf = computeDamage(baseAttacker, dummyWolf, () => 0.9, { variance: 0 });
      // 24 - 3 = 21
      expect(playerAttackingWolf.damage).toBe(21);

      const wolfAttackingPlayer = computeDamage(dummyWolf, baseAttacker, () => 0.9, { variance: 0 });
      // 12 - 6 = 6
      expect(wolfAttackingPlayer.damage).toBe(6);
    });
  });
});

describe("CombatSystem kill rewards", () => {
  const makePlayer = () => ({
    x: 100,
    y: 200,
    stats: {
      kills: 0,
      coins: 10,
      exp: 900,
      hp: 50,
      maxHp: 50,
      mp: 20,
      maxMp: 20,
      level: 1,
      nextExp: 1000
    }
  });

  const makeCombat = ({ isConnected = false, playerId = null } = {}) => {
    const player = makePlayer();
    const ui = { addLog: vi.fn(), updateHud: vi.fn(), updateQuest: vi.fn(), updateInventory: vi.fn() };
    const visualStub = () => {
      const node = {
        add: () => node,
        setDepth: () => node,
        setStrokeStyle: () => node,
        setPosition: () => node,
        setAlpha: () => node,
        destroy: () => {}
      };
      return node;
    };
    const scene = {
      networkClient: { isConnected, sendRestoreMp: vi.fn() },
      cameras: { main: { width: 5700, height: 3200, zoom: 1 } },
      time: { delayedCall: vi.fn() },
      add: { container: visualStub, circle: visualStub, polygon: visualStub }
    };
    const onStateChange = vi.fn();
    const combat = new CombatSystem(scene, player, { getAlive: () => [] }, ui, onStateChange);

    combat.setLocalPlayerId(playerId);
    vi.spyOn(combat, "showFloatText").mockImplementation(() => {});

    return { combat, player, ui, onStateChange };
  };

  const serverReward = (overrides = {}) => ({
    enemyId: 1,
    attackerId: "usr_hero",
    exp: 35,
    coins: 7,
    x: 1110,
    y: 590,
    ...overrides
  });

  it("caps a ranged skill at the visible camera diagonal", () => {
    const { combat } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    expect(combat.skillReach({ radius: 0, range: 6000 })).toBeCloseTo(
      Math.hypot(5700 / 2, 3200 / 2)
    );
    expect(combat.skillReach({ radius: 0, range: 100 })).toBe(100);
    expect(combat.skillReach({ radius: 110, range: 0 })).toBe(110);
  });

  it("uses the cast range, not the radius, for a ranged AoE", () => {
    const { combat } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    expect(combat.skillReach({ radius: 140, range: 600 })).toBe(600);
    expect(combat.skillReach({ radius: 140, range: 0 })).toBe(140);
    expect(combat.skillReach({ radius: 300, range: 6000 })).toBeCloseTo(
      Math.hypot(5700 / 2, 3200 / 2)
    );
  });

  it("centres an AoE on the cursor and clamps it to the cast range", () => {
    const { combat } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    const skill = { radius: 140, range: 600 };

    // Player starts at (100, 200).
    expect(combat.resolveCastCenter(skill, null, { x: 400, y: 200 })).toEqual({ x: 400, y: 200 });
    expect(combat.resolveCastCenter(skill, null, { x: 1000, y: 200 })).toEqual({ x: 700, y: 200 });
    expect(combat.resolveCastCenter(skill, { x: 300, y: 200 })).toEqual({ x: 300, y: 200 });
    expect(combat.resolveCastCenter(skill)).toEqual({ x: 100, y: 200 });
  });

  it("resolves AoE targets around the impact point, not the hero", () => {
    const { combat } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    const wolves = [
      { id: "near", x: 400, y: 200 },
      { id: "edge", x: 550, y: 200 },
      { id: "far", x: 900, y: 200 }
    ];
    combat.enemyManager = { getAlive: () => wolves };

    const targets = combat.resolveTargets({ radius: 140, range: 600 }, { x: 500, y: 200 });

    expect(targets.map((wolf) => wolf.id)).toEqual(["edge", "near"]);
  });

  it("uses the farthest camera corner when the player is not centred", () => {
    const { combat, player } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    combat.scene.cameras.main.worldView = { left: 0, top: 0, right: 1000, bottom: 600, width: 1000 };

    player.x = 500;
    player.y = 300;
    expect(combat.screenCastRange()).toBeCloseTo(Math.hypot(500, 300));

    player.x = 0;
    player.y = 0;
    expect(combat.screenCastRange()).toBeCloseTo(Math.hypot(1000, 600));
  });

  it("reports the kill for the attributed killer without minting stats", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    combat.applyServerReward(serverReward());

    // The payout is the server's job (it sends player_progress separately).
    expect(player.stats.kills).toBe(0);
    expect(player.stats.exp).toBe(900);
    expect(player.stats.coins).toBe(10);
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("stays silent for a bystander's kill", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_khac" });

    combat.applyServerReward(serverReward());

    expect(player.stats.kills).toBe(0);
    expect(player.stats.exp).toBe(900);
    expect(player.stats.coins).toBe(10);
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("ignores a reward payload it cannot trust", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    combat.applyServerReward({ attackerId: "usr_hero", coins: 5 });
    combat.applyServerReward(null);
    combat.applyServerReward(serverReward({ coins: Number.NaN }));

    expect(player.stats.kills).toBe(0);
    expect(player.stats.exp).toBe(900);
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("mirrors the server ledger onto the local stats", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    combat.applyServerProgress({ level: 1, exp: 30, nextExp: 100, coins: 25, kills: 2, maxHp: 100, maxMp: 60 });

    expect(player.stats).toMatchObject({
      level: 1,
      exp: 30,
      nextExp: 100,
      coins: 25,
      kills: 2,
      maxHp: 100,
      maxMp: 60
    });
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  it("heals to the new ceiling on a level-up", () => {
    const { combat, player, ui } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    player.stats.hp = 10;

    combat.applyServerProgress({ level: 2, exp: 5, nextExp: 145, coins: 40, kills: 3, maxHp: 120, maxMp: 70 });

    expect(player.stats.level).toBe(2);
    expect(player.stats.maxHp).toBe(120);
    expect(player.stats.hp).toBe(120);
    expect(ui.addLog).toHaveBeenCalled();
  });

  it("keeps current values for malformed progress fields", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    combat.applyServerProgress({ level: 1, exp: Number.NaN, coins: 25, kills: 0 });
    combat.applyServerProgress(null);

    expect(player.stats.exp).toBe(900);
    expect(player.stats.coins).toBe(25);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  it("casts a hotbar-bound skill by catalog id", () => {
    const { combat, player } = makeCombat();
    player.sect = "thieu-lam";
    combat.executeSkill = vi.fn();
    const ok = combat.castSkillById("la_han_tran");
    expect(ok).toBe(true);
    expect(combat.executeSkill).toHaveBeenCalledTimes(1);
  });

  it("handles an unknown skill id without crashing", () => {
    const { combat, player, ui } = makeCombat();
    player.sect = "thieu-lam";
    const ok = combat.castSkillById("no_such_skill");
    expect(ok).toBe(false);
    expect(ui.addLog).toHaveBeenCalledWith("Môn phái này chưa có chiêu thức ở ô đó.");
  });
});

describe("CombatSystem hand assignments and self-skill gating", () => {
  const makeCombat = () => {
    const player = {
      sect: "thieu-lam",
      stats: { level: 10, mp: 100, maxMp: 100, hp: 100, maxHp: 100 },
      x: 100,
      y: 100
    };
    const ui = { addLog: vi.fn(), updateHud: vi.fn() };
    const scene = { time: { now: 1000 } };
    const combat = Object.create(CombatSystem.prototype);
    combat.player = player;
    combat.ui = ui;
    combat.scene = scene;
    combat.cancelPendingCast = vi.fn();
    return { combat, ui };
  };

  it("activates persistent formation ring on cast and hides it on expire or clear", () => {
    const { combat } = makeCombat();
    combat.buffs = [];
    combat.player.showFormation = vi.fn();
    combat.player.hideFormation = vi.fn();

    const laHanTran = {
      id: "la_han_tran",
      target: "self",
      effects: [
        { kind: "buff", stat: "attackPct", amount: 0.1, duration: 180000 },
        { kind: "buff", stat: "speedPct", amount: 0.2, duration: 180000 }
      ],
      vfx: { type: "formation", sprite: "vfx-la-han-tran" }
    };

    combat.applySelfEffects(laHanTran, 1000);
    expect(combat.buffs).toHaveLength(2);
    expect(combat.buffs[0]).toMatchObject({
      skillId: "la_han_tran",
      formationSprite: "vfx-la-han-tran",
      until: 181000
    });
    expect(combat.player.showFormation).toHaveBeenCalledWith("vfx-la-han-tran");

    // Before expiration: formation remains active without redundant re-shows
    combat.player.showFormation.mockClear();
    combat.update(50000);
    expect(combat.player.showFormation).not.toHaveBeenCalled();
    expect(combat.player.hideFormation).not.toHaveBeenCalled();

    // After expiration: hideFormation is called
    combat.update(182000);
    expect(combat.buffs).toHaveLength(0);
    expect(combat.player.hideFormation).toHaveBeenCalled();

    // clearBuffs also hides formation
    combat.applySelfEffects(laHanTran, 200000);
    expect(combat.buffs).toHaveLength(2);
    combat.player.hideFormation.mockClear();
    combat.clearBuffs();
    expect(combat.buffs).toHaveLength(0);
    expect(combat.player.hideFormation).toHaveBeenCalled();
  });

  it("floats the overhead seal on cast and hides it on expire or clear", () => {
    const { combat } = makeCombat();
    combat.buffs = [];
    combat.player.showOverhead = vi.fn();
    combat.player.hideOverhead = vi.fn();

    const kimCang = {
      id: "kim_cang_bat_hoai",
      target: "self",
      effects: [{ kind: "buff", stat: "defensePct", amount: 0.3, duration: 180000 }],
      vfx: {
        type: "overhead",
        overhead: "buff-phat-an",
        overheadScale: 0.05,
        overheadOffsetY: -80
      }
    };

    combat.applySelfEffects(kimCang, 1000);
    expect(combat.buffs).toHaveLength(1);
    expect(combat.buffs[0]).toMatchObject({
      skillId: "kim_cang_bat_hoai",
      overheadSprite: "buff-phat-an",
      until: 181000
    });
    expect(combat.player.showOverhead).toHaveBeenCalledWith("buff-phat-an", 0.05, -80);

    combat.update(50000);
    expect(combat.player.hideOverhead).not.toHaveBeenCalled();

    // Reading effective stats must not prune the buff before the visual cleanup.
    combat.scene.time.now = 182000;
    combat.getEffectiveStats();
    expect(combat.buffs).toHaveLength(1);

    combat.update(182000);
    expect(combat.buffs).toHaveLength(0);
    expect(combat.player.hideOverhead).toHaveBeenCalled();

    combat.applySelfEffects(kimCang, 200000);
    expect(combat.buffs).toHaveLength(1);
    combat.player.hideOverhead.mockClear();
    combat.clearBuffs();
    expect(combat.buffs).toHaveLength(0);
    expect(combat.player.hideOverhead).toHaveBeenCalled();
  });
});

describe("attack speed coefficient", () => {
  const makeCombat = (attackSpeed) => {
    const player = { stats: { attackSpeed }, playAttackMotion: vi.fn() };
    const ui = { addLog: vi.fn(), updateHud: vi.fn(), updateQuest: vi.fn(), updateInventory: vi.fn() };
    const scene = {
      time: { delayedCall: vi.fn(), now: 0 },
      cameras: { main: { width: 100, height: 100, zoom: 1 } },
      add: { arc: () => ({ destroy() {} }) }
    };
    return new CombatSystem(scene, player, { getAlive: () => [] }, ui, () => {});
  };

  it("turns the coefficient into a shorter interval", () => {
    expect(makeCombat(1).attackIntervalMs()).toBe(400);
    expect(makeCombat(1.2).attackIntervalMs()).toBeCloseTo(400 / 1.2);
    expect(makeCombat(1.5).attackIntervalMs()).toBeCloseTo(400 / 1.5);
  });

  it("falls back to the base cadence for a missing or invalid coefficient", () => {
    expect(makeCombat(undefined).attackIntervalMs()).toBe(400);
    expect(makeCombat(0).attackIntervalMs()).toBe(400);
  });

  it("paces PvP strikes to the server's i-frame instead of the melee cadence", () => {
    expect(makeCombat(1).pvpAttackIntervalMs()).toBe(PVP_HIT_COOLDOWN_MS);
    expect(makeCombat(3).pvpAttackIntervalMs()).toBe(PVP_HIT_COOLDOWN_MS);
  });
});

describe("skill targeting", () => {
  const peer = (id, x, y, extra = {}) => ({
    id,
    x,
    y,
    pkFlag: true,
    displayName: id,
    hp: 100,
    maxHp: 100,
    container: { active: true },
    ...extra
  });

  const makeCombat = ({ pkFlag = true, pvpTarget = null, wolves = [], peers = [] } = {}) => {
    const player = {
      sect: "thieu-lam",
      x: 0,
      y: 0,
      pkFlag,
      visual: { scaleX: 1 },
      faceDirection: vi.fn(),
      stats: { level: 10, mp: 100, maxMp: 100, hp: 100, maxHp: 100, attack: 24, critRate: 0.12, critDamage: 1.5 }
    };
    const ring = { setStrokeStyle: () => ring, setDepth: () => ring, destroy: vi.fn() };
    const scene = {
      time: { now: 1000 },
      cameras: { main: { width: 1000, height: 1000, zoom: 1 } },
      add: { circle: () => ring },
      tweens: { add: vi.fn() },
      pvpTarget,
      remotePlayerManager: { getAll: () => peers },
      networkClient: { isConnected: true, sendPlayerHit: vi.fn(), sendAttack: vi.fn(), sendEnemyHit: vi.fn(), sendMove: vi.fn() }
    };
    const ui = { addLog: vi.fn(), updateHud: vi.fn() };
    const combat = new CombatSystem(scene, player, { getAlive: () => wolves }, ui, () => {});
    return { combat, scene, ui };
  };

  const wolf = (id, x, y) => ({ id, monsterId: "soi-xam", x, y, hp: 50, maxHp: 50, defense: 0 });

  it("prefers the locked PvP target over a closer monster", () => {
    const locked = peer("locked", 200, 0);
    const { combat } = makeCombat({ pvpTarget: locked, peers: [locked], wolves: [wolf("wolf", 30, 0)] });

    expect(combat.findTarget(null)).toBe(locked);
  });

  it("ignores the lock while the hero is peaceful", () => {
    const locked = peer("locked", 200, 0);
    const nearWolf = wolf("wolf", 30, 0);
    const { combat } = makeCombat({ pkFlag: false, pvpTarget: locked, wolves: [nearWolf] });

    expect(combat.findTarget(null)).toBe(nearWolf);
  });

  it("prefers the peer standing under the click", () => {
    const clicked = peer("clicked", 500, 0);
    const { combat } = makeCombat({ peers: [clicked], wolves: [wolf("wolf", 500, 0)] });

    expect(combat.findTarget({ x: 500, y: 0 })).toBe(clicked);
  });

  it("keeps the monster under the aim even when a duellist is in PvP range", () => {
    // The auto-target ring points at this monster; a flagged peer standing closer
    // than PVP_ATTACK_RANGE but *not* under the aim must not steal the cast.
    const near = peer("near", PVP_ATTACK_RANGE - 100, 0);
    const underAim = wolf("wolf", 600, 0);
    const { combat } = makeCombat({ peers: [near], wolves: [underAim] });

    expect(combat.findTarget({ x: 600, y: 0 })).toBe(underAim);
  });

  it("lets the duellist win when both bodies cover the aim", () => {
    // Raising the PK flag is the player's intent, so a duellist under the same
    // point outranks the monster standing on it.
    const peerUnderAim = peer("peer-under-aim", 560, 0);
    const wolfUnderAim = wolf("wolf", 600, 0);
    const { combat } = makeCombat({ peers: [peerUnderAim], wolves: [wolfUnderAim] });

    expect(combat.findTarget({ x: 600, y: 0 })).toBe(peerUnderAim);
  });

  it("auto-acquires a flagged peer already inside PvP range when nothing is locked", () => {
    const near = peer("near", PVP_ATTACK_RANGE - 100, 0);
    const { combat } = makeCombat({ peers: [near], wolves: [wolf("wolf", 30, 0)] });

    expect(combat.findTarget(null)).toBe(near);
  });

  it("leaves far-away flagged peers alone and keeps the monster target", () => {
    const far = peer("far", PVP_ATTACK_RANGE + 200, 0);
    const nearWolf = wolf("wolf", 30, 0);
    const { combat } = makeCombat({ peers: [far], wolves: [nearWolf] });

    expect(combat.findTarget(null)).toBe(nearWolf);
  });

  it("clamps a peer cast inside the server's PvP range but not a monster cast", () => {
    const skill = { radius: 0, range: 5000 };
    const { combat } = makeCombat();
    // A camera wider than the PvP radius makes the two limits distinguishable;
    // at the default size the monster reach is already below the PvP clamp.
    combat.scene.cameras.main = { width: 5700, height: 3200, zoom: 1 };

    const monsterReach = combat.castReach(skill, wolf("w", 0, 0));
    const peerReach = combat.castReach(skill, peer("p", 0, 0));

    expect(monsterReach).toBeCloseTo(combat.skillReach(skill));
    expect(monsterReach).toBeGreaterThan(PVP_CAST_DISTANCE);
    expect(peerReach).toBe(PVP_CAST_DISTANCE);
  });

  it("sends the resolved AoE impact centre with the cast", () => {
    const { combat, scene } = makeCombat();
    const skill = {
      id: "nhu_lai_than_chuong",
      sect: "thieu-lam",
      slot: 5,
      nameKey: "skills.thieuLam.nhuLaiThanChuong.name",
      unlockLevel: 10,
      mp: 35,
      cooldown: 30000,
      radius: 300,
      range: 6000,
      mult: 2.4,
      vfx: { cast: "shockwave" }
    };
    combat.applySkill = vi.fn();
    combat.showFloatText = vi.fn();

    combat.executeSkill(skill, null, { x: 500, y: 0 });

    expect(scene.networkClient.sendAttack).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: "nhu_lai_than_chuong",
        aimX: 500,
        aimY: 0
      })
    );
    expect(combat.applySkill).toHaveBeenCalledWith(skill, expect.any(Number), null, {
      x: 500,
      y: 0
    });
  });

  it("never spends MP locally — the server's player_mp is authoritative", () => {
    const { combat, scene } = makeCombat();
    const skill = {
      id: "dai_tu_di_chuong",
      sect: "thieu-lam",
      slot: 1,
      nameKey: "skills.thieuLam.daiTuDiChuong.name",
      unlockLevel: 1,
      mp: 12,
      cooldown: 6000,
      radius: 0,
      range: 6000,
      mult: 1.3,
      vfx: {}
    };
    combat.applySkill = vi.fn();
    combat.showFloatText = vi.fn();
    const before = combat.player.stats.mp;

    combat.executeSkill(skill, null);

    expect(scene.networkClient.sendAttack).toHaveBeenCalled();
    // MP is only mirrored from the server; a cast must not spend it locally.
    expect(combat.player.stats.mp).toBe(before);
  });

  it("resolves a pending approach against a peer and drops it when the flag falls", () => {
    const locked = peer("locked", 200, 0);
    const peaceful = peer("peaceful", 200, 0, { pkFlag: false });

    const ready = makeCombat({ peers: [locked] });
    expect(ready.combat.findPendingTarget("locked")).toBe(locked);
    expect(ready.combat.findPendingTarget("missing")).toBeNull();

    const dropped = makeCombat({ peers: [peaceful] });
    expect(dropped.combat.findPendingTarget("peaceful")).toBeNull();
  });

  it("reports a skill hit on a peer without touching its local HP", () => {
    const locked = peer("locked", 100, 0);
    const { combat, scene } = makeCombat({ pvpTarget: locked, peers: [locked] });
    combat.setLocalPlayerId("me");
    combat.showFloatText = vi.fn();

    combat.applySkillToPlayer({ id: "kiem_khi", nameKey: "skills.kiem_khi", mult: 1.5, vfx: {} }, locked);

    expect(scene.networkClient.sendPlayerHit).toHaveBeenCalledWith({
      targetId: "locked",
      skill: "kiem_khi"
    });
    expect(locked.hp).toBe(100);

    // The server measures the distance from its own copy of both positions, so the
    // fresh position has to be on the wire before the hit (same socket, in order).
    expect(scene.networkClient.sendMove).toHaveBeenCalled();
    expect(scene.networkClient.sendMove.mock.invocationCallOrder[0]).toBeLessThan(
      scene.networkClient.sendPlayerHit.mock.invocationCallOrder[0]
    );
  });

  it("refuses a peer skill hit from out of range", () => {
    const far = peer("far", 2000, 0);
    const { combat, scene, ui } = makeCombat();
    combat.setLocalPlayerId("me");
    combat.showFloatText = vi.fn();

    combat.applySkillToPlayer({ id: "kiem_khi", nameKey: "skills.kiem_khi", mult: 1.5, vfx: {} }, far);

    expect(scene.networkClient.sendPlayerHit).not.toHaveBeenCalled();
    expect(ui.addLog).toHaveBeenCalled();
  });

  it("explains a fruitless cast when the hero is peaceful next to a flagged peer", () => {
    const near = peer("near", 100, 0);
    const { combat, ui } = makeCombat({ pkFlag: false, peers: [near] });

    combat.hintPeacefulDuelist({ id: "thieu_lam_tam_phap", nameKey: "skills.thieuLam.thieuLamTamPhap.name" });

    expect(ui.addLog).toHaveBeenCalledWith(expect.stringContaining("bật cờ PK"));
  });

  it("stays quiet about the PK hint when the hero is already flagged", () => {
    const near = peer("near", 100, 0);
    const { combat, ui } = makeCombat({ pkFlag: true, peers: [near] });

    combat.hintPeacefulDuelist({ id: "thieu_lam_tam_phap", nameKey: "skills.thieuLam.thieuLamTamPhap.name" });

    expect(ui.addLog).not.toHaveBeenCalled();
  });

  it("checks skill readiness via isSkillReady without logging", () => {
    const { combat, ui } = makeCombat();
    const skill = { id: "dai_tu_di_chuong", unlockLevel: 1 };

    expect(combat.isSkillReady(skill)).toBe(true);
    expect(ui.addLog).not.toHaveBeenCalled();

    // On cooldown
    combat.skillCooldowns.set("dai_tu_di_chuong", 2000);
    expect(combat.isSkillReady(skill)).toBe(false);
    expect(ui.addLog).not.toHaveBeenCalled();

    // Out of MP
    combat.skillCooldowns.clear();
    combat.player.stats.mp = 0;
    expect(combat.isSkillReady(skill)).toBe(false);
    expect(ui.addLog).not.toHaveBeenCalled();
  });

  it("nearestEnemyInReach prefers scene.enemyTarget if in reach", () => {
    const wolf1 = wolf("wolf1", 100, 0);
    const wolf2 = wolf("wolf2", 50, 0);
    const { combat, scene } = makeCombat({ wolves: [wolf1, wolf2] });
    scene.enemyTarget = wolf1;

    expect(combat.nearestEnemyInReach()).toBe(wolf1);

    scene.enemyTarget = null;
    expect(combat.nearestEnemyInReach()).toBe(wolf2);
  });
});

describe("CombatSystem passive art ownership", () => {
  const makePlayer = (sect = "thieu-lam", hp = 50) => ({
    sect,
    x: 0,
    y: 0,
    stats: { level: 1, hp, maxHp: 100, mp: 60, maxMp: 60 }
  });

  const makeCombat = ({ sect = "thieu-lam", hp = 50 } = {}) => {
    const player = makePlayer(sect, hp);
    const scene = {
      time: { now: 0 },
      networkClient: { isConnected: true }
    };
    const ui = { addLog: vi.fn(), updateHud: vi.fn() };
    const combat = new CombatSystem(scene, player, { getAlive: () => [] }, ui);
    return { combat, player, ui };
  };

  it("leaves passive regeneration to the server", () => {
    const { combat, player } = makeCombat();

    combat.update(0);
    combat.update(500);
    combat.update(1000);

    expect(player.stats.hp).toBe(50);
  });

  it("also leaves a fallen hero at 0 HP for the server to respawn", () => {
    const { combat, player } = makeCombat({ hp: 0 });

    combat.update(0);
    combat.update(5000);

    expect(player.stats.hp).toBe(0);
  });

  it("refuses to cast the passive art and spends no MP", () => {
    const { combat, player, ui } = makeCombat();

    expect(combat.castSkill(skillById("thieu_lam_tam_phap"))).toBe(false);
    expect(player.stats.mp).toBe(60);
    expect(combat.skillCooldowns.size).toBe(0);
    expect(ui.addLog).toHaveBeenCalledWith(
      expect.stringContaining("tự động vận hành")
    );
  });
});

describe("CombatSystem channelled flurry", () => {
  const makeWolf = (x = 100) => ({
    id: 9,
    monsterId: "soi-xam",
    x,
    y: 0,
    hp: 500,
    maxHp: 500,
    isDead: false
  });

  const makeCombat = ({ wolves = [], peers = [] } = {}) => {
    const player = {
      sect: "thieu-lam",
      x: 0,
      y: 0,
      pkFlag: true,
      visual: { scaleX: 1 },
      faceDirection: vi.fn(),
      moveTo: vi.fn(),
      stopMovement: vi.fn(),
      playSkillMotion: vi.fn(),
      stats: { level: 10, mp: 100, maxMp: 100, hp: 100, maxHp: 100, attack: 24, critRate: 0.1, critDamage: 1.5 }
    };
    const fx = { setStrokeStyle: () => fx, setDepth: () => fx, destroy: vi.fn() };
    const scene = {
      time: { now: 0 },
      cameras: { main: { width: 1000, height: 1000, zoom: 1 } },
      add: { circle: () => fx, arc: () => fx, ellipse: vi.fn(() => fx) },
      tweens: { add: vi.fn() },
      remotePlayerManager: { getAll: () => peers },
      networkClient: {
        isConnected: true,
        sendEnemyHit: vi.fn(),
        sendMove: vi.fn(),
        sendAttack: vi.fn(),
        sendPlayerHit: vi.fn()
      }
    };
    const ui = { addLog: vi.fn(), updateHud: vi.fn() };
    const combat = new CombatSystem(scene, player, { getAlive: () => wolves }, ui);
    return { combat, player, scene, ui };
  };

  it("starts a twenty-punch channel instead of a single hit", () => {
    const wolf = makeWolf();
    const { combat } = makeCombat({ wolves: [wolf] });
    const skill = skillById("la_han_quyen");

    combat.applySkill(skill, 0, wolf);

    expect(combat.channel).toMatchObject({
      targetId: 9,
      hitsLeft: 20,
      intervalMs: 250,
      endsAt: 5000
    });
  });

  it("lands one punch every 250ms and ends after five seconds", () => {
    const wolf = makeWolf();
    const { combat, scene } = makeCombat({ wolves: [wolf] });
    const skill = skillById("la_han_quyen");
    combat.applySkill(skill, 0, wolf);

    for (let t = 0; t <= 5000; t += 250) combat.updateChannel(t);

    expect(scene.networkClient.sendEnemyHit).toHaveBeenCalledTimes(20);
    expect(scene.networkClient.sendEnemyHit).toHaveBeenCalledWith({
      id: 9,
      skill: "la_han_quyen"
    });
    // One splash ring per punch marks the area the spread damage covers.
    expect(scene.add.ellipse).toHaveBeenCalledTimes(20);
    expect(combat.channel).toBeNull();
  });

  it("chases a target that stepped out of reach instead of punching air", () => {
    const wolf = makeWolf();
    const { combat, player, scene } = makeCombat({ wolves: [wolf] });
    combat.applySkill(skillById("la_han_quyen"), 0, wolf);

    wolf.x = 5000;
    combat.updateChannel(0);

    expect(player.moveTo).toHaveBeenCalledWith(5000, 0);
    expect(scene.networkClient.sendEnemyHit).not.toHaveBeenCalled();
    expect(combat.channel?.hitsLeft).toBe(20);
  });

  it("stops when the target disappears", () => {
    const wolf = makeWolf();
    const { combat, ui } = makeCombat({ wolves: [] });
    combat.startChannel(skillById("la_han_quyen"), wolf, 0);

    combat.updateChannel(0);

    expect(combat.channel).toBeNull();
    expect(ui.addLog).toHaveBeenCalledWith("Mục tiêu đã biến mất.");
  });

  it("is cancelled by a movement command", () => {
    const wolf = makeWolf();
    const { combat, player } = makeCombat({ wolves: [wolf] });
    combat.applySkill(skillById("la_han_quyen"), 0, wolf);

    combat.cancelPendingCast();

    expect(combat.channel).toBeNull();
    expect(player.stopMovement).toHaveBeenCalled();
  });

  it("refuses other skills while the flurry is running", () => {
    const wolf = makeWolf();
    const { combat, ui } = makeCombat({ wolves: [wolf] });
    combat.applySkill(skillById("la_han_quyen"), 0, wolf);

    expect(combat.castSkill(skillById("dai_tu_di_chuong"))).toBe(false);
    expect(ui.addLog).toHaveBeenCalledWith(expect.stringContaining("liên hoàn chiêu thức"));
  });

  it("channels onto a PK player, landing every punch through the PvP path", () => {
    const peer = {
      id: "peer-1",
      pkFlag: true,
      displayName: "Đối thủ",
      x: 100,
      y: 0,
      container: { active: true }
    };
    const { combat, scene } = makeCombat({ peers: [peer] });
    combat.setLocalPlayerId("me");

    combat.applySkill(skillById("la_han_quyen"), 0, peer);
    expect(combat.channel).toMatchObject({ targetId: "peer-1", hitsLeft: 20 });

    for (let t = 0; t <= 4750; t += 250) combat.updateChannel(t);

    expect(scene.networkClient.sendPlayerHit).toHaveBeenCalledTimes(20);
    expect(scene.networkClient.sendPlayerHit).toHaveBeenCalledWith({
      targetId: "peer-1",
      skill: "la_han_quyen"
    });
    expect(scene.networkClient.sendEnemyHit).not.toHaveBeenCalled();
    // The splash ring is shown for a player target too: the skill behaves the same.
    expect(scene.add.ellipse).toHaveBeenCalledTimes(20);
  });

  it("ends a PvP flurry when the target lowers the PK flag", () => {
    const peer = {
      id: "peer-1",
      pkFlag: true,
      displayName: "Đối thủ",
      x: 100,
      y: 0,
      container: { active: true }
    };
    const { combat } = makeCombat({ peers: [peer] });
    combat.setLocalPlayerId("me");

    combat.applySkill(skillById("la_han_quyen"), 0, peer);
    combat.updateChannel(0);
    peer.pkFlag = false;
    combat.updateChannel(250);

    expect(combat.channel).toBeNull();
  });

  it("refuses to report a PvP hit while the hero is peaceful", () => {
    const peer = {
      id: "peer-1",
      pkFlag: true,
      displayName: "Đối thủ",
      x: 100,
      y: 0,
      container: { active: true }
    };
    const { combat, scene } = makeCombat({ peers: [peer] });
    combat.setLocalPlayerId("me");
    combat.player.pkFlag = false;

    expect(combat.applySkillToPlayer(skillById("la_han_quyen"), peer)).toBe(false);
    expect(scene.networkClient.sendPlayerHit).not.toHaveBeenCalled();
  });

  it("lands an AoE skill on flagged players inside its area", () => {
    const nearPeer = {
      id: "peer-near",
      pkFlag: true,
      displayName: "Gần",
      x: 100,
      y: 0,
      container: { active: true }
    };
    const farPeer = {
      id: "peer-far",
      pkFlag: true,
      displayName: "Xa",
      x: 5000,
      y: 0,
      container: { active: true }
    };
    const peaceful = {
      id: "peer-peace",
      pkFlag: false,
      displayName: "Hiền",
      x: 120,
      y: 0,
      container: { active: true }
    };
    const { combat, scene } = makeCombat({ peers: [nearPeer, farPeer, peaceful] });
    combat.setLocalPlayerId("me");

    const aoe = {
      id: "nhu_lai_than_chuong",
      nameKey: "skills.thieuLam.nhuLaiThanChuong.name",
      target: "enemy",
      radius: 900,
      range: 6000,
      mult: 2.4,
      vfx: { cast: "shockwave" }
    };

    combat.applySkill(aoe, 0, nearPeer);

    expect(scene.networkClient.sendPlayerHit).toHaveBeenCalledTimes(1);
    expect(scene.networkClient.sendPlayerHit).toHaveBeenCalledWith({
      targetId: "peer-near",
      skill: "nhu_lai_than_chuong"
    });
    expect(scene.networkClient.sendEnemyHit).not.toHaveBeenCalled();
  });
});
