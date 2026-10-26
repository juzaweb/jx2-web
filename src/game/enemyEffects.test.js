import { describe, expect, it } from "vitest";
import {
  applyEnemyControlEffects,
  clearEnemyControlEffects,
  enemyMoveScale,
  isEnemyStunned,
  MAX_CONTROL_MS,
  MIN_SLOW_SCALE
} from "./enemyEffects.js";

const makeEnemy = () => ({ stunUntil: 0, slowUntil: 0, slowPct: 0 });

describe("applyEnemyControlEffects", () => {
  it("applies a stun for the skill's duration", () => {
    const enemy = makeEnemy();
    applyEnemyControlEffects(enemy, { effects: [{ kind: "stun", duration: 800 }] }, 1000);

    expect(enemy.stunUntil).toBe(1800);
    expect(isEnemyStunned(enemy, 1799)).toBe(true);
    expect(isEnemyStunned(enemy, 1800)).toBe(false);
  });

  it("applies a slow and clamps its percentage", () => {
    const enemy = makeEnemy();
    applyEnemyControlEffects(
      enemy,
      { effects: [{ kind: "slow", duration: 2000, pct: 5 }] },
      0
    );

    expect(enemy.slowUntil).toBe(2000);
    expect(enemy.slowPct).toBeLessThanOrEqual(0.85);
    expect(enemyMoveScale(enemy, 1000)).toBeGreaterThanOrEqual(MIN_SLOW_SCALE);
    expect(enemyMoveScale(enemy, 2000)).toBe(1);
  });

  it("never shortens an effect that is already active", () => {
    const enemy = makeEnemy();
    applyEnemyControlEffects(enemy, { effects: [{ kind: "stun", duration: 1200 }] }, 0);
    applyEnemyControlEffects(enemy, { effects: [{ kind: "stun", duration: 200 }] }, 500);

    expect(enemy.stunUntil).toBe(1200);
  });

  it("ignores missing, negative or non-finite durations", () => {
    const enemy = makeEnemy();
    applyEnemyControlEffects(
      enemy,
      { effects: [{ kind: "stun" }, { kind: "stun", duration: -5 }, { kind: "stun", duration: Number.NaN }] },
      0
    );
    expect(enemy.stunUntil).toBe(0);
  });

  it("caps an absurd duration", () => {
    const enemy = makeEnemy();
    applyEnemyControlEffects(enemy, { effects: [{ kind: "stun", duration: 1e9 }] }, 0);
    expect(enemy.stunUntil).toBe(MAX_CONTROL_MS);
  });

  it("tolerates a missing skill or enemy", () => {
    const enemy = makeEnemy();
    expect(applyEnemyControlEffects(enemy, null)).toBe(enemy);
    expect(applyEnemyControlEffects(null, { effects: [] })).toBeNull();
  });
});

describe("enemyMoveScale", () => {
  it("freezes a stunned monster", () => {
    const enemy = { stunUntil: 2000, slowUntil: 0, slowPct: 0 };
    expect(enemyMoveScale(enemy, 1000)).toBe(0);
  });

  it("returns 1 for an uncontrolled monster", () => {
    expect(enemyMoveScale(makeEnemy(), 1000)).toBe(1);
    expect(enemyMoveScale(null, 1000)).toBe(1);
  });
});

describe("clearEnemyControlEffects", () => {
  it("resets every field on respawn", () => {
    const enemy = { stunUntil: 5000, slowUntil: 5000, slowPct: 0.4 };
    clearEnemyControlEffects(enemy);

    expect(enemy).toEqual({ stunUntil: 0, slowUntil: 0, slowPct: 0 });
    expect(enemyMoveScale(enemy, 1000)).toBe(1);
  });
});
