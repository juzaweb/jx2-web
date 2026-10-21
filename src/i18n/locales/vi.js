export default {
  app: {
    title: "Giang Hồ — HTML5 RPG (VL2 Edition)",
    defaultPlayerName: "Lãng Khách",
    serverFallback: "Giang Hồ",
    confirmReset: "Bạn có chắc chắn muốn xóa dữ liệu đã lưu và chơi lại từ đầu không?",
    confirmLogout: "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?",
    joinLog: 'Hiệp khách {name} đã gia nhập {server}!',
    log: {
      welcome: "Chào mừng hiệp khách đến với Biện Kinh.",
      near: "Lãng Khách: Giang hồ hiểm ác, bảo trọng!",
      guide: "Dùng WASD di chuyển, Phím 1/2 uống dược phẩm, Chuột/Space đánh, Q kiếm khí."
    }
  },
  language: {
    label: "Ngôn ngữ",
    vi: "Tiếng Việt",
    en: "English",
    zh: "中文"
  },
  common: {
    wait: "Chờ...",
    back: "Trở lại",
    close: "Đóng",
    help: "Trợ giúp",
    level: "Cấp"
  },
  hud: {
    levelTitle: "Đẳng cấp nhân vật",
    expTitle: "Kinh nghiệm tu luyện",
    hpTitle: "Sinh lực (HP)",
    mpTitle: "Nội lực (MP)",
    staTitle: "Thể lực (Stamina)",
    buffTitle: "Toàn Chân Tâm Pháp: Tăng 10% công lực & thân pháp"
  },
  minimap: {
    region: "Tàng Long (Máy chủ 1)",
    subzone: "Biện Kinh",
    helpTitle: "Cẩm nang tân thủ",
    questHead: "✦ KHÁM PHÁ BIỆN KINH",
    questDone: "Đã dạo quanh Biện Kinh",
    questTodo: "Thành thị phồn hoa",
    questSafe: "Khu an toàn • Không có quái",
    zoomTitle: "Tab: Phóng to minimap gấp 5 lần",
    mapTitle: "M: Xem bản đồ toàn thành"
  },
  cityMap: {
    eyebrow: "TOÀN CẢNH THÀNH TRÌ",
    title: "Bản Đồ Biện Kinh",
    hint: "Nhấn M hoặc Esc để đóng",
    player: "Nhân vật",
    enemy: "Yêu thú",
    remote: "Hiệp khách",
    pavilion: "Vạn Sự Thông"
  },
  chat: {
    tabs: {
      all: "Tổng hợp",
      system: "Hệ thống",
      near: "Cận",
      combat: "Chiến đấu"
    },
    types: {
      system: "Hệ thống",
      near: "Cận",
      combat: "Chiến đấu",
      guide: "Cẩm nang",
      default: "Giang hồ"
    },
    placeholder: "Nhấn Enter để gửi lời vào giang hồ...",
    send: "GỬI",
    channel: "[ Cận ] ▼"
  },
  hotbar: {
    slotTitle: "Phím [{key}]: {name}",
    skillSlotTitle: "Phím [8] hoặc [Q]: Tuyệt kỹ Kiếm Khí",
    attackTitle: "Đánh thường (cận chiến)",
    skillTitle: "Chuột Phải / Phím Q: Kiếm Khí Bát Hoang",
    leftClick: "Tấn công",
    rightClickQ: "Chuột Phải [Q]",
    martialName: "Phần Cẩm Chữ Hạc",
    martialSub: "Thiên Hà Mật Tịch",
    portraitTitle: "Lãng Khách Võ Đang",
    portraitAlt: "Lãng Khách",
    coins: "BẠC",
    character: "Nhân Vật",
    inventory: "Hành Trang",
    help: "Cẩm Nang",
    pkTitle: "Bật/tắt cờ PK",
    pkOn: "PK",
    pkOff: "Hòa Bình"
  },
  help: {
    eyebrow: "CẨM NANG HÀNH TẨU",
    title: "Hướng Dẫn Tân Thủ",
    move: "Di chuyển: Nhấp chuột trái vào bản đồ (hoặc giữ chuột để chạy theo con trỏ), hoặc dùng cần gạt ảo trên mobile.",
    combat: "Chiến đấu: Dùng nút Tấn công trên thanh dưới (hoặc nút tấn công trên mobile).",
    skill: "Chiêu thức: Bấm ô Chuột trái / Chuột phải để chọn chiêu. Chuột trái vào quái: lao tới đánh. Chuột phải vào quái: lao tới đánh; chuột phải đất trống: xuất chiêu tại chỗ. Phím tắt gán chiêu vào tay phải.",
    potions: "Dược phẩm cấp tốc:\n• Phím 1: Uống Kim Sáng Dược (+35 HP).\n• Phím 2: Uống Đại Hoàn Đan (+25 MP).\n• Phím 3: Uống Nữ Nhi Hồng (+50 HP & +30 MP).",
    loot: "Túi đồ & Tiền bạc: Hạ gục Sói Xám để nhận kinh nghiệm, bạc và nhặt túi ngọc phát sáng.",
    save: "Lưu tiến trình: Hệ thống tự động lưu mỗi 15 giây.",
    map: "Bản đồ: Nhấn Tab để phóng to minimap gấp 5 lần, nhấn M để mở bản đồ toàn thành Biện Kinh.",
    pause: "Tạm dừng: Nhấn Esc hoặc mở bảng Hướng Dẫn để tạm dừng game.",
    resume: "ĐÃ THÔNG SUỐT",
    reset: "LÀM LẠI TỪ ĐẦU (RESET TIẾN TRÌNH)"
  },
  login: {
    brandTitle: "Võ Lâm Truyền Kỳ II",
    brandSubtitle: "HẢO KIỆT LÔI TRANH",
    serverLoggedIn: "Máy chủ đã đăng nhập",
    closeList: "Đóng danh sách",
    chooseServer: "Chọn lại máy chủ",
    loginTab: "Đăng nhập",
    registerTab: "Đăng ký tài khoản",
    usernameLabel: "Tài khoản:",
    usernamePlaceholder: "Nhập tài khoản",
    passwordLabel: "Mật khẩu:",
    passwordPlaceholder: "Nhập mật khẩu",
    remember: "Nhớ",
    virtualKeyboard: "Bàn phím ảo",
    vkTitle: "Bàn Phím Ảo (Chống Keylogger)",
    deleteKey: "Xóa",
    clearKey: "Hết",
    loginButton: "Đăng nhập",
    registerButton: "Đăng ký",
    tags: {
      recommended: "Đề Cử",
      new: "Mới",
      crowded: "Đông",
      normal: "Bình Thường"
    },
    errors: {
      required: "Vui lòng điền đầy đủ tài khoản và mật khẩu.",
      usernamePattern: "Tài khoản phải gồm 3-30 ký tự chữ cái, số hoặc dấu gạch dưới.",
      passwordLength: "Mật khẩu phải có độ dài tối thiểu 6 ký tự.",
      usernameTaken: "Tài khoản này đã tồn tại trong giang hồ.",
      network: "Không thể kết nối đến máy chủ Backend API. Vui lòng kiểm tra dịch vụ Backend đang chạy!",
      generic: "Không thể kết nối đến máy chủ. Vui lòng thử lại!",
      usernameMin: "Tài khoản cần tối thiểu 3 ký tự.",
      usernameChars: "Chỉ gồm chữ cái, số hoặc dấu _"
    },
    success: {
      login: "Đăng nhập thành công! Đang chuyển đến màn hình chọn nhân vật...",
      register: "Đăng ký tài khoản thành công! Đang chuyển đến màn hình tạo nhân vật..."
    }
  },
  characterSelect: {
    account: "Tài khoản",
    server: "Máy chủ",
    create: "Tạo mới",
    select: "Chọn nhân vật",
    loading: "Đang tải...",
    noCharacters: "Chưa có nhân vật",
    newCharacter: "Nhân vật mới",
    sect: "Môn phái",
    sectThieuLam: "Thiếu Lâm",
    sectNgaMy: "Nga My",
    sectVoDang: "Võ Đang",
    sectNguDoc: "Ngũ Độc",
    emptySlot: "(Trống)",
    characterList: "Danh sách nhân vật",
    nameLabel: "Tên:",
    namePlaceholder: "Nhập tên nhân vật",
    nameHint: "{min}-{max} ký tự chữ, số, khoảng trắng, gạch ngang hoặc gạch dưới.",
    agree: "Đồng ý",
    createCharacter: "Tạo mới nhân vật",
    deleteCharacter: "Xoá nhân vật",
    start: "Bắt đầu",
    errors: {
      load: "Không tải được danh sách nhân vật.",
      nameLength: "Tên nhân vật phải gồm {min}-{max} ký tự.",
      create: "Không thể tạo nhân vật. Vui lòng thử lại!",
      delete: "Không thể xoá nhân vật.",
      selectToDelete: "Vui lòng chọn một nhân vật để xoá.",
      selectToStart: "Vui lòng chọn hoặc tạo một nhân vật trước khi bắt đầu.",
      confirmDelete: 'Bạn có chắc muốn xoá vĩnh viễn nhân vật "{name}" không?'
    },
    notice: {
      created: 'Đã tạo nhân vật "{name}".',
      deleted: 'Đã xoá nhân vật "{name}".'
    }
  },
  skills: {
    handLeft: "Chuột trái",
    handRight: "Chuột phải",
    leftHandTitle: "Chiêu chuột trái (bấm để chọn)",
    rightHandTitle: "Chiêu chuột phải (bấm để chọn)",
    picker: {
      eyebrow: "Gán chiêu",
      title: "Chọn chiêu cho {hand}",
      locked: "Cần cấp {level}"
    },
    keybind: {
      short: "Đổi phím",
      eyebrow: "Thiết lập",
      title: "Phím tắt chiêu thức",
      hint: "Bấm vào ô phím rồi nhấn phím muốn gán. Phím chỉ gán chiêu vào tay phải; chuột phải để thi triển.",
      press: "Nhấn phím...",
      error: {
        reserved: "Phím này đã bị giao diện sử dụng.",
        duplicate: "Phím đã gán cho chiêu khác.",
        empty: "Phím không hợp lệ.",
        "invalid-slot": "Ô chiêu không hợp lệ."
      }
    },
    thieuLam: {
      daiTuDiChuong: {
        name: "Đại Tu Di Chưởng",
        desc: "Chưởng pháp diện rộng, đánh choáng kẻ địch quanh thân."
      }
    }
  },
  character: {
    title: "Nhân vật",
    helpTitle: "Trợ giúp",
    closeTitle: "Đóng (F3 / Esc)",
    hint: "Các chỉ số chiến đấu được suy ra từ đẳng cấp nhân vật. Kéo trang bị từ Hành trang (F4) vào ô để mặc, hoặc nhấp/kéo ô đang mặc để tháo ra.",
    tabEquip: "Trang bị",
    tabNews: "Tin tức",
    locked: "{label} (chưa mở)",
    notEquipped: "{label} (chưa trang bị)",
    unequipTitle: "{name} (nhấp để tháo)",
    potential: "Tiềm năng",
    points: "Điểm:",
    nextLevel: "Tăng cấp:",
    slots: {
      belt: "Đai lưng",
      bracers: "Hộ uyển",
      secretManual: "Mật tịch",
      subManual: "Phó mật tịch",
      cosHat: "Ngoại trang - Nón",
      cosTop: "Ngoại trang - Áo",
      cosPants: "Ngoại trang - Quần",
      mount: "Ngựa"
    }
  },
  inventory: {
    title: "Hành trang",
    helpTitle: "Trợ giúp túi đồ",
    closeTitle: "Đóng (Esc)",
    hint: "Nhấp vào dược phẩm hoặc phù chú để sử dụng. Kéo trang bị sang bảng Nhân vật (F3) để mặc. Di chuột lên vật phẩm để xem mô tả.",
    equip: "Mặc",
    use: "Dùng",
    useTitle: "{name}",
    weight: "Sức nặng",
    count: "{used}/{total}",
    silver: "Bạc",
    gold: "Kim Nguyên Bảo",
    jade: "Tiên Ngọc",
    kimPhieu: "Kim phiếu:",
    ngucac: "[ Ngự các ]",
    quantity: "Số lượng: {qty}",
    equipHint: "Nhấp để mặc vào ô {slot}",
    useHint: "Nhấp để sử dụng"
  },
  shop: {
    eyebrow: "DƯỢC ĐIỂM BIỆN KINH",
    title: "Tiệm Dược",
    greeting: "Lão phu chuyên bán linh dược hồi sinh lực và nội lực. Hiệp khách cứ chọn.",
    balance: "Túi bạc:",
    buy: "Mua",
    result: {
      ok: "Giao dịch thành công — đã thêm {qty} dược phẩm vào hành trang.",
      coins: "Không đủ bạc để mua dược phẩm này.",
      guest: "Cần đăng nhập và chọn nhân vật để giao dịch.",
      offline: "Cần kết nối máy chủ để giao dịch.",
      range: "Hãy đến gần chủ tiệm để giao dịch.",
      error: "Máy chủ không thể hoàn tất giao dịch. Bạc chưa bị trừ.",
      unknown: "Tiệm không bán vật phẩm này."
    }
  },
  slots: {
    armor: "Giáp",
    helmet: "Mũ",
    accessory: "Trang sức",
    weapon: "Vũ khí"
  },
  bonus: {
    attack: "Ngoại công",
    defense: "Ngoại phòng",
    maxHp: "Sinh lực",
    maxMp: "Nội lực",
    critRate: "Chí mạng",
    accuracy: "Chính xác"
  },
  stats: {
    hp: "Sinh lực",
    mp: "Nội lực",
    strength: "Sức mạnh",
    agility: "Thân pháp",
    internal: "Nội công",
    bone: "Gân cốt",
    flexibility: "Linh hoạt",
    physicalAtk: "Ngoại công",
    chiAtk: "Nội kích",
    damage: "Sát thương",
    accuracy: "Chính xác",
    physicalDef: "Ngoại phòng",
    magicDef: "Nội phòng",
    dodge: "Né tránh",
    crit: "Chí mạng",
    burst: "Điểm bạo",
    burstHard: "Bạo cương",
    woundRate: "Tỉ lệ thương",
    critResist: "Khắc nộ",
    cast: "Xuất chiêu",
    attackSpeed: "Tốc độ đánh",
    moveSpeed: "Tốc độ di chuyển"
  },
  item: {
    "kim-sang-duoc": {
      name: "Kim Sáng Dược",
      desc: "Linh dược chế từ kim ngân. Hồi phục +35 Sinh lực khi uống."
    },
    "dai-hoan-dan": {
      name: "Đại Hoàn Đan",
      desc: "Linh đan tụ khí. Hồi phục +25 Nội lực khi uống."
    },
    "nu-nhi-hong": {
      name: "Nữ Nhi Hồng",
      desc: "Mỹ tửu trần ba năm. Hồi phục +50 Sinh lực và +30 Nội lực."
    },
    "hoi-thanh-phu": {
      name: "Hồi Thành Phù",
      desc: "Phù chú không gian, đưa hành giả trở về cố hương Biện Kinh."
    },
    "ho-lo-tuu": {
      name: "Hồ Lô Tửu",
      desc: "Bầu rượu của hành khách, hương thơm nồng đượm."
    },
    "lenh-bai": {
      name: "Lệnh Bài Môn Phái",
      desc: "Tín vật Võ Đang, chứng minh thân phận đệ tử."
    },
    "thiet-trao": {
      name: "Thiết Trảo",
      desc: "Binh khí lợi hại, sử dụng trong cận chiến."
    },
    "hac-ung-kiem": {
      name: "Hắc Ưng Kiếm",
      desc: "Thanh kiếm huyền thiết, sắc bén vô song."
    },
    "bi-kip-vo-cong": {
      name: "Bí Kíp Võ Công",
      desc: "Sách cổ ghi chép tâm pháp luyện công."
    },
    "thien-ha-mat-tich": {
      name: "Thiên Hà Mật Tịch",
      desc: "Mật tịch thượng thừa của phái Thiên Hà."
    },
    "cam-y-bao": {
      name: "Cẩm Y Bào",
      desc: "Áo gấm thêu chỉ vàng, gia tăng phòng ngự."
    },
    "thanh-long-dao": {
      name: "Thanh Long Đao",
      desc: "Đại đao khắc hình thanh long, uy lực trầm hùng."
    },
    "ngoc-bo-dao": {
      name: "Ngọc Bồi Dương Chi",
      desc: "Ngọc bội gia truyền, tỏa linh khí nhè nhẹ."
    },
    "huyen-kim-thach": {
      name: "Huyễn Kim Thạch",
      desc: "Khoáng thạch quý dùng để rèn đúc trang bị."
    },
    "tui-bac": {
      name: "Túi Bạc",
      desc: "Túi đựng bạc, nhặt được từ dã thú."
    },
    "duoc-vuong-lo": {
      name: "Dược Vương Lộ",
      desc: "Linh dịch chữa lành, chiết từ ngàn loại thảo dược."
    },
    "than-bi-hop": {
      name: "Thần Bí Hộp",
      desc: "Bảo hộp chưa mở, bên trong ẩn chứa kỳ vật."
    },
    "yeu-dan": {
      name: "Yêu Đan",
      desc: "Nội đan của yêu thú, tinh túy linh khí."
    },
    "huyet-chien-giap": {
      name: "Huyết Chiến Giáp",
      desc: "Chiến giáp nhuốm huyết, phòng ngự cực cao."
    },
    "bach-nien-linh-chi": {
      name: "Bách Niên Linh Chi",
      desc: "Linh chi trăm năm, đại bổ nguyên khí."
    },
    "tu-kim-ho-lo": {
      name: "Tử Kim Hồ Lô",
      desc: "Hồ lô tử kim, tích linh đan hồi phục."
    },
    "ngoc-tinh-binh": {
      name: "Ngọc Tịnh Bình",
      desc: "Bình ngọc tịnh khí, thanh lọc tâm thần."
    },
    "phuong-vu-bao": {
      name: "Phượng Vũ Bào",
      desc: "Bào phục thêu lông phượng, tôn quý phi thường."
    },
    "phach-dao": {
      name: "Phách Đao",
      desc: "Đao nhẹ, tốc độ xuất thủ cực nhanh."
    },
    "tu-tinh-nhan": {
      name: "Tứ Tinh Nhẫn",
      desc: "Nhẫn khảm bốn viên linh thạch."
    },
    "linh-duong": {
      name: "Thịt Rừng",
      desc: "Thịt thú tươi, dùng để nấu nướng hồi phục."
    },
    "tang-kinh-do": {
      name: "Tàng Kinh Đồ",
      desc: "Bản đồ địa đạo bí mật dẫn tới tàng kinh các."
    },
    "ngoc-nhan": {
      name: "Ngọc Nhẫn",
      desc: "Nhẫn ngọc đơn sơ nhưng ẩn chứa linh khí."
    },
    "hoang-kim-huyen-thiet": {
      name: "Huyền Thiết Kim",
      desc: "Kim loại huyền thiết, chế tạo binh khí thượng hạng."
    },
    "huyet-bo-dao": {
      name: "Huyết Bồ Đào",
      desc: "Linh dược huyết sắc, hồi phục thương thế."
    },
    "tu-kim-quan": {
      name: "Tử Kim Quan",
      desc: "Kim quan cài ngọc, gia tăng phòng ngự và chính xác."
    }
  }
};
