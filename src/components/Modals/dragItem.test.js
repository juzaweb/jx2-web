import { describe, it, expect } from "vitest";
import {
  DRAG_MIME,
  setDragPayload,
  readDragPayload,
  hasDragPayload,
  acceptDragPayload
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
  it("round-trips an inventory payload through the dataTransfer", () => {
    const payload = { kind: "inventory", itemId: "hac-ung-kiem", slot: "weapon" };
    const event = makeEvent();
    setDragPayload(event, payload);

    expect(event.dataTransfer.types).toContain(DRAG_MIME);
    expect(readDragPayload(event)).toEqual(payload);
  });

  it("round-trips an equipment payload", () => {
    const event = makeEvent();
    setDragPayload(event, { kind: "equipment", slot: "armor" });
    expect(readDragPayload(event)).toEqual({ kind: "equipment", slot: "armor" });
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
    expect(() => setDragPayload(bare, { kind: "equipment", slot: "weapon" })).not.toThrow();
  });

  it("detects our payload during dragover via the MIME types", () => {
    expect(hasDragPayload(makeEvent({}, [DRAG_MIME]))).toBe(true);
    expect(hasDragPayload(makeEvent({}, ["text/plain"]))).toBe(false);
  });

  it("accepts our drag and rejects foreign drags", () => {
    const ours = makeEvent({}, [DRAG_MIME]);
    expect(acceptDragPayload(ours)).toBe(true);
    expect(ours.defaultPrevented).toBe(true);
    expect(ours.dataTransfer.dropEffect).toBe("move");

    const foreign = makeEvent({}, ["text/plain"]);
    expect(acceptDragPayload(foreign)).toBe(false);
    expect(foreign.defaultPrevented).toBe(false);
    expect(foreign.dataTransfer.dropEffect).toBe("none");
  });
});
