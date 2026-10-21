import { describe, expect, it } from "vitest";
import { buildBodyEquipment } from "./heroBodyEquipment.js";

describe("buildBodyEquipment", () => {
  it("returns no overlays for empty or malformed equipment", () => {
    expect(buildBodyEquipment()).toEqual([]);
    expect(buildBodyEquipment({ equipment: null })).toEqual([]);
  });

  it("draws each worn slot in the body rig's order", () => {
    const parts = buildBodyEquipment({
      direction: 0,
      equipment: {
        armor: "cam-y-bao",
        helmet: "tu-kim-quan",
        weapon: "hac-ung-kiem",
        accessory: "ngoc-nhan"
      }
    });

    expect([...new Set(parts.map((part) => part.slot))]).toEqual([
      "armor",
      "accessory",
      "weapon",
      "helmet"
    ]);
  });

  it("changes the weapon shape with the equipped item", () => {
    const jian = buildBodyEquipment({ equipment: { weapon: "hac-ung-kiem" } });
    const claw = buildBodyEquipment({ equipment: { weapon: "thiet-trao" } });

    expect(jian.some((part) => part.kind === "line" && part.slot === "weapon")).toBe(true);
    expect(claw.filter((part) => part.kind === "line")).toHaveLength(3);
  });

  it("mirrors the hand overlays across side-facing directions", () => {
    const right = buildBodyEquipment({ direction: 2, equipment: { weapon: "hac-ung-kiem" } });
    const left = buildBodyEquipment({ direction: 6, equipment: { weapon: "hac-ung-kiem" } });
    const weaponX = (parts) => parts.find((part) => part.slot === "weapon").x;

    expect(Math.sign(weaponX(right))).toBe(-Math.sign(weaponX(left)));
  });
});
