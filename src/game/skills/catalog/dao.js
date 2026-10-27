/**
 * Đao (saber) kit — the Ngũ Độc school, focused on poison-themed strikes and a
 * critical-rate internal art.
 */

import { defineSkill } from "../schema.js";

export const DAO_SKILLS = [
  defineSkill({
    id: "ngu_doc_tam_phap",
    weapon: "dao",
    slot: 0,
    book: { viName: "Ngũ Độc Tâm Pháp", dropTiers: ["da-lang"] },
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
  }),
  defineSkill({
    id: "truy_tam_doc",
    weapon: "dao",
    slot: 1,
    book: { viName: "Truy Tâm Độc", dropTiers: ["da-lang"] },
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
  }),
  defineSkill({
    id: "van_doc_chieu_hong",
    weapon: "dao",
    slot: 2,
    book: { viName: "Vạn Độc Triệu Cổ", dropTiers: ["lam-tac", "thiet-giap-binh"] },
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
  }),
  defineSkill({
    id: "u_hong_phiet_anh",
    weapon: "dao",
    slot: 3,
    book: { viName: "U Hồn Phiệt Ảnh", dropTiers: ["hac-y-sat-thu", "ma-giao-de-tu"] },
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
  })
];
