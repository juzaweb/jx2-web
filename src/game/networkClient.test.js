import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NetworkClient, getWsUrl } from "./networkClient.js";

describe("NetworkClient", () => {
  let client;

  beforeEach(() => {
    client = new NetworkClient("ws://localhost:5000/ws");
  });

  afterEach(() => {
    client.disconnect();
  });

  it("should calculate correct WebSocket URL based on host", () => {
    const url = getWsUrl();
    expect(url).toMatch(/^wss?:\/\//);
  });

  it("should support subscribing and unsubscribing to events", () => {
    const handler = vi.fn();
    const unsub = client.on("test_event", handler);

    client.emit("test_event", { foo: "bar" });
    expect(handler).toHaveBeenCalledWith({ foo: "bar" });

    unsub();
    client.emit("test_event", { foo: "baz" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should handle error in event listener gracefully", () => {
    const brokenHandler = () => {
      throw new Error("test crash");
    };
    const healthyHandler = vi.fn();

    client.on("custom_event", brokenHandler);
    client.on("custom_event", healthyHandler);

    expect(() => {
      client.emit("custom_event", { ping: 1 });
    }).not.toThrow();

    expect(healthyHandler).toHaveBeenCalledWith({ ping: 1 });
  });

  it("should dispatch network packets on incoming message", () => {
    const initHandler = vi.fn();
    const playerJoinedHandler = vi.fn();

    client.on("init_world", initHandler);
    client.on("player_joined", playerJoinedHandler);

    client.handleRawMessage(JSON.stringify({ type: "init_world", payload: { id: "p1", players: [] } }));
    expect(initHandler).toHaveBeenCalledWith({ id: "p1", players: [] });

    client.handleRawMessage(JSON.stringify({ type: "player_joined", payload: { id: "p2", name: "Đại Hiệp" } }));
    expect(playerJoinedHandler).toHaveBeenCalledWith({ id: "p2", name: "Đại Hiệp" });
  });

  it("should ignore invalid or non-JSON incoming messages", () => {
    expect(() => {
      client.handleRawMessage("{ invalid json");
    }).not.toThrow();
  });

  it("should send formatted JSON when socket is open", () => {
    const mockSend = vi.fn();
    client.ws = {
      readyState: 1, // OPEN
      send: mockSend,
      close: vi.fn(),
    };
    client.isConnected = true;

    client.send("player_move", { x: 100, y: 200 });

    expect(mockSend).toHaveBeenCalledWith(
      JSON.stringify({
        type: "player_move",
        payload: { x: 100, y: 200 },
      })
    );
  });

  it("should not crash if sending while disconnected", () => {
    client.ws = null;
    client.isConnected = false;

    expect(() => {
      client.send("player_move", { x: 50, y: 50 });
    }).not.toThrow();
  });
});
