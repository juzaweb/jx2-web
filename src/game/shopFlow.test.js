import { afterEach, describe, expect, it, vi } from "vitest";
import { bridge, EVENTS } from "./bridge.js";
import { getQuantity, setQuantities } from "./items.js";
import { ShopFlow } from "./shopFlow.js";

const POTION = "kim-sang-duoc";

const makeFlow = ({ coins = 20, connected = true } = {}) => {
  const logs = [];
  const results = [];
  const sent = [];
  const offResult = bridge.on(EVENTS.SHOP_RESULT, (payload) => results.push(payload));
  const networkClient = {
    isConnected: connected,
    sendShopBuy(purchase) {
      sent.push(purchase);
    }
  };
  const uiBridge = {
    addLog: (message, type) => logs.push({ message, type }),
    updateInventory: vi.fn()
  };
  const saveGame = vi.fn();
  const flow = new ShopFlow({
    player: { stats: { coins } },
    uiBridge,
    networkClient,
    saveGame
  });
  return {
    flow,
    logs,
    results,
    sent,
    uiBridge,
    saveGame,
    cleanup() {
      offResult();
      flow.destroy();
    }
  };
};

afterEach(() => {
  setQuantities({});
});

describe("ShopFlow", () => {
  it("refuses to trade without a server connection", () => {
    const ctx = makeFlow({ connected: false });
    const before = getQuantity(POTION);

    ctx.flow.buy(POTION, 1);

    expect(ctx.sent).toHaveLength(0);
    expect(getQuantity(POTION)).toBe(before);
    expect(ctx.results.at(-1)).toMatchObject({ ok: false, reason: "offline" });
    expect(ctx.logs.at(-1).message).toContain("kết nối máy chủ");
    ctx.cleanup();
  });

  it("sends one request and ignores duplicates while it is in flight", () => {
    const ctx = makeFlow();
    ctx.flow.buy(POTION, 1);
    ctx.flow.buy(POTION, 1);

    expect(ctx.sent).toEqual([{ itemId: POTION, qty: 1 }]);
    ctx.cleanup();
  });

  it("adds the item only after the server confirms the purchase", () => {
    const ctx = makeFlow();
    const before = getQuantity(POTION);

    ctx.flow.handleResult({ ok: true, itemId: POTION, qty: 2, total: 16, coins: 4 });

    expect(getQuantity(POTION)).toBe(before + 2);
    expect(ctx.uiBridge.updateInventory).toHaveBeenCalledTimes(1);
    expect(ctx.saveGame).toHaveBeenCalledWith(false);
    expect(ctx.results.at(-1)).toMatchObject({ ok: true, qty: 2 });
    ctx.cleanup();
  });

  it("does not mint a success packet for an item outside the stock", () => {
    const ctx = makeFlow();
    const before = getQuantity("thiet-trao");

    ctx.flow.handleResult({ ok: true, itemId: "thiet-trao", qty: 1, coins: 20 });

    expect(getQuantity("thiet-trao")).toBe(before);
    expect(ctx.results.at(-1)).toMatchObject({ ok: false, reason: "unknown" });
    ctx.cleanup();
  });

  it("surfaces refusal reasons without changing the bag", () => {
    const ctx = makeFlow();
    const before = getQuantity(POTION);

    ctx.flow.handleResult({ ok: false, itemId: POTION, qty: 1, reason: "coins" });

    expect(getQuantity(POTION)).toBe(before);
    expect(ctx.logs.at(-1).message).toContain("Không đủ bạc");
    expect(ctx.results.at(-1)).toMatchObject({ ok: false, reason: "coins" });
    ctx.cleanup();
  });
});
