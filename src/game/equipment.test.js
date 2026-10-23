import { describe, it, expect } from "vitest";
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_KEYS,
  defaultEquipment,
  sanitizeEquipment,
  slotForItem,
  planEquip,
  equippedIn,
  deriveEquipmentBonuses,
  bonusRows
} from "./equipment.js";
import { getItemById } from "./items.js";

describe("equipment model", () => {
  it("exposes four unique slots", () => {
    expect(EQUIPMENT_SLOT_KEYS).toHaveLength(4);
    expect(new Set(EQUIPMENT_SLOT_KEYS).size).toBe(4);
    EQUIPMENT_SLOTS.forEach((slot) => {
      expect(typeof slot.label).toBe("string");
      expect(slot.label.length).toBeGreaterThan(0);
    });
  });

  it("starts every slot empty", () => {
    const equipment = defaultEquipment();
    EQUIPMENT_SLOT_KEYS.forEach((key) => expect(equipment[key]).toBeNull());
  });
});

describe("sanitizeEquipment", () => {
  it("drops every id, because the catalog defines no equipment right now", () => {
    const clean = sanitizeEquipment({ weapon: "hac-ung-kiem", armor: "cam-y-bao" });
    expect(clean).toEqual(defaultEquipment());
  });

  it("drops unknown slots, non-strings and non-object input", () => {
    expect(sanitizeEquipment({ helmet: 123 })).toEqual(defaultEquipment());
    expect(sanitizeEquipment({ nope: "hac-ung-kiem" })).toEqual(defaultEquipment());
    expect(sanitizeEquipment(null)).toEqual(defaultEquipment());
    expect(sanitizeEquipment([])).toEqual(defaultEquipment());
  });

  it("drops a non-equipment item id", () => {
    const clean = sanitizeEquipment({ weapon: "kim-sang-duoc" });
    expect(clean.weapon).toBeNull();
  });
});

describe("slotForItem / planEquip", () => {
  it("reports no slot for consumables or missing items", () => {
    expect(slotForItem(getItemById("kim-sang-duoc"))).toBeNull();
    expect(slotForItem(null)).toBeNull();
  });

  it("refuses anything the catalog does not define as equipment", () => {
    const result = planEquip(defaultEquipment(), "kim-sang-duoc");
    expect(result.ok).toBe(false);
    expect(result.slot).toBeNull();
  });
});

describe("equippedIn", () => {
  it("reads the worn id and guards unknown slots", () => {
    const equipment = { ...defaultEquipment(), armor: "some-id" };
    expect(equippedIn(equipment, "armor")).toBe("some-id");
    expect(equippedIn(equipment, "nope")).toBeNull();
    expect(equippedIn(null, "armor")).toBeNull();
  });
});

describe("deriveEquipmentBonuses", () => {
  it("returns an empty map when nothing is worn", () => {
    expect(deriveEquipmentBonuses(defaultEquipment())).toEqual({});
  });

  it("ignores worn ids the catalog does not define as equipment", () => {
    const equipment = { ...defaultEquipment(), armor: "kim-sang-duoc" };
    expect(deriveEquipmentBonuses(equipment)).toEqual({});
  });
});

describe("bonusRows", () => {
  it("returns no rows for a non-equipment item", () => {
    expect(bonusRows(getItemById("kim-sang-duoc"))).toEqual([]);
    expect(bonusRows(null)).toEqual([]);
  });
});
