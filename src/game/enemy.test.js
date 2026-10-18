import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
    }
  }
}));

import { Wolf } from "./enemy.js";
import { POSITION_SNAP_THRESHOLD } from "./enemySync.js";

/** Minimal Phaser scene stub: the wolf only needs sprites, containers and a clock. */
const createScene = () => {
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

const createWolf = () => {
  const scene = createScene();
  return { scene, wolf: new Wolf(scene, 840, 600, 0) };
};

const player = (x, y) => ({ x, y, sprite: { x, y } });

describe("Wolf movement is server-owned", () => {
  it("never steers itself toward the player it renders next to", () => {
    const { scene, wolf } = createWolf();

    for (let frame = 0; frame < 60; frame++) {
      wolf.update(frame * 16, 16, player(2000, 2000), () => {});
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
