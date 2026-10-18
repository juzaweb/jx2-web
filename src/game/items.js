/**
 * Shared item catalog for the character's inventory ("Hành Trang") and quick slots.
 * The catalog itself is static; stack quantities are persisted via src/game/storage.js.
 */

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
    desc: "Phù chú không gian, đưa hành giả trở về cố hương Trường An."
  }
];

/** Sức nặng hành trang hiển thị ở thanh dưới cùng. */
export const INVENTORY_CAPACITY = { used: 992, total: 4176 };

/** Tiền tệ & tài nguyên hiển thị ở footer (bạc lấy động từ stats). */
export const INVENTORY_TREASURY = {
  kimNguyenBao: 13,
  tienNgoc: 67,
  kimPhieu: 2057
};

/** Quick-slot consumables reused inside the inventory grid, destructured by their fixed order. */
const [kimSangDuoc, daiHoanDan, nuNhiHong, hoiThanhPhu] = QUICK_ITEMS;

/**
 * 5 columns x 6 rows grid. An entry of `null` renders an empty slot.
 * @type {Array<null | {id:string, name:string, icon:string, qty?:number, desc:string, useSlot?:number}>}
 */
export const INVENTORY_ITEMS = [
  { id: "ho-lo-tuu", name: "Hồ Lô Tửu", icon: "icon-gourd", desc: "Bầu rượu của hành khách, hương thơm nồng đượm." },
  { id: "lenh-bai", name: "Lệnh Bài Môn Phái", icon: "icon-token", desc: "Tín vật Võ Đang, chứng minh thân phận đệ tử." },
  { id: "thiet-trao", name: "Thiết Trảo", icon: "icon-claw", desc: "Binh khí lợi hại, sử dụng trong cận chiến." },
  { id: "hac-ung-kiem", name: "Hắc Ưng Kiếm", icon: "icon-jian", desc: "Thanh kiếm huyền thiết, sắc bén vô song." },
  kimSangDuoc,

  { id: "bi-kip-vo-cong", name: "Bí Kíp Võ Công", icon: "icon-book", qty: 1, desc: "Sách cổ ghi chép tâm pháp luyện công." },
  { id: "thien-ha-mat-tich", name: "Thiên Hà Mật Tịch", icon: "icon-book-red", desc: "Mật tịch thượng thừa của phái Thiên Hà." },
  { id: "cam-y-bao", name: "Cẩm Y Bào", icon: "icon-armor", desc: "Áo gấm thêu chỉ vàng, gia tăng phòng ngự." },
  { id: "thanh-long-dao", name: "Thanh Long Đao", icon: "icon-blade", desc: "Đại đao khắc hình thanh long, uy lực trầm hùng." },
  { id: "ngoc-bo-dao", name: "Ngọc Bồi Dương Chi", icon: "icon-ring", desc: "Ngọc bội gia truyền, tỏa linh khí nhè nhẹ." },

  daiHoanDan,
  nuNhiHong,
  hoiThanhPhu,
  { id: "huyen-kim-thach", name: "Huyễn Kim Thạch", icon: "icon-gem", qty: 398, desc: "Khoáng thạch quý dùng để rèn đúc trang bị." },
  { id: "tui-bac", name: "Túi Bạc", icon: "icon-pouch", qty: 21, desc: "Túi đựng bạc, nhặt được từ dã thú." },

  { id: "duoc-vuong-lo", name: "Dược Vương Lộ", icon: "icon-vase", qty: 113, desc: "Linh dịch chữa lành, chiết từ ngàn loại thảo dược." },
  { id: "than-bi-hop", name: "Thần Bí Hộp", icon: "icon-chest", qty: 99, desc: "Bảo hộp chưa mở, bên trong ẩn chứa kỳ vật." },
  { id: "yeu-dan", name: "Yêu Đan", icon: "icon-pills", qty: 473, desc: "Nội đan của yêu thú, tinh túy linh khí." },
  { id: "huyet-chien-giap", name: "Huyết Chiến Giáp", icon: "icon-armor", desc: "Chiến giáp nhuốm huyết, phòng ngự cực cao." },
  { id: "bach-nien-linh-chi", name: "Bách Niên Linh Chi", icon: "icon-herb", qty: 574, desc: "Linh chi trăm năm, đại bổ nguyên khí." },

  { id: "tu-kim-ho-lo", name: "Tử Kim Hồ Lô", icon: "icon-gourd", qty: 45, desc: "Hồ lô tử kim, tích linh đan hồi phục." },
  { id: "ngoc-tinh-binh", name: "Ngọc Tịnh Bình", icon: "icon-vase", qty: 485, desc: "Bình ngọc tịnh khí, thanh lọc tâm thần." },
  { id: "phuong-vu-bao", name: "Phượng Vũ Bào", icon: "icon-crown", desc: "Bào phục thêu lông phượng, tôn quý phi thường." },
  { id: "phach-dao", name: "Phách Đao", icon: "icon-blade", desc: "Đao nhẹ, tốc độ xuất thủ cực nhanh." },
  { id: "tu-tinh-nhan", name: "Tứ Tinh Nhẫn", icon: "icon-ring", desc: "Nhẫn khảm bốn viên linh thạch." },

  { id: "linh-duong", name: "Thịt Rừng", icon: "icon-meat", qty: 3, desc: "Thịt thú tươi, dùng để nấu nướng hồi phục." },
  { id: "tang-kinh-do", name: "Tàng Kinh Đồ", icon: "icon-scroll", qty: 1, desc: "Bản đồ địa đạo bí mật dẫn tới tàng kinh các." },
  { id: "ngoc-nhan", name: "Ngọc Nhẫn", icon: "icon-ring", desc: "Nhẫn ngọc đơn sơ nhưng ẩn chứa linh khí." },
  { id: "hoang-kim-huyen-thiet", name: "Huyền Thiết Kim", icon: "icon-gem", qty: 67, desc: "Kim loại huyền thiết, chế tạo binh khí thượng hạng." },
  { id: "huyet-bo-dao", name: "Huyết Bồ Đào", icon: "icon-pills", qty: 13, desc: "Linh dược huyết sắc, hồi phục thương thế." }
];

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
 * Resolve the catalog into render-ready arrays with persisted quantities applied.
 * Inventory items with no saved or default quantity are returned unchanged.
 * @param {Record<string, number>} [quantities]
 * @returns {{ quickItems: Array<object>, inventoryItems: Array<object|null> }}
 */
export function applyQuantities(quantities = defaultQuantities()) {
  const withQty = (item) => {
    const saved = quantities[item.id];
    if (typeof saved === "number" && Number.isFinite(saved)) {
      return { ...item, qty: saved };
    }
    return item;
  };
  return {
    quickItems: QUICK_ITEMS.map(withQty),
    inventoryItems: INVENTORY_ITEMS.map((item) => (item ? withQty(item) : null))
  };
}
