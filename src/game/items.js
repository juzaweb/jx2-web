/**
 * Shared item catalog for the character's inventory ("Hành Trang") and quick slots.
 * Static demo data — quantities are illustrative and not yet persisted to storage.
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
