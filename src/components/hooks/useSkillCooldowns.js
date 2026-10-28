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
      const total = Math.max(0, cooldown || 0);
      setClock(now);
      setEnds((prev) => ({
        ...prev,
        [skillId]: { end: now + total, total }
      }));
    });
    return off;
  }, []);

  // Tick while something is cooling down. A 60ms tick ensures the conic radial
  // sweep moves fluidly without burdening the render loop when idle.
  useEffect(() => {
    const now = Date.now();
    const active = Object.values(ends).some((entry) => {
      const end = typeof entry === "number" ? entry : entry?.end;
      return end > now;
    });
    if (!active) return undefined;

    const id = setInterval(() => {
      const current = Date.now();
      setClock(current);
      setEnds((prev) => {
        const next = {};
        let changed = false;
        for (const [skillId, entry] of Object.entries(prev)) {
          const end = typeof entry === "number" ? entry : entry?.end;
          if (end > current) next[skillId] = entry;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 60);
    return () => clearInterval(id);
  }, [ends]);

  return useCallback(
    Object.assign(
      (skillId) => {
        if (!skillId) return 0;
        const entry = ends[skillId];
        if (!entry) return 0;
        const end = typeof entry === "number" ? entry : entry.end;
        return Math.max(0, end - clock);
      },
      {
        percent: (skillId, fallbackTotal = 0) => {
          if (!skillId) return 0;
          const entry = ends[skillId];
          if (!entry) return 0;
          const end = typeof entry === "number" ? entry : entry.end;
          const left = Math.max(0, end - clock);
          if (left <= 0) return 0;
          const total = (typeof entry === "object" && entry.total) || fallbackTotal || left;
          return total > 0 ? Math.min(100, Math.max(0, (left / total) * 100)) : 0;
        }
      }
    ),
    [ends, clock]
  );
}
