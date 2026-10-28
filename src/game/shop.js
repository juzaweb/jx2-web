/**
 * Herb-shop stock shared by the Phaser scene, the React shop modal and the
 * server. Prices are raw ledger amounts, i.e. đồng (the same base unit kill
 * payouts use), and are authoritative on the server: the client only uses them
 * to render the stock and disable buttons it clearly cannot afford. Every
 * purchase round-trips through the server.
 */

/** Maximum units of one item a single purchase may buy. */
export const MAX_SHOP_QTY = 99;

/**
 * Fixed stock of the Dược Điểm shop.
 * @type {Array<{id:string, price:number}>}
 */
export const PHARMACY_STOCK = [
  { id: "kim-sang-duoc", price: 8 },
  { id: "dai-hoan-dan", price: 8 },
  { id: "nu-nhi-hong", price: 20 }
];

/**
 * Look up a stocked item. Unknown ids return null so a forged shop_buy packet
 * cannot sell arbitrary catalog entries.
 * @param {string} id
 * @returns {{id:string, price:number}|null}
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
 * Total silver cost of buying `qty` units of `id`, or null when the item is not
 * stocked.
 * @param {string} id
 * @param {number} [qty=1]
 * @returns {{item:{id:string, price:number}, qty:number, total:number}|null}
 */
export function shopPurchase(id, qty = 1) {
  const item = getShopItem(id);
  if (!item) return null;
  const amount = normalizeShopQty(qty);
  return { item, qty: amount, total: item.price * amount };
}
