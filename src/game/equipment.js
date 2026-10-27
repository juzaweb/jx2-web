/**
 * Character equipment model ("Trang bị").
 *
 * The equipment is a fixed slot -> item id map, separate from stack quantities.
 * All helpers here are pure so the equip/unequip rules can be unit tested
 * without Phaser, React or the server. The scene owns the orchestration
 * (consuming/returning inventory stacks); this module only decides what may be
 * worn.
 */

import { getItemById } from "./items.js";
import { weaponTypeOfItem } from "./weapons.js";

/**
 * The five equipment slots, in upper-body-to-lower-body render order. `layer`
 * is the draw order inside the character container (lower = further back), used
 * by the layered placeholder renderer in player.js.
 * @type {Array<{ key: string, label: string, layer: number }>}
 */
export const EQUIPMENT_SLOTS = [
  { key: "pants", label: "Quần", layer: 1 },
  { key: "armor", label: "Giáp", layer: 2 },
  { key: "helmet", label: "Mũ", layer: 3 },
  { key: "accessory", label: "Trang sức", layer: 4 },
  { key: "weapon", label: "Vũ khí", layer: 5 }
];

/** @type {string[]} */
export const EQUIPMENT_SLOT_KEYS = EQUIPMENT_SLOTS.map((slot) => slot.key);

/**
 * @param {string} key
 * @returns {boolean} whether `key` is a known equipment slot
 */
export function isSlotKey(key) {
  return EQUIPMENT_SLOT_KEYS.includes(key);
}

/**
 * An empty equipment map with every slot present.
 * @returns {Record<string, string|null>}
 */
export function defaultEquipment() {
  const equipment = {};
  EQUIPMENT_SLOT_KEYS.forEach((key) => {
    equipment[key] = null;
  });
  return equipment;
}

/**
 * Coerce untrusted data into a slot -> item id map. Unknown slots and ids that
 * are not equipment for that slot are dropped, so a tampered save can never
 * smuggle an item into the wrong slot.
 * @param {*} value
 * @returns {Record<string, string|null>}
 */
export function sanitizeEquipment(value) {
  const clean = defaultEquipment();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return clean;
  }

  for (const key of EQUIPMENT_SLOT_KEYS) {
    const id = value[key];
    if (typeof id !== "string") continue;
    const item = getItemById(id);
    if (item && item.slot === key) {
      clean[key] = id;
    }
  }
  return clean;
}

/**
 * The equipment slot an item occupies, or null when it is not equipment.
 * @param {{ slot?: string }|null} item
 * @returns {string|null}
 */
export function slotForItem(item) {
  return item && isSlotKey(item.slot) ? item.slot : null;
}

/**
 * Validate an equip request against the current equipment without mutating it.
 * @param {Record<string, string|null>} equipment
 * @param {string} itemId
 * @returns {{ ok: boolean, slot: string|null, error: string|null }}
 */
export function planEquip(equipment, itemId) {
  const item = getItemById(itemId);
  const slot = slotForItem(item);
  if (!slot) {
    return { ok: false, slot: null, error: "Vật phẩm không thể trang bị." };
  }
  if (equipment && equipment[slot] === itemId) {
    return { ok: false, slot, error: "Vật phẩm đã được trang bị." };
  }
  return { ok: true, slot, error: null };
}

/**
 * The item id currently worn in `slot`, or null.
 * @param {Record<string, string|null>} equipment
 * @param {string} slot
 * @returns {string|null}
 */
export function equippedIn(equipment, slot) {
  if (!isSlotKey(slot) || !equipment) return null;
  const id = equipment[slot];
  return typeof id === "string" ? id : null;
}

/**
 * Sum every equipped item's `bonuses` into one flat attribute map. Missing or
 * malformed bonus fields are ignored so a bad catalog entry cannot NaN-poison
 * the character sheet.
 * @param {Record<string, string|null>} equipment
 * @returns {Record<string, number>}
 */
export function deriveEquipmentBonuses(equipment) {
  const total = {};
  EQUIPMENT_SLOT_KEYS.forEach((key) => {
    const id = equippedIn(equipment, key);
    const item = id ? getItemById(id) : null;
    if (!item || !item.bonuses) return;
    Object.entries(item.bonuses).forEach(([stat, amount]) => {
      if (typeof amount !== "number" || !Number.isFinite(amount)) return;
      total[stat] = (total[stat] || 0) + amount;
    });
  });
  return total;
}

/**
 * Render-ready rows for the tooltip / character sheet: "Ngoại công +12".
 * @param {{ bonuses?: Record<string, number> }|null} item
 * @returns {Array<{ stat: string, label: string, amount: number }>}
 */
export const BONUS_LABELS = {
  attack: "Ngoại công",
  defense: "Ngoại phòng",
  maxHp: "Sinh lực",
  maxMp: "Nội lực",
  critRate: "Chí mạng",
  accuracy: "Chính xác"
};

export function bonusRows(item) {
  if (!item || !item.bonuses) return [];
  return Object.entries(item.bonuses)
    .filter(([, amount]) => typeof amount === "number" && Number.isFinite(amount) && amount !== 0)
    .map(([stat, amount]) => ({
      stat,
      label: BONUS_LABELS[stat] || stat,
      amount
    }));
}

/**
 * The weapon type currently worn, or null when the `weapon` slot is empty (or
 * holds something that is not a weapon).
 * @param {Record<string, string|null>} equipment
 * @returns {string|null}
 */
export function equippedWeaponType(equipment) {
  const id = equippedIn(equipment, "weapon");
  if (!id) return null;
  return weaponTypeOfItem(getItemById(id));
}

