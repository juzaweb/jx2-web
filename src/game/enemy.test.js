import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
    }
  }
}));

import { EnemyManager, Wolf } from "./enemy.js";
import { POSITION_SNAP_THRESHOLD } from "./enemySync.js";
import { ENEMY_TUNING } from "./enemyAi.js";

/** Minimal Phaser scene stub: the wolf only needs sprites, containers and a clock. */
const createScene = ({ isConnected = false } = {}) => {
  const chainable = () => {
    const node = {
      add: () => node,
      setDepth: () => node,
      setPosition: () => node,
      setScale: () => node,
      setVisible: () => node,
      setAlpha: () => node,
      setOrigin: () => node,
      setStrokeStyle: () => node,
      setLineWidth: () => node,
      destroy: () => {}
    };
    return node;
  };

  const sprite = {
    x: 0,
    y: 0,
    active: true,
    body: {
      enable: true,
      velocity: { x: 0, y: 0 },
      reset(x, y) {
        sprite.x = x;
        sprite.y = y;
        this.velocity = { x: 0, y: 0 };
      },
      setCollideWorldBounds: () => {},
      setDrag: () => {},
      setMaxVelocity: () => {},
      setVelocity(x, y) {
        this.velocity = { x, y };
      }
    },
    setSize: () => sprite,
    setDepth: () => sprite,
    setVisible: () => sprite,
    setPosition(x, y) {
      sprite.x = x;
      sprite.y = y;
      return sprite;
    }
  };

  return {
    sprite,
    networkClient: { isConnected },
    physics: {
      add: {
        sprite: (x, y) => {
          sprite.x = x;
          sprite.y = y;
          return sprite;
        }
      }
    },
    add: {
      container: chainable,
      rectangle: chainable,
      text: chainable,
      ellipse: chainable,
      circle: chainable,
      triangle: chainable,
      line: chainable
    },
    time: { delayedCall: () => {} }
  };
};

const createWolf = ({ isConnected = true } = {}) => {
  const scene = createScene({ isConnected });
  return { scene, wolf: new Wolf(scene, 840, 600, 0) };
};

describe("Enemies are built from the shared catalog", () => {
  it("defaults to the legacy market wolf", () => {
    const { wolf } = createWolf();
    expect(wolf.monsterId).toBe("soi-xam");
    expect(wolf.name).toBe("Sói Xám");
    expect(wolf.level).toBe(5);
    expect(wolf.maxHp).toBe(45);
    expect(wolf.isBoss).toBe(false);
  });

  it("takes name, level and health from the requested monster", () => {
    const scene = createScene();
    const boss = new Wolf(scene, 8100, 3500, 7, "dong-mon-tuong-quan");

    expect(boss.monsterId).toBe("dong-mon-tuong-quan");
    expect(boss.name).toBe("Đông Môn Tướng Quân");
    expect(boss.level).toBe(30);
    expect(boss.maxHp).toBe(1800);
    expect(boss.isBoss).toBe(true);
    // A boss must not pop back up on the regular respawn timer.
    expect(boss.respawnMs).toBe(180000);
  });

  it("falls back to the wolf for an unknown monster id", () => {
    const scene = createScene();
    const enemy = new Wolf(scene, 100, 100, 1, "khong-ton-tai");
    expect(enemy.monsterId).toBe("soi-xam");
  });
});

describe("EnemyManager roster lifecycle", () => {
  const managerScene = () => ({
    ...createScene(),
    physics: { add: { sprite: createScene().physics.add.sprite } }
  });

  it("clears every enemy when the map changes but keeps the collider group", () => {
    const scene = managerScene();
    const manager = new EnemyManager(scene);
    const group = { add() {}, clear() {}, destroy() {} };
    manager.group = group;
    manager.enemies = [new Wolf(scene, 100, 100, 0), new Wolf(scene, 200, 200, 1)];

    expect(manager.getAll()).toHaveLength(2);
    manager.clear();
    expect(manager.getAll()).toHaveLength(0);
    // World colliders point at this group, so it must survive a roster swap.
    expect(manager.group).toBe(group);
  });
});

const player = (x, y) => ({ x, y, sprite: { x, y } });

describe("Wolf movement is server-owned", () => {
  it("never steers itself while the server owns movement", () => {
    const { scene, wolf } = createWolf();

    for (let frame = 0; frame < 60; frame++) {
      wolf.update(frame * 16, 16, player(880, 600), () => {});
    }

    expect(scene.sprite.x).toBe(840);
    expect(scene.sprite.y).toBe(600);
    expect(scene.sprite.body.velocity).toEqual({ x: 0, y: 0 });
  });

  it("chases the player itself when no server owns the roster", () => {
    const { scene, wolf } = createWolf({ isConnected: false });
    const target = player(840 + ENEMY_TUNING.stopDistance + 120, 600);
    const bites = vi.fn();

    for (let frame = 0; frame < 240; frame++) {
      wolf.update(frame * 16, 16, target, bites);
    }

    // 43 px/s closes the gap and then holds at the stop distance
    const distance = Math.hypot(scene.sprite.x - target.x, scene.sprite.y - target.y);
    expect(scene.sprite.x).toBeGreaterThan(840);
    expect(distance).toBeLessThanOrEqual(ENEMY_TUNING.stopDistance + 1);
    expect(distance).toBeGreaterThanOrEqual(ENEMY_TUNING.stopDistance - 1);
    expect(bites).toHaveBeenCalled();
  });

  it("follows the authoritative position smoothly and settles exactly on it", () => {
    const { scene, wolf } = createWolf();
    wolf.applyServerState({ x: 880, y: 600 });

    wolf.update(16, 16, player(2000, 2000), () => {});
    const firstStep = scene.sprite.x;
    expect(firstStep).toBeGreaterThan(840);
    expect(firstStep).toBeLessThan(880);

    for (let frame = 1; frame < 120; frame++) {
      const previous = scene.sprite.x;
      wolf.update(frame * 16, 16, player(2000, 2000), () => {});
      expect(scene.sprite.x).toBeGreaterThanOrEqual(previous);
      expect(scene.sprite.x).toBeLessThanOrEqual(880);
    }

    expect(scene.sprite.x).toBe(880);
  });

  it("applies a warp (respawn/teleport) at once instead of sliding across the map", () => {
    const { scene, wolf } = createWolf();
    const warpTo = 840 + POSITION_SNAP_THRESHOLD + 100;

    wolf.applyServerState({ x: warpTo, y: 600 });

    expect(scene.sprite.x).toBe(warpTo);
  });

  it("ignores a snapshot position that is not a usable number", () => {
    const { scene, wolf } = createWolf();

    wolf.applyServerState({ x: Number.NaN, y: 600, hp: 30 });
    wolf.update(16, 16, player(2000, 2000), () => {});

    expect(wolf.hp).toBe(30);
    expect(scene.sprite.x).toBe(840);
  });

  it("does not slide back to its spawn when the server takes over", () => {
    const { scene, wolf } = createWolf({ isConnected: false });
    const target = player(840 + ENEMY_TUNING.stopDistance + 120, 600);

    for (let frame = 0; frame < 240; frame++) {
      wolf.update(frame * 16, 16, target, () => {});
    }
    const offlineX = scene.sprite.x;
    expect(offlineX).toBeGreaterThan(900);

    // The socket comes up before the first roster snapshot arrives: the wolf must
    // hold still rather than slide back to a position the server never claimed
    scene.networkClient.isConnected = true;
    wolf.update(4000, 16, target, () => {});
    expect(scene.sprite.x).toBe(offlineX);

    // The first authoritative position is what it follows from then on
    wolf.applyServerState({ x: offlineX + 40, y: 600 });
    wolf.update(4016, 16, target, () => {});
    expect(scene.sprite.x).toBeGreaterThan(offlineX);
  });

  it("keeps biting whoever is in range, throttled by the bite cooldown", () => {
    const { wolf } = createWolf();
    const bites = vi.fn();

    wolf.update(1000, 16, player(2000, 2000), bites);
    expect(bites).not.toHaveBeenCalled();

    wolf.update(1000, 16, player(880, 600), bites);
    wolf.update(1100, 16, player(880, 600), bites);
    expect(bites).toHaveBeenCalledTimes(1);

    wolf.update(2600, 16, player(880, 600), bites);
    expect(bites).toHaveBeenCalledTimes(2);
  });
});
