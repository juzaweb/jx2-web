import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import {
  bakedEquipmentSlots,
  bodyFrameForDirection,
  bodyRowForDirection,
  bodyTextureFor,
  equipmentTextureDef,
  equipmentTextureKeyFor,
  HERO_BODY,
  HERO_BODY_TEXTURES,
  HERO_EQUIPMENT_TEXTURES,
  WEAPON_ATTACK_TEXTURES,
  WEAPON_BODY_TEXTURES,
  weaponAttackTextureDef,
  weaponBodyTextureDef
} from "./heroBody.js";

/** Size of a shipped PNG, read from its IHDR chunk (no image library needed). */
function pngSize(url) {
  const path = fileURLToPath(
    new URL(`../../public/${url.split("?")[0]}`, import.meta.url)
  );
  const header = readFileSync(path);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

describe("heroBody", () => {
  it("picks the sheet for each gender and falls back to male", () => {
    expect(bodyTextureFor("male")).toBe("hero-body-male");
    expect(bodyTextureFor("female")).toBe("hero-body-female");
    expect(bodyTextureFor("unknown")).toBe("hero-body-male");
  });

  it("maps the eight directions onto the four sheet rows", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(bodyRowForDirection)).toEqual([
      0, 2, 2, 2, 3, 1, 1, 1
    ]);
  });

  it("wraps out-of-range directions and ignores non-finite input", () => {
    expect(bodyRowForDirection(-2)).toBe(1); // -2 wraps to direction 6 (left)
    expect(bodyRowForDirection(9)).toBe(2); // 9 wraps to direction 1 (down-right)
    expect(bodyRowForDirection(Number.NaN)).toBe(0);
    expect(bodyFrameForDirection(0, Number.NaN)).toBe(0);
  });

  it("advances one walk column per quarter turn", () => {
    expect(bodyFrameForDirection()).toBe(0);
    expect(bodyFrameForDirection(0, 0)).toBe(0);
    expect(bodyFrameForDirection(0, Math.PI / 2)).toBe(1);
    expect(bodyFrameForDirection(0, Math.PI)).toBe(2);
    expect(bodyFrameForDirection(0, (Math.PI * 3) / 2)).toBe(3);
    expect(bodyFrameForDirection(0, Math.PI * 2)).toBe(0);
  });

  it("offsets frames by the direction's row", () => {
    expect(bodyFrameForDirection(4, 0)).toBe(12);
    expect(bodyFrameForDirection(6, Math.PI / 2)).toBe(5);
    expect(bodyFrameForDirection(2, Math.PI)).toBe(10);
  });

  describe("HERO_EQUIPMENT_TEXTURES & helpers", () => {
    it("resolves gender-specific texture keys and defs for items", () => {
      expect(equipmentTextureKeyFor("armor", "ao-lang-khach", "male")).toBe("hero-armor-lang-khach-male");
      expect(equipmentTextureKeyFor("armor", "ao-lang-khach", "female")).toBe("hero-armor-lang-khach-female");
      expect(equipmentTextureDef("armor", "ao-lang-khach", "male").url).toContain("hero-armor-lang-khach-male.png");
    });

    it("resolves headgear texture keys for plain conical hat and veiled hat", () => {
      expect(equipmentTextureKeyFor("helmet", "non-truc", "male")).toBe("hero-hat-non-truc");
      expect(equipmentTextureKeyFor("helmet", "non-mang", "female")).toBe("hero-hat-non-mang");
      expect(equipmentTextureKeyFor("helmet", "non-lang-khach", "male")).toBe("hero-hat-non-truc");
      expect(equipmentTextureKeyFor("helmet", "non-lang-khach", "female")).toBe("hero-hat-non-mang");
    });

    it("shares male pants texture for female characters", () => {
      expect(equipmentTextureKeyFor("pants", "quan-lang-khach", "male")).toBe("hero-pants-lang-khach-male");
      expect(equipmentTextureKeyFor("pants", "quan-lang-khach", "female")).toBe("hero-pants-lang-khach-male");
      expect(equipmentTextureDef("pants", "quan-lang-khach", "female").url).toContain("hero-pants-lang-khach-male.png");
    });

    it("returns null for unregistered items, empty strings or invalid slots", () => {
      expect(equipmentTextureDef("armor", "unknown-item", "male")).toBeNull();
      expect(equipmentTextureKeyFor("armor", null)).toBeNull();
      expect(equipmentTextureKeyFor("armor", "")).toBeNull();
    });
  });

  describe("weapon body sheets", () => {
    it("swaps each gender's sheet for its sword art when a sword is worn", () => {
      expect(bodyTextureFor("male", "kiem")).toBe("hero-body-male-sword");
      expect(weaponBodyTextureDef("male", "kiem").url).toContain("hero-body-male-sword.png");
      expect(bodyTextureFor("female", "kiem")).toBe("hero-body-female-sword");
      expect(weaponBodyTextureDef("female", "kiem").url).toContain("hero-body-female-sword.png");
    });

    it("keeps the plain sheet for weapons without weapon art", () => {
      expect(bodyTextureFor("female", "dao")).toBe("hero-body-female");
      expect(bodyTextureFor("male", "dao")).toBe("hero-body-male");
      expect(bodyTextureFor("male", "bao-tay")).toBe("hero-body-male");
      expect(bodyTextureFor("male", null)).toBe("hero-body-male");
      expect(weaponBodyTextureDef("male", "dao")).toBeNull();
      expect(weaponBodyTextureDef("female", "dao")).toBeNull();
      expect(weaponBodyTextureDef("male", null)).toBeNull();
    });

    it("adds the weapon slot to the baked slots only for the sword sheet", () => {
      expect(bakedEquipmentSlots("male", "kiem")).toEqual(["pants", "armor", "helmet", "weapon"]);
      expect(bakedEquipmentSlots("female", "kiem")).toEqual(["pants", "armor", "helmet", "weapon"]);
      expect(bakedEquipmentSlots("male", "bao-tay")).toEqual(["pants", "armor", "helmet"]);
    });

    it("resolves the swing sheet that belongs to the sword art", () => {
      for (const gender of ["male", "female"]) {
        const def = weaponAttackTextureDef(gender, "kiem");
        expect(def.key).toBe(`hero-body-${gender}-sword-attack`);
        expect(def.url).toContain(`hero-body-${gender}-sword-attack.png`);
        // Wider frames: the slash arc reaches past the body.
        expect(def.frameWidth).toBeGreaterThan(HERO_BODY.frameWidth);
        expect(def.frameHeight).toBe(HERO_BODY.frameHeight);
        expect(def.frames).toBe(HERO_BODY.columns);
      }
    });

    it("has no swing sheet for weapons without sword art", () => {
      expect(weaponAttackTextureDef("male", "dao")).toBeNull();
      expect(weaponAttackTextureDef("male", null)).toBeNull();
    });

    it("resolves the bare-hand strike sheet for both genders", () => {
      for (const gender of ["male", "female"]) {
        const def = weaponAttackTextureDef(gender, "bao-tay");
        expect(def.key).toBe(`hero-body-${gender}-fist-attack`);
        expect(def.url).toContain(`hero-body-${gender}-fist-attack.png`);
        // The art paints no weapon, so frames keep the plain sheet's height.
        expect(def.frameHeight).toBe(HERO_BODY.frameHeight);
        expect(def.frames).toBe(HERO_BODY.columns);
        // A punch/palm sequence covers the normal attack and a palm cast only.
        expect(def.kinds).toEqual(["basic", "shockwave"]);
      }
      // Her palm reaches a little further, so her frames are slightly wider.
      expect(weaponAttackTextureDef("male", "bao-tay").frameWidth).toBe(128);
      expect(weaponAttackTextureDef("female", "bao-tay").frameWidth).toBe(130);
    });

    it("keeps the plain walk sheet for bare hands", () => {
      // Only the strike frames come from the fist art, so the walk pose and the
      // vector glove stay exactly as they are for every other unarmed look.
      expect(bodyTextureFor("male", "bao-tay")).toBe("hero-body-male");
      expect(bodyTextureFor("female", "bao-tay")).toBe("hero-body-female");
      expect(weaponBodyTextureDef("male", "bao-tay")).toBeNull();
      expect(weaponBodyTextureDef("female", "bao-tay")).toBeNull();
      expect(bakedEquipmentSlots("male", "bao-tay")).toEqual(["pants", "armor", "helmet"]);
    });

    it("gives every strike sheet the motions it covers", () => {
      const sheets = [
        ...Object.values(WEAPON_BODY_TEXTURES).flatMap((byGender) =>
          Object.values(byGender).map((def) => def.attack)
        ),
        ...Object.values(WEAPON_ATTACK_TEXTURES).flatMap((byGender) =>
          Object.values(byGender)
        )
      ].filter(Boolean);

      expect(sheets.length).toBeGreaterThan(0);
      for (const def of sheets) {
        // Every melee look covers the normal attack; a missing list would make
        // the rig silently fall back to its vector pose.
        expect(def.kinds, def.key).toContain("basic");
      }
    });

    it("declares frame geometry that matches the shipped PNGs", () => {
      const expected = (def) => ({
        width: HERO_BODY.columns * def.frameWidth,
        height: HERO_BODY.rows * def.frameHeight
      });

      for (const [gender, def] of Object.entries(WEAPON_BODY_TEXTURES.kiem)) {
        expect(pngSize(def.url), `${gender} walk sheet`).toEqual(expected(def));
        expect(pngSize(def.attack.url), `${gender} swing sheet`).toEqual(
          expected(def.attack)
        );
      }
      for (const [weapon, byGender] of Object.entries(WEAPON_ATTACK_TEXTURES)) {
        for (const [gender, def] of Object.entries(byGender)) {
          expect(pngSize(def.url), `${gender} ${weapon} strike sheet`).toEqual(
            expected(def)
          );
        }
      }
      for (const [gender, def] of Object.entries(HERO_BODY_TEXTURES)) {
        expect(pngSize(def.url), `${gender} plain sheet`).toEqual(
          expected(HERO_BODY)
        );
      }
    });
  });

  describe("bakedEquipmentSlots", () => {
    it("lists the clothing slots painted into the male sheet", () => {
      expect(bakedEquipmentSlots("male")).toEqual(["pants", "armor", "helmet"]);
    });

    it("lists the clothing slots painted into the female sheet", () => {
      expect(bakedEquipmentSlots("female")).toEqual(["pants", "armor", "helmet"]);
    });

    it("falls back to male for unknown genders", () => {
      expect(bakedEquipmentSlots()).toEqual(bakedEquipmentSlots("male"));
      expect(bakedEquipmentSlots("unknown")).toEqual(bakedEquipmentSlots("male"));
    });
  });
});
