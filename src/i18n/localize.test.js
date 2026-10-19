import { describe, expect, it } from "vitest";
import { localizeBonusRows, localizeItem } from "./localize.js";

const t = (key, params, fallback) => {
  if (key === "item.kim-sang-duoc.name") return "Golden Radiance Elixir";
  if (key === "item.kim-sang-duoc.desc") return "Restores +35 Health.";
  if (key === "bonus.attack") return "Physical attack";
  return fallback ?? key;
};

describe("localizeItem", () => {
  it("returns a translated copy without mutating the catalog item", () => {
    const item = {
      id: "kim-sang-duoc",
      name: "Kim Sáng Dược",
      desc: "Hồi phục +35 Sinh lực."
    };

    const localized = localizeItem(item, t);

    expect(localized).not.toBe(item);
    expect(localized.name).toBe("Golden Radiance Elixir");
    expect(localized.desc).toBe("Restores +35 Health.");
    expect(item.name).toBe("Kim Sáng Dược");
  });

  it("passes through null items", () => {
    expect(localizeItem(null, t)).toBeNull();
  });
});

describe("localizeBonusRows", () => {
  it("translates known bonus labels and preserves unknown ones", () => {
    const rows = [
      { stat: "attack", label: "Ngoại công", amount: 10 },
      { stat: "unknown", label: "Unknown", amount: 2 }
    ];

    expect(localizeBonusRows(rows, t)).toEqual([
      { stat: "attack", label: "Physical attack", amount: 10 },
      { stat: "unknown", label: "Unknown", amount: 2 }
    ]);
  });
});
