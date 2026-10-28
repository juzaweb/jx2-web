/**
 * Bao tay (fist / glove) kit.
 *
 * Slot 0 is `thieu_lam_tam_phap`: a passive internal art that is always running
 * (no cast, no MP, no cooldown) and restores `hpPerSecond` health while the hero
 * is alive. See `passiveRegen.js` for the shared regen maths.
 */

import { defineSkill } from "../schema.js";

export const BAO_TAY_SKILLS = [
  defineSkill({
    id: "thieu_lam_tam_phap",
    weapon: "bao-tay",
    slot: 0,
    book: { viName: "Thiếu Lâm Tâm Pháp", dropTiers: ["soi-xam"] },
    icon: "/skills/thieu_lam_tam_phap.png",
    glyph: "心",
    nameKey: "skills.thieuLam.thieuLamTamPhap.name",
    descKey: "skills.thieuLam.thieuLamTamPhap.desc",
    unlockLevel: 10,
    mp: 0,
    cooldown: 0,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    /** Always-on internal art: never cast from the hotbar, never consumes MP. */
    passive: true,
    effects: [{ kind: "regen", hpPerSecond: 2 }]
  }),
  defineSkill({
    id: "dai_tu_di_chuong",
    weapon: "bao-tay",
    slot: 1,
    book: { viName: "Đại Tu Di Chưởng", dropTiers: ["soi-xam", "son-ca"] },
    icon: "/skills/dai_tu_di_chuong.png",
    glyph: "掌",
    requires: [{ id: "thieu_lam_tam_phap", level: 1 }],
    nameKey: "skills.thieuLam.daiTuDiChuong.name",
    descKey: "skills.thieuLam.daiTuDiChuong.desc",
    unlockLevel: 18,
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
  }),
  defineSkill({
    id: "la_han_quyen",
    weapon: "bao-tay",
    slot: 2,
    book: { viName: "La Hán Quyền", dropTiers: ["da-lang", "lam-tac"] },
    icon: "/skills/la_han_quyen.png",
    glyph: "拳",
    nameKey: "skills.thieuLam.laHanQuyen.name",
    descKey: "skills.thieuLam.laHanQuyen.desc",
    unlockLevel: 10,
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
      preset: "slash",
      color: 0xffc94d
    }
  }),
  defineSkill({
    id: "la_han_tran",
    weapon: "bao-tay",
    slot: 3,
    book: { viName: "La Hán Trận", dropTiers: ["lam-tac", "hac-y-sat-thu"] },
    icon: "/skills/la_han_tran.png",
    glyph: "陣",
    requires: [{ id: "dai_tu_di_chuong", level: 1 }],
    nameKey: "skills.thieuLam.laHanTran.name",
    descKey: "skills.thieuLam.laHanTran.desc",
    unlockLevel: 26,
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
      preset: "formation",
      sprite: "vfx-la-han-tran",
      color: 0xffd166,
      shake: 0,
      scale: 0.6,
      fps: 12
    }
  }),
  defineSkill({
    id: "kim_cang_bat_hoai",
    weapon: "bao-tay",
    slot: 4,
    book: {
      viName: "Kim Cang Bất Hoại",
      dropTiers: ["thiet-giap-binh", "ma-giao-de-tu", "tuyet-lang", "son-tac-dau-linh"]
    },
    icon: "/skills/kim_cang_bat_hoai.png",
    glyph: "卍",
    requires: [{ id: "la_han_tran", level: 1 }],
    nameKey: "skills.thieuLam.kimCangBatHoai.name",
    descKey: "skills.thieuLam.kimCangBatHoai.desc",
    unlockLevel: 34,
    mp: 20,
    cooldown: 18000,
    target: "self",
    range: 0,
    radius: 0,
    mult: 0,
    effects: [{ kind: "buff", stat: "defensePct", amount: 0.3, duration: 30000 }],
    vfx: {
      preset: "aura",
      overhead: "buff-phat-an",
      color: 0xffd166,
      overheadScale: 0.05,
      overheadOffsetY: -80
    }
  }),
  defineSkill({
    id: "nhu_lai_than_chuong",
    weapon: "bao-tay",
    slot: 5,
    book: {
      viName: "Như Lai Thần Chưởng",
      dropTiers: ["kim-giap-binh", "huyet-ma", "nga-mi-kiem-nu", "bang-tam-yeu"]
    },
    icon: "/skills/nhu_lai_than_chuong.png",
    glyph: "佛",
    requires: [{ id: "la_han_tran", level: 1 }],
    nameKey: "skills.thieuLam.nhuLaiThanChuong.name",
    descKey: "skills.thieuLam.nhuLaiThanChuong.desc",
    unlockLevel: 50,
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
  })
];
