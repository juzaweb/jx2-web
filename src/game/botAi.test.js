import { describe, expect, it } from "vitest";
import {
  BOT_TUNING,
  botAttackRange,
  botCanAttackPlayer,
  botHostileFaction,
  botSpawnPoints,
  createBotState,
  findBotTarget,
  stepBot
} from "./botAi.js";

const makeBot = (overrides = {}) =>
  createBotState({
    id: "bot-1",
    mapId: "trung-nguyen",
    x: 1000,
    y: 1000,
    level: 30,
    name: "Test Bot",
    faction: "han",
    now: 0,
    ...overrides
  });

describe("botCanAttackPlayer", () => {
  it("requires the target to carry the PK flag on a flag map", () => {
    const bot = makeBot({ pkFlag: true });
    expect(botCanAttackPlayer(bot, { id: "p1", pkFlag: false, x: 0, y: 0 }, "flag")).toBe(false);
    expect(botCanAttackPlayer(bot, { id: "p1", pkFlag: true, x: 0, y: 0 }, "flag")).toBe(true);
  });

  it("uses faction hostility on a battlefield", () => {
    const bot = makeBot({ faction: "han" });
    expect(botCanAttackPlayer(bot, { id: "p1", faction: "thuc", x: 0, y: 0 }, "faction")).toBe(true);
    expect(botCanAttackPlayer(bot, { id: "p1", faction: "han", x: 0, y: 0 }, "faction")).toBe(false);
  });

  it("never targets peaceful, dead, god-mode or off-map players", () => {
    const bot = makeBot();
    const base = { id: "p1", pkFlag: true, faction: "thuc", x: 0, y: 0 };
    expect(botCanAttackPlayer(bot, { ...base, isGodMode: true }, "flag")).toBe(false);
    expect(botCanAttackPlayer(bot, { ...base, hp: 0 }, "flag")).toBe(false);
    expect(botCanAttackPlayer(bot, { ...base, mapId: "market" }, "flag")).toBe(false);
    expect(botCanAttackPlayer(bot, base, "none")).toBe(false);
  });
});

describe("botHostileFaction", () => {
  it("picks a camp that is hostile to the given faction", () => {
    for (const faction of ["ngo", "thuc", "nguy"]) {
      const hostile = botHostileFaction(faction);
      expect(hostile).not.toBe(faction);
      expect(["ngo", "thuc", "nguy"]).toContain(hostile);
    }
  });
});

describe("botSpawnPoints", () => {
  it("places one bot per tier and derives the level from the tier", () => {
    const map = {
      bounds: { x0: 0, y0: 0, x1: 16000, y1: 14000 },
      spawn: { x: 7600, y: 12800 },
      zones: [
        { minLevel: 1, maxLevel: 10, bounds: { x0: 0, y0: 9000, x1: 16000, y1: 14000 } },
        { minLevel: 11, maxLevel: 20, bounds: { x0: 0, y0: 4500, x1: 16000, y1: 9000 } }
      ]
    };

    const points = botSpawnPoints(map, 4, 30);

    expect(points).toHaveLength(4);
    expect(points[0].level).toBe(6);
    expect(points[1].level).toBe(16);
    expect(points[2].level).toBe(6);
    expect(points[3].level).toBe(16);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(map.bounds.x0);
      expect(point.x).toBeLessThanOrEqual(map.bounds.x1);
      expect(point.y).toBeGreaterThanOrEqual(map.bounds.y0);
      expect(point.y).toBeLessThanOrEqual(map.bounds.y1);
    }
  });

  it("spreads bots around the map centre when the map has no zones", () => {
    const map = { bounds: { x0: 0, y0: 0, x1: 10000, y1: 10000 }, spawn: { x: 0, y: 0 } };
    const points = botSpawnPoints(map, 3, 40);
    expect(points).toHaveLength(3);
    for (const point of points) expect(point.level).toBe(40);
    expect(new Set(points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`)).size).toBe(3);
  });
});

describe("stepBot", () => {
  it("chases a flagged player until skill range", () => {
    const bot = makeBot({ mp: 60 });
    const range = botAttackRange(bot);
    // Derive the spot from the bot's own reach so a range tweak cannot leave the
    // starter already in casting distance (the aggro cap still covers it).
    const player = {
      id: "p1",
      pkFlag: true,
      mapId: bot.mapId,
      x: bot.x + range + 300,
      y: bot.y,
      hp: 100
    };
    expect(range).toBeGreaterThan(100);

    const result = stepBot(bot, [player], "flag", 100, 0, () => 0.5, BOT_TUNING);

    expect(result.target?.id).toBe("p1");
    expect(result.moved).toBe(true);
    expect(result.x).toBeGreaterThan(bot.x);
    expect(result.x).toBeLessThan(player.x);
    expect(result.vx).toBeGreaterThan(0);
  });

  it("holds position and reports the target once inside attack range", () => {
    const bot = makeBot();
    bot.mp = 60;
    const range = botAttackRange(bot);
    const player = {
      id: "p1",
      pkFlag: true,
      mapId: bot.mapId,
      x: bot.x + range - 20,
      y: bot.y,
      hp: 100
    };

    const result = stepBot(bot, [player], "flag", 100, 0, () => 0.5, BOT_TUNING);

    expect(result.target?.id).toBe("p1");
    expect(result.moved).toBe(false);
    expect(result.x).toBe(bot.x);
  });

  it("falls back to melee range when the bot lacks mana for its skill", () => {
    const bot = makeBot();
    bot.mp = 0;
    expect(botAttackRange(bot)).toBeLessThan(500);
  });

  it("patrols when no player is a legal target", () => {
    const bot = makeBot();
    const player = { id: "p1", pkFlag: false, mapId: bot.mapId, x: 1500, y: 1000, hp: 100 };

    const result = stepBot(bot, [player], "flag", 100, 2000, () => 0.5, BOT_TUNING);

    expect(result.target).toBeNull();
    expect(result.moved).toBe(true);
    expect(result.x).toBeGreaterThanOrEqual(bot.homeX - BOT_TUNING.patrolRadius);
    expect(result.x).toBeLessThanOrEqual(bot.homeX + BOT_TUNING.patrolRadius);
  });

  it("drops a target that ran outside the leash", () => {
    const bot = makeBot();
    const player = {
      id: "p1",
      pkFlag: true,
      mapId: bot.mapId,
      x: bot.homeX + BOT_TUNING.leashRange + 500,
      y: bot.homeY,
      hp: 100
    };
    bot.targetId = "p1";

    const result = stepBot(bot, [player], "flag", 100, 0, () => 0.5, BOT_TUNING);

    expect(result.target).toBeNull();
    expect(bot.targetId).toBeNull();
  });
});

describe("findBotTarget", () => {
  it("picks the nearest legal player inside the aggro range", () => {
    const bot = makeBot();
    const far = { id: "far", pkFlag: true, mapId: bot.mapId, x: bot.x + 1000, y: bot.y, hp: 100 };
    const near = { id: "near", pkFlag: true, mapId: bot.mapId, x: bot.x + 200, y: bot.y, hp: 100 };
    expect(findBotTarget(bot, [far, near], "flag", 1400)?.id).toBe("near");
  });
});
