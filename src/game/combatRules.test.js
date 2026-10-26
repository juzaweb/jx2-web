import { describe, expect, it } from "vitest";

import {
  HIT_WINDOW_MS,
  MAX_HITS_PER_CAST,
  MELEE_REACH,
  MOVE_SLACK_PX,
  MOVE_SPEED_TOLERANCE,
  attackIntervalFor,
  castHitWindowMs,
  channelDurationMs,
  channelHitCount,
  channelIntervalMs,
  consumeCastHit,
  isChannelSkill,
  maxHitsPerCast,
  maxTravelDistance,
  walkSpeedFor
} from "./combatRules.js";
import { BASE_WALK_SPEED, WORLD_POSITION_SCALE, WORLD_SPEED_SCALE } from "./worldConfig.js";

/** Base walk speed in world px/s, derived from the shared config. */
const BASE_SPEED = BASE_WALK_SPEED * WORLD_POSITION_SCALE * WORLD_SPEED_SCALE;

describe("attackIntervalFor", () => {
  it("returns the base cadence at speed 1", () => {
    expect(attackIntervalFor(1)).toBe(330);
  });

  it("shortens the interval as attack speed grows", () => {
    expect(attackIntervalFor(2)).toBe(165);
    expect(attackIntervalFor(1.5)).toBe(220);
  });

  it("falls back to the base cadence for invalid speeds", () => {
    expect(attackIntervalFor(0)).toBe(330);
    expect(attackIntervalFor(Number.NaN)).toBe(330);
    expect(attackIntervalFor(undefined)).toBe(330);
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
  const flurry = { channel: { durationMs: 5000, intervalMs: 500 } };

  it("reads a channel's duration, interval and strike count", () => {
    expect(channelDurationMs(flurry)).toBe(5000);
    expect(channelIntervalMs(flurry)).toBe(500);
    expect(channelHitCount(flurry)).toBe(10);
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
    expect(maxHitsPerCast(flurry)).toBe(12);
    expect(maxHitsPerCast({})).toBe(MAX_HITS_PER_CAST);
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
    const skill = { id: "la_han_quyen", channel: { durationMs: 5000, intervalMs: 500 } };
    const cast = { skillId: "la_han_quyen", at: 1000, hits: 0 };

    for (let strike = 0; strike < 10; strike += 1) {
      expect(consumeCastHit(cast, skill, 1000 + strike * 500)).toBe(true);
    }
    expect(cast.hits).toBe(10);
    // 5s flurry + 0.4s slack = 5.4s window, so a hit at 6.5s is too late.
    expect(consumeCastHit(cast, skill, 6500)).toBe(false);
  });
});
