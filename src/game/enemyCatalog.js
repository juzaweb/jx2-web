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
};

/** Every monster id, in catalog order (market wolf first). */
export const MONSTER_IDS = Object.keys(MONSTERS);

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
