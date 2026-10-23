/**
 * Minimal HTML5 drag-and-drop payload shared by the inventory grid, hotbar, and the
 * character paper-doll, so an item can be dragged between panels to equip / unequip / assign hotbar.
 *
 * The JSON payload is only readable on drop, but the drag kind and the target
 * slot are also written as their own MIME *types*. Those are visible during
 * dragover, which lets a slot highlight only for drags it can actually accept.
 */

/** Generic marker type so foreign drags (files, plain text) are ignored. */
export const DRAG_MIME = "application/x-jx2-item";
/** Kind marker types, readable during dragover. */
export const DRAG_INVENTORY_MIME = "application/x-jx2-inventory";
export const DRAG_EQUIPMENT_MIME = "application/x-jx2-equipment";
export const DRAG_HOTBAR_MIME = "application/x-jx2-hotbar";
/** Prefix of a per-slot marker type, e.g. `application/x-jx2-slot-weapon`. */
export const DRAG_SLOT_PREFIX = "application/x-jx2-slot-";

const typesOf = (event) => Array.from(event.dataTransfer?.types || []);

/**
 * Attach a drag payload to the event's dataTransfer.
 * @param {DragEvent} event
 * @param {{ kind: "inventory"|"equipment"|"hotbar", itemId?: string, slot?: string, fromSlot?: number }} payload
 */
export function setDragPayload(event, payload) {
  const dt = event.dataTransfer;
  if (!dt) return;
  dt.setData(DRAG_MIME, JSON.stringify(payload));
  if (payload.kind === "inventory") {
    dt.setData(DRAG_INVENTORY_MIME, "1");
  } else if (payload.kind === "equipment") {
    dt.setData(DRAG_EQUIPMENT_MIME, "1");
  } else if (payload.kind === "hotbar") {
    dt.setData(DRAG_HOTBAR_MIME, "1");
  }
  if (payload.kind === "inventory" && payload.slot) {
    dt.setData(`${DRAG_SLOT_PREFIX}${payload.slot}`, "1");
  }
  dt.effectAllowed = "move";
}

/**
 * Read a drag payload written by setDragPayload. Only usable on drop.
 * @param {DragEvent} event
 * @returns {{ kind: "inventory"|"equipment"|"hotbar", itemId?: string, slot?: string, fromSlot?: number }|null}
 */
export function readDragPayload(event) {
  const raw = event.dataTransfer?.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (
      !payload ||
      (payload.kind !== "inventory" &&
        payload.kind !== "equipment" &&
        payload.kind !== "hotbar")
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Whether the drag in progress is ours. Safe to call during dragover.
 * @param {DragEvent} event
 * @returns {boolean}
 */
export function hasDragPayload(event) {
  return typesOf(event).includes(DRAG_MIME);
}

/**
 * The kind of drag in progress, or null for foreign drags. Safe during dragover.
 * @param {DragEvent} event
 * @returns {"inventory"|"equipment"|"hotbar"|null}
 */
export function dragKind(event) {
  const types = typesOf(event);
  if (types.includes(DRAG_INVENTORY_MIME)) return "inventory";
  if (types.includes(DRAG_EQUIPMENT_MIME)) return "equipment";
  if (types.includes(DRAG_HOTBAR_MIME)) return "hotbar";
  return null;
}

/**
 * Whether the drag in progress carries an inventory item that belongs in `slot`.
 * Safe during dragover, so a slot only highlights for a matching drag.
 * @param {DragEvent} event
 * @param {string} slot
 * @returns {boolean}
 */
export function canDropOnSlot(event, slot) {
  if (!slot || !hasDragPayload(event)) return false;
  return typesOf(event).includes(`${DRAG_SLOT_PREFIX}${slot}`);
}

/**
 * Mark `event` as an accepted drop target. Call from dragover once the drag is
 * known to match.
 * @param {DragEvent} event
 */
export function acceptDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}
