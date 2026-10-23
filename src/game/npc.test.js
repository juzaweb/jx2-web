import { describe, expect, it } from "vitest";
import { NPC_DUOC, isInTalkRange, isPointOnNpc, npcApproachPoint, npcOriginY, npcScale } from "./npc.js";

const npc = { gx: 4580, gy: 7120 };

describe("herb-shop NPC", () => {
  it("renders the same height band as the hero sheets", () => {
    expect(npcScale()).toBeCloseTo(NPC_DUOC.heightUnits / NPC_DUOC.contentHeight);
    expect(npcOriginY()).toBeCloseTo(
      (NPC_DUOC.frameHeight - NPC_DUOC.bottomMargin) / NPC_DUOC.frameHeight
    );
  });

  it("accepts clicks on the drawn body above the feet", () => {
    expect(isPointOnNpc(npc, 4580, 7120)).toBe(true);
    expect(isPointOnNpc(npc, 4580, 6900)).toBe(true);
    expect(isPointOnNpc(npc, 4650, 7000)).toBe(true);
  });

  it("rejects clicks outside the body box", () => {
    expect(isPointOnNpc(npc, 4480, 7000)).toBe(false);
    expect(isPointOnNpc(npc, 4580, 7200)).toBe(false);
    expect(isPointOnNpc(npc, 4580, 6600)).toBe(false);
  });

  it("walks the hero to a spot in front of the NPC instead of its feet", () => {
    const point = npcApproachPoint(npc);
    expect(point.x).toBe(npc.gx);
    expect(point.y).toBeGreaterThan(npc.gy);
  });

  it("talks to the NPC from the edge of its drawn body, not only its feet", () => {
    // The sprite is ~257 px wide, so standing beside it must still count.
    expect(isInTalkRange(npc, npc.gx + 200, npc.gy)).toBe(true);
    expect(isInTalkRange(npc, npc.gx, npc.gy + 200)).toBe(true);
    expect(isInTalkRange(npc, npc.gx, npc.gy - 300)).toBe(true);
  });

  it("keeps talking out of reach across the square", () => {
    expect(isInTalkRange(npc, npc.gx + 400, npc.gy)).toBe(false);
    expect(isInTalkRange(npc, npc.gx, npc.gy + 400)).toBe(false);
  });

  it("floats the name tag above the head height", () => {
    expect(NPC_DUOC.nameOffsetUnits).toBeGreaterThan(NPC_DUOC.heightUnits);
  });
});
