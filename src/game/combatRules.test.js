import { describe, expect, it } from "vitest";

import {
  HIT_WINDOW_MS,
  MAX_HITS_PER_CAST,
  MELEE_REACH,
  MOVE_SLACK_PX,
  MOVE_SPEED_TOLERANCE,
  attackIntervalFor,
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
