import test from "node:test";
import assert from "node:assert/strict";
import { ENEMY_TUNING, nearestPlayerInRange, stepEnemy } from "../../src/game/enemyAi.js";

const wolf = () => ({ id: 0, x: 840, y: 600, homeX: 840, homeY: 600 });

test("Enemy AI suite", async (t) => {
  await t.test("chases the nearest player inside the aggro range", () => {
    const near = { id: "near", x: 840 + ENEMY_TUNING.stopDistance + 60, y: 600 };
    const far = { id: "far", x: near.x + 80, y: 600 };

    assert.equal(nearestPlayerInRange(wolf(), [far, near]).id, "near");

    const next = stepEnemy(wolf(), [near], 100);
    // 43 px/s over 100 ms, straight toward the player (positions stay unrounded here)
    assert.ok(Math.abs(next.x - (840 + ENEMY_TUNING.chaseSpeed * 0.1)) < 1e-9);
    assert.equal(next.y, 600);
  });

  await t.test("ignores players outside the aggro range and unplaceable entries", () => {
    const tooFar = { id: "far", x: 840 + ENEMY_TUNING.aggroRange, y: 600 };
    assert.equal(nearestPlayerInRange(wolf(), [tooFar]), null);
    assert.equal(nearestPlayerInRange(wolf(), [{ id: "ghost" }, null]), null);
  });

  await t.test("holds position once inside the stop distance", () => {
    const almostTouching = { id: "tank", x: 840 + ENEMY_TUNING.stopDistance, y: 600 };
    const next = stepEnemy(wolf(), [almostTouching], 1000);

    assert.deepEqual(next, { x: 840, y: 600 });
  });

  await t.test("never overshoots the stop distance while chasing", () => {
    const closeBy = { id: "runner", x: 840 + ENEMY_TUNING.stopDistance + 2, y: 600 };
    const next = stepEnemy(wolf(), [closeBy], 5000);

    assert.ok(next.x > 840, "still advances on a long tick");
    assert.ok(
      next.x <= closeBy.x - ENEMY_TUNING.stopDistance,
      "stops at the stop distance instead of landing on the player"
    );
  });

  await t.test("walks back home when nobody is in range, and settles there", () => {
    const away = { ...wolf(), x: 940, y: 600 };

    // 22 px/s: one second of idle walking, straight toward home
    assert.deepEqual(stepEnemy(away, [], 1000), { x: 840, y: 600 });
    const nearHomeX = 840 + ENEMY_TUNING.homeEpsilon + ENEMY_TUNING.idleSpeed * 0.3 + 20;
    assert.ok(
      Math.abs(stepEnemy({ ...away, x: nearHomeX }, [], 300).x - (nearHomeX - ENEMY_TUNING.idleSpeed * 0.3)) < 1e-9
    );

    // Inside the home epsilon it stops moving, so an idle map broadcasts nothing
    const restingX = 840 + ENEMY_TUNING.homeEpsilon;
    assert.deepEqual(stepEnemy({ ...away, x: restingX }, [], 1000), { x: restingX, y: 600 });
  });

  await t.test("a wolf is drawn to the same player on every client", () => {
    const players = [
      { id: "left", x: 740, y: 600 },
      { id: "right", x: 1040, y: 600 }
    ];

    const first = stepEnemy(wolf(), players, 100);
    const again = stepEnemy(wolf(), players, 100);
    assert.deepEqual(first, again);
    assert.equal(nearestPlayerInRange(wolf(), players).id, "left", "nearest wins, not the local one");
  });

  await t.test("treats a dead or paused tick as no movement", () => {
    const runner = { id: "runner", x: 900, y: 600 };
    assert.deepEqual(stepEnemy(wolf(), [runner], 0), { x: 840, y: 600 });
    assert.deepEqual(stepEnemy(wolf(), [runner], -50), { x: 840, y: 600 });
    assert.deepEqual(stepEnemy(wolf(), [runner], Number.NaN), { x: 840, y: 600 });
  });
});
