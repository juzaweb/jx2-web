/**
 * Per-player inventory and equipment mutations on the server.
 *
 * The bag used to live in the browser and be overwritten through an
 * unauthenticated REST call. These helpers are now the only writers: every
 * change is validated against the shared catalog, persisted to `saves`, and
 * mirrored to the client afterwards.
 */

import { store } from "../data/playerDb.js";
import { getItemById } from "../../../src/game/items.js";
import {
  defaultEquipment,
  isSlotKey,
  planEquip,
  sanitizeEquipment
} from "../../../src/game/equipment.js";

/** Largest stack a single bag slot may hold. */
export const MAX_STACK = 999;

/**
 * A catalog id with a positive whole quantity, or null.
 * @param {*} itemId
 * @param {*} amount
 * @returns {{ itemId: string, amount: number }|null}
 */
function normalizeGrant(itemId, amount) {
  if (typeof itemId !== "string" || !getItemById(itemId)) return null;
  const qty = Number(amount);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return { itemId, amount: Math.min(MAX_STACK, Math.floor(qty)) };
}

/**
 * Reduce a stored bag to catalog ids with positive integer stacks.
 * @param {Record<string, number>} [bag]
 * @returns {Record<string, number>}
 */
export function normalizeBag(bag = {}) {
  const clean = {};
  if (!bag || typeof bag !== "object" || Array.isArray(bag)) return clean;
  for (const [id, rawQty] of Object.entries(bag)) {
    if (!getItemById(id)) continue;
    const qty = Number(rawQty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    clean[id] = Math.min(MAX_STACK, Math.floor(qty));
  }
  return clean;
}

/**
 * The character's authoritative bag.
 * @param {string} playerId
 * @returns {Record<string, number>}
 */
export function readBag(playerId) {
  return normalizeBag(store.getInventory(playerId));
}

/**
 * Persist a bag after normalizing it.
 * @param {string} playerId
 * @param {Record<string, number>} bag
 * @returns {Record<string, number>}
 */
export function writeBag(playerId, bag) {
  return normalizeBag(store.setInventory(playerId, normalizeBag(bag)));
}

/**
 * The character's authoritative equipment, filtered to real catalog items.
 * @param {string} playerId
 * @returns {Record<string, string|null>}
 */
export function readEquipment(playerId) {
  return sanitizeEquipment(store.getEquipment(playerId) || defaultEquipment());
}

/**
 * Persist an equipment map after sanitizing it.
 * @param {string} playerId
 * @param {Record<string, string|null>} equipment
 * @returns {Record<string, string|null>}
 */
export function writeEquipment(playerId, equipment) {
  return sanitizeEquipment(store.setEquipment(playerId, sanitizeEquipment(equipment)));
}

/**
 * Add multiple stacks to the bag in a single DB read/write operation.
 * @param {string} playerId
 * @param {Array<{ itemId: string, amount?: number }>} items
 * @returns {{ ok: boolean, bag: Record<string, number> }}
 */
export function grantItems(playerId, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, bag: readBag(playerId) };
  }

  const bag = readBag(playerId);
  let grantedAny = false;

  for (const item of items) {
    if (!item) continue;
    const grant = normalizeGrant(item.itemId, item.amount ?? 1);
    if (!grant) continue;

    bag[grant.itemId] = Math.min(MAX_STACK, (bag[grant.itemId] || 0) + grant.amount);
    grantedAny = true;
  }

  if (!grantedAny) return { ok: false, bag };
  return { ok: true, bag: writeBag(playerId, bag) };
}

/**
 * Add a stack to the bag. Unknown ids and non-positive amounts are ignored.
 * @param {string} playerId
 * @param {string} itemId
 * @param {number} [amount=1]
 * @returns {{ ok: boolean, bag: Record<string, number> }}
 */
export function grantItem(playerId, itemId, amount = 1) {
  return grantItems(playerId, [{ itemId, amount }]);
}

/**
 * Remove a stack from the bag, all-or-nothing.
 * @param {string} playerId
 * @param {string} itemId
 * @param {number} [amount=1]
 * @returns {{ ok: boolean, bag: Record<string, number>, reason: string|null }}
 */
export function consumeItem(playerId, itemId, amount = 1) {
  const grant = normalizeGrant(itemId, amount);
  const bag = readBag(playerId);
  if (!grant) return { ok: false, bag, reason: "unknown_item" };

  const held = bag[grant.itemId] || 0;
  if (held < grant.amount) return { ok: false, bag, reason: "missing_item" };

  const remaining = held - grant.amount;
  if (remaining > 0) {
    bag[grant.itemId] = remaining;
  } else {
    delete bag[grant.itemId];
  }
  return { ok: true, bag: writeBag(playerId, bag), reason: null };
}

/**
 * Equip one bag item, returning the previously worn item (if any) to the bag.
 * @param {string} playerId
 * @param {string} itemId
 * @returns {{ ok: boolean, slot: string|null, bag: Record<string, number>,
 *   equipment: Record<string, string|null>, reason: string|null }}
 */
export function equipItem(playerId, itemId) {
  const bag = readBag(playerId);
  const equipment = readEquipment(playerId);
  const plan = planEquip(equipment, itemId);

  if (!plan.ok) {
    return { ok: false, slot: plan.slot, bag, equipment, reason: "not_equippable" };
  }
  if ((bag[itemId] || 0) <= 0) {
    return { ok: false, slot: plan.slot, bag, equipment, reason: "missing_item" };
  }

  const previous = equipment[plan.slot];
  if (previous) {
    bag[previous] = Math.min(MAX_STACK, (bag[previous] || 0) + 1);
  }

  const remaining = (bag[itemId] || 0) - 1;
  if (remaining > 0) {
    bag[itemId] = remaining;
  } else {
    delete bag[itemId];
  }
  equipment[plan.slot] = itemId;

  return {
    ok: true,
    slot: plan.slot,
    bag: writeBag(playerId, bag),
    equipment: writeEquipment(playerId, equipment),
    reason: null
  };
}

/**
 * Take off whatever is worn in `slot` and return it to the bag.
 * @param {string} playerId
 * @param {string} slot
 * @returns {{ ok: boolean, bag: Record<string, number>,
 *   equipment: Record<string, string|null>, reason: string|null }}
 */
export function unequipSlot(playerId, slot) {
  const bag = readBag(playerId);
  const equipment = readEquipment(playerId);

  if (!isSlotKey(slot)) return { ok: false, bag, equipment, reason: "unknown_slot" };
  const itemId = equipment[slot];
  if (!itemId) return { ok: false, bag, equipment, reason: "empty_slot" };

  equipment[slot] = null;
  bag[itemId] = Math.min(MAX_STACK, (bag[itemId] || 0) + 1);

  return {
    ok: true,
    bag: writeBag(playerId, bag),
    equipment: writeEquipment(playerId, equipment),
    reason: null
  };
}
