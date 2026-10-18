import test from "node:test";
import assert from "node:assert/strict";
import { rollEnemyReward } from "../src/rewards.js";
import { DROP_TABLE, KILL_REWARD } from "../../src/game/items.js";

test("Kill reward suite", async (t) => {
  const enemy = { id: 2, x: 1110.4, y: 589.6, hp: 0, maxHp: 45, isDead: true };

  await t.test("attributes the kill and pays the shared EXP and bạc range", () => {
    const reward = rollEnemyReward("usr_hero", enemy, () => 0);

    assert.equal(reward.enemyId, 2);
    assert.equal(reward.attackerId, "usr_hero");
    assert.equal(reward.x, 1110, "Reward coordinates are the rounded enemy position");
    assert.equal(reward.y, 590);
    assert.equal(reward.exp, KILL_REWARD.exp);
    assert.equal(reward.coins, KILL_REWARD.coinsMin);
  });

  await t.test("is deterministic for a fixed rng and never overflows the coin maximum", () => {
    const high = rollEnemyReward("usr_hero", enemy, () => 0.999999);

    assert.deepEqual(high, rollEnemyReward("usr_hero", enemy, () => 0.999999));
    assert.equal(high.coins, KILL_REWARD.coinsMax);
    assert.ok(DROP_TABLE.some((entry) => entry.id === high.drop.id));
  });

  await t.test("always rolls a catalog-backed drop inside the documented ranges", () => {
    for (let i = 0; i < 25; i++) {
      const reward = rollEnemyReward("usr_hero", enemy);
      const entry = DROP_TABLE.find((item) => item.id === reward.drop.id);

      assert.ok(entry, `drop ${reward.drop.id} must exist in DROP_TABLE`);
      assert.equal(reward.drop.qty, entry.qty);
      assert.ok(reward.coins >= KILL_REWARD.coinsMin);
      assert.ok(reward.coins <= KILL_REWARD.coinsMax);
    }
  });
});
