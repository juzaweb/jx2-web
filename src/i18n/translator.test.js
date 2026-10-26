// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import en from "./locales/en.js";
import vi from "./locales/vi.js";
import zh from "./locales/zh.js";
import { detectLanguage, normalizeLanguage, setRuntimeLanguage, translateFor } from "./translator.js";
import { EQUIPMENT_ITEMS, INVENTORY_ITEMS, QUICK_ITEMS } from "../game/items.js";

const flattenKeys = (dictionary, prefix = "") =>
  Object.entries(dictionary).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flattenKeys(value, path) : [path];
  });

describe("detectLanguage & persistence", () => {
  it("defaults to 'vi' when localStorage is empty", () => {
    window.localStorage.removeItem("jx2_language");
    expect(detectLanguage()).toBe("vi");
  });

  it("returns stored language when set in localStorage", () => {
    window.localStorage.setItem("jx2_language", "en");
    expect(detectLanguage()).toBe("en");
    window.localStorage.removeItem("jx2_language");
  });

  it("persists language using setRuntimeLanguage", () => {
    setRuntimeLanguage("zh");
    expect(window.localStorage.getItem("jx2_language")).toBe("zh");
    expect(detectLanguage()).toBe("zh");
    window.localStorage.removeItem("jx2_language");
  });
});

describe("normalizeLanguage", () => {
  it("accepts supported codes and regional variants", () => {
    expect(normalizeLanguage("vi")).toBe("vi");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("zh-CN")).toBe("zh");
    expect(normalizeLanguage("ZH")).toBe("zh");
  });

  it("rejects unsupported or missing values", () => {
    expect(normalizeLanguage("fr")).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });
});

describe("translateFor", () => {
  it("translates per language", () => {
    expect(translateFor("en", "common.back")).toBe("Back");
    expect(translateFor("zh", "common.back")).toBe("返回");
    expect(translateFor("vi", "common.back")).toBe("Trở lại");
  });

  it("interpolates named parameters", () => {
    expect(
      translateFor("en", "hotbar.slotTitle", { key: 1, name: "Golden Radiance Elixir" })
    ).toBe("Key [1]: Golden Radiance Elixir");
  });

  it("falls back to Vietnamese, then the supplied fallback, then the key", () => {
    expect(translateFor("en", "does.not.exist", undefined, "fallback")).toBe("fallback");
    expect(translateFor("en", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("locale catalogs", () => {
  const viKeys = flattenKeys(vi).sort();

  it("keeps every language key-for-key aligned with Vietnamese", () => {
    expect(flattenKeys(en).sort()).toEqual(viKeys);
    expect(flattenKeys(zh).sort()).toEqual(viKeys);
  });

  it("defines a name and description for every item in the catalog", () => {
    const itemIds = [...QUICK_ITEMS, ...INVENTORY_ITEMS, ...EQUIPMENT_ITEMS]
      .filter(Boolean)
      .map((item) => item.id);

    itemIds.forEach((id) => {
      [vi, en, zh].forEach((dictionary) => {
        expect(dictionary.item[id]?.name, `${id} name`).toBeTruthy();
        expect(dictionary.item[id]?.desc, `${id} description`).toBeTruthy();
      });
    });
  });
});
