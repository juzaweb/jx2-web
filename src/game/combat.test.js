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

import { CombatSystem, computeDamage } from "./combat.js";
import { DROP_TABLE, getQuantities } from "./items.js";
import { Player } from "./player.js";
import { Wolf } from "./enemy.js";

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
      networkClient: { isConnected },
      time: { delayedCall: vi.fn() },
      add: { container: visualStub, circle: visualStub, polygon: visualStub }
    };
    const onStateChange = vi.fn();
    const combat = new CombatSystem(scene, player, { getAlive: () => [] }, ui, onStateChange);

    combat.setLocalPlayerId(playerId);
    // Real spawnDrop (drop objects are asserted below), float text stubbed
    vi.spyOn(combat, "spawnDrop");
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
    drop: { id: DROP_TABLE[0].id, qty: DROP_TABLE[0].qty },
    ...overrides
  });

  it("pays a server reward to the client the kill was attributed to", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    combat.applyServerReward(serverReward());

    expect(player.stats.kills).toBe(1);
    expect(player.stats.exp).toBe(935);
    expect(player.stats.coins).toBe(17);
    expect(combat.spawnDrop).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  it("renders the shared drop for bystanders without paying them", () => {
    const { combat, player, onStateChange } = makeCombat({ isConnected: true, playerId: "usr_khac" });

    combat.applyServerReward(serverReward());

    expect(combat.spawnDrop).toHaveBeenCalledTimes(1);
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
    expect(combat.spawnDrop).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("rolls the reward locally while offline", () => {
    const { combat, player } = makeCombat({ isConnected: false });
    const wolf = { x: 50, y: 60, hp: 0, die: vi.fn(), revive: vi.fn() };

    combat.handleWolfKill(wolf);

    expect(wolf.die).toHaveBeenCalledTimes(1);
    expect(player.stats.kills).toBe(1);
    expect(player.stats.exp).toBe(935);
    expect(player.stats.coins).toBeGreaterThanOrEqual(13);
    expect(player.stats.coins).toBeLessThanOrEqual(19);
    expect(combat.spawnDrop).toHaveBeenCalledTimes(1);
  });

  it("leaves the payout to the server while connected", () => {
    const { combat, player } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    const wolf = { x: 50, y: 60, hp: 0, die: vi.fn(), revive: vi.fn() };

    combat.handleWolfKill(wolf);

    expect(wolf.die).toHaveBeenCalledTimes(1);
    expect(player.stats.kills).toBe(0);
    expect(player.stats.exp).toBe(900);
    expect(player.stats.coins).toBe(10);
    expect(combat.spawnDrop).not.toHaveBeenCalled();
  });

  it("marks the kill's drop collectable only for the attributed killer", () => {
    const { combat: killer } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    killer.applyServerReward(serverReward());

    const { combat: bystander } = makeCombat({ isConnected: true, playerId: "usr_khac" });
    bystander.applyServerReward(serverReward());

    expect(killer.drops).toHaveLength(1);
    expect(killer.drops[0].collectable).toBe(true);
    expect(bystander.drops).toHaveLength(1);
    expect(bystander.drops[0].collectable).toBe(false);
  });

  it("does not let a bystander pick up another player's kill loot", () => {
    const { combat, player } = makeCombat({ isConnected: true, playerId: "usr_khac" });
    combat.applyServerReward(serverReward());

    const drop = combat.drops[0];
    const before = getQuantities()[drop.itemId] ?? 0;
    player.x = drop.x;
    player.y = drop.y;
    combat.updateDrops(0);

    expect(drop.active).toBe(true);
    expect(player.stats.coins).toBe(10);
    expect(getQuantities()[drop.itemId]).toBe(before);
  });

  it("still lets the killer pick up the loot the server rolled", () => {
    const { combat, player } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    combat.applyServerReward(serverReward());

    const drop = combat.drops[0];
    const before = getQuantities()[drop.itemId] ?? 0;
    player.x = drop.x;
    player.y = drop.y;
    combat.updateDrops(0);

    expect(drop.active).toBe(false);
    // 10 starting bạc + 7 from the kill + 5 pickup bonus
    expect(player.stats.coins).toBe(22);
    expect(getQuantities()[drop.itemId]).toBe(before + drop.qty);
  });

  it("fades the loot a bystander cannot take and keeps the killer's drop", () => {
    const { combat: bystander } = makeCombat({ isConnected: true, playerId: "usr_khac" });
    bystander.applyServerReward(serverReward());
    bystander.updateDrops(9000);

    const { combat: killer } = makeCombat({ isConnected: true, playerId: "usr_hero" });
    killer.applyServerReward(serverReward());
    killer.updateDrops(9000);

    expect(bystander.drops[0].active).toBe(false);
    expect(killer.drops[0].active).toBe(true);
  });

  it("bounds the remembered drop list across many kills", () => {
    const { combat, player } = makeCombat({ isConnected: true, playerId: "usr_hero" });

    for (let i = 0; i < 40; i++) {
      combat.applyServerReward(serverReward());
    }
    player.x = -1000;
    player.y = -1000;
    combat.updateDrops(0);

    expect(combat.drops.length).toBeLessThanOrEqual(32);
  });
});
