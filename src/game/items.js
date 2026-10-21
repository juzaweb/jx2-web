/**
 * Shared item catalog for the character's inventory ("Hành Trang") and quick slots.
 * The catalog itself is static; stack quantities are persisted via src/game/storage.js.
 */

/** Keys that would poison a plain-object quantity map if copied verbatim. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Quick-slot consumables bound to hotbar keys 1-4.
 * `useSlot` maps to the slot handled by JiangHuScene.useItem().
 * @type {Array<{id:string, useSlot:number, name:string, icon:string, qty:number, desc:string}>}
 */
export const QUICK_ITEMS = [
  {
    id: "kim-sang-duoc",
    useSlot: 1,
    name: "Kim Sáng Dược",
    icon: "icon-hp-pot",
    qty: 99,
    desc: "Linh dược chế từ kim ngân. Hồi phục +35 Sinh lực khi uống."
  },
  {
    id: "dai-hoan-dan",
    useSlot: 2,
    name: "Đại Hoàn Đan",
    icon: "icon-mp-pot",
    qty: 86,
    desc: "Linh đan tụ khí. Hồi phục +25 Nội lực khi uống."
  },
  {
    id: "nu-nhi-hong",
    useSlot: 3,
    name: "Nữ Nhi Hồng",
    icon: "icon-wine-pot",
    qty: 50,
    desc: "Mỹ tửu trần ba năm. Hồi phục +50 Sinh lực và +30 Nội lực."
  },
  {
    id: "hoi-thanh-phu",
    useSlot: 4,
    name: "Hồi Thành Phù",
    icon: "icon-scroll",
    qty: 10,
    desc: "Phù chú không gian, đưa hành giả trở về cố hương Biện Kinh."
  }
];

/** Number of slots the inventory grid renders (5 columns x 8 rows). */
export const INVENTORY_GRID_SIZE = 40;

/** Fallback icon for server-owned ids that are missing from the static catalog. */
const UNKNOWN_ITEM_ICON = "icon-pouch";

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
 * 5-column grid (scrolls when it overflows). An entry of `null` renders an empty
 * slot. Items tagged with `slot` are equipment and can be worn (see equipment.js).
 * @type {Array<null | {id:string, name:string, icon:string, qty?:number, slot?:string, bonuses?:Record<string,number>, desc:string, useSlot?:number}>}
 */
export const INVENTORY_ITEMS = [
  { id: "ho-lo-tuu", name: "Hồ Lô Tửu", icon: "icon-gourd", qty: 1, desc: "Bầu rượu của hành khách, hương thơm nồng đượm." },
  { id: "lenh-bai", name: "Lệnh Bài Môn Phái", icon: "icon-token", qty: 1, desc: "Tín vật Võ Đang, chứng minh thân phận đệ tử." },
  { id: "thiet-trao", name: "Thiết Trảo", icon: "icon-claw", qty: 1, slot: "weapon", bonuses: { attack: 6 }, desc: "Binh khí lợi hại, sử dụng trong cận chiến." },
  { id: "hac-ung-kiem", name: "Hắc Ưng Kiếm", icon: "icon-jian", qty: 1, slot: "weapon", bonuses: { attack: 10, critRate: 0.02 }, desc: "Thanh kiếm huyền thiết, sắc bén vô song." },
  kimSangDuoc,

  { id: "bi-kip-vo-cong", name: "Bí Kíp Võ Công", icon: "icon-book", qty: 1, desc: "Sách cổ ghi chép tâm pháp luyện công." },
  { id: "thien-ha-mat-tich", name: "Thiên Hà Mật Tịch", icon: "icon-book-red", qty: 1, desc: "Mật tịch thượng thừa của phái Thiên Hà." },
  { id: "cam-y-bao", name: "Cẩm Y Bào", icon: "icon-armor", qty: 1, slot: "armor", bonuses: { defense: 8, maxHp: 40 }, desc: "Áo gấm thêu chỉ vàng, gia tăng phòng ngự." },
  { id: "thanh-long-dao", name: "Thanh Long Đao", icon: "icon-blade", qty: 1, slot: "weapon", bonuses: { attack: 14 }, desc: "Đại đao khắc hình thanh long, uy lực trầm hùng." },
  { id: "ngoc-bo-dao", name: "Ngọc Bồi Dương Chi", icon: "icon-ring", qty: 1, slot: "accessory", bonuses: { maxMp: 30 }, desc: "Ngọc bội gia truyền, tỏa linh khí nhè nhẹ." },

  daiHoanDan,
  nuNhiHong,
  hoiThanhPhu,
  { id: "huyen-kim-thach", name: "Huyễn Kim Thạch", icon: "icon-gem", qty: 398, desc: "Khoáng thạch quý dùng để rèn đúc trang bị." },
  { id: "tui-bac", name: "Túi Bạc", icon: "icon-pouch", qty: 21, desc: "Túi đựng bạc, nhặt được từ dã thú." },

  { id: "duoc-vuong-lo", name: "Dược Vương Lộ", icon: "icon-vase", qty: 113, desc: "Linh dịch chữa lành, chiết từ ngàn loại thảo dược." },
  { id: "than-bi-hop", name: "Thần Bí Hộp", icon: "icon-chest", qty: 99, desc: "Bảo hộp chưa mở, bên trong ẩn chứa kỳ vật." },
  { id: "yeu-dan", name: "Yêu Đan", icon: "icon-pills", qty: 473, desc: "Nội đan của yêu thú, tinh túy linh khí." },
  { id: "huyet-chien-giap", name: "Huyết Chiến Giáp", icon: "icon-armor", qty: 1, slot: "armor", bonuses: { defense: 14, maxHp: 80 }, desc: "Chiến giáp nhuốm huyết, phòng ngự cực cao." },
  { id: "bach-nien-linh-chi", name: "Bách Niên Linh Chi", icon: "icon-herb", qty: 574, desc: "Linh chi trăm năm, đại bổ nguyên khí." },

  { id: "tu-kim-ho-lo", name: "Tử Kim Hồ Lô", icon: "icon-gourd", qty: 45, desc: "Hồ lô tử kim, tích linh đan hồi phục." },
  { id: "ngoc-tinh-binh", name: "Ngọc Tịnh Bình", icon: "icon-vase", qty: 485, desc: "Bình ngọc tịnh khí, thanh lọc tâm thần." },
  { id: "phuong-vu-bao", name: "Phượng Vũ Bào", icon: "icon-crown", qty: 1, slot: "helmet", bonuses: { defense: 6, maxHp: 25 }, desc: "Bào phục thêu lông phượng, tôn quý phi thường." },
  { id: "phach-dao", name: "Phách Đao", icon: "icon-blade", qty: 1, slot: "weapon", bonuses: { attack: 16, critRate: 0.03 }, desc: "Đao nhẹ, tốc độ xuất thủ cực nhanh." },
  { id: "tu-tinh-nhan", name: "Tứ Tinh Nhẫn", icon: "icon-ring", qty: 1, slot: "accessory", bonuses: { attack: 4, critRate: 0.02 }, desc: "Nhẫn khảm bốn viên linh thạch." },

  { id: "linh-duong", name: "Thịt Rừng", icon: "icon-meat", qty: 3, desc: "Thịt thú tươi, dùng để nấu nướng hồi phục." },
  { id: "tang-kinh-do", name: "Tàng Kinh Đồ", icon: "icon-scroll", qty: 1, desc: "Bản đồ địa đạo bí mật dẫn tới tàng kinh các." },
  { id: "ngoc-nhan", name: "Ngọc Nhẫn", icon: "icon-ring", qty: 1, slot: "accessory", bonuses: { maxHp: 15 }, desc: "Nhẫn ngọc đơn sơ nhưng ẩn chứa linh khí." },
  { id: "hoang-kim-huyen-thiet", name: "Huyền Thiết Kim", icon: "icon-gem", qty: 67, desc: "Kim loại huyền thiết, chế tạo binh khí thượng hạng." },
  { id: "huyet-bo-dao", name: "Huyết Bồ Đào", icon: "icon-pills", qty: 13, desc: "Linh dược huyết sắc, hồi phục thương thế." },

  { id: "tu-kim-quan", name: "Tử Kim Quan", icon: "icon-crown", qty: 1, slot: "helmet", bonuses: { defense: 9, accuracy: 30 }, desc: "Kim quan cài ngọc, gia tăng phòng ngự và chính xác." }
];

/**
 * Look up a catalog item by id across both the quick-slot and grid catalogs.
 * @param {string} id
 * @returns {object|null}
 */
export function getItemById(id) {
  if (typeof id !== "string" || id.length === 0) return null;
  return (
    QUICK_ITEMS.find((item) => item.id === id) ||
    INVENTORY_ITEMS.find((item) => item && item.id === id) ||
    null
  );
}

/**
 * Build the default id -> quantity map from the static catalog.
 * Only items that actually carry a numeric quantity are included, so equipment
 * and icons without a stack count stay quantity-less.
 * @returns {Record<string, number>}
 */
export function defaultQuantities() {
  const quantities = {};
  const collect = (item) => {
    if (item && typeof item.qty === "number" && Number.isFinite(item.qty)) {
      quantities[item.id] = item.qty;
    }
  };
  QUICK_ITEMS.forEach(collect);
  INVENTORY_ITEMS.filter(Boolean).forEach(collect);
  return quantities;
}

/**
 * In-memory source of truth for stack quantities, shared by the React HUD
 * (rendering) and the Phaser scene (persisting via StorageManager.save()).
 * `null` until the first `setQuantities()` call, in which case defaults are used.
 * @type {Record<string, number> | null}
 */
let currentQuantities = null;

/**
 * Replace the in-memory quantities, merged over the catalog defaults so that
 * newly added catalog items always keep a value.
 * @param {Record<string, number>} [quantities]
 * @returns {Record<string, number>} The merged map
 */
export function setQuantities(quantities = {}) {
  const merged = { ...defaultQuantities() };
  Object.entries(quantities || {}).forEach(([id, qty]) => {
    if (typeof qty === "number" && Number.isFinite(qty) && qty >= 0) {
      merged[id] = Math.floor(qty);
    }
  });
  currentQuantities = merged;
  return merged;
}

/**
 * Replace the in-memory quantities with exactly the given map, without merging
 * catalog defaults. Used when the server bag is authoritative, so a consumed
 * starter item is not silently refilled from the catalog.
 * @param {Record<string, number>} [quantities]
 * @returns {Record<string, number>} The sanitized map
 */
export function replaceQuantities(quantities = {}) {
  currentQuantities = sanitizeQuantities(quantities) || {};
  return { ...currentQuantities };
}

/**
 * Current stack quantities. Falls back to catalog defaults before any load.
 * @returns {Record<string, number>}
 */
export function getQuantities() {
  return currentQuantities || defaultQuantities();
}

/**
 * Add `amount` to the shared in-memory quantity for `id`, seeding the store from
 * catalog defaults first when nothing has been loaded yet. Missing ids start at 0.
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
 * Weighted loot table for enemy drops. Every `id` exists in the catalog.
 * `weight` is relative (higher = more common); `qty` is the stack size granted.
 * @type {Array<{id:string, name:string, weight:number, qty:number}>}
 */
export const DROP_TABLE = [
  { id: "tui-bac", name: "Túi Bạc", weight: 50, qty: 1 },
  { id: "linh-duong", name: "Thịt Rừng", weight: 30, qty: 2 },
  { id: "yeu-dan", name: "Yêu Đan", weight: 15, qty: 1 },
  { id: "huyen-kim-thach", name: "Huyễn Kim Thạch", weight: 5, qty: 1 }
];

/**
 * Pick a loot entry from DROP_TABLE with a weighted roll. Pure and deterministic:
 * the same rng value always yields the same entry, and the final bucket is
 * clamped so floating-point drift or a roll of 1 can never return an unknown id.
 * @param {Function|number} [rng=Math.random] - RNG returning [0, 1), or a static value
 * @returns {{ id: string, qty: number }}
 */
export function rollDrop(rng = Math.random) {
  const totalWeight = DROP_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  const drawn = typeof rng === "function" ? rng() : rng;
  const roll = typeof drawn === "number" && Number.isFinite(drawn) ? drawn : 0;
  const target = Math.min(Math.max(roll, 0), 1) * totalWeight;

  let cursor = 0;
  for (let i = 0; i < DROP_TABLE.length; i++) {
    cursor += DROP_TABLE[i].weight;
    if (target < cursor) {
      return { id: DROP_TABLE[i].id, qty: DROP_TABLE[i].qty };
    }
  }

  const last = DROP_TABLE[DROP_TABLE.length - 1];
  return { id: last.id, qty: last.qty };
}

/**
 * Kill-reward tuning shared with the server, which rolls the reward from its own
 * authoritative enemy health (see server/src/rewards.js).
 */
export const KILL_REWARD = {
  exp: 35,
  coinsMin: 3,
  coinsMax: 9
};

/**
 * Roll the full reward for one defeated enemy: EXP, bạc and the loot entry.
 * Pure and deterministic for a fixed rng, so the server and a client derive the
 * same reward from the same roll.
 * @param {Function|number} [rng=Math.random] - RNG returning [0, 1), or a static value
 * @returns {{ exp: number, coins: number, drop: { id: string, qty: number } }}
 */
export function rollKillReward(rng = Math.random) {
  const next = () => {
    const drawn = typeof rng === "function" ? rng() : rng;
    return typeof drawn === "number" && Number.isFinite(drawn)
      ? Math.min(Math.max(drawn, 0), 1)
      : 0;
  };

  const span = KILL_REWARD.coinsMax - KILL_REWARD.coinsMin + 1;
  const coins = Math.min(
    KILL_REWARD.coinsMin + Math.floor(next() * span),
    KILL_REWARD.coinsMax
  );
  const drop = rollDrop(next());

  return { exp: KILL_REWARD.exp, coins, drop: { id: drop.id, qty: drop.qty } };
}

/**
 * Resolve a server-owned id that is not in the static catalog into a renderable
 * placeholder, so a bag can never hide items the server says the player owns.
 * @param {string} id
 * @returns {object}
 */
function unknownItem(id) {
  return {
    id,
    name: id,
    icon: UNKNOWN_ITEM_ICON,
    desc: ""
  };
}

/**
 * Read a stack quantity from a normalised map, treating missing ids as empty.
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
 * The grid is driven by what the player actually owns: only stacks with a
 * positive quantity are returned, in catalog order, with any extra server ids
 * appended. Empty cells pad the grid to {@link INVENTORY_GRID_SIZE}.
 * @param {Record<string, number>} [quantities]
 * @returns {{ quickItems: Array<object>, inventoryItems: Array<object|null>,
 *   capacity: { used: number, total: number } }}
 */
export function applyQuantities(quantities = defaultQuantities()) {
  const owned = sanitizeQuantities(quantities) || {};

  const inventoryItems = [];
  const seen = new Set();
  INVENTORY_ITEMS.filter(Boolean).forEach((item) => {
    seen.add(item.id);
    const qty = quantityOf(owned, item.id);
    if (qty > 0) inventoryItems.push({ ...item, qty });
  });
  Object.keys(owned).forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const qty = quantityOf(owned, id);
    if (qty > 0) inventoryItems.push({ ...unknownItem(id), qty });
  });
  const used = inventoryItems.length;
  while (inventoryItems.length < INVENTORY_GRID_SIZE) {
    inventoryItems.push(null);
  }

  return {
    quickItems: QUICK_ITEMS.map((item) => ({
      ...item,
      qty: quantityOf(owned, item.id)
    })),
    inventoryItems,
    capacity: { used, total: Math.max(INVENTORY_GRID_SIZE, used) }
  };
}
