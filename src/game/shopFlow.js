/**
 * Client-side shop flow: opening the NPC counter, asking the server to buy, and
 * mirroring the authoritative result into the local bag.
 *
 * Everything that decides value (price, silver, stock) lives on the server. This
 * module deliberately has no offline path: local silver must never buy items,
 * because the bag is later synchronised to the server and a client-edited save
 * would mint free equipment.
 */
import { bridge, EVENTS } from "./bridge.js";
import { addQuantity, getItemById } from "./items.js";
import { shopPurchase } from "./shop.js";

const PENDING_TIMEOUT_MS = 5000;

const FAILURE_MESSAGES = {
  coins: "Không đủ bạc để mua dược phẩm này.",
  guest: "Cần đăng nhập và chọn nhân vật để giao dịch.",
  offline: "Cần kết nối máy chủ để giao dịch.",
  range: "Hãy đến gần chủ tiệm để giao dịch.",
  error: "Máy chủ không thể hoàn tất giao dịch. Bạc chưa bị trừ.",
  unknown: "Tiệm không bán vật phẩm này."
};

export class ShopFlow {
  /**
   * @param {{player: object, uiBridge: object, networkClient: ?object,
   *   saveGame?: (showFeedback?: boolean) => void}} deps
   */
  constructor({ player, uiBridge, networkClient, saveGame = () => {} }) {
    this.player = player;
    this.uiBridge = uiBridge;
    this.networkClient = networkClient;
    this.saveGame = saveGame;
    /** True while a request is in flight, so one click cannot spend twice. */
    this.pending = false;
    this.pendingTimer = null;
  }

  /**
   * Announce that the hero is talking to a shop NPC. React owns the modal.
   * @param {{id:string, name:string}} npc
   */
  open(npc) {
    if (!npc) return;
    this.uiBridge.addLog(`${npc.name}: Hiệp khách cần dược phẩm gì cứ nói.`, "near");
    bridge.emit(EVENTS.SHOP_OPENED, { npcId: npc.id, name: npc.name });
  }

  /**
   * Ask the server to buy one item. Refused locally when the socket is down:
   * there is no trusted ledger to debit without it.
   * @param {string} itemId
   * @param {number} [qty=1]
   */
  buy(itemId, qty = 1) {
    const purchase = shopPurchase(itemId, qty);
    if (!purchase || !this.player || this.pending) return;

    if (!this.networkClient?.isConnected) {
      this.fail({ itemId: purchase.item.id, qty: purchase.qty, reason: "offline" });
      return;
    }

    this.pending = true;
    clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      this.pending = false;
    }, PENDING_TIMEOUT_MS);
    this.networkClient.sendShopBuy({ itemId: purchase.item.id, qty: purchase.qty });
  }

  /**
   * Apply the server's verdict. On success the server has already debited
   * silver and stored the item; only the local bag/HUD need updating.
   * @param {{ok?:boolean, itemId?:string, qty?:number, total?:number, coins?:number, reason?:string}} payload
   */
  handleResult(payload = {}) {
    this.pending = false;
    clearTimeout(this.pendingTimer);

    if (!payload.ok) {
      this.fail(payload);
      return;
    }

    // Never trust a success packet blindly: only catalog stock may enter the bag.
    const purchase = shopPurchase(payload.itemId, payload.qty);
    if (!purchase) {
      this.fail({ ...payload, ok: false, reason: "unknown" });
      return;
    }

    addQuantity(purchase.item.id, purchase.qty);
    this.uiBridge.updateInventory();
    this.saveGame(false);

    const item = getItemById(purchase.item.id);
    this.uiBridge.addLog(
      `Đã mua ${purchase.qty} ${item?.name || purchase.item.id} (−${payload.total ?? purchase.total} bạc).`,
      "system"
    );
    bridge.emit(EVENTS.SHOP_RESULT, {
      ...payload,
      ok: true,
      itemId: purchase.item.id,
      qty: purchase.qty
    });
  }

  /** Clear the in-flight timer when the scene is torn down. */
  destroy() {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pending = false;
  }

  /**
   * Emit a refused result and log the matching Vietnamese guidance line.
   * @param {{itemId?:string, qty?:number, reason?:string}} payload
   */
  fail(payload = {}) {
    const reason = payload.reason || "unknown";
    const message = FAILURE_MESSAGES[reason] || "Giao dịch không thành công.";
    this.uiBridge.addLog(message, "guide");
    bridge.emit(EVENTS.SHOP_RESULT, { ...payload, ok: false, reason, message });
  }
}
