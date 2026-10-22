import { describe, expect, it } from "vitest";
import { buildCharacterPreview } from "./characterPreview.js";
import { HERO_PREVIEW_ART } from "./heroBody.js";

describe("buildCharacterPreview", () => {
  it("uses the static male paper-doll art", () => {
    const preview = buildCharacterPreview({ gender: "male" });

    expect(preview.textureUrl).toMatch(/^\/hero-preview-male\.png\?v=/);
    expect(preview.backgroundSize).toBe("100% 100%");
    expect(preview.backgroundPosition).toBe("center");
    expect(preview.aspectRatio).toBe(
      `${HERO_PREVIEW_ART.male.width} / ${HERO_PREVIEW_ART.male.height}`
    );
  });

  it("selects the female art and keeps its own aspect ratio", () => {
    const preview = buildCharacterPreview({ gender: "female" });

    expect(preview.textureUrl).toMatch(/^\/hero-preview-female\.png\?v=/);
    expect(preview.aspectRatio).toBe(
      `${HERO_PREVIEW_ART.female.width} / ${HERO_PREVIEW_ART.female.height}`
    );
  });

  it("falls back to the male art for an unknown gender", () => {
    const preview = buildCharacterPreview({ gender: "unknown" });

    expect(preview.textureUrl).toMatch(/^\/hero-preview-male\.png\?v=/);
  });
});
