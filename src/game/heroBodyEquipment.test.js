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

  it("falls back to the sword shape for a weapon id the catalog does not define", () => {
    const unknown = buildBodyEquipment({ equipment: { weapon: "khong-co-trong-catalog" } });
    const another = buildBodyEquipment({ equipment: { weapon: "bat-ky" } });

    expect(unknown).toEqual(another);
    expect(unknown.some((part) => part.kind === "line" && part.slot === "weapon")).toBe(true);
  });

  it("mirrors the hand overlays across side-facing directions", () => {
    const right = buildBodyEquipment({ direction: 2, equipment: { weapon: "hac-ung-kiem" } });
    const left = buildBodyEquipment({ direction: 6, equipment: { weapon: "hac-ung-kiem" } });
    const weaponX = (parts) => parts.find((part) => part.slot === "weapon").x;

    expect(Math.sign(weaponX(right))).toBe(-Math.sign(weaponX(left)));
  });

  it("skips excluded slots when excludeSlots is provided", () => {
    const parts = buildBodyEquipment({
      direction: 0,
      equipment: {
        armor: "cam-y-bao",
        helmet: "tu-kim-quan",
        weapon: "hac-ung-kiem"
      },
      excludeSlots: ["armor", "helmet"]
    });

    const slots = parts.map((part) => part.slot);
    expect(slots.includes("armor")).toBe(false);
    expect(slots.includes("helmet")).toBe(false);
    expect(slots.includes("weapon")).toBe(true);
  });
});
