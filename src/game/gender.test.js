import { describe, expect, it } from "vitest";
import { GENDERS, DEFAULT_GENDER, normalizeGender } from "./gender.js";

describe("normalizeGender", () => {
  it("keeps known genders", () => {
    expect(normalizeGender("male")).toBe("male");
    expect(normalizeGender("female")).toBe("female");
  });

  it("falls back to the default for unknown or missing values", () => {
    expect(normalizeGender("other")).toBe(DEFAULT_GENDER);
    expect(normalizeGender(undefined)).toBe(DEFAULT_GENDER);
    expect(normalizeGender(null)).toBe(DEFAULT_GENDER);
    expect(normalizeGender(0)).toBe(DEFAULT_GENDER);
  });

  it("exposes the default as a known gender", () => {
    expect(GENDERS).toContain(DEFAULT_GENDER);
  });
});
