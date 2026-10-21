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
import { deriveCharacterSheet } from "./characterStats.js";

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

  it("scales movement speed when a speed buff is active", () => {
    mockScene.keys.D.isDown = true;
    player.updateMovement(16);
    const normalSpeed = player.sprite.body.velocity.x;

    mockScene.combat = {
      getEffectiveStats: () => ({ speedPct: 0.2 })
    };
    player.updateMovement(16);
    const buffedSpeed = player.sprite.body.velocity.x;

    expect(buffedSpeed).toBeCloseTo(normalSpeed * 1.2);
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

  it("shows looping formation ring at character feet and hides it on demand", () => {
    const formationSprite = {
      setOrigin: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      anims: { isPlaying: false, currentAnim: null }
    };
    mockScene.add.sprite = vi.fn(() => formationSprite);
    mockScene.textures = {
      exists: vi.fn(() => true),
      get: vi.fn(() => ({ frameTotal: 16 }))
    };
    mockScene.anims = {
      exists: vi.fn(() => false),
      create: vi.fn(),
      generateFrameNumbers: vi.fn(() => Array.from({ length: 16 }, (_, i) => i))
    };

    player.showFormation("vfx-la-han-tran");

    expect(mockScene.anims.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "vfx-la-han-tran-spin",
        frameRate: 12,
        repeat: -1
      })
    );
    expect(mockScene.add.sprite).toHaveBeenCalledWith(0, 41, "vfx-la-han-tran");
    expect(formationSprite.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(formationSprite.setScale).toHaveBeenCalledWith(0.6);
    expect(formationSprite.setVisible).toHaveBeenCalledWith(true);
    expect(formationSprite.play).toHaveBeenCalledWith("vfx-la-han-tran-spin", true);

    // Can adjust scale dynamically on subsequent showFormation calls
    player.showFormation("vfx-la-han-tran", 0.5);
    expect(formationSprite.setScale).toHaveBeenCalledWith(0.5);

    // hideFormation stops and hides
    player.hideFormation();
    expect(formationSprite.setVisible).toHaveBeenCalledWith(false);
    expect(formationSprite.stop).toHaveBeenCalled();

    // destroy tears down formationSprite
    player.destroy();
    expect(formationSprite.destroy).toHaveBeenCalled();
    expect(player.formationSprite).toBeNull();
  });
});

describe("Player equipment bonuses", () => {
  const makePlayer = () => new Player(createMockScene(), 100, 100);
  it("adds worn weapon bonuses without stacking on swaps", () => {
    const player = makePlayer();
    const baseAttack = player.stats.attack;
    const baseCrit = player.stats.critRate;

    player.applyEquipment({ ...player.equipment, weapon: "hac-ung-kiem" }); // +10 attack, +2% crit
    expect(player.stats.attack).toBe(baseAttack + 10);
    expect(player.stats.critRate).toBeCloseTo(baseCrit + 0.02, 4);

    player.applyEquipment({ ...player.equipment, weapon: "phach-dao" }); // +16 attack, +3% crit
    expect(player.stats.attack).toBe(baseAttack + 16);
    expect(player.stats.critRate).toBeCloseTo(baseCrit + 0.03, 4);

    player.applyEquipment({ ...player.equipment, weapon: null });
    expect(player.stats.attack).toBe(baseAttack);
    expect(player.stats.critRate).toBeCloseTo(baseCrit, 4);
  });

  it("adds armour defence while leaving server-owned HP alone", () => {
    const player = makePlayer();
    const baseDefense = player.stats.defense;
    const baseMaxHp = player.stats.maxHp;

    player.applyEquipment({ ...player.equipment, armor: "cam-y-bao" }); // +8 defence, +40 HP

    expect(player.stats.defense).toBe(baseDefense + 8);
    expect(player.stats.maxHp).toBe(baseMaxHp);
  });
});

describe("Character sheet + equipment", () => {
  it("shows the equipped weapon bonus in the sheet", () => {
    const player = new Player(createMockScene(), 100, 100);
    player.applyEquipment({ ...player.equipment, weapon: "phach-dao" }); // +16 attack

    const sheet = deriveCharacterSheet(player.stats);
    const attack = sheet.combat.find((row) => row.key === "physicalAtk");
    expect(attack.value).toBe("40");
  });
});

describe("Player saved stats", () => {
  it("never restores derived combat stats from disk", () => {
    const player = new Player(createMockScene(), 100, 100);
    player.loadStats({ level: 5, attack: 999, defense: 999, critRate: 1, critDamage: 9, coins: 12 });

    expect(player.stats.level).toBe(5);
    expect(player.stats.coins).toBe(12);
    expect(player.stats.attack).toBe(24);
    expect(player.stats.defense).toBe(6);
    expect(player.stats.critRate).toBe(0.12);
    expect(player.stats.critDamage).toBe(1.5);
  });
});
