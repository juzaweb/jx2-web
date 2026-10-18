import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "./apiClient.js";

describe("ApiClient", () => {
  let client;

  beforeEach(() => {
    client = new ApiClient("http://mock-api:5000/api");
    vi.restoreAllMocks();
  });

  it("checkHealth returns true when response is ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const isHealthy = await client.checkHealth();
    expect(isHealthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("http://mock-api:5000/api/health");
  });

  it("checkHealth returns false when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));
    const isHealthy = await client.checkHealth();
    expect(isHealthy).toBe(false);
  });

  it("loadSave returns null on 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const data = await client.loadSave("player_999");
    expect(data).toBeNull();
  });

  it("saveProgress posts payload correctly", async () => {
    const payload = { stats: { level: 10 } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { playerId: "p1", ...payload } }),
    });

    const res = await client.saveProgress("p1", payload);
    expect(res.playerId).toBe("p1");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/save/p1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  });

  it("getLeaderboard constructs query params correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { rankings: [{ playerId: "p1", level: 50 }] },
      }),
    });

    const res = await client.getLeaderboard("kills", 5);
    expect(res.rankings).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/leaderboard?sortBy=kills&limit=5"
    );
  });
});
