/**
 * Shared item catalog for the character's inventory ("Hành Trang") and quick slots.
 * The catalog itself is static; stack quantities are persisted via src/game/storage.js.
 */

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

/** Number of slots the inventory grid renders (5 columns x 6 rows). */
export const INVENTORY_GRID_SIZE = 30;

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
 * The bag grid contents. Every entry is an item the player can actually obtain and
 * use: the hotbar consumables and tools. The rendered grid itself is a fixed 5x6 block of slots
 * (see {@link INVENTORY_GRID_SIZE}); an entry of `null` renders an empty slot.
 * @type {Array<null | {id:string, name:string, icon:string, slot?:string, bonuses?:Record<string,number>, desc:string, useSlot?:number}>}
 */
export const INVENTORY_ITEMS = [kimSangDuoc, daiHoanDan, nuNhiHong, hoiThanhPhu, lenhBaiGm];

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
 * The kit every newly created regular character receives: health potions, mana potions
 * and return-city talismans. Only the server grants it (see
 * PlayerDatabase.grantStarterItems), so the client never seeds a bag on its own.
 * @type {Readonly<Record<string, number>>}
 */
export const STARTER_ITEMS = Object.freeze({
  "kim-sang-duoc": 50,
  "dai-hoan-dan": 50,
  "hoi-thanh-phu": 50
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
 * Fast O(1) lookup Map for DROP_TABLE entries by item id.
 * @type {Map<string, {id:string, name:string, weight:number, qty:number}>}
 */
export const DROP_TABLE_MAP = new Map(
  DROP_TABLE.map((item) => [item.id, item])
);

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
  INVENTORY_ITEMS.filter(Boolean).forEach((item) => {
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
