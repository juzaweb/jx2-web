/**
 * Per-character consumable bindings for the mobile HP/MP buttons.
 *
 * Mirror of the skill fan: both buttons start empty ("+"), and the player picks
 * a consumable from the bag (potions, wine, return talismans). Stored as an
 * array of item ids, null meaning "empty button".
 */

import { createSlotBindings } from "./slotBindings.js";

export const MOBILE_ITEM_SLOTS = 2;

const bindings = createSlotBindings({
  slotCount: MOBILE_ITEM_SLOTS,
  storagePrefix: "jx2_mobile_items_"
});

/** Empty bindings: both consumable buttons start as an unassigned "+". */
export const DEFAULT_MOBILE_ITEMS = bindings.DEFAULT;

/** Coerce raw storage into a fixed-length array of item ids. */
export const sanitizeMobileItems = bindings.sanitize;

/** Load a character's mobile consumable bindings. */
export const loadMobileItems = bindings.load;

/** Persist a character's mobile consumable bindings. */
export const saveMobileItems = bindings.save;

/** Assign (or clear) the consumable bound to one mobile button. */
export const assignMobileItem = bindings.assign;
