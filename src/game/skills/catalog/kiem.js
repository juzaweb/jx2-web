/**
 * Sword (kiếm) kit: the free starter art plus both sword schools.
 *
 * Slots are renumbered in {@link KIEM_SKILLS} so the tree renders as one kit:
 * 0 = starter, 1-4 = first school, 5-8 = second school.
 */

import { defineSkill } from "../schema.js";

/**
 * Starter sword skill. Every new hero learns Kiếm Khí and starts with a sword,
 * so its book is never dropped; `starter: true` also makes it always known.
 */
const KIEM_KHI_SKILL = defineSkill({
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
  range: 1000,
  radius: 0,
  mult: 1.1,
  /**
   * The blast is real damage, not just decoration: every monster standing in the
   * burst takes a fraction of the primary hit. `radius` stays 0 because the cast
   * itself is still aimed at one target — the server resolves the area from
   * `splashVictims` when the hit lands.
   */
  splash: { radius: 220, mult: 0.6, maxTargets: 6 },
  vfx: {
    /**
     * The authored sheet carries the whole sequence: the first frame is the
     * flying shard (looped as the travel animation), then the vortex, the burst
     * and a held burst that own the impact — so there is no separate `impact`
     * primitive. `travelFrames: 1` keeps that single travel pose from looping
     * into the impact frames, and `rotateToTarget` turns the blade toward the
     * victim instead of always flying right. The burst blooms past the shard's
     * size so it reads as the hit.
     */
    sprite: "vfx-kiem-khi",
    travelFrames: 1,
    impact: null,
    rotateToTarget: true,
    impactScale: 1.8,
    color: 0x9be8ff,
    fps: 12
  }
});

const KIEM_VO_DANG_SKILLS = [
  defineSkill({
    id: "thieu_duong_kiem_phap",
    weapon: "kiem",
    slot: 0,
    book: { viName: "Thiếu Dương Kiếm Pháp", dropTiers: ["son-ca"] },
    glyph: "剑",
    nameKey: "skills.voDang.thieuDuongKiemPhap.name",
    descKey: "skills.voDang.thieuDuongKiemPhap.desc",
    unlockLevel: 10,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 200,
    radius: 0,
    mult: 1.2
  }),
  defineSkill({
    id: "thai_cuc_quyen",
    weapon: "kiem",
    slot: 1,
    book: { viName: "Thái Cực Kiếm Pháp", dropTiers: ["da-lang", "lam-tac"] },
    glyph: "太",
    requires: [{ id: "thieu_duong_kiem_phap", level: 1 }],
    nameKey: "skills.voDang.thaiCucQuyen.name",
    descKey: "skills.voDang.thaiCucQuyen.desc",
    unlockLevel: 18,
    mp: 10,
    cooldown: 3500,
    target: "enemy",
    range: 180,
    radius: 0,
    mult: 1.35
  }),
  defineSkill({
    id: "tam_thanh_kiem_phap",
    weapon: "kiem",
    slot: 2,
    book: {
      viName: "Tam Thanh Kiếm Pháp",
      dropTiers: ["lam-tac", "hac-y-sat-thu", "thiet-giap-binh"]
    },
    glyph: "三",
    requires: [{ id: "thai_cuc_quyen", level: 1 }],
    nameKey: "skills.voDang.tamThanhKiemPhap.name",
    descKey: "skills.voDang.tamThanhKiemPhap.desc",
    unlockLevel: 26,
    mp: 15,
    cooldown: 5000,
    target: "enemy",
    range: 400,
    radius: 0,
    mult: 1.5
  }),
  defineSkill({
    id: "toat_hong_quan_khuyet",
    weapon: "kiem",
    slot: 3,
    book: {
      viName: "Toát Hồng Quân Khuyết",
      dropTiers: ["thiet-giap-binh", "ma-giao-de-tu", "tuyet-lang", "son-tac-dau-linh"]
    },
    glyph: "罡",
    requires: [{ id: "tam_thanh_kiem_phap", level: 2 }],
    nameKey: "skills.voDang.toatHongQuanKhuyet.name",
    descKey: "skills.voDang.toatHongQuanKhuyet.desc",
    unlockLevel: 34,
    mp: 20,
    cooldown: 8000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "attackPct", amount: 0.15, duration: 180000 }]
  })
];

const KIEM_NGA_MY_SKILLS = [
  defineSkill({
    id: "nga_my_kiem_phap",
    weapon: "kiem",
    slot: 0,
    book: { viName: "Nga My Kiếm Pháp", dropTiers: ["son-ca"] },
    glyph: "剑",
    nameKey: "skills.ngaMy.ngaMyKiemPhap.name",
    descKey: "skills.ngaMy.ngaMyKiemPhap.desc",
    unlockLevel: 10,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 200,
    radius: 0,
    mult: 1.15
  }),
  defineSkill({
    id: "mong_diep_thoi_tam",
    weapon: "kiem",
    slot: 1,
    book: { viName: "Mộng Điệp Thôi Tâm", dropTiers: ["da-lang", "lam-tac"] },
    glyph: "蝶",
    requires: [{ id: "nga_my_kiem_phap", level: 1 }],
    nameKey: "skills.ngaMy.mongDiepThoiTam.name",
    descKey: "skills.ngaMy.mongDiepThoiTam.desc",
    unlockLevel: 18,
    mp: 12,
    cooldown: 4000,
    target: "enemy",
    range: 350,
    radius: 0,
    mult: 1.3
  }),
  defineSkill({
    id: "tu_hang_pho_do",
    weapon: "kiem",
    slot: 2,
    book: { viName: "Từ Hàng Phổ Độ", dropTiers: ["lam-tac", "hac-y-sat-thu"] },
    glyph: "医",
    requires: [{ id: "mong_diep_thoi_tam", level: 1 }],
    nameKey: "skills.ngaMy.tuHangPhoDo.name",
    descKey: "skills.ngaMy.tuHangPhoDo.desc",
    unlockLevel: 26,
    mp: 20,
    cooldown: 6000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "heal", amount: 50 }]
  }),
  defineSkill({
    id: "luu_thuy_khanh_van",
    weapon: "kiem",
    slot: 3,
    book: {
      viName: "Lưu Thủy Khánh Vân",
      dropTiers: ["thiet-giap-binh", "ma-giao-de-tu", "tuyet-lang", "son-tac-dau-linh"]
    },
    glyph: "云",
    requires: [{ id: "tu_hang_pho_do", level: 2 }],
    nameKey: "skills.ngaMy.luuThuyKhanhVan.name",
    descKey: "skills.ngaMy.luuThuyKhanhVan.desc",
    unlockLevel: 34,
    mp: 18,
    cooldown: 10000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "speedPct", amount: 0.25, duration: 120000 }]
  })
];

/** The full sword kit, slots renumbered so it renders as a single tree. */
export const KIEM_SKILLS = [
  KIEM_KHI_SKILL,
  ...KIEM_VO_DANG_SKILLS.map((skill, index) => ({ ...skill, slot: index + 1 })),
  ...KIEM_NGA_MY_SKILLS.map((skill, index) => ({ ...skill, slot: index + 5 }))
];
