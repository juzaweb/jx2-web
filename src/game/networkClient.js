/**
 * Giang Ho Network Client
 * Handles real-time WebSocket connection to the backend multiplayer server.
 */

export const getWsUrl = () => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    const proto = isHttps ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }
  return "ws://localhost:5000/ws";
};

export class NetworkClient {
  constructor(url = getWsUrl()) {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.isReconnecting = false;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.connectTimer = null;
    this.pingTimer = null;
    this.savedPlayerData = null;
    this.shouldReconnect = true;
    /** Set when the server replaces this socket with the same character elsewhere. */
    this.superseded = false;
    /** Guards against emitting the superseded event twice (message + close code). */
    this.supersededNotified = false;
    this.reconnectAttempts = 0;
    /** A handshake that never completes (blocked network, sleeping tab) is aborted. */
    this.connectTimeoutMs = 10000;
    this.baseReconnectDelayMs = 1000;
    this.maxReconnectDelayMs = 30000;
  }

  /**
   * Subscribe to network events
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from network events
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  /**
   * Emit event internally to subscribers
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[NetworkClient] Error in handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (typeof window === "undefined" && typeof WebSocket === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.shouldReconnect = true;
    this.superseded = false;
    this.supersededNotified = false;

    try {
      this.ws = new WebSocket(this.url);
      this.startConnectTimeout();

      this.ws.onopen = () => {
        this.clearConnectTimeout();
        this.isConnected = true;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.emit("connected");

        // Start heartbeat ping
        this.startPing();

        // If we had previously joined with player data, re-send join packet
        if (this.savedPlayerData) {
          this.join(this.savedPlayerData);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleRawMessage(event.data);
      };

      this.ws.onclose = (event) => {
        this.handleClose(event);
      };

      this.ws.onerror = (err) => {
        // error will trigger onclose automatically
        this.emit("error", err);
      };
    } catch (err) {
      this.handleClose();
    }
  }

  /**
   * Abort a handshake that never opens. A dropped upgrade (firewall, mobile
   * network change, sleeping tab) can leave the socket stuck in CONNECTING
   * forever, and without this timeout `handleClose` is never called, so the
   * client would never retry.
   */
  startConnectTimeout() {
    this.clearConnectTimeout();
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      const ws = this.ws;
      if (!ws || ws.readyState === WebSocket.OPEN) return;
      // Detach first so the forced close cannot schedule a second reconnect.
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
      this.emit("error", new Error("WebSocket handshake timed out"));
      this.handleClose();
    }, this.connectTimeoutMs);
  }

  clearConnectTimeout() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  /**
   * Parse incoming raw message data and emit typed event
   * @param {string} rawData
   */
  handleRawMessage(rawData) {
    try {
      const msg = JSON.parse(rawData);
      if (!msg || !msg.type) return;

      // The same character joined from another device: reconnecting would just
      // kick that device and start a tug-of-war, so stop and let the UI ask the
      // player to log in again.
      if (msg.type === "session_superseded") {
        this.superseded = true;
        this.shouldReconnect = false;
        this.notifySuperseded(msg.payload);
      }

      this.emit(msg.type, msg.payload);
    } catch {
      // ignore malformed packets
    }
  }

  /**
   * Send JSON message over WebSocket
   * @param {string} type
   * @param {Object} [payload]
   */
  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  /**
   * Join the online game world
   * @param {Object} playerData
   */
  join(playerData) {
    this.savedPlayerData = playerData;
    this.send("player_join", playerData);
  }

  /**
   * Send coordinate update
   * @param {Object} moveData
   */
  sendMove(moveData) {
    this.send("player_move", moveData);
  }

  /**
   * Ask the server to consume one bag item (potion, return talisman). The effect,
   * the decrement and the resulting pools are all server-owned.
   * @param {string} itemId
   */
  useItem(itemId) {
    this.send("use_item", { itemId });
  }

  /**
   * Ask the server to equip one bag item.
   * @param {string} itemId
   */
  equipItem(itemId) {
    this.send("equip_item", { itemId });
  }

  /**
   * Ask the server to take off whatever is worn in `slot`.
   * @param {string} slot
   */
  unequipSlot(slot) {
    this.send("unequip_slot", { slot });
  }

  /**
   * Ask the server to raise one learned skill by a level. The price is
   * server-owned and the reply carries the authoritative level and progress.
   * @param {{skillId:string}} upgrade
   */
  sendSkillUpgrade(upgrade) {
    this.send("skill_upgrade", upgrade);
  }

  /**
   * Ask the server to pay the one-off quest reward. The server is the payout
   * authority and ignores repeat claims.
   */
  sendQuestClaim() {
    this.send("quest_claim", {});
  }

  /**
   * Ask the server to buy `qty` of a stocked item. The server validates the
   * price against its own ledger and only then debits silver.
   * @param {{itemId:string, qty?:number}} purchase
   */
  sendShopBuy(purchase) {
    this.send("shop_buy", purchase);
  }

  /**
   * Send attack / skill action
   * @param {Object} attackData
   */
  sendAttack(attackData) {
    this.send("player_attack", attackData);
  }

  /**
   * Toggle the local player's PK flag on the server
   * @param {{pkFlag:boolean}} pkData
   */
  sendPk(pkData) {
    this.send("player_pk", pkData);
  }

  /**
   * Report a PvP hit on another player. Damage is recomputed server-side.
   * @param {{targetId:string, skill?:string}} hitData
   */
  sendPlayerHit(hitData) {
    this.send("player_hit", hitData);
  }

  /**
   * Report a hit on an enemy. Damage is recomputed server-side.
   * @param {{id:number|string, skill?:string}} hitData
   */
  sendEnemyHit(hitData) {
    this.send("enemy_hit", hitData);
  }

  /**
   * Ask the server to move us through a portal. The server validates that the
   * portal belongs to the map we are standing on before accepting the move.
   * @param {{portalId:string}} changeData
   */
  sendMapChange(changeData) {
    this.send("map_change", changeData);
  }

  /**
   * Send chat message
   * @param {Object} chatData
   */
  sendChat(chatData) {
    this.send("player_chat", chatData);
  }

  /**
   * Send GM action request to authoritative server
   * @param {Object} gmData
   */
  sendGmAction(gmData) {
    this.send("gm_action", gmData);
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send("ping");
      }
    }, 25000);
  }

  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  handleClose(event) {
    this.clearConnectTimeout();
    this.isConnected = false;
    this.stopPing();

    // Close code 4001 is the server's "this character is now playing on another
    // socket". Never auto-reconnect in that case.
    if (event?.code === 4001) {
      this.superseded = true;
      this.shouldReconnect = false;
    }

    this.emit("disconnected", {
      code: event?.code,
      superseded: this.superseded
    });

    if (this.superseded) {
      this.notifySuperseded();
      return;
    }

    if (this.shouldReconnect && !this.reconnectTimer) {
      this.scheduleReconnect();
    }
  }

  /**
   * Announce that another socket took this character over, exactly once. The
   * server sends both a message and a close code; the UI only needs one.
   * @param {*} [payload]
   */
  notifySuperseded(payload) {
    if (this.supersededNotified) return;
    this.supersededNotified = true;
    this.emit("superseded", payload);
  }

  /**
   * Exponential backoff so a server that is down is not hammered every 3s, and a
   * client that keeps failing still retries for as long as the player waits.
   */
  scheduleReconnect() {
    this.isReconnecting = true;
    const delay = Math.min(
      this.maxReconnectDelayMs,
      this.baseReconnectDelayMs * 2 ** this.reconnectAttempts
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Force an immediate retry, ignoring any scheduled backoff. Wired to the
   * "Thử lại" action on the connection gate.
   */
  retryNow() {
    this.shouldReconnect = true;
    this.superseded = false;
    this.supersededNotified = false;
    this.reconnectAttempts = 0;
    this.clearConnectTimeout();
    this.clearReconnectTimer();
    this.closeSocket();
    this.connect();
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Cleanly disconnect and stop auto-reconnect. Terminal for this instance: the
   * handlers are dropped too, so a late `close` event or an in-flight packet can
   * never reach a scene that has already been torn down (entering the game again
   * builds a fresh client). Leaving them registered is how a dead scene ends up
   * logging into the live HUD — or touching destroyed Phaser objects.
   */
  disconnect() {
    this.suspend();
    this.listeners.clear();
  }

  /**
   * Stop the socket without tearing the client down, so the same instance can
   * `connect()` again for the next character. Used when the player leaves the
   * world (logout / re-login) — otherwise the old character stays in the world
   * and keeps auto-reconnecting behind the login screen. Listeners are kept.
   */
  suspend() {
    this.shouldReconnect = false;
    this.superseded = false;
    this.supersededNotified = false;
    this.savedPlayerData = null;
    this.stopPing();
    this.clearConnectTimeout();
    this.clearReconnectTimer();
    this.closeSocket();
    this.isConnected = false;
  }

  /**
   * Close the current socket after detaching its handlers, so a late `close`
   * cannot schedule a reconnect against the next socket.
   */
  closeSocket() {
    if (!this.ws) return;
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.onerror = null;
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
