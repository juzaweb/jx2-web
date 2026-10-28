import test from "node:test";
import assert from "node:assert/strict";
import { rollEnemyReward } from "../src/rewards.js";
import { KILL_REWARD, getItemById } from "../../src/game/items.js";
import { MONSTER_WEAPON_DROPS } from "../../src/game/enemyCatalog.js";

test("Kill reward suite", async (t) => {
  const enemy = { id: 2, x: 1110.4, y: 589.6, hp: 0, maxHp: 45, isDead: true };

  await t.test("attributes the kill and pays the shared EXP and coin range", () => {
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

  await t.test("pays EXP and coins (đồng), plus optional book/weapon loot, inside the documented ranges", () => {
    for (let i = 0; i < 25; i++) {
      const reward = rollEnemyReward("usr_hero", enemy);

      assert.deepEqual(Object.keys(reward).sort(), [
        "attackerId",
        "coins",
        "enemyId",
        "exp",
        "level",
        "loot",
        "monsterId",
        "name",
        "x",
        "y"
      ]);
      assert.ok(Array.isArray(reward.loot));
      assert.ok(reward.loot.length <= 2, "at most one book and one weapon");
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

  await t.test("drops the weapon kit each late-game monster hands out", () => {
    const withWeapon = (monsterId, expectedItemId) => {
      const reward = rollEnemyReward("usr_hero", { id: 9, monsterId, x: 0, y: 0 }, () => 0);
      assert.ok(
        reward.loot.some((drop) => drop.itemId === expectedItemId),
        `${monsterId} should drop ${expectedItemId}`
      );
    };

    withWeapon("hac-y-sat-thu", "bao-tay-lang-khach");
    withWeapon("ma-giao-de-tu", "dao-lang-khach");
  });

  await t.test("keeps weapon drops rare and only on the mapped monsters", () => {
    // A roll at the top of the range never drops anything.
    const dry = rollEnemyReward(
      "usr_hero",
      { id: 9, monsterId: "hac-y-sat-thu", x: 0, y: 0 },
      () => 0.999999
    );
    assert.deepEqual(dry.loot, []);

    // Early monsters have no weapon table at all.
    const early = rollEnemyReward(
      "usr_hero",
      { id: 9, monsterId: "son-ca", x: 0, y: 0 },
      () => 0
    );
    assert.ok(
      early.loot.every((drop) => !drop.itemId.includes("lang-khach")),
      "low-level monsters never drop a weapon"
    );
  });

  await t.test("maps every weapon drop to a real, equippable weapon item", () => {
    for (const [monsterId, drop] of Object.entries(MONSTER_WEAPON_DROPS)) {
      const item = getItemById(drop.itemId);
      assert.ok(item, `${monsterId} drops unknown item ${drop.itemId}`);
      assert.equal(item.slot, "weapon", `${drop.itemId} must be a weapon`);
      assert.ok(item.weaponType, `${drop.itemId} must declare a weaponType`);
      assert.ok(
        drop.chance > 0 && drop.chance < 1,
        `${monsterId} weapon chance must be a probability`
      );
    }
  });
});
