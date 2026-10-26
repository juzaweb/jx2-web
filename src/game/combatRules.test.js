import { describe, expect, it } from "vitest";

import {
  HIT_WINDOW_MS,
  MAX_HITS_PER_CAST,
  MAX_SPLASH_TARGETS,
  MELEE_REACH,
  MOVE_SLACK_PX,
  MOVE_SPEED_TOLERANCE,
  attackIntervalFor,
  castHitWindowMs,
  channelDurationMs,
  channelHitCount,
  channelIntervalMs,
  consumeCastHit,
  hasSplash,
  isChannelSkill,
  maxHitsPerCast,
  maxTravelDistance,
  splashMaxTargets,
  splashMultiplier,
  splashRadius,
  splashVictims,
  walkSpeedFor
} from "./combatRules.js";
import { BASE_WALK_SPEED, WORLD_POSITION_SCALE, WORLD_SPEED_SCALE } from "./worldConfig.js";

/** Base walk speed in world px/s, derived from the shared config. */
const BASE_SPEED = BASE_WALK_SPEED * WORLD_POSITION_SCALE * WORLD_SPEED_SCALE;

describe("attackIntervalFor", () => {
  it("returns the base cadence at speed 1", () => {
    expect(attackIntervalFor(1)).toBe(400);
  });

  it("shortens the interval as attack speed grows", () => {
    expect(attackIntervalFor(2)).toBe(200);
    expect(attackIntervalFor(1.5)).toBeCloseTo(400 / 1.5);
  });

  it("falls back to the base cadence for invalid speeds", () => {
    expect(attackIntervalFor(0)).toBe(400);
    expect(attackIntervalFor(Number.NaN)).toBe(400);
    expect(attackIntervalFor(undefined)).toBe(400);
  });
});

describe("walkSpeedFor", () => {
  it("returns base walk speed for a neutral multiplier", () => {
    // BASE_WALK_SPEED * WORLD_POSITION_SCALE * WORLD_SPEED_SCALE
    expect(walkSpeedFor(1)).toBe(BASE_SPEED);
  });

  it("scales with the multiplier", () => {
    expect(walkSpeedFor(2)).toBe(BASE_SPEED * 2);
    expect(walkSpeedFor(1.2)).toBeCloseTo(BASE_SPEED * 1.2);
  });

  it("ignores invalid multipliers", () => {
    expect(walkSpeedFor(0)).toBe(BASE_SPEED);
    expect(walkSpeedFor(-1)).toBe(BASE_SPEED);
    expect(walkSpeedFor(Number.NaN)).toBe(BASE_SPEED);
  });
});

describe("maxTravelDistance", () => {
  it("allows one second of boosted walk plus slack", () => {
    expect(maxTravelDistance(1000, 1)).toBeCloseTo(
      BASE_SPEED * MOVE_SPEED_TOLERANCE + MOVE_SLACK_PX
    );
  });

  it("still allows the absolute slack for a zero-length tick", () => {
    expect(maxTravelDistance(0, 1)).toBe(MOVE_SLACK_PX);
    expect(maxTravelDistance(-5, 1)).toBe(MOVE_SLACK_PX);
  });

  it("honours custom tolerance and slack", () => {
    expect(maxTravelDistance(1000, 1, { tolerance: 1, slack: 0 })).toBeCloseTo(BASE_SPEED);
  });
});

describe("shared hit limits", () => {
  it("keeps the tuned constants", () => {
    expect(MELEE_REACH).toBe(280);
    expect(HIT_WINDOW_MS).toBe(2000);
    expect(MAX_HITS_PER_CAST).toBe(8);
  });
});

describe("channelled skill rules", () => {
  const flurry = { channel: { durationMs: 5000, intervalMs: 250 } };

  it("reads a channel's duration, interval and strike count", () => {
    expect(channelDurationMs(flurry)).toBe(5000);
    expect(channelIntervalMs(flurry)).toBe(250);
    expect(channelHitCount(flurry)).toBe(20);
    expect(isChannelSkill(flurry)).toBe(true);
  });

  it("treats a one-shot skill as unchannelled", () => {
    const oneShot = { range: 300 };
    expect(channelDurationMs(oneShot)).toBe(0);
    expect(channelIntervalMs(oneShot)).toBe(0);
    expect(channelHitCount(oneShot)).toBe(0);
    expect(isChannelSkill(oneShot)).toBe(false);
    expect(isChannelSkill(null)).toBe(false);
  });

  it("rejects a channel missing either half of its timing", () => {
    expect(isChannelSkill({ channel: { durationMs: 5000 } })).toBe(false);
    expect(isChannelSkill({ channel: { intervalMs: 500 } })).toBe(false);
  });

  it("extends the hit window to cover the whole flurry", () => {
    expect(castHitWindowMs(flurry)).toBe(5400);
    expect(castHitWindowMs({})).toBe(HIT_WINDOW_MS);
  });

  it("raises the per-cast hit cap for a channel only", () => {
    expect(maxHitsPerCast(flurry)).toBe(22);
    expect(maxHitsPerCast({})).toBe(MAX_HITS_PER_CAST);
  });
});

describe("splash rules", () => {
  const skill = { splash: { radius: 160, mult: 0.6, maxTargets: 4 } };

  it("reads splash radius and multiplier, clamping invalid data", () => {
    expect(splashRadius(skill)).toBe(160);
    expect(splashMultiplier(skill)).toBe(0.6);
    expect(splashMaxTargets(skill)).toBe(4);
    expect(hasSplash(skill)).toBe(true);

    expect(splashMultiplier({ splash: { radius: 160, mult: 5 } })).toBe(1);
    expect(splashRadius({})).toBe(0);
    expect(splashMultiplier({})).toBe(0);
    expect(hasSplash({})).toBe(false);
    expect(splashMaxTargets({ splash: { radius: 160, mult: 0.5 } })).toBe(MAX_SPLASH_TARGETS);
    expect(
      splashMaxTargets({ splash: { radius: 160, mult: 0.5, maxTargets: 999 } })
    ).toBe(MAX_SPLASH_TARGETS);
  });

  it("picks the nearest living monsters inside the radius, excluding the primary", () => {
    const primary = { id: "p", x: 0, y: 0 };
    const near = { id: "near", x: 100, y: 0 };
    const far = { id: "far", x: 1000, y: 0 };
    const dead = { id: "dead", x: 50, y: 0, isDead: true };
    // Exactly on the 160 radius: included. Anything beyond it stays untouched.
    const edge = { id: "edge", x: 0, y: 160 };
    const justOutside = { id: "outside", x: 0, y: 161 };

    expect(
      splashVictims(primary, [primary, near, far, dead, edge, justOutside], skill).map(
        (enemy) => enemy.id
      )
    ).toEqual(["near", "edge"]);
  });

  it("caps splash victims and tolerates empty input", () => {
    const primary = { x: 0, y: 0 };
    const crowd = Array.from({ length: 10 }, (_, i) => ({ id: String(i), x: i + 1, y: 0 }));

    expect(splashVictims(primary, crowd, skill)).toHaveLength(4);
    expect(splashVictims(primary, null, skill)).toEqual([]);
    expect(splashVictims(primary, crowd, {})).toEqual([]);
  });
});

describe("consumeCastHit", () => {
  const oneShot = { id: "dai_tu_di_chuong" };
  const makeCast = (patch = {}) => ({ skillId: "dai_tu_di_chuong", at: 1000, hits: 0, ...patch });

  it("consumes a hit from the matching cast inside its window", () => {
    const cast = makeCast();
    expect(consumeCastHit(cast, oneShot, 1500)).toBe(true);
    expect(cast.hits).toBe(1);
  });

  it("rejects a missing or mismatched cast", () => {
    expect(consumeCastHit(null, oneShot, 1000)).toBe(false);
    expect(consumeCastHit(makeCast(), { id: "la_han_quyen" }, 1000)).toBe(false);
  });

  it("rejects a hit after the cast window and leaves the counter alone", () => {
    const cast = makeCast();
    expect(consumeCastHit(cast, oneShot, 3001)).toBe(false);
    expect(cast.hits).toBe(0);
  });

  it("stops at the one-shot hit cap", () => {
    const cast = makeCast();
    for (let i = 0; i < MAX_HITS_PER_CAST; i += 1) {
      expect(consumeCastHit(cast, oneShot, 1500)).toBe(true);
    }
    expect(consumeCastHit(cast, oneShot, 1500)).toBe(false);
    expect(cast.hits).toBe(MAX_HITS_PER_CAST);
  });

  it("lets a channel land its whole flurry and rejects hits past its window", () => {
    const skill = { id: "la_han_quyen", channel: { durationMs: 5000, intervalMs: 250 } };
    const cast = { skillId: "la_han_quyen", at: 1000, hits: 0 };

    for (let strike = 0; strike < 20; strike += 1) {
      expect(consumeCastHit(cast, skill, 1000 + strike * 250)).toBe(true);
    }
    expect(cast.hits).toBe(20);
    // 5s flurry + 0.4s slack = 5.4s window, so a hit at 6.5s is too late.
    expect(consumeCastHit(cast, skill, 6500)).toBe(false);
  });

  it("paces channel hits so the whole flurry cannot be burst at once", () => {
    const skill = { id: "la_han_quyen", channel: { durationMs: 5000, intervalMs: 250 } };
    const cast = { skillId: "la_han_quyen", at: 1000, hits: 0 };

    expect(consumeCastHit(cast, skill, 1000)).toBe(true);
    // 150ms later is under the 200ms pacing floor (250ms - 50ms jitter slack).
    expect(consumeCastHit(cast, skill, 1150)).toBe(false);
    expect(consumeCastHit(cast, skill, 1200)).toBe(true);
  });
});
