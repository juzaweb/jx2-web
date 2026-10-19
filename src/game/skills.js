/**
 * Skill catalog shared by the client and the server.
 *
 * Every skill is data: MP cost, cooldown, range/radius and damage multiplier are
 * authoritative and therefore consumed by the server when it validates a cast and
 * computes the resulting damage. The client reads the same table to predict the
 * cost, gate the hotbar and render its VFX.
 *
 * A skill's `effects` are applied on a successful hit (or on self when
 * `target === "self"`). Only the effect kinds used by shipped skills are listed
 * here; unknown kinds are ignored, so the catalog can grow without breaking old
 * readers.
 */

/** Number of skill slots on the client hotbar. */
export const SKILL_SLOTS = 6;

/** Skill ids that are not real skills, resolved by the server as a plain attack. */
export const BASIC_ATTACK_ID = "normal";

/**
 * Thiếu Lâm – Võ Tông kit. Only the first shipped sect has real skills today;
 * the other sects resolve to an empty list until their kits are authored.
 */
const THIEU_LAM_SKILLS = [
  {
    id: "la_han_quyen",
    sect: "thieu-lam",
    slot: 0,
    glyph: "拳",
    nameKey: "skills.thieuLam.laHanQuyen.name",
    descKey: "skills.thieuLam.laHanQuyen.desc",
    unlockLevel: 1,
    mp: 5,
    cooldown: 1500,
    target: "enemy",
    range: 85,
    radius: 0,
    mult: 1.1,
    effects: [],
    vfx: { cast: "slash", impact: "spark", color: 0xe0a34a, shake: 0 }
  },
  {
    id: "ca_diep_thoai",
    sect: "thieu-lam",
    slot: 1,
    glyph: "腿",
    nameKey: "skills.thieuLam.caDiepThoai.name",
    descKey: "skills.thieuLam.caDiepThoai.desc",
    unlockLevel: 1,
    mp: 7,
    cooldown: 4000,
    target: "enemy",
    range: 95,
    radius: 0,
    mult: 1.0,
    effects: [{ kind: "slow", pct: 0.3, duration: 2000 }],
    vfx: { cast: "kick", impact: "dust", color: 0xe0a34a, shake: 0 }
  },
  {
    id: "vi_da_quyen",
    sect: "thieu-lam",
    slot: 2,
    glyph: "手",
    nameKey: "skills.thieuLam.viDaQuyen.name",
    descKey: "skills.thieuLam.viDaQuyen.desc",
    unlockLevel: 3,
    mp: 12,
    cooldown: 6000,
    target: "enemy",
    range: 85,
    radius: 0,
    mult: 1.7,
    effects: [],
    vfx: { cast: "slash", impact: "burst", color: 0xffc766, shake: 0 }
  },
  {
    id: "dai_tu_di_chuong",
    sect: "thieu-lam",
    slot: 3,
    glyph: "掌",
    nameKey: "skills.thieuLam.daiTuDiChuong.name",
    descKey: "skills.thieuLam.daiTuDiChuong.desc",
    unlockLevel: 5,
    mp: 18,
    cooldown: 9000,
    target: "enemy",
    range: 120,
    radius: 110,
    mult: 1.3,
    effects: [{ kind: "stun", duration: 800 }],
    vfx: { cast: "shockwave", impact: "burst", color: 0xffb347, shake: 0.004 }
  },
  {
    id: "hue_nhan_chu",
    sect: "thieu-lam",
    slot: 4,
    glyph: "眼",
    nameKey: "skills.thieuLam.hueNhanChu.name",
    descKey: "skills.thieuLam.hueNhanChu.desc",
    unlockLevel: 7,
    mp: 15,
    cooldown: 15000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [
      { kind: "buff", stat: "critRate", amount: 0.15, duration: 8000 },
      { kind: "buff", stat: "attackPct", amount: 0.1, duration: 8000 }
    ],
    vfx: { cast: "aura", impact: null, color: 0xffd166, shake: 0 }
  },
  {
    id: "nhu_lai_than_thuong",
    sect: "thieu-lam",
    slot: 5,
    glyph: "如",
    nameKey: "skills.thieuLam.nhuLaiThanThuong.name",
    descKey: "skills.thieuLam.nhuLaiThanThuong.desc",
    unlockLevel: 10,
    mp: 35,
    cooldown: 30000,
    target: "enemy",
    range: 140,
    radius: 140,
    mult: 2.4,
    effects: [{ kind: "stun", duration: 1200 }],
    vfx: { cast: "shockwave", impact: "burst", color: 0xffe08a, shake: 0.008 }
  }
];

const VO_DANG_SKILLS = [];
const NGA_MY_SKILLS = [];
const NGU_DOC_SKILLS = [];

/** All authored skills, in catalog order. */
export const SKILLS = [...THIEU_LAM_SKILLS, ...VO_DANG_SKILLS, ...NGA_MY_SKILLS, ...NGU_DOC_SKILLS];

/** Skill lists keyed by sect id. */
export const SKILLS_BY_SECT = {
  "thieu-lam": THIEU_LAM_SKILLS,
  "vo-dang": VO_DANG_SKILLS,
  "nga-my": NGA_MY_SKILLS,
  "ngu-doc": NGU_DOC_SKILLS
};

const SKILLS_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));
const SLOT_INDEX_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill.slot]));

/**
 * Normalise a caller-supplied sect to a known id.
 * @param {*} sect
 * @returns {string}
 */
export const normalizeSect = (sect) =>
  Object.prototype.hasOwnProperty.call(SKILLS_BY_SECT, sect) ? sect : "thieu-lam";

/**
 * All skills authored for a sect, ordered by slot.
 * @param {string} sect
 * @returns {Object[]}
 */
export function skillsForSect(sect) {
  return SKILLS_BY_SECT[normalizeSect(sect)] || [];
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
 * Skill assigned to a hotbar slot for a sect, if any.
 * @param {string} sect
 * @param {number} slot
 * @returns {Object|undefined}
 */
export function skillForSlot(sect, slot) {
  return skillsForSect(sect).find((skill) => skill.slot === slot);
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
 * Whether a skill is available at the given level.
 * @param {Object|string} skill
 * @param {number} level
 * @returns {boolean}
 */
export function skillUnlocked(skill, level) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return false;
  const normalized = Number.isFinite(level) ? Math.floor(level) : 1;
  return normalized >= entry.unlockLevel;
}

/**
 * Slot index for a skill id, or -1 when unknown.
 * @param {string} skill
 * @returns {number}
 */
export function skillSlot(skill) {
  return SLOT_INDEX_BY_ID.has(skill) ? SLOT_INDEX_BY_ID.get(skill) : -1;
}
