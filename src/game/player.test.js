// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("phaser", () => {
  class Vector2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    length() {
      return Math.hypot(this.x, this.y);
    }
    normalize() {
      const len = this.length();
      if (len > 0) {
        this.x /= len;
        this.y /= len;
      }
      return this;
    }
    scale(factor) {
      this.x *= factor;
      this.y *= factor;
      return this;
    }
  }

  return {
    BlendModes: { ADD: 0 },
    Math: {
      Vector2,
      Linear: (p0, p1, t) => p0 + t * (p1 - p0)
    }
  };
});

import { Player } from "./player.js";

const createMockScene = () => {
  const node = () => ({
    x: 0,
    y: 0,
    children: [],
    setDepth: () => node(),
    setScale: () => node(),
    setVisible: () => node(),
    setAlpha: () => node(),
    setOrigin: () => node(),
    setPosition: () => node(),
    setSize: () => node(),
    setStrokeStyle: () => node(),
    setLineWidth: () => node(),
    setFillStyle: () => node(),
    setBlendMode: () => node(),
    setText: () => node(),
    setColor: () => node(),
    add: () => node(),
    removeAll: () => node(),
    destroy: () => {}
  });

  const keys = {
    W: { isDown: false },
    A: { isDown: false },
    S: { isDown: false },
    D: { isDown: false },
    UP: { isDown: false },
    DOWN: { isDown: false },
    LEFT: { isDown: false },
    RIGHT: { isDown: false }
  };

  const sprite = {
    x: 100,
    y: 100,
    body: {
      velocity: {
        x: 0,
        y: 0,
        length() {
          return Math.hypot(this.x, this.y);
        }
      },
      setDrag: vi.fn(),
      setMaxVelocity: vi.fn()
    },
    setSize: vi.fn(),
    setCollideWorldBounds: vi.fn(),
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    setPosition(x, y) {
      sprite.x = x;
      sprite.y = y;
    },
    setVelocity(vx, vy) {
      sprite.body.velocity.x = vx;
      sprite.body.velocity.y = vy;
    }
  };

  const removeKey = vi.fn();

  return {
    keys,
    sprite,
    physics: {
      add: {
        sprite: () => sprite
      }
    },
    add: {
      container: () => node(),
      text: () => node(),
      graphics: () => node(),
      ellipse: () => node(),
      circle: () => node(),
      rectangle: () => node(),
      polygon: () => node(),
      line: () => node()
    },
    tweens: {
      add: vi.fn()
    },
    input: {
      keyboard: {
        addKeys: vi.fn(() => keys),
        removeKey
      }
    },
    combat: {
      cancelPendingCast: vi.fn()
    }
  };
};

describe("Player movement controls", () => {
  let mockScene;
  let player;

  beforeEach(() => {
    mockScene = createMockScene();
    player = new Player(mockScene, 100, 100);
  });

  it("initializes movement keys on creation", () => {
    expect(mockScene.input.keyboard.addKeys).toHaveBeenCalledWith(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT",
      false
    );
    expect(player.keys).toBe(mockScene.keys);
  });

  it("moves upward with W or UP arrow key", () => {
    mockScene.keys.W.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.y).toBeLessThan(0);
    expect(player.sprite.body.velocity.x).toBe(0);

    mockScene.keys.W.isDown = false;
    mockScene.keys.UP.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.y).toBeLessThan(0);
    expect(player.sprite.body.velocity.x).toBe(0);
  });

  it("moves downward with S or DOWN arrow key", () => {
    mockScene.keys.S.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.y).toBeGreaterThan(0);
    expect(player.sprite.body.velocity.x).toBe(0);

    mockScene.keys.S.isDown = false;
    mockScene.keys.DOWN.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.y).toBeGreaterThan(0);
    expect(player.sprite.body.velocity.x).toBe(0);
  });

  it("moves leftward with A or LEFT arrow key", () => {
    mockScene.keys.A.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.x).toBeLessThan(0);
    expect(player.sprite.body.velocity.y).toBe(0);

    mockScene.keys.A.isDown = false;
    mockScene.keys.LEFT.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.x).toBeLessThan(0);
    expect(player.sprite.body.velocity.y).toBe(0);
  });

  it("moves rightward with D or RIGHT arrow key", () => {
    mockScene.keys.D.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.x).toBeGreaterThan(0);
    expect(player.sprite.body.velocity.y).toBe(0);

    mockScene.keys.D.isDown = false;
    mockScene.keys.RIGHT.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.x).toBeGreaterThan(0);
    expect(player.sprite.body.velocity.y).toBe(0);
  });

  it("supports diagonal movement with normalized velocity", () => {
    mockScene.keys.W.isDown = true;
    mockScene.keys.D.isDown = true;
    player.updateMovement(16);

    expect(player.sprite.body.velocity.x).toBeGreaterThan(0);
    expect(player.sprite.body.velocity.y).toBeLessThan(0);

    const speed = player.sprite.body.velocity.length();
    // Verify length matches standard single-axis speed
    mockScene.keys.W.isDown = false;
    mockScene.keys.D.isDown = false;
    mockScene.keys.RIGHT.isDown = true;
    player.updateMovement(16);
    const cardinalSpeed = player.sprite.body.velocity.length();

    expect(Math.abs(speed - cardinalSpeed)).toBeLessThan(0.001);
  });

  it("cancels opposing directions smoothly", () => {
    mockScene.keys.W.isDown = true;
    mockScene.keys.S.isDown = true;
    player.updateMovement(16);

    expect(player.sprite.body.velocity.x).toBe(0);
    expect(player.sprite.body.velocity.y).toBe(0);
  });

  it("cancels active click-to-move and pending casts when keyboard key is pressed", () => {
    player.moveTo(200, 300);
    expect(player.isMovingToTarget).toBe(true);

    mockScene.keys.A.isDown = true;
    player.updateMovement(16);

    expect(player.isMovingToTarget).toBe(false);
    expect(player.targetX).toBeNull();
    expect(player.targetY).toBeNull();
    expect(mockScene.combat.cancelPendingCast).toHaveBeenCalled();
  });

  it("stops velocity when all keys are released and no click target exists", () => {
    mockScene.keys.W.isDown = true;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.y).toBeLessThan(0);

    mockScene.keys.W.isDown = false;
    player.updateMovement(16);
    expect(player.sprite.body.velocity.x).toBe(0);
    expect(player.sprite.body.velocity.y).toBe(0);
  });

  it("ignores keyboard keys when user is typing in an input element or contenteditable", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    mockScene.keys.W.isDown = true;
    player.updateMovement(16);

    expect(player.sprite.body.velocity.x).toBe(0);
    expect(player.sprite.body.velocity.y).toBe(0);

    document.body.removeChild(input);

    const editable = document.createElement("div");
    editable.tabIndex = 0;
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);
    editable.focus();

    mockScene.keys.W.isDown = true;
    player.updateMovement(16);

    expect(player.sprite.body.velocity.x).toBe(0);
    expect(player.sprite.body.velocity.y).toBe(0);

    document.body.removeChild(editable);
  });

  it("delegates typing check to scene.isTyping when available", () => {
    mockScene.isTyping = vi.fn(() => true);
    mockScene.keys.W.isDown = true;
    player.updateMovement(16);

    expect(mockScene.isTyping).toHaveBeenCalled();
    expect(player.sprite.body.velocity.x).toBe(0);
    expect(player.sprite.body.velocity.y).toBe(0);
  });

  it("cleans up keys on destroy", () => {
    player.destroy();
    expect(mockScene.input.keyboard.removeKey).toHaveBeenCalledTimes(8);
    expect(player.keys).toBeNull();
  });
});
