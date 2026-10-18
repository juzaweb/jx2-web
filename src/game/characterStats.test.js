import { describe, it, expect } from "vitest";
import { deriveCharacterSheet, normalizeLevel } from "./characterStats.js";

const findRow = (rows, key) => rows.find((row) => row.key === key);

describe("normalizeLevel", () => {
  it("keeps a valid integer level", () => {
    expect(normalizeLevel(4)).toBe(4);
  });

  it("falls back to 1 for missing or invalid input", () => {
    expect(normalizeLevel(undefined)).toBe(1);
    expect(normalizeLevel(null)).toBe(1);
    expect(normalizeLevel("abc")).toBe(1);
    expect(normalizeLevel(NaN)).toBe(1);
  });

  it("rounds and clamps into range", () => {
    expect(normalizeLevel(3.7)).toBe(4);
    expect(normalizeLevel(0)).toBe(1);
    expect(normalizeLevel(-5)).toBe(1);
    expect(normalizeLevel(100000)).toBe(999);
  });
});

describe("deriveCharacterSheet", () => {
  it("exposes live vitals clamped to their maxima", () => {
    const sheet = deriveCharacterSheet({
      level: 4,
      hp: 999,
      maxHp: 200,
      mp: -3,
      maxMp: 60,
      sta: 50,
      maxSta: 100
    });

    expect(findRow(sheet.vitals, "hp").value).toBe("200/200");
    expect(findRow(sheet.vitals, "mp").value).toBe("0/60");
    expect(findRow(sheet.vitals, "sta").value).toBe("50/100");
  });

  it("defaults vitals when the stats object is empty", () => {
    const sheet = deriveCharacterSheet();
    expect(sheet.level).toBe(1);
    expect(findRow(sheet.vitals, "hp").value).toBe("100/100");
    expect(findRow(sheet.vitals, "mp").value).toBe("60/60");
    expect(findRow(sheet.vitals, "sta").value).toBe("100/100");
  });

  it("grows attributes and combat values with level", () => {
    const level1 = deriveCharacterSheet({ level: 1 });
    const level10 = deriveCharacterSheet({ level: 10 });

    expect(findRow(level1.attributes, "strength").bonus).toBe(0);
    expect(findRow(level10.attributes, "strength").bonus).toBe(9);
    expect(findRow(level10.attributes, "internal").bonus).toBe(18);

    const atk1 = findRow(level1.combat, "physicalAtk").value;
    const atk10 = findRow(level10.combat, "physicalAtk").value;
    expect(atk1).toBe("240-280");
    expect(atk10).toBe("276-388");
  });

  it("formats defence and movement as compound readouts", () => {
    const sheet = deriveCharacterSheet({ level: 1 });
    expect(findRow(sheet.combat, "physicalDef").value).toBe("0%+8");
    expect(findRow(sheet.combat, "magicDef").value).toBe("0%+20");
    expect(findRow(sheet.combat, "moveSpeed").value).toBe("5/14");
  });

  it("carries next-level exp and a level-scaled potential into the footer", () => {
    const sheet = deriveCharacterSheet({ level: 4, nextExp: 760 });
    expect(sheet.footer.nextLevelExp).toBe(760);
    expect(sheet.footer.potential).toBe(12);
    expect(sheet.footer.points).toBe(0);
  });
});
