import { WebSocketServer, WebSocket } from "ws";
import { rollEnemyReward } from "../rewards.js";
import { store } from "../data/playerDb.js";
import { characterDb } from "../data/characterDb.js";
import { userDb } from "../data/userDb.js";
import { verifySessionToken } from "../auth/session.js";
import { clampToRange } from "../../../src/game/aim.js";
import { stepEnemy, BITE_TUNING } from "../../../src/game/enemyAi.js";
import { canPvpAttack, dodgeChance, rollDodge, PLAYER_IFRAME_MS } from "../../../src/game/pvp.js";
import { computeDamage } from "../../../src/game/damage.js";
import {
  applyEnemyControlEffects,
  clearEnemyControlEffects,
  enemyMoveScale,
  isEnemyStunned
} from "../../../src/game/enemyEffects.js";
import {
  HIT_RADIUS_SLACK,
  HIT_WINDOW_MS,
  MAX_HITS_PER_CAST as SHARED_MAX_HITS_PER_CAST,
  MELEE_REACH,
  attackIntervalFor,
  consumeCastHit,
  hasSplash,
  isChannelSkill,
  maxTravelDistance,
  splashMultiplier,
  splashVictims
} from "../../../src/game/combatRules.js";
import { advanceRegen, billableDeltaMs, passiveRegenRate } from "../../../src/game/passiveRegen.js";
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
  MAX_LEVEL,
  applyReward,
  normalizeProgress,
  progressPayload
} from "../../../src/game/progression.js";
import { skillById, effectiveSkillMpCost, effectiveSkillCooldown, skillUsable, skillLearnable, skillLockReason } from "../../../src/game/skills.js";
import { computeSkillDamage } from "../../../src/game/skillDamage.js";
import { deriveCombatStats } from "../../../src/game/derivedStats.js";
import { getConsumableEffect, skillIdForBook } from "../../../src/game/items.js";
import { equippedWeaponType } from "../../../src/game/equipment.js";
import { shopPurchase } from "../../../src/game/shop.js";
import {
  consumeItem,
  equipItem,
  grantItem,
  readBag,
  readEquipment,
  unequipSlot
} from "../game/playerBag.js";

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

/**
 * Clamp a client-reported impact point to the map and the skill's cast range.
 * The point authorizes AoE hits; a missing aim falls back to the caster so the
 * old caster-centred behaviour still works.
 * @param {Object} skill
 * @param {number} x caster X
 * @param {number} y caster Y
 * @param {Object} payload
 * @param {{x0:number,y0:number,x1:number,y1:number}} bounds
 * @returns {{x:number,y:number}}
 */
const clampCastAim = (skill, x, y, payload, bounds) => {
  const aim = {
    x: clampNum(payload.aimX, bounds.x0, bounds.x1, x),
    y: clampNum(payload.aimY, bounds.y0, bounds.y1, y)
  };
  const reach = Number(skill.range) > 0 ? Number(skill.range) : Number(skill.radius) || 0;
  return clampToRange({ x, y }, aim, reach);
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
 * socket into thousands of broadcast messages. Sits below the client's own
 * ~400ms attack cadence, so it never throttles legitimate play.
 */
export const ACTION_COOLDOWN_MS = 300;

/** How long after a cast its follow-up hit(s) stay authorized (an AoE may hit many). */
export const CAST_HIT_WINDOW_MS = HIT_WINDOW_MS;

/** Maximum follow-up hit messages accepted from one cast (AoE headroom). */
export const MAX_HITS_PER_CAST = SHARED_MAX_HITS_PER_CAST;

/**
 * Minimum gap (ms) between position writes to SQLite. The client reports a step
 * every ~50ms, so writing each one would hammer the ledger for no benefit: a
 * relog only needs the last resting spot. Server-driven transitions and a
 * disconnect force a write, so the final point is never lost.
 */
const POSITION_PERSIST_MS = 5000;

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
      // Server-owned control effects: a skill may stun or slow this monster.
      stunUntil: 0,
      slowUntil: 0,
      slowPct: 0,
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
    this.findCharacter =
      options.findCharacter || ((userId, characterId) => characterDb.findById(userId, characterId));
    this.maxBufferedBytes = Number.isFinite(options.maxBufferedBytes)
      ? options.maxBufferedBytes
      : MAX_BUFFERED_BYTES;
    // Injectable so tests can pin the directional-dodge roll.
    this.random = typeof options.random === "function" ? options.random : Math.random;

    this.setupServer();
    this.startHeartbeat();
    this.startEnemyTick();
    this.startRegenTick();
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

      case "use_item":
        this.handleUseItem(ws, msg.payload);
        break;

      case "equip_item":
        this.handleEquipItem(ws, msg.payload);
        break;

      case "unequip_slot":
        this.handleUnequipSlot(ws, msg.payload);
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
    // A verified session token names the account, and the requested character
    // must belong to it. Guests have no ledger to own, and letting an arbitrary
    // client id into the roster would let one socket impersonate a peer, so the
    // join is refused instead.
    const userId = this.verifyToken(payload.token);
    const requestedCharacter = sanitizeStr(payload.characterId || "", 64);
    if (!userId || !requestedCharacter || !this.ownsCharacter(userId, requestedCharacter)) {
      this.send(ws, { type: "join_rejected", payload: { reason: "auth" } });
      return;
    }

    const character = this.findCharacter(userId, requestedCharacter);
    if (!character) {
      this.send(ws, { type: "join_rejected", payload: { reason: "character" } });
      return;
    }

    const characterId = requestedCharacter;
    // The character id is the canonical player id: it cannot be spoofed, and two
    // tabs of the same character resolve to the same roster entry.
    const playerId = characterId;
    const displayName = sanitizeStr(character.name || "Lãng Khách", 32);
    const username = displayName;
    let equipment = readEquipment(characterId);

    // Characters created before weapons existed (and any hero who lost their
    // weapon) get the starter sword and Kiếm Khí, so the starting kit is always
    // playable. New characters already receive both at creation time.
    if (!equipment.weapon) {
      if (!readBag(characterId)["kiem-lang-khach"]) {
        grantItem(characterId, "kiem-lang-khach", 1);
      }
      const equipped = equipItem(characterId, "kiem-lang-khach");
      if (equipped.ok) equipment = equipped.equipment;
    }

    const learnedSkills = store.getLearnedSkills(characterId);
    if (!learnedSkills.includes("kiem_khi")) {
      store.addLearnedSkill(characterId, "kiem_khi");
      learnedSkills.push("kiem_khi");
    }

    // The server is the economy's source of truth: a fresh character starts at
    // level 1; an existing one resumes from its persisted ledger, never from a
    // client-reported level. Gender comes from the stored character.
    const saved = store.getProgress(characterId);
    const progress = saved ? normalizeProgress(saved) : { level: 1, exp: 0, coins: 0, kills: 0 };
    store.setProgress(characterId, progress, displayName);

    const stats = deriveCombatStats({ level: progress.level, equipment });
    const storedVitals = store.getVitals(characterId);
    const hp =
      storedVitals?.hp == null
        ? stats.maxHp
        : clampNum(storedVitals.hp, 0, stats.maxHp, stats.maxHp);
    const mp =
      storedVitals?.mp == null
        ? stats.maxMp
        : clampNum(storedVitals.mp, 0, stats.maxMp, stats.maxMp);
    store.setVitals(characterId, { hp, mp });

    const isAdmin = userDb.isAdmin(userId);
    let bag = readBag(characterId);
    if (isAdmin && !bag["lenh-bai-gm"]) {
      bag = grantItem(characterId, "lenh-bai-gm", 1).bag;
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

    // Where this hero stands. The point the server persisted wins over the join
    // packet: the client only names the map it believes it is on (a first join,
    // or a legacy save with no server-side position yet), and even that point is
    // clamped to the map's bounds. A stored map that no longer exists falls back
    // to the requested/default city.
    const requestedMapId = sanitizeStr(payload.mapId || "", 64);
    const storedPosition = store.getPosition(characterId);
    const storedMapId =
      storedPosition && isKnownMap(storedPosition.mapId) ? storedPosition.mapId : null;
    const mapId = storedMapId || (isKnownMap(requestedMapId) ? requestedMapId : DEFAULT_MAP_ID);
    const entryMap = getMap(mapId);
    const spawnX = storedMapId
      ? clampNum(storedPosition.x, entryMap.bounds.x0, entryMap.bounds.x1, entryMap.spawn.x)
      : clampNum(payload.x, entryMap.bounds.x0, entryMap.bounds.x1, entryMap.spawn.x);
    const spawnY = storedMapId
      ? clampNum(storedPosition.y, entryMap.bounds.y0, entryMap.bounds.y1, entryMap.spawn.y)
      : clampNum(payload.y, entryMap.bounds.y0, entryMap.bounds.y1, entryMap.spawn.y);

    const playerData = {
      id: playerId,
      username,
      displayName,
      mapId,
      x: spawnX,
      y: spawnY,
      vx: clampNum(payload.vx, -500, 500, 0),
      vy: clampNum(payload.vy, -500, 500, 0),
      direction: payload.direction === "left" ? "left" : "right",
      stance: payload.stance === "side" ? "side" : "front",
      // Worn gear is server-owned: it comes from storage, never from the join packet.
      equipment,
      isAdmin,
      // Character gender drives the peer's rig silhouette ("male" | "female").
      gender: character.gender === "female" ? "female" : "male",
      characterId,
      progress,
      questRewarded: saved?.questRewarded ?? false,
      // Level and both HP/MP ceilings are derived from the server-owned ledger.
      level: progress.level,
      maxHp: stats.maxHp,
      hp,
      maxMp: stats.maxMp,
      mp,
      // Combat stats are derived from level + worn gear, then updated by buffs.
      attack: stats.attack,
      defense: stats.defense,
      critRate: stats.critRate,
      critDamage: stats.critDamage,
      attackSpeed: stats.attackSpeed,
      /** Active timed buffs: { stat, amount, until, skillId }. */
      buffs: [],
      /** Weapon type of the worn weapon; decides which skill kit may be cast. */
      weaponType: equippedWeaponType(equipment),
      /** Skill ids studied from books (starter skills are always known). */
      learnedSkills,
      pkFlag: payload.pkFlag === true,
      invulnerableUntil: 0,
      nextBiteAt: 0,
      nextAttackAt: 0,
      nextHitAt: 0,
      /** skill id -> timestamp the next cast is allowed. */
      skillReadyAt: Object.create(null),
      /** { skillId, at, hits, aim } of the last accepted cast, used to authorize hits. */
      lastCast: null,
      /** { at } of the last accepted normal swing, used to authorize plain hits. */
      lastSwing: null,
      /** Movement validation baseline. */
      lastMoveAt: Date.now(),
      lastX: spawnX,
      lastY: spawnY,
      /** Last time this position was written to SQLite (throttled by POSITION_PERSIST_MS). */
      positionSavedAt: 0,
      /** Passive regen accumulator, billed by the server tick. */
      regenAt: Date.now(),
      regenCarry: 0
    };

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

    // Publish the server-owned state a joining client must render instead of
    // recomputing it: bag, worn gear, derived combat stats and vitals.
    this.send(ws, { type: "inventory_sync", payload: { inventory: bag } });
    this.send(ws, { type: "equipment_sync", payload: { equipment } });
    this.send(ws, { type: "skills_sync", payload: { skills: learnedSkills } });
    this.send(ws, {
      type: "player_stats",
      payload: { id: playerId, ...stats }
    });
    this.send(ws, {
      type: "player_hp",
      payload: { id: playerId, hp, maxHp: stats.maxHp }
    });
    this.send(ws, {
      type: "player_mp",
      payload: { id: playerId, mp, maxMp: stats.maxMp }
    });

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
    // Server-driven travel is not a movement exploit: reset the validation baseline.
    player.lastX = player.x;
    player.lastY = player.y;
    player.lastMoveAt = Date.now();
    // A map transition must be durable immediately, or a relog right after the
    // portal drops the hero back on the map they just left.
    this.persistPosition(player, { force: true });

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
    const targetX = clampNum(payload.x, bounds.x0, bounds.x1, player.x);
    const targetY = clampNum(payload.y, bounds.y0, bounds.y1, player.y);
    const now = Date.now();

    // A client may only cover as much ground as its walk speed allows since the
    // previous accepted step. A larger jump (teleport, speed hack) is refused and
    // the mover is snapped back to the server position. Server-driven moves
    // (portal, respawn, Hồi Thành Phù, GM) reset the baseline themselves.
    const speedPct = this.effectiveStats(player, now).speedPct || 0;
    const allowed = maxTravelDistance(now - player.lastMoveAt, 1 + speedPct);
    if (Math.hypot(targetX - player.lastX, targetY - player.lastY) > allowed) {
      this.send(ws, {
        type: "player_moved",
        payload: {
          id: player.id,
          x: player.x,
          y: player.y,
          vx: 0,
          vy: 0,
          direction: player.direction,
          stance: player.stance
        }
      });
      return;
    }

    player.x = targetX;
    player.y = targetY;
    player.lastX = targetX;
    player.lastY = targetY;
    player.lastMoveAt = now;
    player.vx = clampNum(payload.vx, -2500, 2500, 0);
    player.vy = clampNum(payload.vy, -2500, 2500, 0);
    if (payload.direction) {
      player.direction = payload.direction === "left" ? "left" : "right";
    }
    if (payload.stance) {
      player.stance = payload.stance === "side" ? "side" : "front";
    }

    // Keep the stored spot close to the live one; the throttle caps the writes.
    this.persistPosition(player);

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
   * Push the authoritative bag to its owner.
   * @param {Object} player
   * @param {Record<string, number>} bag
   */
  sendInventory(player, bag) {
    const ws = this.playerById.get(player.id)?.ws || null;
    this.send(ws, { type: "inventory_sync", payload: { inventory: bag } });
  }

  /**
   * Broadcast the worn gear to peers so their rigs redraw. The owner already has
   * its own copy from `equipment_sync`.
   * @param {Object} player
   * @param {WebSocket|null} [excludeWs]
   */
  broadcastEquipment(player, excludeWs = null) {
    this.broadcastPlayerState(
      player,
      {
        type: "player_equipment",
        payload: { id: player.id, equipment: player.equipment }
      },
      excludeWs
    );
  }

  /**
   * Move a player to their current map's spawn (Hồi Thành Phù) and tell everyone,
   * including the mover, where they landed.
   * @param {Object} player
   */
  teleportToSpawn(player) {
    const map = getMap(player.mapId);
    player.x = map.spawn.x;
    player.y = map.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.lastX = player.x;
    player.lastY = player.y;
    player.lastMoveAt = Date.now();
    this.persistPosition(player, { force: true });

    this.broadcastPlayerState(player, {
      type: "player_moved",
      payload: {
        id: player.id,
        x: player.x,
        y: player.y,
        vx: 0,
        vy: 0,
        direction: player.direction,
        stance: player.stance
      }
    });
  }

  /**
   * Consume one bag item. The bag decrement, the effect and the resulting pools
   * are all decided here; the client only names the item.
   * @param {WebSocket} ws
   * @param {{itemId?:string}} payload
   */
  handleUseItem(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player || !player.characterId) return;

    const itemId = sanitizeStr(payload.itemId, 64);
    const bookSkillId = skillIdForBook(itemId);
    if (bookSkillId) {
      this.handleLearnSkill(ws, player, itemId, bookSkillId);
      return;
    }

    const effect = getConsumableEffect(itemId);
    const consumed = consumeItem(player.characterId, itemId, 1);

    if (!effect || !consumed.ok) {
      if (!consumed.ok) this.sendInventory(player, consumed.bag);
      this.send(ws, {
        type: "item_result",
        payload: {
          ok: false,
          action: "use",
          itemId,
          reason: effect ? consumed.reason : "not_usable"
        }
      });
      return;
    }

    let healed = 0;
    let restored = 0;
    if (effect.hp) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + effect.hp);
      healed = player.hp - before;
    }
    if (effect.mp) {
      const before = player.mp;
      player.mp = Math.min(player.maxMp, player.mp + effect.mp);
      restored = player.mp - before;
    }

    this.sendInventory(player, consumed.bag);

    if (healed > 0) {
      this.broadcastPlayerState(player, {
        type: "player_hp",
        payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
      });
    }
    if (restored > 0) this.broadcastMp(player);
    if (effect.teleport === "spawn") this.teleportToSpawn(player);

    this.persistVitals(player);
    this.send(ws, {
      type: "item_result",
      payload: {
        ok: true,
        action: "use",
        itemId,
        heal: healed,
        restoreMp: restored,
        hp: player.hp,
        maxHp: player.maxHp,
        mp: player.mp,
        maxMp: player.maxMp
      }
    });
  }

  /**
   * Study a skill book: validate the level/prerequisites, consume one copy and
   * record the skill on the character. The client is told whether the study
   * succeeded so it can update the skill panel and the bag.
   * @param {WebSocket} ws
   * @param {Object} player
   * @param {string} itemId
   * @param {string} skillId
   */
  handleLearnSkill(ws, player, itemId, skillId) {
    const skill = skillById(skillId);
    const learned = Array.isArray(player.learnedSkills)
      ? player.learnedSkills
      : store.getLearnedSkills(player.characterId);

    const reject = (reason, extra = {}) => {
      this.send(ws, {
        type: "item_result",
        payload: { ok: false, action: "learn", itemId, skillId, reason, ...extra }
      });
    };

    if (!skill) return reject("not_usable");
    if (skill.starter || learned.includes(skill.id)) return reject("already_learned");
    if (!skillLearnable(skill, player.level, learned)) {
      const lock = skillLockReason(skill, player.level, learned);
      return reject(lock?.kind === "level" ? "level" : "prereq", {
        level: lock?.level ?? skill.unlockLevel,
        prereqId: lock?.id || null
      });
    }

    const consumed = consumeItem(player.characterId, itemId, 1);
    if (!consumed.ok) {
      this.sendInventory(player, consumed.bag);
      return reject(consumed.reason || "missing_item");
    }

    player.learnedSkills = store.addLearnedSkill(player.characterId, skill.id);
    this.sendInventory(player, consumed.bag);
    this.send(ws, { type: "skills_sync", payload: { skills: player.learnedSkills } });
    this.send(ws, {
      type: "item_result",
      payload: { ok: true, action: "learn", itemId, skillId: skill.id }
    });
  }

  /**
   * Equip one bag item. The bag and equipment writes are atomic from the
   * server's point of view, and the client is only told the result.
   * @param {WebSocket} ws
   * @param {{itemId?:string}} payload
   */
  handleEquipItem(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player || !player.characterId) return;

    const itemId = sanitizeStr(payload.itemId, 64);
    const result = equipItem(player.characterId, itemId);
    if (!result.ok) {
      this.sendInventory(player, result.bag);
      this.send(ws, {
        type: "item_result",
        payload: { ok: false, action: "equip", itemId, slot: result.slot, reason: result.reason }
      });
      return;
    }

    player.equipment = result.equipment;
    player.weaponType = equippedWeaponType(result.equipment);
    this.sendInventory(player, result.bag);
    this.send(ws, { type: "equipment_sync", payload: { equipment: result.equipment } });
    this.sendPlayerStats(player);
    this.broadcastEquipment(player, ws);
    this.send(ws, {
      type: "item_result",
      payload: { ok: true, action: "equip", itemId, slot: result.slot }
    });
  }

  /**
   * Take off whatever is worn in one slot and return it to the bag.
   * @param {WebSocket} ws
   * @param {{slot?:string}} payload
   */
  handleUnequipSlot(ws, payload = {}) {
    const player = this.players.get(ws);
    if (!player || !player.characterId) return;

    const slot = sanitizeStr(payload.slot, 32);
    const itemId = player.equipment?.[slot] || null;
    const result = unequipSlot(player.characterId, slot);
    if (!result.ok) {
      this.send(ws, {
        type: "item_result",
        payload: { ok: false, action: "unequip", slot, reason: result.reason }
      });
      return;
    }

    player.equipment = result.equipment;
    player.weaponType = equippedWeaponType(result.equipment);
    this.sendInventory(player, result.bag);
    this.send(ws, { type: "equipment_sync", payload: { equipment: result.equipment } });
    this.sendPlayerStats(player);
    this.broadcastEquipment(player, ws);
    this.send(ws, {
      type: "item_result",
      payload: { ok: true, action: "unequip", slot, itemId }
    });
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
      const granted = grantItem(player.characterId, purchase.item.id, purchase.qty);
      if (!granted.ok) throw new Error("Invalid purchase item");
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
    this.sendInventory(player, readBag(player.characterId));

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
   * Derived combat stats for a player right now: base + worn gear + active
   * buffs. Expired buffs are pruned here so the array cannot grow forever.
   * @param {Object} player
   * @param {number} [now]
   * @returns {ReturnType<typeof deriveCombatStats>}
   */
  effectiveStats(player, now = Date.now()) {
    if (Array.isArray(player.buffs)) {
      player.buffs = player.buffs.filter((buff) => !(buff?.until <= now));
    }
    return deriveCombatStats({
      level: player.level,
      equipment: player.equipment,
      buffs: player.buffs,
      now
    });
  }

  /**
   * Recompute and store the player's combat stats after a level, gear or buff
   * change. HP/MP ceilings follow the level, so both pools are clamped.
   * @param {Object} player
   * @param {number} [now]
   * @returns {ReturnType<typeof deriveCombatStats>}
   */
  refreshStats(player, now = Date.now()) {
    const stats = this.effectiveStats(player, now);
    player.attack = stats.attack;
    player.defense = stats.defense;
    player.critRate = stats.critRate;
    player.critDamage = stats.critDamage;
    player.attackSpeed = stats.attackSpeed;
    player.maxHp = stats.maxHp;
    player.maxMp = stats.maxMp;
    player.hp = Math.min(player.hp, stats.maxHp);
    player.mp = Math.min(player.mp, stats.maxMp);
    return stats;
  }

  /**
   * Push the authoritative stat block to its owner (never to peers).
   * @param {Object} player
   * @returns {ReturnType<typeof deriveCombatStats>}
   */
  sendPlayerStats(player) {
    const stats = this.refreshStats(player);
    const ws = this.playerById.get(player.id)?.ws || null;
    this.send(ws, { type: "player_stats", payload: { id: player.id, ...stats } });
    return stats;
  }

  /**
   * Persist HP/MP after a change. Best-effort: a failed write is logged but the
   * live state stays correct, and the next change retries.
   * @param {Object} player
   */
  persistVitals(player) {
    if (!player.characterId) return;
    try {
      store.setVitals(player.characterId, { hp: player.hp, mp: player.mp });
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[WebSocket] Failed to persist vitals:", err.message);
      }
    }
  }

  /**
   * Persist the map/position the server currently owns, so a relog or a different
   * device resumes where the hero stood instead of falling back to the spawn.
   *
   * Throttled: the client reports a step every ~50ms, and only the last resting
   * spot matters, so a plain move writes at most once per `POSITION_PERSIST_MS`.
   * Server-driven transitions (portal, respawn, GM teleport) and a disconnect
   * pass `force` so the new spot is never lost. Best-effort: a failed write is
   * logged but the live position stays correct.
   * @param {Object} player
   * @param {{force?:boolean}} [options]
   */
  persistPosition(player, { force = false } = {}) {
    if (!player?.characterId) return;
    const now = Date.now();
    if (!force && now - (player.positionSavedAt || 0) < POSITION_PERSIST_MS) return;
    player.positionSavedAt = now;
    try {
      store.setPosition(player.characterId, {
        mapId: player.mapId,
        x: player.x,
        y: player.y
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[WebSocket] Failed to persist position:", err.message);
      }
    }
  }

  /**
   * Apply a cast's self effects (buffs, heals) on the server. Damage-over-time and
   * monster effects are resolved by the hit handlers.
   * @param {Object} player
   * @param {Object} skill
   * @param {number} now
   */
  applySkillSelfEffects(player, skill, now) {
    let statsChanged = false;
    let healed = 0;

    for (const effect of skill.effects || []) {
      if (effect?.kind === "buff") {
        const amount = Number(effect.amount) || 0;
        const duration = Number(effect.duration) || 0;
        if (!effect.stat || duration <= 0) continue;
        player.buffs.push({
          skillId: skill.id,
          stat: effect.stat,
          amount,
          until: now + duration
        });
        statsChanged = true;
      } else if (effect?.kind === "heal") {
        const flat = Number(effect.amount) || 0;
        const pct = Number(effect.pctMaxHp) || 0;
        const amount = Math.round(flat + player.maxHp * pct);
        if (amount > 0) {
          const before = player.hp;
          player.hp = Math.min(player.maxHp, player.hp + amount);
          healed += player.hp - before;
        }
      }
    }

    if (statsChanged) this.sendPlayerStats(player);
    if (healed > 0) {
      this.broadcastPlayerState(player, {
        type: "player_hp",
        payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
      });
      this.persistVitals(player);
    }
  }

  /**
   * Server-side passive regen (tâm pháp): bill a short, bounded tick per player
   * and broadcast whenever a whole HP point lands.
   */
  tickRegen() {
    const now = Date.now();
    this.players.forEach((player) => {
      const rate = passiveRegenRate(player.weaponType, player.level, player.learnedSkills);
      const previous = player.regenAt;
      player.regenAt = now;

      if (rate <= 0 || player.hp <= 0) {
        player.regenCarry = 0;
        return;
      }

      const delta = billableDeltaMs(previous, now);
      if (delta <= 0) return;

      const { carry, amount } = advanceRegen(player.regenCarry, rate, delta);
      player.regenCarry = carry;
      if (amount <= 0) return;

      player.hp = Math.min(player.maxHp, player.hp + amount);
      this.broadcastPlayerState(player, {
        type: "player_hp",
        payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
      });
      this.persistVitals(player);
    });
  }

  /**
   * Start the regen tick. Short interval so `billableDeltaMs` never sees a gap
   * larger than its one-second ceiling.
   */
  startRegenTick() {
    this.regenTimer = setInterval(() => this.tickRegen(), 250);
    if (this.regenTimer.unref) this.regenTimer.unref();
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
    const requested = skillById(payload.skill);

    // A skill id that exists but belongs to another weapon, was never studied, or
    // is still level-locked is refused instead of silently degrading into a free
    // plain swing. Passives are refused first: they run on their own and are
    // never castable, whatever weapon is worn.
    if (requested?.passive) {
      this.send(ws, { type: "skill_rejected", payload: { skillId: requested.id, reason: "passive" } });
      return;
    }
    if (requested && requested.weapon !== player.weaponType) {
      this.send(ws, { type: "skill_rejected", payload: { skillId: requested.id, reason: "weapon" } });
      return;
    }
    if (requested && !skillUsable(requested, player.level, player.learnedSkills)) {
      this.send(ws, { type: "skill_rejected", payload: { skillId: requested.id, reason: "locked" } });
      return;
    }
    if (requested?.passive) {
      this.send(ws, { type: "skill_rejected", payload: { skillId: requested.id, reason: "passive" } });
      return;
    }

    const skill = requested || null;
    const skillId = skill ? skill.id : "normal";
    const cadence = Math.max(
      100,
      Math.round(attackIntervalFor(this.effectiveStats(player, now).attackSpeed))
    );
    if (now < player.nextAttackAt) return;

    if (skill) {
      const readyAt = player.skillReadyAt[skillId] || 0;
      if (now < readyAt) return;
      // Test mode reports 0, so the stamp never blocks the next cast.
      player.skillReadyAt[skillId] = now + effectiveSkillCooldown(skillId);
    }

    // Test mode reports 0, so the in-memory pool is never debited.
    const cost = effectiveSkillMpCost(skillId);
    if (cost > 0) {
      if (player.mp < cost) {
        // Refuse the cast and resync the caster so its HUD matches the server.
        this.broadcastMp(player);
        return;
      }
      player.mp -= cost;
      this.broadcastMp(player);
      this.persistVitals(player);
    }

    player.nextAttackAt = now + cadence;

    const aimBounds = getMap(player.mapId).bounds;
    const x = clampNum(payload.x, aimBounds.x0, aimBounds.x1, player.x);
    const y = clampNum(payload.y, aimBounds.y0, aimBounds.y1, player.y);
    // Range-clamp against the server-owned position, not the client-reported
    // broadcast coordinates, so a forged x/y cannot widen the aim.
    const aim = skill ? clampCastAim(skill, player.x, player.y, payload, aimBounds) : null;
    const facingRight = payload.facingRight !== false;

    // A successful cast authorizes the skill's follow-up hit; a plain swing
    // authorizes exactly one normal hit. `enemy_hit` / `player_hit` refuse a hit
    // that does not follow an accepted action, so damage cannot be minted freely.
    if (skill) {
      player.lastCast = { skillId, at: now, hits: 0, aim };
      this.applySkillSelfEffects(player, skill, now);
    } else {
      player.lastSwing = { at: now, used: false };
    }

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
   * Authorize one follow-up strike and recompute its damage from server-owned
   * stats. Shared by monster (`enemy_hit`) and player (`player_hit`) hits: both
   * must follow an accepted cast or swing, and neither trusts a client number.
   *
   * @param {Object} attacker server player object
   * @param {number} defenderDefense target's defense (monster catalog or derived)
   * @param {*} requestedSkill raw `payload.skill`
   * @param {number} now
   * @returns {{ skill: Object|null, attackerStats: Object, damage: number }|null}
   *   null when no accepted cast/swing authorizes the hit
   */
  resolveHitDamage(attacker, defenderDefense, requestedSkill, now) {
    const attackerStats = this.effectiveStats(attacker, now);
    const skill = requestedSkill ? skillById(requestedSkill) : null;

    if (skill) {
      if (skill.weapon !== attacker.weaponType) return null;
      if (!skillUsable(skill, attacker.level, attacker.learnedSkills)) return null;
      if (!consumeCastHit(attacker.lastCast, skill, now)) return null;
      return {
        skill,
        attackerStats,
        damage: computeSkillDamage(
          skill,
          attackerStats,
          { defense: defenderDefense },
          this.random
        ).damage
      };
    }

    const swing = attacker.lastSwing;
    if (!swing || swing.used || now - swing.at > HIT_WINDOW_MS) return null;
    swing.used = true;
    return {
      skill: null,
      attackerStats,
      damage: computeDamage(attackerStats, { defense: defenderDefense }, this.random).damage
    };
  }

  /**
   * Whether a target stands inside the area the server authorized for an AoE
   * cast. Non-AoE casts and casts that do not match are left to their own checks.
   * @param {Object|null} cast server-side `lastCast`
   * @param {Object|null} skill
   * @param {{x:number,y:number}} target
   * @param {{x:number,y:number}} fallback caster position when the cast has no aim
   * @returns {boolean}
   */
  isInsideCastArea(cast, skill, target, fallback) {
    if (!(skill?.radius > 0) || cast?.skillId !== skill.id) return true;
    const center = cast.aim || fallback;
    return (
      Math.hypot(center.x - target.x, center.y - target.y) <= skill.radius + HIT_RADIUS_SLACK
    );
  }

  /**
   * Apply an authoritative PvP hit. Damage is recomputed here from server-owned
   * stats (gear, level, buffs) and the target's own defense; the server then
   * checks flags/range/immunity and applies it to the target's HP. The reported
   * `payload.damage` is ignored entirely.
   * @param {WebSocket} ws
   * @param {Object} payload
   */
  handlePlayerHit(ws, payload = {}) {
    const attacker = this.players.get(ws);
    if (!attacker) return;

    // Rate-limit plain swings and one-shot skills per attacker so a spamming
    // client can't amplify one socket into a broadcast storm. A channel's ticks
    // are bounded by its cast's own hit cap, so they are not throttled here.
    const now = Date.now();
    const skill = payload.skill ? skillById(payload.skill) : null;
    const channelled = Boolean(skill && isChannelSkill(skill));
    if (!channelled) {
      if (now < attacker.nextHitAt) return;
      attacker.nextHitAt = now + ACTION_COOLDOWN_MS;
    }

    const targetEntry = this.playerById.get(payload.targetId);
    const target = targetEntry?.data;
    if (!target) return this.rejectHit(ws, "target_missing");

    const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);

    // An AoE cast's hit must land inside the area the server authorised, not just
    // inside PvP range: the client can name any flagged player it likes.
    const cast = attacker.lastCast;
    if (!this.isInsideCastArea(cast, skill, target, attacker)) {
      const center = cast?.aim || attacker;
      return this.rejectHit(ws, "range", {
        targetId: target.id,
        distance: Math.round(Math.hypot(center.x - target.x, center.y - target.y))
      });
    }

    // A single-target skill also has its own reach, which must be enforced here:
    // PvP range alone would let a short melee skill hit across a whole tile.
    if (skill && skill.radius === 0 && distance > skill.range + HIT_RADIUS_SLACK) {
      return this.rejectHit(ws, "range", {
        targetId: target.id,
        distance: Math.round(distance)
      });
    }

    const targetStats = this.effectiveStats(target, now);
    const hit = this.resolveHitDamage(attacker, targetStats.defense, payload.skill, now);
    if (hit === null) return this.rejectHit(ws, "no_action");
    if (!(hit.damage > 0)) return this.rejectHit(ws, "damage_invalid");

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

    // Splash victims are chosen before the primary can die: a killing blow
    // teleports the body to its respawn point, which would move the centre of
    // the strike. The same radius the client draws is what the server uses.
    const splashTargets = skill && hasSplash(skill)
      ? this.pvpSplashTargets(attacker, target, skill)
      : [];

    if (!this.applyPlayerDamage(target, hit.damage, attacker, "pvp", null, { ignoreIframe: channelled })) {
      return this.rejectHit(ws, "iframe");
    }

    this.applyPvpSplash(attacker, splashTargets, skill, now, hit.attackerStats);
  }

  /**
   * Flagged players caught by a splash strike centred on `primary`.
   * @param {Object} attacker
   * @param {Object} primary the player the strike landed on
   * @param {Object} skill
   * @returns {Object[]} up to `splashMaxTargets(skill)` players
   */
  pvpSplashTargets(attacker, primary, skill) {
    const candidates = [];
    for (const other of this.players.values()) {
      if (other.id === attacker.id || other.id === primary.id) continue;
      if (other.mapId !== primary.mapId || other.hp <= 0 || other.pkFlag !== true) continue;
      candidates.push(other);
    }
    return splashVictims(primary, candidates, skill);
  }

  /**
   * Spread a landed PvP strike onto the other players caught in its radius,
   * mirroring the monster splash so the skill behaves the same on either target.
   * @param {Object} attacker
   * @param {Object[]} victims
   * @param {Object} skill
   * @param {number} now
   * @param {Object} [attackerStats] already-computed stats from the primary hit
   */
  applyPvpSplash(attacker, victims, skill, now, attackerStats = null) {
    if (!skill || victims.length === 0) return;

    const stats = attackerStats || this.effectiveStats(attacker, now);

    for (const victim of victims) {
      const distance = Math.hypot(attacker.x - victim.x, attacker.y - victim.y);
      if (!canPvpAttack(attacker, victim, distance)) continue;

      const victimStats = this.effectiveStats(victim, now);
      const damage = this.computeSplashDamage(skill, stats, victimStats.defense);
      if (damage <= 0) continue;

      // A splash tick is part of the same channelled strikes, so it follows the
      // same i-frame rule as the primary punch.
      this.applyPlayerDamage(victim, damage, attacker, "pvp", null, { ignoreIframe: true });
    }
  }

  /**
   * Roll one splash strike. Splash uses a fixed fraction of the skill's
   * multiplier and the same server RNG as a direct hit, for either target kind.
   * @param {Object} skill
   * @param {Object} attackerStats
   * @param {number} defenderDefense
   * @returns {number}
   */
  computeSplashDamage(skill, attackerStats, defenderDefense) {
    return computeSkillDamage(
      skill,
      attackerStats,
      { defense: defenderDefense },
      this.random,
      splashMultiplier(skill)
    ).damage;
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
   * @param {{ignoreIframe?: boolean}} [options] a channelled skill's own ticks
   *   punch through the target's i-frame and do not open a new one; all other
   *   sources stay throttled
   * @returns {boolean} whether the hit landed
   */
  applyPlayerDamage(target, damage, attacker = null, source = "wolf", sourceName = null, { ignoreIframe = false } = {}) {
    if (target.isGodMode) return false;
    const now = Date.now();
    if (!ignoreIframe) {
      if (now < target.invulnerableUntil) return false;
      target.invulnerableUntil = now + PLAYER_IFRAME_MS;
    }

    target.hp = Math.max(0, target.hp - damage);

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

    this.persistVitals(target);

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
    victim.mp = victim.maxMp;
    victim.x = map.spawn.x;
    victim.y = map.spawn.y;
    victim.vx = 0;
    victim.vy = 0;
    victim.lastX = victim.x;
    victim.lastY = victim.y;
    victim.lastMoveAt = Date.now();
    // The respawn point is where the hero will stand next time they log in.
    this.persistPosition(victim, { force: true });
    victim.invulnerableUntil = Date.now() + PLAYER_IFRAME_MS;
    this.persistVitals(victim);
    this.broadcastMp(victim);

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
        const level = clampNum(payload.level, 1, MAX_LEVEL, player.progress?.level || 1);
        if (player.progress) {
          player.progress.level = level;
          player.progress.exp = 0;
          if (player.characterId) {
            store.setProgress(player.characterId, player.progress);
          }
        }
        player.level = level;
        this.refreshStats(player);
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        this.persistVitals(player);

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
        this.sendPlayerStats(player);
        break;
      }

      case "add_level": {
        const delta = clampNum(payload.levels, 1, MAX_LEVEL, 1);
        const current = player.progress?.level || player.level || 1;
        const targetLevel = clampNum(current + delta, 1, MAX_LEVEL, current);
        this.handleGmAction(ws, { action: "set_level", level: targetLevel });
        break;
      }

      case "add_exp": {
        const exp = clampNum(payload.exp, 1, 10000000, 1000);
        if (player.progress && player.characterId) {
          const next = applyReward(player.progress, { exp });
          player.progress = { level: next.level, exp: next.exp, coins: next.coins, kills: next.kills };
          store.setProgress(player.characterId, player.progress);

          player.level = next.level;
          this.refreshStats(player);

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
            this.persistVitals(player);
          }

          this.send(ws, {
            type: "player_progress",
            payload: { ...progressPayload(player.progress), levelUps: next.levelUps }
          });
          this.sendPlayerStats(player);
        }
        break;
      }

      case "heal_full": {
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        this.persistVitals(player);
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
        for (const [id, qty] of Object.entries(items)) {
          if (typeof qty === "number" && qty > 0) grantItem(player.characterId, id, qty);
        }
        this.sendInventory(player, readBag(player.characterId));
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
        const requested = payload.spawn || targetMap.spawn;
        const x = clampNum(requested.x, targetMap.bounds.x0, targetMap.bounds.x1, targetMap.spawn.x);
        const y = clampNum(requested.y, targetMap.bounds.y0, targetMap.bounds.y1, targetMap.spawn.y);
        const currentMapId = player.mapId;

        player.x = x;
        player.y = y;
        player.vx = 0;
        player.vy = 0;
        player.nextBiteAt = 0;
        // A server-side teleport is not a movement exploit: reset the baseline.
        player.lastX = x;
        player.lastY = y;
        player.lastMoveAt = Date.now();
        this.persistPosition(player, { force: true });

        if (currentMapId !== targetMapId) {
          this.broadcastToMap(currentMapId, { type: "player_left", payload: { id: player.id } }, ws);
          player.mapId = targetMapId;

          const peers = Array.from(this.players.values())
            .filter((peer) => peer !== player && peer.mapId === targetMapId)
            .map((peer) => this.playerSnapshot(peer));

          this.send(ws, {
            type: "map_changed",
            payload: {
              mapId: targetMapId,
              spawn: { x, y },
              players: peers,
              enemies: this.getEnemyState(targetMapId)
            }
          });
          this.broadcastToMap(
            targetMapId,
            { type: "player_joined", payload: { player: this.playerSnapshot(player) } },
            ws
          );
        } else {
          this.broadcastPlayerState(player, {
            type: "player_moved",
            payload: {
              id: player.id,
              x,
              y,
              vx: 0,
              vy: 0,
              direction: player.direction,
              stance: player.stance
            }
          });
        }
        this.persistVitals(player);
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

    const now = Date.now();
    const skill = payload.skill ? skillById(payload.skill) : null;

    // A skill from another weapon kit (or one the hero never studied) must never
    // degrade into a free plain swing.
    if (
      skill &&
      (skill.weapon !== player.weaponType ||
        !skillUsable(skill, player.level, player.learnedSkills))
    ) {
      return;
    }

    // Reach/area checks run before the cast's hit budget is consumed, so a
    // mistimed hit cannot burn one of the cast's authorized strikes.
    const cast = player.lastCast;
    if (skill) {
      if (skill.radius > 0) {
        if (!this.isInsideCastArea(cast, skill, enemy, player)) return;
      } else {
        const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distance > skill.range + skill.radius + HIT_RADIUS_SLACK) return;
      }
    } else {
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (distance > MELEE_REACH + HIT_RADIUS_SLACK) return;
    }

    // Shared authorization + damage recomputation (also used by player_hit).
    const hit = this.resolveHitDamage(player, enemy.defense, payload.skill, now);
    if (!hit) return;

    const { damage, attackerStats } = hit;
    if (damage <= 0) return;

    // Already dead on the server: resync the hitter instead of applying damage twice
    if (enemy.isDead) {
      this.send(ws, { type: "enemy_hit", payload: { ...this.enemySnapshot(enemy), damage: 0 } });
      return;
    }

    // Splash victims are chosen before the primary can die, so a killing blow
    // still carries the strike's radius to the monsters standing around it.
    const splashTargets = skill && hasSplash(skill)
      ? splashVictims(enemy, Array.from(this.rosterFor(enemy.mapId).values()), skill)
      : [];

    if (this.applyEnemyDamage(player, enemy, damage, skill, now)) {
      this.rewardKill(ws, player, enemy);
    }

    for (const victim of splashTargets) {
      const splashDamage = this.computeSplashDamage(skill, attackerStats, victim.defense);
      if (this.applyEnemyDamage(player, victim, splashDamage, skill, now)) {
        this.rewardKill(ws, player, victim);
      }
    }
  }

  /**
   * Apply one authoritative damage packet to a monster and broadcast the result.
   * Shared by the primary hit and each splash victim of a channelled strike.
   * @param {Object} player attacker
   * @param {Object} enemy target monster (mutated in place)
   * @param {number} damage
   * @param {Object|null} skill the accepted skill, or null for a plain swing
   * @param {number} now
   * @returns {boolean} whether this hit killed the monster
   */
  applyEnemyDamage(player, enemy, damage, skill, now) {
    if (!enemy || enemy.isDead || damage <= 0) return false;

    // Position stays server-owned: a hit only applies damage, so a client cannot
    // drag the monster around the map by reporting the spot it rendered
    enemy.hp = Math.max(0, enemy.hp - damage);

    const killed = enemy.hp <= 0;
    if (killed) {
      enemy.isDead = true;
      this.gridFor(enemy.mapId).remove(enemy);
      this.scheduleEnemyRespawn(enemy);
    } else if (skill) {
      // A landed skill applies its control effects here, where movement and
      // bites are decided. The client only renders the resulting positions. The
      // server RNG rolls any per-hit chance (e.g. La Hán Quyền's stun).
      applyEnemyControlEffects(enemy, skill, now, this.random);
    }

    this.broadcastToMap(enemy.mapId, {
      type: "enemy_hit",
      payload: {
        ...this.enemySnapshot(enemy),
        damage,
        attackerId: player.id
      }
    });
    return killed;
  }

  /**
   * Roll and credit a monster kill. Rolled from the server's own health pool and
   * attributed to the killing blow, so the client cannot mint its own payout.
   * @param {WebSocket} ws
   * @param {Object} player credited killer
   * @param {Object} enemy the defeated monster
   */
  rewardKill(ws, player, enemy) {
    const reward = rollEnemyReward(player.id, enemy);
    this.broadcastToMap(enemy.mapId, { type: "enemy_reward", payload: reward });

    // A dropped skill book goes straight into the credited killer's bag. The
    // broadcast above only carries it for rendering; the server owns the grant.
    if (player.characterId && Array.isArray(reward.loot) && reward.loot.length > 0) {
      for (const drop of reward.loot) {
        const granted = grantItem(player.characterId, drop.itemId, 1);
        if (granted.ok) this.sendInventory(player, granted.bag);
      }
    }

    // The credited killer's ledger is updated here, on the server. The reward
    // broadcast above is only for rendering (drop + float text).
    this.creditReward(ws, player, { exp: reward.exp, coins: reward.coins, kills: 1 });
    this.persistProgress(player);
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
    this.refreshStats(player);

    if (next.levelUps > 0) {
      // A level-up heals HP and refills MP, matching the client's expectation.
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      this.broadcastPlayerState(player, {
        type: "player_hp",
        payload: { id: player.id, hp: player.hp, maxHp: player.maxHp }
      });
      this.broadcastMp(player);
      this.persistVitals(player);
    }

    this.send(ws, {
      type: "player_progress",
      payload: { ...progressPayload(player.progress), levelUps: next.levelUps }
    });
    this.sendPlayerStats(player);
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

      const now = Date.now();
      roster.forEach((enemy) => {
        if (enemy.isDead) return;

        // A stunned monster holds position; a slowed one advances its AI clock
        // slower, so the same step logic produces a shorter move.
        const scale = enemyMoveScale(enemy, now);
        if (scale <= 0) return;

        const next = stepEnemy(enemy, mapPlayers, this.enemyTickMs * scale);
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
        .filter((enemy) => !enemy.isDead && !isEnemyStunned(enemy, now));
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

      // Bites use the monster's own combat block, and the target's defence comes
      // from its server-derived stats (gear + buffs), so gear actually protects.
      const result = computeDamage(
        {
          attack: nearest.attack,
          defense: nearest.defense,
          critRate: nearest.critRate,
          critDamage: nearest.critDamage
        },
        { defense: this.effectiveStats(player, now).defense },
        this.random
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
    clearEnemyControlEffects(enemy);
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

      // Persist the server-owned vitals so a reconnect resumes them instead of
      // starting at full HP. A superseded socket is skipped above because the
      // replacement has already loaded (or is about to load) newer values.
      if (player.characterId) {
        try {
          store.setVitals(player.characterId, { hp: player.hp, mp: player.mp });
        } catch (err) {
          if (process.env.NODE_ENV !== "test") {
            console.error("[WebSocket] Failed to persist vitals:", err.message);
          }
        }
        // The socket is going away, so this is the last chance to record the
        // spot the hero actually stopped at (the throttled move write may be up
        // to POSITION_PERSIST_MS behind).
        this.persistPosition(player, { force: true });
      }

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

    if (this.regenTimer) {
      clearInterval(this.regenTimer);
    } clearInterval(this.enemyTickTimer);
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
