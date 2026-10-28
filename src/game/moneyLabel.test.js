import { describe, expect, it } from "vitest";
import { moneyLabel } from "./moneyLabel.js";

const WORDS = {
  "inventory.gold": "Vàng",
  "inventory.silver": "Bạc"
};
const t = (key) => WORDS[key] ?? key;

describe("moneyLabel", () => {
  it("keeps bạc while the price is under one vàng", () => {
    expect(moneyLabel(20, t)).toBe("20 bạc");
    expect(moneyLabel(80, t)).toBe("80 bạc");
    expect(moneyLabel(99, t)).toBe("99 bạc");
  });

  it("converts to vàng as soon as the price reaches one", () => {
    expect(moneyLabel(100, t)).toBe("1 vàng");
    expect(moneyLabel(5000, t)).toBe("50 vàng");
    expect(moneyLabel(20000, t)).toBe("200 vàng");
  });

  it("keeps the bạc remainder after the vàng part", () => {
    expect(moneyLabel(240, t)).toBe("2 vàng 40 bạc");
    expect(moneyLabel(4383, t)).toBe("43 vàng 83 bạc");
  });

  it("degrades to zero instead of producing broken text", () => {
    expect(moneyLabel(0, t)).toBe("0 bạc");
    expect(moneyLabel(undefined, t)).toBe("0 bạc");
    expect(moneyLabel(-5, t)).toBe("0 bạc");
    expect(moneyLabel("nope", t)).toBe("0 bạc");
  });
});
