import { describe, expect, it, vi } from "vitest";
import { GROCERY_BUILDING, PHARMACY_BUILDING, SHOP_BUILDINGS, createShop } from "./marketBuildings.js";

describe("market buildings", () => {
  it("exports all sprite shop buildings in SHOP_BUILDINGS", () => {
    expect(SHOP_BUILDINGS).toEqual([PHARMACY_BUILDING, GROCERY_BUILDING]);
  });

  it("defines the pharmacy building asset metadata", () => {
    expect(PHARMACY_BUILDING.textureKey).toBe("building-duoc-diem");
    expect(PHARMACY_BUILDING.url).toBe("/duoc-diem.png");
    expect(PHARMACY_BUILDING.width).toBe(714);
    expect(PHARMACY_BUILDING.height).toBe(422);
    expect(PHARMACY_BUILDING.scale).toBeGreaterThan(0);
  });

  it("defines the grocery building asset metadata", () => {
    expect(GROCERY_BUILDING.textureKey).toBe("building-tap-hoa");
    expect(GROCERY_BUILDING.url).toBe("/tap-hoa.png");
    expect(GROCERY_BUILDING.width).toBe(727);
    expect(GROCERY_BUILDING.height).toBe(432);
    expect(GROCERY_BUILDING.scale).toBeGreaterThan(0);
  });

  it("creates a sprite-based container when pharmacy texture is available", () => {
    const children = [];
    const container = {
      add: vi.fn((child) => children.push(child)),
      setScale: vi.fn().mockReturnThis()
    };
    const mockImage = { setOrigin: vi.fn().mockReturnThis() };
    const mockGraphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillEllipse: vi.fn().mockReturnThis()
    };
    const scene = {
      textures: { exists: vi.fn((key) => key === PHARMACY_BUILDING.textureKey) },
      add: {
        container: vi.fn(() => container),
        graphics: vi.fn(() => mockGraphics),
        image: vi.fn(() => mockImage)
      }
    };

    const def = { palette: "herb", signColor: "green" };
    const result = createShop(scene, def);
    expect(result).toBe(container);
    expect(scene.add.image).toHaveBeenCalledWith(0, 0, PHARMACY_BUILDING.textureKey);
    expect(mockImage.setOrigin).toHaveBeenCalledWith(0.5, 1);
    expect(container.add).toHaveBeenCalledTimes(2);
  });

  it("creates a sprite-based container when grocery texture is available", () => {
    const children = [];
    const container = {
      add: vi.fn((child) => children.push(child)),
      setScale: vi.fn().mockReturnThis()
    };
    const mockImage = { setOrigin: vi.fn().mockReturnThis() };
    const mockGraphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillEllipse: vi.fn().mockReturnThis()
    };
    const scene = {
      textures: { exists: vi.fn((key) => key === GROCERY_BUILDING.textureKey) },
      add: {
        container: vi.fn(() => container),
        graphics: vi.fn(() => mockGraphics),
        image: vi.fn(() => mockImage)
      }
    };

    const def = { id: "tap-hoa", palette: "wood", signColor: "red" };
    const result = createShop(scene, def);
    expect(result).toBe(container);
    expect(scene.add.image).toHaveBeenCalledWith(0, 0, GROCERY_BUILDING.textureKey);
    expect(mockImage.setOrigin).toHaveBeenCalledWith(0.5, 1);
    expect(container.add).toHaveBeenCalledTimes(2);
  });

  it("falls back to procedural shop graphics when texture is missing", () => {
    const children = [];
    const container = {
      add: vi.fn((child) => children.push(child)),
      setScale: vi.fn().mockReturnThis()
    };
    const mockGraphics = new Proxy(
      {},
      {
        get: () => vi.fn().mockReturnThis()
      }
    );
    const scene = {
      textures: { exists: vi.fn(() => false) },
      add: {
        container: vi.fn(() => container),
        graphics: vi.fn(() => mockGraphics),
        text: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis() }))
      }
    };

    const def = { palette: "herb", signColor: "green", sign: "DƯỢC ĐIỂM", subSign: "藥舖" };
    const result = createShop(scene, def);
    expect(result).toBe(container);
    expect(container.add).toHaveBeenCalled();
  });
});
