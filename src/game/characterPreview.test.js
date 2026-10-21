import { describe, expect, it } from "vitest";
import { buildCharacterPreview } from "./characterPreview.js";

describe("buildCharacterPreview", () => {
  it("uses the front row for the paper doll's default pose", () => {
    const preview = buildCharacterPreview({ gender: "male" });

    expect(preview.textureUrl).toBe("/hero-body-male.png");
    expect(preview.backgroundSize).toBe("400% 400%");
    expect(preview.backgroundPosition).toBe("0% 0%");
    expect(preview.viewBox).toBe("-25.9 -94.35 51.8 96.2");
  });

  it("selects the right-facing frame and the female sheet", () => {
    const preview = buildCharacterPreview({ gender: "female", direction: 2 });

    expect(preview.textureUrl).toBe("/hero-body-female.png");
    expect(preview.backgroundPosition).toContain("66.66");
  });

  it("draws the same equipment overlays as the in-game hero", () => {
    const preview = buildCharacterPreview({
      equipment: { armor: "cam-y-bao", helmet: "tu-kim-quan" }
    });

    expect(new Set(preview.parts.map((part) => part.slot))).toEqual(
      new Set(["armor", "helmet"])
    );
  });
});
