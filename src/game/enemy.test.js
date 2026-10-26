import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
    }
  }
}));

import { EnemyManager, Wolf, isPointOnEnemy, findEnemyAt } from "./enemy.js";
import { POSITION_SNAP_THRESHOLD } from "./enemySync.js";

/** Minimal Phaser scene stub: the wolf only needs sprites, containers and a clock. */
const createScene = ({ isConnected = false } = {}) => {
  const chainable = () => {
    const node = {
      add: () => node,
      setDepth: () => node,
      setPosition: () => node,
      setScale: () => node,
      setVisible: (value) => {
        node.visible = value;
        return node;
      },
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
    const enemy = new Wolf(scene, 12600, 8200, 7, "ma-giao-de-tu");

    expect(enemy.monsterId).toBe("ma-giao-de-tu");
    expect(enemy.name).toBe("Ma Giáo Đệ Tử");
    expect(enemy.level).toBe(29);
    expect(enemy.maxHp).toBe(420);
    expect(enemy.isBoss).toBe(false);
  });

  it("falls back to the wolf for an unknown monster id", () => {
    const scene = createScene();
    const enemy = new Wolf(scene, 100, 100, 1, "khong-ton-tai");
    expect(enemy.monsterId).toBe("soi-xam");
  });

  it("shows its name only while the hero could see it", () => {
    const { wolf } = createWolf({ isConnected: false });

    wolf.update(0, 16, player(900, 600), () => {});
    expect(wolf.nameText.visible).toBe(true);

    // Far across the clearing: the label is dropped, the monster is not.
    wolf.update(16, 16, player(4300, 600), () => {});
    expect(wolf.nameText.visible).toBe(false);
    expect(wolf.sprite.active).toBe(true);
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

  it("holds still until the first authoritative snapshot arrives", () => {
    const { scene, wolf } = createWolf();
    const target = player(2000, 2000);

    // No snapshot yet: the render must not invent a position of its own.
    for (let frame = 0; frame < 60; frame++) {
      wolf.update(frame * 16, 16, target, () => {});
    }
    expect(scene.sprite.x).toBe(840);

    // The first authoritative position is what it follows from then on
    wolf.applyServerState({ x: 880, y: 600 });
    wolf.update(4016, 16, target, () => {});
    expect(scene.sprite.x).toBeGreaterThan(840);
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

describe("isPointOnEnemy and findEnemyAt mouse targeting", () => {
  it("detects mouse click on a quadruped beast (wolf)", () => {
    const enemy = {
      x: 500,
      y: 500,
      isDead: false,
      active: true,
      monster: { visual: { kind: "beast", scale: 1 } }
    };

    expect(isPointOnEnemy(enemy, 500, 500)).toBe(true);
    expect(isPointOnEnemy(enemy, 550, 520)).toBe(true);
    expect(isPointOnEnemy(enemy, 440, 470)).toBe(true);
    // Out of bounds
    expect(isPointOnEnemy(enemy, 700, 500)).toBe(false);
    expect(isPointOnEnemy(enemy, 500, 700)).toBe(false);
  });

  it("detects mouse click on a humanoid/boss enemy torso and head", () => {
    const humanoid = {
      x: 1000,
      y: 1000,
      isDead: false,
      active: true,
      monster: { visual: { kind: "humanoid" } }
    };

    // Body/torso above feet
    expect(isPointOnEnemy(humanoid, 1000, 900)).toBe(true);
    // Near feet
    expect(isPointOnEnemy(humanoid, 1000, 1030)).toBe(true);
    // Too far above head
    expect(isPointOnEnemy(humanoid, 1000, 750)).toBe(false);
  });

  it("ignores dead or inactive enemies", () => {
    const deadEnemy = {
      x: 500,
      y: 500,
      isDead: true,
      active: true,
      monster: { visual: { kind: "beast" } }
    };
    expect(isPointOnEnemy(deadEnemy, 500, 500)).toBe(false);

    const inactiveEnemy = {
      x: 500,
      y: 500,
      isDead: false,
      active: false,
      monster: { visual: { kind: "beast" } }
    };
    expect(isPointOnEnemy(inactiveEnemy, 500, 500)).toBe(false);
  });

  it("EnemyManager maintains O(1) enemyMap lookup on spawn, snapshot and clear", () => {
    const scene = {
      ...createScene(),
      physics: { add: { sprite: createScene().physics.add.sprite, group: () => ({ add() {}, clear() {} }) } }
    };
    const manager = new EnemyManager(scene);

    manager.create([
      { id: 10, x: 100, y: 100, monsterId: "soi-xam" },
      { id: 20, x: 200, y: 200, monsterId: "soi-xam" }
    ]);

    expect(manager.getById(10)).toBeDefined();
    expect(manager.getById(10).id).toBe(10);
    expect(manager.getById(20).id).toBe(20);
    expect(manager.getById(99)).toBeNull();

    manager.applyServerSnapshot([{ id: 30, x: 300, y: 300, monsterId: "soi-xam" }]);
    expect(manager.getById(30).id).toBe(30);

    manager.clear();
    expect(manager.getById(10)).toBeNull();
    expect(manager.getById(30)).toBeNull();
  });

  it("findEnemyAt selects the closest enemy among candidates", () => {
    const wolf1 = {
      id: 1,
      x: 300,
      y: 300,
      isDead: false,
      active: true,
      monster: { visual: { kind: "beast" } }
    };
    const wolf2 = {
      id: 2,
      x: 340,
      y: 300,
      isDead: false,
      active: true,
      monster: { visual: { kind: "beast" } }
    };

    // Click at 305, 300 is closer to wolf1
    expect(findEnemyAt([wolf1, wolf2], 305, 300)).toBe(wolf1);
    // Click at 335, 300 is closer to wolf2
    expect(findEnemyAt([wolf1, wolf2], 335, 300)).toBe(wolf2);
    // Click far away returns null
    expect(findEnemyAt([wolf1, wolf2], 800, 800)).toBeNull();
  });
});

