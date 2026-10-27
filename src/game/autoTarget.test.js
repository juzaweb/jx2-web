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

  it("never rings a peer on a no-PvP map", () => {
    const flagged = peer({ pkFlag: true, x: 40 });
    const picked = pickAutoTarget({
      player: player(),
      peers: [flagged],
      allowPeers: true,
      pvpMode: "none"
    });

    expect(picked).toBeNull();
  });

  it("rings an enemy camp on a faction battlefield", () => {
    const enemy = peer({ id: "enemy", pkFlag: false, faction: "thuc", x: 40 });
    const ally = peer({ id: "ally", pkFlag: false, faction: "han", x: 60 });
    const picked = pickAutoTarget({
      player: player(),
      peers: [enemy, ally],
      allowPeers: true,
      pvpMode: "faction",
      selfFaction: "han"
    });

    expect(picked).toEqual({ target: enemy, kind: "player" });
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

describe("autoTarget performance verification", () => {
  it("executes 10,000 proximity target searches rapidly", () => {
    const p = player({ x: 500, y: 500 });
    const enemies = Array.from({ length: 100 }, (_, i) => monster({ id: `wolf-${i}`, x: (i * 17) % 1500, y: (i * 23) % 1500 }));
    const peers = Array.from({ length: 50 }, (_, i) => peer({ id: `peer-${i}`, x: (i * 19) % 1500, y: (i * 29) % 1500, pkFlag: true }));

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      pickAutoTarget({ player: p, enemies, peers, allowPeers: true });
    }
    const elapsed = performance.now() - start;

    // Isolated this takes ~30ms. Vitest runs one worker per file (82 of them), so
    // under full-suite contention the same loop can report several hundred ms;
    // the bound still catches a quadratic regression without flagging CPU load.
    expect(elapsed).toBeLessThan(600);
  });
});
