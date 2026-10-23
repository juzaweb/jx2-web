import test from "node:test";
import assert from "node:assert/strict";
import { rollEnemyReward } from "../src/rewards.js";
import { KILL_REWARD } from "../../src/game/items.js";

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
  });

  await t.test("pays EXP and bạc only, inside the documented ranges", () => {
    for (let i = 0; i < 25; i++) {
      const reward = rollEnemyReward("usr_hero", enemy);

      assert.deepEqual(Object.keys(reward).sort(), [
        "attackerId",
        "coins",
        "enemyId",
        "exp",
        "level",
        "monsterId",
        "name",
        "x",
        "y"
      ]);
      // An enemy without a monster id falls back to the legacy market wolf, so the
      // historical reward numbers stay exactly what the rest of the suite expects.
      assert.equal(reward.monsterId, "soi-xam");
      assert.equal(reward.name, "Sói Xám");
      assert.equal(reward.level, 5);
      assert.equal(reward.exp, KILL_REWARD.exp);
      assert.ok(reward.coins >= KILL_REWARD.coinsMin);
      assert.ok(reward.coins <= KILL_REWARD.coinsMax);
    }
  });
});
