/**
 * Monster catalog shared by the Phaser client and the Node server.
 *
 * Every entry is pure data: no Phaser, no transport. The client uses `visual` to
 * paint the monster procedurally; the server uses `ai` to step it, the combat
 * block to roll bites and the reward block to pay the killer, so both runtimes
 * can never drift apart.
 *
 * Levels are tuned for the Đông Môn Thành hunting grounds, which span levels 3-29.
 * `soi-xam` (Sói Xám) is the legacy market wolf: its reward stays at 35 EXP and
 * 3-9 coins so the existing server reward tests keep their expectations.
 */

/**
 * @typedef {object} MonsterVisual
 * @property {"beast"|"humanoid"|"armored"|"boss"} kind
 * @property {number} [scale] Multiplier applied on top of the world scale
 * @property {Record<string, number>} palette Colours used by the vector painter
 */

/**
 * @typedef {object} MonsterDefinition
 * @property {string} id
 * @property {string} name Vietnamese display name
 * @property {number} level
 * @property {number} maxHp
 * @property {number} attack
 * @property {number} defense
 * @property {number} critRate
 * @property {number} critDamage
 * @property {number} exp EXP paid to the killer
 * @property {number} coinsMin
 * @property {number} coinsMax
 * @property {boolean} [isBoss]
 * @property {number} [respawnMs] Respawn delay override (server-owned)
 * @property {MonsterVisual} visual
 * @property {object} [ai] Per-monster AI tuning overrides (falls back to ENEMY_TUNING)
 */

/** @type {Record<string, MonsterDefinition>} */
export const MONSTERS = {
  // ── Legacy market wolf (keeps the historical reward numbers) ──────────────
  "soi-xam": {
    id: "soi-xam",
    name: "Sói Xám",
    level: 5,
    maxHp: 45,
    attack: 12,
    defense: 3,
    critRate: 0.05,
    critDamage: 1.5,
    exp: 35,
    coinsMin: 3,
    coinsMax: 9,
    visual: {
      kind: "beast",
      palette: {
        shadow: 0x0b100d,
        body: 0x747b79,
        dark: 0x353d3a,
        head: 0x929b96,
        ear: 0x626b67,
        muzzle: 0xadb4a8,
        accent: 0xffd26b,
        leg: 0x424b48,
        tail: 0x858c87
      }
    }
  },

  // ── Tier 1 — levels 1-10 ─────────────────────────────────────────────────
  "son-ca": {
    id: "son-ca",
    name: "Sơn Cẩu",
    level: 3,
    maxHp: 70,
    attack: 7,
    defense: 1,
    critRate: 0.04,
    critDamage: 1.5,
    exp: 14,
    coinsMin: 2,
    coinsMax: 5,
    visual: {
      kind: "beast",
      scale: 0.92,
      palette: {
        shadow: 0x0b100d,
        body: 0x8a6a45,
        dark: 0x4a3423,
        head: 0xa8845a,
        ear: 0x6b4c31,
        muzzle: 0xc3a67d,
        accent: 0xffe08a,
        leg: 0x55402b,
        tail: 0x9a7a52
      }
    }
  },
  "da-lang": {
    id: "da-lang",
    name: "Dã Lang",
    level: 8,
    maxHp: 120,
    attack: 10,
    defense: 2,
    critRate: 0.06,
    critDamage: 1.5,
    exp: 24,
    coinsMin: 3,
    coinsMax: 7,
    visual: {
      kind: "beast",
      scale: 1.08,
      palette: {
        shadow: 0x0b100d,
        body: 0x5b5f6b,
        dark: 0x2c2f38,
        head: 0x757a88,
        ear: 0x494e5a,
        muzzle: 0xa2a7b4,
        accent: 0x9ff2ff,
        leg: 0x373b45,
        tail: 0x6b7080
      }
    }
  },

  // ── Tier 2 — levels 11-20 ────────────────────────────────────────────────
  "lam-tac": {
    id: "lam-tac",
    name: "Lâm Tặc",
    level: 14,
    maxHp: 190,
    attack: 14,
    defense: 4,
    critRate: 0.06,
    critDamage: 1.5,
    exp: 45,
    coinsMin: 5,
    coinsMax: 12,
    visual: {
      kind: "humanoid",
      palette: {
        shadow: 0x0b100d,
        body: 0x6b4a2f,
        dark: 0x3a2716,
        head: 0xc9a07a,
        accent: 0xd8543f,
        leg: 0x4a3524,
        cloth: 0x8c2f24
      }
    }
  },
  "hac-y-sat-thu": {
    id: "hac-y-sat-thu",
    name: "Hắc Y Sát Thủ",
    level: 19,
    maxHp: 240,
    attack: 18,
    defense: 6,
    critRate: 0.12,
    critDamage: 1.8,
    exp: 70,
    coinsMin: 8,
    coinsMax: 16,
    visual: {
      kind: "humanoid",
      palette: {
        shadow: 0x08090b,
        body: 0x24262e,
        dark: 0x121319,
        head: 0x2f323c,
        accent: 0xd94f5c,
        leg: 0x1b1d24,
        cloth: 0x15161c
      }
    }
  },

  // ── Tier 3 — levels 21-30 ────────────────────────────────────────────────
  "thiet-giap-binh": {
    id: "thiet-giap-binh",
    name: "Thiết Giáp Binh",
    level: 24,
    maxHp: 340,
    attack: 22,
    defense: 10,
    critRate: 0.08,
    critDamage: 1.6,
    exp: 110,
    coinsMin: 12,
    coinsMax: 22,
    visual: {
      kind: "armored",
      scale: 1.05,
      palette: {
        shadow: 0x0a0c0e,
        body: 0x6f7783,
        dark: 0x3d434c,
        head: 0x8b939f,
        accent: 0xffc44d,
        leg: 0x4a505a,
        cloth: 0x8c2f24
      }
    }
  },
  "ma-giao-de-tu": {
    id: "ma-giao-de-tu",
    name: "Ma Giáo Đệ Tử",
    level: 29,
    maxHp: 420,
    attack: 27,
    defense: 12,
    critRate: 0.12,
    critDamage: 1.9,
    exp: 160,
    coinsMin: 15,
    coinsMax: 28,
    visual: {
      kind: "humanoid",
      scale: 1.02,
      palette: {
        shadow: 0x08060a,
        body: 0x4a2a5e,
        dark: 0x2a1636,
        head: 0xc9a07a,
        accent: 0xb46bff,
        leg: 0x33203f,
        cloth: 0x6a2f8f
      }
    }
  },

  // ── Tier 4 — levels 30-44 (Bắc Lĩnh) ─────────────────────────────────────
  // Phase 1 pays EXP and coins only: no book or weapon drops, so the weapon-kit
  // content stays unchanged until the new tiers get their own skills.
  "tuyet-lang": {
    id: "tuyet-lang",
    name: "Tuyết Lang",
    level: 30,
    maxHp: 470,
    attack: 30,
    defense: 13,
    critRate: 0.12,
    critDamage: 1.9,
    exp: 200,
    coinsMin: 18,
    coinsMax: 32,
    visual: {
      kind: "beast",
      scale: 1.12,
      palette: {
        shadow: 0x0b1012,
        body: 0xc9d4d8,
        dark: 0x7d8a92,
        head: 0xe4edf0,
        ear: 0x93a1a9,
        muzzle: 0xf2f7f8,
        accent: 0x9fdcff,
        leg: 0x8b989f,
        tail: 0xb7c2c7
      }
    }
  },
  "son-tac-dau-linh": {
    id: "son-tac-dau-linh",
    name: "Sơn Tặc Đầu Lĩnh",
    level: 36,
    maxHp: 620,
    attack: 36,
    defense: 17,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 270,
    coinsMin: 24,
    coinsMax: 42,
    visual: {
      kind: "humanoid",
      scale: 1.1,
      palette: {
        shadow: 0x0b0d0a,
        body: 0x5a4a2f,
        dark: 0x322818,
        head: 0xc9a07a,
        accent: 0xffb347,
        leg: 0x3e3421,
        cloth: 0x8a3a22
      }
    }
  },
  "hac-hung": {
    id: "hac-hung",
    name: "Hắc Hùng",
    level: 42,
    maxHp: 820,
    attack: 44,
    defense: 22,
    critRate: 0.08,
    critDamage: 1.7,
    exp: 360,
    coinsMin: 30,
    coinsMax: 52,
    visual: {
      kind: "beast",
      scale: 1.25,
      palette: {
        shadow: 0x07090a,
        body: 0x2b2b2f,
        dark: 0x151518,
        head: 0x3a3a40,
        ear: 0x232327,
        muzzle: 0x55555c,
        accent: 0xff7b5c,
        leg: 0x1d1d21,
        tail: 0x333338
      }
    }
  },

  // ── Tier 5 — levels 45-60 (Tây Sơn) ──────────────────────────────────────
  "kim-giap-binh": {
    id: "kim-giap-binh",
    name: "Kim Giáp Binh",
    level: 45,
    maxHp: 900,
    attack: 48,
    defense: 26,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 420,
    coinsMin: 34,
    coinsMax: 58,
    visual: {
      kind: "armored",
      scale: 1.1,
      palette: {
        shadow: 0x0d0b06,
        body: 0xc9a227,
        dark: 0x8a6d14,
        head: 0xe0c56a,
        accent: 0xfff3b0,
        leg: 0x6c5510,
        cloth: 0xa62f2f
      }
    }
  },
  "huyet-ma": {
    id: "huyet-ma",
    name: "Huyết Ma",
    level: 52,
    maxHp: 1100,
    attack: 56,
    defense: 30,
    critRate: 0.14,
    critDamage: 2.0,
    exp: 520,
    coinsMin: 40,
    coinsMax: 70,
    visual: {
      kind: "humanoid",
      scale: 1.08,
      palette: {
        shadow: 0x0c0507,
        body: 0x8c1f2f,
        dark: 0x4a0d18,
        head: 0xd8a08a,
        accent: 0xff4d6d,
        leg: 0x5c1420,
        cloth: 0x6b0f1c
      }
    }
  },
  "tay-vuc-kiem-khach": {
    id: "tay-vuc-kiem-khach",
    name: "Tây Vực Kiếm Khách",
    level: 58,
    maxHp: 1320,
    attack: 66,
    defense: 34,
    critRate: 0.18,
    critDamage: 2.1,
    exp: 650,
    coinsMin: 48,
    coinsMax: 84,
    visual: {
      kind: "humanoid",
      scale: 1.05,
      palette: {
        shadow: 0x090a0c,
        body: 0x3f4a63,
        dark: 0x232a3a,
        head: 0xd0a982,
        accent: 0x7fd4ff,
        leg: 0x2b3242,
        cloth: 0x54627f
      }
    }
  },

  // ── Thục hunting grounds ─────────────────────────────────────────────────
  // Parallel tiers to Ngô's, so every camp can level from its own capital.
  // Phase 1 pays EXP and coins only: no book or weapon drops.
  "thuc-lang": {
    id: "thuc-lang",
    name: "Thục Lang",
    level: 5,
    maxHp: 95,
    attack: 8,
    defense: 2,
    critRate: 0.05,
    critDamage: 1.5,
    exp: 20,
    coinsMin: 2,
    coinsMax: 6,
    visual: {
      kind: "beast",
      scale: 0.95,
      palette: {
        shadow: 0x0b0f0c,
        body: 0x6f7d63,
        dark: 0x3b4636,
        head: 0x8b9a7c,
        ear: 0x59674c,
        muzzle: 0xb3bfa1,
        accent: 0xd7f28a,
        leg: 0x46523d,
        tail: 0x7f8c70
      }
    }
  },
  "truc-xa": {
    id: "truc-xa",
    name: "Trúc Xà",
    level: 15,
    maxHp: 210,
    attack: 15,
    defense: 4,
    critRate: 0.07,
    critDamage: 1.6,
    exp: 50,
    coinsMin: 6,
    coinsMax: 13,
    visual: {
      kind: "beast",
      scale: 0.92,
      palette: {
        shadow: 0x0a0f0b,
        body: 0x5f8a4a,
        dark: 0x33502a,
        head: 0x7aa85f,
        ear: 0x476b35,
        muzzle: 0xb6d49a,
        accent: 0xe8ff9a,
        leg: 0x3c5c31,
        tail: 0x6e9c53
      }
    }
  },
  "ba-thuc-son-tac": {
    id: "ba-thuc-son-tac",
    name: "Ba Thục Sơn Tặc",
    level: 27,
    maxHp: 390,
    attack: 25,
    defense: 11,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 145,
    coinsMin: 14,
    coinsMax: 26,
    visual: {
      kind: "humanoid",
      scale: 1.02,
      palette: {
        shadow: 0x0b0e0a,
        body: 0x4f5c37,
        dark: 0x2c3520,
        head: 0xc9a07a,
        accent: 0xf0b45a,
        leg: 0x374226,
        cloth: 0x7a4a2a
      }
    }
  },
  "kiem-cac-vu-sinh": {
    id: "kiem-cac-vu-sinh",
    name: "Kiếm Các Vũ Sinh",
    level: 30,
    maxHp: 470,
    attack: 30,
    defense: 13,
    critRate: 0.12,
    critDamage: 1.9,
    exp: 200,
    coinsMin: 18,
    coinsMax: 32,
    visual: {
      kind: "humanoid",
      scale: 1.04,
      palette: {
        shadow: 0x0a0d0b,
        body: 0x3f6157,
        dark: 0x243a33,
        head: 0xd0aa86,
        accent: 0x8fe3c9,
        leg: 0x2d443d,
        cloth: 0x527a6c
      }
    }
  },
  "thiet-diep-binh": {
    id: "thiet-diep-binh",
    name: "Thiết Điệp Binh",
    level: 36,
    maxHp: 620,
    attack: 36,
    defense: 17,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 270,
    coinsMin: 24,
    coinsMax: 42,
    visual: {
      kind: "armored",
      scale: 1.06,
      palette: {
        shadow: 0x0a0c0b,
        body: 0x70806f,
        dark: 0x424c41,
        head: 0x8b9a88,
        accent: 0xa8e6a0,
        leg: 0x4d584b,
        cloth: 0x3f5c3a
      }
    }
  },
  "doc-cong-tu": {
    id: "doc-cong-tu",
    name: "Độc Công Tử",
    level: 42,
    maxHp: 820,
    attack: 44,
    defense: 22,
    critRate: 0.08,
    critDamage: 1.7,
    exp: 360,
    coinsMin: 30,
    coinsMax: 52,
    visual: {
      kind: "humanoid",
      scale: 1.02,
      palette: {
        shadow: 0x0a080d,
        body: 0x4c3a62,
        dark: 0x291f36,
        head: 0xc9a07a,
        accent: 0x9dff6b,
        leg: 0x332744,
        cloth: 0x3f2f57
      }
    }
  },
  "nga-mi-kiem-nu": {
    id: "nga-mi-kiem-nu",
    name: "Nga Mi Kiếm Nữ",
    level: 45,
    maxHp: 900,
    attack: 48,
    defense: 26,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 420,
    coinsMin: 34,
    coinsMax: 58,
    visual: {
      kind: "humanoid",
      scale: 0.98,
      palette: {
        shadow: 0x0a0d0c,
        body: 0xd8e6df,
        dark: 0x9aada6,
        head: 0xe8cfb4,
        accent: 0x6ff0d0,
        leg: 0xaebfb8,
        cloth: 0x5f8f80
      }
    }
  },
  "bang-tam-yeu": {
    id: "bang-tam-yeu",
    name: "Băng Tàm Yêu",
    level: 52,
    maxHp: 1100,
    attack: 56,
    defense: 30,
    critRate: 0.14,
    critDamage: 2.0,
    exp: 520,
    coinsMin: 40,
    coinsMax: 70,
    visual: {
      kind: "beast",
      scale: 1.14,
      palette: {
        shadow: 0x0a0f12,
        body: 0xbcd8e6,
        dark: 0x7c9aac,
        head: 0xdceef7,
        ear: 0x92adbd,
        muzzle: 0xeffaff,
        accent: 0x9ff0ff,
        leg: 0x86a2b2,
        tail: 0xaac6d4
      }
    }
  },
  "tu-la-han": {
    id: "tu-la-han",
    name: "Tu La Hán",
    level: 58,
    maxHp: 1320,
    attack: 66,
    defense: 34,
    critRate: 0.18,
    critDamage: 2.1,
    exp: 650,
    coinsMin: 48,
    coinsMax: 84,
    visual: {
      kind: "armored",
      scale: 1.12,
      palette: {
        shadow: 0x0c0608,
        body: 0x6d2a34,
        dark: 0x3d161d,
        head: 0x9c5560,
        accent: 0xff8a6b,
        leg: 0x4a1c24,
        cloth: 0x571f29
      }
    }
  },

  // ── Ngụy hunting grounds ─────────────────────────────────────────────────
  // Parallel tiers to Ngô's; same EXP/coin-only policy as the Thục tiers.
  "dien-thu": {
    id: "dien-thu",
    name: "Điền Thử",
    level: 5,
    maxHp: 90,
    attack: 8,
    defense: 2,
    critRate: 0.05,
    critDamage: 1.5,
    exp: 20,
    coinsMin: 2,
    coinsMax: 6,
    visual: {
      kind: "beast",
      scale: 0.85,
      palette: {
        shadow: 0x0f0c09,
        body: 0x8a7656,
        dark: 0x54462f,
        head: 0xa28d68,
        ear: 0x6b5a3d,
        muzzle: 0xcbb894,
        accent: 0xffd98a,
        leg: 0x5f4f35,
        tail: 0x94805e
      }
    }
  },
  "hoang-lang": {
    id: "hoang-lang",
    name: "Hoang Lang",
    level: 15,
    maxHp: 205,
    attack: 15,
    defense: 4,
    critRate: 0.07,
    critDamage: 1.6,
    exp: 50,
    coinsMin: 6,
    coinsMax: 13,
    visual: {
      kind: "beast",
      scale: 1.0,
      palette: {
        shadow: 0x0b0b0a,
        body: 0x9c917c,
        dark: 0x655d4d,
        head: 0xb3a891,
        ear: 0x7a705d,
        muzzle: 0xd6ccb5,
        accent: 0xffb35c,
        leg: 0x6f6655,
        tail: 0xa79b85
      }
    }
  },
  "lua-dao-tac": {
    id: "lua-dao-tac",
    name: "Lữ Đạo Tặc",
    level: 27,
    maxHp: 385,
    attack: 25,
    defense: 11,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 145,
    coinsMin: 14,
    coinsMax: 26,
    visual: {
      kind: "humanoid",
      scale: 1.02,
      palette: {
        shadow: 0x0c0a08,
        body: 0x6b563c,
        dark: 0x3d3122,
        head: 0xc9a07a,
        accent: 0xd9a04f,
        leg: 0x4a3c29,
        cloth: 0x5c6b3a
      }
    }
  },
  "nghiep-quan-giao-ky": {
    id: "nghiep-quan-giao-ky",
    name: "Nghiệp Quan Giáo Kỵ",
    level: 30,
    maxHp: 470,
    attack: 30,
    defense: 13,
    critRate: 0.12,
    critDamage: 1.9,
    exp: 200,
    coinsMin: 18,
    coinsMax: 32,
    visual: {
      kind: "armored",
      scale: 1.08,
      palette: {
        shadow: 0x0a0c0f,
        body: 0x5c6678,
        dark: 0x353c48,
        head: 0x7e8899,
        accent: 0xbcd6ff,
        leg: 0x414957,
        cloth: 0x6b2f2f
      }
    }
  },
  "thiet-thuong-binh": {
    id: "thiet-thuong-binh",
    name: "Thiết Thương Binh",
    level: 36,
    maxHp: 620,
    attack: 36,
    defense: 17,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 270,
    coinsMin: 24,
    coinsMax: 42,
    visual: {
      kind: "armored",
      scale: 1.08,
      palette: {
        shadow: 0x0a0c0e,
        body: 0x6c7480,
        dark: 0x3e444d,
        head: 0x878f9c,
        accent: 0xffd27a,
        leg: 0x4a505a,
        cloth: 0x424a57
      }
    }
  },
  "hac-ky-si": {
    id: "hac-ky-si",
    name: "Hắc Kỵ Sĩ",
    level: 42,
    maxHp: 820,
    attack: 44,
    defense: 22,
    critRate: 0.08,
    critDamage: 1.7,
    exp: 360,
    coinsMin: 30,
    coinsMax: 52,
    visual: {
      kind: "armored",
      scale: 1.1,
      palette: {
        shadow: 0x07080a,
        body: 0x2d3138,
        dark: 0x171a1f,
        head: 0x3a3f48,
        accent: 0xd94f5c,
        leg: 0x20242a,
        cloth: 0x252a31
      }
    }
  },
  "quan-trung-hiep": {
    id: "quan-trung-hiep",
    name: "Quan Trung Hiệp",
    level: 45,
    maxHp: 900,
    attack: 48,
    defense: 26,
    critRate: 0.1,
    critDamage: 1.8,
    exp: 420,
    coinsMin: 34,
    coinsMax: 58,
    visual: {
      kind: "humanoid",
      scale: 1.03,
      palette: {
        shadow: 0x090a0d,
        body: 0x46566e,
        dark: 0x28323f,
        head: 0xd0aa86,
        accent: 0x8fc7ff,
        leg: 0x303c4c,
        cloth: 0x5a6c88
      }
    }
  },
  "dong-trang-thiet-ky": {
    id: "dong-trang-thiet-ky",
    name: "Đồng Trang Thiết Kỵ",
    level: 52,
    maxHp: 1100,
    attack: 56,
    defense: 30,
    critRate: 0.14,
    critDamage: 2.0,
    exp: 520,
    coinsMin: 40,
    coinsMax: 70,
    visual: {
      kind: "armored",
      scale: 1.12,
      palette: {
        shadow: 0x0c0a07,
        body: 0xa07a3e,
        dark: 0x66502a,
        head: 0xb98e4c,
        accent: 0xffd88a,
        leg: 0x735a30,
        cloth: 0x4d3c1f
      }
    }
  },
  "quan-trung-ba-vuong": {
    id: "quan-trung-ba-vuong",
    name: "Quan Trung Bá Vương",
    level: 58,
    maxHp: 1320,
    attack: 66,
    defense: 34,
    critRate: 0.18,
    critDamage: 2.1,
    exp: 650,
    coinsMin: 48,
    coinsMax: 84,
    visual: {
      kind: "humanoid",
      scale: 1.1,
      palette: {
        shadow: 0x090705,
        body: 0x4a4234,
        dark: 0x28231a,
        head: 0xd2a97c,
        accent: 0xffd76b,
        leg: 0x342e22,
        cloth: 0x6b3a2a
      }
    }
  },
};

/** Every monster id, in catalog order (market wolf first). */
export const MONSTER_IDS = Object.keys(MONSTERS);

/**
 * Weapons a monster can drop. Skills are learned from the F5 tree, so a kill
 * never hands out a book: the only item loot left is this rare weapon drop.
 * @type {Readonly<Record<string, { chance: number, itemId: string }>>}
 */
export const MONSTER_WEAPON_DROPS = Object.freeze({
  "hac-y-sat-thu": Object.freeze({ chance: 0.06, itemId: "bao-tay-lang-khach" }),
  "ma-giao-de-tu": Object.freeze({ chance: 0.08, itemId: "dao-lang-khach" })
});

/**
 * Weapon-drop rule for a monster, or null when it drops no weapon.
 * @param {string} [monsterId]
 * @returns {{ chance: number, itemId: string }|null}
 */
export function weaponDropFor(monsterId) {
  return MONSTER_WEAPON_DROPS[monsterId] || null;
}

/**
 * Resolve a monster definition, falling back to the legacy wolf so a stale
 * client or an old save can never crash the roster.
 * @param {string} [id]
 * @returns {MonsterDefinition}
 */
export function getMonster(id) {
  return MONSTERS[id] || MONSTERS["soi-xam"];
}

/**
 * All monsters whose level falls inside an inclusive range.
 * @param {number} minLevel
 * @param {number} maxLevel
 * @returns {MonsterDefinition[]}
 */
export function monstersBetween(minLevel, maxLevel) {
  return MONSTER_IDS.map((id) => MONSTERS[id]).filter(
    (monster) => monster.level >= minLevel && monster.level <= maxLevel
  );
}

/**
 * Roll the payout for one defeated monster. Deterministic for a fixed rng, so the
 * server and any replay derive the same coins from the same roll.
 * @param {MonsterDefinition|string} monster
 * @param {Function|number} [rng=Math.random]
 * @returns {{ exp: number, coins: number }}
 */
export function rewardForMonster(monster, rng = Math.random) {
  const def = typeof monster === "string" ? getMonster(monster) : monster || getMonster();
  const drawn = typeof rng === "function" ? rng() : rng;
  const roll =
    typeof drawn === "number" && Number.isFinite(drawn)
      ? Math.min(Math.max(drawn, 0), 1)
      : 0;

  const span = def.coinsMax - def.coinsMin + 1;
  const coins = Math.min(def.coinsMin + Math.floor(roll * span), def.coinsMax);

  return { exp: def.exp, coins };
}
