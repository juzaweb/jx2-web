export default {
  app: {
    title: "Jianghu — HTML5 RPG (VL2 Edition)",
    defaultPlayerName: "Wanderer",
    serverFallback: "Jianghu",
    confirmReset: "Are you sure you want to erase your saved progress and start over?",
    confirmLogout: "Are you sure you want to log out of your account?",
    joinLog: "{name} has joined {server}!",
    log: {
      welcome: "Welcome to Bianjing, honored warrior.",
      near: "Wanderer: The Jianghu is treacherous. Take care!",
      guide: "Use WASD to move, keys 1/2 to drink potions, Mouse/Space to attack, Q for sword aura."
    }
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
  npc: {
    "duoc-diem": {
      name: "Apothecary Owner",
      dialogue: 'Apothecary Owner: "Welcome to the Bianjing Apothecary, warrior! My shop specializes in premium Golden Radiance Elixirs and Great Return Pills to heal wounds and restore qi."'
    },
    "bach-tien-sinh": {
      name: "Mr. Bai",
      dialogue: 'Mr. Bai: "The Jianghu is dangerous and the human heart is hard to read. While traveling through Bianjing, young hero, guard your true heart and diligently cultivate your martial arts!"'
    },
    "thuong-nhan-bao-ruong": {
      name: "Treasure Chest Merchant",
      dialogue: 'Treasure Chest Merchant: "Treasure chests hiding rare wonders are scattered across the world. If you have a golden key, young hero, bring it here to trade for a peerless divine weapon!"'
    },
    "dai-su-hoat-dong": {
      name: "Event Ambassador",
      dialogue: 'Event Ambassador: "Welcome, heroes, to Bianjing! Join the daily Jianghu events to earn honor and precious rewards."'
    },
    "chan-tu-don": {
      name: "Zhen Zidan",
      dialogue: 'Zhen Zidan: "Martial learning knows no bounds! Practicing fists and kicks every day is the foundation for ruling the martial world."'
    },
    "van-su-thong": {
      name: "Wanshi Tong",
      dialogue: 'Wanshi Tong: "The affairs of the world shift like wind and clouds, and nothing escapes this old man\'s knowledge. Would you like to inquire about news from the martial world, young hero?"'
    }
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
    mapTitle: "M: Open the full city map"
  },
  cityMap: {
    eyebrow: "CITY OVERVIEW",
    title: "Bianjing Map",
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
    channel: "[ Local ] ▼"
  },
  hotbar: {
    slotTitle: "Key [{key}]: {name}",
    skillSlotTitle: "Key [8] or [Q]: Sword Aura ultimate",
    attackTitle: "Left Click / Space: Limitless Sword Art",
    skillTitle: "Right Click / Key Q: Eight Desolations Sword Aura",
    leftClick: "Left Click",
    rightClickQ: "Right Click [Q]",
    martialName: "Crane-Character Brocade",
    martialSub: "Milky Way Secret Tome",
    portraitTitle: "Wudang Wanderer",
    portraitAlt: "Wanderer",
    coins: "SILVER",
    character: "Character",
    inventory: "Inventory",
    help: "Guide",
    pkTitle: "Toggle PK flag (Key P)",
    pkOn: "PK",
    pkOff: "Peace"
  },
  help: {
    eyebrow: "TRAVELER'S HANDBOOK",
    title: "Beginner's Guide",
    move: "Movement: Left-click the map (or hold the mouse to follow the cursor), or use W, A, S, D / the arrow keys.",
    combat: "Combat: Press Space to strike, or left-click a monster directly to attack it.",
    skill: "Sword Aura ultimate: Press Q or key 8 to unleash an area blast of inner force (costs 15 MP).",
    potions: "Quick potions:\n• Key 1: Golden Radiance Elixir (+35 HP).\n• Key 2: Great Return Pill (+25 MP).\n• Key 3: Daughter's Red Wine (+50 HP & +30 MP).",
    loot: "Bag & money: Defeat Grey Wolves to gain experience, silver, and glowing jade pouches to pick up.",
    save: "Saving: The system auto-saves every 15 seconds.",
    map: "Map: Press Tab to enlarge the minimap 5x, press M to open the full Bianjing city map.",
    pause: "Pause: Press Esc or open the Guide to pause the game.",
    resume: "I UNDERSTAND",
    reset: "START OVER (RESET PROGRESS)"
  },
  login: {
    brandTitle: "Legends of the Martial World II",
    brandSubtitle: "HEROES RISE",
    serverLoggedIn: "Logged-in server",
    closeList: "Close list",
    chooseServer: "Choose another server",
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
    tags: {
      recommended: "Recommended",
      new: "New",
      crowded: "Busy",
      normal: "Normal"
    },
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
    sect: "Sect",
    sectThieuLam: "Shaolin",
    sectNgaMy: "Nga My",
    sectVoDang: "Wudang",
    sectNguDoc: "Ngu Doc",
    emptySlot: "(Empty)",
    characterList: "Character list",
    nameLabel: "Name:",
    namePlaceholder: "Enter character name",
    nameHint: "{min}-{max} letters, digits, spaces, hyphens, or underscores.",
    agree: "Confirm",
    createCharacter: "Create character",
    deleteCharacter: "Delete character",
    start: "Start",
    errors: {
      load: "Could not load the character list.",
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
  character: {
    title: "Character",
    helpTitle: "Help",
    closeTitle: "Close (F3 / Esc)",
    hint: "Combat stats are derived from the character level. Drag equipment from the Inventory (F4) onto a slot to wear it, or click/drag a worn slot to take it off.",
    tabEquip: "Equipment",
    tabNews: "News",
    locked: "{label} (locked)",
    notEquipped: "{label} (not equipped)",
    unequipTitle: "{name} (click to remove)",
    potential: "Potential",
    points: "Points:",
    nextLevel: "Next level:",
    playerAlt: "Character",
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
    hint: "Click potions or talismans to use them. Drag equipment to the Character panel (F3) to wear it. Hover over an item to read its description.",
    equip: "Equip",
    use: "Use",
    useTitle: "{name}",
    weight: "Weight",
    count: "{used}/{total}",
    silver: "Silver",
    gold: "Gold Ingot",
    jade: "Fairy Jade",
    kimPhieu: "Gold notes:",
    ngucac: "[ Imperial Vault ]",
    quantity: "Quantity: {qty}",
    equipHint: "Click to equip in the {slot} slot",
    useHint: "Click to use"
  },
  slots: {
    armor: "Armor",
    helmet: "Helmet",
    accessory: "Accessory",
    weapon: "Weapon"
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
    strength: "Strength",
    agility: "Agility",
    internal: "Inner power",
    bone: "Bone",
    flexibility: "Flexibility",
    physicalAtk: "Physical attack",
    chiAtk: "Chi strike",
    damage: "Damage",
    accuracy: "Accuracy",
    physicalDef: "Physical defense",
    magicDef: "Inner defense",
    dodge: "Dodge",
    crit: "Critical",
    burst: "Burst points",
    burstHard: "Hard burst",
    woundRate: "Wound rate",
    critResist: "Crit resist",
    cast: "Cast speed",
    attackSpeed: "Attack speed",
    moveSpeed: "Move speed"
  },
  item: {
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
    "ho-lo-tuu": {
      name: "Gourd Wine",
      desc: "A traveler's wine gourd with a rich, lingering aroma."
    },
    "lenh-bai": {
      name: "Sect Token",
      desc: "A Wudang token proving the bearer is a disciple."
    },
    "thiet-trao": {
      name: "Iron Claw",
      desc: "A vicious close-combat weapon."
    },
    "hac-ung-kiem": {
      name: "Black Eagle Sword",
      desc: "A dark iron sword of unmatched sharpness."
    },
    "bi-kip-vo-cong": {
      name: "Martial Arts Manual",
      desc: "An ancient book recording cultivation methods."
    },
    "thien-ha-mat-tich": {
      name: "Milky Way Secret Tome",
      desc: "A supreme secret manual of the Milky Way sect."
    },
    "cam-y-bao": {
      name: "Brocade Robe",
      desc: "A silk robe embroidered with gold thread that boosts defense."
    },
    "thanh-long-dao": {
      name: "Azure Dragon Blade",
      desc: "A great saber carved with an azure dragon, mighty and imposing."
    },
    "ngoc-bo-dao": {
      name: "Jade Pendant",
      desc: "An heirloom jade pendant that radiates a faint spiritual aura."
    },
    "huyen-kim-thach": {
      name: "Phantom Gold Ore",
      desc: "A precious ore used to forge equipment."
    },
    "tui-bac": {
      name: "Silver Pouch",
      desc: "A pouch of silver taken from wild beasts."
    },
    "duoc-vuong-lo": {
      name: "Healer's Dew",
      desc: "A healing spirit liquid distilled from a thousand herbs."
    },
    "than-bi-hop": {
      name: "Mysterious Box",
      desc: "An unopened treasure box that hides wondrous relics."
    },
    "yeu-dan": {
      name: "Beast Core",
      desc: "The inner core of a demon beast, essence of spiritual qi."
    },
    "huyet-chien-giap": {
      name: "Blood Battle Armor",
      desc: "Battle armor stained with blood offering extreme defense."
    },
    "bach-nien-linh-chi": {
      name: "Century Lingzhi",
      desc: "A hundred-year lingzhi that greatly nourishes vital energy."
    },
    "tu-kim-ho-lo": {
      name: "Purple Gold Gourd",
      desc: "A purple-gold gourd that stores restorative elixirs."
    },
    "ngoc-tinh-binh": {
      name: "Jade Cleansing Vase",
      desc: "A jade vase that purifies qi and clears the mind."
    },
    "phuong-vu-bao": {
      name: "Phoenix Feather Robe",
      desc: "A robe embroidered with phoenix feathers, rare and noble."
    },
    "phach-dao": {
      name: "Soul Saber",
      desc: "A light saber with an extremely fast draw."
    },
    "tu-tinh-nhan": {
      name: "Four-Star Ring",
      desc: "A ring inlaid with four spirit stones."
    },
    "linh-duong": {
      name: "Wild Meat",
      desc: "Fresh beast meat used for restorative cooking."
    },
    "tang-kinh-do": {
      name: "Scripture Vault Map",
      desc: "A secret tunnel map leading to the scripture vault."
    },
    "ngoc-nhan": {
      name: "Jade Ring",
      desc: "A simple jade ring that still holds spiritual qi."
    },
    "hoang-kim-huyen-thiet": {
      name: "Dark Iron Ingot",
      desc: "Dark iron metal used to craft superior weapons."
    },
    "huyet-bo-dao": {
      name: "Blood Peach Elixir",
      desc: "A blood-red spirit medicine that heals wounds."
    },
    "tu-kim-quan": {
      name: "Purple Gold Crown",
      desc: "A jade-studded crown that boosts defense and accuracy."
    }
  }
};
