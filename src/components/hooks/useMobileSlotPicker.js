import { useCallback, useEffect, useState } from "react";
import { bridge, EVENTS } from "../../game/bridge.js";

/**
 * State for one row of "tap + to pick, hold to re-bind" mobile buttons.
 *
 * The skill fan and the consumable column are the same interaction on top of the
 * same storage shape (see `createSlotBindings`), so the bindings, the picker
 * index and the pause that goes with opening the overlay live here instead of
 * being written out twice in `App`.
 *
 * @param {object} options
 * @param {string} [options.characterId] Bindings are per character.
 * @param {{ load: Function, assign: Function }} options.store Canonical
 *   `mobileSkills` / `mobileItems` module (must be a stable reference).
 * @param {() => void} [options.onBeforeOpen] Runs first, e.g. to dismiss a
 *   competing overlay.
 */
export function useMobileSlotPicker({ characterId, store, onBeforeOpen }) {
  const [bindings, setBindings] = useState(() => store.load(characterId));
  const [pickerIndex, setPickerIndex] = useState(null);

  // Switching characters loads that hero's bindings and drops any picker that
  // was opened for the previous one.
  useEffect(() => {
    setBindings(store.load(characterId));
    setPickerIndex(null);
  }, [characterId, store]);

  const open = useCallback(
    (index) => {
      onBeforeOpen?.();
      setPickerIndex(index);
      bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    },
    [onBeforeOpen]
  );

  const close = useCallback(() => {
    setPickerIndex(null);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
  }, []);

  const select = useCallback(
    (value) => {
      if (pickerIndex === null) return;
      // Functional update: the assigner needs the array we hold right now, and
      // reading it from the closure would go stale between renders.
      setBindings((current) => store.assign(characterId, current, pickerIndex, value));
      setPickerIndex(null);
      bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
    },
    [characterId, pickerIndex, store]
  );

  return {
    bindings,
    pickerIndex,
    isPickerOpen: pickerIndex !== null,
    selectedId: pickerIndex === null ? null : bindings[pickerIndex] ?? null,
    open,
    close,
    select
  };
}
