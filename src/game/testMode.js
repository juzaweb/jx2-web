/**
 * Test-mode switch shared by the browser client (Vite) and the Node server.
 *
 * Test mode removes the two cost gates on skill casting so designers can try a
 * kit freely: a cast never spends MP and never starts a cooldown. Both sides
 * must agree because the server owns the MP pool and the cooldown ledger — a
 * client-only switch would still have its casts refused server-side.
 *
 * Enable it with `VITE_TEST_MODE=true` in the root `.env` (the dev launcher
 * loads that file and hands it to both children). The server also accepts a
 * plain `TEST_MODE=true`.
 *
 * @returns {boolean} whether test mode is on
 */

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/**
 * Normalise a raw env value to a boolean.
 * @param {unknown} value
 * @returns {boolean}
 */
const isTruthy = (value) => TRUE_VALUES.has(String(value).trim().toLowerCase());

export function isTestMode() {
  const viteValue =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_TEST_MODE
      : undefined;
  if (viteValue !== undefined) return isTruthy(viteValue);

  if (typeof process !== "undefined" && process.env) {
    const nodeValue = process.env.TEST_MODE ?? process.env.VITE_TEST_MODE;
    if (nodeValue !== undefined) return isTruthy(nodeValue);
  }

  return false;
}
