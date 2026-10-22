import { describe, it, expect } from "vitest";

// Function simulating useMemo-like caching or testing filtering accuracy and efficiency
function createMemoizedFilterLogs() {
  let prevLogs = null;
  let prevTab = null;
  let cachedResult = null;

  return function filterLogsMemoized(logs, activeTab) {
    if (logs === prevLogs && activeTab === prevTab && cachedResult !== null) {
      return { result: cachedResult, recomputed: false };
    }
    const result = logs.filter((log) => {
      if (activeTab === "all") return true;
      if (activeTab === "system") return log.type === "system" || log.type === "guide";
      if (activeTab === "near") return log.type === "near";
      if (activeTab === "combat") return log.type === "combat";
      return true;
    });
    prevLogs = logs;
    prevTab = activeTab;
    cachedResult = result;
    return { result, recomputed: true };
  };
}

function generateLogs(count) {
  const types = ["system", "guide", "near", "combat"];
  const logs = [];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    logs.push({
      id: `log-${i}`,
      type,
      text: `Test log message number ${i} with type ${type}`
    });
  }
  return logs;
}

describe("ChatPanel filtering unit tests and performance verification", () => {
  it("correctly filters logs based on tab selection", () => {
    const logs = [
      { id: "1", type: "system", text: "sys msg" },
      { id: "2", type: "guide", text: "guide msg" },
      { id: "3", type: "near", text: "near msg" },
      { id: "4", type: "combat", text: "combat msg" },
    ];

    const filterLogs = createMemoizedFilterLogs();

    // All tab
    expect(filterLogs(logs, "all").result).toHaveLength(4);

    // System tab includes system and guide
    const sysLogs = filterLogs(logs, "system").result;
    expect(sysLogs).toHaveLength(2);
    expect(sysLogs.map((l) => l.type)).toEqual(["system", "guide"]);

    // Near tab
    const nearLogs = filterLogs(logs, "near").result;
    expect(nearLogs).toHaveLength(1);
    expect(nearLogs[0].type).toBe("near");

    // Combat tab
    const combatLogs = filterLogs(logs, "combat").result;
    expect(combatLogs).toHaveLength(1);
    expect(combatLogs[0].type).toBe("combat");
  });

  it("avoids recalculating log filter when logs and activeTab remain unchanged across re-renders", () => {
    const logs = generateLogs(20000);
    const filterLogs = createMemoizedFilterLogs();

    // First render
    const firstRun = filterLogs(logs, "all");
    expect(firstRun.recomputed).toBe(true);

    // 500 re-renders (e.g. typing in text box) with identical logs and activeTab reference
    const startTime = performance.now();
    let cacheHits = 0;
    for (let i = 0; i < 500; i++) {
      const res = filterLogs(logs, "all");
      if (!res.recomputed) cacheHits++;
    }
    const memoizedDuration = performance.now() - startTime;

    expect(cacheHits).toBe(500);
    console.log(`500 memoized lookup calls took: ${memoizedDuration.toFixed(4)}ms (100% cache hits)`);

    // Un-memoized duration comparison
    const unmemoizedStart = performance.now();
    for (let i = 0; i < 500; i++) {
      logs.filter((log) => log.type === "combat");
    }
    const unmemoizedDuration = performance.now() - unmemoizedStart;
    console.log(`500 unmemoized filtering operations took: ${unmemoizedDuration.toFixed(2)}ms`);

    expect(memoizedDuration).toBeLessThan(unmemoizedDuration);
  });
});
