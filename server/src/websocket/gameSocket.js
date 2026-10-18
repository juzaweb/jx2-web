import { WebSocketServer, WebSocket } from "ws";
import { rollEnemyReward } from "../rewards.js";
import { stepEnemy } from "../enemyAi.js";

/**
 * Clean sanitization for player strings
 * @param {string} val
 * @param {number} maxLen
 * @returns {string}
 */
const sanitizeStr = (val, maxLen = 32) => {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
};

/**
 * Validate and clamp numeric coordinates
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
const clampNum = (val, min, max, fallback) => {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.min(Math.max(val, min), max);
};

/** World bounds shared with the client scene (see src/game/world.js). */
const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1250;

/** Enemy tuning mirroring the client's Wolf entity. */
export const ENEMY_MAX_HP = 45;
export const ENEMY_RESPAWN_MS = 10000;
/** Server AI tick (10 Hz): fast enough to look continuous, cheap enough to share. */
export const ENEMY_TICK_MS = 100;

/** Spawn points match EnemyManager.create() in src/game/enemy.js, ids are indices. */
const ENEMY_SPAWNS = [
  [840, 600],
  [950, 670],
  [1110, 590],
  [1260, 650],
  [1380, 590],
  [760, 800],
  [1050, 820],
  [1320, 790]
];

/**
 * Build the authoritative enemy roster.
 * @returns {Array<Object>}
 */
export const createEnemyState = () =>
  ENEMY_SPAWNS.map(([x, y], id) => ({
    id,
    x,
    y,
    homeX: x,
    homeY: y,
    hp: ENEMY_MAX_HP,
    maxHp: ENEMY_MAX_HP,
    isDead: false
  }));

export class GameSocketManager {
  /**
   * @param {import("http").Server} httpServer
   * @param {Object} [options]
   */
  constructor(httpServer, options = {}) {
    this.path = options.path || "/ws";
    this.wss = new WebSocketServer({ server: httpServer, path: this.path });
    this.players = new Map(); // key: socket, value: player object
    this.playerById = new Map(); // key: playerId, value: { socket, data }

    // Server-owned enemy state: position, health, movement and respawn are shared
    this.enemies = new Map(createEnemyState().map((enemy) => [enemy.id, enemy]));
    this.enemyRespawnMs = clampNum(options.enemyRespawnMs, 50, 600000, ENEMY_RESPAWN_MS);
    this.enemyRespawnTimers = new Map(); // key: enemy id, value: timeout
    this.enemyTickMs = clampNum(options.enemyTickMs, 10, 1000, ENEMY_TICK_MS);

    this.setupServer();
    this.startHeartbeat();
    this.startEnemyTick();
  }

  setupServer() {
    this.wss.on("connection", (ws, req) => {
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(ws, msg);
        } catch {
          // Ignore malformed JSON packets
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(ws);
      });

      ws.on("error", (err) => {
        if (process.env.NODE_ENV !== "test") {
          console.error("[WebSocket] Client socket error:", err.message);
        }
        this.handleDisconnect(ws);
      });
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          this.handleDisconnect(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Send JSON message to a single socket
   * @param {WebSocket} ws
   * @param {Object} data
   */
  send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast message to all connected clients except sender
   * @param {WebSocket|null} senderWs
   * @param {Object} data
   */
  broadcast(senderWs, data) {
    const payload = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client !== senderWs && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} data
   */
  broadcastAll(data) {
    this.broadcast(null, data);
  }

  /**
   * Handle incoming message from a client
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleMessage(ws, msg) {
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "player_join":
        this.handlePlayerJoin(ws, msg.payload);
        break;

      case "player_move":
        this.handlePlayerMove(ws, msg.payload);
        break;

      case "player_attack":
        this.handlePlayerAttack(ws, msg.payload);
        break;

      case "player_chat":
        this.handlePlayerChat(ws, msg.payload);
        break;

      case "enemy_hit":
        this.handleEnemyHit(ws, msg.payload);
        break;

      case "ping":
        this.send(ws, { type: "pong", time: Date.now() });
        break;

      default:
        break;
    }
  }

  /**
   * Player joins the online map
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerJoin(ws, payload = {}) {
    const playerId = sanitizeStr(payload.id || `guest_${Math.random().toString(36).slice(2, 9)}`, 64);
    const username = sanitizeStr(payload.username || "Lãng Khách", 32);
    const displayName = sanitizeStr(payload.displayName || username, 32);

    // If this player ID was already connected from an old socket, remove old one
    if (this.playerById.has(playerId)) {
      const existing = this.playerById.get(playerId);
      if (existing.ws !== ws) {
        try {
          existing.ws.close();
        } catch {
          // ignore
        }
        this.players.delete(existing.ws);
      }
    }

    const playerData = {
      id: playerId,
      username,
      displayName,
      x: clampNum(payload.x, 0, 2200, 640),
      y: clampNum(payload.y, 0, 1250, 620),
      vx: clampNum(payload.vx, -500, 500, 0),
      vy: clampNum(payload.vy, -500, 500, 0),
      direction: payload.direction === "left" ? "left" : "right",
      stance: payload.stance === "side" ? "side" : "front",
      level: clampNum(payload.level, 1, 150, 1),
      hp: clampNum(payload.hp, 0, 9999, 100),
      maxHp: clampNum(payload.maxHp, 1, 9999, 100)
    };

    this.players.set(ws, playerData);
    this.playerById.set(playerId, { ws, data: playerData });

    // 1. Send all existing players on the map to the joining player
    const existingPlayers = [];
    this.players.forEach((p, clientWs) => {
      if (clientWs !== ws) {
        existingPlayers.push(p);
      }
    });

    this.send(ws, {
      type: "init_world",
      payload: {
        yourId: playerId,
        players: existingPlayers,
        enemies: this.getEnemyState()
      }
    });

    // 2. Announce the new player to everyone else in the world
    this.broadcast(ws, {
      type: "player_joined",
      payload: { player: playerData }
    });
  }

  /**
   * Player coordinates / velocity update
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerMove(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    player.x = clampNum(payload.x, 0, 2200, player.x);
    player.y = clampNum(payload.y, 0, 1250, player.y);
    player.vx = clampNum(payload.vx, -500, 500, 0);
    player.vy = clampNum(payload.vy, -500, 500, 0);
    if (payload.direction) {
      player.direction = payload.direction === "left" ? "left" : "right";
    }
    if (payload.stance) {
      player.stance = payload.stance === "side" ? "side" : "front";
    }

    // Broadcast position update to all other connected players
    this.broadcast(ws, {
      type: "player_moved",
      payload: {
        id: player.id,
        x: player.x,
        y: player.y,
        vx: player.vx,
        vy: player.vy,
        direction: player.direction,
        stance: player.stance
      }
    });
  }

  /**
   * Player triggers attack / skill animation
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerAttack(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const skill = payload.skill === "kiem_khi" ? "kiem_khi" : "normal";
    const x = clampNum(payload.x, 0, 2200, player.x);
    const y = clampNum(payload.y, 0, 1250, player.y);
    const facingRight = payload.facingRight !== false;

    this.broadcast(ws, {
      type: "player_attacked",
      payload: {
        id: player.id,
        skill,
        x,
        y,
        facingRight
      }
    });
  }

  /**
   * Player sends public or nearby chat message
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerChat(ws, payload = {}) {
    const player = this.players.get(ws);
    const text = sanitizeStr(payload.text || "", 120);
    if (!text) return;

    const senderName = player?.displayName || player?.username || sanitizeStr(payload.sender || "Lãng Khách", 32);
    const channel = payload.channel === "near" ? "near" : "world";

    this.broadcastAll({
      type: "player_chat",
      payload: {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: senderName,
        senderId: player?.id,
        text,
        channel,
        time: Date.now()
      }
    });
  }

  /**
   * Public shape of one enemy, safe to send over the wire.
   * @param {Object} enemy
   * @returns {Object}
   */
  enemySnapshot(enemy) {
    return {
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      homeX: enemy.homeX,
      homeY: enemy.homeY,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      isDead: enemy.isDead
    };
  }

  /**
   * Report the current enemy roster: position, health and dead flag.
   * @returns {Array<Object>}
   */
  getEnemyState() {
    return Array.from(this.enemies.values()).map((enemy) => this.enemySnapshot(enemy));
  }

  /**
   * Apply damage from a client and broadcast the authoritative enemy health.
   * The killing blow also triggers the authoritative reward broadcast.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handleEnemyHit(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const enemy = this.enemies.get(payload.id);
    if (!enemy) return;

    if (typeof payload.damage !== "number" || !Number.isFinite(payload.damage) || payload.damage <= 0) return;
    const damage = Math.round(Math.min(payload.damage, 200));

    // Already dead on the server: resync the hitter instead of applying damage twice
    if (enemy.isDead) {
      this.send(ws, { type: "enemy_hit", payload: { ...this.enemySnapshot(enemy), damage: 0 } });
      return;
    }

    enemy.x = clampNum(payload.x, 0, WORLD_WIDTH, enemy.x);
    enemy.y = clampNum(payload.y, 0, WORLD_HEIGHT, enemy.y);
    enemy.hp = Math.max(0, enemy.hp - damage);

    const killed = enemy.hp <= 0;
    if (killed) {
      enemy.isDead = true;
      this.scheduleEnemyRespawn(enemy.id);
    }

    this.broadcastAll({
      type: "enemy_hit",
      payload: {
        ...this.enemySnapshot(enemy),
        damage,
        attackerId: player.id
      }
    });

    if (killed) {
      // Rolled from the server's own health pool and attributed to the killing
      // blow, so the client that landed it cannot mint its own payout
      this.broadcastAll({
        type: "enemy_reward",
        payload: rollEnemyReward(player.id, enemy)
      });
    }
  }

  /**
   * Advance the enemy AI on a fixed tick so every client renders the same
   * monsters in the same place, whoever happens to be nearby.
   */
  startEnemyTick() {
    this.enemyTickTimer = setInterval(() => this.tickEnemies(), this.enemyTickMs);
    if (this.enemyTickTimer.unref) this.enemyTickTimer.unref();
  }

  /**
   * Step every living enemy once and broadcast only the ones that actually moved.
   * A wolf at rest (walked home or holding at its stop distance) produces no
   * traffic, so an idle map stays quiet.
   */
  tickEnemies() {
    if (!this.wss.clients.size) return;

    const players = Array.from(this.players.values());
    const moved = [];

    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;

      const next = stepEnemy(enemy, players, this.enemyTickMs);
      const x = clampNum(next.x, 0, WORLD_WIDTH, enemy.x);
      const y = clampNum(next.y, 0, WORLD_HEIGHT, enemy.y);
      if (x === enemy.x && y === enemy.y) return;

      enemy.x = x;
      enemy.y = y;
      moved.push({ id: enemy.id, x, y });
    });

    if (moved.length) {
      this.broadcastAll({ type: "enemy_moved", payload: { enemies: moved } });
    }
  }

  /**
   * Queue the authoritative respawn for a defeated enemy.
   * @param {number} enemyId
   */
  scheduleEnemyRespawn(enemyId) {
    const existing = this.enemyRespawnTimers.get(enemyId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => this.respawnEnemy(enemyId), this.enemyRespawnMs);
    if (timer.unref) timer.unref();
    this.enemyRespawnTimers.set(enemyId, timer);
  }

  /**
   * Restore a defeated enemy and tell every client at once.
   * @param {number} enemyId
   */
  respawnEnemy(enemyId) {
    this.enemyRespawnTimers.delete(enemyId);

    const enemy = this.enemies.get(enemyId);
    if (!enemy || !enemy.isDead) return;

    enemy.hp = enemy.maxHp;
    enemy.x = enemy.homeX;
    enemy.y = enemy.homeY;
    enemy.isDead = false;

    this.broadcastAll({
      type: "enemy_respawned",
      payload: this.enemySnapshot(enemy)
    });
  }

  /**
   * Handle player disconnect
   * @param {WebSocket} ws
   */
  handleDisconnect(ws) {
    const player = this.players.get(ws);
    if (player) {
      this.players.delete(ws);
      this.playerById.delete(player.id);

      // Notify other players that this player has left the map
      this.broadcast(ws, {
        type: "player_left",
        payload: { id: player.id }
      });
    }
  }

  /**
   * Get all currently online players
   * @returns {Array<Object>}
   */
  getConnectedPlayers() {
    return Array.from(this.players.values());
  }

  /**
   * Cleanly close WebSocket server
   */
  close() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.enemyTickTimer) {
      clearInterval(this.enemyTickTimer);
    }
    this.enemyRespawnTimers.forEach((timer) => clearTimeout(timer));
    this.enemyRespawnTimers.clear();
    this.players.clear();
    this.playerById.clear();
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        try {
          client.terminate();
        } catch {
          // ignore
        }
      });
      this.wss.close();
    }
  }
}

/**
 * Helper to initialize and bind GameSocketManager to an HTTP server
 * @param {import("http").Server} server
 * @param {Object} [options]
 * @returns {GameSocketManager}
 */
export const initGameSocket = (server, options) => {
  return new GameSocketManager(server, options);
};
