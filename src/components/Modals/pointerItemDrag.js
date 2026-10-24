/**
 * Pointer-driven item dragging shared by the inventory grid and the hotbar.
 *
 * HTML5 drag-and-drop silently breaks whenever the page is rendered at a
 * non-100% zoom or inside a scaled device-emulation viewport: the browser
 * hit-tests drops in the *unscaled* coordinate space, so an item released
 * visually on slot 1 is resolved somewhere else on the page and the drop is
 * discarded. Pointer events always carry true viewport coordinates, so the
 * panels drive dragging with them instead.
 *
 * A drag only starts after {@link ITEM_DRAG_THRESHOLD} pixels of movement, so a
 * plain click still uses / equips the item. Callers wire the actual action in
 * their `onDrop` callback and ignore the click that ends a drag by calling
 * {@link didItemDragJustEnd} with the element that was clicked.
 *
 * Hotbar slots are marked with `data-hotbar-slot="1..9"` and grouped inside a
 * `data-hotbar-strip` element; character-sheet slots use `data-equip-slot`.
 */

/** Attribute marking a hotbar quick slot (value = slot number 1..9). */
export const HOTBAR_SLOT_ATTR = "data-hotbar-slot";
/** Attribute marking the strip that groups the quick slots. */
export const HOTBAR_STRIP_ATTR = "data-hotbar-strip";
/** Attribute marking a character-sheet equipment slot (value = equipment key). */
export const EQUIP_SLOT_ATTR = "data-equip-slot";
/** Movement (px) before a press turns into a drag. */
export const ITEM_DRAG_THRESHOLD = 6;
/** CSS class of the ghost that follows the pointer. */
export const DRAG_GHOST_CLASS = "item-drag-ghost";
/** CSS class added to the slot under the pointer. */
export const DROP_TARGET_CLASS = "is-drop-target";
/** CSS class added to the element the drag started from. */
export const DRAG_SOURCE_CLASS = "drag-source";

/** How long after a drop a follow-up click must still be ignored. */
const CLICK_SUPPRESS_MS = 400;
const BODY_DRAGGING_CLASS = "is-item-dragging";
/** How far outside the strip a release still counts as "on the bar". */
const STRIP_SLACK_PX = 8;

let activeDrag = null;
/** `{ endedAt, source }` of the last completed drag, used to swallow its click. */
let lastDrag = null;

/**
 * True right after a drag finished. Pass the element that received the click to
 * only suppress the click on the item that was dragged — clicking a *different*
 * slot right after a drag must still use / equip that item.
 * @param {Element|null} [element] element that received the click
 * @param {number} [maxAgeMs]
 * @returns {boolean}
 */
export function didItemDragJustEnd(element = null, maxAgeMs = CLICK_SUPPRESS_MS) {
  if (!lastDrag || Date.now() - lastDrag.endedAt >= maxAgeMs) return false;
  if (!element || !lastDrag.source) return true;
  return lastDrag.source === element || Boolean(lastDrag.source.contains?.(element));
}

/** The quick-slot element wrapping `element`, if any. */
const hotbarSlotNode = (element) => element?.closest?.(`[${HOTBAR_SLOT_ATTR}]`) || null;

/**
 * Resolve the quick slot number of a hotbar slot element (or any descendant).
 * @param {Element|null|undefined} element
 * @returns {number|null} 1..9, or null when the element is not a hotbar slot
 */
export function hotbarSlotFromElement(element) {
  const node = hotbarSlotNode(element);
  if (!node) return null;
  const slot = Number(node.getAttribute(HOTBAR_SLOT_ATTR));
  return Number.isInteger(slot) && slot > 0 ? slot : null;
}

/**
 * Resolve which quick slot a point (x, y) belongs to.
 *
 * A point over a slot returns that slot; a point in the gap between slots — or
 * on the strip padding — snaps to the nearest slot, so the bar is one forgiving
 * target instead of nine tiny ones.
 * @param {number} x
 * @param {number} y
 * @param {Document} [doc]
 * @returns {number|null}
 */
export function hotbarSlotAtPoint(x, y, doc = typeof document !== "undefined" ? document : null) {
  if (!doc || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  let hit = null;
  try {
    hit = doc.elementFromPoint?.(x, y) || null;
  } catch {
    // Hit testing is unavailable (jsdom, detached document): fall back to geometry.
    hit = null;
  }
  const direct = hotbarSlotFromElement(hit);
  if (direct) return direct;

  const strip = doc.querySelector?.(`[${HOTBAR_STRIP_ATTR}]`);
  if (!strip) return null;

  const bounds = strip.getBoundingClientRect();
  const inside =
    x >= bounds.left - STRIP_SLACK_PX &&
    x <= bounds.right + STRIP_SLACK_PX &&
    y >= bounds.top - STRIP_SLACK_PX &&
    y <= bounds.bottom + STRIP_SLACK_PX;
  if (!inside) return null;

  let nearest = null;
  let nearestDistance = Infinity;
  for (const slotEl of strip.querySelectorAll(`[${HOTBAR_SLOT_ATTR}]`)) {
    const rect = slotEl.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - x);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = Number(slotEl.getAttribute(HOTBAR_SLOT_ATTR));
    }
  }
  return Number.isInteger(nearest) && nearest > 0 ? nearest : null;
}

/**
 * Resolve the drop zone at viewport point (x, y).
 *
 * Equipment slots win over the hotbar (they are small and never overlap it), and
 * a point anywhere on the numbered bar snaps to the nearest quick slot.
 * @param {number} x
 * @param {number} y
 * @param {Document} [doc]
 * @returns {{ type: "hotbar"|"equip", slot: number|string, element: Element|null }|null}
 */
export function resolveDropZone(x, y, doc = typeof document !== "undefined" ? document : null) {
  if (!doc || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  let hit = null;
  try {
    hit = doc.elementFromPoint?.(x, y) || null;
  } catch {
    hit = null;
  }

  const equip = hit?.closest?.(`[${EQUIP_SLOT_ATTR}]`);
  if (equip) {
    const slot = equip.getAttribute(EQUIP_SLOT_ATTR);
    return slot ? { type: "equip", slot, element: equip } : null;
  }

  const slot = hotbarSlotFromElement(hit);
  if (slot) return { type: "hotbar", slot, element: hotbarSlotNode(hit) };

  const snappedSlot = hotbarSlotAtPoint(x, y, doc);
  if (snappedSlot == null) return null;
  return {
    type: "hotbar",
    slot: snappedSlot,
    element: doc.querySelector?.(`[${HOTBAR_SLOT_ATTR}="${snappedSlot}"]`) || null
  };
}

const moveGhost = (ghost, x, y) => {
  ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
};

/** A small copy of the item art that follows the pointer. */
const createGhost = (iconClass, x, y) => {
  const ghost = document.createElement("div");
  ghost.className = `${DRAG_GHOST_CLASS}${iconClass ? ` ${iconClass}` : ""}`;
  ghost.setAttribute("aria-hidden", "true");
  document.body.appendChild(ghost);
  moveGhost(ghost, x, y);
  return ghost;
};

const setHoveredZone = (drag, zone) => {
  const previous = drag.hovered;
  drag.hovered = zone;
  if (previous?.element === zone?.element) return;
  previous?.element?.classList?.remove(DROP_TARGET_CLASS);
  zone?.element?.classList?.add(DROP_TARGET_CLASS);
};

const finish = (drag, { dropZone = null, cancelled = false } = {}) => {
  if (!drag || drag !== activeDrag) return;
  activeDrag = null;
  drag.cleanup();

  setHoveredZone(drag, null);
  drag.source?.classList?.remove(DRAG_SOURCE_CLASS);
  drag.ghost?.remove();
  document.body.classList.remove(BODY_DRAGGING_CLASS);

  if (drag.dragging) {
    lastDrag = { endedAt: Date.now(), source: drag.source };
    if (!cancelled) drag.onDrop?.(dropZone, drag.payload);
  }
};

/**
 * Cancel any drag in flight, e.g. when the panel that owns the item closes.
 */
export function cancelItemDrag() {
  finish(activeDrag, { cancelled: true });
}

/**
 * Start watching a pointer for an item drag. Nothing visible happens until the
 * pointer travels past {@link ITEM_DRAG_THRESHOLD}.
 * @param {object} options
 * @param {PointerEvent} options.event pointerdown event that starts the press
 * @param {object} options.payload item description handed back to `onDrop`
 * @param {string} [options.ghostIcon] icon class for the ghost (e.g. `icon-hp-pot`)
 * @param {(zone: {type: string, slot: number|string}|null, payload: object) => void} [options.onDrop]
 * @returns {boolean} whether the press was accepted
 */
export function beginItemDrag({ event, payload, ghostIcon, onDrop } = {}) {
  // Only the primary button drags; right-click clears a hotbar slot.
  if (!event || (typeof event.button === "number" && event.button !== 0)) return false;
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  cancelItemDrag();

  const drag = {
    payload,
    onDrop,
    ghostIcon,
    source: event.currentTarget || event.target || null,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    dragging: false,
    ghost: null,
    hovered: null,
    cleanup: null
  };

  const handleMove = (moveEvent) => {
    if (drag.pointerId != null && moveEvent.pointerId !== drag.pointerId) return;
    drag.x = moveEvent.clientX;
    drag.y = moveEvent.clientY;

    if (!drag.dragging) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < ITEM_DRAG_THRESHOLD) {
        return;
      }
      drag.dragging = true;
      drag.ghost = createGhost(drag.ghostIcon, drag.x, drag.y);
      drag.source?.classList?.add(DRAG_SOURCE_CLASS);
      document.body.classList.add(BODY_DRAGGING_CLASS);
    }

    moveGhost(drag.ghost, drag.x, drag.y);
    setHoveredZone(drag, resolveDropZone(drag.x, drag.y));
  };

  const handleUp = (upEvent) => {
    if (drag.pointerId != null && upEvent.pointerId !== drag.pointerId) return;
    drag.x = upEvent.clientX ?? drag.x;
    drag.y = upEvent.clientY ?? drag.y;
    const zone = drag.dragging ? resolveDropZone(drag.x, drag.y) : null;
    finish(drag, { dropZone: zone });
  };

  const handleCancel = () => finish(drag, { cancelled: true });

  drag.cleanup = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleCancel);
    window.removeEventListener("blur", handleCancel);
  };
  activeDrag = drag;

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleCancel);
  window.addEventListener("blur", handleCancel);
  return true;
}
