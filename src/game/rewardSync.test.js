import { describe, it, expect } from "vitest";
import { parseEnemyReward } from "./rewardSync.js";
import { DROP_TABLE } from "./items.js";

describe("parseEnemyReward", () => {
  const validLoot = DROP_TABLE[0];
  const validPayload = () => ({
    enemyId: 3,
    attackerId: "usr_hero",
    x: 1110,
    y: 590,
    exp: 35,
    coins: 7,
    drop: { id: validLoot.id, qty: validLoot.qty }
  });

  it("keeps a well-formed reward and takes the loot quantity from the catalog", () => {
    const reward = parseEnemyReward(validPayload());

    expect(reward.exp).toBe(35);
    expect(reward.coins).toBe(7);
    expect(reward.attackerId).toBe("usr_hero");
    expect(reward.x).toBe(1110);
    expect(reward.y).toBe(590);
    expect(reward.drop).toEqual({
      id: validLoot.id,
      name: validLoot.name,
      qty: validLoot.qty
    });
  });

  it("ignores a payload quantity and trusts the shared drop table instead", () => {
    const payload = validPayload();
    payload.drop.qty = 99999;

    expect(parseEnemyReward(payload).drop.qty).toBe(validLoot.qty);
  });

  it("rejects unknown loot ids instead of granting them", () => {
    const payload = validPayload();
    payload.drop = { id: "khong-co-trong-catalog", qty: 5 };

    expect(parseEnemyReward(payload).drop).toBeNull();
    expect(parseEnemyReward({ ...validPayload(), drop: null }).drop).toBeNull();
    expect(parseEnemyReward({ ...validPayload(), drop: undefined }).drop).toBeNull();
  });

  it("rejects payloads without a usable EXP or bạc amount", () => {
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
