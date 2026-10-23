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
      maxMp: 60
    });

    expect(findRow(sheet.vitals, "hp").value).toBe("200/200");
    expect(findRow(sheet.vitals, "mp").value).toBe("0/60");
  });

  it("defaults vitals when the stats object is empty", () => {
    const sheet = deriveCharacterSheet();
    expect(sheet.level).toBe(1);
    expect(findRow(sheet.vitals, "hp").value).toBe("100/100");
    expect(findRow(sheet.vitals, "mp").value).toBe("60/60");
  });

  it("shows the base combat values the game actually rolls", () => {
    const sheet = deriveCharacterSheet({ level: 1 });
    expect(findRow(sheet.combat, "physicalAtk").value).toBe("24");
    expect(findRow(sheet.combat, "physicalDef").value).toBe("6");
    expect(findRow(sheet.combat, "crit").value).toBe("12%");
    expect(findRow(sheet.combat, "critDamage").value).toBe("×1.5");
    expect(findRow(sheet.combat, "attackSpeed").value).toBe("×1");
  });

  it("does not scale combat values with level", () => {
    const level1 = deriveCharacterSheet({ level: 1 });
    const level30 = deriveCharacterSheet({ level: 30 });
    expect(level30.combat).toEqual(level1.combat);
  });

  it("reads attack, defence and crit from the live stats snapshot", () => {
    const sheet = deriveCharacterSheet({ attack: 34, defense: 11, critRate: 0.2, critDamage: 2 });
    expect(findRow(sheet.combat, "physicalAtk").value).toBe("34");
    expect(findRow(sheet.combat, "physicalDef").value).toBe("11");
    expect(findRow(sheet.combat, "crit").value).toBe("20%");
    expect(findRow(sheet.combat, "critDamage").value).toBe("×2");
  });

  it("shows attack speed as a coefficient", () => {
    expect(findRow(deriveCharacterSheet({ attackSpeed: 1.2 }).combat, "attackSpeed").value).toBe("×1.2");
    expect(findRow(deriveCharacterSheet({ attackSpeed: 1.5 }).combat, "attackSpeed").value).toBe("×1.5");
  });

  it("lists only the stats that have a backing model", () => {
    const keys = deriveCharacterSheet({ level: 5 }).combat.map((row) => row.key);
    expect(keys).toEqual(["physicalAtk", "physicalDef", "crit", "critDamage", "attackSpeed"]);
  });

  it("carries next-level exp into the footer", () => {
    const sheet = deriveCharacterSheet({ level: 4, nextExp: 760 });
    expect(sheet.footer.nextLevelExp).toBe(760);
    expect(sheet.footer.points).toBe(0);
  });
});
