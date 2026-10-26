export default {
  app: {
    title: "江湖 — 武侠 RPG",
    defaultPlayerName: "浪客",
    confirmReset: "确定要清除已保存的数据并重新开始吗？",
    confirmLogout: "确定要退出当前账号吗？",
    joinLog: "侠客 {name} 已加入 {server}！",
    rotateDeviceTitle: "请横屏游玩",
    rotateDeviceDesc: "为了获得最佳游戏体验，请将手机旋转至横屏模式。",
    rotateDeviceButton: "旋转屏幕",
    log: {
      welcome: "欢迎侠客来到汴京。",
      near: "浪客：江湖险恶，请多保重！",
      guide: "使用 WASD 移动，按 1/2 喝药，鼠标/空格攻击，Q 释放剑气。"
    }
  },
  connection: {
    eyebrow: "江湖中斷",
    title: "连接已断开",
    desc: "无法连接至{server}服务器。为保护您的进度，行走已暂停。",
    hint: "正在自动重新连接，请稍候。"
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
    mapTitle: "M：查看全城地图",
    minimize: "最小化地图",
    restore: "打开地图"
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
    channel: "[ 附近 ] ▼",
    minimize: "最小化聊天",
    restore: "打开聊天"
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
    move: "移动：左键点击地图（或按住鼠标跟随光标），使用方向键（↑ ↓ ← →）或 W/A/S/D，或使用手机虚拟摇杆。",
    combat: "战斗与互动：靠近NPC时按 [F] 键对话。使用底栏或手机端攻击按钮。",
    skill: "招式：按 U, I, O, P 键直接向鼠标或最近目标施放招式。点击底栏 U, I, O, P 槽位绑定门派招式。",
    potions: "快速药品：\n• 1 键：服用金创药（+35 HP）。\n• 2 键：服用大还丹（+25 MP）。\n• 3 键：服用女儿红（+50 HP & +30 MP）。",
    loot: "行囊与银两：击败灰狼可获得经验、银两，并拾取发光的玉袋。",
    save: "保存进度：系统每 15 秒自动保存。",
    map: "地图：按 Tab 将小地图放大 5 倍，按 M 打开汴京全城地图。",
    pause: "暂停：按 Esc 或打开秘笈面板可暂停游戏。",
    resume: "我已了解",
    reset: "从头开始（重置进度）"
  },
  login: {
    brandTitle: "江湖",
    brandSubtitle: "行走江湖",
    serverLoggedIn: "江湖之门",
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
    keySlotLabel: "按键",
    assignKey: "绑定招式 [{key}]",
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
    modalTitle: "武学面板",
    modalHint: "门派招式树。选择一个招式格查看详情并快速绑定按键。",
    bindToKey: "绑定到 [{key}]",
    bindLeft: "绑定左键",
    bindRight: "绑定右键",
    cooldownSec: "{sec}秒",
    rangeTag: "距离: {range}",
    dmgTag: "伤害: {pct}%",
    tree: {
      requires: "需要 {name} 达到 {level} 级",
      empty: "该门派暂无招式。",
      selectHint: "选择一个招式格查看详情。"
    },
    thieuLam: {
      laHanQuyen: {
        name: "罗汉拳",
        desc: "少林基础拳法，贴身近战攻击目标。"
      },
      thieuLamTruongPhap: {
        name: "少林掌法",
        desc: "少林刚猛掌法，造成中等近战伤害。"
      },
      daiTuDiChuong: {
        name: "大须弥掌",
        desc: "远程掌法，击晕远处目标。"
      },
      laHanTran: {
        name: "罗汉阵",
        desc: "罗汉护体法阵，提升 10% 攻击力、20% 移动速度与 5% 会心一击率，持续 3 分钟。"
      },
      kimCangBatHoai: {
        name: "金刚不坏",
        desc: "金刚护体，提升 30% 防御力，持续 30 秒。效果期间头顶显现金刚卍印。"
      },
      nhuLaiThanChuong: {
        name: "如来神掌",
        desc: "少林绝学，如来掌力从天而降，对周围敌人造成范围伤害并使其眩晕。"
      }
    },
    voDang: {
      thieuDuongKiemPhap: {
        name: "少阳剑法",
        desc: "武当基础剑术，轻灵快捷。"
      },
      thaiCucQuyen: {
        name: "太极拳",
        desc: "借力打力，造成强劲冲击伤害。"
      },
      tamThanhKiemPhap: {
        name: "三清剑法",
        desc: "连续施展三道剑气扫荡敌阵。"
      },
      toatHongQuanKhuyet: {
        name: "紫霄罡气",
        desc: "武当护体气功，提升 15% 攻击力，持续 3 分钟。"
      }
    },
    ngaMy: {
      ngaMyKiemPhap: {
        name: "峨眉剑法",
        desc: "优雅柔美的剑术，造成连续伤害。"
      },
      mongDiepThoiTam: {
        name: "梦蝶催心",
        desc: "剑气如蝶翩翩，直袭目标心脉。"
      },
      tuHangPhoDo: {
        name: "慈航普渡",
        desc: "佛光普照，立即为自身恢复 50 点生命值。"
      },
      luuThuyKhanhVan: {
        name: "流水庆云",
        desc: "身法如行云流水，提升 25% 移动速度。"
      }
    },
    nguDoc: {
      nguDocTamPhap: {
        name: "五毒心法",
        desc: "五毒秘传心法，攻击附带剧毒。"
      },
      truyTamDoc: {
        name: "追心毒",
        desc: "剧毒掌气透骨穿心。"
      },
      vanDocChieuHong: {
        name: "万毒召蛊",
        desc: "召唤万千毒虫攻击大范围目标。"
      },
      uHongPhietAnh: {
        name: "幽魂掠影",
        desc: "身形如幽灵掠影，提升 10% 暴击率。"
      }
    }
  },
  character: {
    title: "角色",
    helpTitle: "帮助",
    closeTitle: "关闭（F3 / Esc）",
    hint: "战斗属性为实际交战使用的数值。将行囊（F4）中的装备拖到格子上即可穿戴，或点击/拖动已装备的格子卸下。",
    tabEquip: "装备",
    tabNews: "消息",
    locked: "{label}（未开放）",
    notEquipped: "{label}（未装备）",
    unequipTitle: "{name}（点击卸下）",
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
    hint: "点击药品或符咒即可使用。将物品拖到 1–9 快捷栏即可绑定热键；将快捷格拖离快捷栏（或右键）即可清除。将装备拖到人物面板（F3）即可穿戴。将鼠标悬停在物品上可查看描述。",
    equip: "装备",
    use: "使用",
    useTitle: "{name}",
    weight: "负重",
    count: "{used}/{total}",
    silver: "银两",
    copper: "铜钱",
    gold: "黄金",
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
    physicalAtk: "外功",
    physicalDef: "外防",
    crit: "暴击",
    critDamage: "暴击命中",
    attackSpeed: "攻速"
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
    "lenh-bai-gm": {
      name: "GM令牌",
      desc: "GM总管至高令牌。可打开管理面板获取等级、恢复气血内力、获取药水与地图传送。"
    },
    "ao-lang-khach": {
      name: "浪客青衣",
      desc: "初入江湖所着交领布衣。轻便透气，利于仗剑天涯。"
    },
    "non-lang-khach": {
      name: "浪客斗笠",
      desc: "采边境竹篾编制而成的斗笠。遮风避雨，助侠士泰然面对江湖风雨。"
    },
    "quan-lang-khach": {
      name: "浪客劲装裤",
      desc: "利落布裤搭配绑腿护膝，便利用于施展轻功与闯荡江湖。"
    }
  },
  gm: {
    title: "GM令牌",
    hint: "在线人物管理面板。所有操作均与服务器实时权威同步。",
    tabs: {
      level: "等级",
      potions: "药品",
      equipment: "服饰",
      teleport: "传送",
      utility: "功能"
    },
    level: {
      title: "获取等级与经验",
      quickLevel: "快速等级档位",
      addLevel: "提升等级",
      addExp: "获取经验",
      customLevel: "自选等级 (1 - 150)",
      setLevelBtn: "设定等级",
      successSet: "等级设定成功！"
    },
    potions: {
      title: "气血内力与药品",
      healFull: "全满气血与内力",
      receiveHp: "获取 99x 金创药",
      receiveMp: "获取 99x 大还丹",
      receiveWine: "获取 99x 女儿红",
      receiveAll: "获取全部药品 (x99)",
      fullHealed: "气血与内力已全部回满！",
      potionsReceived: "药品已放入包裹。"
    },
    equipment: {
      title: "浪客套装",
      costumeSet: "浪客套装（斗笠、青衣、劲装裤）",
      costumeDesc: "江湖浪客服饰（斗笠/女子面纱斗笠、交领青衣、绑腿裤靴）。",
      getHat: "浪客斗笠",
      getRobe: "浪客青衣",
      getPants: "浪客劲装裤",
      quickActions: "快捷操作",
      receiveFullSet: "获取完整套装",
      equipFullSet: "一键穿戴全套"
    },
    teleport: {
      title: "回城与传送",
      receiveScroll: "获取 99x 回城符",
      toMarket: "传送：汴京主城",
      toDongMonThanh: "传送：东门城野外",
      toSpawn: "回城（复活点）"
    },
    utility: {
      title: "银两与辅助功能",
      addCoins1k: "获取 1,000 银两",
      addCoins10k: "获取 10,000 银两",
      addCoins100k: "获取 100,000 银两",
      godMode: "无敌模式 (God Mode)",
      godModeOn: "无敌模式：[已开启]",
      godModeOff: "开启无敌模式",
      speedBuff: "移速翻倍 (x2)",
      speedNormal: "正常移速"
    }
  }
};
