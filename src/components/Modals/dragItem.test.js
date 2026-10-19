import { describe, it, expect } from "vitest";
import {
  DRAG_MIME,
  DRAG_INVENTORY_MIME,
  DRAG_EQUIPMENT_MIME,
  DRAG_SLOT_PREFIX,
  setDragPayload,
  readDragPayload,
  hasDragPayload,
  dragKind,
  canDropOnSlot,
  acceptDrop
} from "./dragItem.js";

/** Minimal DragEvent stand-in backed by an in-memory dataTransfer store. */
const makeEvent = (data = {}, types = []) => {
  const store = { ...data };
  const event = {
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    dataTransfer: {
      types: [...types],
      dropEffect: "none",
      setData(type, value) {
        store[type] = value;
        if (!event.dataTransfer.types.includes(type)) {
          event.dataTransfer.types.push(type);
        }
      },
      getData(type) {
        return store[type] ?? "";
      }
    }
  };
  return event;
};

describe("dragItem payload", () => {
  it("round-trips an inventory payload with its kind and slot markers", () => {
    const payload = { kind: "inventory", itemId: "hac-ung-kiem", slot: "weapon" };
    const event = makeEvent();
    setDragPayload(event, payload);

    expect(readDragPayload(event)).toEqual(payload);
    expect(event.dataTransfer.types).toContain(DRAG_MIME);
    expect(event.dataTransfer.types).toContain(DRAG_INVENTORY_MIME);
    expect(event.dataTransfer.types).toContain(`${DRAG_SLOT_PREFIX}weapon`);
    expect(event.dataTransfer.types).not.toContain(DRAG_SLOT_PREFIX + "armor");
  });

  it("round-trips an equipment payload without a slot marker", () => {
    const event = makeEvent();
    setDragPayload(event, { kind: "equipment", slot: "armor" });

    expect(readDragPayload(event)).toEqual({ kind: "equipment", slot: "armor" });
    expect(event.dataTransfer.types).toContain(DRAG_EQUIPMENT_MIME);
    expect(event.dataTransfer.types).not.toContain(`${DRAG_SLOT_PREFIX}armor`);
  });

  it("ignores missing, malformed and foreign payloads", () => {
    expect(readDragPayload(makeEvent())).toBeNull();
    expect(readDragPayload(makeEvent({ [DRAG_MIME]: "not json" }))).toBeNull();
    expect(readDragPayload(makeEvent({ [DRAG_MIME]: JSON.stringify({ kind: "bogus" }) }))).toBeNull();
    expect(readDragPayload(makeEvent({ "text/plain": "hac-ung-kiem" }))).toBeNull();
  });

  it("tolerates a missing dataTransfer", () => {
    const bare = { preventDefault() {} };
    expect(readDragPayload(bare)).toBeNull();
    expect(hasDragPayload(bare)).toBe(false);
    expect(dragKind(bare)).toBeNull();
    expect(canDropOnSlot(bare, "weapon")).toBe(false);
    expect(() => setDragPayload(bare, { kind: "equipment", slot: "weapon" })).not.toThrow();
  });

  it("reports the drag kind during dragover", () => {
    expect(dragKind(makeEvent({}, [DRAG_INVENTORY_MIME]))).toBe("inventory");
    expect(dragKind(makeEvent({}, [DRAG_EQUIPMENT_MIME]))).toBe("equipment");
    expect(dragKind(makeEvent({}, ["text/plain"]))).toBeNull();
  });

  it("only matches a slot for an inventory drag of that slot", () => {
    const weaponDrag = makeEvent({}, [DRAG_MIME, DRAG_INVENTORY_MIME, `${DRAG_SLOT_PREFIX}weapon`]);
    expect(canDropOnSlot(weaponDrag, "weapon")).toBe(true);
    expect(canDropOnSlot(weaponDrag, "armor")).toBe(false);
    expect(canDropOnSlot(weaponDrag, undefined)).toBe(false);

    const wornDrag = makeEvent({}, [DRAG_MIME, DRAG_EQUIPMENT_MIME]);
    expect(canDropOnSlot(wornDrag, "weapon")).toBe(false);

    // A slot marker without our generic payload marker is not ours — reject it.
    const markerOnly = makeEvent({}, [`${DRAG_SLOT_PREFIX}weapon`]);
    expect(canDropOnSlot(markerOnly, "weapon")).toBe(false);
  });

  it("acceptDrop marks the event and stops foreign drags", () => {
    const event = makeEvent();
    acceptDrop(event);
    expect(event.defaultPrevented).toBe(true);
    expect(event.dataTransfer.dropEffect).toBe("move");

    const foreign = makeEvent({}, ["text/plain"]);
    expect(canDropOnSlot(foreign, "weapon")).toBe(false);
    expect(foreign.defaultPrevented).toBe(false);
  });
});
