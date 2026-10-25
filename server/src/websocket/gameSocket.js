import { WebSocketServer, WebSocket } from "ws";
import { rollEnemyReward } from "../rewards.js";
import { store } from "../data/playerDb.js";
import { characterDb } from "../data/characterDb.js";
import { userDb } from "../data/userDb.js";
import { verifySessionToken } from "../auth/session.js";
import { stepEnemy, BITE_TUNING } from "../../../src/game/enemyAi.js";
import { canPvpAttack, clampPvpDamage, dodgeChance, rollDodge, PLAYER_IFRAME_MS } from "../../../src/game/pvp.js";
import { computeDamage } from "../../../src/game/damage.js";
import { WORLD_CONFIG } from "../../../src/game/worldConfig.js";
import { getMonster } from "../../../src/game/enemyCatalog.js";
import {
  DEFAULT_MAP_ID,
  MAP_IDS,
  findPortal,
  getMap,
  isKnownMap
} from "../../../src/game/maps/mapRegistry.js";
import {
  applyReward,
  normalizeProgress,
  progressPayload,
  vitalsForLevel
} from "../../../src/game/progression.js";
import { skillById, skillMpCost, skillCooldown } from "../../../src/game/skills.js";
import { computeSkillDamage } from "../../../src/game/skillDamage.js";
import { shopPurchase } from "../../../src/game/shop.js";

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

/** Grid cell size for spatial indexing. */
export const GRID_CELL_SIZE = 800;

/**
 * 2D Spatial Grid to index entities by cell coordinates for fast radius queries.
 */
export class SpatialGrid {
  /**
   * @param {number} [cellSize]
   */
  constructor(cellSize = GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  _cellCoords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  add(entity) {
    const [cx, cy] = this._cellCoords(entity.x, entity.y);
    entity._cx = cx;
    entity._cy = cy;
    const key = this._key(cx, cy);
    let set = this.grid.get(key);
    if (!set) {
      set = new Set();
      this.grid.set(key, set);
    }
    set.add(entity);
  }

  update(entity) {
    const [cx, cy] = this._cellCoords(entity.x, entity.y);
    if (entity._cx === cx && entity._cy === cy) return;
    this.remove(entity);
    this.add(entity);
  }

  remove(entity) {
    if (entity._cx !== undefined && entity._cy !== undefined) {
      const key = this._key(entity._cx, entity._cy);
      const set = this.grid.get(key);
      if (set) {
        set.delete(entity);
        if (set.size === 0) {
          this.grid.delete(key);
        }
      }
      entity._cx = undefined;
      entity._cy = undefined;
    }
  }

  getNear(x, y, radius) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const radiusSq = radius * radius;
    const result = [];

    const cellCount = (maxCx - minCx + 1) * (maxCy - minCy + 1);
    if (cellCount < this.grid.size) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = this._key(cx, cy);
          const set = this.grid.get(key);
          if (set) {
            set.forEach((entity) => {
              const dx = entity.x - x;
              const dy = entity.y - y;
              if (dx * dx + dy * dy <= radiusSq) {
                result.push(entity);
              }
            });
          }
        }
      }
    } else {
      for (const set of this.grid.values()) {
        set.forEach((entity) => {
          if (entity._cx >= minCx && entity._cx <= maxCx && entity._cy >= minCy && entity._cy <= maxCy) {
            const dx = entity.x - x;
            const dy = entity.y - y;
            if (dx * dx + dy * dy <= radiusSq) {
              result.push(entity);
            }
          }
        });
      }
    }
    return result;
  }
}

/**
 * Legacy tuning mirror. Monster numbers now come from the shared catalog
 * (`src/game/enemyCatalog.js`); the names stay exported because older helpers and
 * tests still import them.
 */
export const ENEMY_MAX_HP = getMonster("soi-xam").maxHp;
export const ENEMY_RESPAWN_MS = 10000;
/** Server AI tick (10 Hz): fast enough to look continuous, cheap enough to share. */
export const ENEMY_TICK_MS = 100;

/** Invulnerability window (ms) granted after any hit the server applies. */
export { PLAYER_IFRAME_MS };

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
 * Streaming scope: everything that lives on a map is broadcast to everyone
 * standing on that map.
 *
 * Both rosters are map-wide (`init_world` ships every player *and* every enemy),
 * so the client renders every avatar and every monster on the map. Gating state on
 * a smaller radius did not hide anything — it only left those entities frozen
 * mid-walk/standstill on screen, because their position packets silently stopped.
 * Enemy counts per map are small (single digits), so the cost is a handful of
 * extra messages per tick, while `maxBufferedBytes` still sheds lagging sockets.
 * If a map ever needs culling, it has to hide the entities on the client first.
 */

/** Max distance (ground px) between buyer and a shop NPC. */
const SHOP_INTERACT_RANGE = 260;

/**
 * Build one map's authoritative roster from its MapDefinition. Accepts catalog
 * spawns (`{id, monsterId, x, y}`) and the legacy `[x, y]` pairs.
 * @param {Array<object|[number, number]>} [spawns]
 * @param {string} [mapId]
 * @returns {Array<Object>}
 */
export const createEnemyState = (
  spawns = getMap(DEFAULT_MAP_ID).enemySpawns,
  mapId = DEFAULT_MAP_ID
) =>
  spawns.map((spawn, index) => {
    const isPair = Array.isArray(spawn);
    const x = isPair ? spawn[0] : spawn.x;
    const y = isPair ? spawn[1] : spawn.y;
    const monster = getMonster(isPair ? spawn[2] : spawn.monsterId);

    return {
      id: isPair ? index : spawn.id ?? index,
      mapId,
      monsterId: monster.id,
      name: monster.name,
      level: monster.level,
      x,
      y,
      homeX: x,
      homeY: y,
      hp: monster.maxHp,
      maxHp: monster.maxHp,
      attack: monster.attack,
      defense: monster.defense,
      critRate: monster.critRate,
      critDamage: monster.critDamage,
      exp: monster.exp,
      coinsMin: monster.coinsMin,
      coinsMax: monster.coinsMax,
      tuning: monster.ai || null,
      respawnMs: Number.isFinite(monster.respawnMs) ? monster.respawnMs : null,
      isDead: false
    };
  });

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

    // Server-owned enemy state, one roster per map. `enemies` / `enemyGrid` keep
    // pointing at the default map so older helpers and tests still work.
    this.enemiesEnabled = options.enemies !== false;
    this.enemyByMap = new Map();
    this.enemyGridByMap = new Map();
    this.enemies = new Map();
    this.enemyGrid = new SpatialGrid(GRID_CELL_SIZE);
    this.enemyByMap.set(DEFAULT_MAP_ID, this.enemies);
    this.enemyGridByMap.set(DEFAULT_MAP_ID, this.enemyGrid);

    if (this.enemiesEnabled) {
      // Biện Kinh is a safe city: its legacy roster only exists for harnesses that
      // explicitly ask for it (`enemySpawns` / `enemyRespawnMs`). Every other map
      // spawns its own hunting roster from its MapDefinition.
      const marketSpawns =
        options.enemySpawns ??
        (options.enemyRespawnMs != null ? getMap(DEFAULT_MAP_ID).enemySpawns : []);
      this.loadRoster(DEFAULT_MAP_ID, marketSpawns);

      MAP_IDS.forEach((mapId) => {
        if (mapId === DEFAULT_MAP_ID) return;
        const map = getMap(mapId);
        if (map.safe || !map.enemySpawns?.length) return;
        this.loadRoster(mapId, map.enemySpawns);
      });
    }
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
    // Injectable so tests can pin the directional-dodge roll.
    this.random = typeof options.random === "function" ? options.random : Math.random;

    this.setupServer();
    this.startHeartbeat();
    this.startEnemyTick();
  }

  /**
   * Replace one map's roster and its spatial grid.
   * @param {string} mapId
   * @param {Array<object|[number, number]>} [spawns]
   * @returns {Map<number, Object>}
   */
  loadRoster(mapId, spawns = []) {
    const roster = new Map(createEnemyState(spawns, mapId).map((enemy) => [enemy.id, enemy]));
    const grid = new SpatialGrid(GRID_CELL_SIZE);
    roster.forEach((enemy) => {
      if (!enemy.isDead) grid.add(enemy);
    });

    this.enemyByMap.set(mapId, roster);
    this.enemyGridByMap.set(mapId, grid);

    if (mapId === DEFAULT_MAP_ID) {
      this.enemies = roster;
      this.enemyGrid = grid;
    }
    return roster;
  }

  /**
   * The roster of a map, built on first use.
   * @param {string} mapId
   * @returns {Map<number, Object>}
   */
  rosterFor(mapId) {
    const id = isKnownMap(mapId) ? mapId : DEFAULT_MAP_ID;
    if (!this.enemyByMap.has(id)) {
      const map = getMap(id);
      this.loadRoster(id, this.enemiesEnabled ? map.enemySpawns || [] : []);
    }
    return this.enemyByMap.get(id);
  }

  /**
   * The spatial grid of a map, built alongside its roster.
   * @param {string} mapId
   * @returns {SpatialGrid}
   */
  gridFor(mapId) {
    this.rosterFor(mapId);
    return this.enemyGridByMap.get(isKnownMap(mapId) ? mapId : DEFAULT_MAP_ID);
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
   * Fan out a player-owned event (position, gear, HP/MP, combat animation) to
   * everyone standing on the player's map.
   * @param {Object} player - server player object the event belongs to
   * @param {Object} data
   * @param {WebSocket|null} [excludeWs] the sender, which already knows its own state
   */
  broadcastPlayerState(player, data, excludeWs = null) {
    this.broadcastToMap(player.mapId, data, excludeWs);
  }

  /**
   * Send an identity event (join/leave) to every player standing on one map.
   * @param {string} mapId
   * @param {Object} data
   * @param {WebSocket|null} [excludeWs]
   */
  broadcastToMap(mapId, data, excludeWs = null) {
    const payload = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client === excludeWs || client.readyState !== WebSocket.OPEN) return;
      if (client.bufferedAmount >= this.maxBufferedBytes) return;
      const receiver = this.players.get(client);
      if (!receiver || receiver.mapId !== mapId) return;
      client.send(payload);
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

      case "shop_buy":
        this.handleShopBuy(ws, msg.payload);
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

      case "map_change":
        this.handleMapChange(ws, msg.payload);
        break;

      case "quest_claim":
        this.handleQuestClaim(ws);
        break;

      case "gm_action":
        this.handleGmAction(ws, msg.payload);
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

    const isAdmin = Boolean(
      userDb.isAdmin(userId) ||
      username.toLowerCase() === "admin" ||
      username.toLowerCase().startsWith("gm")
    );

    if (isAdmin && characterId) {
      const bag = store.getInventory(characterId);
      if (!bag["lenh-bai-gm"]) {
        bag["lenh-bai-gm"] = 1;
        store.setInventory(characterId, bag);
      }
      this.send(ws, {
        type: "inventory_sync",
        payload: { inventory: bag }
      });
    }

    // If this player ID was already connected from an old socket, remove old one
    if (this.playerById.has(playerId)) {
      const existing = this.playerById.get(playerId);
      if (existing.ws !== ws) {
        // Flag the outgoing socket first: its close handler runs asynchronously and
        // would otherwise delete the registration we are about to overwrite, and
        // announce a player_left for the very player that just reconnected.
        existing.ws.__superseded = true;
        try {
          existing.ws.close();
        } catch {
          // ignore
        }
        this.players.delete(existing.ws);
      }
    }

    // Which map this hero is entering. Unknown ids fall back to the default city.
    const requestedMapId = sanitizeStr(payload.mapId || "", 64);
    const mapId = isKnownMap(requestedMapId) ? requestedMapId : DEFAULT_MAP_ID;
    const entryMap = getMap(mapId);

    const playerData = {
      id: playerId,
      username,
      displayName,
      mapId,
      x: clampNum(payload.x, entryMap.bounds.x0, entryMap.bounds.x1, entryMap.spawn.x),
      y: clampNum(payload.y, entryMap.bounds.y0, entryMap.bounds.y1, entryMap.spawn.y),
      vx: clampNum(payload.vx, -500, 500, 0),
      vy: clampNum(payload.vy, -500, 500, 0),
      direction: payload.direction === "left" ? "left" : "right",
      stance: payload.stance === "side" ? "side" : "front",
      equipment: sanitizeEquipment(payload.equipment),
      isAdmin,
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

    // 1. Send all existing players *on this map* to the joining player
    const existingPlayers = [];
    this.players.forEach((p, clientWs) => {
      if (clientWs !== ws && p.mapId === mapId) {
        existingPlayers.push(this.playerSnapshot(p));
      }
    });

    this.send(ws, {
      type: "init_world",
      payload: {
        yourId: playerId,
        mapId,
        spawn: { x: playerData.x, y: playerData.y },
        players: existingPlayers,
        enemies: this.getEnemyState(mapId)
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

    // 2. Announce the new player to everyone else standing on the same map
    this.broadcastToMap(
      mapId,
      { type: "player_joined", payload: { player: this.playerSnapshot(playerData) } },
      ws
    );
  }

  /**
   * Move a player through a portal. The server owns the destination: the client
   * only names the portal it walked into, and only portals of the map the player
   * is currently standing on are accepted.
   * @param {WebSocket} ws
   * @param {{portalId?:string}} payload
   */
  handleMapChange(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const fromMapId = player.mapId || DEFAULT_MAP_ID;
    const portal = findPortal(fromMapId, sanitizeStr(payload.portalId || "", 64));

    if (!portal || !isKnownMap(portal.targetMapId)) {
      this.send(ws, {
        type: "map_change_rejected",
        payload: { mapId: fromMapId, spawn: { x: player.x, y: player.y } }
      });
      return;
    }

    const target = getMap(portal.targetMapId);
    const roster = this.rosterFor(target.id);

    // Leaving: the old map stops seeing this player.
    this.broadcastToMap(fromMapId, { type: "player_left", payload: { id: player.id } }, ws);

    player.mapId = target.id;
    player.x = clampNum(portal.targetSpawn.x, target.bounds.x0, target.bounds.x1, target.spawn.x);
    player.y = clampNum(portal.targetSpawn.y, target.bounds.y0, target.bounds.y1, target.spawn.y);
    player.vx = 0;
    player.vy = 0;
    // A fresh map means fresh aggro; do not carry a bite cooldown across.
    player.nextBiteAt = 0;

    const peers = [];
    this.players.forEach((other, clientWs) => {
      if (clientWs !== ws && other.mapId === target.id) peers.push(this.playerSnapshot(other));
    });

    this.send(ws, {
      type: "map_changed",
      payload: {
        yourId: player.id,
        mapId: target.id,
        spawn: { x: player.x, y: player.y },
        players: peers,
        enemies: Array.from(roster.values()).map((enemy) => this.enemySnapshot(enemy))
      }
    });

    // Arriving: the new map sees this player.
    this.broadcastToMap(
      target.id,
      { type: "player_joined", payload: { player: this.playerSnapshot(player) } },
      ws
    );
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
      // Lets the client collapse duplicate copies of the same character (a stale
      // tab, a reload race) into one avatar instead of two identical nameplates.
      characterId: player.characterId || null,
      mapId: player.mapId,
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

    // Movement is clamped to the map the player stands on, exactly like the join
    // clamp, so the two can never disagree about where the hero may be.
    const bounds = getMap(player.mapId).bounds;
    player.x = clampNum(payload.x, bounds.x0, bounds.x1, player.x);
    player.y = clampNum(payload.y, bounds.y0, bounds.y1, player.y);
    player.vx = clampNum(payload.vx, -500, 500, 0);
    player.vy = clampNum(payload.vy, -500, 500, 0);
    if (payload.direction) {
      player.direction = payload.direction === "left" ? "left" : "right";
    }
    if (payload.stance) {
      player.stance = payload.stance === "side" ? "side" : "front";
    }

    // Broadcast the position to the rest of the map: the roster is map-wide, so
    // every client on it already renders this avatar and must keep it moving.
    this.broadcastPlayerState(
      player,
      {
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
      },
      ws
    );
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

    this.broadcastPlayerState(
      player,
      {
        type: "player_equipment",
        payload: { id: player.id, equipment: player.equipment }
      },
      ws
    );
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

    this.broadcastPlayerState(player, {
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

  /**
   * Buy stock from a shop NPC. Silver and the catalog price are server-owned:
   * the client only names the item and quantity, and is answered with the
   * authoritative result. The purchased units are written to the character's
   * stored bag before the reply, so a purchase survives a disconnect.
   * @param {WebSocket} ws
   * @param {{itemId?:string, qty?:number}} payload
   */
  handleShopBuy(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player) return;

    const purchase = shopPurchase(sanitizeStr(payload.itemId, 64), payload.qty);
    if (!purchase) {
      this.send(ws, {
        type: "shop_result",
        payload: { ok: false, itemId: sanitizeStr(payload.itemId, 64), reason: "unknown" }
      });
      return;
    }

    // Guests and unverified characters have no ledger to debit.
    if (!player.progress || !player.characterId) {
      this.send(ws, {
        type: "shop_result",
        payload: { ok: false, itemId: purchase.item.id, qty: purchase.qty, reason: "guest" }
      });
      return;
    }

    // A shop is a place in the world: refuse purchases made from across the map.
    const nearShop = (getMap(player.mapId).npcs || []).some(
      (npc) =>
        npc.shop === "pharmacy" &&
        (player.x - npc.x) ** 2 + (player.y - npc.y) ** 2 <= SHOP_INTERACT_RANGE ** 2
    );
    if (!nearShop) {
      this.send(ws, {
        type: "shop_result",
        payload: {
          ok: false,
          itemId: purchase.item.id,
          qty: purchase.qty,
          total: purchase.total,
          coins: player.progress.coins,
          reason: "range"
        }
      });
      return;
    }

    if (player.progress.coins < purchase.total) {
      this.send(ws, {
        type: "shop_result",
        payload: {
          ok: false,
          itemId: purchase.item.id,
          qty: purchase.qty,
          total: purchase.total,
          coins: player.progress.coins,
          reason: "coins"
        }
      });
      return;
    }

    // Write the item first: if the bag cannot be persisted, no silver is spent.
    try {
      const bag = store.getInventory(player.characterId);
      const stored = Math.max(0, Math.floor(Number(bag[purchase.item.id]) || 0));
      bag[purchase.item.id] = stored + purchase.qty;
      store.setInventory(player.characterId, bag);
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[WebSocket] Failed to store purchase:", err.message);
      }
      this.send(ws, {
        type: "shop_result",
        payload: {
          ok: false,
          itemId: purchase.item.id,
          qty: purchase.qty,
          total: purchase.total,
          coins: player.progress.coins,
          reason: "error"
        }
      });
      return;
    }

    player.progress = { ...player.progress, coins: player.progress.coins - purchase.total };
    this.persistProgress(player);

    this.send(ws, {
      type: "player_progress",
      payload: progressPayload(player.progress)
    });
    this.send(ws, {
      type: "shop_result",
      payload: {
        ok: true,
        itemId: purchase.item.id,
        qty: purchase.qty,
        total: purchase.total,
        coins: player.progress.coins
      }
    });
  }

  /** Broadcast a player's authoritative MP pool to the map. */
  broadcastMp(player) {
    this.broadcastPlayerState(player, {
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

    const aimBounds = getMap(player.mapId).bounds;
    const x = clampNum(payload.x, aimBounds.x0, aimBounds.x1, player.x);
    const y = clampNum(payload.y, aimBounds.y0, aimBounds.y1, player.y);
    const facingRight = payload.facingRight !== false;

    this.broadcastPlayerState(
      player,
      {
        type: "player_attacked",
        payload: {
          id: player.id,
          skill: skillId,
          x,
          y,
          facingRight
        }
      },
      ws
    );
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
    if (!target) return this.rejectHit(ws, "target_missing");

    const damage = clampPvpDamage(payload.damage);
    if (damage === null) return this.rejectHit(ws, "damage_invalid");

    const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);
    if (!canPvpAttack(attacker, target, distance)) {
      const reason = attacker.pkFlag !== true
        ? "attacker_peaceful"
        : target.pkFlag !== true
          ? "target_peaceful"
          : "range";
      return this.rejectHit(ws, reason, {
        targetId: target.id,
        distance: Math.round(distance),
        attacker: { x: Math.round(attacker.x), y: Math.round(attacker.y) },
        target: { x: Math.round(target.x), y: Math.round(target.y) }
      });
    }

    // Directional dodge: only a target actively running *away* can slip a strike,
    // and the roll lives here so a client cannot claim to have evaded.
    if (rollDodge(attacker, target, this.random())) {
      return this.rejectHit(ws, "dodged", {
        targetId: target.id,
        chance: Math.round(dodgeChance(attacker, target) * 100)
      });
    }

    if (!this.applyPlayerDamage(target, damage, attacker, "pvp")) {
      return this.rejectHit(ws, "iframe");
    }
  }

  /**
   * Tell the attacker why a PvP hit was refused. Without this the client draws
   * damage the server never applied, which reads as "hit landed but no HP loss".
   * @param {WebSocket} ws attacker socket
   * @param {string} reason
   * @param {Object} [detail] extra diagnostics (e.g. the measured distance)
   */
  rejectHit(ws, reason, detail = null) {
    this.send(ws, { type: "player_hit_rejected", payload: { reason, ...(detail || {}) } });
  }

  /**
   * Deal server-authoritative damage to a player, broadcast the new HP and, when
   * it drops to zero, respawn them. Immunity and death are decided here, not by
   * any client.
   * @param {Object} target - server player object
   * @param {number} damage
   * @param {?Object} attacker - server player object that caused it
   * @param {"pvp"|"wolf"} source
   * @param {string|null} [sourceName] Display name of the attacking monster
   * @returns {boolean} whether the hit landed
   */
  applyPlayerDamage(target, damage, attacker = null, source = "wolf", sourceName = null) {
    if (target.isGodMode) return false;
    const now = Date.now();
    if (now < target.invulnerableUntil) return false;

    target.hp = Math.max(0, target.hp - damage);
    target.invulnerableUntil = now + PLAYER_IFRAME_MS;

    const hpMessage = {
      type: "player_hp",
      payload: {
        id: target.id,
        hp: target.hp,
        maxHp: target.maxHp,
        damage,
        source,
        sourceName:
          sourceName ||
          (source === "wolf"
            ? "Sói Xám"
            : attacker
              ? attacker.displayName || attacker.username
              : "Đối thủ")
      }
    };

    // Every player on the map holds this body, so every one of them gets the new
    // HP — including the victim, who reads its own pool from here.
    this.broadcastPlayerState(target, hpMessage);

    // A strike can cross maps (the range check does not compare map ids), so the
    // attacker may not be on the broadcast's map at all.
    this.sendToAttackerOffMap(attacker, target.mapId, hpMessage);

    if (target.hp <= 0) {
      this.respawnPlayer(target, attacker, source);
    }
    return true;
  }

  /**
   * Deliver a player event to the attacker when the broadcast cannot reach them,
   * which now only happens when the two stand on different maps.
   * @param {?Object} attacker
   * @param {string} mapId - the map the broadcast went to
   * @param {Object} message
   */
  sendToAttackerOffMap(attacker, mapId, message) {
    if (!attacker) return;
    if (attacker.mapId === mapId) return;
    const attackerWs = this.playerById.get(attacker.id)?.ws;
    if (!attackerWs) return;
    this.send(attackerWs, message);
  }

  /**
   * Respawn a defeated player at the fixed Biện Kinh point with full health and
   * announce the defeat. Attacker credit (when any) rides on the broadcast.
   * @param {Object} victim - server player object
   * @param {?Object} attacker
   * @param {"pvp"|"wolf"} source
   */
  respawnPlayer(victim, attacker = null, source = "wolf") {
    const map = getMap(victim.mapId);

    victim.hp = victim.maxHp;
    victim.x = map.spawn.x;
    victim.y = map.spawn.y;
    victim.invulnerableUntil = Date.now() + PLAYER_IFRAME_MS;

    const defeatMessage = {
      type: "player_defeated",
      payload: {
        victimId: victim.id,
        victimName: victim.displayName || victim.username,
        attackerId: attacker?.id || null,
        attackerName: attacker ? attacker.displayName || attacker.username : null,
        source,
        // Includes the map so the client can follow a respawn that crosses maps.
        respawn: { mapId: map.id, x: map.spawn.x, y: map.spawn.y }
      }
    };

    // The victim is already teleported, so their own copy is sent directly; the
    // rest of the map learns of the defeat through the broadcast.
    const victimWs = this.playerById.get(victim.id)?.ws || null;
    this.send(victimWs, defeatMessage);
    this.broadcastPlayerState(victim, defeatMessage, victimWs);

    // The killer is usually on the same map and got it above; a cross-map strike
    // still owes them their own kill.
    this.sendToAttackerOffMap(attacker, victim.mapId, defeatMessage);

    // The players who watched the fight still hold the victim where they fell. Send
    // them the teleport and the restored HP, otherwise they keep drawing a corpse
    // with an empty bar (and every later strike is measured against that stale body,
    // so it is refused as out of range forever).
    const movedMessage = {
      type: "player_moved",
      payload: {
        id: victim.id,
        x: victim.x,
        y: victim.y,
        vx: 0,
        vy: 0,
        direction: victim.direction,
        stance: victim.stance
      }
    };
    const restoredMessage = {
      type: "player_hp",
      payload: { id: victim.id, hp: victim.hp, maxHp: victim.maxHp }
    };

    // Same split as the defeat: the map gets it, the victim was moved to another
    // map by the respawn and reads its own copy directly.
    this.broadcastPlayerState(victim, movedMessage, victimWs);
    this.broadcastPlayerState(victim, restoredMessage, victimWs);
    this.sendToAttackerOffMap(attacker, victim.mapId, movedMessage);
    this.sendToAttackerOffMap(attacker, victim.mapId, restoredMessage);

    this.broadcastPlayerState(victim, restoredMessage);
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
   * Authoritative handler for GM command actions
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handleGmAction(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player || !player.isAdmin) {
      this.send(ws, {
        type: "error",
        payload: { message: "Bạn không có quyền quản trị GM!" }
      });
      return;
    }

    const action = payload.action;

    switch (action) {
      case "set_level": {
        const level = clampNum(payload.level, 1, 150, player.progress?.level || 1);
        const vitals = vitalsForLevel(level);
        if (player.progress) {
          player.progress.level = level;
          player.progress.exp = 0;
          if (player.characterId) {
            store.setProgress(player.characterId, player.progress);
          }
        }
        player.level = level;
        player.maxHp = vitals.maxHp;
        player.maxMp = vitals.maxMp;
        player.hp = vitals.maxHp;
        player.mp = vitals.maxMp;

        this.send(ws, {
          type: "player_progress",
          payload: {
            ...progressPayload(player.progress || { level, exp: 0, coins: 0, kills: 0 }),
            levelUps: 1
          }
        });
        this.broadcastToMap(player.mapId, {
          type: "player_hp",
          payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
        });
        this.send(ws, {
          type: "player_mp",
          payload: { id: player.id, mp: player.mp, maxMp: player.maxMp }
        });
        break;
      }

      case "add_level": {
        const delta = clampNum(payload.levels, 1, 150, 1);
        const current = player.progress?.level || player.level || 1;
        const targetLevel = clampNum(current + delta, 1, 150, current);
        this.handleGmAction(ws, { action: "set_level", level: targetLevel });
        break;
      }

      case "add_exp": {
        const exp = clampNum(payload.exp, 1, 10000000, 1000);
        if (player.progress && player.characterId) {
          const next = applyReward(player.progress, { exp });
          player.progress = { level: next.level, exp: next.exp, coins: next.coins, kills: next.kills };
          store.setProgress(player.characterId, player.progress);

          const vitals = vitalsForLevel(next.level);
          player.level = next.level;
          player.maxHp = vitals.maxHp;
          player.maxMp = vitals.maxMp;

          if (next.levelUps > 0) {
            player.hp = player.maxHp;
            player.mp = player.maxMp;
            this.broadcastToMap(player.mapId, {
              type: "player_hp",
              payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
            });
            this.send(ws, {
              type: "player_mp",
              payload: { id: player.id, mp: player.mp, maxMp: player.maxMp }
            });
          }

          this.send(ws, {
            type: "player_progress",
            payload: { ...progressPayload(player.progress), levelUps: next.levelUps }
          });
        }
        break;
      }

      case "heal_full": {
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        this.broadcastToMap(player.mapId, {
          type: "player_hp",
          payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
        });
        this.send(ws, {
          type: "player_mp",
          payload: { id: player.id, mp: player.mp, maxMp: player.maxMp }
        });
        break;
      }

      case "add_items": {
        if (!player.characterId) return;
        const items = payload.items;
        if (!items || typeof items !== "object") return;
        const bag = store.getInventory(player.characterId);
        for (const [id, qty] of Object.entries(items)) {
          if (typeof qty === "number" && qty > 0) {
            bag[id] = (bag[id] || 0) + Math.floor(qty);
          }
        }
        store.setInventory(player.characterId, bag);
        this.send(ws, {
          type: "inventory_sync",
          payload: { inventory: bag }
        });
        break;
      }

      case "add_coins": {
        const amount = clampNum(payload.amount, 1, 10000000, 1000);
        if (player.progress) {
          player.progress.coins = (player.progress.coins || 0) + amount;
          if (player.characterId) {
            store.setProgress(player.characterId, player.progress);
          }
          this.send(ws, {
            type: "player_progress",
            payload: progressPayload(player.progress)
          });
        }
        break;
      }

      case "teleport": {
        const targetMapId = sanitizeStr(payload.mapId || "", 64);
        if (!isKnownMap(targetMapId)) return;
        const targetMap = getMap(targetMapId);
        const spawn = payload.spawn || targetMap.spawn;
        const currentMapId = player.mapId;

        if (currentMapId !== targetMapId) {
          this.broadcastToMap(currentMapId, {
            type: "player_left",
            payload: { id: player.id }
          }, ws);
          this.playerGrid.get(currentMapId)?.remove(player);

          player.mapId = targetMapId;
          player.x = spawn.x;
          player.y = spawn.y;
          this.playerGrid.get(targetMapId)?.add(player);

          const newPeers = this.getPlayersOnMap(targetMapId, ws).map((p) => this.playerSnapshot(p));
          const newEnemies = this.getEnemiesOnMap(targetMapId).map((e) => this.enemySnapshot(e));

          this.send(ws, {
            type: "map_changed",
            payload: {
              mapId: targetMapId,
              spawn,
              players: newPeers,
              enemies: newEnemies
            }
          });

          this.broadcastToMap(targetMapId, {
            type: "player_joined",
            payload: this.playerSnapshot(player)
          }, ws);
        } else {
          player.x = spawn.x;
          player.y = spawn.y;
          this.playerGrid.get(currentMapId)?.update(player);
          this.broadcastToMap(currentMapId, {
            type: "player_moved",
            payload: { id: player.id, x: spawn.x, y: spawn.y }
          });
        }
        break;
      }

      case "toggle_god_mode": {
        player.isGodMode = payload.enabled !== undefined ? Boolean(payload.enabled) : !player.isGodMode;
        this.send(ws, {
          type: "gm_state",
          payload: { isGodMode: player.isGodMode }
        });
        break;
      }

      default:
        break;
    }
  }

  /**
   * Public shape of one enemy, safe to send over the wire.
   * @param {Object} enemy
   * @returns {Object}
   */
  enemySnapshot(enemy) {
    return {
      id: enemy.id,
      mapId: enemy.mapId,
      monsterId: enemy.monsterId,
      name: enemy.name,
      level: enemy.level,
      x: enemy.x,
      y: enemy.y,
      homeX: enemy.homeX,
      homeY: enemy.homeY,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      attack: enemy.attack,
      defense: enemy.defense,
      isDead: enemy.isDead
    };
  }

  /**
   * Report one map's enemy roster: position, health and dead flag.
   * @param {string} [mapId]
   * @returns {Array<Object>}
   */
  getEnemyState(mapId = DEFAULT_MAP_ID) {
    return Array.from(this.rosterFor(mapId).values()).map((enemy) => this.enemySnapshot(enemy));
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

    // Enemy ids are per-map, so the roster of the map the attacker stands on is
    // the only one a hit can name.
    const enemy = this.rosterFor(player.mapId).get(payload.id);
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
        { defense: enemy.defense },
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
      this.gridFor(enemy.mapId).remove(enemy);
      this.scheduleEnemyRespawn(enemy);
    }

    this.broadcastToMap(enemy.mapId, {
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
      this.broadcastToMap(enemy.mapId, { type: "enemy_reward", payload: reward });

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
      this.broadcastPlayerState(player, {
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
    const hasEnemies = Array.from(this.enemyByMap.values()).some((roster) => roster.size > 0);
    if (!hasEnemies) return;
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
    if (!this.wss.clients.size) return;

    const players = Array.from(this.players.values());

    // Each map steps its own roster against its own players: a monster must never
    // chase someone standing on another map.
    this.enemyByMap.forEach((roster, mapId) => {
      if (!roster.size) return;

      const map = getMap(mapId);
      const mapPlayers = players.filter((player) => player.mapId === mapId);
      const grid = this.gridFor(mapId);
      const moved = [];
      // The market keeps a few legacy spawns outside its square; clamping those to
      // the walkable rect would teleport them on the first tick. Maps that own
      // their spawns are clamped to their own bounds.
      const bounds = map.allowOutOfBoundsSpawns
        ? { x0: WORLD_MIN_X, y0: WORLD_MIN_Y, x1: WORLD_MAX_X, y1: WORLD_MAX_Y }
        : map.bounds;

      roster.forEach((enemy) => {
        if (enemy.isDead) return;

        const next = stepEnemy(enemy, mapPlayers, this.enemyTickMs);
        const x = clampNum(Math.round(next.x), bounds.x0, bounds.x1, enemy.x);
        const y = clampNum(Math.round(next.y), bounds.y0, bounds.y1, enemy.y);
        if (x === enemy.x && y === enemy.y) return;

        enemy.x = x;
        enemy.y = y;
        grid.update(enemy);
        moved.push({ id: enemy.id, x, y });
      });

      if (moved.length) {
        this.broadcastToMap(mapId, { type: "enemy_moved", payload: { enemies: moved } });
      }

      // Player health is server-owned, so monsters bite on the server clock too.
      if (mapPlayers.length) this.tickBites(mapPlayers, mapId);
    });
  }

  /**
   * Apply wolf bites to nearby players on the server tick. One bite per player per
   * cooldown (whichever wolf is closest), respecting the shared immunity window.
   * @param {Array<Object>} players
   */
  tickBites(players, mapId = DEFAULT_MAP_ID) {
    const now = Date.now();
    const grid = this.gridFor(mapId);

    players.forEach((player) => {
      if (now < player.nextBiteAt || now < player.invulnerableUntil) return;

      const candidates = grid
        .getNear(player.x, player.y, BITE_TUNING.range)
        .filter((enemy) => !enemy.isDead);
      let nearest = null;
      let nearestDistance = Infinity;
      candidates.forEach((enemy) => {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (distance < nearestDistance) {
          nearest = enemy;
          nearestDistance = distance;
        }
      });
      if (!nearest) return;

      player.nextBiteAt = now + BITE_TUNING.cooldownMs;

      // Bites use the monster's own combat block, so a level-30 boss hits far
      // harder than a level-3 stray dog.
      const result = computeDamage(
        {
          attack: nearest.attack,
          defense: nearest.defense,
          critRate: nearest.critRate,
          critDamage: nearest.critDamage
        },
        { defense: player.defense },
        Math.random
      );
      this.applyPlayerDamage(player, result.damage, null, "wolf", nearest.name);
    });
  }

  /**
   * Queue the authoritative respawn for a defeated enemy.
   * @param {number} enemyId
   */
  scheduleEnemyRespawn(enemy) {
    const key = `${enemy.mapId}:${enemy.id}`;
    const existing = this.enemyRespawnTimers.get(key);
    if (existing) clearTimeout(existing);

    // A boss can override the global timer with its own (much longer) delay.
    const delay = Number.isFinite(enemy.respawnMs) ? enemy.respawnMs : this.enemyRespawnMs;
    const timer = setTimeout(() => this.respawnEnemy(enemy.mapId, enemy.id), delay);
    if (timer.unref) timer.unref();
    this.enemyRespawnTimers.set(key, timer);
  }

  /**
   * Restore a defeated enemy and tell every player on the map at once.
   * @param {string} mapId
   * @param {number} enemyId
   */
  respawnEnemy(mapId, enemyId) {
    this.enemyRespawnTimers.delete(`${mapId}:${enemyId}`);

    const enemy = this.rosterFor(mapId).get(enemyId);
    if (!enemy || !enemy.isDead) return;

    enemy.hp = enemy.maxHp;
    enemy.x = enemy.homeX;
    enemy.y = enemy.homeY;
    enemy.isDead = false;
    this.gridFor(mapId).add(enemy);

    this.broadcastToMap(mapId, { type: "enemy_respawned", payload: this.enemySnapshot(enemy) });
  }

  /**
   * Handle player disconnect
   * @param {WebSocket} ws
   */
  handleDisconnect(ws) {
    const player = this.players.get(ws);
    if (player) {
      this.players.delete(ws);

      // Only drop the id -> socket mapping when it still belongs to this socket.
      // A reconnect registers a new socket under the same id first, and the old
      // socket's close lands afterwards; deleting unconditionally would orphan the
      // fresh connection (its peers disappear and every incoming `player_hit` is
      // refused as "target_missing").
      if (this.playerById.get(player.id)?.ws === ws) {
        this.playerById.delete(player.id);
      }

      // A superseded socket has nothing to announce: the player is still here on
      // the socket that replaced it.
      if (ws.__superseded) return;

      const mapId = player.mapId || DEFAULT_MAP_ID;
      const mapStillOccupied = Array.from(this.players.values()).some(
        (other) => other.mapId === mapId
      );

      // When the last player leaves a map, walk its living monsters home.
      if (!mapStillOccupied) {
        const grid = this.gridFor(mapId);
        this.rosterFor(mapId).forEach((enemy) => {
          if (enemy.isDead) return;
          enemy.x = enemy.homeX;
          enemy.y = enemy.homeY;
          grid.update(enemy);
        });
      }

      // Notify other players standing on the same map
      this.broadcastToMap(mapId, { type: "player_left", payload: { id: player.id } });
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
