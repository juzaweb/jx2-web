/**
 * Minimal HTML5 drag-and-drop payload shared by the inventory grid and the
 * character paper-doll, so an item can be dragged between the two panels to
 * equip / unequip it.
 */

/** Custom MIME type so foreign drags (files, plain text) are ignored. */
export const DRAG_MIME = "application/x-jx2-item";

/**
 * Attach a drag payload to the event's dataTransfer.
 * @param {DragEvent} event
 * @param {{ kind: "inventory"|"equipment", itemId?: string, slot: string }} payload
 */
export function setDragPayload(event, payload) {
  const dt = event.dataTransfer;
  if (!dt) return;
  dt.setData(DRAG_MIME, JSON.stringify(payload));
  dt.effectAllowed = "move";
}

/**
 * Read a drag payload written by setDragPayload.
 * @param {DragEvent} event
 * @returns {{ kind: "inventory"|"equipment", itemId?: string, slot: string }|null}
 */
export function readDragPayload(event) {
  const raw = event.dataTransfer?.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (!payload || (payload.kind !== "inventory" && payload.kind !== "equipment")) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Whether the drag in progress carries our payload. Safe to call during
 * dragover, where the data itself is not yet readable.
 * @param {DragEvent} event
 * @returns {boolean}
 */
export function hasDragPayload(event) {
  return Array.from(event.dataTransfer?.types || []).includes(DRAG_MIME);
}

/**
 * Mark `event` as an accepted drop target for our payload. Call from dragover;
 * returns false (and does nothing) for foreign drags so they stay untouched.
 * @param {DragEvent} event
 * @returns {boolean}
 */
export function acceptDragPayload(event) {
  if (!hasDragPayload(event)) return false;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  return true;
}
