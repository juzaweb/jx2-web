import { describe, it, expect } from "vitest";
import { parseEnemyReward } from "./rewardSync.js";

describe("parseEnemyReward", () => {
  const validPayload = () => ({
    enemyId: 3,
    attackerId: "usr_hero",
    x: 1110,
    y: 590,
    exp: 35,
    coins: 7
  });

  it("keeps a well-formed reward", () => {
    const reward = parseEnemyReward(validPayload());

    expect(reward.exp).toBe(35);
    expect(reward.coins).toBe(7);
    expect(reward.attackerId).toBe("usr_hero");
    expect(reward.x).toBe(1110);
    expect(reward.y).toBe(590);
    expect(reward.drop).toBeUndefined();
  });

  it("ignores any loot field a stale or forged payload may carry", () => {
    const reward = parseEnemyReward({
      ...validPayload(),
      drop: { id: "kim-sang-duoc", qty: 99999 }
    });

    // Kills no longer grant items, so nothing from the payload may reach the bag.
    expect(reward.drop).toBeUndefined();
    expect(Object.keys(reward)).not.toContain("drop");
  });

  it("rejects payloads without a usable EXP or đồng amount", () => {
    expect(parseEnemyReward({ coins: 5 })).toBeNull();
    expect(parseEnemyReward({ exp: 35 })).toBeNull();
    expect(parseEnemyReward({ exp: -35, coins: 5 })).toBeNull();
    expect(parseEnemyReward({ exp: 35, coins: Number.NaN })).toBeNull();
    expect(parseEnemyReward({ exp: "35", coins: 5 })).toBeNull();
    expect(parseEnemyReward({ exp: 35, coins: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it("rejects non-object payloads", () => {
    expect(parseEnemyReward(null)).toBeNull();
    expect(parseEnemyReward(undefined)).toBeNull();
    expect(parseEnemyReward("enemy_reward")).toBeNull();
    expect(parseEnemyReward(12)).toBeNull();
  });

  it("normalizes fractional counts and missing coordinates", () => {
    const reward = parseEnemyReward({ ...validPayload(), exp: 34.9, coins: 6.5, x: null, y: "590" });

    expect(reward.exp).toBe(34);
    expect(reward.coins).toBe(6);
    expect(reward.x).toBeNull();
    expect(reward.y).toBeNull();
    expect(reward.attackerId).toBe("usr_hero");
  });

  it("clears a non-string attacker id so a stray attribution cannot pay out", () => {
    expect(parseEnemyReward({ ...validPayload(), attackerId: 42 }).attackerId).toBeNull();
  });
});
