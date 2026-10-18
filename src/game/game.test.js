// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class Scene {},
  Math: {
    Between: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Distance: {
      Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
    },
    Angle: {
      Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1)
    },
    Linear: (p0, p1, t) => p0 + t * (p1 - p0)
  }
}));

import { NetworkClient } from "./networkClient.js";
import { JiangHuScene } from "./game.js";
import { setQuantities, getQuantity } from "./items.js";

/** Registers the scene lifecycle hooks the way Phaser's event emitter does. */
const bindTeardown = () => {
  const registered = [];
  const shutdown = vi.fn();
  const scope = {
    shutdown,
    events: {
      once: (event, handler, context) => registered.push({ event, handler, context })
    }
  };

  JiangHuScene.prototype.bindSceneTeardown.call(scope);

  return { registered, scope, shutdown };
};

describe("JiangHuScene teardown", () => {
  it("closes the multiplayer client when Phaser shuts the scene down or destroys it", () => {
    const { registered, scope, shutdown } = bindTeardown();

    // Both matter: a stopped scene emits `shutdown`, a destroyed game (React
    // remount after HMR, or re-entering the game) emits `destroy`
    expect(registered.map((entry) => entry.event)).toEqual(["shutdown", "destroy"]);
    registered.forEach((entry) => {
      expect(entry.context).toBe(scope);
      entry.handler.call(entry.context);
    });
    expect(shutdown).toHaveBeenCalledTimes(2);
  });

  it("disconnects the socket and releases the multiplayer helpers", () => {
    const unsubscribers = [vi.fn(), vi.fn()];
    const disconnect = vi.fn();
    const destroyRemotePlayers = vi.fn();
    const destroyBridge = vi.fn();
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const scope = {
      unloadHandler: () => {},
      unsubscribers,
      networkClient: { disconnect },
      remotePlayerManager: { destroy: destroyRemotePlayers },
      uiBridge: { destroy: destroyBridge }
    };

    JiangHuScene.prototype.shutdown.call(scope);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(destroyRemotePlayers).toHaveBeenCalledTimes(1);
    expect(destroyBridge).toHaveBeenCalledTimes(1);
    expect(scope.networkClient).toBeNull();
    expect(scope.remotePlayerManager).toBeNull();
    expect(removeEventListener).toHaveBeenCalledWith("beforeunload", scope.unloadHandler);
    expect(scope.unsubscribers).toEqual([]);
    unsubscribers.forEach((unsub) => expect(unsub).toHaveBeenCalledTimes(1));

    removeEventListener.mockRestore();
  });

  it("leaves nothing on the old client that can poke the teardown-up scene", () => {
    const addLog = vi.fn();
    const networkClient = new NetworkClient("ws://127.0.0.1:1/ws");
    networkClient.on("disconnected", () =>
      addLog("Mất kết nối máy chủ. Đang tự động kết nối lại...")
    );
    const scope = {
      networkClient,
      remotePlayerManager: { destroy: vi.fn() },
      uiBridge: { destroy: vi.fn(), addLog }
    };

    JiangHuScene.prototype.shutdown.call(scope);
    // The socket's `close` lands after the scene is gone: it must go nowhere,
    // otherwise the *live* HUD (shared bridge) logs a phantom disconnect
    networkClient.emit("disconnected", {});

    expect(addLog).not.toHaveBeenCalled();
    expect(scope.networkClient).toBeNull();
  });

  it("survives a second teardown without disconnecting twice", () => {
    const disconnect = vi.fn();
    const destroyRemotePlayers = vi.fn();
    const scope = {
      networkClient: { disconnect },
      remotePlayerManager: { destroy: destroyRemotePlayers },
      uiBridge: { destroy: vi.fn() }
    };

    JiangHuScene.prototype.shutdown.call(scope);

    expect(() => JiangHuScene.prototype.shutdown.call(scope)).not.toThrow();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(destroyRemotePlayers).toHaveBeenCalledTimes(1);
  });
});

/** Minimal scene scope that satisfies useItem() without Phaser. */
const makeUseScene = ({ hp = 10, maxHp = 100, mp = 10, maxMp = 100 } = {}) => {
  const addLog = vi.fn();
  const updateInventory = vi.fn();
  const heal = vi.fn((amount) => amount);
  const restoreMp = vi.fn((amount) => amount);
  const setPosition = vi.fn();
  const scene = {
    started: true,
    player: { stats: { hp, maxHp, mp, maxMp }, heal, restoreMp, setPosition },
    combat: { showFloatText: vi.fn() },
    uiBridge: { addLog, updateHud: vi.fn(), updateInventory },
    saveGame: vi.fn()
  };
  // The stubbed scope still needs the sibling prototype methods useItem calls.
  scene.applyItemEffect = JiangHuScene.prototype.applyItemEffect;
  scene.onInventoryChanged = JiangHuScene.prototype.onInventoryChanged;
  return { scene, addLog, updateInventory, heal, restoreMp, setPosition };
};

describe("JiangHuScene.useItem quantity", () => {
  it("deducts one unit and refreshes the HUD after a successful use", () => {
    setQuantities({ "kim-sang-duoc": 3 });
    const { scene, updateInventory } = makeUseScene();

    JiangHuScene.prototype.useItem.call(scene, 1);

    expect(getQuantity("kim-sang-duoc")).toBe(2);
    expect(updateInventory).toHaveBeenCalledTimes(1);
    expect(scene.saveGame).toHaveBeenCalledTimes(1);
  });

  it("does not deduct when the effect is refused (health already full)", () => {
    setQuantities({ "kim-sang-duoc": 3 });
    const { scene, heal } = makeUseScene({ hp: 100, maxHp: 100 });

    JiangHuScene.prototype.useItem.call(scene, 1);

    expect(heal).not.toHaveBeenCalled();
    expect(getQuantity("kim-sang-duoc")).toBe(3);
    expect(scene.saveGame).not.toHaveBeenCalled();
  });

  it("refuses a depleted stack before running the effect", () => {
    setQuantities({ "kim-sang-duoc": 0 });
    const { scene, heal, addLog } = makeUseScene({ hp: 10, maxHp: 100 });

    JiangHuScene.prototype.useItem.call(scene, 1);

    expect(heal).not.toHaveBeenCalled();
    expect(getQuantity("kim-sang-duoc")).toBe(0);
    expect(addLog).toHaveBeenCalled();
  });

  it("consumes the teleport scroll and moves the player", () => {
    setQuantities({ "hoi-thanh-phu": 1 });
    const { scene, setPosition } = makeUseScene();

    JiangHuScene.prototype.useItem.call(scene, 4);

    expect(setPosition).toHaveBeenCalledWith(640, 620);
    expect(getQuantity("hoi-thanh-phu")).toBe(0);
  });
});
