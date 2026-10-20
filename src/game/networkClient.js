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
    this.pingTimer = null;
    this.savedPlayerData = null;
    this.shouldReconnect = true;
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

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isReconnecting = false;
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

      this.ws.onclose = () => {
        this.handleClose();
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
   * Parse incoming raw message data and emit typed event
   * @param {string} rawData
   */
  handleRawMessage(rawData) {
    try {
      const msg = JSON.parse(rawData);
      if (msg && msg.type) {
        this.emit(msg.type, msg.payload);
      }
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
   * Report the worn equipment slots so peers can redraw the player's rig.
   * @param {Record<string, string|null>} equipment
   */
  sendEquipment(equipment) {
    this.send("player_equipment", { equipment });
  }

  /**
   * Report the parts of the player block the client still owns (defense). Level,
   * the HP ceiling and current HP are all server-owned now.
   * @param {{defense:number}} statsData
   */
  sendStats(statsData) {
    this.send("player_stats", statsData);
  }

  /**
   * Ask the server to pay the one-off quest reward. The server is the payout
   * authority and ignores repeat claims.
   */
  sendQuestClaim() {
    this.send("quest_claim", {});
  }

  /**
   * Request a heal (potion, level-up). The server clamps it to the HP ceiling.
   * @param {{amount:number}} healData
   */
  sendHeal(healData) {
    this.send("player_heal", healData);
  }

  /**
   * Request an MP restore (potion, pickup). The server clamps it to the MP ceiling.
   * @param {{amount:number}} restoreData
   */
  sendRestoreMp(restoreData) {
    this.send("player_restore_mp", restoreData);
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
   * Report a PvP hit on another player
   * @param {{targetId:string, damage:number}} hitData
   */
  sendPlayerHit(hitData) {
    this.send("player_hit", hitData);
  }

  /**
   * Report damage dealt to an enemy
   * @param {Object} hitData
   */
  sendEnemyHit(hitData) {
    this.send("enemy_hit", hitData);
  }

  /**
   * Send chat message
   * @param {Object} chatData
   */
  sendChat(chatData) {
    this.send("player_chat", chatData);
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

  handleClose() {
    this.isConnected = false;
    this.stopPing();
    this.emit("disconnected");

    if (this.shouldReconnect && !this.reconnectTimer) {
      this.isReconnecting = true;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
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
    this.shouldReconnect = false;
    this.savedPlayerData = null;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }
}
