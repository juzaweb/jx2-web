import { describe, expect, it, vi } from "vitest";

vi.mock("./remotePlayer.js", () => {
  return {
    RemotePlayer: class {
      constructor(scene, data) {
        this.scene = scene;
        this.id = data.id;
        this.displayName = data.displayName || data.username || "Player";
        this.destroyed = false;
      }
      destroy() {
        this.destroyed = true;
      }
      setTarget(coords) {
        this.coords = coords;
      }
      update(time, delta) {
        this.lastUpdate = { time, delta };
      }
      showOverhead(...args) {
        this.shownOverhead = args;
      }
      hideOverhead() {
        this.hiddenOverhead = true;
      }
    }
  };
});

import { RemotePlayerManager } from "./remotePlayerManager.js";

describe("RemotePlayerManager", () => {
  it("handles player join without emitting noisy system chat logs", () => {
    const uiBridge = { addLog: vi.fn() };
    const scene = {};
    const manager = new RemotePlayerManager(scene, uiBridge);
    manager.setLocalPlayerId("local-1");

    // Local player should be ignored
    manager.handlePlayerJoined({ player: { id: "local-1", displayName: "Self" } });
    expect(manager.players.has("local-1")).toBe(false);
    expect(uiBridge.addLog).not.toHaveBeenCalled();

    // Remote player should be added, without logging to system chat
    manager.handlePlayerJoined({ player: { id: "remote-1", displayName: "LangKhach" } });
    expect(manager.players.has("remote-1")).toBe(true);
    expect(uiBridge.addLog).not.toHaveBeenCalled();
  });

  it("handles player leave without emitting noisy system chat logs", () => {
    const uiBridge = { addLog: vi.fn() };
    const scene = {};
    const manager = new RemotePlayerManager(scene, uiBridge);

    manager.handlePlayerJoined({ player: { id: "remote-2", displayName: "NguoiLa" } });
    const playerInstance = manager.players.get("remote-2");
    expect(playerInstance).toBeDefined();

    manager.handlePlayerLeft({ id: "remote-2" });
    expect(playerInstance.destroyed).toBe(true);
    expect(manager.players.has("remote-2")).toBe(false);
    expect(uiBridge.addLog).not.toHaveBeenCalled();
  });

  it("handles initial world state and filters local player", () => {
    const manager = new RemotePlayerManager({}, null);
    manager.handleInitWorld({
      yourId: "my-id",
      players: [
        { id: "my-id", displayName: "Me" },
        { id: "peer-1", displayName: "Peer 1" },
        { id: "peer-2", displayName: "Peer 2" }
      ]
    });

    expect(manager.localPlayerId).toBe("my-id");
    expect(manager.players.has("my-id")).toBe(false);
    expect(manager.players.has("peer-1")).toBe(true);
    expect(manager.players.has("peer-2")).toBe(true);
  });

  it("shows the overhead seal when a peer casts Kim Cang Bất Hoại", () => {
    const timers = [];
    const scene = {
      time: {
        delayedCall: vi.fn((delay, callback) => {
          const timer = {
            delay,
            callback,
            remove: vi.fn()
          };
          timers.push(timer);
          return timer;
        })
      }
    };
    const manager = new RemotePlayerManager(scene, null);
    manager.handlePlayerJoined({ player: { id: "remote-buff" } });

    manager.handlePlayerAttacked({ id: "remote-buff", skill: "kim_cang_bat_hoai" });

    const peer = manager.players.get("remote-buff");
    expect(peer.shownOverhead).toEqual(["buff-phat-an", 0.05, -80]);
    expect(scene.time.delayedCall).toHaveBeenCalledWith(30000, expect.any(Function));

    timers[0].callback();
    expect(peer.hiddenOverhead).toBe(true);
  });

  it("destroys all remote players on destroy()", () => {
    const manager = new RemotePlayerManager({}, null);
    manager.handleInitWorld({
      players: [{ id: "p1" }, { id: "p2" }]
    });
    const p1 = manager.players.get("p1");
    const p2 = manager.players.get("p2");

    manager.destroy();
    expect(p1.destroyed).toBe(true);
    expect(p2.destroyed).toBe(true);
    expect(manager.players.size).toBe(0);
  });
});

