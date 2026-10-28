/**
 * Money units used by the whole game.
 *
 * The server ledger (`progress.coins`) is a single integer counted in `đồng`,
 * the smallest coin — that is also what a kill pays out. Prices shown to the
 * player (shop stock, skill ranks) are quoted in `bạc`, so every quoted price
 * must be converted with {@link toLedgerDong} before it is compared against, or
 * debited from, the ledger.
 *
 *   1 bạc  =   100 đồng
 *   1 vàng = 100 bạc = 10.000 đồng
 */

/** Đồng in one bạc. */
export const DONG_PER_BAC = 100;

/** Bạc in one vàng. */
export const BAC_PER_VANG = 100;

/** Đồng in one vàng. */
export const DONG_PER_VANG = DONG_PER_BAC * BAC_PER_VANG;

/**
 * Convert a price quoted in bạc into the đồng amount the ledger actually holds.
 * Non-numeric or negative input yields 0 so a malformed price can never mint a
 * ledger credit.
 * @param {number} amountBac price quoted to the player, in bạc
 * @returns {number} the same price in đồng
 */
export function toLedgerDong(amountBac) {
  const bac = Number(amountBac);
  if (!Number.isFinite(bac) || bac <= 0) return 0;
  return Math.floor(bac) * DONG_PER_BAC;
}

/**
 * Split a ledger balance into the three display denominations.
 * `copper` carries the đồng remainder, which is the ledger base unit.
 * @param {number} amountDong balance in đồng
 * @returns {{ gold: number, silver: number, copper: number }}
 */
export function splitCurrency(amountDong) {
  const total =
    typeof amountDong === "number" && Number.isFinite(amountDong)
      ? Math.max(0, Math.floor(amountDong))
      : 0;
  return {
    gold: Math.floor(total / DONG_PER_VANG),
    silver: Math.floor(total / DONG_PER_BAC) % BAC_PER_VANG,
    copper: total % DONG_PER_BAC
  };
}
