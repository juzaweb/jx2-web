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
 * Thiếu Lâm Võ Tông (TLQ) fist/kick skills and icons were removed. Slots 0-3 and
 * the ultimate (slot 5) have catalog entries; slot 4 is still to be authored,
 * and slots 0-1 still carry their interim names.
 */
const THIEU_LAM_SKILLS = [
  {
    id: "la_han_quyen",
    sect: "thieu-lam",
    slot: 0,
    icon: "/skills/la_han_quyen.png",
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
    icon: "/skills/thieu_lam_truong_phap.png",
    glyph: "掌",
    requires: [{ id: "la_han_quyen", level: 1 }],
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
    requires: [{ id: "thieu_lam_truong_phap", level: 1 }],
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
    id: "nhu_lai_than_chuong",
    sect: "thieu-lam",
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
    sect: "vo-dang",
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
    sect: "vo-dang",
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
    sect: "nga-my",
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
    sect: "nga-my",
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
    sect: "ngu-doc",
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
    sect: "ngu-doc",
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
 * Whether a skill is available at the given level, including its prerequisites.
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
 * Why a skill is still locked, or `null` when the skill is available.
 *
 * `{ kind: "level", level }` means the character level is still too low;
 * `{ kind: "prereq", id, nameKey, level }` means another skill in the tree has
 * to be available first. An unknown skill id also yields `null`; callers must
 * gate availability with `skillUnlocked`, which returns `false` for it.
 * @param {Object|string} skill
 * @param {number} level
 * @returns {{ kind: "level"|"prereq", level: number, id?: string, nameKey?: string }|null}
 */
export function skillLockReason(skill, level) {
  const entry = typeof skill === "string" ? SKILLS_BY_ID.get(skill) : skill;
  if (!entry) return null;

  const current = normalizedLevel(level);
  if (current < entry.unlockLevel) {
    return { kind: "level", level: entry.unlockLevel };
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
