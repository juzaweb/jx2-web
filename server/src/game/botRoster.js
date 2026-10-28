import {
  BOT_NAMES,
  BOT_SKILL_ID,
  BOT_TUNING,
  botAttackRange,
  botFactionForIndex,
  botHostileFaction,
  botLevelForMap,
  botSnapshot,
  botSpawnPoints,
  createBotState,
  stepBot
} from "../../../src/game/botAi.js";
import { deriveCombatStats } from "../../../src/game/derivedStats.js";
import { hasSplash, HIT_RADIUS_SLACK, MELEE_REACH, attackIntervalFor } from "../../../src/game/combatRules.js";
import { getMap, isCombatAllowed, mapPvpMode } from "../../../src/game/maps/mapRegistry.js";
import { canPvpAttack, PVP_ATTACK_RANGE, PLAYER_IFRAME_MS } from "../../../src/game/pvp.js";
import { isHostileFaction } from "../../../src/game/factions.js";
import { MAX_LEVEL } from "../../../src/game/progression.js";
import {
  effectiveSkillCooldown,
  effectiveSkillMpCost,
  skillById
} from "../../../src/game/skills.js";

const envFlag = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const clampNumber = (val, min, max, fallback) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

export class BotRoster {
  constructor(game, options = {}) {
    this.game = game;
    this.autoSpawn =
      options.bots !== undefined
        ? options.bots === true
        : process.env.NODE_ENV !== "test" && envFlag(process.env.BOT_AUTOSPAWN, true);
    this.count = clampNumber(options.botCount ?? process.env.BOT_COUNT, 0, 20, 3);
    this.level = clampNumber(options.botLevel ?? process.env.BOT_LEVEL, 1, MAX_LEVEL, 30);
    this.respawnMs = clampNumber(
      options.botRespawnMs ?? process.env.BOT_RESPAWN_MS,
      1000,
      600000,
      10000
    );
    this.tickMs = clampNumber(options.botTickMs, 20, 1000, 100);
    this.tuning = {
      ...BOT_TUNING,
      aggroRange: clampNumber(
        options.botAggroRange ?? process.env.BOT_AGGRO_RANGE,
        100,
        5000,
        BOT_TUNING.aggroRange
      ),
      leashRange: clampNumber(
        options.botLeashRange ?? process.env.BOT_LEASH_RANGE,
        100,
        8000,
        BOT_TUNING.leashRange
      ),
      patrolRadius: clampNumber(
        options.botPatrolRadius ?? process.env.BOT_PATROL_RADIUS,
        0,
        3000,
        BOT_TUNING.patrolRadius
      )
    };
    this.bots = new Map();
    this.botByMap = new Map();
    this.respawnTimers = new Map();
    this.seq = 0;
    this.timer = null;
  }

  botsOnMap(mapId) {
    const roster = this.botByMap?.get(mapId);
    if (!roster) return [];
    return Array.from(roster.values()).filter((bot) => !bot.isDead);
  }

  spawnBot({ mapId, x, y, level, faction, name, pkFlag, excludeWs = null } = {}) {
    const map = getMap(mapId);
    const bounds = map.bounds;
    const mode = mapPvpMode(map);
    const id = `bot-${++this.seq}`;
    const factionId =
      faction || (mode === "faction" ? botFactionForIndex(this.seq) : undefined);
    const bot = createBotState({
      id,
      mapId: map.id,
      x: clampNumber(x, bounds.x0, bounds.x1, map.spawn.x),
      y: clampNumber(y, bounds.y0, bounds.y1, map.spawn.y),
      level: level ?? botLevelForMap(map, this.level),
      name: name || BOT_NAMES[(this.seq - 1) % BOT_NAMES.length],
      faction: factionId,
      pkFlag: pkFlag ?? mode !== "none"
    });

    let roster = this.botByMap.get(map.id);
    if (!roster) {
      roster = new Map();
      this.botByMap.set(map.id, roster);
    }
    roster.set(bot.id, bot);
    this.bots.set(bot.id, bot);

    this.game.broadcastToMap(
      map.id,
      { type: "player_joined", payload: { player: botSnapshot(bot) } },
      excludeWs
    );
    return bot;
  }

  ensureBotsForMap(mapId, excludeWs = null, playerFaction = null) {
    if (!this.autoSpawn || this.count <= 0) return;
    const map = getMap(mapId);
    if (!isCombatAllowed(map)) return;

    const mode = mapPvpMode(map);
    const roster = this.botByMap.get(map.id);
    const existing = roster ? roster.size : 0;
    const liveBots = this.botsOnMap(map.id);
    const needsHostile =
      mode === "faction" &&
      playerFaction &&
      !liveBots.some((bot) => isHostileFaction(bot.faction, playerFaction));
    const spawnCount = Math.max(this.count - existing, needsHostile ? 1 : 0);
    if (spawnCount <= 0) return;

    const points = botSpawnPoints(map, spawnCount, this.level);
    points.forEach((point, index) => {
      this.spawnBot({
        mapId: map.id,
        x: point.x,
        y: point.y,
        level: point.level,
        faction:
          needsHostile && index === 0 ? botHostileFaction(playerFaction) : undefined,
        pkFlag: mode !== "none",
        excludeWs
      });
    });
  }

  despawnBot(bot, { announce = true } = {}) {
    if (!bot) return;
    const timer = this.respawnTimers.get(bot.id);
    if (timer) clearTimeout(timer);
    this.respawnTimers.delete(bot.id);

    this.bots.delete(bot.id);
    const roster = this.botByMap.get(bot.mapId);
    if (roster) {
      roster.delete(bot.id);
      if (roster.size === 0) this.botByMap.delete(bot.mapId);
    }
    if (announce) {
      this.game.broadcastToMap(bot.mapId, { type: "player_left", payload: { id: bot.id } });
    }
  }

  despawnBotsOnMap(mapId) {
    const roster = this.botByMap.get(mapId);
    if (!roster) return;
    Array.from(roster.values()).forEach((bot) => this.despawnBot(bot));
  }

  countBotsOnMap(mapId) {
    return this.botByMap.get(mapId)?.size || 0;
  }

  releaseBotsIfEmpty(mapId) {
    const occupied = Array.from(this.game.players.values()).some((player) => player.mapId === mapId);
    if (!occupied) this.despawnBotsOnMap(mapId);
  }

  defeatBot(bot, attacker = null, source = "pvp", sourceName = null) {
    if (!bot || bot.isDead) return;
    bot.isDead = true;
    bot.hp = 0;
    bot.targetId = null;
    bot.vx = 0;
    bot.vy = 0;

    const attackerName = attacker
      ? attacker.displayName || attacker.username
      : sourceName;

    this.game.broadcastToMap(bot.mapId, {
      type: "player_defeated",
      payload: {
        victimId: bot.id,
        victimName: bot.displayName,
        attackerId: attacker?.id || null,
        attackerName: attackerName || null,
        source,
        respawn: null
      }
    });
    this.game.broadcastToMap(bot.mapId, { type: "player_left", payload: { id: bot.id } });

    const existing = this.respawnTimers.get(bot.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => this.respawnBot(bot.id), this.respawnMs);
    if (timer.unref) timer.unref();
    this.respawnTimers.set(bot.id, timer);
  }

  respawnBot(botId) {
    this.respawnTimers.delete(botId);
    const bot = this.bots.get(botId);
    if (!bot || !bot.isDead) return;

    const occupied = Array.from(this.game.players.values()).some(
      (player) => player.mapId === bot.mapId
    );
    if (!occupied) {
      this.despawnBot(bot, { announce: false });
      return;
    }

    const stats = deriveCombatStats({
      level: bot.level,
      equipment: bot.equipment,
      buffs: [],
      now: Date.now()
    });
    bot.isDead = false;
    bot.maxHp = stats.maxHp;
    bot.maxMp = stats.maxMp;
    bot.hp = stats.maxHp;
    bot.mp = stats.maxMp;
    bot.x = bot.homeX;
    bot.y = bot.homeY;
    bot.vx = 0;
    bot.vy = 0;
    bot.targetId = null;
    bot.nextAttackAt = 0;
    bot.nextPatrolAt = Date.now() + 1500;
    bot.invulnerableUntil = Date.now() + PLAYER_IFRAME_MS;

    this.game.broadcastToMap(bot.mapId, {
      type: "player_joined",
      payload: { player: botSnapshot(bot) }
    });
  }

  startTick() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tickBots(), this.tickMs);
    if (this.timer.unref) this.timer.unref();
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.respawnTimers.forEach((timer) => clearTimeout(timer));
    this.respawnTimers.clear();
    this.bots.clear();
    this.botByMap.clear();
  }

  tickBots() {
    if (this.bots.size === 0) return;

    const now = Date.now();
    const players = Array.from(this.game.players.values()).filter((player) => player.hp > 0);

    this.botByMap.forEach((roster, mapId) => {
      const mapPlayers = players.filter((player) => player.mapId === mapId);
      if (mapPlayers.length === 0) return;

      const map = getMap(mapId);
      const bounds = map.bounds;
      const pvpMode = this.game.pvpModeFor({ mapId });

      roster.forEach((bot) => {
        if (bot.isDead) return;

        const stats = this.game.effectiveStats(bot, now);
        const seconds = this.tickMs / 1000;
        bot.mp = Math.min(stats.maxMp, bot.mp + this.tuning.mpRegenPerSecond * seconds);
        bot.attack = stats.attack;
        bot.defense = stats.defense;
        bot.critRate = stats.critRate;
        bot.critDamage = stats.critDamage;
        bot.attackSpeed = stats.attackSpeed;
        bot.maxHp = stats.maxHp;
        bot.maxMp = stats.maxMp;

        const attackRange = botAttackRange(bot);
        const next = stepBot(
          bot,
          mapPlayers,
          pvpMode,
          this.tickMs,
          now,
          this.game.random,
          { ...this.tuning, attackRange }
        );

        if (next.moved) {
          bot.x = clampNumber(Math.round(next.x), bounds.x0, bounds.x1, bot.x);
          bot.y = clampNumber(Math.round(next.y), bounds.y0, bounds.y1, bot.y);
          bot.vx = Math.round(next.vx);
          bot.vy = Math.round(next.vy);
          bot.direction = next.direction;
          this.game.broadcastToMap(mapId, {
            type: "player_moved",
            payload: {
              id: bot.id,
              x: bot.x,
              y: bot.y,
              vx: bot.vx,
              vy: bot.vy,
              direction: bot.direction,
              stance: bot.stance
            }
          });
        } else {
          bot.vx = 0;
          bot.vy = 0;
        }

        if (next.target) this.tryBotAttack(bot, next.target, now, attackRange);
      });
    });
  }

  tryBotAttack(bot, target, now, attackRange = botAttackRange(bot)) {
    if (!bot || bot.isDead || !target || target.hp <= 0) return;
    if (now < bot.nextAttackAt) return;
    if (!this.game.canFightHere(bot)) return;

    const pvpMode = this.game.pvpModeFor(bot);
    const distance = Math.hypot(bot.x - target.x, bot.y - target.y);
    if (!canPvpAttack(bot, target, distance, PVP_ATTACK_RANGE, pvpMode)) return;

    const stats = this.game.effectiveStats(bot, now);
    const skill = skillById(BOT_SKILL_ID);
    let skillId = null;
    if (skill) {
      const readyAt = bot.skillReadyAt[skill.id] || 0;
      const cost = effectiveSkillMpCost(skill.id);
      if (
        now >= readyAt &&
        (cost <= 0 || bot.mp >= cost) &&
        distance <= skill.range + HIT_RADIUS_SLACK
      ) {
        skillId = skill.id;
      }
    }

    if (!skillId && distance > Math.min(attackRange, MELEE_REACH) + HIT_RADIUS_SLACK) return;

    const cadence = Math.max(150, Math.round(attackIntervalFor(stats.attackSpeed)));
    bot.nextAttackAt = now + cadence;
    bot.direction = target.x >= bot.x ? "right" : "left";

    if (skillId) {
      const cost = effectiveSkillMpCost(skillId);
      if (cost > 0) bot.mp = Math.max(0, bot.mp - cost);
      bot.skillReadyAt[skillId] = now + effectiveSkillCooldown(skillId);
      bot.lastCast = { skillId, at: now, hits: 0, aim: { x: target.x, y: target.y } };
    } else {
      bot.lastSwing = { at: now, used: false };
    }

    const splashTargets =
      skillId && hasSplash(skill) ? this.game.pvpSplashTargets(bot, target, skill) : [];

    this.game.broadcastToMap(bot.mapId, {
      type: "player_attacked",
      payload: {
        id: bot.id,
        skill: skillId || "normal",
        x: target.x,
        y: target.y,
        facingRight: bot.direction === "right"
      }
    });

    const targetStats = this.game.effectiveStats(target, now);
    const hit = this.game.resolveHitDamage(bot, targetStats.defense, skillId, now);
    if (!hit || hit.damage <= 0) return;

    this.game.applyPlayerDamage(target, hit.damage, bot, "pvp");

    if (splashTargets.length > 0) {
      this.game.applyPvpSplash(bot, splashTargets, skill, now, hit.attackerStats);
    }
  }
}
