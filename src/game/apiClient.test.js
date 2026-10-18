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

  it("register posts credentials and returns user and token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: { id: "u1", username: "tieuvotruong", displayName: "Tiêu Võ Trưởng" },
          token: "token-123"
        }
      })
    });

    const res = await client.register("tieuvotruong", "pass123456", "Tiêu Võ Trưởng");
    expect(res.user.username).toBe("tieuvotruong");
    expect(res.token).toBe("token-123");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "tieuvotruong",
          password: "pass123456",
          displayName: "Tiêu Võ Trưởng"
        })
      })
    );
  });

  it("login posts credentials and returns user and token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: { id: "u1", username: "tieuvotruong" },
          token: "token-123"
        }
      })
    });

    const res = await client.login("tieuvotruong", "pass123456");
    expect(res.user.username).toBe("tieuvotruong");
    expect(res.token).toBe("token-123");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "tieuvotruong",
          password: "pass123456"
        })
      })
    );
  });

  it("login throws descriptive error when server returns non-JSON HTML error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      }
    });

    await expect(client.login("user", "pass")).rejects.toThrow(
      "Máy chủ phản hồi không đúng định dạng (HTTP 502)"
    );
  });

  it("checkUsername queries endpoint and returns availability data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { available: true, reason: "Tài khoản có thể sử dụng." }
      })
    });

    const res = await client.checkUsername("hero_name");
    expect(res.available).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/check-username?username=hero_name"
    );
  });
});

