/**
 * Sword (kiếm) kits: the two sword sects, Võ Đang and Nga My.
 *
 * Each sect is its own kit and slot 0 is the free starter art every hero of
 * that sect already knows; the remaining arts are studied from the F5 tree.
 */

import { defineSkill } from "../schema.js";

export const VO_DANG_SKILLS = [
  defineSkill({
    id: "thieu_duong_kiem_phap",
    weapon: "kiem",
    slot: 0,
    icon: "/skills/thieu_duong_kiem_phap.png",
    glyph: "剑",
    nameKey: "skills.voDang.thieuDuongKiemPhap.name",
    descKey: "skills.voDang.thieuDuongKiemPhap.desc",
    unlockLevel: 1,
    starter: true,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 200,
    radius: 0,
    mult: 1.2,
    vfx: {
      sprite: "vfx-thieu-duong-kiem-phap",
      travelFrames: 1,
      impact: null,
      color: 0xffa726,
      fps: 12
    }
  }),
  defineSkill({
    id: "thai_cuc_quyen",
    weapon: "kiem",
    slot: 1,
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

export const NGA_MY_SKILLS = [
  defineSkill({
    id: "nga_my_kiem_phap",
    weapon: "kiem",
    slot: 0,
    glyph: "剑",
    nameKey: "skills.ngaMy.ngaMyKiemPhap.name",
    descKey: "skills.ngaMy.ngaMyKiemPhap.desc",
    unlockLevel: 1,
    starter: true,
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
