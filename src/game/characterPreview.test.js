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
    expect(preview.layers).toEqual([]);
  });

  it("resolves dynamic equipment layers for full wuxia outfit", () => {
    const preview = buildCharacterPreview({
      gender: "male",
      equipment: {
        helmet: "non-lang-khach",
        armor: "ao-lang-khach"
      }
    });

    expect(preview.layers).toHaveLength(3);
    expect(preview.layers[0]).toMatchObject({
      key: "pants",
      url: expect.stringMatching(/^\/hero-preview-pants-lang-khach-male\.png\?v=/),
      zIndex: 2
    });
    expect(preview.layers[1]).toMatchObject({
      key: "armor",
      url: expect.stringMatching(/^\/hero-preview-armor-lang-khach-male\.png\?v=/),
      zIndex: 3
    });
    expect(preview.layers[2]).toMatchObject({
      key: "helmet",
      url: expect.stringMatching(/^\/hero-preview-hat-non-truc\.png\?v=/),
      zIndex: 4
    });
  });

  it("resolves female variants for equipment overlays", () => {
    const preview = buildCharacterPreview({
      gender: "female",
      equipment: {
        helmet: "non-lang-khach",
        armor: "ao-lang-khach"
      }
    });

    expect(preview.layers).toHaveLength(3);
    expect(preview.layers[0].url).toMatch(/^\/hero-preview-pants-lang-khach-female\.png/);
    expect(preview.layers[1].url).toMatch(/^\/hero-preview-armor-lang-khach-female\.png/);
    expect(preview.layers[2].url).toMatch(/^\/hero-preview-hat-non-mang\.png/);
  });
});
