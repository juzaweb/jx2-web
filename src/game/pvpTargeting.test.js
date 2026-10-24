import { describe, expect, it } from "vitest";
import {
  findNearestPvpTarget,
  findPlayerAt,
  isPointOnPlayer,
  PLAYER_HIT_BOX
} from "./pvpTargeting.js";
import { PVP_ATTACK_RANGE } from "./pvp.js";

const peer = (id, x, y, extra = {}) => ({ id, x, y, pkFlag: true, container: { active: true }, ...extra });

describe("findPlayerAt", () => {
  it("returns the peer under the click point", () => {
    const target = peer("b", 1000, 2000);
    expect(findPlayerAt([peer("a", 100, 100), target], 1020, 2010)).toBe(target);
  });

  it("counts a click on the torso far above the feet", () => {
    const target = peer("b", 1000, 2000);
    expect(findPlayerAt([target], 1000, 2000 - PLAYER_HIT_BOX.aboveFeet + 10)).toBe(target);
  });

  it("prefers the closest peer when several overlap the point", () => {
    const near = peer("near", 1000, 2000);
    const far = peer("far", 1040, 2000);
    expect(findPlayerAt([far, near], 1010, 2000)).toBe(near);
  });

  it("returns null when the click misses every peer", () => {
    expect(findPlayerAt([peer("a", 1000, 2000)], 1000 + PLAYER_HIT_BOX.halfWidth + 1, 2000)).toBeNull();
    expect(findPlayerAt([peer("a", 1000, 2000)], 1000, 2000 + PLAYER_HIT_BOX.belowFeet + 1)).toBeNull();
  });

  it("ignores destroyed peers", () => {
    const gone = peer("gone", 1000, 2000, { container: { active: false } });
    expect(findPlayerAt([gone], 1000, 2000)).toBeNull();
  });

  it("tolerates junk input", () => {
    expect(findPlayerAt(null, 0, 0)).toBeNull();
    expect(findPlayerAt([peer("a", 0, 0)], Number.NaN, 0)).toBeNull();
    expect(findPlayerAt([null, undefined, { id: "bad" }], 0, 0)).toBeNull();
  });
});

describe("isPointOnPlayer", () => {
  it("rejects the space just below the feet", () => {
    expect(isPointOnPlayer(peer("a", 0, 0), 0, PLAYER_HIT_BOX.belowFeet)).toBe(false);
    expect(isPointOnPlayer(peer("a", 0, 0), 0, 0)).toBe(true);
  });
});

describe("findNearestPvpTarget", () => {
  const attacker = { id: "me", x: 0, y: 0 };

  it("returns the closest flagged peer in range", () => {
    const near = peer("near", 100, 0);
    const far = peer("far", 400, 0);
    expect(findNearestPvpTarget(attacker, [far, near])).toBe(near);
  });

  it("skips peers that did not opt into PK", () => {
    const peaceful = peer("peaceful", 10, 0, { pkFlag: false });
    expect(findNearestPvpTarget(attacker, [peaceful])).toBeNull();
  });

  it("skips peers outside the strike range", () => {
    expect(findNearestPvpTarget(attacker, [peer("far", PVP_ATTACK_RANGE + 1, 0)])).toBeNull();
    expect(findNearestPvpTarget(attacker, [peer("edge", PVP_ATTACK_RANGE, 0)])).not.toBeNull();
  });

  it("never targets the attacker", () => {
    expect(findNearestPvpTarget(attacker, [peer("me", 0, 0)])).toBeNull();
  });

  it("ignores destroyed peers", () => {
    const gone = peer("gone", 10, 0, { container: { active: false } });
    expect(findNearestPvpTarget(attacker, [gone])).toBeNull();
  });

  it("tolerates junk input", () => {
    expect(findNearestPvpTarget(null, [])).toBeNull();
    expect(findNearestPvpTarget(attacker, null)).toBeNull();
  });
});
