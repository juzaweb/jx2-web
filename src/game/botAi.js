import { MELEE_REACH, walkSpeedFor } from "./combatRules.js";
import { deriveCombatStats } from "./derivedStats.js";
import { DEFAULT_FACTION, FACTION_IDS, isHostileFaction, normalizeFaction } from "./factions.js";
import { MAX_LEVEL, MIN_LEVEL } from "./progression.js";
import { PVP_ATTACK_RANGE, PVP_MODE } from "./pvp.js";
import { effectiveSkillMpCost, skillById } from "./skills.js";

export const BOT_SKILL_ID = "kiem_khi";

export const BOT_NAMES = Object.freeze([
  "Hắc Y Kiếm Sĩ",
  "Bạch Diện Thư Sinh",
  "Lãng Tử Vô Danh",
  "Thanh Y Hiệp Khách",
  "Độc Hành Đao Khách",
  "Tuyết Sơn Kiếm Nữ",
  "Phong Trần Lão Nhân",
  "Hồng Y Du Hiệp",
  "Thiết Diện Phán Quan",
  "Cô Phong Kiếm Khách"
]);

const BOT_EQUIPMENT = Object.freeze({
  weapon: "kiem-lang-khach",
  armor: "ao-lang-khach",
  pants: "quan-lang-khach",
  helmet: "non-lang-khach"
});

export const BOT_TUNING = Object.freeze({
  aggroRange: 1400,
  leashRange: 2600,
  patrolRadius: 700,
  chaseSpeed: walkSpeedFor(0.85),
  patrolSpeed: walkSpeedFor(0.5),
  returnSpeed: walkSpeedFor(0.6),
  mpRegenPerSecond: 6
});

const clampLevel = (level) => {
  const value = Number(level);
  if (!Number.isFinite(value)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(value)));
};

const zoneLevel = (zone) => {
  const min = Number(zone?.minLevel);
  const max = Number(zone?.maxLevel);
  if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
  const low = Number.isFinite(min) ? min : max;
  const high = Number.isFinite(max) ? max : min;
  return clampLevel(Math.round((low + high) / 2));
};

const clampToBounds = (value, min, max) => Math.min(max, Math.max(min, value));

export function botLevelForMap(map, fallbackLevel = 30) {
  const zones = Array.isArray(map?.zones) ? map.zones.filter((zone) => zone?.bounds) : [];
  if (zones.length === 0) return clampLevel(fallbackLevel);
  const levels = zones.map(zoneLevel).filter((level) => level !== null);
  if (levels.length === 0) return clampLevel(fallbackLevel);
  return clampLevel(Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length));
}

export function botSpawnPoints(map, count = 3, fallbackLevel = 30) {
  const total = Math.max(0, Math.floor(count));
  if (!map || total === 0) return [];

  const bounds = map.bounds || { x0: 0, y0: 0, x1: 0, y1: 0 };
  const zones = Array.isArray(map.zones) ? map.zones.filter((zone) => zone?.bounds) : [];
  const points = [];

  if (zones.length > 0) {
    for (let index = 0; index < total; index += 1) {
      const zone = zones[index % zones.length];
      const b = zone.bounds;
      const lane = Math.floor(index / zones.length);
      const width = Math.max(1, b.x1 - b.x0);
      const height = Math.max(1, b.y1 - b.y0);
      const x = clampToBounds(b.x0 + width * (0.35 + (lane % 3) * 0.15), b.x0 + 120, b.x1 - 120);
      const y = clampToBounds(b.y0 + height * 0.5, b.y0 + 120, b.y1 - 120);
      points.push({
        x: clampToBounds(x, bounds.x0, bounds.x1),
        y: clampToBounds(y, bounds.y0, bounds.y1),
        level: zoneLevel(zone) ?? botLevelForMap(map, fallbackLevel)
      });
    }
    return points;
  }

  const centerX = (bounds.x0 + bounds.x1) / 2;
  const centerY = (bounds.y0 + bounds.y1) / 2;
  const radius = Math.min(900, Math.max(0, Math.min(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0) * 0.18));
  for (let index = 0; index < total; index += 1) {
    const angle = (Math.PI * 2 * index) / total;
    points.push({
      x: clampToBounds(centerX + Math.cos(angle) * radius, bounds.x0, bounds.x1),
      y: clampToBounds(centerY + Math.sin(angle) * radius, bounds.y0, bounds.y1),
      level: botLevelForMap(map, fallbackLevel)
    });
  }
  return points;
}

export function botFactionForIndex(index) {
  const slot = Math.abs(Math.floor(index)) % FACTION_IDS.length;
  return FACTION_IDS[slot] || DEFAULT_FACTION;
}

export function botHostileFaction(faction) {
  const target = normalizeFaction(faction);
  return FACTION_IDS.find((id) => id !== target) || DEFAULT_FACTION;
}

export function createBotState({
  id,
  mapId,
  x,
  y,
  level = 30,
  name = BOT_NAMES[0],
  faction = DEFAULT_FACTION,
  gender = "male",
  equipment = BOT_EQUIPMENT,
  pkFlag = true,
  now = Date.now()
} = {}) {
  const botLevel = clampLevel(level);
  const gear = { ...BOT_EQUIPMENT, ...(equipment || {}) };
  const stats = deriveCombatStats({ level: botLevel, equipment: gear, now });

  return {
    id,
    username: name,
    displayName: name,
    characterId: null,
    isBot: true,
    isDead: false,
    mapId,
    x,
    y,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
    direction: "right",
    stance: "front",
    equipment: gear,
    gender: gender === "female" ? "female" : "male",
    faction: normalizeFaction(faction),
    level: botLevel,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    maxMp: stats.maxMp,
    mp: stats.maxMp,
    attack: stats.attack,
    defense: stats.defense,
    critRate: stats.critRate,
    critDamage: stats.critDamage,
    attackSpeed: stats.attackSpeed,
    buffs: [],
    pkFlag: pkFlag === true,
    weaponType: "kiem",
    learnedSkills: [BOT_SKILL_ID],
    skillReadyAt: Object.create(null),
    nextAttackAt: now,
    nextBiteAt: 0,
    invulnerableUntil: 0,
    lastCast: null,
    lastSwing: null,
    targetId: null,
    patrolX: x,
    patrolY: y,
    nextPatrolAt: now + 1500
  };
}

export function botSnapshot(bot) {
  return {
    id: bot.id,
    username: bot.username,
    displayName: bot.displayName,
    characterId: null,
    mapId: bot.mapId,
    x: bot.x,
    y: bot.y,
    vx: bot.vx,
    vy: bot.vy,
    direction: bot.direction,
    stance: bot.stance,
    equipment: bot.equipment,
    gender: bot.gender,
    faction: bot.faction || null,
    level: bot.level,
    hp: bot.hp,
    maxHp: bot.maxHp,
    pkFlag: bot.pkFlag === true
  };
}

export function botCanAttackPlayer(bot, player, pvpMode = PVP_MODE.FLAG) {
  if (!bot || !player || !bot.id || !player.id || bot.id === player.id) return false;
  if (player.isDead || player.isGodMode) return false;
  if (player.hp !== undefined && player.hp <= 0) return false;
  if (bot.mapId && player.mapId && bot.mapId !== player.mapId) return false;
  if (pvpMode === PVP_MODE.NONE) return false;
  if (pvpMode === PVP_MODE.FACTION) return isHostileFaction(bot.faction, player.faction);
  return bot.pkFlag === true && player.pkFlag === true;
}

export function botAttackRange(bot) {
  const skill = skillById(BOT_SKILL_ID);
  if (!skill) return MELEE_REACH;
  const cost = effectiveSkillMpCost(skill.id);
  if (cost > 0 && bot?.mp < cost) return MELEE_REACH;
  return Math.min(Math.max(0, Number(skill.range) || 0), PVP_ATTACK_RANGE);
}

export function findBotTarget(bot, players = [], pvpMode = PVP_MODE.FLAG, range = BOT_TUNING.aggroRange) {
  if (!bot || !Array.isArray(players)) return null;
  const rangeSq = range * range;
  let best = null;
  let bestDistance = rangeSq;

  for (const player of players) {
    if (!botCanAttackPlayer(bot, player, pvpMode)) continue;
    if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) continue;
    const dx = player.x - bot.x;
    const dy = player.y - bot.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > rangeSq || distanceSq >= bestDistance) continue;
    best = player;
    bestDistance = distanceSq;
  }
  return best;
}

function moveToward(bot, targetX, targetY, maxStep, seconds) {
  const dx = targetX - bot.x;
  const dy = targetY - bot.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || maxStep <= 0 || seconds <= 0) {
    return { x: bot.x, y: bot.y, vx: 0, vy: 0, moved: false, direction: bot.direction };
  }
  const step = Math.min(maxStep, distance);
  const x = bot.x + (dx / distance) * step;
  const y = bot.y + (dy / distance) * step;
  return {
    x,
    y,
    vx: (x - bot.x) / seconds,
    vy: (y - bot.y) / seconds,
    moved: true,
    direction: dx >= 0 ? "right" : "left"
  };
}

export function stepBot(
  bot,
  players = [],
  pvpMode = PVP_MODE.FLAG,
  deltaMs = 0,
  now = Date.now(),
  random = Math.random,
  tuning = BOT_TUNING
) {
  const settings = { ...BOT_TUNING, ...(tuning || {}) };
  const seconds = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0) / 1000;
  const attackRange = settings.attackRange ?? botAttackRange(bot);

  let target = null;
  if (bot.targetId) {
    target = players.find((player) => player?.id === bot.targetId) || null;
    if (target && !botCanAttackPlayer(bot, target, pvpMode)) target = null;
    if (target) {
      const homeDistance = Math.hypot(target.x - bot.homeX, target.y - bot.homeY);
      if (homeDistance > settings.leashRange) target = null;
    }
  }
  if (!target) {
    target = findBotTarget(bot, players, pvpMode, settings.aggroRange);
  }
  bot.targetId = target?.id || null;

  if (target) {
    const distance = Math.hypot(target.x - bot.x, target.y - bot.y);
    if (distance > attackRange) {
      const move = moveToward(bot, target.x, target.y, settings.chaseSpeed * seconds, seconds);
      return { ...move, target };
    }
    bot.patrolX = bot.x;
    bot.patrolY = bot.y;
    return { x: bot.x, y: bot.y, vx: 0, vy: 0, moved: false, direction: bot.direction, target };
  }

  const homeDistance = Math.hypot(bot.x - bot.homeX, bot.y - bot.homeY);
  if (homeDistance > settings.leashRange) {
    const move = moveToward(bot, bot.homeX, bot.homeY, settings.returnSpeed * seconds, seconds);
    return { ...move, target: null };
  }

  if (now >= bot.nextPatrolAt) {
    const angle = random() * Math.PI * 2;
    const radius = random() * settings.patrolRadius;
    bot.patrolX = bot.homeX + Math.cos(angle) * radius;
    bot.patrolY = bot.homeY + Math.sin(angle) * radius;
    bot.nextPatrolAt = now + 3000 + random() * 4000;
  }

  const patrolDistance = Math.hypot(bot.patrolX - bot.x, bot.patrolY - bot.y);
  if (patrolDistance <= 12) {
    return { x: bot.x, y: bot.y, vx: 0, vy: 0, moved: false, direction: bot.direction, target: null };
  }

  const move = moveToward(bot, bot.patrolX, bot.patrolY, settings.patrolSpeed * seconds, seconds);
  return { ...move, target: null };
}
