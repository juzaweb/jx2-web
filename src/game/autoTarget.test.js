import { describe, expect, it } from "vitest";
import {
  AUTO_TARGET_PVP_RANGE,
  AUTO_TARGET_RANGE,
  pickAutoTarget
} from "./autoTarget.js";

const player = (overrides = {}) => ({ x: 0, y: 0, ...overrides });

const monster = (overrides = {}) => ({
  id: "wolf-1",
  x: 100,
  y: 0,
  isDead: false,
  active: true,
  ...overrides
});

const peer = (overrides = {}) => ({
  id: "peer-1",
  x: 100,
  y: 0,
  pkFlag: false,
  container: { active: true },
  ...overrides
});

describe("pickAutoTarget", () => {
  it("returns null without a usable hero position", () => {
    expect(pickAutoTarget()).toBeNull();
    expect(pickAutoTarget({ player: null })).toBeNull();
    expect(pickAutoTarget({ player: { x: NaN, y: 0 } })).toBeNull();
  });

  it("picks the closest living monster", () => {
    const near = monster({ id: "near", x: 80 });
    const far = monster({ id: "far", x: 300 });
    const picked = pickAutoTarget({ player: player(), enemies: [far, near] });

    expect(picked).toEqual({ target: near, kind: "monster" });
  });

  it("skips dead, inactive, torn-down and out-of-range monsters", () => {
    const dead = monster({ x: 10, isDead: true });
    const inactive = monster({ x: 20, active: false });
    const gone = monster({ x: 30, container: { active: false } });
    const tooFar = monster({ x: AUTO_TARGET_RANGE + 1 });
    const picked = pickAutoTarget({
      player: player(),
      enemies: [dead, inactive, gone, tooFar]
    });

    expect(picked).toBeNull();
  });

  it("ignores peers while the hero is peaceful", () => {
    const flagged = peer({ pkFlag: true, x: 40 });
    const picked = pickAutoTarget({ player: player(), peers: [flagged] });

    expect(picked).toBeNull();
  });

  it("prefers a PK-flagged peer over a closer monster while duelling", () => {
    const wolf = monster({ x: 30 });
    const rival = peer({ pkFlag: true, x: 400 });
    const picked = pickAutoTarget({
      player: player(),
      enemies: [wolf],
      peers: [rival],
      preferPlayers: true
    });

    expect(picked).toEqual({ target: rival, kind: "player" });
  });

  it("never picks a peaceful peer, or the hero's own avatar", () => {
    const peaceful = peer({ x: 40 });
    const own = peer({ id: "me", pkFlag: true, x: 50 });
    const picked = pickAutoTarget({
      player: player(),
      peers: [peaceful, own],
      preferPlayers: true,
      selfId: "me"
    });

    expect(picked).toBeNull();
  });

  it("falls back to a monster when no rival is flagged", () => {
    const wolf = monster({ x: 120 });
    const picked = pickAutoTarget({
      player: player(),
      enemies: [wolf],
      peers: [peer({ pkFlag: false })],
      preferPlayers: true
    });

    expect(picked).toEqual({ target: wolf, kind: "monster" });
  });

  it("respects the peer range while duelling", () => {
    const outOfRange = peer({ pkFlag: true, x: AUTO_TARGET_PVP_RANGE + 1 });
    const picked = pickAutoTarget({
      player: player(),
      peers: [outOfRange],
      preferPlayers: true
    });

    expect(picked).toBeNull();
  });
});
