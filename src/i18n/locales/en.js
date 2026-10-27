export default {
  app: {
    title: "Jianghu — Wuxia RPG",
    defaultPlayerName: "Wanderer",
    confirmReset: "Are you sure you want to erase your saved progress and start over?",
    confirmLogout: "Are you sure you want to log out of your account?",
    joinLog: "{name} has joined {server}!",
    rotateDeviceTitle: "Rotate Device Horizontally",
    rotateDeviceDesc: "Please rotate your phone to landscape mode for the best gaming experience.",
    rotateDeviceButton: "Rotate Screen",
    log: {
      welcome: "Welcome to Bianjing, honored warrior.",
      near: "Wanderer: The Jianghu is treacherous. Take care!",
      guide: "Use WASD to move, keys 1/2 to drink potions, Mouse/Space to attack, Q for sword aura."
    }
  },
  connection: {
    eyebrow: "JIANGHU DISCONNECTED",
    title: "Connection Lost",
    desc: "Cannot reach the {server} server. Your journey is paused to protect your progress.",
    hint: "Reconnecting automatically — please wait a moment."
  },
  language: {
    label: "Language",
    vi: "Tiếng Việt",
    en: "English",
    zh: "中文"
  },
  common: {
    wait: "Please wait...",
    back: "Back",
    close: "Close",
    help: "Help",
    level: "Level"
  },
  hud: {
    levelTitle: "Character level",
    expTitle: "Cultivation experience",
    hpTitle: "Health (HP)",
    mpTitle: "Inner force (MP)",
    staTitle: "Stamina",
    buffTitle: "Quanzhen Heart Method: +10% power and agility"
  },
  minimap: {
    region: "Hidden Dragon (Server 1)",
    subzone: "Bianjing",
    helpTitle: "Beginner's guide",
    questHead: "✦ EXPLORE BIANJING",
    questDone: "You have toured Bianjing",
    questTodo: "A bustling city",
    questSafe: "Safe zone • No monsters",
    zoomTitle: "Tab: Enlarge the minimap 5x",
    mapTitle: "M: Open the full city map",
    minimize: "Minimize map",
    restore: "Open map"
  },
  cityMap: {
    eyebrow: "CITY OVERVIEW",
    title: "Bianjing Map",
    titleWithName: "{name} Map",
    hint: "Press M or Esc to close",
    player: "You",
    enemy: "Monsters",
    remote: "Players",
    pavilion: "Pavilion"
  },
  chat: {
    tabs: {
      all: "All",
      system: "System",
      near: "Local",
      combat: "Combat"
    },
    types: {
      system: "System",
      near: "Local",
      combat: "Combat",
      guide: "Guide",
      default: "Jianghu"
    },
    placeholder: "Press Enter to speak to the Jianghu...",
    send: "SEND",
    channel: "[ Local ] ▼",
    minimize: "Minimize chat",
    restore: "Open chat"
  },
  hotbar: {
    slotTitle: "Key [{key}]: {name}",
    skillBindingTitle: "Key [{key}]: {name}",
    skillSlotTitle: "Key [8] or [Q]: Sword Aura ultimate",
    attackTitle: "Basic attack (melee)",
    skillTitle: "Right Click / Key Q: Eight Desolations Sword Aura",
    leftClick: "Attack",
    rightClickQ: "Right Click [Q]",
    martialName: "Crane-Character Brocade",
    martialSub: "Milky Way Secret Tome",
    character: "Character",
    inventory: "Inventory",
    help: "Guide",
    pkTitle: "Toggle PK flag",
    pkOn: "PK",
    pkOff: "Peace",
    logout: "Logout"
  },
  help: {
    eyebrow: "TRAVELER'S HANDBOOK",
    title: "Beginner's Guide",
    move: "Movement: Left-click the map (or hold the mouse to follow the cursor), use Arrow keys (↑ ↓ ← →) or W/A/S/D, or the mobile joystick.",
    combat: "Combat & Interaction: Press [F] near an NPC to talk. Use the Attack button on the dock or mobile.",
    skill: "Skills: Open the Martial Arts panel [F5] and drag a skill onto hotbar slots 1-9. Press the matching number key to cast towards the cursor or nearest enemy. Right-click a slot to clear it.",
    potions: "Quick potions:\n• Key 1: Golden Radiance Elixir (+35 HP).\n• Key 2: Great Return Pill (+25 MP).\n• Key 3: Daughter's Red Wine (+50 HP & +30 MP).",
    loot: "Bag & money: Defeat Grey Wolves to gain experience, silver, and glowing jade pouches to pick up.",
    save: "Saving: The system auto-saves every 15 seconds.",
    map: "Map: Press Tab to enlarge the minimap 5x, press M to open the full Bianjing city map.",
    pause: "Pause: Press Esc or open the Guide to pause the game.",
    resume: "I UNDERSTAND",
    reset: "START OVER (RESET PROGRESS)"
  },
  login: {
    brandTitle: "Jianghu",
    brandSubtitle: "WANDER THE MARTIAL WORLD",
    serverLoggedIn: "Gateway to the Jianghu",
    loginTab: "Log in",
    registerTab: "Create account",
    usernameLabel: "Account:",
    usernamePlaceholder: "Enter account",
    passwordLabel: "Password:",
    passwordPlaceholder: "Enter password",
    remember: "Remember",
    virtualKeyboard: "On-screen keyboard",
    vkTitle: "On-Screen Keyboard (Anti-Keylogger)",
    deleteKey: "Del",
    clearKey: "Clear",
    loginButton: "Log in",
    registerButton: "Register",
    errors: {
      required: "Please enter both your account and password.",
      usernamePattern: "Account must be 3-30 letters, digits, or underscores.",
      passwordLength: "Password must be at least 6 characters long.",
      usernameTaken: "This account already exists in the Jianghu.",
      network: "Cannot reach the Backend API. Please check that the backend service is running!",
      generic: "Cannot reach the server. Please try again!",
      usernameMin: "Account must be at least 3 characters.",
      usernameChars: "Only letters, digits, or underscores"
    },
    success: {
      login: "Logged in successfully! Moving to character selection...",
      register: "Account created successfully! Moving to character creation..."
    }
  },
  characterSelect: {
    account: "Account",
    server: "Server",
    create: "Create",
    select: "Select character",
    loading: "Loading...",
    noCharacters: "No characters yet",
    newCharacter: "New character",
    gender: "Gender",
    genderMale: "Male",
    genderFemale: "Female",
    factionLabel: "Faction:",
    factionHint: "Your faction decides your home city and your allies on the central battlefield.",
    factions: {
      han: "Han",
      thuc: "Shu",
      nguy: "Wei"
    },
    emptySlot: "(Empty)",
    characterList: "Character list",
    nameLabel: "Name:",
    namePlaceholder: "Enter character name",
    nameHint: "{min}-{max} letters, digits, spaces, hyphens, or underscores.",
    agree: "Confirm",
    createCharacter: "Create character",
    deleteCharacter: "Delete character",
    start: "Start",
    retry: "Retry",
    relogin: "Log in again",
    errors: {
      load: "Could not load the character list.",
      loadRetry: "Could not load the character list. Please try again!",
      sessionExpired: "Your login session has expired or is invalid. Please log in again.",
      nameLength: "Character name must be {min}-{max} characters.",
      create: "Could not create the character. Please try again!",
      delete: "Could not delete the character.",
      selectToDelete: "Please select a character to delete.",
      selectToStart: "Please select or create a character before starting.",
      confirmDelete: 'Are you sure you want to permanently delete "{name}"?'
    },
    notice: {
      created: 'Created character "{name}".',
      deleted: 'Deleted character "{name}".'
    }
  },
  skills: {
    handLeft: "Left click",
    handRight: "Right click",
    leftHandTitle: "Left-click skill (click to choose)",
    rightHandTitle: "Right-click skill (click to choose)",
    keySlotLabel: "Key",
    assignKey: "Assign skill [{key}]",
    picker: {
      eyebrow: "Assign skill",
      title: "Choose a skill for {hand}",
      locked: "Requires level {level}",
      needsBook: "Not learned — study a book"
    },
    mobilePicker: {
      eyebrow: "Assign skill",
      title: "Choose a skill for button {index}",
      empty: "No skill assigned — tap to choose",
      rebind: "Hold to change skill",
      clear: "Clear this button"
    },
    keybind: {
      short: "Keys",
      eyebrow: "Settings",
      title: "Skill hotkeys",
      hint: "Click a key box, then press the key to bind. A key only assigns its skill to the right hand; right-click casts it.",
      press: "Press a key...",
      error: {
        reserved: "That key is reserved by the UI.",
        duplicate: "That key is already bound to another skill.",
        empty: "Invalid key.",
        "invalid-slot": "Invalid skill slot."
      }
    },
    modalTitle: "Martial Arts",
    modalHint: "Skill tree for the equipped weapon. Select a skill for details, then drag it onto hotbar slots 1-9 to bind it to that key. Unlearned skills unlock by studying books dropped by monsters.",
    dragHint: "Drag a skill onto hotbar slots 1-9 to bind it to that number key.",
    bindToKey: "Assign to [{key}]",
    bindLeft: "Assign Left Click",
    bindRight: "Assign Right Click",
    cooldownSec: "{sec}s",
    rangeTag: "Range: {range}",
    dmgTag: "Dmg: {pct}%",
    passiveTag: "Passive",
    regenTag: "Regen {hp} HP/s",
    tree: {
      requires: "Learn {name} first",
      empty: "This weapon has no skills yet.",
      selectHint: "Select a skill tile to see its details."
    },
    kiem: {
      kiemKhi: {
        name: "Sword Qi",
        desc: "Starter sword skill: fire a blade of qi at the target. Every new hero knows it."
      }
    },
    thieuLam: {
      thieuLamTamPhap: {
        name: "Shaolin Internal Art",
        desc: "An always-active Shaolin internal art that restores 2 health per second at no mana cost."
      },
      daiTuDiChuong: {
        name: "Great Sumeru Palm",
        desc: "Ranged palm strike that stuns the target from afar."
      },
      laHanQuyen: {
        name: "Arhat Fist",
        desc: "Rush to the target and unleash a five-second punching flurry; each punch has a 10% chance to stun for 0.6 seconds and splashes damage onto nearby foes."
      },
      laHanTran: {
        name: "Arhat Formation",
        desc: "Protective Buddhist formation that boosts attack power by 10%, movement speed by 20%, and critical rate by 5% for 3 minutes."
      },
      kimCangBatHoai: {
        name: "Vajra Indestructible",
        desc: "Vajra body protection, increasing defense by 30% for 30 seconds. A 卍 seal appears above the head while active."
      },
      nhuLaiThanChuong: {
        name: "Tathagata Divine Palm",
        desc: "Shaolin ultimate: a divine palm descends to strike all nearby foes, stunning them."
      }
    },
    voDang: {
      thieuDuongKiemPhap: {
        name: "Shao Yang Sword Style",
        desc: "Basic Wudang sword technique, agile and precise."
      },
      thaiCucQuyen: {
        name: "Tai Chi Fist",
        desc: "Defensive fist art redirecting force to deliver crushing impact."
      },
      tamThanhKiemPhap: {
        name: "Three Pure Ones Sword",
        desc: "Triple sword qi strikes sweeping through enemy ranks."
      },
      toatHongQuanKhuyet: {
        name: "Purple Cloud Guard",
        desc: "Wudang qi buff increasing attack power by 15% for 3 minutes."
      }
    },
    ngaMy: {
      ngaMyKiemPhap: {
        name: "Emei Sword Arts",
        desc: "Graceful and elegant sword technique dealing continuous damage."
      },
      mongDiepThoiTam: {
        name: "Butterfly Heart Strike",
        desc: "Sword aura fluttering like butterflies directly invading the opponent's vitality."
      },
      tuHangPhoDo: {
        name: "Merciful Salvation",
        desc: "Buddhist light of compassion, instantly restoring 50 HP to self."
      },
      luuThuyKhanhVan: {
        name: "Flowing Cloud Stride",
        desc: "Agile footwork like drifting clouds, increasing movement speed by 25%."
      }
    },
    nguDoc: {
      nguDocTamPhap: {
        name: "Five Poisons Mind Method",
        desc: "Heritage secret technique infusing attacks with deadly venom."
      },
      truyTamDoc: {
        name: "Heart-Piercing Venom",
        desc: "Toxic palm blast penetrating deep into the foe's core."
      },
      vanDocChieuHong: {
        name: "Ten Thousand Poison Gu",
        desc: "Summons a swarm of venomous insects over a wide area."
      },
      uHongPhietAnh: {
        name: "Phantom Ghost Shadow",
        desc: "Ethereal movement enhancing critical hit chance by 10%."
      }
    }
  },
  character: {
    title: "Character",
    helpTitle: "Help",
    closeTitle: "Close (F3 / Esc)",
    hint: "Combat stats are the values the game actually rolls. Drag equipment from the Inventory (F4) onto a slot to wear it, or click/drag a worn slot to take it off.",
    tabEquip: "Equipment",
    tabNews: "News",
    locked: "{label} (locked)",
    notEquipped: "{label} (not equipped)",
    unequipTitle: "{name} (click to remove)",
    points: "Points:",
    nextLevel: "Next level:",
    slots: {
      belt: "Belt",
      bracers: "Bracers",
      secretManual: "Secret manual",
      subManual: "Sub-manual",
      cosHat: "Costume - Hat",
      cosTop: "Costume - Top",
      cosPants: "Costume - Pants",
      mount: "Mount"
    }
  },
  inventory: {
    title: "Inventory",
    helpTitle: "Bag help",
    closeTitle: "Close (Esc)",
    hint: "Click potions or talismans to use them. Drag an item onto the 1–9 bar to bind it to a hotkey; drag a slot off the bar (or right-click it) to unbind. Drag equipment to the Character panel (F3) to wear it. Hover over an item to read its description.",
    equip: "Equip",
    use: "Use",
    useTitle: "{name}",
    weight: "Weight",
    count: "{used}/{total}",
    silver: "Silver",
    copper: "Copper",
    gold: "Gold",
    ngucac: "[ Imperial Vault ]",
    quantity: "Quantity: {qty}",
    equipHint: "Click to equip in the {slot} slot",
    useHint: "Click to use"
  },
  shop: {
    eyebrow: "BIANJING HERB SHOP",
    title: "Herb Shop",
    greeting: "This old man sells elixirs for health and inner force. Take your pick, traveler.",
    balance: "Silver:",
    buy: "Buy",
    result: {
      ok: "Purchase complete — {qty} item(s) added to your bag.",
      coins: "Not enough silver for this item.",
      guest: "Log in and choose a character to trade.",
      offline: "Connect to the server to trade.",
      range: "Move closer to the shopkeeper to trade.",
      error: "The server could not complete the trade. No silver was spent.",
      unknown: "This shop does not sell that item."
    }
  },
  slots: {
    armor: "Armor",
    helmet: "Helmet",
    accessory: "Accessory",
    weapon: "Weapon"
  },
  weapons: {
    kiem: "Sword",
    baoTay: "Gloves",
    dao: "Saber"
  },
  bonus: {
    attack: "Physical attack",
    defense: "Physical defense",
    maxHp: "Health",
    maxMp: "Inner force",
    critRate: "Critical rate",
    accuracy: "Accuracy"
  },
  stats: {
    hp: "Health",
    mp: "Inner force",
    physicalAtk: "Physical attack",
    physicalDef: "Physical defense",
    crit: "Critical chance",
    critDamage: "Critical hit",
    attackSpeed: "Attack speed"
  },
  mobileItems: {
    picker: {
      eyebrow: "Assign item",
      title: "Choose an item for button {index}",
      empty: "No item assigned — tap to choose",
      rebind: "Hold to change item",
      clear: "Clear this button",
      outOfStock: "Out",
      none: "No usable items available."
    }
  },
  item: {
    "kiem-lang-khach": {
      name: "Wanderer's Sword",
      desc: "A plain steel sword for a new wanderer. Only sword skills already studied can be used."
    },
    "bao-tay-lang-khach": {
      name: "Wanderer's Gloves",
      desc: "Steel-lined leather gloves for close combat. Only glove skills already studied can be used."
    },
    "dao-lang-khach": {
      name: "Wanderer's Saber",
      desc: "A broad, heavy saber with high damage. Only saber skills already studied can be used."
    },
    "kim-sang-duoc": {
      name: "Golden Radiance Elixir",
      desc: "A spirit medicine brewed from honeysuckle. Restores +35 Health when drunk."
    },
    "dai-hoan-dan": {
      name: "Great Return Pill",
      desc: "A qi-gathering elixir. Restores +25 Inner force when taken."
    },
    "nu-nhi-hong": {
      name: "Daughter's Red Wine",
      desc: "Wine aged three years in a clay jar. Restores +50 Health and +30 Inner force."
    },
    "hoi-thanh-phu": {
      name: "Return City Talisman",
      desc: "A spatial talisman that returns the traveler to Bianjing."
    },
    "lenh-bai-gm": {
      name: "GM Imperial Token",
      desc: "Supreme authority token of the GM. Opens admin control panel to grant levels, vitals, potions and map travel."
    },
    "lenh-bai-test": {
      name: "Test Imperial Token",
      desc: "A test-only token granted while test mode is on. Opens the same admin control panel as the GM token."
    },
    "ao-lang-khach": {
      name: "Wanderer's Blue Robe",
      desc: "A cross-collar wuxia robe woven from lightweight fabric, ideal for traveling the martial world."
    },
    "non-lang-khach": {
      name: "Wanderer's Bamboo Hat",
      desc: "A conical bamboo hat crafted by borderland artisans. Protects against sun and rain on the perilous journey."
    },
    "quan-lang-khach": {
      name: "Wanderer's Trousers",
      desc: "Sturdy travel trousers wrapped with leg gaiters, designed for light footwork and wandering the rivers and lakes."
    }
  },
  gm: {
    title: "GM Command Panel",
    hint: "Online character administration. Actions are synchronized authoritative with the server.",
    tabs: {
      level: "Level",
      potions: "Potions",
      equipment: "Costumes",
      teleport: "Teleport",
      utility: "Utility"
    },
    level: {
      title: "Level & Experience",
      quickLevel: "Quick Level Milestones",
      addLevel: "Advance Level",
      addExp: "Gain Experience",
      customLevel: "Custom Level ({min} - {max})",
      setLevelBtn: "Set Level",
      successSet: "Level set successfully!"
    },
    potions: {
      title: "Recovery & Potions",
      healFull: "Full Restore HP & MP",
      receiveHp: "Receive 99x Golden Radiance Elixir",
      receiveMp: "Receive 99x Great Return Pill",
      receiveWine: "Receive 99x Daughter's Red Wine",
      receiveAll: "Receive All Potions (x99)",
      fullHealed: "Fully restored Health and Inner force!",
      potionsReceived: "Received potions to bag."
    },
    equipment: {
      title: "Wanderer Costumes",
      costumeSet: "Wanderer Costume Set (Hat, Robe, Trousers)",
      costumeDesc: "Wanderer martial outfit (Bamboo Hat / Female Veiled Hat, Blue Robe, Trousers & Boots).",
      getHat: "Wanderer Hat",
      getRobe: "Wanderer Robe",
      getPants: "Wanderer Trousers",
      quickActions: "Quick Actions",
      receiveFullSet: "Receive Full Set",
      equipFullSet: "Equip Full Set Now"
    },
    teleport: {
      title: "Talismans & Teleport",
      receiveScroll: "Receive 99x Return City Talisman",
      toMarket: "Teleport: Bianjing City",
      toDongMonThanh: "Teleport: East Gate Suburb",
      toSpawn: "Recall to Spawn Point"
    },
    utility: {
      title: "Silver & Utility",
      addCoins1k: "Receive 1,000 Silver",
      addCoins10k: "Receive 10,000 Silver (100 Gold)",
      addCoins100k: "Receive 100,000 Silver",
      godMode: "God Mode (Invulnerable)",
      godModeOn: "God Mode: [ACTIVE]",
      godModeOff: "Enable God Mode",
      speedBuff: "Speed Boost (x2)",
      speedNormal: "Normal Speed"
    }
  }
};
