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
  it("exposes five unique slots", () => {
    expect(EQUIPMENT_SLOT_KEYS).toHaveLength(5);
    expect(new Set(EQUIPMENT_SLOT_KEYS).size).toBe(5);
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
  it("keeps a valid id in its own slot", () => {
    const clean = sanitizeEquipment({ weapon: "hac-ung-kiem" });
    expect(clean.weapon).toBe("hac-ung-kiem");
    expect(clean.armor).toBeNull();
  });

  it("drops an id placed in the wrong slot", () => {
    const clean = sanitizeEquipment({ armor: "hac-ung-kiem" });
    expect(clean.armor).toBeNull();
  });

  it("drops unknown slots, non-strings and non-object input", () => {
    expect(sanitizeEquipment({ boots: 123 })).toEqual(defaultEquipment());
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
  it("reports the slot of equipment", () => {
    expect(slotForItem(getItemById("cam-y-bao"))).toBe("armor");
    expect(slotForItem(getItemById("kim-sang-duoc"))).toBeNull();
    expect(slotForItem(null)).toBeNull();
  });

  it("accepts equipping an equipment item", () => {
    const result = planEquip(defaultEquipment(), "hac-ung-kiem");
    expect(result).toEqual({ ok: true, slot: "weapon", error: null });
  });

  it("rejects non-equipment items", () => {
    const result = planEquip(defaultEquipment(), "kim-sang-duoc");
    expect(result.ok).toBe(false);
    expect(result.slot).toBeNull();
  });

  it("rejects re-equipping the item already worn in the slot", () => {
    const equipment = { ...defaultEquipment(), weapon: "hac-ung-kiem" };
    const result = planEquip(equipment, "hac-ung-kiem");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("equippedIn", () => {
  it("reads the worn id and guards unknown slots", () => {
    const equipment = { ...defaultEquipment(), armor: "cam-y-bao" };
    expect(equippedIn(equipment, "armor")).toBe("cam-y-bao");
    expect(equippedIn(equipment, "nope")).toBeNull();
    expect(equippedIn(null, "armor")).toBeNull();
  });
});

describe("deriveEquipmentBonuses", () => {
  it("sums bonuses across worn slots", () => {
    const equipment = {
      ...defaultEquipment(),
      weapon: "hac-ung-kiem", // attack 10, critRate 0.02
      armor: "cam-y-bao" // defense 8, maxHp 40
    };
    const bonuses = deriveEquipmentBonuses(equipment);
    expect(bonuses.attack).toBe(10);
    expect(bonuses.defense).toBe(8);
    expect(bonuses.maxHp).toBe(40);
    expect(bonuses.critRate).toBeCloseTo(0.02);
  });

  it("returns an empty map when nothing is worn", () => {
    expect(deriveEquipmentBonuses(defaultEquipment())).toEqual({});
  });
});

describe("bonusRows", () => {
  it("formats bonuses into labelled rows", () => {
    const rows = bonusRows(getItemById("hac-ung-kiem"));
    expect(rows.find((row) => row.stat === "attack")).toMatchObject({
      label: "Ngoại công",
      amount: 10
    });
  });

  it("returns no rows for a non-equipment item", () => {
    expect(bonusRows(getItemById("kim-sang-duoc"))).toEqual([]);
    expect(bonusRows(null)).toEqual([]);
  });
});
