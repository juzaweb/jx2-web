/**
 * Ngũ Độc (đao / saber) kit — poison-themed strikes and a critical-rate
 * internal art. Slot 0 is the sect starter.
 */

import { defineSkill } from "../schema.js";

export const NGU_DOC_SKILLS = [
  defineSkill({
    id: "ngu_doc_tam_phap",
    weapon: "dao",
    slot: 0,
    icon: "/skills/ngu_doc_tam_phap.png",
    glyph: "毒",
    nameKey: "skills.nguDoc.nguDocTamPhap.name",
    descKey: "skills.nguDoc.nguDocTamPhap.desc",
    unlockLevel: 1,
    starter: true,
    mp: 6,
    cooldown: 1500,
    target: "enemy",
    range: 250,
    radius: 0,
    mult: 1.1,
    vfx: {
      sprite: "vfx-ngu-doc-tam-phap",
      travelFrames: 1,
      impact: null,
      color: 0x22c55e,
      fps: 12
    }
  }),
  defineSkill({
    id: "truy_tam_doc",
    weapon: "dao",
    slot: 1,
    icon: "/skills/truy_tam_doc.png",
    glyph: "心",
    requires: [{ id: "ngu_doc_tam_phap", level: 1 }],
    nameKey: "skills.nguDoc.truyTamDoc.name",
    descKey: "skills.nguDoc.truyTamDoc.desc",
    unlockLevel: 18,
    mp: 10,
    cooldown: 3000,
    target: "enemy",
    range: 300,
    radius: 0,
    mult: 1.25,
    vfx: {
      sprite: "vfx-truy-tam-doc",
      travelFrames: 1,
      impact: null,
      color: 0x9333ea,
      fps: 12
    }
  }),
  defineSkill({
    id: "van_doc_chieu_hong",
    weapon: "dao",
    slot: 2,
    icon: "/skills/van_doc_chieu_hong.png",
    glyph: "蛊",
    requires: [{ id: "truy_tam_doc", level: 1 }],
    nameKey: "skills.nguDoc.vanDocChieuHong.name",
    descKey: "skills.nguDoc.vanDocChieuHong.desc",
    unlockLevel: 26,
    mp: 16,
    cooldown: 6000,
    target: "enemy",
    range: 400,
    radius: 0,
    mult: 1.4,
    vfx: {
      sprite: "vfx-van-doc-chieu-hong",
      travelFrames: 1,
      impact: null,
      color: 0xa855f7,
      fps: 12
    }
  }),
  defineSkill({
    id: "u_hong_phiet_anh",
    weapon: "dao",
    slot: 3,
    icon: "/skills/u_hong_phiet_anh.png",
    glyph: "影",
    requires: [{ id: "van_doc_chieu_hong", level: 2 }],
    nameKey: "skills.nguDoc.uHongPhietAnh.name",
    descKey: "skills.nguDoc.uHongPhietAnh.desc",
    unlockLevel: 34,
    mp: 22,
    cooldown: 8000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "critRate", amount: 0.1, duration: 120000 }],
    vfx: {
      sprite: "vfx-u-hong-phiet-anh",
      color: 0x7e22ce,
      fps: 12
    }
  })
];
