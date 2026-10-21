export default {
  app: {
    title: "江湖 — HTML5 RPG（武林群侠传II版）",
    defaultPlayerName: "浪客",
    serverFallback: "江湖",
    confirmReset: "确定要清除已保存的数据并重新开始吗？",
    confirmLogout: "确定要退出当前账号吗？",
    joinLog: "侠客 {name} 已加入 {server}！",
    log: {
      welcome: "欢迎侠客来到汴京。",
      near: "浪客：江湖险恶，请多保重！",
      guide: "使用 WASD 移动，按 1/2 喝药，鼠标/空格攻击，Q 释放剑气。"
    }
  },
  language: {
    label: "语言",
    vi: "Tiếng Việt",
    en: "English",
    zh: "中文"
  },
  common: {
    wait: "请稍候……",
    back: "返回",
    close: "关闭",
    help: "帮助",
    level: "等级"
  },
  hud: {
    levelTitle: "角色等级",
    expTitle: "修炼经验",
    hpTitle: "生命（HP）",
    mpTitle: "内力（MP）",
    staTitle: "体力（Stamina）",
    buffTitle: "全真心法：提升 10% 功力与身法"
  },
  minimap: {
    region: "藏龙（服务器 1）",
    subzone: "汴京",
    helpTitle: "新手秘笈",
    questHead: "✦ 探索汴京",
    questDone: "已游历汴京",
    questTodo: "繁华都城",
    questSafe: "安全区 • 无怪物",
    zoomTitle: "Tab：小地图放大 5 倍",
    mapTitle: "M：查看全城地图"
  },
  cityMap: {
    eyebrow: "城池全貌",
    title: "汴京地图",
    hint: "按 M 或 Esc 关闭",
    player: "角色",
    enemy: "妖兽",
    remote: "侠客",
    pavilion: "万事通"
  },
  chat: {
    tabs: {
      all: "综合",
      system: "系统",
      near: "附近",
      combat: "战斗"
    },
    types: {
      system: "系统",
      near: "附近",
      combat: "战斗",
      guide: "秘笈",
      default: "江湖"
    },
    placeholder: "按 Enter 向江湖发言……",
    send: "发送",
    channel: "[ 附近 ] ▼"
  },
  hotbar: {
    slotTitle: "按键 [{key}]：{name}",
    skillSlotTitle: "按键 [8] 或 [Q]：剑气绝技",
    attackTitle: "普通攻击（近战）",
    skillTitle: "右键 / Q 键：剑气八荒",
    leftClick: "攻击",
    rightClickQ: "右键 [Q]",
    martialName: "鹤字锦",
    martialSub: "天河秘笈",
    portraitTitle: "武当浪客",
    portraitAlt: "浪客",
    coins: "银两",
    character: "角色",
    inventory: "行囊",
    help: "秘笈",
    pkTitle: "开启/关闭 PK 标记",
    pkOn: "PK",
    pkOff: "和平"
  },
  help: {
    eyebrow: "行走江湖秘笈",
    title: "新手指导",
    move: "移动：左键点击地图（或按住鼠标跟随光标），或使用手机虚拟摇杆。",
    combat: "战斗：使用底部栏的攻击按钮（手机端为攻击按钮）。",
    skill: "招式：点击“左键/右键”槽位选择招式。左键点击敌人会跑过去攻击；右键点击敌人会跑过去，右键点击空地则原地施放。快捷键用于绑定右手招式。",
    potions: "快速药品：\n• 1 键：服用金创药（+35 HP）。\n• 2 键：服用大还丹（+25 MP）。\n• 3 键：服用女儿红（+50 HP & +30 MP）。",
    loot: "行囊与银两：击败灰狼可获得经验、银两，并拾取发光的玉袋。",
    save: "保存进度：系统每 15 秒自动保存。",
    map: "地图：按 Tab 将小地图放大 5 倍，按 M 打开汴京全城地图。",
    pause: "暂停：按 Esc 或打开秘笈面板可暂停游戏。",
    resume: "我已了解",
    reset: "从头开始（重置进度）"
  },
  login: {
    brandTitle: "武林群侠传 II",
    brandSubtitle: "豪杰雷争",
    serverLoggedIn: "已登录服务器",
    closeList: "关闭列表",
    chooseServer: "重新选择服务器",
    loginTab: "登录",
    registerTab: "注册账号",
    usernameLabel: "账号：",
    usernamePlaceholder: "请输入账号",
    passwordLabel: "密码：",
    passwordPlaceholder: "请输入密码",
    remember: "记住",
    virtualKeyboard: "虚拟键盘",
    vkTitle: "虚拟键盘（防键盘记录）",
    deleteKey: "删除",
    clearKey: "清空",
    loginButton: "登录",
    registerButton: "注册",
    tags: {
      recommended: "推荐",
      new: "新服",
      crowded: "拥挤",
      normal: "正常"
    },
    errors: {
      required: "请填写账号和密码。",
      usernamePattern: "账号必须为 3-30 个字母、数字或下划线。",
      passwordLength: "密码长度至少为 6 个字符。",
      usernameTaken: "该账号已在江湖中存在。",
      network: "无法连接后端 API。请检查后端服务是否正在运行！",
      generic: "无法连接服务器，请重试！",
      usernameMin: "账号至少需要 3 个字符。",
      usernameChars: "仅可使用字母、数字或下划线"
    },
    success: {
      login: "登录成功！正在进入角色选择……",
      register: "账号注册成功！正在进入角色创建……"
    }
  },
  characterSelect: {
    account: "账号",
    server: "服务器",
    create: "创建",
    select: "选择角色",
    loading: "加载中……",
    noCharacters: "暂无角色",
    newCharacter: "新角色",
    sect: "门派",
    sectThieuLam: "少林",
    sectNgaMy: "峨眉",
    sectVoDang: "武当",
    sectNguDoc: "五毒",
    emptySlot: "（空）",
    characterList: "角色列表",
    nameLabel: "名称：",
    namePlaceholder: "请输入角色名称",
    nameHint: "{min}-{max} 个字母、数字、空格、连字符或下划线。",
    agree: "确定",
    createCharacter: "创建角色",
    deleteCharacter: "删除角色",
    start: "开始",
    errors: {
      load: "无法加载角色列表。",
      nameLength: "角色名称必须为 {min}-{max} 个字符。",
      create: "无法创建角色，请重试！",
      delete: "无法删除角色。",
      selectToDelete: "请选择要删除的角色。",
      selectToStart: "开始前请先选择或创建角色。",
      confirmDelete: "确定要永久删除角色“{name}”吗？"
    },
    notice: {
      created: "已创建角色“{name}”。",
      deleted: "已删除角色“{name}”。"
    }
  },
  skills: {
    handLeft: "左键",
    handRight: "右键",
    leftHandTitle: "左键招式（点击选择）",
    rightHandTitle: "右键招式（点击选择）",
    picker: {
      eyebrow: "绑定招式",
      title: "为{hand}选择招式",
      locked: "需要等级 {level}"
    },
    keybind: {
      short: "快捷键",
      eyebrow: "设置",
      title: "招式快捷键",
      hint: "点击按键框后按下想要绑定的按键。按键只把招式装到右手，右键才会施放。",
      press: "请按键...",
      error: {
        reserved: "该按键已被界面占用。",
        duplicate: "该按键已绑定其他招式。",
        empty: "按键无效。",
        "invalid-slot": "招式槽无效。"
      }
    },
    thieuLam: {
      daiTuDiChuong: {
        name: "大须弥掌",
        desc: "远程掌法，击晕远处目标。"
      }
    }
  },
  character: {
    title: "角色",
    helpTitle: "帮助",
    closeTitle: "关闭（F3 / Esc）",
    hint: "战斗属性由角色等级推算。将行囊（F4）中的装备拖到格子上即可穿戴，或点击/拖动已装备的格子卸下。",
    tabEquip: "装备",
    tabNews: "消息",
    locked: "{label}（未开放）",
    notEquipped: "{label}（未装备）",
    unequipTitle: "{name}（点击卸下）",
    potential: "潜能",
    points: "点数：",
    nextLevel: "升级：",
    slots: {
      belt: "腰带",
      bracers: "护腕",
      secretManual: "秘籍",
      subManual: "副秘籍",
      cosHat: "外装 - 头饰",
      cosTop: "外装 - 上衣",
      cosPants: "外装 - 下装",
      mount: "坐骑"
    }
  },
  inventory: {
    title: "行囊",
    helpTitle: "行囊帮助",
    closeTitle: "关闭（Esc）",
    hint: "点击药品或符咒即可使用。将装备拖到人物面板（F3）即可穿戴。将鼠标悬停在物品上可查看描述。",
    equip: "装备",
    use: "使用",
    useTitle: "{name}",
    weight: "负重",
    count: "{used}/{total}",
    silver: "银两",
    gold: "金元宝",
    jade: "仙玉",
    kimPhieu: "金票：",
    ngucac: "[ 御阁 ]",
    quantity: "数量：{qty}",
    equipHint: "点击装备到{slot}",
    useHint: "点击使用"
  },
  shop: {
    eyebrow: "汴京药铺",
    title: "药铺",
    greeting: "老夫专卖恢复生命与内力的灵药，侠客尽管挑选。",
    balance: "银两：",
    buy: "购买",
    result: {
      ok: "交易成功——已将 {qty} 件药品放入行囊。",
      coins: "银两不足，无法购买此药品。",
      guest: "请先登录并选择角色再进行交易。",
      offline: "请连接服务器后再进行交易。",
      range: "请靠近店主后再进行交易。",
      error: "服务器未能完成交易，未扣除银两。",
      unknown: "本店不出售此物品。"
    }
  },
  slots: {
    armor: "战甲",
    helmet: "头盔",
    accessory: "饰品",
    weapon: "武器"
  },
  bonus: {
    attack: "外功",
    defense: "外防",
    maxHp: "生命",
    maxMp: "内力",
    critRate: "暴击",
    accuracy: "命中"
  },
  stats: {
    hp: "生命",
    mp: "内力",
    strength: "力量",
    agility: "身法",
    internal: "内功",
    bone: "筋骨",
    flexibility: "灵活",
    physicalAtk: "外功",
    chiAtk: "内击",
    damage: "伤害",
    accuracy: "命中",
    physicalDef: "外防",
    magicDef: "内防",
    dodge: "闪避",
    crit: "暴击",
    burst: "爆点",
    burstHard: "爆刚",
    woundRate: "伤口率",
    critResist: "克怒",
    cast: "出招",
    attackSpeed: "攻速",
    moveSpeed: "移动速度"
  },
  item: {
    "kim-sang-duoc": {
      name: "金创药",
      desc: "以金银花炼制的灵药。服用后恢复 +35 生命。"
    },
    "dai-hoan-dan": {
      name: "大还丹",
      desc: "聚气灵丹。服用后恢复 +25 内力。"
    },
    "nu-nhi-hong": {
      name: "女儿红",
      desc: "窖藏三年的美酒。恢复 +50 生命与 +30 内力。"
    },
    "hoi-thanh-phu": {
      name: "回城符",
      desc: "空间符咒，可将行者送回故乡汴京。"
    },
    "ho-lo-tuu": {
      name: "葫芦酒",
      desc: "行者随身携带的酒葫芦，香气浓郁。"
    },
    "lenh-bai": {
      name: "门派令牌",
      desc: "武当信物，证明弟子的身份。"
    },
    "thiet-trao": {
      name: "铁爪",
      desc: "近战使用的凌厉兵器。"
    },
    "hac-ung-kiem": {
      name: "黑鹰剑",
      desc: "玄铁打造的长剑，锋利无双。"
    },
    "bi-kip-vo-cong": {
      name: "武功秘籍",
      desc: "记载练功心法的古籍。"
    },
    "thien-ha-mat-tich": {
      name: "天河秘笈",
      desc: "天河派的上乘秘笈。"
    },
    "cam-y-bao": {
      name: "锦衣袍",
      desc: "金线刺绣的锦袍，可提升防御。"
    },
    "thanh-long-dao": {
      name: "青龙刀",
      desc: "刻有青龙纹的大刀，气势沉雄。"
    },
    "ngoc-bo-dao": {
      name: "羊脂玉佩",
      desc: "祖传玉佩，散发淡淡灵气。"
    },
    "huyen-kim-thach": {
      name: "幻金石",
      desc: "用于锻造装备的珍贵矿石。"
    },
    "tui-bac": {
      name: "银袋",
      desc: "装有银两的袋子，可从野兽身上拾得。"
    },
    "duoc-vuong-lo": {
      name: "药王露",
      desc: "由千种草药提炼而成的疗伤灵液。"
    },
    "than-bi-hop": {
      name: "神秘盒",
      desc: "未开启的宝盒，其中暗藏奇物。"
    },
    "yeu-dan": {
      name: "妖丹",
      desc: "妖兽的内丹，蕴藏灵气精华。"
    },
    "huyet-chien-giap": {
      name: "血战甲",
      desc: "染血的战甲，防御极高。"
    },
    "bach-nien-linh-chi": {
      name: "百年灵芝",
      desc: "百年灵芝，大补元气。"
    },
    "tu-kim-ho-lo": {
      name: "紫金葫芦",
      desc: "紫金葫芦，可储藏回复灵丹。"
    },
    "ngoc-tinh-binh": {
      name: "玉净瓶",
      desc: "玉制净气宝瓶，可清心宁神。"
    },
    "phuong-vu-bao": {
      name: "凤羽袍",
      desc: "绣有凤羽的袍服，尊贵非凡。"
    },
    "phach-dao": {
      name: "魄刀",
      desc: "轻巧的刀，出手速度极快。"
    },
    "tu-tinh-nhan": {
      name: "四星戒",
      desc: "镶嵌四颗灵石的戒指。"
    },
    "linh-duong": {
      name: "野味",
      desc: "新鲜的兽肉，可用于烹饪回复。"
    },
    "tang-kinh-do": {
      name: "藏经图",
      desc: "通往藏经阁的密道地图。"
    },
    "ngoc-nhan": {
      name: "玉戒",
      desc: "朴素的玉戒，却暗藏灵气。"
    },
    "hoang-kim-huyen-thiet": {
      name: "玄铁金",
      desc: "玄铁金属，可打造上等兵器。"
    },
    "huyet-bo-dao": {
      name: "血葡萄",
      desc: "血色的灵药，可恢复伤势。"
    },
    "tu-kim-quan": {
      name: "紫金冠",
      desc: "嵌玉金冠，提升防御与命中。"
    }
  }
};
