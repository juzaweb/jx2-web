/**
 * Shared item catalog for the character's inventory ("Hành Trang") and quick slots.
 * The catalog itself is static; stack quantities are persisted via src/game/storage.js.
 */

import { SKILLS } from "./skills.js";

/** Keys that would poison a plain-object quantity map if copied verbatim. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Quick-slot consumables bound to hotbar keys 1-4.
 * `useSlot` maps to the slot handled by JiangHuScene.useItem().
 *
 * The catalog only carries display metadata: stack quantities live exclusively in
 * the player's bag (see src/game/storage.js), so nothing here may seed an
 * inventory on its own.
 * @type {Array<{id:string, useSlot:number, name:string, icon:string, desc:string}>}
 */
export const QUICK_ITEMS = [
  {
    id: "kim-sang-duoc",
    useSlot: 1,
    name: "Kim Sáng Dược",
    icon: "icon-hp-pot",
    desc: "Linh dược chế từ kim ngân. Hồi phục +35 Sinh lực khi uống."
  },
  {
    id: "dai-hoan-dan",
    useSlot: 2,
    name: "Đại Hoàn Đan",
    icon: "icon-mp-pot",
    desc: "Linh đan tụ khí. Hồi phục +25 Nội lực khi uống."
  },
  {
    id: "nu-nhi-hong",
    useSlot: 3,
    name: "Nữ Nhi Hồng",
    icon: "icon-wine-pot",
    desc: "Mỹ tửu trần ba năm. Hồi phục +50 Sinh lực và +30 Nội lực."
  },
  {
    id: "hoi-thanh-phu",
    useSlot: 4,
    name: "Hồi Thành Phù",
    icon: "icon-scroll",
    desc: "Phù chú không gian, đưa hành giả trở về cố hương Biện Kinh."
  }
];

/**
 * Supreme GM command token for admin control and testing.
 */
export const lenhBaiGm = {
  id: "lenh-bai-gm",
  useSlot: 5,
  name: "Lệnh Bài GM",
  icon: "icon-gm-token",
  desc: "Lệnh bài tối cao của Tổng Quản GM. Dùng để mở giao diện quản trị nhân vật, nhận cấp, hồi phục máu mana và dịch chuyển."
};

/**
 * Starter wuxia robe equipment.
 */
export const aoLangKhach = {
  id: "ao-lang-khach",
  name: "Lam Y Lãng Khách",
  icon: "icon-armor-lang-khach",
  slot: "armor",
  bonuses: { defense: 8, maxHp: 30 },
  desc: "Y phục vạt chéo giang hồ sơ nhập. Dệt từ vải thô nhẹ nhàng, tiện lợi cho việc bôn tẩu hành hiệp."
};

/**
 * Starter wuxia bamboo hat equipment (plain hat for male, veiled hat for female).
 */
export const nonLangKhach = {
  id: "non-lang-khach",
  name: "Nón Trúc Lãng Khách",
  icon: "icon-hat-non-truc",
  slot: "helmet",
  bonuses: { defense: 5, maxMp: 20 },
  desc: "Nón đan từ nan tre trúc vùng biên ải. Che nắng che mưa, giúp hiệp khách giữ vững tâm trí khi phong ba bão táp."
};

/**
 * Starter wuxia trousers & boots equipment (shared between male and female).
 */
export const quanLangKhach = {
  id: "quan-lang-khach",
  name: "Quần Lãng Khách",
  icon: "icon-pants-lang-khach",
  slot: "pants",
  bonuses: { defense: 4, movementSpeed: 10 },
  desc: "Quần thô gọn gàng kết hợp xà cạp bọc chân, tiện lợi cho việc khinh công và phiêu bạt giang hồ."
};

/** Number of slots the inventory grid renders (5 columns x 6 rows). */
export const INVENTORY_GRID_SIZE = 30;

/**
 * Weapons the hero can wear. The worn weapon's `weaponType` decides which skill
 * kit (and therefore which books) the character may use.
 */
export const kiemLangKhach = {
  id: "kiem-lang-khach",
  name: "Kiếm Lãng Khách",
  icon: "icon-jian",
  slot: "weapon",
  weaponType: "kiem",
  bonuses: { attack: 6 },
  desc: "Thanh kiếm thép giang hồ sơ nhập. Tay kiếm dùng được các chiêu kiếm pháp đã học."
};

export const baoTayLangKhach = {
  id: "bao-tay-lang-khach",
  name: "Bao Tay Lãng Khách",
  icon: "icon-claw",
  slot: "weapon",
  weaponType: "bao-tay",
  bonuses: { attack: 5, attackSpeed: 0.05 },
  desc: "Bao tay da bọc thép, cận chiến linh hoạt. Chỉ dùng được chiêu bao tay đã học."
};

export const daoLangKhach = {
  id: "dao-lang-khach",
  name: "Đao Lãng Khách",
  icon: "icon-dao",
  slot: "weapon",
  weaponType: "dao",
  bonuses: { attack: 7 },
  desc: "Đao bản rộng nặng tay, sát thương cao. Chỉ dùng được chiêu đao pháp đã học."
};

/**
 * Book names used for the dropped study items. Books are learned, not cast: the
 * server consumes the book and records the skill id on the character.
 * @type {Readonly<Record<string, string>>}
 */
const BOOK_NAMES = Object.freeze({
  thieu_lam_tam_phap: "Thiếu Lâm Tâm Pháp",
  dai_tu_di_chuong: "Đại Tu Di Chưởng",
  la_han_quyen: "La Hán Quyền",
  la_han_tran: "La Hán Trận",
  kim_cang_bat_hoai: "Kim Cang Bất Hoại",
  nhu_lai_than_chuong: "Như Lai Thần Chưởng",
  thieu_duong_kiem_phap: "Thiếu Dương Kiếm Pháp",
  thai_cuc_quyen: "Thái Cực Quyền",
  tam_thanh_kiem_phap: "Tam Thanh Kiếm Pháp",
  toat_hong_quan_khuyet: "Toát Hồng Quân Khuyết",
  nga_my_kiem_phap: "Nga My Kiếm Pháp",
  mong_diep_thoi_tam: "Mộng Điệp Thôi Tâm",
  tu_hang_pho_do: "Từ Hàng Phổ Độ",
  luu_thuy_khanh_van: "Lưu Thủy Khánh Vân",
  ngu_doc_tam_phap: "Ngũ Độc Tâm Pháp",
  truy_tam_doc: "Truy Tâm Độc",
  van_doc_chieu_hong: "Vạn Độc Triệu Cổ",
  u_hong_phiet_anh: "U Hồn Phiệt Ảnh"
});

/**
 * One book per learnable skill. The starter skill (Kiếm Khí) is not sold or
 * dropped: every hero already knows it.
 * @type {ReadonlyArray<{id:string, name:string, icon:string, skillId:string, weapon:string, desc:string}>}
 */
export const BOOK_ITEMS = Object.freeze(
  SKILLS.filter((skill) => !skill.starter).map((skill) => {
    const name = BOOK_NAMES[skill.id] || skill.id;
    return Object.freeze({
      id: `book_${skill.id}`,
      name: `Sách: ${name}`,
      icon: "icon-book",
      skillId: skill.id,
      weapon: skill.weapon,
      desc: `Bí kíp ghi chép ${name}. Dùng để học chiêu thức này.`
    });
  })
);

/**
 * Catalog id of the book that teaches a skill.
 * @param {string} skillId
 * @returns {string}
 */
export function bookItemId(skillId) {
  return `book_${skillId}`;
}

/**
 * Skill id a book teaches, or null when the id is not a skill book.
 * @param {string} itemId
 * @returns {string|null}
 */
export function skillIdForBook(itemId) {
  if (typeof itemId !== "string") return null;
  const book = BOOK_ITEMS.find((item) => item.id === itemId);
  return book ? book.skillId : null;
}

/**
 * Whether an item id is a learnable skill book.
 * @param {string} itemId
 * @returns {boolean}
 */
export function isSkillBook(itemId) {
  return skillIdForBook(itemId) !== null;
}

/**
 * Split a silver balance into the three display denominations.
 * The server keeps a single silver balance, so copper is always zero until a
 * copper ledger exists.
 * @param {number} silver
 * @returns {{ gold: number, silver: number, copper: number }}
 */
export function splitSilver(silver) {
  const amount =
    typeof silver === "number" && Number.isFinite(silver)
      ? Math.max(0, Math.floor(silver))
      : 0;
  return {
    gold: Math.floor(amount / 100),
    silver: amount % 100,
    copper: 0
  };
}

/** Quick-slot consumables reused inside the inventory grid, destructured by their fixed order. */
const [kimSangDuoc, daiHoanDan, nuNhiHong, hoiThanhPhu] = QUICK_ITEMS;

/**
 * Standalone equipment items (not included in the starting inventory grid).
 */
export const EQUIPMENT_ITEMS = [
  aoLangKhach,
  nonLangKhach,
  quanLangKhach,
  kiemLangKhach,
  baoTayLangKhach,
  daoLangKhach
];

/**
 * The bag grid contents. Every entry is an item the player can actually obtain and
 * use: the hotbar consumables and tools. The rendered grid itself is a fixed 5x6 block of slots
 * (see {@link INVENTORY_GRID_SIZE}); an entry of `null` renders an empty slot.
 * @type {Array<null | {id:string, name:string, icon:string, slot?:string, bonuses?:Record<string,number>, desc:string, useSlot?:number}>}
 */
export const INVENTORY_ITEMS = [
  kimSangDuoc,
  daiHoanDan,
  nuNhiHong,
  hoiThanhPhu,
  lenhBaiGm
];

/**
 * Items the player can bind to a mobile action button.
 *
 * Equipment carries a `slot` (it is worn, not used) and the GM token opens a
 * panel instead of being drunk, so neither belongs on a consumable button.
 * @type {Array<{id:string, name:string, icon:string, desc:string, useSlot?:number}>}
 */
export const CONSUMABLE_ITEMS = INVENTORY_ITEMS.filter(
  (item) => item && item.useSlot && !item.slot && item.id !== "lenh-bai-gm"
);

/**
 * Look up a catalog item by id across quick-slots, grid inventory, and equipment.
 * @param {string} id
 * @returns {object|null}
 */
export function getItemById(id) {
  if (typeof id !== "string" || id.length === 0) return null;
  return (
    QUICK_ITEMS.find((item) => item.id === id) ||
    INVENTORY_ITEMS.find((item) => item && item.id === id) ||
    EQUIPMENT_ITEMS.find((item) => item && item.id === id) ||
    BOOK_ITEMS.find((item) => item.id === id) ||
    null
  );
}

/**
 * Server-owned effects of the usable consumables. The client renders the number
 * the server broadcasts; it never applies these amounts itself.
 * @type {Readonly<Record<string, { hp?: number, mp?: number, teleport?: "spawn" }>>}
 */
export const CONSUMABLE_EFFECTS = Object.freeze({
  "kim-sang-duoc": Object.freeze({ hp: 35 }),
  "dai-hoan-dan": Object.freeze({ mp: 25 }),
  "nu-nhi-hong": Object.freeze({ hp: 50, mp: 30 }),
  "hoi-thanh-phu": Object.freeze({ teleport: "spawn" })
});

/**
 * Effect of one consumable, or null when the item is not usable.
 * @param {string} id
 * @returns {{ hp?: number, mp?: number, teleport?: "spawn" }|null}
 */
export function getConsumableEffect(id) {
  if (typeof id !== "string" || id.length === 0) return null;
  return CONSUMABLE_EFFECTS[id] || null;
}

/**
 * The kit every newly created regular character receives: health potions, mana potions
 * and return-city talismans. Only the server grants it (see
 * PlayerDatabase.grantStarterItems), so the client never seeds a bag on its own.
 * @type {Readonly<Record<string, number>>}
 */
export const STARTER_ITEMS = Object.freeze({
  "kim-sang-duoc": 50,
  "dai-hoan-dan": 50,
  "hoi-thanh-phu": 50,
  // Every hero starts with a sword so the starter Kiếm Khí skill is usable.
  "kiem-lang-khach": 1
});

/**
 * The kit granted to GM / Admin accounts, containing the GM Command Token.
 * @type {Readonly<Record<string, number>>}
 */
export const GM_STARTER_ITEMS = Object.freeze({
  ...STARTER_ITEMS,
  "lenh-bai-gm": 1
});

/**
 * The bag a character owns before playing: empty. The starter kit above is handed
 * out by the server on character creation, and everything else is bought or won
 * from play, so the catalog can never hand out free stacks.
 * @returns {Record<string, number>}
 */
export function defaultQuantities() {
  return {};
}

/**
 * In-memory source of truth for stack quantities, shared by the React HUD
 * (rendering) and the Phaser scene (persisting via StorageManager.save()).
 * `null` until the first `setQuantities()` call, in which case defaults are used.
 * @type {Record<string, number> | null}
 */
let currentQuantities = null;

/**
 * Replace the in-memory quantities with the given map, keeping only valid
 * non-negative stacks. Unknown / missing ids are simply not owned.
 * @param {Record<string, number>} [quantities]
 * @returns {Record<string, number>} The sanitized map
 */
export function setQuantities(quantities = {}) {
  currentQuantities = sanitizeQuantities(quantities) || {};
  return { ...currentQuantities };
}

/**
 * Replace the in-memory quantities with exactly the given map, without merging
 * anything else. Used when the server bag is authoritative, so a consumed item is
 * not silently refilled from the catalog.
 * @param {Record<string, number>} [quantities]
 * @returns {Record<string, number>} The sanitized map
 */
export function replaceQuantities(quantities = {}) {
  currentQuantities = sanitizeQuantities(quantities) || {};
  return { ...currentQuantities };
}

/**
 * Current stack quantities. Falls back to an empty bag before any load.
 * @returns {Record<string, number>}
 */
export function getQuantities() {
  return currentQuantities || defaultQuantities();
}

/**
 * Add `amount` to the shared in-memory quantity for `id`, starting from an empty
 * bag when nothing has been loaded yet. Missing ids start at 0.
 * Invalid input (non-string/empty id, or an amount that is not a finite number > 0)
 * is ignored without throwing and leaves the store untouched.
 * @param {string} id - Catalog item id
 * @param {number} [amount=1] - Positive quantity to add
 * @returns {number} The resulting non-negative integer quantity for `id`
 */
export function addQuantity(id, amount = 1) {
  const hasValidId = typeof id === "string" && id.length > 0;
  if (!hasValidId) {
    return 0;
  }

  if (currentQuantities === null) {
    setQuantities();
  }

  const stored = currentQuantities[id];
  const base =
    typeof stored === "number" && Number.isFinite(stored)
      ? Math.max(0, Math.floor(stored))
      : 0;

  const hasValidAmount =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  if (!hasValidAmount) {
    return base;
  }

  currentQuantities[id] = base + Math.floor(amount);
  return currentQuantities[id];
}

/**
 * Coerce an arbitrary value into a safe id -> non-negative integer map, or null
 * when it is not a plain object. Shared by localStorage persistence and the server
 * inventory sync, so both reject prototype keys and negative / non-finite stacks
 * identically.
 * @param {*} value
 * @returns {Record<string, number>|null}
 */
export function sanitizeQuantities(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const out = {};
  for (const [id, qty] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(id)) continue;
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) continue;
    out[id] = Math.floor(qty);
  }
  return out;
}

/**
 * Current stack quantity for `id` as a non-negative integer, or 0 when the id is
 * invalid or carries no quantity. Never mutates the store.
 * @param {string} id - Catalog item id
 * @returns {number}
 */
export function getQuantity(id) {
  if (typeof id !== "string" || id.length === 0) {
    return 0;
  }
  const store = currentQuantities || defaultQuantities();
  const stored = store[id];
  return typeof stored === "number" && Number.isFinite(stored)
    ? Math.max(0, Math.floor(stored))
    : 0;
}

/**
 * How many of an item the bag holds. Falls back to the shared quantity store
 * when the bag snapshot has no entry for it, so a freshly granted item still
 * reports its stack.
 * @param {string} itemId
 * @param {Array<{id:string, qty?:number}>} [bag]
 * @returns {number}
 */
export function bagQuantity(itemId, bag = []) {
  if (typeof itemId !== "string" || itemId.length === 0) return 0;
  const entries = (bag || []).filter((entry) => entry && entry.id === itemId);
  if (entries.length === 0) return getQuantity(itemId);
  return entries.reduce(
    (sum, entry) => sum + (typeof entry.qty === "number" ? entry.qty : 1),
    0
  );
}

/**
 * Attempt to remove `amount` of `id` from the shared in-memory store. The removal
 * is all-or-nothing: an invalid id/amount, or a stack smaller than `amount`, leaves
 * the store untouched (so an item can never be consumed into a negative quantity).
 * @param {string} id - Catalog item id
 * @param {number} [amount=1] - Positive quantity to remove
 * @returns {{ ok: boolean, quantity: number }} Whether it was removed and the
 *   resulting quantity (the current quantity when the removal was rejected)
 */
export function consumeQuantity(id, amount = 1) {
  if (currentQuantities === null) {
    setQuantities();
  }

  const current = getQuantity(id);
  const hasValidAmount =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  if (!hasValidAmount || current < amount) {
    return { ok: false, quantity: current };
  }

  const next = current - Math.floor(amount);
  currentQuantities[id] = next;
  return { ok: true, quantity: next };
}

/**
 * Kill-reward tuning shared with the server, which rolls the reward from its own
 * authoritative enemy health (see server/src/rewards.js). Kills pay EXP and
 * bạc only: no loot table exists, so nothing is ever dropped on the ground.
 */
export const KILL_REWARD = {
  exp: 35,
  coinsMin: 3,
  coinsMax: 9
};

/**
 * Roll the payout for one defeated enemy. Pure and deterministic for a fixed rng,
 * so the server and a client derive the same reward from the same roll.
 * @param {Function|number} [rng=Math.random] - RNG returning [0, 1), or a static value
 * @returns {{ exp: number, coins: number }}
 */
export function rollKillReward(rng = Math.random) {
  const drawn = typeof rng === "function" ? rng() : rng;
  const roll =
    typeof drawn === "number" && Number.isFinite(drawn)
      ? Math.min(Math.max(drawn, 0), 1)
      : 0;

  const span = KILL_REWARD.coinsMax - KILL_REWARD.coinsMin + 1;
  const coins = Math.min(
    KILL_REWARD.coinsMin + Math.floor(roll * span),
    KILL_REWARD.coinsMax
  );

  return { exp: KILL_REWARD.exp, coins };
}

/**
 * Resolve a stack quantity from a normalised map, treating missing ids as empty.
 * @param {Record<string, number>} quantities
 * @param {string} id
 * @returns {number}
 */
function quantityOf(quantities, id) {
  const value = quantities[id];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/**
 * Resolve the catalog into render-ready arrays with persisted quantities applied.
 * Everything is driven by what the player actually owns: only catalog stacks with
 * a positive quantity are returned, in catalog order, for both the hotbar and the
 * grid. Unowned entries are omitted entirely so an empty bag renders no items. Ids
 * the server reports that are missing from the static catalog are ignored, so no
 * placeholder item is ever rendered. Empty cells pad the grid to
 * {@link INVENTORY_GRID_SIZE}.
 * @param {Record<string, number>} [quantities]
 * @returns {{ quickItems: Array<object>, inventoryItems: Array<object|null>,
 *   capacity: { used: number, total: number } }}
 */
export function applyQuantities(quantities = defaultQuantities()) {
  const owned = sanitizeQuantities(quantities) || {};

  const inventoryItems = [];
  [...INVENTORY_ITEMS, ...EQUIPMENT_ITEMS, ...BOOK_ITEMS].filter(Boolean).forEach((item) => {
    const qty = quantityOf(owned, item.id);
    if (qty > 0) inventoryItems.push({ ...item, qty });
  });
  const used = inventoryItems.length;
  while (inventoryItems.length < INVENTORY_GRID_SIZE) {
    inventoryItems.push(null);
  }

  return {
    quickItems: QUICK_ITEMS.map((item) => ({
      ...item,
      qty: quantityOf(owned, item.id)
    })).filter((item) => item.qty > 0),
    inventoryItems,
    capacity: { used, total: Math.max(INVENTORY_GRID_SIZE, used) }
  };
}
