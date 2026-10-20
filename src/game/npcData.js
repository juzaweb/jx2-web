import { translate } from "../i18n/translator.js";

/**
 * Static NPC catalog for Biện Kinh. `name` and `dialogue` are the Vietnamese
 * fallbacks; the `*Key` fields resolve through the active language so the world
 * can render localized labels and dialogue without duplicating the catalog.
 */
export const NPC_DATA = [
  {
    id: "duoc-diem",
    nameKey: "npc.duoc-diem.name",
    dialogueKey: "npc.duoc-diem.dialogue",
    name: "Chủ Dược Điếm",
    x: 5800,
    y: 3800,
    type: "herbalist",
    dialogue:
      'Chủ Dược Điếm: "Hoan nghênh hiệp khách ghé Dược Điếm Biện Kinh! Bổn tiệm chuyên cung cấp Kim Sáng Dược, Đại Hoàn Đan thượng hạng trị thương hồi khí."'
  },
  {
    id: "bach-tien-sinh",
    nameKey: "npc.bach-tien-sinh.name",
    dialogueKey: "npc.bach-tien-sinh.dialogue",
    name: "Bạch Tiên Sinh",
    x: 7800,
    y: 7000,
    type: "scholar",
    dialogue:
      'Bạch Tiên Sinh: "Giang hồ hiểm ác, lòng người khó lường. Thiếu hiệp hành tẩu Biện Kinh nhớ giữ gìn bản tâm, chăm chỉ tu luyện võ công!"'
  },
  {
    id: "thuong-nhan-bao-ruong",
    nameKey: "npc.thuong-nhan-bao-ruong.name",
    dialogueKey: "npc.thuong-nhan-bao-ruong.dialogue",
    name: "Thương Nhân Bảo Rương",
    x: 9900,
    y: 8000,
    type: "merchant",
    dialogue:
      'Thương Nhân Bảo Rương: "Khắp nơi trong thiên hạ đều có bảo rương ẩn giấu kỳ trân dị bảo. Thiếu hiệp nếu có chìa khóa hoàng kim, hãy mang đến đây đổi lấy tuyệt thế thần binh!"'
  },
  {
    id: "dai-su-hoat-dong",
    nameKey: "npc.dai-su-hoat-dong.name",
    dialogueKey: "npc.dai-su-hoat-dong.dialogue",
    name: "Đại Sứ Hoạt Động",
    x: 10900,
    y: 6900,
    type: "ambassador",
    dialogue:
      'Đại Sứ Hoạt Động: "Hoan nghênh chư vị anh hùng đến với Biện Kinh! Tham gia các hoạt động giang hồ mỗi ngày để nhận vinh dự và phần thưởng quý giá."'
  },
  {
    id: "chan-tu-don",
    nameKey: "npc.chan-tu-don.name",
    dialogueKey: "npc.chan-tu-don.dialogue",
    name: "Chân Tử Đơn",
    x: 12200,
    y: 5200,
    type: "martial",
    dialogue:
      'Chân Tử Đơn: "Võ học vô biên! Luyện tập quyền cước hàng ngày chính là căn cơ để xưng bá võ lâm."'
  },
  {
    id: "van-su-thong",
    nameKey: "npc.van-su-thong.name",
    dialogueKey: "npc.van-su-thong.dialogue",
    name: "Vạn Sự Thông",
    x: 11600,
    y: 4800,
    type: "sage",
    dialogue:
      'Vạn Sự Thông: "Thiên hạ sự tình, phong vân biến ảo, không điều gì mà lão phu không tường. Thiếu hiệp muốn dò hỏi tin tức chốn võ lâm chăng?"'
  }
];

/**
 * Localized display name for an NPC, falling back to the Vietnamese catalog.
 * @param {{ nameKey?: string, name: string }} npc
 * @returns {string}
 */
export function getNpcName(npc) {
  return translate(npc.nameKey, undefined, npc.name);
}

/**
 * Copy an NPC with its localized name and dialogue. Used at interaction time so
 * dialogue follows the currently selected language.
 * @param {object} npc
 * @returns {object}
 */
export function localizeNpc(npc) {
  return {
    ...npc,
    name: getNpcName(npc),
    dialogue: translate(npc.dialogueKey, undefined, npc.dialogue)
  };
}
