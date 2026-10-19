import { WebSocketServer, WebSocket } from "ws";
import { rollEnemyReward } from "../rewards.js";
import { stepEnemy, WOLF_COMBAT, BITE_TUNING } from "../../../src/game/enemyAi.js";
import { canPvpAttack, clampPvpDamage } from "../../../src/game/pvp.js";
import { computeDamage } from "../../../src/game/damage.js";
import { WORLD_CONFIG } from "../../../src/game/worldConfig.js";

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

/** Equipment slots the client renders (see src/game/equipment.js). */
const EQUIPMENT_SLOTS = ["boots", "armor", "helmet", "accessory", "weapon"];

/**
 * Reduce a client-reported equipment map to the known slots with short string
 * ids (or null). Peers only render *which* slots are filled, so the id is opaque
 * and only its presence matters.
 * @param {Object} val
 * @returns {Record<string, string|null>}
 */
const sanitizeEquipment = (val) => {
  const out = {};
  if (!val || typeof val !== "object") return out;
  for (const slot of EQUIPMENT_SLOTS) {
    const id = val[slot];
    out[slot] = typeof id === "string" && id.length > 0 ? id.slice(0, 64) : null;
  }
  return out;
};

/** World bounds shared with the client (see src/game/worldConfig.js). */
const WORLD_WIDTH = WORLD_CONFIG.width;
const WORLD_HEIGHT = WORLD_CONFIG.height;

/** Enemy tuning mirroring the client's Wolf entity. */
export const ENEMY_MAX_HP = 45;
export const ENEMY_RESPAWN_MS = 10000;
/** Server AI tick (10 Hz): fast enough to look continuous, cheap enough to share. */
export const ENEMY_TICK_MS = 100;

/** Invulnerability window (ms) granted after any hit the server applies. */
export const PLAYER_IFRAME_MS = 700;

/** Respawn point, mirroring Player.respawn() / the client's Biện Kinh spawn. */
export const PLAYER_SPAWN = { x: 6400, y: 6200 };

/** Spawn points match EnemyManager.create() in src/game/enemy.js, ids are indices. */
const ENEMY_SPAWNS = [
  [8400, 6000],
  [9500, 6700],
  [11100, 5900],
  [12600, 6500],
  [13800, 5900],
  [7600, 8000],
  [10500, 8200],
  [13200, 7900]
];

/**
 * Build the authoritative enemy roster.
 * @param {Array<[number, number]>} [spawns]
 * @returns {Array<Object>}
 */
export const createEnemyState = (spawns = ENEMY_SPAWNS) =>
  spawns.map(([x, y], id) => ({
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
    const spawns = options.enemySpawns ?? (options.enemyRespawnMs ? ENEMY_SPAWNS : []);
    this.enemies = new Map(createEnemyState(spawns).map((enemy) => [enemy.id, enemy]));
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

      case "player_equipment":
        this.handlePlayerEquipment(ws, msg.payload);
        break;

      case "player_stats":
        this.handlePlayerStats(ws, msg.payload);
        break;

      case "player_heal":
        this.handlePlayerHeal(ws, msg.payload);
        break;

      case "player_attack":
        this.handlePlayerAttack(ws, msg.payload);
        break;

      case "player_chat":
        this.handlePlayerChat(ws, msg.payload);
        break;

      case "player_pk":
        this.handlePlayerPk(ws, msg.payload);
        break;

      case "player_hit":
        this.handlePlayerHit(ws, msg.payload);
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
      x: clampNum(payload.x, 0, WORLD_WIDTH, 640),
      y: clampNum(payload.y, 0, WORLD_HEIGHT, 620),
      vx: clampNum(payload.vx, -500, 500, 0),
      vy: clampNum(payload.vy, -500, 500, 0),
      direction: payload.direction === "left" ? "left" : "right",
      stance: payload.stance === "side" ? "side" : "front",
      equipment: sanitizeEquipment(payload.equipment),
      level: clampNum(payload.level, 1, 150, 1),
      // Server-authoritative health. The join snapshot seeds it; every later
      // change is driven by the server (bite, PvP hit, heal), never by a raw
      // client HP report.
      maxHp: clampNum(payload.maxHp, 1, 9999, 100),
      hp: 0,
      // Reported purely so the server can roll wolf bites against it.
      defense: clampNum(payload.defense, 0, 9999, 6),
      pkFlag: payload.pkFlag === true,
      invulnerableUntil: 0,
      nextBiteAt: 0
    };

    playerData.hp = clampNum(payload.hp, 0, playerData.maxHp, playerData.maxHp);

    this.players.set(ws, playerData);
    this.playerById.set(playerId, { ws, data: playerData });

    // 1. Send all existing players on the map to the joining player
    const existingPlayers = [];
    this.players.forEach((p, clientWs) => {
      if (clientWs !== ws) {
        existingPlayers.push(this.playerSnapshot(p));
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
      payload: { player: this.playerSnapshot(playerData) }
    });
  }

  /**
   * Public shape of one player, safe to send over the wire. Keeps the internal
   * timers (immunity/bite) and combat tuning (defense) off the wire.
   * @param {Object} player
   * @returns {Object}
   */
  playerSnapshot(player) {
    return {
      id: player.id,
      username: player.username,
      displayName: player.displayName,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      direction: player.direction,
      stance: player.stance,
      equipment: player.equipment,
      level: player.level,
      hp: player.hp,
      maxHp: player.maxHp,
      pkFlag: player.pkFlag === true
    };
  }

  /**
   * Player coordinates / velocity update
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerMove(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    player.x = clampNum(payload.x, 0, WORLD_WIDTH, player.x);
    player.y = clampNum(payload.y, 0, WORLD_HEIGHT, player.y);
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
   * Relay a change to the slots a player is wearing so peers can redraw their
   * rig. The reported map is sanitized to known slots; the sender already knows
   * its own gear, so it is only broadcast to everyone else.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerEquipment(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    player.equipment = sanitizeEquipment(payload.equipment);

    this.broadcast(ws, {
      type: "player_equipment",
      payload: { id: player.id, equipment: player.equipment }
    });
  }

  /**
   * Update the parts of a player's block the server trusts the client to own: the
   * HP ceiling (grows on level-up) and defense (used for wolf bites). The current
   * HP itself is never taken from the client — only the server changes it.
   * A level-up (a higher maxHp) heals the player to full, matching the client.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerStats(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const maxHp = clampNum(payload.maxHp, 1, 9999, player.maxHp);
    const grew = maxHp > player.maxHp;
    player.maxHp = maxHp;
    player.defense = clampNum(payload.defense, 0, 9999, player.defense);

    if (grew) {
      player.hp = player.maxHp;
    } else if (player.hp > player.maxHp) {
      player.hp = player.maxHp;
    }

    this.broadcastAll({
      type: "player_hp",
      payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
    });
  }

  /**
   * Apply a heal the client requested (potion, level-up, etc.). The server clamps
   * it to the ceiling, so a client can never heal past its own maxHp.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerHeal(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const amount = clampNum(payload.amount, 0, 9999, 0);
    if (amount <= 0) return;

    player.hp = Math.min(player.maxHp, player.hp + amount);

    this.broadcastAll({
      type: "player_hp",
      payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
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
    const x = clampNum(payload.x, 0, WORLD_WIDTH, player.x);
    const y = clampNum(payload.y, 0, WORLD_HEIGHT, player.y);
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
   * Toggle a player's PK flag. Only flagged players may fight or be fought, so the
   * flag is broadcast to everyone (peers render it and gate their own attacks).
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerPk(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    player.pkFlag = payload.pkFlag === true;

    this.broadcastAll({
      type: "player_pk",
      payload: { id: player.id, pkFlag: player.pkFlag }
    });
  }

  /**
   * Apply an authoritative PvP hit. The client reports the damage number, but the
   * server clamps it, checks flags/range/immunity, and applies it to the target's
   * own HP. The resulting HP is broadcast, so no client can decide its own health.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerHit(ws, payload = {}) {
    const attacker = this.players.get(ws);
    if (!attacker) return;

    const targetEntry = this.playerById.get(payload.targetId);
    const target = targetEntry?.data;
    if (!target) return;

    const damage = clampPvpDamage(payload.damage);
    if (damage === null) return;

    const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);
    if (!canPvpAttack(attacker, target, distance)) return;

    this.applyPlayerDamage(target, damage, attacker, "pvp");
  }

  /**
   * Deal server-authoritative damage to a player, broadcast the new HP and, when
   * it drops to zero, respawn them. Immunity and death are decided here, not by
   * any client.
   * @param {Object} target - server player object
   * @param {number} damage
   * @param {?Object} attacker - server player object that caused it
   * @param {"pvp"|"wolf"} source
   * @returns {boolean} whether the hit landed
   */
  applyPlayerDamage(target, damage, attacker = null, source = "wolf") {
    const now = Date.now();
    if (now < target.invulnerableUntil) return false;

    target.hp = Math.max(0, target.hp - damage);
    target.invulnerableUntil = now + PLAYER_IFRAME_MS;

    this.broadcastAll({
      type: "player_hp",
      payload: {
        id: target.id,
        hp: target.hp,
        maxHp: target.maxHp,
        damage,
        source,
        sourceName: source === "wolf" ? "Sói Xám" : attacker ? attacker.displayName || attacker.username : "Đối thủ"
      }
    });

    if (target.hp <= 0) {
      this.respawnPlayer(target, attacker, source);
    }
    return true;
  }

  /**
   * Respawn a defeated player at the fixed Biện Kinh point with full health and
   * announce the defeat. Attacker credit (when any) rides on the broadcast.
   * @param {Object} victim - server player object
   * @param {?Object} attacker
   * @param {"pvp"|"wolf"} source
   */
  respawnPlayer(victim, attacker = null, source = "wolf") {
    victim.hp = victim.maxHp;
    victim.x = PLAYER_SPAWN.x;
    victim.y = PLAYER_SPAWN.y;
    victim.invulnerableUntil = Date.now() + PLAYER_IFRAME_MS;

    this.broadcastAll({
      type: "player_defeated",
      payload: {
        victimId: victim.id,
        victimName: victim.displayName || victim.username,
        attackerId: attacker?.id || null,
        attackerName: attacker ? attacker.displayName || attacker.username : null,
        source,
        respawn: { ...PLAYER_SPAWN }
      }
    });

    this.broadcastAll({
      type: "player_hp",
      payload: { id: victim.id, hp: victim.hp, maxHp: victim.maxHp }
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

    // Position stays server-owned: a hit only applies damage, so a client cannot
    // drag the monster around the map by reporting the spot it rendered
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
    if (!this.enemies.size) return;
    this.enemyTickTimer = setInterval(() => this.tickEnemies(), this.enemyTickMs);
    if (this.enemyTickTimer.unref) this.enemyTickTimer.unref();
  }

  /**
   * Step every living enemy once and broadcast only the ones that actually moved.
   * Positions are stored and sent on a whole-pixel grid, so an enemy at rest
   * (walked home or holding at its stop distance) produces no traffic at all and
   * an idle map stays quiet.
   */
  tickEnemies() {
    if (!this.wss.clients.size || !this.enemies.size) return;

    const players = Array.from(this.players.values());
    const moved = [];

    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;

      const next = stepEnemy(enemy, players, this.enemyTickMs);
      const x = clampNum(Math.round(next.x), 0, WORLD_WIDTH, enemy.x);
      const y = clampNum(Math.round(next.y), 0, WORLD_HEIGHT, enemy.y);
      if (x === enemy.x && y === enemy.y) return;

      enemy.x = x;
      enemy.y = y;
      moved.push({ id: enemy.id, x, y });
    });

    if (moved.length) {
      this.broadcastAll({ type: "enemy_moved", payload: { enemies: moved } });
    }

    // Player health is server-owned, so the wolves bite on the server clock too.
    this.tickBites(players);
  }

  /**
   * Apply wolf bites to nearby players on the server tick. One bite per player per
   * cooldown (whichever wolf is closest), respecting the shared immunity window.
   * @param {Array<Object>} players
   */
  tickBites(players) {
    const now = Date.now();
    const wolves = Array.from(this.enemies.values()).filter((enemy) => !enemy.isDead);
    if (!wolves.length) return;

    players.forEach((player) => {
      if (now < player.nextBiteAt || now < player.invulnerableUntil) return;

      let nearest = null;
      let nearestDistance = Infinity;
      wolves.forEach((wolf) => {
        const distance = Math.hypot(wolf.x - player.x, wolf.y - player.y);
        if (distance < BITE_TUNING.range && distance < nearestDistance) {
          nearest = wolf;
          nearestDistance = distance;
        }
      });
      if (!nearest) return;

      player.nextBiteAt = now + BITE_TUNING.cooldownMs;

      const result = computeDamage(WOLF_COMBAT, { defense: player.defense }, Math.random);
      this.applyPlayerDamage(player, result.damage, null, "wolf");
    });
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

      // When all players have left the map, reset living enemies to their home positions
      if (this.players.size === 0) {
        this.enemies.forEach((enemy) => {
          if (!enemy.isDead) {
            enemy.x = enemy.homeX;
            enemy.y = enemy.homeY;
          }
        });
      }

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
