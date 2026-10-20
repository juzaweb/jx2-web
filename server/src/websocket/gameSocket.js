import { WebSocketServer, WebSocket } from "ws";
import { rollEnemyReward } from "../rewards.js";
import { store } from "../data/playerDb.js";
import { characterDb } from "../data/characterDb.js";
import { userDb } from "../data/userDb.js";
import { verifySessionToken } from "../auth/session.js";
import { stepEnemy, WOLF_COMBAT, BITE_TUNING } from "../../../src/game/enemyAi.js";
import { canPvpAttack, clampPvpDamage } from "../../../src/game/pvp.js";
import { computeDamage } from "../../../src/game/damage.js";
import { WORLD_CONFIG } from "../../../src/game/worldConfig.js";
import { MARKET_SPAWN } from "../../../src/game/marketLayout.js";
import {
  applyReward,
  normalizeProgress,
  progressPayload,
  vitalsForLevel
} from "../../../src/game/progression.js";
import { skillById, skillMpCost, skillCooldown } from "../../../src/game/skills.js";
import { computeSkillDamage } from "../../../src/game/skillDamage.js";

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
const EQUIPMENT_SLOTS = ["armor", "helmet", "accessory", "weapon"];

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

/** Protocol bounds. The client also clamps the camera/player to the smaller
 *  market footprint in `src/game/marketLayout.js`. */
const WORLD_MIN_X = 0;
const WORLD_MIN_Y = 0;
const WORLD_MAX_X = WORLD_CONFIG.width;
const WORLD_MAX_Y = WORLD_CONFIG.height;

/** Enemy tuning mirroring the client's Wolf entity. */
export const ENEMY_MAX_HP = 45;
export const ENEMY_RESPAWN_MS = 10000;
/** Server AI tick (10 Hz): fast enough to look continuous, cheap enough to share. */
export const ENEMY_TICK_MS = 100;

/** Invulnerability window (ms) granted after any hit the server applies. */
export const PLAYER_IFRAME_MS = 700;

/**
 * Minimum gap (ms) between a player's combat actions. Each action fans out to
 * every client, so this caps amplification: a spamming client can't turn one
 * socket into thousands of broadcast messages. Matches the client's own ~330ms
 * attack cadence, so it never throttles legitimate play.
 */
export const ACTION_COOLDOWN_MS = 300;

/** How long after a cast its follow-up hit(s) stay authorized (an AoE may hit many). */
export const CAST_HIT_WINDOW_MS = 2000;

/** Maximum follow-up hit messages accepted from one cast (AoE headroom). */
export const MAX_HITS_PER_CAST = 8;

/** Drop broadcasts to a socket once it has this much unflushed data (backpressure). */
const MAX_BUFFERED_BYTES = 1_000_000;

/**
 * Area-of-interest radius (world px) for *streaming* events. Movement, combat and
 * HP/MP updates only reach players whose character is within this distance of the
 * event, turning the aggregate cost from O(N²) into O(N × neighbours). Identity
 * events (join/leave/snapshot) stay global so the roster and minimap are complete.
 */
export const AOI_RADIUS = 800;

/** Respawn point, mirroring Player.respawn() / the client's Biện Kinh spawn. */
export const PLAYER_SPAWN = { ...MARKET_SPAWN };

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

    // Identity is proven by the session token, and the character must belong to
    // that account. Both are injectable so tests can supply their own authority.
    this.verifyToken = options.verifyToken || verifySessionToken;
    this.ownsCharacter =
      options.ownsCharacter || ((userId, characterId) => characterDb.ownsCharacter(userId, characterId));
    this.maxBufferedBytes = Number.isFinite(options.maxBufferedBytes)
      ? options.maxBufferedBytes
      : MAX_BUFFERED_BYTES;
    this.aoiRadius = Number.isFinite(options.aoiRadius) ? options.aoiRadius : AOI_RADIUS;

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
      if (client === senderWs || client.readyState !== WebSocket.OPEN) return;
      // Backpressure: a client that can't keep up is skipped rather than queued
      // unboundedly. It catches up on the next state snapshot.
      if (client.bufferedAmount >= this.maxBufferedBytes) return;
      client.send(payload);
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
   * Send a streaming event to the players within the AOI radius of a point,
   * skipping `senderWs` and any socket under backpressure.
   * @param {number} sourceX
   * @param {number} sourceY
   * @param {WebSocket|null} senderWs
   * @param {Object} data
   */
  broadcastNear(sourceX, sourceY, senderWs, data) {
    const payload = JSON.stringify(data);
    const radiusSquared = this.aoiRadius * this.aoiRadius;
    this.wss.clients.forEach((client) => {
      if (client === senderWs || client.readyState !== WebSocket.OPEN) return;
      if (client.bufferedAmount >= this.maxBufferedBytes) return;
      const receiver = this.players.get(client);
      if (!receiver) return;
      const dx = receiver.x - sourceX;
      const dy = receiver.y - sourceY;
      if (dx * dx + dy * dy > radiusSquared) return;
      client.send(payload);
    });
  }

  /**
   * Fan a batch of enemy positions out to players near *any* of them.
   * @param {Array<{id:number, x:number, y:number}>} moved
   */
  broadcastEnemiesMoved(moved) {
    if (!moved.length) return;
    const payload = JSON.stringify({ type: "enemy_moved", payload: { enemies: moved } });
    const radiusSquared = this.aoiRadius * this.aoiRadius;
    this.wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (client.bufferedAmount >= this.maxBufferedBytes) return;
      const receiver = this.players.get(client);
      if (!receiver) return;
      const near = moved.some(
        (enemy) => (receiver.x - enemy.x) ** 2 + (receiver.y - enemy.y) ** 2 <= radiusSquared
      );
      if (near) client.send(payload);
    });
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

      case "player_restore_mp":
        this.handlePlayerRestoreMp(ws, msg.payload);
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

      case "quest_claim":
        this.handleQuestClaim(ws);
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
    // Identity: the session token names the account, and the requested character
    // must belong to it. An unauthenticated (or foreign-character) join is still
    // allowed to be *present* in the world, but owns no ledger and earns nothing.
    const userId = this.verifyToken(payload.token);
    const requestedCharacter = sanitizeStr(payload.characterId || "", 64);
    const characterId =
      userId && requestedCharacter && this.ownsCharacter(userId, requestedCharacter)
        ? requestedCharacter
        : null;

    // The server is the economy's source of truth: a fresh character starts at
    // level 1; an existing one resumes from its persisted ledger, never from a
    // client-reported level.
    // The requested sect is server-owned: it comes from the stored character, so
    // a client cannot claim another sect's kit.
    const character = characterId ? characterDb.findById(userId, characterId) : null;
    const saved = characterId ? store.getProgress(characterId) : null;
    const progress = characterId
      ? saved
        ? normalizeProgress(saved)
        : { level: 1, exp: 0, coins: 0, kills: 0 }
      : null;
    const vitals = progress ? vitalsForLevel(progress.level) : null;
    // Persist the ledger (creating it on a first visit) and stamp the account's
    // authoritative display name so the derived leaderboard never shows a blank.
    if (characterId) {
      store.setProgress(characterId, progress, userDb.resolveDisplayName(userId, displayName));
    }

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
      x: clampNum(payload.x, WORLD_MIN_X, WORLD_MAX_X, PLAYER_SPAWN.x),
      y: clampNum(payload.y, WORLD_MIN_Y, WORLD_MAX_Y, PLAYER_SPAWN.y),
      vx: clampNum(payload.vx, -500, 500, 0),
      vy: clampNum(payload.vy, -500, 500, 0),
      direction: payload.direction === "left" ? "left" : "right",
      stance: payload.stance === "side" ? "side" : "front",
      equipment: sanitizeEquipment(payload.equipment),
      // Character gender drives the peer's rig silhouette ("male" | "female").
      gender: payload.gender === "female" ? "female" : "male",
      characterId,
      progress,
      questRewarded: saved?.questRewarded ?? false,
      // Level and the HP ceiling are derived from the server-owned ledger, never
      // from the client.
      level: progress ? progress.level : 1,
      maxHp: vitals ? vitals.maxHp : 100,
      hp: 0,
      // MP is server-owned like HP: the join seeds it, every later change is
      // driven by the server (skill cost, potion, level-up refill).
      maxMp: vitals ? vitals.maxMp : 60,
      mp: 0,
      // Reported purely so the server can roll wolf bites and skill damage against it.
      defense: clampNum(payload.defense, 0, 9999, 6),
      attack: clampNum(payload.attack, 0, 99999, 24),
      critRate: clampNum(payload.critRate, 0, 1, 0.12),
      sect: character?.sect || "thieu-lam",
      pkFlag: payload.pkFlag === true,
      invulnerableUntil: 0,
      nextBiteAt: 0,
      nextAttackAt: 0,
      nextHitAt: 0,
      /** skill id -> timestamp the next cast is allowed. */
      skillReadyAt: Object.create(null),
      /** { skillId, at } of the most recent accepted cast, used to authorize its hit. */
      lastCast: null
    };

    playerData.hp = clampNum(payload.hp, 0, playerData.maxHp, playerData.maxHp);
    playerData.mp = clampNum(payload.mp, 0, playerData.maxMp, playerData.maxMp);

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

    // The authoritative ledger for this character, so the HUD renders server
    // progress instead of whatever the client had stored locally.
    if (progress) {
      this.send(ws, {
        type: "player_progress",
        payload: { ...progressPayload(progress), questRewarded: playerData.questRewarded }
      });
    }

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
      gender: player.gender,
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

    player.x = clampNum(payload.x, WORLD_MIN_X, WORLD_MAX_X, player.x);
    player.y = clampNum(payload.y, WORLD_MIN_Y, WORLD_MAX_Y, player.y);
    player.vx = clampNum(payload.vx, -500, 500, 0);
    player.vy = clampNum(payload.vy, -500, 500, 0);
    if (payload.direction) {
      player.direction = payload.direction === "left" ? "left" : "right";
    }
    if (payload.stance) {
      player.stance = payload.stance === "side" ? "side" : "front";
    }

    // Broadcast the position to nearby players only (AOI)
    this.broadcastNear(player.x, player.y, ws, {
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

    this.broadcastNear(player.x, player.y, ws, {
      type: "player_equipment",
      payload: { id: player.id, equipment: player.equipment }
    });
  }

  /**
   * Update the one part of a player's block the server trusts the client to own:
   * defense (used to roll wolf bites). The level, HP ceiling and current HP are
   * all server-owned now — a level-up grows maxHp and heals on the server, and a
   * client stat report can never change them.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerStats(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    player.defense = clampNum(payload.defense, 0, 9999, player.defense);
    player.attack = clampNum(payload.attack, 0, 99999, player.attack);
    player.critRate = clampNum(payload.critRate, 0, 1, player.critRate);
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

    this.broadcastNear(player.x, player.y, null, {
      type: "player_hp",
      payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
    });
  }

  /**
   * Restore MP the client requested (potion, pickup). Clamped to the server's
   * ceiling, so a client can never raise another player's MP or overflow its own.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerRestoreMp(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const amount = clampNum(payload.amount, 0, 9999, 0);
    if (amount <= 0) return;

    player.mp = Math.min(player.maxMp, player.mp + amount);
    this.broadcastMp(player);
  }

  /** Broadcast a player's authoritative MP pool to nearby players. */
  broadcastMp(player) {
    this.broadcastNear(player.x, player.y, null, {
      type: "player_mp",
      payload: { id: player.id, mp: player.mp, maxMp: player.maxMp }
    });
  }

  /**
   * Player triggers attack / skill animation. A skill's MP cost is spent from the
   * server-owned pool; an unaffordable cast is refused (and the caster resynced),
   * so the client can never cast past its mana.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerAttack(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const now = Date.now();
    if (now < player.nextAttackAt) return;
    player.nextAttackAt = now + ACTION_COOLDOWN_MS;

    // Only skills belonging to the player's server-owned sect can be cast; an
    // unknown or foreign id degrades to a plain attack.
    const requested = skillById(payload.skill);
    const skill = requested && requested.sect === player.sect ? requested : null;
    const skillId = skill ? skill.id : "normal";

    if (skill) {
      const readyAt = player.skillReadyAt[skillId] || 0;
      if (now < readyAt) return;
      player.skillReadyAt[skillId] = now + skillCooldown(skillId);
    }

    const cost = skillMpCost(skillId);
    if (cost > 0) {
      if (player.mp < cost) {
        // Refuse the cast and resync the caster so its HUD matches the server.
        this.broadcastMp(player);
        return;
      }
      player.mp -= cost;
      this.broadcastMp(player);
    }

    // A successful cast authorizes the skill's follow-up hit. `enemy_hit` refuses
    // a skill the player did not just cast, so damage cannot be minted freely.
    if (skill) player.lastCast = { skillId, at: now, hits: 0 };

    const x = clampNum(payload.x, WORLD_MIN_X, WORLD_MAX_X, player.x);
    const y = clampNum(payload.y, WORLD_MIN_Y, WORLD_MAX_Y, player.y);
    const facingRight = payload.facingRight !== false;

    this.broadcastNear(x, y, ws, {
      type: "player_attacked",
      payload: {
        id: player.id,
        skill: skillId,
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

    // Rate-limit hits per attacker so a spamming client can't amplify one socket
    // into a broadcast storm. (The target's 700ms iframe already caps the damage.)
    const now = Date.now();
    if (now < attacker.nextHitAt) return;
    attacker.nextHitAt = now + ACTION_COOLDOWN_MS;

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

    // The victim always receives their own HP (distance 0); only nearby players do.
    this.broadcastNear(target.x, target.y, null, {
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
    // The defeat is announced where the fight happened, before the teleport.
    const defeatX = victim.x;
    const defeatY = victim.y;

    victim.hp = victim.maxHp;
    victim.x = PLAYER_SPAWN.x;
    victim.y = PLAYER_SPAWN.y;
    victim.invulnerableUntil = Date.now() + PLAYER_IFRAME_MS;

    const defeatMessage = {
      type: "player_defeated",
      payload: {
        victimId: victim.id,
        victimName: victim.displayName || victim.username,
        attackerId: attacker?.id || null,
        attackerName: attacker ? attacker.displayName || attacker.username : null,
        source,
        respawn: { ...PLAYER_SPAWN }
      }
    };

    // The victim is already teleported, so it now sits outside the fight's AOI.
    // Always deliver its own defeat; nearby players get it through the AOI.
    const victimWs = this.playerById.get(victim.id)?.ws || null;
    this.send(victimWs, defeatMessage);
    this.broadcastNear(defeatX, defeatY, victimWs, defeatMessage);

    this.broadcastNear(victim.x, victim.y, null, {
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

    let damage;
    const skill = skillById(payload.skill);
    if (skill && skill.sect === player.sect) {
      // Only a hit that follows a validated cast is accepted; otherwise a client
      // could mint damage without paying MP or cooldown.
      const now = Date.now();
      const cast = player.lastCast;
      if (!cast || cast.skillId !== skill.id || now - cast.at > CAST_HIT_WINDOW_MS) return;
      // Cap follow-up hits per cast (an AoE may legitimately hit a handful).
      if (cast.hits >= MAX_HITS_PER_CAST) return;
      cast.hits += 1;

      // Skill hits are authoritative: the server recomputes the damage from the
      // catalog and the player's own attack stat instead of trusting the client.
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (distance > skill.range + skill.radius + 40) return;
      damage = computeSkillDamage(
        skill,
        { attack: player.attack, critRate: player.critRate, critDamage: 1.5 },
        { defense: WOLF_COMBAT.defense },
        Math.random
      ).damage;
    } else {
      if (typeof payload.damage !== "number" || !Number.isFinite(payload.damage) || payload.damage <= 0) return;
      damage = Math.round(Math.min(payload.damage, 200));
    }

    if (damage <= 0) return;

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

    this.broadcastNear(enemy.x, enemy.y, null, {
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
      const reward = rollEnemyReward(player.id, enemy);
      this.broadcastNear(enemy.x, enemy.y, null, { type: "enemy_reward", payload: reward });

      // The credited killer's ledger is updated here, on the server. The reward
      // broadcast above is only for rendering (drop + float text).
      this.creditReward(ws, player, { exp: reward.exp, coins: reward.coins, kills: 1 });
      this.persistProgress(player);
    }
  }

  /**
   * Apply a reward to a player's server-owned ledger, announce any level-up, and
   * push the authoritative ledger back to that player. Only the server calls
   * this, so a client can never decide its own coins, EXP or level.
   * @param {WebSocket} ws - the credited player's socket
   * @param {Object} player - server player object
   * @param {{exp?:number, coins?:number, kills?:number}} reward
   * @returns {ReturnType<typeof applyReward>}
   */
  creditReward(ws, player, reward) {
    // No verified identity / ledger -> the player is present-only and earns nothing.
    if (!player.progress || !player.characterId) return null;

    const next = applyReward(player.progress, reward);
    player.progress = { level: next.level, exp: next.exp, coins: next.coins, kills: next.kills };
    player.level = next.level;
    const vitals = vitalsForLevel(next.level);
    player.maxHp = vitals.maxHp;
    player.maxMp = vitals.maxMp;

    if (next.levelUps > 0) {
      // A level-up heals HP and refills MP, matching the client's expectation.
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      this.broadcastNear(player.x, player.y, null, {
        type: "player_hp",
        payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
      });
      this.broadcastMp(player);
    }

    this.send(ws, {
      type: "player_progress",
      payload: { ...progressPayload(player.progress), levelUps: next.levelUps }
    });
    return next;
  }

  /**
   * One-off quest payout, gated on the persisted `quest_rewarded` flag so a client
   * cannot claim it twice by replaying the message.
   * @param {WebSocket} ws
   */
  handleQuestClaim(ws) {
    const player = this.players.get(ws);
    if (!player || !player.progress || player.questRewarded) return;

    player.questRewarded = true;
    this.creditReward(ws, player, { exp: 50, coins: 20 });
    store.setQuestRewarded(player.characterId, true);
    this.persistProgress(player);
  }

  /**
   * Write a player's ledger to the database. Best-effort: a failed write is logged
   * but never breaks the socket, and the next reward retries.
   * @param {Object} player
   */
  persistProgress(player) {
    if (!player.characterId || !player.progress) return;
    try {
      store.setProgress(player.characterId, player.progress);
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[WebSocket] Failed to persist progress:", err.message);
      }
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
      const x = clampNum(Math.round(next.x), WORLD_MIN_X, WORLD_MAX_X, enemy.x);
      const y = clampNum(Math.round(next.y), WORLD_MIN_Y, WORLD_MAX_Y, enemy.y);
      if (x === enemy.x && y === enemy.y) return;

      enemy.x = x;
      enemy.y = y;
      moved.push({ id: enemy.id, x, y });
    });

    if (moved.length) {
      this.broadcastEnemiesMoved(moved);
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

    this.broadcastNear(enemy.x, enemy.y, null, {
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
