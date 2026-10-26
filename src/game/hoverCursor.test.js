import { describe, expect, it, vi } from "vitest";

// `enemy.js` pulls Phaser in at module scope; the hit tests themselves are pure.
vi.mock("phaser", () => ({
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
    }
  }
}));

import {
  ATTACK_CURSOR,
  DEFAULT_CURSOR,
  applyCursor,
  cursorForGroundPoint,
  isAttackableAt
} from "./hoverCursor.js";

/** Minimal monster that `isPointOnEnemy` accepts (no visual rig => ellipse box). */
function enemy(overrides = {}) {
  return { x: 100, y: 100, isDead: false, active: true, ...overrides };
}

/** Minimal peer that `isPointOnPlayer` accepts. */
function player(overrides = {}) {
  return { id: "peer-1", x: 100, y: 100, pkFlag: false, ...overrides };
}

describe("isAttackableAt", () => {
  it("is true over a living monster", () => {
    expect(isAttackableAt([enemy()], [], 100, 100)).toBe(true);
  });

  it("is false over dead monsters and empty ground", () => {
    expect(isAttackableAt([enemy({ isDead: true })], [], 100, 100)).toBe(false);
    expect(isAttackableAt([enemy()], [], 900, 900)).toBe(false);
    expect(isAttackableAt([], [], 100, 100)).toBe(false);
  });

  it("is true over a peer only while that peer carries the PK flag", () => {
    expect(isAttackableAt([], [player({ pkFlag: false })], 100, 100)).toBe(false);
    expect(isAttackableAt([], [player({ pkFlag: true })], 100, 100)).toBe(true);
  });

  it("ignores a flagged peer standing behind a peaceful one, as the click does", () => {
    const near = player({ id: "near", pkFlag: false, x: 100 });
    const far = player({ id: "far", pkFlag: true, x: 200 });
    // Both bodies overlap x = 115, but `near` is the closer one, so a click
    // resolves to the peaceful body and only walks.
    expect(isAttackableAt([], [near, far], 115, 100)).toBe(false);
  });

  it("is false for coordinates that are not real numbers", () => {
    expect(isAttackableAt([enemy()], [player({ pkFlag: true })], NaN, 100)).toBe(false);
    expect(isAttackableAt([enemy()], [player({ pkFlag: true })], 100, Infinity)).toBe(false);
  });
});

describe("cursorForGroundPoint", () => {
  it("returns the saber cursor over a fight-able target", () => {
    expect(cursorForGroundPoint([enemy()], [], 100, 100)).toBe(ATTACK_CURSOR);
    expect(cursorForGroundPoint([], [player({ pkFlag: true })], 100, 100)).toBe(ATTACK_CURSOR);
  });

  it("falls back to the default cursor everywhere else", () => {
    expect(cursorForGroundPoint([enemy()], [], 600, 600)).toBe(DEFAULT_CURSOR);
    expect(cursorForGroundPoint([], [player()], 100, 100)).toBe(DEFAULT_CURSOR);
  });
});

describe("applyCursor", () => {
  it("writes the cursor when the element shows another one", () => {
    const element = { style: { cursor: DEFAULT_CURSOR } };
    applyCursor(element, ATTACK_CURSOR);
    expect(element.style.cursor).toBe(ATTACK_CURSOR);
  });

  it("skips the write when the element already shows that cursor", () => {
    const setCursor = vi.fn();
    const style = {};
    Object.defineProperty(style, "cursor", {
      get: () => ATTACK_CURSOR,
      set: setCursor
    });

    applyCursor({ style }, ATTACK_CURSOR);
    expect(setCursor).not.toHaveBeenCalled();
  });

  it("tolerates a missing element or style", () => {
    expect(() => applyCursor(null, ATTACK_CURSOR)).not.toThrow();
    expect(() => applyCursor(undefined, ATTACK_CURSOR)).not.toThrow();
    expect(() => applyCursor({}, ATTACK_CURSOR)).not.toThrow();
  });
});
