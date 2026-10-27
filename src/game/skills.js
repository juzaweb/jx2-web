/**
 * Skill catalog shared by the client and the server.
 *
 * Skills are grouped by the weapon that can use them. A hero may only cast the
 * skills of the weapon worn in the `weapon` equipment slot (see `weapons.js`),
 * so there are no sects any more.
 *
 * Every skill is data: MP cost, cooldown, range/radius and damage multiplier are
 * authoritative and therefore consumed by the server when it validates a cast and
 * computes the resulting damage. The client reads the same table to predict the
 * cost, gate the hotbar and render its VFX.
 *
 * The cost actually charged is read through `effectiveSkillMpCost` and
 * `effectiveSkillCooldown`, which zero both in test mode so the client gate and
 * the server check stay in agreement.
 *
 * Learning: only the starter skill (`starter: true`, Kiếm Khí) is known for
 * free. Every other skill is learned from a book item dropped by monsters; the
 * learned ids are persisted per character on the server. `requires` lists the
 * skills that must already be learned before a book can be studied.
 *
 * A skill's `effects` are applied on a successful hit (or on self when
 * `target === "self"`). Only the effect kinds used by shipped skills are listed
 * here; unknown kinds are ignored, so the catalog can grow without breaking old
 * readers.
 */

import { normalizeWeaponType } from "./weapons.js";
import { isTestMode } from "./testMode.js";

/** Number of skill slots on the client hotbar. */
export const SKILL_SLOTS = 6;

/** Skill ids that are not real skills, resolved by the server as a plain attack. */
export const BASIC_ATTACK_ID = "normal";

/**
 * Bao tay (fist / glove) kit. Slot 0 is `thieu_lam_tam_phap`: a passive internal
 * art that is always running (no cast, no MP, no cooldown) and restores
 * `hpPerSecond` health while the hero is alive. See `passiveRegen.js` for the
 * shared regen maths.
 */
const BAO_TAY_SKILLS = [
  {
    id: "thieu_lam_tam_phap",
    weapon: "bao-tay",
    slot: 0,
    icon: "/skills/thieu_lam_tam_phap.png",
    glyph: "心",
    nameKey: "skills.thieuLam.thieuLamTamPhap.name",
    descKey: "skills.thieuLam.thieuLamTamPhap.desc",
    unlockLevel: 1,
    mp: 0,
    cooldown: 0,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    /** Always-on internal art: never cast from the hotbar, never consumes MP. */
    passive: true,
    effects: [{ kind: "regen", hpPerSecond: 2 }]
  },
  {
    id: "dai_tu_di_chuong",
    weapon: "bao-tay",
    slot: 1,
    icon: "/skills/dai_tu_di_chuong.png",
    glyph: "掌",
    requires: [{ id: "thieu_lam_tam_phap", level: 1 }],
    nameKey: "skills.thieuLam.daiTuDiChuong.name",
    descKey: "skills.thieuLam.daiTuDiChuong.desc",
    unlockLevel: 1,
    mp: 12,
    cooldown: 6000,
    target: "enemy",
    range: 6000,
    radius: 0,
    mult: 1.3,
    effects: [{ kind: "stun", duration: 800 }],
    vfx: {
      sprite: "vfx-dai-tu-di-chuong",
      cast: "shockwave",
      impact: null,
      color: 0xffb347,
      shake: 0.004
    }
  },
  {
    id: "la_han_quyen",
    weapon: "bao-tay",
    slot: 2,
    icon: "/skills/la_han_quyen.png",
    glyph: "拳",
    nameKey: "skills.thieuLam.laHanQuyen.name",
    descKey: "skills.thieuLam.laHanQuyen.desc",
    unlockLevel: 1,
    mp: 20,
    cooldown: 8000,
    target: "enemy",
    range: 300,
    radius: 0,
    mult: 0.22,
    /**
     * Rush to the target, then land a five-second punching flurry: one strike
     * every 250ms, twenty in total, each with its own stun roll. Every strike
     * also splashes onto nearby monsters around the primary target.
     */
    channel: { durationMs: 5000, intervalMs: 250 },
    splash: { radius: 160, mult: 0.6, maxTargets: 4 },
    effects: [{ kind: "stun", duration: 600, chance: 0.1 }],
    vfx: {
      cast: "slash",
      impact: "spark",
      color: 0xffc94d
    }
  },
  {
    id: "la_han_tran",
    weapon: "bao-tay",
    slot: 3,
    icon: "/skills/la_han_tran.png",
    glyph: "陣",
    requires: [{ id: "dai_tu_di_chuong", level: 1 }],
    nameKey: "skills.thieuLam.laHanTran.name",
    descKey: "skills.thieuLam.laHanTran.desc",
    unlockLevel: 1,
    mp: 18,
    cooldown: 9000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [
      { kind: "buff", stat: "attackPct", amount: 0.1, duration: 180000 },
      { kind: "buff", stat: "speedPct", amount: 0.2, duration: 180000 },
      { kind: "buff", stat: "critRate", amount: 0.05, duration: 180000 }
    ],
    vfx: {
      sprite: "vfx-la-han-tran",
      type: "formation",
      cast: "shockwave",
      impact: null,
      color: 0xffd166,
      shake: 0,
      scale: 0.6,
      fps: 12
    }
  },
  {
    id: "kim_cang_bat_hoai",
    weapon: "bao-tay",
    slot: 4,
    icon: "/skills/kim_cang_bat_hoai.png",
    glyph: "卍",
    requires: [{ id: "la_han_tran", level: 1 }],
    nameKey: "skills.thieuLam.kimCangBatHoai.name",
    descKey: "skills.thieuLam.kimCangBatHoai.desc",
    unlockLevel: 1,
    mp: 20,
    cooldown: 18000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "defensePct", amount: 0.3, duration: 30000 }],
    vfx: {
      type: "overhead",
      overhead: "buff-phat-an",
      cast: "aura",
      color: 0xffd166,
      overheadScale: 0.05,
      overheadOffsetY: -80
    }
  },
  {
    id: "nhu_lai_than_chuong",
    weapon: "bao-tay",
    slot: 5,
    icon: "/skills/nhu_lai_than_chuong.png",
    glyph: "佛",
    requires: [{ id: "la_han_tran", level: 1 }],
    nameKey: "skills.thieuLam.nhuLaiThanChuong.name",
    descKey: "skills.thieuLam.nhuLaiThanChuong.desc",
    unlockLevel: 10,
    mp: 35,
    cooldown: 30000,
    target: "enemy",
    range: 6000,
    radius: 900,
    mult: 2.4,
    effects: [{ kind: "stun", duration: 1200 }],
    vfx: {
      sprite: "vfx-nhu-lai-than-chuong",
      type: "slam",
      cast: "shockwave",
      impact: null,
      color: 0xffb347,
      size: 800,
      castScale: 0.4,
      impactScale: 1.5,
      fps: 12
    }
  }
];

/**
 * Starter sword skill. Every new hero learns Kiếm Khí and starts with a sword,
 * so its book is never dropped; `starter: true` also makes it always known.
 */
const KIEM_KHI_SKILL = {
  id: "kiem_khi",
  weapon: "kiem",
  slot: 0,
  icon: "/skills/kiem_khi.png",
  glyph: "氣",
  nameKey: "skills.kiem.kiemKhi.name",
  descKey: "skills.kiem.kiemKhi.desc",
  unlockLevel: 1,
  starter: true,
  mp: 5,
  cooldown: 2000,
  target: "enemy",
  range: 840,
  radius: 0,
  mult: 1.1,
  /**
   * The blast is real damage, not just decoration: every monster standing in the
   * burst takes a fraction of the primary hit. `radius` stays 0 because the cast
   * itself is still aimed at one target — the server resolves the area from
   * `splashVictims` when the hit lands.
   */
  splash: { radius: 170, mult: 0.6, maxTargets: 4 },
  vfx: {
    /**
     * A blade-shaped shard of qi flies from the hero to the victim, then bursts.
     * `projectile` replaces the gesture arc entirely (see `playSkillCastVfx`), so
     * there is no `cast` kind: `impact: null` leaves the arrival to the shard.
     */
    projectile: "sword",
    impact: null,
    color: 0x9be8ff
  }
};

const KIEM_VO_DANG_SKILLS = [
  {
    id: "thieu_duong_kiem_phap",
    weapon: "kiem",
    slot: 0,
    glyph: "剑",
    nameKey: "skills.voDang.thieuDuongKiemPhap.name",
    descKey: "skills.voDang.thieuDuongKiemPhap.desc",
    unlockLevel: 1,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 200,
    radius: 0,
    mult: 1.2
  },
  {
    id: "thai_cuc_quyen",
    weapon: "kiem",
    slot: 1,
    glyph: "太",
    requires: [{ id: "thieu_duong_kiem_phap", level: 1 }],
    nameKey: "skills.voDang.thaiCucQuyen.name",
    descKey: "skills.voDang.thaiCucQuyen.desc",
    unlockLevel: 1,
    mp: 10,
    cooldown: 3500,
    target: "enemy",
    range: 180,
    radius: 0,
    mult: 1.35
  },
  {
    id: "tam_thanh_kiem_phap",
    weapon: "kiem",
    slot: 2,
    glyph: "三",
    requires: [{ id: "thai_cuc_quyen", level: 1 }],
    nameKey: "skills.voDang.tamThanhKiemPhap.name",
    descKey: "skills.voDang.tamThanhKiemPhap.desc",
    unlockLevel: 2,
    mp: 15,
    cooldown: 5000,
    target: "enemy",
    range: 400,
    radius: 0,
    mult: 1.5
  },
  {
    id: "toat_hong_quan_khuyet",
    weapon: "kiem",
    slot: 3,
    glyph: "罡",
    requires: [{ id: "tam_thanh_kiem_phap", level: 2 }],
    nameKey: "skills.voDang.toatHongQuanKhuyet.name",
    descKey: "skills.voDang.toatHongQuanKhuyet.desc",
    unlockLevel: 3,
    mp: 20,
    cooldown: 8000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "attackPct", amount: 0.15, duration: 180000 }]
  }
];

const KIEM_NGA_MY_SKILLS = [
  {
    id: "nga_my_kiem_phap",
    weapon: "kiem",
    slot: 0,
    glyph: "剑",
    nameKey: "skills.ngaMy.ngaMyKiemPhap.name",
    descKey: "skills.ngaMy.ngaMyKiemPhap.desc",
    unlockLevel: 1,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 200,
    radius: 0,
    mult: 1.15
  },
  {
    id: "mong_diep_thoi_tam",
    weapon: "kiem",
    slot: 1,
    glyph: "蝶",
    requires: [{ id: "nga_my_kiem_phap", level: 1 }],
    nameKey: "skills.ngaMy.mongDiepThoiTam.name",
    descKey: "skills.ngaMy.mongDiepThoiTam.desc",
    unlockLevel: 1,
    mp: 12,
    cooldown: 4000,
    target: "enemy",
    range: 350,
    radius: 0,
    mult: 1.3
  },
  {
    id: "tu_hang_pho_do",
    weapon: "kiem",
    slot: 2,
    glyph: "医",
    requires: [{ id: "mong_diep_thoi_tam", level: 1 }],
    nameKey: "skills.ngaMy.tuHangPhoDo.name",
    descKey: "skills.ngaMy.tuHangPhoDo.desc",
    unlockLevel: 2,
    mp: 20,
    cooldown: 6000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "heal", amount: 50 }]
  },
  {
    id: "luu_thuy_khanh_van",
    weapon: "kiem",
    slot: 3,
    glyph: "云",
    requires: [{ id: "tu_hang_pho_do", level: 2 }],
    nameKey: "skills.ngaMy.luuThuyKhanhVan.name",
    descKey: "skills.ngaMy.luuThuyKhanhVan.desc",
    unlockLevel: 3,
    mp: 18,
    cooldown: 10000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "speedPct", amount: 0.25, duration: 120000 }]
  }
];

const DAO_SKILLS = [
  {
    id: "ngu_doc_tam_phap",
    weapon: "dao",
    slot: 0,
    glyph: "毒",
    nameKey: "skills.nguDoc.nguDocTamPhap.name",
    descKey: "skills.nguDoc.nguDocTamPhap.desc",
    unlockLevel: 1,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 250,
    radius: 0,
    mult: 1.1
  },
  {
    id: "truy_tam_doc",
    weapon: "dao",
    slot: 1,
    glyph: "心",
    requires: [{ id: "ngu_doc_tam_phap", level: 1 }],
    nameKey: "skills.nguDoc.truyTamDoc.name",
    descKey: "skills.nguDoc.truyTamDoc.desc",
    unlockLevel: 1,
    mp: 10,
    cooldown: 3000,
    target: "enemy",
    range: 300,
    radius: 0,
    mult: 1.25
  },
  {
    id: "van_doc_chieu_hong",
    weapon: "dao",
    slot: 2,
    glyph: "蛊",
    requires: [{ id: "truy_tam_doc", level: 1 }],
    nameKey: "skills.nguDoc.vanDocChieuHong.name",
    descKey: "skills.nguDoc.vanDocChieuHong.desc",
    unlockLevel: 2,
    mp: 16,
    cooldown: 6000,
    target: "enemy",
    range: 400,
    radius: 0,
    mult: 1.4
  },
  {
    id: "u_hong_phiet_anh",
    weapon: "dao",
    slot: 3,
    glyph: "影",
    requires: [{ id: "van_doc_chieu_hong", level: 2 }],
    nameKey: "skills.nguDoc.uHongPhietAnh.name",
    descKey: "skills.nguDoc.uHongPhietAnh.desc",
    unlockLevel: 3,
    mp: 22,
    cooldown: 8000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "critRate", amount: 0.1, duration: 120000 }]
  }
];

/**
 * Sword kit: the starter Kiếm Khí plus both sword schools. Slots are renumbered
 * so the tree renders as one kit (0 = starter, 1-4 = first school, 5-8 = second).
 */
const KIEM_SKILLS = [
  KIEM_KHI_SKILL,
  ...KIEM_VO_DANG_SKILLS.map((skill, index) => ({ ...skill, slot: index + 1 })),
  ...KIEM_NGA_MY_SKILLS.map((skill, index) => ({ ...skill, slot: index + 5 }))
];

/** All authored skills, in catalog order. */
export const SKILLS = [...BAO_TAY_SKILLS, ...KIEM_SKILLS, ...DAO_SKILLS];

/** Skill lists keyed by weapon type id. */
export const SKILLS_BY_WEAPON = {
  "bao-tay": BAO_TAY_SKILLS,
  kiem: KIEM_SKILLS,
  dao: DAO_SKILLS
};

const SKILLS_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));
const SLOT_INDEX_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill.slot]));

/**
 * Normalise a caller-supplied weapon id to a known kit id.
 * @param {*} weapon
 * @returns {string}
 */
export { normalizeWeaponType };

/**
 * All skills authored for a weapon, ordered by slot.
 * @param {string} weapon
 * @returns {Object[]}
 */
export function skillsForWeapon(weapon) {
  return SKILLS_BY_WEAPON[normalizeWeaponType(weapon)] || [];
}

/**
 * Look up a skill by id.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function skillById(id) {
  if (typeof id !== "string") return undefined;
  return SKILLS_BY_ID.get(id);
}

/**
 * Skill assigned to a slot of a weapon's kit, if any.
 * @param {string} weapon
 * @param {number} slot
 * @returns {Object|undefined}
 */
export function skillForSlot(weapon, slot) {
  return skillsForWeapon(weapon).find((skill) => skill.slot === slot);
}

/**
 * MP cost of a skill id. Unknown ids are free, which keeps `normal` and legacy
 * ids from ever charging mana.
 * @param {string} skill
 * @returns {number}
 */
export function skillMpCost(skill) {
  const entry = SKILLS_BY_ID.get(skill);
  return entry ? entry.mp : 0;
}

/**
 * Cooldown (ms) of a skill id.
 * @param {string} skill
 * @returns {number}
 */
export function skillCooldown(skill) {
  const entry = SKILLS_BY_ID.get(skill);
  return entry ? entry.cooldown : 0;
}

/**
 * MP a cast actually spends.
 *
 * This is the one place test mode waives a casting cost, so the client's hotbar
 * gate and the server's authoritative check cannot drift apart: in test mode a
 * skill is effectively free.
 * @param {string} skill skill id
 * @returns {number} MP to spend (0 in test mode)
 */
export function effectiveSkillMpCost(skill) {
  return isTestMode() ? 0 : skillMpCost(skill);
}

/**
 * Cooldown (ms) a cast actually starts.
 *
 * In test mode every skill is ready immediately, so nothing is ever put on
 * cooldown and the hotbar shows no recovery scrim.
 * @param {string} skill skill id
 * @returns {number} cooldown in ms (0 in test mode)
 */
export function effectiveSkillCooldown(skill) {
  return isTestMode() ? 0 : skillCooldown(skill);
}

/**
 * Prerequisite list of a skill (empty when it is a tree root).
 * @param {Object|string} skill
 * @returns {{ id: string, level: number }[]}
 */
export function skillRequires(skill) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  return Array.isArray(entry?.requires) ? entry.requires : [];
}

/**
 * Normalise a caller-supplied level to a usable integer.
 * @param {*} level
 * @returns {number}
 */
function normalizedLevel(level) {
  return Number.isFinite(level) ? Math.floor(level) : 1;
}

/** Depth guard so a malformed (cyclic) catalog can never hang a reader. */
const MAX_REQUIRE_DEPTH = 8;

/**
 * Coerce the learned-skill payload into a Set, or null when the caller did not
 * provide one (legacy level-only callers).
 * @param {*} learned
 * @returns {Set<string>|null}
 */
function toLearnedSet(learned) {
  if (learned instanceof Set) return learned;
  if (Array.isArray(learned)) {
    return new Set(learned.filter((id) => typeof id === "string"));
  }
  return null;
}

/** Whether `entry` is known, treating starter skills as always known. */
function knowsEntry(entry, learnedSet) {
  if (!entry) return false;
  if (entry.starter === true) return true;
  return Boolean(learnedSet && learnedSet.has(entry.id));
}

function isEntryUnlocked(entry, level, depth, seen) {
  if (!entry || depth > MAX_REQUIRE_DEPTH || seen.has(entry.id)) return false;
  if (level < entry.unlockLevel) return false;

  const requires = Array.isArray(entry.requires) ? entry.requires : [];
  if (requires.length === 0) return true;

  const nextSeen = new Set(seen).add(entry.id);
  return requires.every((req) => {
    const prerequisite = SKILLS_BY_ID.get(req.id);
    if (!prerequisite) return false;
    const requiredLevel = req.level ?? prerequisite.unlockLevel;
    if (level < requiredLevel) return false;
    return isEntryUnlocked(prerequisite, level, depth + 1, nextSeen);
  });
}

/**
 * Whether a skill's level and prerequisite levels are satisfied (legacy,
 * level-only gate used before book learning existed).
 * @param {Object|string} skill
 * @param {number} level
 * @returns {boolean}
 */
export function skillUnlocked(skill, level) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  return isEntryUnlocked(entry, normalizedLevel(level), 0, new Set());
}

/**
 * Whether the hero knows a skill. Starter skills are always known.
 * @param {Object|string} skill
 * @param {Iterable<string>|Set<string>} learned learned skill ids
 * @returns {boolean}
 */
export function skillLearned(skill, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  return knowsEntry(entry, toLearnedSet(learned));
}

/** Whether a catalog entry is the free starter skill. */
export function skillStarter(skill) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  return Boolean(entry?.starter);
}

/**
 * The first prerequisite of `skill` the hero has not learned yet, or null.
 * @param {Object|string} skill
 * @param {Iterable<string>|Set<string>} learned
 * @returns {{ id: string, nameKey?: string, level: number }|null}
 */
export function skillMissingPrereq(skill, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return null;
  const learnedSet = toLearnedSet(learned) || new Set();

  for (const req of skillRequires(entry)) {
    const prerequisite = SKILLS_BY_ID.get(req.id);
    if (!prerequisite) {
      return { id: req.id, level: req.level ?? 1 };
    }
    if (!knowsEntry(prerequisite, learnedSet)) {
      return {
        id: prerequisite.id,
        nameKey: prerequisite.nameKey,
        level: prerequisite.unlockLevel
      };
    }
  }
  return null;
}

/**
 * Whether a book for this skill can be studied right now: the level is high
 * enough and every prerequisite is already learned.
 * @param {Object|string} skill
 * @param {number} level
 * @param {Iterable<string>|Set<string>} learned
 * @returns {boolean}
 */
export function skillLearnable(skill, level, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  if (normalizedLevel(level) < entry.unlockLevel) return false;
  return skillMissingPrereq(entry, learned) === null;
}

/**
 * Whether the hero may cast this skill: it is learned (or starter) and the
 * character level is high enough.
 * @param {Object|string} skill
 * @param {number} level
 * @param {Iterable<string>|Set<string>} learned
 * @returns {boolean}
 */
export function skillUsable(skill, level, learned) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  if (normalizedLevel(level) < entry.unlockLevel) return false;
  return knowsEntry(entry, toLearnedSet(learned));
}

/**
 * Why a skill is still locked, or `null` when the skill is available.
 *
 * `{ kind: "level", level }` means the character level is still too low;
 * `{ kind: "prereq", id, nameKey, level }` means another skill must be learned
 * first; `{ kind: "book" }` means the prerequisites are met but the skill has
 * not been studied from its book yet. An unknown skill id yields `null`.
 *
 * @param {Object|string} skill
 * @param {number} level
 * @param {Iterable<string>|Set<string>|null} [learned=null] learned skill ids;
 *   pass null for the legacy level-only gate.
 * @returns {{ kind: "level"|"prereq"|"book", level?: number, id?: string,
 *   nameKey?: string }|null}
 */
export function skillLockReason(skill, level, learned = null) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return null;

  const current = normalizedLevel(level);
  if (current < entry.unlockLevel) {
    return { kind: "level", level: entry.unlockLevel };
  }

  const learnedSet = toLearnedSet(learned);
  if (learnedSet) {
    if (!knowsEntry(entry, learnedSet)) {
      const missing = skillMissingPrereq(entry, learnedSet);
      if (missing) return { kind: "prereq", ...missing };
      return { kind: "book" };
    }
    return null;
  }

  for (const req of skillRequires(entry)) {
    const prerequisite = SKILLS_BY_ID.get(req.id);
    const requiredLevel = req.level ?? prerequisite?.unlockLevel ?? 1;

    if (current < requiredLevel) {
      return {
        kind: "prereq",
        id: prerequisite?.id ?? req.id,
        nameKey: prerequisite?.nameKey,
        level: requiredLevel
      };
    }
    if (prerequisite && !isEntryUnlocked(prerequisite, current, 1, new Set([entry.id]))) {
      return {
        kind: "prereq",
        id: prerequisite.id,
        nameKey: prerequisite.nameKey,
        level: prerequisite.unlockLevel
      };
    }
  }

  return null;
}

/**
 * Slot index for a skill id, or -1 when unknown.
 * @param {string} skill
 * @returns {number}
 */
export function skillSlot(skill) {
  return SLOT_INDEX_BY_ID.has(skill) ? SLOT_INDEX_BY_ID.get(skill) : -1;
}
