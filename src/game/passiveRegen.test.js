import { describe, it, expect } from "vitest";
import {
  MAX_TICK_MS,
  advanceRegen,
  billableDeltaMs,
  passiveRegenRate,
  regenPerSecond
} from "./passiveRegen.js";
import { skillById, skillsForWeapon } from "./skills.js";

describe("regenPerSecond", () => {
  it("reads a regen effect out of a catalog skill", () => {
    expect(regenPerSecond(skillById("thieu_lam_tam_phap"))).toBe(2);
    expect(regenPerSecond(skillById("dai_tu_di_chuong"))).toBe(0);
    expect(regenPerSecond(null)).toBe(0);
  });

  it("sums regen effects and ignores non-positive rates", () => {
    expect(
      regenPerSecond({
        effects: [
          { kind: "regen", hpPerSecond: 2 },
          { kind: "regen", hpPerSecond: 1 },
          { kind: "buff", stat: "attackPct", amount: 0.1 }
        ]
      })
    ).toBe(3);
    expect(regenPerSecond({ effects: [{ kind: "regen", hpPerSecond: -5 }] })).toBe(0);
    expect(regenPerSecond({ effects: [{ kind: "regen", hpPerSecond: "2" }] })).toBe(2);
  });
});

describe("passiveRegenRate", () => {
  it("sums the learned passive arts of a weapon kit", () => {
    // The fist internal art unlocks at character level 10.
    expect(passiveRegenRate("bao-tay", 10, ["thieu_lam_tam_phap"])).toBe(2);
    expect(passiveRegenRate("kiem", 10, ["thieu_lam_tam_phap"])).toBe(0);
    // An unlearned passive contributes nothing.
    expect(passiveRegenRate("bao-tay", 10, [])).toBe(0);
    // Unknown weapons normalise to the sword kit, which has no passive.
    expect(passiveRegenRate("bogus", 10, ["thieu_lam_tam_phap"])).toBe(0);
  });

  it("ignores a passive the hero has not unlocked yet", () => {
    expect(passiveRegenRate("bao-tay", 9, ["thieu_lam_tam_phap"])).toBe(0);
    expect(passiveRegenRate("bao-tay", 0, ["thieu_lam_tam_phap"])).toBe(0);
  });

  it("only counts skills flagged as passive", () => {
    for (const skill of skillsForWeapon("bao-tay")) {
      if (skill.passive) continue;
      expect(regenPerSecond(skill)).toBe(0);
    }
  });
});

describe("advanceRegen", () => {
  it("delivers whole HP at the configured rate", () => {
    const first = advanceRegen(0, 2, 500);
    expect(first).toEqual({ carry: 0, amount: 1 });

    const second = advanceRegen(first.carry, 2, 500);
    expect(second).toEqual({ carry: 0, amount: 1 });
  });

  it("carries the fraction between ticks instead of dropping it", () => {
    // 2 HP/s sampled every 250ms: 0.5 HP per tick, so every second tick heals 1.
    const tick1 = advanceRegen(0, 2, 250);
    expect(tick1).toEqual({ carry: 0.5, amount: 0 });

    const tick2 = advanceRegen(tick1.carry, 2, 250);
    expect(tick2).toEqual({ carry: 0, amount: 1 });
  });

  it("rejects junk input and never accumulates negative carry", () => {
    expect(advanceRegen(NaN, NaN, NaN)).toEqual({ carry: 0, amount: 0 });
    expect(advanceRegen(-3, 0, 1000)).toEqual({ carry: 0, amount: 0 });
    expect(advanceRegen(0, 2, 0)).toEqual({ carry: 0, amount: 0 });
    expect(advanceRegen(0, 2, -1000)).toEqual({ carry: 0, amount: 0 });
  });
});

describe("billableDeltaMs", () => {
  it("bills a normal frame gap", () => {
    expect(billableDeltaMs(1000, 1016)).toBe(16);
    expect(billableDeltaMs(1000, 1000 + MAX_TICK_MS)).toBe(MAX_TICK_MS);
  });

  it("bills nothing on the first frame", () => {
    expect(billableDeltaMs(null, 5000)).toBe(0);
    expect(billableDeltaMs(undefined, 5000)).toBe(0);
  });

  it("drops a paused, backgrounded or stalled gap instead of banking it", () => {
    expect(billableDeltaMs(1000, 1000 + MAX_TICK_MS + 1)).toBe(0);
    expect(billableDeltaMs(5000, 1000)).toBe(0);
    expect(billableDeltaMs(NaN, NaN)).toBe(0);
  });
});
