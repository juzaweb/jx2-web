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

  it("listCharacters returns characters and slots", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { characters: [{ id: "c1", name: "Tiêu Phong" }], maxSlots: 3 }
      })
    });

    const res = await client.listCharacters("u1");
    expect(res.characters).toHaveLength(1);
    expect(res.maxSlots).toBe(3);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/u1/characters",
      { headers: {} }
    );
  });

  it("listCharacters attaches Bearer authorization header when token is supplied", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { characters: [{ id: "c1", name: "Tiêu Phong" }], maxSlots: 3 }
      })
    });

    await client.listCharacters("u1", "test-token-xyz");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/u1/characters",
      {
        headers: {
          Authorization: "Bearer test-token-xyz"
        }
      }
    );
  });

  it("listCharacters attaches error.status on failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: "Yêu cầu xác thực tài khoản."
      })
    });

    await expect(client.listCharacters("u1")).rejects.toMatchObject({
      message: "Yêu cầu xác thực tài khoản.",
      status: 401
    });
  });

  it("createCharacter posts the name and returns the created character", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          character: { id: "c1", name: "Độc Cô Cầu Bại", gender: "female" }
        }
      })
    });

    const res = await client.createCharacter("u1", "Độc Cô Cầu Bại", "female", "token-create-123");
    expect(res.character.id).toBe("c1");
    expect(res.character.gender).toBe("female");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/u1/characters",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-create-123"
        },
        body: JSON.stringify({ name: "Độc Cô Cầu Bại", gender: "female", faction: "han" })
      })
    );
  });

  it("createCharacter surfaces the backend error message on conflict", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: "Tên nhân vật này đã được sử dụng." })
    });

    await expect(client.createCharacter("u1", "Trùng Tên")).rejects.toMatchObject({
      message: "Tên nhân vật này đã được sử dụng.",
      status: 409
    });
  });

  it("deleteCharacter issues a DELETE with auth header and returns the updated list", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { characters: [] }
      })
    });

    const res = await client.deleteCharacter("u1", "c1", "token-del-456");
    expect(res.characters).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/u1/characters/c1",
      expect.objectContaining({
        method: "DELETE",
        headers: {
          Authorization: "Bearer token-del-456"
        }
      })
    );
  });

  it("getProfile fetches the authoritative profile for a user id", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: { id: "u1", username: "hiepkhat99", displayName: "Hiệp Khách Vô Danh" }
        }
      })
    });

    const user = await client.getProfile("u1");
    expect(user.displayName).toBe("Hiệp Khách Vô Danh");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-api:5000/api/users/me?userId=u1",
      { headers: {} }
    );
  });

  it("getProfile exposes the HTTP status so callers can detect a deleted account", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: "Không tìm thấy thông tin tài khoản."
      })
    });

    await expect(client.getProfile("gone")).rejects.toMatchObject({ status: 404 });
  });
});

