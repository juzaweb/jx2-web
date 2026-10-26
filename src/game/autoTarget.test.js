import { describe, expect, it } from "vitest";
import { AUTO_TARGET_RANGE, pickAutoTarget } from "./autoTarget.js";

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

  it("picks the nearest body, monster or duellist alike", () => {
    const nearWolf = monster({ id: "wolf-near", x: 30 });
    const farRival = peer({ pkFlag: true, x: 400 });
    const peerPicked = pickAutoTarget({
      player: player(),
      enemies: [nearWolf],
      peers: [farRival],
      allowPeers: true
    });
    expect(peerPicked).toEqual({ target: nearWolf, kind: "monster" });

    const nearRival = peer({ id: "rival-near", pkFlag: true, x: 40 });
    const farWolf = monster({ id: "wolf-far", x: 410 });
    const rivalPicked = pickAutoTarget({
      player: player(),
      enemies: [farWolf],
      peers: [nearRival],
      allowPeers: true
    });
    expect(rivalPicked).toEqual({ target: nearRival, kind: "player" });
  });

  it("targets a flagged peer standing as far as the monster reach allows", () => {
    // Live case: the two heroes stood ~1000px apart (both framed on screen) but
    // the peer check used to stop at 600, so a monster further away won instead.
    const wolf = monster({ x: 1061 });
    const rival = peer({ pkFlag: true, x: 1011 });
    const picked = pickAutoTarget({
      player: player(),
      enemies: [wolf],
      peers: [rival],
      allowPeers: true
    });

    expect(picked).toEqual({ target: rival, kind: "player" });
  });

  it("never picks a peaceful peer, or the hero's own avatar", () => {
    const peaceful = peer({ x: 40 });
    const own = peer({ id: "me", pkFlag: true, x: 50 });
    const picked = pickAutoTarget({
      player: player(),
      peers: [peaceful, own],
      allowPeers: true,
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
      allowPeers: true
    });

    expect(picked).toEqual({ target: wolf, kind: "monster" });
  });

  it("shares one radius between monsters and peers", () => {
    const outOfRange = peer({ pkFlag: true, x: AUTO_TARGET_RANGE + 1 });
    const picked = pickAutoTarget({
      player: player(),
      peers: [outOfRange],
      allowPeers: true
    });

    expect(picked).toBeNull();
  });
});
