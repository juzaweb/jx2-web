/**
 * Player-facing label for a price quoted in bạc.
 *
 * Prices are stored and compared in bạc, but once an art costs hundreds of bạc a
 * plain "20000 bạc" is unreadable, so the label promotes whole vàng and keeps the
 * leftover bạc after them. The denomination words come from the active locale
 * (`inventory.gold` / `inventory.silver`), which is why the translator is passed
 * in rather than imported: this module stays free of React and i18n singletons.
 */

import { splitBac } from "./currency.js";

/**
 * @param {number} amountBac quoted price in bạc
 * @param {(key: string, vars?: Object) => string} t active translator
 * @returns {string} e.g. "80 bạc", "2 vàng 40 bạc", "200 vàng"
 */
export function moneyLabel(amountBac, t) {
  const { gold, silver } = splitBac(amountBac);
  const parts = [];
  if (gold > 0) parts.push(`${gold} ${t("inventory.gold").toLowerCase()}`);
  // A price under one vàng (including zero) is always worth spelling out.
  if (silver > 0 || parts.length === 0) {
    parts.push(`${silver} ${t("inventory.silver").toLowerCase()}`);
  }
  return parts.join(" ");
}
