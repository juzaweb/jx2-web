import { describe, expect, it } from "vitest";
import {
  BAC_PER_VANG,
  DONG_PER_BAC,
  DONG_PER_VANG,
  splitCurrency,
  toLedgerDong
} from "./currency.js";

describe("currency", () => {
  it("pins the 100 đồng = 1 bạc / 100 bạc = 1 vàng ratio", () => {
    expect(DONG_PER_BAC).toBe(100);
    expect(BAC_PER_VANG).toBe(100);
    expect(DONG_PER_VANG).toBe(10000);
  });

  it("converts a bạc price into the đồng amount the ledger holds", () => {
    // A shop price of 8 bạc must debit 800 from a đồng ledger.
    expect(toLedgerDong(8)).toBe(800);
    expect(toLedgerDong(20)).toBe(2000);
    expect(toLedgerDong(2000)).toBe(200000);
    expect(toLedgerDong(0)).toBe(0);
  });

  it("refuses to mint a credit from malformed prices", () => {
    expect(toLedgerDong(-5)).toBe(0);
    expect(toLedgerDong(Number.NaN)).toBe(0);
    expect(toLedgerDong(undefined)).toBe(0);
    expect(toLedgerDong("8")).toBe(800);
  });

  it("splits a đồng balance into vàng, bạc and đồng", () => {
    expect(splitCurrency(0)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(splitCurrency(250)).toEqual({ gold: 0, silver: 2, copper: 50 });
    expect(splitCurrency(12345)).toEqual({ gold: 1, silver: 23, copper: 45 });
    expect(splitCurrency(100)).toEqual({ gold: 0, silver: 1, copper: 0 });
    expect(splitCurrency(10000)).toEqual({ gold: 1, silver: 0, copper: 0 });
    expect(splitCurrency(-5)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(splitCurrency(Number.NaN)).toEqual({ gold: 0, silver: 0, copper: 0 });
  });
});
