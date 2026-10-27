/**
 * Command-token bookkeeping for the serving socket and the REST bag reads.
 *
 * Two tokens open the same admin panel:
 * - the GM token ("lenh-bai-gm"), held permanently by admin accounts;
 * - the test token ("lenh-bai-test"), handed to every character while test mode
 *   is on, and taken back once it is off so a stale token never pretends to
 *   grant powers the server would refuse.
 *
 * Keeping this in one place means the join path and the inventory endpoint can
 * never disagree about who holds which token.
 */

import { GM_TOKEN_ID, TEST_TOKEN_ID } from "../../../src/game/items.js";
import { isTestMode } from "../../../src/game/testMode.js";
import { consumeItem, grantItem, readBag } from "./playerBag.js";

/**
 * Bring a character's bag in line with the current mode.
 * Writes only when a token actually has to be added or removed.
 * @param {string} characterId
 * @param {{ isAdmin?: boolean }} [options]
 * @returns {Record<string, number>} the resulting bag
 */
export function syncCommandTokens(characterId, { isAdmin = false } = {}) {
  let bag = readBag(characterId);

  if (isAdmin && !bag[GM_TOKEN_ID]) {
    bag = grantItem(characterId, GM_TOKEN_ID, 1).bag;
  }

  if (isTestMode()) {
    if (!bag[TEST_TOKEN_ID]) {
      bag = grantItem(characterId, TEST_TOKEN_ID, 1).bag;
    }
  } else if (bag[TEST_TOKEN_ID]) {
    bag = consumeItem(characterId, TEST_TOKEN_ID, bag[TEST_TOKEN_ID]).bag;
  }

  return bag;
}
