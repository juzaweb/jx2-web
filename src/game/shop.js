/**
 * Herb-shop stock shared by the Phaser scene, the React shop modal and the
 * server. Prices are quoted in bạc (the coin the player recognises), while the
 * ledger is counted in đồng, so `shopPurchase` returns both the quoted total and
 * the đồng amount to debit. Prices are authoritative on the server: the client
 * only uses them to render the stock and disable buttons it cannot afford.
 * Every purchase round-trips through the server.
 */
import { toLedgerDong } from "./currency.js";

/** Maximum units of one item a single purchase may buy. */
export const MAX_SHOP_QTY = 99;

/**
 * Fixed stock of the Dược Điểm shop.
 * @type {Array<{id:string, priceBac:number}>}
 */
export const PHARMACY_STOCK = [
  { id: "kim-sang-duoc", priceBac: 8 },
  { id: "dai-hoan-dan", priceBac: 8 },
  { id: "nu-nhi-hong", priceBac: 20 }
];

/**
 * Look up a stocked item. Unknown ids return null so a forged shop_buy packet
 * cannot sell arbitrary catalog entries.
 * @param {string} id
 * @returns {{id:string, priceBac:number}|null}
 */
export function getShopItem(id) {
  if (typeof id !== "string" || id.length === 0) return null;
  return PHARMACY_STOCK.find((entry) => entry.id === id) || null;
}

/**
 * Normalise a purchase quantity. Anything malformed falls back to one unit and
 * the result is clamped to the protocol limit.
 * @param {*} qty
 * @returns {number}
 */
export function normalizeShopQty(qty) {
  const value = Math.floor(Number(qty));
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, MAX_SHOP_QTY);
}

/**
 * What buying `qty` units of `id` quotes and costs, or null when the item is not
 * stocked. `totalBac` is what the shop shows; `chargeDong` is what the server
 * debits from the đồng ledger.
 * @param {string} id
 * @param {number} [qty=1]
 * @returns {{item:{id:string, priceBac:number}, qty:number, totalBac:number,
 *   chargeDong:number}|null}
 */
export function shopPurchase(id, qty = 1) {
  const item = getShopItem(id);
  if (!item) return null;
  const amount = normalizeShopQty(qty);
  const totalBac = item.priceBac * amount;
  return { item, qty: amount, totalBac, chargeDong: toLedgerDong(totalBac) };
}
