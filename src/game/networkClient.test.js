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

  it("should drop its handlers when disconnected for good", () => {
    const handler = vi.fn();
    client.on("disconnected", handler);

    client.disconnect();
    // The socket's `close` arrives after the teardown; it must find no listeners
    client.emit("disconnected", {});

    expect(handler).not.toHaveBeenCalled();
    expect(client.shouldReconnect).toBe(false);
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

  it("stops reconnecting when the server reports this session was superseded", () => {
    const superseded = vi.fn();
    client.on("superseded", superseded);
    client.isConnected = true;
    client.ws = { readyState: 1, send: vi.fn(), close: vi.fn() };

    client.handleRawMessage(JSON.stringify({ type: "session_superseded", payload: {} }));

    expect(superseded).toHaveBeenCalledTimes(1);
    expect(client.superseded).toBe(true);
    expect(client.shouldReconnect).toBe(false);
  });

  it("announces a superseded session only once across message and close code", () => {
    const handler = vi.fn();
    client.on("superseded", handler);

    client.handleRawMessage(JSON.stringify({ type: "session_superseded", payload: {} }));
    client.handleClose({ code: 4001 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("suspend stops the socket but keeps listeners for the next login", () => {
    const socket = {
      readyState: 1,
      close: vi.fn(),
      onopen: () => {},
      onmessage: () => {},
      onclose: () => {},
      onerror: () => {}
    };
    const handler = vi.fn();
    client.ws = socket;
    client.isConnected = true;
    client.on("connected", handler);

    client.suspend();

    expect(client.isConnected).toBe(false);
    expect(client.ws).toBeNull();
    expect(client.shouldReconnect).toBe(false);
    expect(socket.close).toHaveBeenCalledTimes(1);
    // Listeners survive so the same instance can serve the next character.
    expect(client.listeners.has("connected")).toBe(true);
    client.emit("connected", {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled handshake and schedules a retry", () => {
    vi.useFakeTimers();
    const originalWebSocket = globalThis.WebSocket;
    const instances = [];
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;
      constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        instances.push(this);
      }
      send() {}
      close() {
        this.readyState = FakeWebSocket.CLOSED;
      }
    }
    globalThis.WebSocket = FakeWebSocket;

    try {
      const errors = vi.fn();
      client.on("error", errors);

      client.connect();
      expect(instances).toHaveLength(1);

      // Nothing opened within the handshake window: the socket is abandoned.
      vi.advanceTimersByTime(client.connectTimeoutMs);
      expect(errors).toHaveBeenCalled();
      expect(client.isReconnecting).toBe(true);

      // Backoff then retries instead of sitting dead forever.
      vi.advanceTimersByTime(client.baseReconnectDelayMs);
      expect(instances).toHaveLength(2);
    } finally {
      globalThis.WebSocket = originalWebSocket;
      vi.useRealTimers();
    }
  });

  it("retryNow clears a superseded state and reconnects at once", () => {
    vi.useFakeTimers();
    const originalWebSocket = globalThis.WebSocket;
    const instances = [];
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;
      constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        instances.push(this);
      }
      send() {}
      close() {
        this.readyState = FakeWebSocket.CLOSED;
      }
    }
    globalThis.WebSocket = FakeWebSocket;

    try {
      client.superseded = true;
      client.shouldReconnect = false;

      client.retryNow();

      expect(client.superseded).toBe(false);
      expect(client.shouldReconnect).toBe(true);
      expect(instances).toHaveLength(1);
    } finally {
      globalThis.WebSocket = originalWebSocket;
      vi.useRealTimers();
    }
  });
});
