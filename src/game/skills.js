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
    range: 150,
    radius: 0,
    mult: 1.2
  },
  {
    id: "thieu_lam_truong_phap",
    sect: "thieu-lam",
    slot: 1,
    glyph: "掌",
    nameKey: "skills.thieuLam.thieuLamTruongPhap.name",
    descKey: "skills.thieuLam.thieuLamTruongPhap.desc",
    unlockLevel: 1,
    mp: 8,
    cooldown: 2500,
    target: "enemy",
    range: 250,
    radius: 0,
    mult: 1.25
  },
  {
    id: "dai_tu_di_chuong",
    sect: "thieu-lam",
    slot: 2,
    icon: "/skills/dai_tu_di_chuong.png",
    glyph: "掌",
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
    id: "la_han_tran",
    sect: "thieu-lam",
    slot: 3,
    icon: "/skills/la_han_tran.png",
    glyph: "陣",
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
  }
];

const VO_DANG_SKILLS = [
  {
    id: "thieu_duong_kiem_phap",
    sect: "vo-dang",
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
    sect: "vo-dang",
    slot: 1,
    glyph: "太",
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
    sect: "vo-dang",
    slot: 2,
    glyph: "三",
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
    sect: "vo-dang",
    slot: 3,
    glyph: "罡",
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

const NGA_MY_SKILLS = [
  {
    id: "nga_my_kiem_phap",
    sect: "nga-my",
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
    sect: "nga-my",
    slot: 1,
    glyph: "蝶",
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
    sect: "nga-my",
    slot: 2,
    glyph: "医",
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
    sect: "nga-my",
    slot: 3,
    glyph: "云",
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

const NGU_DOC_SKILLS = [
  {
    id: "ngu_doc_tam_phap",
    sect: "ngu-doc",
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
    sect: "ngu-doc",
    slot: 1,
    glyph: "心",
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
    sect: "ngu-doc",
    slot: 2,
    glyph: "蛊",
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
    sect: "ngu-doc",
    slot: 3,
    glyph: "影",
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
