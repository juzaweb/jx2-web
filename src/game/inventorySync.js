/**
 * Client-side helpers for syncing a character's inventory with the server
 * (`GET`/`PUT /api/inventory/:characterId`, see
 * server/src/controllers/inventory.controller.js).
 *
 * Unlike progress saves (keyed by the account), the bag is keyed by the
 * character, so each hero owns a separate inventory. The server is the source of
 * truth once it holds any data; the local save is only a fallback for a fresh
 * character or an unreachable backend.
 */

import { sanitizeQuantities } from "./items.js";

/**
 * Coerce an untrusted value into a safe id -> non-negative integer map.
 * @param {*} value
 * @returns {Record<string, number>}
 */
export function sanitizeInventory(value) {
  return sanitizeQuantities(value) || {};
}

/**
 * Order-independent signature of an inventory, used to skip redundant uploads.
 * @param {Record<string, number>} inventory
 * @returns {string}
 */
export function inventorySignature(inventory) {
  const clean = sanitizeInventory(inventory);
  return Object.keys(clean)
    .sort()
    .map((id) => `${id}:${clean[id]}`)
    .join("|");
}

/**
 * Whether an inventory holds at least one usable entry.
 * @param {Record<string, number>} inventory
 * @returns {boolean}
 */
export function hasInventory(inventory) {
  return Object.keys(sanitizeInventory(inventory)).length > 0;
}

/**
 * Decide how to reconcile the server bag with the local one on entering the game.
 * The server wins whenever it holds any data; otherwise the local bag is pushed up
 * so a fresh character starts from what the device already had.
 * @param {Record<string, number>} serverInventory
 * @param {Record<string, number>} localInventory
 * @returns {{ action: "adopt"|"push", quantities: Record<string, number> }}
 */
export function planInventorySync(serverInventory, localInventory) {
  if (hasInventory(serverInventory)) {
    return { action: "adopt", quantities: sanitizeInventory(serverInventory) };
  }
  return { action: "push", quantities: sanitizeInventory(localInventory) };
}

/**
 * Orchestrates the bag's round trips to the server, independent of Phaser and the
 * DOM so it can be unit tested. Owns the "which bag is authoritative" decision and
 * the two guards that make it safe:
 *
 *  - `reset()` is called on entering the game so the initial save cannot upload the
 *    local bag over the server's copy before it has been read;
 *  - an upload is skipped unless the signature changed, so a save that did not
 *    touch items (a kill, a position tick) sends no request.
 */
export class InventorySyncer {
  /**
   * @param {Object} deps
   * @param {{ getInventory: Function, updateInventory: Function }} deps.api
   * @param {() => (string|null)} deps.getOwnerId - Character id owning the bag
   * @param {() => Record<string, number>} deps.getQuantities
   * @param {(quantities: Record<string, number>) => void} deps.setQuantities
   * @param {(quantities: Record<string, number>) => void} [deps.onAdopt] - Called
   *   after the local bag adopts the server's (to refresh UI / persist)
   * @param {(error: *) => void} [deps.onError]
   */
  constructor({ api, getOwnerId, getQuantities, setQuantities, onAdopt, onError }) {
    this.api = api;
    this.getOwnerId = getOwnerId;
    this.getQuantities = getQuantities;
    this.setQuantities = setQuantities;
    this.onAdopt = onAdopt;
    this.onError = onError;
    this.ready = false;
    this.lastSignature = null;
  }

  /** Block uploads until the next `load()` reconciles the bag. */
  reset() {
    this.ready = false;
  }

  /**
   * Upload the current bag when it changed since the last successful sync.
   * Fire-and-forget: a failure clears the cached signature so the next change or
   * auto-save retries.
   */
  sync() {
    const ownerId = this.getOwnerId();
    if (!ownerId || !this.ready) return;

    const inventory = this.getQuantities();
    const signature = inventorySignature(inventory);
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.api.updateInventory(ownerId, inventory).catch((error) => {
      this.lastSignature = null;
      if (this.onError) this.onError(error);
    });
  }

  /**
   * Read the character's bag from the server (source of truth). With server data
   * the local store adopts it; with none, the local bag is pushed up. An
   * unreachable backend keeps the local bag and unblocks later uploads.
   *
   * The owner is re-checked after the await: switching characters mid-flight must
   * not let a stale response adopt the old character's bag into the new one.
   */
  async load() {
    const ownerId = this.getOwnerId();
    if (!ownerId) return;

    this.ready = false;
    try {
      const serverInventory = await this.api.getInventory(ownerId);
      if (this.getOwnerId() !== ownerId) return;

      const { action, quantities } = planInventorySync(serverInventory, this.getQuantities());

      if (action === "adopt") {
        this.setQuantities(quantities);
        this.lastSignature = inventorySignature(this.getQuantities());
        this.ready = true;
        if (this.onAdopt) this.onAdopt(quantities);
      } else {
        this.lastSignature = null;
        this.ready = true;
        this.sync();
      }
    } catch (error) {
      if (this.getOwnerId() !== ownerId) return;
      this.lastSignature = null;
      this.ready = true;
      if (this.onError) this.onError(error);
    }
  }
}
