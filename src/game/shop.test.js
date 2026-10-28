import { describe, expect, it } from "vitest";
import {
  MAX_SHOP_QTY,
  PHARMACY_STOCK,
  getShopItem,
  normalizeShopQty,
  shopPurchase
} from "./shop.js";

describe("pharmacy shop", () => {
  it("stocks the HP and MP potions", () => {
    expect(getShopItem("kim-sang-duoc")).toEqual({ id: "kim-sang-duoc", priceBac: 8 });
    expect(getShopItem("dai-hoan-dan")).toEqual({ id: "dai-hoan-dan", priceBac: 8 });
  });

  it("rejects unknown or malformed ids", () => {
    expect(getShopItem("thiet-trao")).toBeNull();
    expect(getShopItem("")).toBeNull();
    expect(getShopItem(null)).toBeNull();
  });

  it("clamps quantities into the protocol range", () => {
    expect(normalizeShopQty(0)).toBe(1);
    expect(normalizeShopQty(-4)).toBe(1);
    expect(normalizeShopQty("3")).toBe(3);
    expect(normalizeShopQty(2.9)).toBe(2);
    expect(normalizeShopQty(1e9)).toBe(MAX_SHOP_QTY);
    expect(normalizeShopQty("nope")).toBe(1);
  });

  it("computes the quoted bạc total and the đồng ledger charge", () => {
    const purchase = shopPurchase("nu-nhi-hong", 2.9);
    expect(purchase).toEqual({
      item: PHARMACY_STOCK[2],
      qty: 2,
      totalBac: 40,
      chargeDong: 4000
    });
    expect(shopPurchase("not-stocked")).toBeNull();
  });

  it("always charges 100 đồng per quoted bạc", () => {
    // Guards the 1 bạc = 100 đồng ratio at the one place money leaves the player.
    for (const entry of PHARMACY_STOCK) {
      const purchase = shopPurchase(entry.id, 3);
      expect(purchase.chargeDong).toBe(purchase.totalBac * 100);
    }
  });
});
