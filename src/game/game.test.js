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
import { bridge, EVENTS } from "./bridge.js";

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

describe("JiangHuScene map selection", () => {
  const resolve = (scope, saved) =>
    JiangHuScene.prototype.resolveInitialMapId.call(scope, saved);

  it("prefers an explicit request, then the saved map, then the default", () => {
    expect(resolve({ requestedMapId: "dong-mon-thanh" }, { mapId: "market" })).toBe(
      "dong-mon-thanh"
    );
    expect(resolve({ requestedMapId: null }, { mapId: "dong-mon-thanh" })).toBe(
      "dong-mon-thanh"
    );
    expect(resolve({ requestedMapId: null }, null)).toBe("market");
    expect(resolve({ requestedMapId: null }, { mapId: "atlantis" })).toBe("market");
  });
});

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
    const destroyPlayer = vi.fn();
    const destroyBridge = vi.fn();
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const scope = {
      unloadHandler: () => {},
      unsubscribers,
      networkClient: { disconnect },
      remotePlayerManager: { destroy: destroyRemotePlayers },
      player: { destroy: destroyPlayer },
      uiBridge: { destroy: destroyBridge }
    };

    JiangHuScene.prototype.shutdown.call(scope);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(destroyRemotePlayers).toHaveBeenCalledTimes(1);
    expect(destroyPlayer).toHaveBeenCalledTimes(1);
    expect(destroyBridge).toHaveBeenCalledTimes(1);
    expect(scope.networkClient).toBeNull();
    expect(scope.remotePlayerManager).toBeNull();
    expect(scope.player).toBeNull();
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

describe("JiangHuScene connection gate", () => {
  /**
   * Scene scope with just the parts the pause gate touches: two independent
   * pause reasons (a modal and the socket) feeding one frozen world.
   */
  const makeGateScene = (overrides = {}) => ({
    started: true,
    isPaused: false,
    manualPaused: false,
    connectionBlocked: false,
    physics: { pause: vi.fn(), resume: vi.fn() },
    player: { sprite: { body: {}, setVelocity: vi.fn() } },
    // The gate methods call each other through `this`, so the scope needs them.
    applyPauseState: JiangHuScene.prototype.applyPauseState,
    ...overrides
  });

  it("freezes the world and publishes the state while the socket is down", () => {
    const scene = makeGateScene();
    const states = [];
    const unsub = bridge.on(EVENTS.NETWORK_STATE, (state) => states.push(state));

    JiangHuScene.prototype.setConnectionBlocked.call(scene, true);
    unsub();

    expect(scene.connectionBlocked).toBe(true);
    expect(scene.isPaused).toBe(true);
    expect(scene.physics.pause).toHaveBeenCalledTimes(1);
    expect(scene.player.sprite.setVelocity).toHaveBeenCalledWith(0, 0);
    expect(states).toEqual([{ connected: false }]);
  });

  it("cannot be resumed by a panel closing while the socket is down", () => {
    const scene = makeGateScene();
    JiangHuScene.prototype.setConnectionBlocked.call(scene, true);

    // A help/shop modal closing calls setPaused(false) — the gate must hold.
    JiangHuScene.prototype.setPaused.call(scene, false);

    expect(scene.isPaused).toBe(true);
    expect(scene.physics.resume).not.toHaveBeenCalled();
  });

  it("cannot be resumed by a reconnect while a panel is still open", () => {
    const scene = makeGateScene();
    JiangHuScene.prototype.setConnectionBlocked.call(scene, true);
    JiangHuScene.prototype.setPaused.call(scene, true);

    JiangHuScene.prototype.setConnectionBlocked.call(scene, false);

    expect(scene.isPaused).toBe(true);
    expect(scene.physics.resume).not.toHaveBeenCalled();
  });

  it("resumes only once both the panel and the socket are clear", () => {
    const scene = makeGateScene();
    JiangHuScene.prototype.setPaused.call(scene, true);
    JiangHuScene.prototype.setConnectionBlocked.call(scene, true);

    JiangHuScene.prototype.setConnectionBlocked.call(scene, false);
    expect(scene.physics.resume).not.toHaveBeenCalled();

    JiangHuScene.prototype.setPaused.call(scene, false);
    expect(scene.isPaused).toBe(false);
    expect(scene.physics.resume).toHaveBeenCalledTimes(1);
  });
});

/** Minimal scene scope that satisfies useItem() without Phaser. */
const makeUseScene = () => {
  const addLog = vi.fn();
  const updateInventory = vi.fn();
  const useItem = vi.fn();
  const scene = {
    started: true,
    player: { stats: { hp: 10, maxHp: 100, mp: 10, maxMp: 100 } },
    uiBridge: { addLog, updateHud: vi.fn(), updateInventory },
    networkClient: { isConnected: true, useItem },
    quickSlots: { 1: "kim-sang-duoc", 2: "dai-hoan-dan", 3: "nu-nhi-hong", 4: "hoi-thanh-phu" }
  };
  // The stubbed scope still needs the sibling prototype methods useItem calls.
  scene.applyItemEffect = JiangHuScene.prototype.applyItemEffect;
  scene.applyConsumableEffect = JiangHuScene.prototype.applyConsumableEffect;
  scene.onInventoryChanged = JiangHuScene.prototype.onInventoryChanged;
  return { scene, addLog, updateInventory, useItem };
};

describe("JiangHuScene.useItem", () => {
  it("asks the server to consume a bound hotbar item", () => {
    setQuantities({ "kim-sang-duoc": 3 });
    const { scene, useItem } = makeUseScene();

    JiangHuScene.prototype.useItem.call(scene, 1);

    expect(useItem).toHaveBeenCalledWith("kim-sang-duoc");
    // The bag is server-owned: the client never decrements it optimistically.
    expect(getQuantity("kim-sang-duoc")).toBe(3);
  });

  it("uses the clicked bag item directly, even when no slot is bound", () => {
    setQuantities({ "dai-hoan-dan": 2 });
    const { scene, useItem } = makeUseScene();
    scene.quickSlots = {};

    JiangHuScene.prototype.useItem.call(scene, "dai-hoan-dan");

    expect(useItem).toHaveBeenCalledWith("dai-hoan-dan");
    expect(getQuantity("dai-hoan-dan")).toBe(2);
  });

  it("refuses a depleted stack before asking the server", () => {
    setQuantities({ "kim-sang-duoc": 0 });
    const { scene, addLog, useItem } = makeUseScene();

    JiangHuScene.prototype.useItem.call(scene, 1);

    expect(useItem).not.toHaveBeenCalled();
    expect(addLog).toHaveBeenCalled();
  });

  it("requires a live connection to use a consumable", () => {
    setQuantities({ "kim-sang-duoc": 1 });
    const { scene, addLog, useItem } = makeUseScene();
    scene.networkClient.isConnected = false;

    JiangHuScene.prototype.useItem.call(scene, 1);

    expect(useItem).not.toHaveBeenCalled();
    expect(addLog).toHaveBeenCalled();
  });

  it("sends the teleport scroll to the server instead of moving locally", () => {
    setQuantities({ "hoi-thanh-phu": 1 });
    const { scene, useItem } = makeUseScene();
    scene.player.setPosition = vi.fn();

    JiangHuScene.prototype.useItem.call(scene, 4);

    expect(useItem).toHaveBeenCalledWith("hoi-thanh-phu");
    expect(scene.player.setPosition).not.toHaveBeenCalled();
  });
});

describe("JiangHuScene.interactWithNearbyNpc", () => {
  it("opens the shop when an NPC is within range", () => {
    const stopMovement = vi.fn();
    const openShop = vi.fn();
    const addLog = vi.fn();
    const npc = { gx: 100, gy: 100, name: "Chủ Tiệm Dược" };
    const scene = {
      started: true,
      isPaused: false,
      player: { x: 105, y: 105, stopMovement },
      stage: { npcs: [npc] },
      shopFlow: { open: openShop },
      uiBridge: { addLog }
    };

    JiangHuScene.prototype.interactWithNearbyNpc.call(scene);

    expect(stopMovement).toHaveBeenCalledTimes(1);
    expect(openShop).toHaveBeenCalledWith(npc);
  });

  it("logs a message when no NPC is in range", () => {
    const stopMovement = vi.fn();
    const openShop = vi.fn();
    const addLog = vi.fn();
    const npc = { gx: 500, gy: 500, name: "Chủ Tiệm Dược" };
    const scene = {
      started: true,
      isPaused: false,
      player: { x: 100, y: 100, stopMovement },
      stage: { npcs: [npc] },
      shopFlow: { open: openShop },
      uiBridge: { addLog }
    };

    JiangHuScene.prototype.interactWithNearbyNpc.call(scene);

    expect(stopMovement).not.toHaveBeenCalled();
    expect(openShop).not.toHaveBeenCalled();
    expect(addLog).toHaveBeenCalledWith(
      expect.stringContaining("Không có NPC ở gần để nói chuyện")
    );
  });
});


describe("JiangHuScene.handleGmAction", () => {
  const makeGmScene = () => {
    const addLog = vi.fn();
    const sendGmAction = vi.fn();
    const scene = {
      player: { x: 100, y: 100 },
      combat: { showFloatText: vi.fn() },
      uiBridge: { addLog },
      networkClient: { isConnected: true, sendGmAction }
    };
    return { scene, addLog, sendGmAction };
  };

  it("relays add_items to the authoritative server", () => {
    setQuantities({ "ao-lang-khach": 0, "non-lang-khach": 0, "quan-lang-khach": 0 });
    const { scene, addLog, sendGmAction } = makeGmScene();
    const payload = {
      action: "add_items",
      items: { "ao-lang-khach": 1, "non-lang-khach": 1, "quan-lang-khach": 1 },
      log: "Đã nhận trọn bộ Y Phục Lãng Khách vào túi đồ."
    };

    JiangHuScene.prototype.handleGmAction.call(scene, payload);

    expect(sendGmAction).toHaveBeenCalledWith(payload);
    expect(addLog).toHaveBeenCalledWith(payload.log, "system");
    // The bag is server-owned: nothing is minted locally.
    expect(getQuantity("ao-lang-khach")).toBe(0);
    expect(getQuantity("non-lang-khach")).toBe(0);
  });

  it("formats the item name when the log is omitted", () => {
    setQuantities({ "non-lang-khach": 0 });
    const { scene, addLog, sendGmAction } = makeGmScene();

    JiangHuScene.prototype.handleGmAction.call(scene, {
      action: "add_items",
      items: { "non-lang-khach": 1 }
    });

    expect(sendGmAction).toHaveBeenCalled();
    expect(addLog).toHaveBeenCalledWith("Đã nhận Nón Trúc Lãng Khách vào túi đồ.", "system");
    expect(getQuantity("non-lang-khach")).toBe(0);
  });

  it("relays a costume set equip to the server", () => {
    const { scene, addLog, sendGmAction } = makeGmScene();
    const payload = {
      action: "equip_set",
      equipment: { helmet: "non-lang-khach", armor: "ao-lang-khach", pants: "quan-lang-khach" }
    };

    JiangHuScene.prototype.handleGmAction.call(scene, payload);

    expect(sendGmAction).toHaveBeenCalledWith(payload);
    expect(addLog).toHaveBeenCalled();
  });
});

describe("JiangHuScene touch auto-targeting", () => {
  const wolf = (overrides = {}) => ({
    id: "wolf",
    x: 100,
    y: 0,
    isDead: false,
    active: true,
    ...overrides
  });

  const rival = (overrides = {}) => ({
    id: "rival",
    x: 120,
    y: 0,
    pkFlag: true,
    container: { active: true },
    ...overrides
  });

  /** A scene whose prototype methods are the real ones, with stubbed collaborators. */
  const touchScene = (overrides = {}) =>
    Object.assign(Object.create(JiangHuScene.prototype), {
      autoTargetEnabled: true,
      autoTarget: null,
      pvpTarget: null,
      enemyTarget: null,
      autoTargetRing: { show: vi.fn(), hide: vi.fn() },
      player: { x: 0, y: 0, pkFlag: false },
      enemyManager: { getAlive: () => [] },
      remotePlayerManager: { getAll: () => [] },
      combat: { localPlayerId: "me" },
      updateEnemyTarget: vi.fn(),
      updatePvpTarget: vi.fn(),
      ...overrides
    });

  it("rings the closest monster and remembers it", () => {
    const target = wolf();
    const scene = touchScene({ enemyManager: { getAlive: () => [wolf({ x: 400 }), target] } });

    scene.updateAutoTarget();

    expect(scene.autoTarget).toEqual({ target, kind: "monster" });
    expect(scene.autoTargetRing.show).toHaveBeenCalledWith(100, 0, "monster");
  });

  it("prefers a flagged rival while the hero flies the PK flag", () => {
    const opponent = rival({ x: 500 });
    const scene = touchScene({
      player: { x: 0, y: 0, pkFlag: true },
      enemyManager: { getAlive: () => [wolf({ x: 30 })] },
      remotePlayerManager: { getAll: () => [opponent] }
    });

    scene.updateAutoTarget();

    expect(scene.autoTarget).toEqual({ target: opponent, kind: "player" });
    expect(scene.autoTargetRing.show).toHaveBeenCalledWith(500, 0, "player");
  });

  it("keeps the ring on the chase already under way", () => {
    const locked = wolf({ id: "locked", x: 300 });
    const closer = wolf({ id: "closer", x: 10 });
    const scene = touchScene({
      enemyTarget: locked,
      enemyManager: { getAlive: () => [closer, locked] }
    });

    scene.updateAutoTarget();

    expect(scene.autoTarget.target).toBe(locked);
  });

  it("drops the ring and the target when nothing is left", () => {
    const scene = touchScene({ enemyTarget: wolf({ isDead: true }) });

    scene.updateAutoTarget();

    expect(scene.autoTarget).toBeNull();
    expect(scene.autoTargetRing.hide).toHaveBeenCalled();
  });

  it("shows nothing when the layout has a cursor", () => {
    const scene = touchScene({ autoTargetEnabled: false, enemyManager: { getAlive: () => [wolf()] } });

    scene.updateAutoTarget();

    expect(scene.autoTarget).toBeNull();
    expect(scene.autoTargetRing.show).not.toHaveBeenCalled();
  });

  it("aims a cast at the auto-target on touch", () => {
    const target = wolf();
    const scene = touchScene({ autoTarget: { target, kind: "monster" } });

    expect(scene.castAimPoint()).toEqual({ x: 100, y: 0 });
  });

  it("aims a cast nowhere when touch has no target", () => {
    expect(touchScene().castAimPoint()).toBeNull();
  });

  it("keeps the pointer aim on desktop", () => {
    const scene = touchScene({
      autoTargetEnabled: false,
      input: { activePointer: { worldX: 42, worldY: 24 } }
    });

    expect(scene.castAimPoint()).toEqual({ x: 42, y: 24 });
  });

  it("commits an attack to the ringed monster", () => {
    const target = wolf();
    const scene = touchScene({
      autoTarget: { target, kind: "monster" },
      pvpTarget: rival()
    });

    expect(scene.focusAutoTarget()).toBe(true);
    expect(scene.enemyTarget).toBe(target);
    expect(scene.pvpTarget).toBeNull();
    expect(scene.updateEnemyTarget).toHaveBeenCalledTimes(1);
  });

  it("commits an attack to the ringed rival only while PK is on", () => {
    const target = rival();
    const peaceful = touchScene({ autoTarget: { target, kind: "player" } });

    expect(peaceful.focusAutoTarget()).toBe(false);
    expect(peaceful.pvpTarget).toBeNull();
    expect(peaceful.updatePvpTarget).not.toHaveBeenCalled();

    const duellist = touchScene({
      autoTarget: { target, kind: "player" },
      player: { x: 0, y: 0, pkFlag: true }
    });

    expect(duellist.focusAutoTarget()).toBe(true);
    expect(duellist.pvpTarget).toBe(target);
    expect(duellist.enemyTarget).toBeNull();
    expect(duellist.updatePvpTarget).toHaveBeenCalledTimes(1);
  });

  it("falls through when there is nothing ringed", () => {
    expect(touchScene().focusAutoTarget()).toBe(false);
  });
});
