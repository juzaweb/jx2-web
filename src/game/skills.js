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
 * Thiếu Lâm kit is being rebuilt as a palm-technique (chưởng pháp) kit. The old
 * Thiếu Lâm Võ Tông (TLQ) fist/kick skills and icons were removed; this is the
 * first palm skill, with the remaining slots landing in later phases.
 */
const THIEU_LAM_SKILLS = [
  {
    id: "dai_tu_di_chuong",
    sect: "thieu-lam",
    slot: 2,
    icon: "/skills/dai_tu_di_chuong.png",
    glyph: "掌",
    nameKey: "skills.thieuLam.daiTuDiChuong.name",
    descKey: "skills.thieuLam.daiTuDiChuong.desc",
    // Temporary: this is the only authored palm skill, so it unlocks at 1 for
    // playtesting. Restore to 3 once slots 0-1 land.
    unlockLevel: 1,
    mp: 12,
    cooldown: 6000,
    target: "enemy",
    // The client caps this to the visible camera range; 6000 is the server cap.
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
    id: "la_han_tran",
    sect: "thieu-lam",
    slot: 3,
    icon: "/skills/la_han_tran.png",
    glyph: "陣",
    nameKey: "skills.thieuLam.laHanTran.name",
    descKey: "skills.thieuLam.laHanTran.desc",
    // Temporary: unlocks at 1 for playtesting until the full kit lands (canonical: 5).
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
      scale: 0.85,
      fps: 10
    }
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
