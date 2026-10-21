import { describe, expect, it } from "vitest";
import { buildCharacterPreview } from "./characterPreview.js";
import { HERO_BODY } from "./heroBody.js";

describe("buildCharacterPreview", () => {
  it("uses the front row for the paper doll's default pose", () => {
    const preview = buildCharacterPreview({ gender: "male" });
    const { frameWidth, frameHeight, scale, footOffsetY } = HERO_BODY;
    const margin = footOffsetY / scale;
    const viewBox = [
      -(frameWidth / 2) * scale,
      -(frameHeight - margin) * scale,
      frameWidth * scale,
      frameHeight * scale
    ].join(" ");

    expect(preview.textureUrl).toMatch(/^\/hero-body-male\.png\?v=/);
    expect(preview.backgroundSize).toBe("400% 400%");
    expect(preview.backgroundPosition).toBe("0% 0%");
    expect(preview.aspectRatio).toBe(`${frameWidth} / ${frameHeight}`);
    expect(preview.viewBox).toBe(viewBox);
  });

  it("selects the right-facing frame and the female sheet", () => {
    const preview = buildCharacterPreview({ gender: "female", direction: 2 });

    expect(preview.textureUrl).toMatch(/^\/hero-body-female\.png\?v=/);
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
