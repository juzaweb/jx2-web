// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DRAG_GHOST_CLASS,
  DROP_TARGET_CLASS,
  beginItemDrag,
  cancelItemDrag,
  didItemDragJustEnd,
  hotbarSlotAtPoint,
  hotbarSlotFromElement,
  resolveDropZone
} from "./pointerItemDrag.js";

const rect = (left, top, width = 42, height = 42) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON() {
    return {};
  }
});

/** Minimal hotbar strip: [1][2] laid out left to right for geometry tests. */
const buildDock = () => {
  const strip = document.createElement("div");
  strip.setAttribute("data-hotbar-strip", "");
  document.body.append(strip);

  const slots = [1, 2].map((slot) => {
    const el = document.createElement("div");
    el.setAttribute("data-hotbar-slot", String(slot));
    strip.append(el);
    return el;
  });

  strip.getBoundingClientRect = () => rect(100, 800, 100, 42);
  slots[0].getBoundingClientRect = () => rect(100, 800);
  slots[1].getBoundingClientRect = () => rect(146, 800);
  return { strip, slots };
};

const pointerEvent = (type, x, y) => new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });

const pressEvent = (x, y, currentTarget = null) => ({
  button: 0,
  clientX: x,
  clientY: y,
  currentTarget
});

afterEach(() => {
  cancelItemDrag();
  document.body.innerHTML = "";
  document.body.className = "";
  delete document.elementFromPoint;
});

describe("hotbarSlotFromElement", () => {
  it("reads the slot number from a slot element", () => {
    const el = document.createElement("div");
    el.setAttribute("data-hotbar-slot", "7");
    expect(hotbarSlotFromElement(el)).toBe(7);
  });

  it("finds the slot from one of its children", () => {
    const slot = document.createElement("div");
    slot.setAttribute("data-hotbar-slot", "4");
    const icon = document.createElement("div");
    const quantity = document.createElement("span");
    icon.append(quantity);
    slot.append(icon);

    expect(hotbarSlotFromElement(quantity)).toBe(4);
  });

  it("ignores unrelated or malformed elements", () => {
    expect(hotbarSlotFromElement(null)).toBeNull();
    expect(hotbarSlotFromElement(undefined)).toBeNull();
    expect(hotbarSlotFromElement(document.createElement("div"))).toBeNull();

    const bogus = document.createElement("div");
    bogus.setAttribute("data-hotbar-slot", "nope");
    expect(hotbarSlotFromElement(bogus)).toBeNull();
  });
});

describe("hotbarSlotAtPoint", () => {
  it("uses the element under the pointer when it is a slot", () => {
    const slot = document.createElement("div");
    slot.setAttribute("data-hotbar-slot", "6");
    const icon = document.createElement("div");
    slot.append(icon);

    const doc = { elementFromPoint: () => icon, querySelector: () => null };

    expect(hotbarSlotAtPoint(10, 20, doc)).toBe(6);
  });

  it("snaps a point in the gap between slots to the nearest slot", () => {
    const { strip } = buildDock();
    document.elementFromPoint = () => strip;

    // Slot centres: 121 and 167. Between them the nearer one wins.
    expect(hotbarSlotAtPoint(130, 820)).toBe(1);
    expect(hotbarSlotAtPoint(180, 820)).toBe(2);
    // Padding just outside the last slot (strip ends at 200, slack 8px) still lands on it.
    expect(hotbarSlotAtPoint(205, 820)).toBe(2);
  });

  it("rejects points outside the strip", () => {
    buildDock();
    document.elementFromPoint = () => document.body;

    expect(hotbarSlotAtPoint(10, 10)).toBeNull();
    expect(hotbarSlotAtPoint(200, 400)).toBeNull();
  });

  it("returns null without a strip or with unusable coordinates", () => {
    expect(hotbarSlotAtPoint(150, 820)).toBeNull();
    buildDock();
    expect(hotbarSlotAtPoint(Number.NaN, 820)).toBeNull();
    expect(hotbarSlotAtPoint(150, Number.POSITIVE_INFINITY)).toBeNull();
    expect(hotbarSlotAtPoint(150, 820, null)).toBeNull();
  });

  it("falls back to geometry when hit testing is unavailable", () => {
    buildDock();
    // jsdom has no hit testing; the function must not throw and still snap.
    expect(() => hotbarSlotAtPoint(150, 820)).not.toThrow();
  });
});

describe("resolveDropZone", () => {
  it("resolves an equipment slot", () => {
    const slot = document.createElement("div");
    slot.setAttribute("data-equip-slot", "weapon");
    document.body.append(slot);
    document.elementFromPoint = () => slot;

    expect(resolveDropZone(10, 10)).toMatchObject({ type: "equip", slot: "weapon" });
  });

  it("prefers the equipment slot over the hotbar snap", () => {
    const { strip } = buildDock();
    const slot = document.createElement("div");
    slot.setAttribute("data-equip-slot", "armor");
    document.body.append(slot);
    document.elementFromPoint = () => slot;

    expect(resolveDropZone(150, 820)).toMatchObject({ type: "equip", slot: "armor" });
    expect(strip).toBeTruthy();
  });

  it("resolves a hotbar slot hit directly", () => {
    const { slots } = buildDock();
    document.elementFromPoint = () => slots[1];

    expect(resolveDropZone(150, 820)).toMatchObject({ type: "hotbar", slot: 2 });
  });

  it("snaps a point in the gap to the nearest quick slot", () => {
    const { strip, slots } = buildDock();
    document.elementFromPoint = () => strip;

    expect(resolveDropZone(130, 820)).toMatchObject({ type: "hotbar", slot: 1, element: slots[0] });
    expect(resolveDropZone(180, 820)).toMatchObject({ type: "hotbar", slot: 2, element: slots[1] });
  });

  it("returns null off every drop zone", () => {
    buildDock();
    document.elementFromPoint = () => document.body;

    expect(resolveDropZone(10, 10)).toBeNull();
    expect(resolveDropZone(Number.NaN, 10)).toBeNull();
  });
});

describe("pointer item drag", () => {
  it("ignores a press that never moves (plain click)", () => {
    const { slots } = buildDock();
    document.elementFromPoint = () => slots[0];
    const onDrop = vi.fn();

    beginItemDrag({ event: pressEvent(100, 100, slots[0]), payload: {}, onDrop });
    window.dispatchEvent(pointerEvent("pointermove", 103, 102));
    window.dispatchEvent(pointerEvent("pointerup", 103, 102));

    expect(onDrop).not.toHaveBeenCalled();
    expect(document.querySelector(`.${DRAG_GHOST_CLASS}`)).toBeNull();
    expect(didItemDragJustEnd()).toBe(false);
  });

  it("drops on the hovered slot after passing the threshold", () => {
    const { slots } = buildDock();
    document.elementFromPoint = () => slots[1];
    const onDrop = vi.fn();

    beginItemDrag({
      event: pressEvent(100, 100, slots[0]),
      payload: { kind: "inventory", itemId: "kim-sang-duoc" },
      ghostIcon: "icon-hp-pot",
      onDrop
    });

    window.dispatchEvent(pointerEvent("pointermove", 160, 820));
    const ghost = document.querySelector(`.${DRAG_GHOST_CLASS}`);
    expect(ghost).not.toBeNull();
    expect(ghost.className).toContain("icon-hp-pot");
    expect(document.body.classList.contains("is-item-dragging")).toBe(true);
    expect(slots[1].classList.contains(DROP_TARGET_CLASS)).toBe(true);

    window.dispatchEvent(pointerEvent("pointerup", 160, 820));

    expect(onDrop).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hotbar", slot: 2 }),
      expect.objectContaining({ itemId: "kim-sang-duoc" })
    );
    expect(document.querySelector(`.${DRAG_GHOST_CLASS}`)).toBeNull();
    expect(document.body.classList.contains("is-item-dragging")).toBe(false);
    expect(slots[1].classList.contains(DROP_TARGET_CLASS)).toBe(false);
  });

  it("reports a null zone when released outside every target", () => {
    buildDock();
    document.elementFromPoint = () => document.body;
    const onDrop = vi.fn();

    beginItemDrag({ event: pressEvent(100, 100), payload: {}, onDrop });
    window.dispatchEvent(pointerEvent("pointermove", 500, 300));
    window.dispatchEvent(pointerEvent("pointerup", 500, 300));

    expect(onDrop).toHaveBeenCalledWith(null, {});
  });

  it("cancels on pointercancel without calling onDrop", () => {
    buildDock();
    document.elementFromPoint = () => document.body;
    const onDrop = vi.fn();

    beginItemDrag({ event: pressEvent(100, 100), payload: {}, onDrop });
    window.dispatchEvent(pointerEvent("pointermove", 500, 300));
    window.dispatchEvent(pointerEvent("pointercancel", 500, 300));

    expect(onDrop).not.toHaveBeenCalled();
    expect(document.querySelector(`.${DRAG_GHOST_CLASS}`)).toBeNull();
  });

  it("rejects non-primary buttons", () => {
    expect(beginItemDrag({ event: { ...pressEvent(0, 0), button: 2 }, payload: {} })).toBe(false);
  });
});

describe("didItemDragJustEnd", () => {
  const dragSlot = (source, target) => {
    document.elementFromPoint = () => target;
    beginItemDrag({ event: pressEvent(100, 100, source), payload: {} });
    window.dispatchEvent(pointerEvent("pointermove", 160, 820));
    window.dispatchEvent(pointerEvent("pointerup", 160, 820));
  };

  it("swallows the click that ends the drag, even from a child of the source", () => {
    const { slots } = buildDock();
    const child = document.createElement("span");
    slots[0].append(child);
    dragSlot(slots[0], slots[1]);

    expect(didItemDragJustEnd()).toBe(true);
    expect(didItemDragJustEnd(slots[0])).toBe(true);
    expect(didItemDragJustEnd(child)).toBe(true);
  });

  it("does not swallow a click on a different slot right after the drag", () => {
    const { slots } = buildDock();
    dragSlot(slots[0], slots[1]);

    expect(didItemDragJustEnd(slots[1])).toBe(false);
  });

  it("expires", () => {
    const { slots } = buildDock();
    dragSlot(slots[0], slots[1]);

    expect(didItemDragJustEnd(null, 0)).toBe(false);
  });
});
