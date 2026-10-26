import { useCallback, useEffect, useState } from "react";
import { bridge, EVENTS } from "../../game/bridge.js";

/**
 * Tracks the remaining cooldown of every skill the player just cast.
 *
 * The desktop quick bar and the mobile touch arc both need the same numbers, so
 * the subscription lives here instead of being duplicated (and drifting) in two
 * components.
 *
 * @returns {(skillId: string) => number} milliseconds left for that skill (0 = ready)
 */
export function useSkillCooldowns() {
  const [ends, setEnds] = useState({});
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const off = bridge.on(EVENTS.SKILL_CAST, ({ skillId, cooldown }) => {
      if (!skillId) return;
      const now = Date.now();
      setClock(now);
      setEnds((prev) => ({ ...prev, [skillId]: now + (cooldown || 0) }));
    });
    return off;
  }, []);

  // Only tick while something is actually cooling down, and drop the expired
  // entries as we go so the badge never re-renders forever.
  useEffect(() => {
    const active = Object.values(ends).some((end) => end > Date.now());
    if (!active) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      setClock(now);
      setEnds((prev) => {
        const next = {};
        let changed = false;
        for (const [skillId, end] of Object.entries(prev)) {
          if (end > now) next[skillId] = end;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 200);
    return () => clearInterval(id);
  }, [ends]);

  return useCallback(
    (skillId) => (skillId ? Math.max(0, (ends[skillId] || 0) - clock) : 0),
    [ends, clock]
  );
}
