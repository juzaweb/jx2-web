import * as Phaser from "phaser";
import { WorldManager } from "./marketWorld.js";
import { WORLD_CONFIG } from "./worldConfig.js";
import { WORLD_POSITION_SCALE, WORLD_TILE } from "./worldConfig.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled, playTone } from "./combat.js";
import { UIBridgeAdapter } from "./uiBridgeAdapter.js";
import { StorageManager } from "./storage.js";
import { bridge, EVENTS } from "./bridge.js";
import { getQuantities, getQuantity, consumeQuantity, addQuantity, replaceQuantities, getItemById, QUICK_ITEMS } from "./items.js";
import { loadQuickSlots } from "./quickSlots.js";
import { planEquip, equippedIn } from "./equipment.js";
import { NetworkClient } from "./networkClient.js";
import { RemotePlayerManager } from "./remotePlayerManager.js";
import { readSession } from "./session.js";
import { shouldReportPosition } from "./positionSync.js";
import { InventorySyncer } from "./inventorySync.js";
import { apiClient } from "./apiClient.js";
import { toIso, fromIso, isoDepth } from "./isoProjection.js";
import { PVP_ATTACK_RANGE } from "./pvp.js";
import { MARKET_BOUNDS, MARKET_NPCS, MARKET_SPAWN } from "./marketLayout.js";
import { SHOP_BUILDINGS } from "./marketBuildings.js";
import { VEGETATION_SPRITES } from "./marketProps.js";
import { HERO_BODY, HERO_BODY_TEXTURES } from "./heroBody.js";
import {
  NPC_DUOC,
  createPharmacyNpc,
  isInTalkRange,
  isPointOnNpc,
  npcApproachPoint
} from "./npc.js";
import { ShopFlow } from "./shopFlow.js";

/** Ground tiles the gameplay camera shows across the screen width. */
const CAMERA_TILES = 15;

/** Map descriptor shared with the minimap / full-map canvas. */
const MARKET_WORLD_CONFIG = {
  ...WORLD_CONFIG,
  width: MARKET_BOUNDS.x1 - MARKET_BOUNDS.x0,
  height: MARKET_BOUNDS.y1 - MARKET_BOUNDS.y0,
  cityBounds: MARKET_BOUNDS
};
import { normalizeGender } from "./gender.js";
import { normalizeKey } from "./keybinds.js";
import { loadSkillLoadout } from "./skillLoadout.js";
import { normalizeSect, skillsForSect } from "./skills.js";
import { ensureHeroBodyTexture, ensureSectVfx } from "./lazyAssets.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
    this.isPaused = false;
    this.unsubscribers = [];
    /** Server sync for the active character's bag; built in create(). */
    this.inventorySync = null;
  }

  preload() {
    // Only the active character's walk sheet is needed at boot; the other gender
    // is queued the first time the player switches (see ensureHeroBodyTexture).
    const gender = normalizeGender(readSession()?.activeCharacter?.gender);
    const bodySheet = HERO_BODY_TEXTURES[gender];
    if (!this.textures.exists(bodySheet.key)) {
      this.load.spritesheet(bodySheet.key, bodySheet.url, {
        frameWidth: HERO_BODY.frameWidth,
        frameHeight: HERO_BODY.frameHeight
      });
    }
    this.load.image("ground-bricks", "/gach-tile.webp");
    // Second paving style, used for the walkway that threads the market square.
    this.load.image("ground-walkway", "/gach-seamless.webp");
    for (const { textureKey, url } of SHOP_BUILDINGS) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, url);
      }
    }
    if (!this.textures.exists(NPC_DUOC.textureKey)) {
      this.load.spritesheet(NPC_DUOC.textureKey, NPC_DUOC.url, {
        frameWidth: NPC_DUOC.frameWidth,
        frameHeight: NPC_DUOC.frameHeight
      });
    }
    for (const { key, url } of Object.values(VEGETATION_SPRITES)) {
      this.load.image(key, url);
    }
    // Skill VFX sheets are intentionally not loaded here: they are pulled in on
    // demand once the hero's sect is known (see ensureSectVfx).
  }

  create() {
    // Disable browser right click context menu on game canvas
    this.input.mouse.disableContextMenu();

    // Generate reusable dot texture for physics colliders
    if (!this.textures.exists("entity-dot")) {
      const textureGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      textureGraphics.fillStyle(0xffffff, 1);
      textureGraphics.fillRect(0, 0, 4, 4);
      textureGraphics.generateTexture("entity-dot", 4, 4);
      textureGraphics.destroy();
    }

    // The playable map is exactly the brick-paved area. Both the camera and the
    // physics world are clamped to that rectangle so the player can never walk
    // out onto the empty grass backdrop.
    const mapW = MARKET_BOUNDS.x1 - MARKET_BOUNDS.x0;
    const mapH = MARKET_BOUNDS.y1 - MARKET_BOUNDS.y0;
    this.cameras.main.setBounds(MARKET_BOUNDS.x0, MARKET_BOUNDS.y0, mapW, mapH);
    this.physics.world.setBounds(MARKET_BOUNDS.x0, MARKET_BOUNDS.y0, mapW, mapH);

    // Initialize subsystems
    this.worldManager = new WorldManager(this);
    this.worldManager.create();

    // Friendly shopkeepers (currently the Dược Điểm herbalist). Their bodies are
    // added to the same static group as the buildings so the hero cannot walk
    // through them.
    this.npcs = MARKET_NPCS.map((def) => createPharmacyNpc(this, def));
    for (const npc of MARKET_NPCS) {
      this.worldManager.addBody(npc.x, npc.y, 46, 34);
    }
    this.pendingNpc = null;

    // Seed the name from the cached session; App re-emits SET_PLAYER_NAME once it
    // has refreshed the profile from the backend.
    let initialName = "Lãng Khách";
    const session = readSession();
    initialName =
      session?.activeCharacter?.name ||
      session?.user?.displayName ||
      session?.user?.username ||
      initialName;
    const initialGender = normalizeGender(session?.activeCharacter?.gender);

    this.player = new Player(
      this,
      MARKET_SPAWN.x,
      MARKET_SPAWN.y,
      initialName,
      initialGender
    );
    this.player.setSect(normalizeSect(session?.activeCharacter?.sect));
    // Pull this sect's skill art in the background instead of every VFX sheet.
    // Sessions without a chosen character (login screen, guests) download none.
    if (session?.activeCharacter?.sect) {
      ensureSectVfx(this, skillsForSect(session.activeCharacter.sect));
    }
    this.enemyManager = new EnemyManager(this);
    // Biện Kinh is a safe city, so the offline roster starts empty; the server
    // populates enemies for maps that have them.
    this.enemyManager.create();

    // Static physics collisions between world obstacles and entities
    const obstacles = this.worldManager.getObstacles();
    if (obstacles) {
      this.physics.add.collider(this.player.sprite, obstacles);
      if (this.enemyManager?.group) {
        this.physics.add.collider(this.enemyManager.group, obstacles);
      }
    }

    // UI Bridge Adapter to communicate with React components
    this.uiBridge = new UIBridgeAdapter();

    // Per-character bag sync; the owner (character id) is resolved from the session
    // on every call so switching characters retargets it.
    this.inventorySync = new InventorySyncer({
      api: apiClient,
      getOwnerId: () => readSession()?.activeCharacter?.id || null,
      getQuantities,
      setQuantities: replaceQuantities,
      onAdopt: () => {
        this.uiBridge.updateInventory();
        this.saveGame(false);
      },
      onError: (error) => {
        console.warn("[Inventory] Đồng bộ hành trang lên máy chủ thất bại:", error?.message || error);
      }
    });

    // Combat system with state change hook for auto-saving
    this.combat = new CombatSystem(
      this,
      this.player,
      this.enemyManager,
      this.uiBridge,
      () => this.saveGame(false)
    );

    // Load saved game if exists
    this.savedData = StorageManager.load();
    if (this.savedData) {
      if (this.savedData.stats) {
        this.player.loadStats(this.savedData.stats);
      }
      if (this.savedData.position && typeof this.savedData.position.x === "number") {
        const { x, y } = this.savedData.position;
        const insideMarket =
          x >= MARKET_BOUNDS.x0 && x <= MARKET_BOUNDS.x1 && y >= MARKET_BOUNDS.y0 && y <= MARKET_BOUNDS.y1;
        if (insideMarket) this.player.setPosition(x, y);
      }
      if (this.savedData.questRewarded !== undefined) {
        this.uiBridge.setQuestRewarded(this.savedData.questRewarded);
      }
      if (this.savedData.audioEnabled !== undefined) {
        setAudioEnabled(this.savedData.audioEnabled);
        this.uiBridge.updateSoundButton(this.savedData.audioEnabled);
      }
    }

    // Camera follows the isometric visual (the sprite stays in ground space)
    this.cameras.main.startFollow(this.player.visual, true, 0.08, 0.08);
    this.updateCameraZoom();

    // Scale resize handler
    this.scale.on("resize", () => this.updateCameraZoom());

    // Real-time Multiplayer: Remote Player Manager & WebSocket Network Client
    this.remotePlayerManager = new RemotePlayerManager(this, this.uiBridge);
    this.networkClient = new NetworkClient();
    this.shopFlow = new ShopFlow({
      player: this.player,
      uiBridge: this.uiBridge,
      networkClient: this.networkClient,
      saveGame: (showFeedback) => this.saveGame(showFeedback)
    });

    this.networkClient.on("init_world", (payload) => {
      this.remotePlayerManager.handleInitWorld(payload);
      this.enemyManager.applyServerSnapshot(payload?.enemies);
    });

    this.networkClient.on("player_joined", (payload) => {
      this.remotePlayerManager.handlePlayerJoined(payload);
    });

    this.networkClient.on("player_moved", (payload) => {
      this.remotePlayerManager.handlePlayerMoved(payload);
    });

    this.networkClient.on("player_attacked", (payload) => {
      this.remotePlayerManager.handlePlayerAttacked(payload);
    });

    this.networkClient.on("player_pk", (payload) => {
      this.remotePlayerManager.handlePlayerPk(payload);
    });

    this.networkClient.on("player_equipment", (payload) => {
      this.remotePlayerManager.handlePlayerEquipment(payload);
    });

    // Server-authoritative health. The server owns every player's HP and streams
    // the result here, so the client only renders it (never decides it).
    this.networkClient.on("player_hp", (payload) => {
      this.handlePlayerHp(payload);
    });

    // Server-authoritative MP, mirroring the HP model.
    this.networkClient.on("player_mp", (payload) => {
      this.handlePlayerMp(payload);
    });

    this.networkClient.on("player_defeated", (payload) => {
      this.handlePlayerDefeated(payload);
    });

    this.networkClient.on("player_left", (payload) => {
      this.remotePlayerManager.handlePlayerLeft(payload);
    });

    this.networkClient.on("player_chat", (payload) => {
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog(`${payload.sender}: ${payload.text}`, payload.channel || "near");
      }
    });

    // Server-authoritative enemy state: damage, movement and respawn are shared
    this.networkClient.on("enemy_hit", (payload) => {
      this.enemyManager.applyEnemyState(payload);
    });

    this.networkClient.on("enemy_moved", (payload) => {
      this.enemyManager.applyServerSnapshot(payload?.enemies);
    });

    this.networkClient.on("enemy_respawned", (payload) => {
      this.enemyManager.applyEnemyState(payload);
    });

    // Kill rewards (EXP, bạc, drops) are rolled by the server on the killing blow
    this.networkClient.on("enemy_reward", (payload) => {
      this.combat.applyServerReward(payload);
    });

    // The server owns progression (level, EXP, coins, kills); the client mirrors it.
    this.networkClient.on("player_progress", (payload) => {
      this.combat.applyServerProgress(payload);
    });

    // A server-validated shop purchase. The server has already debited silver
    // and written the item to this character's bag; mirror the item locally.
    this.networkClient.on("shop_result", (payload) => {
      this.shopFlow.handleResult(payload);
    });

    this.networkClient.on("connected", () => {
      this.sendNetworkJoin();
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog("Đã kết nối máy chủ Giang Hồ — Trực tuyến.", "system");
      }
    });

    this.networkClient.on("disconnected", () => {
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog("Mất kết nối máy chủ. Đang tự động kết nối lại...", "system");
      }
    });

    this.networkClient.connect();
    this.bindSceneTeardown();

    this.isPointerMoving = false;

    // Mouse input handlers (Left click: Move to destination, Right click: disabled)
    this.input.on("pointerdown", (pointer) => {
      if (!this.started || this.isPaused) return;

      // Do not handle when clicking on interactive HUD elements or React overlays
      const target = pointer.event.target;
      if (target?.closest?.(".metal-card, .top-left-panel, .bottom-dock, .mobile-controls, button, input, .overlay")) {
        return;
      }

      // Ignore right mouse button entirely
      if (pointer.rightButtonDown() || pointer.button === 2) return;

      const ground = fromIso(pointer.worldX, pointer.worldY);
      const worldX = ground.x;
      const worldY = ground.y;

      // Any click re-targets the hero, so a pending NPC approach is cancelled
      // unless this click selects one again below.
      this.pendingNpc = null;

      // Check if clicking directly on an NPC (walk towards NPC)
      const clickedNpc = (this.npcs || []).find((npc) => isPointOnNpc(npc, worldX, worldY));
      if (clickedNpc) {
        const approach = npcApproachPoint(clickedNpc);
        this.pendingNpc = clickedNpc;
        this.player.moveTo(approach.x, approach.y);
        this.showClickIndicator(clickedNpc.gx, clickedNpc.gy, 0x9be58b);
        return;
      }

      // Left click on terrain, enemies or other players: move to destination
      this.isPointerMoving = true;
      this.combat.cancelPendingCast();
      this.player.moveTo(worldX, worldY);
      this.showClickIndicator(worldX, worldY, 0xffdd59);
    });

    // Hold-to-move continuous cursor tracking
    this.input.on("pointermove", (pointer) => {
      if (
        !this.started ||
        this.isPaused ||
        !this.isPointerMoving ||
        !pointer.isDown ||
        pointer.rightButtonDown() ||
        pointer.button === 2
      ) {
        return;
      }

      const target = pointer.event.target;
      if (target?.closest?.(".metal-card, .top-left-panel, .bottom-dock, .mobile-controls, button, input, .overlay")) {
        return;
      }

      const ground = fromIso(pointer.worldX, pointer.worldY);
      this.combat.cancelPendingCast();
      this.pendingNpc = null;
      this.player.moveTo(ground.x, ground.y);
    });

    this.input.on("pointerup", () => {
      this.isPointerMoving = false;
    });

    // Allow standard typing in HTML form inputs (e.g. login form, chat)
    this.input.keyboard.preventDefault = false;
    const isTyping = () => {
      if (typeof document === "undefined") return false;
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        !!active.isContentEditable ||
        active.getAttribute?.("contenteditable") === "true"
      );
    };
    this.isTyping = isTyping;

    // Skill hotkeys U, I, O, P trigger direct casting.
    this.skillLoadout = loadSkillLoadout(readSession()?.activeCharacter?.id);
    this.quickSlots = loadQuickSlots(readSession()?.activeCharacter?.id);
    this.combat.setSkillLoadout(this.skillLoadout);
    this.bindSkillKeys();

    // Prevent default context menu on right click
    this.contextMenuHandler = (event) => {
      if (this.started) event.preventDefault();
    };
    window.addEventListener("contextmenu", this.contextMenuHandler);
    this.events.once("shutdown", () => {
      window.removeEventListener("contextmenu", this.contextMenuHandler);
    });

    // Number hotkeys 1-9 trigger quick slot items.
    const numberKeyNames = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    numberKeyNames.forEach((keyName, idx) => {
      const slotNum = idx + 1;
      this.input.keyboard.on(`keydown-${keyName}`, () => {
        if (!isTyping() && this.started && !this.isPaused) this.useItem(slotNum);
      });
    });

    // Listen to React UI Actions via Game Bridge
    this.unsubscribers.push(
      bridge.on(EVENTS.ACTION_START, () => this.startGame()),
      bridge.on(EVENTS.ACTION_ATTACK, () => {
        if (this.started && !this.isPaused) this.combat.performAttack();
      }),
      bridge.on(EVENTS.ACTION_SKILL, () => {
        if (this.started && !this.isPaused) this.combat.castSelectedSkill();
      }),
      bridge.on(EVENTS.ACTION_EQUIP_SKILL, ({ hand, key, slot } = {}) => {
        if (this.started) {
          const slotKey = key || (hand === "left" ? "u" : hand === "right" ? "i" : hand);
          if (["u", "i", "o", "p"].includes(slotKey)) {
            this.skillLoadout = { ...this.skillLoadout, [slotKey]: slot };
            this.combat.setSkillLoadout(this.skillLoadout);
          } else {
            this.combat.equipSkill(hand, slot);
          }
        }
      }),
      bridge.on(EVENTS.SET_SKILL_LOADOUT, (loadout = {}) => {
        if (this.started && loadout) {
          this.skillLoadout = { ...this.skillLoadout, ...loadout };
          this.combat.setSkillLoadout(this.skillLoadout);
        }
      }),
      bridge.on(EVENTS.SET_QUICK_SLOTS, (quickSlots = {}) => {
        if (this.started && quickSlots) {
          this.quickSlots = { ...this.quickSlots, ...quickSlots };
        }
      }),
      bridge.on(EVENTS.SET_PLAYER_SECT, (sect) => {
        this.player?.setSect(normalizeSect(sect));
        if (sect) ensureSectVfx(this, skillsForSect(sect));
      }),
      bridge.on(EVENTS.ACTION_USE_POTION, (slot) => {
        if (this.started && !this.isPaused) this.useItem(slot);
      }),
      bridge.on(EVENTS.ACTION_BUY_ITEM, ({ itemId, qty } = {}) => {
        if (this.started) this.shopFlow.buy(itemId, qty);
      }),
      bridge.on(EVENTS.ACTION_EQUIP_ITEM, (itemId) => this.equipItem(itemId)),
      bridge.on(EVENTS.ACTION_UNEQUIP_SLOT, (slot) => this.unequipSlot(slot)),
      bridge.on(EVENTS.ACTION_MOVE, (direction) => {
        if (!this.isPaused) {
          this.combat.cancelPendingCast();
          this.pendingNpc = null;
          this.player.setTouchDirection(direction);
        }
      }),
      bridge.on(EVENTS.ACTION_SAVE, () => this.saveGame(true)),
      bridge.on(EVENTS.ACTION_RESET, () => this.resetGame()),
      bridge.on(EVENTS.ACTION_TOGGLE_AUDIO, () => {
        const isEnabled = toggleAudio();
        this.uiBridge.updateSoundButton(isEnabled);
        this.saveGame(false);
      }),
      bridge.on(EVENTS.ACTION_SET_PAUSED, (paused) => this.setPaused(paused)),
      bridge.on(EVENTS.ACTION_TOGGLE_PK, () => this.togglePk()),
      bridge.on(EVENTS.SET_PLAYER_NAME, (name) => {
        if (this.player) {
          this.player.setName(name);
          this.sendNetworkJoin();
        }
      }),
      bridge.on(EVENTS.SET_PLAYER_GENDER, (gender) => {
        const next = normalizeGender(gender);
        if (ensureHeroBodyTexture(this, next)) {
          this.player?.setGender(next);
          return;
        }
        // Sheet still downloading: keep the current look, then swap it in.
        this.load.once("complete", () => this.player?.setGender(next));
      }),
      bridge.on(EVENTS.ACTION_CHAT, (payload) => {
        if (this.networkClient?.isConnected) {
          this.networkClient.sendChat(payload);
        }
      })
    );

    // Enemy respawn loop (offline only — online, the server owns the respawn clock)
    this.spawnTimer = this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => {
        if (this.started && !this.isPaused && !this.networkClient?.isConnected) {
          this.enemyManager.respawnEnemies();
        }
      }
    });

    // Periodic auto-save timer (every 15s while active)
    this.autoSaveTimer = this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => {
        if (this.started && !this.isPaused) {
          this.saveGame(false);
        }
      }
    });

    // Save on window close / page leave
    this.unloadHandler = () => {
      if (this.started) {
        this.saveGame(false);
      }
    };
    window.addEventListener("beforeunload", this.unloadHandler);

    // Initial Stats emit to React
    this.uiBridge.updateHud(this.player.stats);
    this.uiBridge.drawMinimap(
      this.player,
      this.enemyManager.getAll(),
      MARKET_WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );
    this.uiBridge.drawCityMap(
      this.player,
      this.enemyManager.getAll(),
      MARKET_WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );

    // Auto-start game immediately without start modal
    this.startGame();
  }

  useItem(slot) {
    if (!this.player || !this.started) return;

    const quickSlots = this.quickSlots || loadQuickSlots(readSession()?.activeCharacter?.id);
    const itemId = quickSlots?.[slot];
    if (!itemId) return;

    const item = getItemById(itemId);
    if (!item) return;

    if (getQuantity(itemId) <= 0) {
      this.uiBridge.addLog(`Hành trang đã hết ${item.name || itemId}.`, "guide");
      return;
    }

    if (item.slot) {
      this.equipItem(itemId);
      return;
    }

    if (!this.applyConsumableEffect(itemId)) return;

    const { ok } = consumeQuantity(itemId, 1);
    if (!ok) return;

    this.onInventoryChanged();
  }

  /**
   * Run the effect for a hotbar consumable slot or item id.
   * @param {number|string} slotOrItemId
   * @returns {boolean} whether the item was actually consumed by the player
   */
  applyItemEffect(slotOrItemId) {
    let itemId = slotOrItemId;
    if (typeof slotOrItemId === "number") {
      const quickSlots = this.quickSlots || loadQuickSlots(readSession()?.activeCharacter?.id);
      itemId = quickSlots?.[slotOrItemId];
    }
    return this.applyConsumableEffect(itemId);
  }

  applyConsumableEffect(itemId) {
    if (!itemId) return false;

    if (itemId === "kim-sang-duoc") {
      // Kim Sáng Dược (+35 HP)
      if (this.player.stats.hp >= this.player.stats.maxHp) {
        this.uiBridge.addLog("Sinh lực đã đầy, không cần dùng Kim Sáng Dược.", "guide");
        return false;
      }
      const healed = this.player.heal(35);
      // The server owns HP, so mirror the heal into the authoritative pool too.
      this.networkClient?.sendHeal?.({ amount: 35 });
      this.combat.showFloatText(this.player.x, this.player.y - 68, `+${healed} HP`, "#69db7c");
      playTone(520, 0.12, "triangle", 0.03);
      this.uiBridge.addLog(`Đã dùng Kim Sáng Dược: hồi phục ${healed} HP.`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      return true;
    }

    if (itemId === "dai-hoan-dan") {
      // Đại Hoàn Đan (+25 MP)
      if (this.player.stats.mp >= this.player.stats.maxMp) {
        this.uiBridge.addLog("Nội lực đã tràn đầy, không cần dùng Đại Hoàn Đan.", "guide");
        return false;
      }
      const restored = this.player.restoreMp(25);
      // The server owns MP, so mirror the restore into the authoritative pool too.
      this.networkClient?.sendRestoreMp?.({ amount: 25 });
      this.combat.showFloatText(this.player.x, this.player.y - 68, `+${restored} MP`, "#74c0fc");
      playTone(580, 0.12, "sine", 0.03);
      this.uiBridge.addLog(`Đã dùng Đại Hoàn Đan: hồi phục ${restored} MP.`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      return true;
    }

    if (itemId === "nu-nhi-hong") {
      // Nữ Nhi Hồng (+50 HP & +30 MP)
      if (
        this.player.stats.hp >= this.player.stats.maxHp &&
        this.player.stats.mp >= this.player.stats.maxMp
      ) {
        this.uiBridge.addLog("Sinh lực và nội lực đều đã đầy, không cần dùng Nữ Nhi Hồng.", "guide");
        return false;
      }
      const healed = this.player.heal(50);
      const restored = this.player.restoreMp(30);
      this.networkClient?.sendHeal?.({ amount: 50 });
      this.networkClient?.sendRestoreMp?.({ amount: 30 });
      this.combat.showFloatText(this.player.x, this.player.y - 68, `Ấm lòng! +HP +MP`, "#ffd43b");
      playTone(440, 0.15, "triangle", 0.035);
      this.uiBridge.addLog(`Uống Nữ Nhi Hồng: Hồi phục ${healed} HP và ${restored} MP!`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      return true;
    }

    if (itemId === "hoi-thanh-phu") {
      // Hồi Thành Phù (Về điểm hồi sinh Biện Kinh)
      this.player.setPosition(MARKET_SPAWN.x, MARKET_SPAWN.y);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `Về Biện Kinh`, "#ffdd59");
      playTone(330, 0.2, "sine", 0.04);
      this.uiBridge.addLog("Đã dùng Hồi Thành Phù quay về trung tâm Biện Kinh.", "system");
      return true;
    }

    const item = getItemById(itemId);
    if (item) {
      this.uiBridge.addLog(`Đã sử dụng ${item.name}.`, "system");
      return true;
    }

    return false;
  }

  /**
   * React to any inventory change: refresh the HUD and persist locally, which
   * also queues a server sync when the bag actually changed.
   */
  onInventoryChanged() {
    this.uiBridge.updateInventory();
    this.saveGame(false);
  }

  /**
   * Push the worn items to the React HUD.
   */
  emitEquipment() {
    bridge.emit(EVENTS.EQUIPMENT_UPDATED, {
      equipment: { ...this.player.equipment }
    });
    // Mirror to peers so their rigs show the same gear.
    this.networkClient?.sendEquipment?.(this.player.equipment);
    // Gear now feeds attack/defence/crit, so refresh the sheet snapshot too.
    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * Wear an inventory item in its slot. One unit is consumed from the bag and
   * any item already in that slot is returned to it, so nothing is ever lost.
   * @param {string} itemId
   */
  equipItem(itemId) {
    if (!this.player || !this.started) return;

    const { ok, slot, error } = planEquip(this.player.equipment, itemId);
    if (!ok) {
      this.uiBridge.addLog(error || "Không thể trang bị vật phẩm này.", "guide");
      return;
    }
    if (getQuantity(itemId) <= 0) {
      this.uiBridge.addLog("Hành trang không còn vật phẩm này.", "guide");
      return;
    }

    const previous = equippedIn(this.player.equipment, slot);
    const consumed = consumeQuantity(itemId, 1);
    if (!consumed.ok) return;
    if (previous) addQuantity(previous, 1);

    this.player.applyEquipment({ ...this.player.equipment, [slot]: itemId });
    const item = getItemById(itemId);
    this.uiBridge.addLog(`Đã trang bị ${item?.name || itemId}.`, "system");
    this.emitEquipment();
    this.onInventoryChanged();
  }

  /**
   * Take off whatever is worn in `slot` and return it to the bag.
   * @param {string} slot
   */
  unequipSlot(slot) {
    if (!this.player || !this.started) return;

    const itemId = equippedIn(this.player.equipment, slot);
    if (!itemId) return;

    addQuantity(itemId, 1);
    this.player.applyEquipment({ ...this.player.equipment, [slot]: null });
    const item = getItemById(itemId);
    this.uiBridge.addLog(`Đã tháo ${item?.name || itemId}.`, "system");
    this.emitEquipment();
    this.onInventoryChanged();
  }

  setPaused(paused) {
    this.isPaused = !!paused;
    bridge.emit(EVENTS.GAME_PAUSED, this.isPaused);
    if (this.isPaused) {
      this.physics.pause();
      if (this.player?.sprite?.body) {
        this.player.sprite.setVelocity(0, 0);
      }
    } else if (this.started) {
      this.physics.resume();
    }
  }

  saveGame(showFeedback = true) {
    if (!this.player) return;

    const success = StorageManager.save({
      stats: this.player.stats,
      position: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y)
      },
      questRewarded: this.uiBridge.questRewarded,
      audioEnabled: isAudioEnabled()
    });
    // The bag is character-scoped, so it is persisted under the active character.
    StorageManager.saveInventory(getQuantities());
    StorageManager.saveEquipment(this.player.equipment);

    // Mirror the bag to the character's server inventory. Deduped by signature, so
    // a save that did not touch items (e.g. a kill) sends no request.
    this.inventorySync?.sync();

    if (success && showFeedback) {
      this.uiBridge.addLog("Đã lưu tiến trình giang hồ thành công.", "system");
      this.combat.showFloatText(
        this.player.x,
        this.player.y - 65,
        "ĐÃ LƯU TIẾN TRÌNH!",
        "#a5e2b8"
      );
    }
  }

  resetGame() {
    StorageManager.clear();
    StorageManager.clearInventory();
    StorageManager.clearEquipment();
    window.location.reload();
  }

  updateCameraZoom() {
    // The gameplay camera is defined in ground tiles: it always shows
    // CAMERA_TILES tiles across the screen width, whatever the resolution.
    const w = this.scale.width || 800;
    const targetZoom = w / (CAMERA_TILES * WORLD_TILE);
    const zoom = Phaser.Math.Clamp(targetZoom, 0.1, 3.0);
    this.cameras.main.setZoom(zoom);
  }

  showClickIndicator(x, y, color = 0xffdd59) {
    const base = toIso(x, y);
    const ring = this.add.circle(base.x, base.y, 5, color, 0.25);
    ring.setStrokeStyle(2, color, 0.95);
    ring.setDepth(isoDepth(x, y));

    this.tweens.add({
      targets: ring,
      radius: 17,
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  /**
   * Toggle the local player's PK flag: update the visual, tell the HUD and inform
   * the server so peers can gate their attacks against us.
   * @returns {boolean} the new flag state
   */
  togglePk() {
    if (!this.player) return false;

    const next = !this.player.pkFlag;
    this.player.setPkFlag(next);
    bridge.emit(EVENTS.PK_CHANGED, next);
    this.networkClient?.sendPk?.({ pkFlag: next });

    this.uiBridge.addLog(
      next
        ? "Đã bật cờ PK — từ nay có thể tỷ thí cùng cao thủ khác."
        : "Đã tắt cờ PK — trở về trạng thái hòa bình.",
      "system"
    );
    return next;
  }

  /**
   * Apply the server's authoritative HP for a player. For the local player this
   * drives the HUD (and the hit feedback); for anyone else it drives their bar.
   * @param {{id?:string, hp?:number, maxHp?:number, damage?:number, sourceName?:string}} payload
   */
  handlePlayerHp(payload = {}) {
    if (!payload.id || !Number.isFinite(payload.hp)) return;

    const isLocal =
      payload.id === this.combat?.localPlayerId ||
      payload.id === this.remotePlayerManager?.localPlayerId;

    if (!isLocal) {
      this.remotePlayerManager.handlePlayerHp(payload);
      return;
    }

    const prevHp = this.player.stats.hp;
    if (Number.isFinite(payload.maxHp) && payload.maxHp > 0) {
      this.player.stats.maxHp = payload.maxHp;
    }
    this.player.stats.hp = payload.hp;

    const damage = Number(payload.damage);
    if (Number.isFinite(damage) && damage > 0 && payload.hp < prevHp) {
      this.player.flashHit?.();
      this.combat.showFloatText(this.player.x, this.player.y - 45, `-${damage}`, "#ff7777");
      this.uiBridge.addLog(
        `Bị ${payload.sourceName || "đối thủ"} đánh trúng! -${damage} HP.`,
        "combat"
      );
    }

    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * Apply the server's authoritative MP for the local player. Peers carry no MP
   * bar, so a remote id is ignored.
   * @param {{id?:string, mp?:number, maxMp?:number}} payload
   */
  handlePlayerMp(payload = {}) {
    const isLocal =
      payload.id === this.combat?.localPlayerId ||
      payload.id === this.remotePlayerManager?.localPlayerId;
    if (!isLocal) return;

    if (Number.isFinite(payload.maxMp) && payload.maxMp > 0) {
      this.player.stats.maxMp = payload.maxMp;
    }
    if (Number.isFinite(payload.mp)) {
      this.player.stats.mp = Math.min(payload.mp, this.player.stats.maxMp);
    }

    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * The server declared a player defeated. The victim is teleported to the respawn
   * point; the killer gets credit and everyone else sees the outcome.
   * @param {{victimId?:string, victimName?:string, attackerId?:string, attackerName?:string, respawn?:{x:number,y:number}}} payload
   */
  handlePlayerDefeated(payload = {}) {
    if (!payload.victimId) return;

    const isLocal =
      payload.victimId === this.combat?.localPlayerId ||
      payload.victimId === this.remotePlayerManager?.localPlayerId;

    if (isLocal) {
      this.player.stats.hp = this.player.stats.maxHp;
      this.player.invulnerable = false;
      this.player.visual.setAlpha(1);
      if (payload.respawn) {
        this.player.setPosition(payload.respawn.x, payload.respawn.y);
      } else {
        this.player.respawn();
      }
      this.combat?.clearBuffs?.();
      this.uiBridge.updateHud(this.player.stats);
      this.uiBridge.addLog("Bạn đã bị đánh bại và hồi sinh tại Biện Kinh.", "combat");
      // Persist the full-HP respawn state.
      this.saveGame(false);
    }

    if (payload.attackerId && payload.attackerId === this.combat?.localPlayerId) {
      this.uiBridge.addLog(
        `Bạn đã đánh bại ${payload.victimName || "đối thủ"}!`,
        "combat"
      );
    } else if (!isLocal) {
      this.uiBridge.addLog(
        `${payload.victimName || "Một hiệp khách"} đã bị ${payload.attackerName || "đối thủ"} đánh bại.`,
        "near"
      );
    }
  }

  sendNetworkJoin() {
    if (!this.player || !this.networkClient?.isConnected) return;

    let tabId = "";
    if (typeof window !== "undefined") {
      if (!window.__jx2TabSessionId) {
        window.__jx2TabSessionId = Math.random().toString(36).slice(2, 8);
      }
      tabId = window.__jx2TabSessionId;
    }

    let playerId = `guest_${tabId || Math.random().toString(36).slice(2, 8)}`;
    let username = this.player.name || "Lãng Khách";
    let displayName = username;

    const session = readSession();
    if (session?.user?.id) {
      playerId = `${session.user.id}_${tabId}`;
      username = session.user.username || username;
      displayName =
        session.activeCharacter?.name ||
        session.user.displayName ||
        username;
    }

    const effective = this.combat?.getEffectiveStats?.() || this.player.stats;
    this.remotePlayerManager.setLocalPlayerId(playerId);
    this.combat.setLocalPlayerId(playerId);
    this.networkClient.join({
      id: playerId,
      token: session?.token || null,
      characterId: session?.activeCharacter?.id || null,
      username,
      displayName,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      vx: 0,
      vy: 0,
      direction: this.player.facing,
      equipment: { ...this.player.equipment },
      gender: normalizeGender(this.player.gender),
      hp: this.player.stats?.hp || 100,
      mp: this.player.stats?.mp || 0,
      defense: effective.defense ?? 6,
      attack: effective.attack ?? 24,
      critRate: effective.critRate ?? 0.12,
      pkFlag: this.player.pkFlag === true
    });
  }

  /**
   * Interact with the closest NPC in range using key F.
   */
  interactWithNearbyNpc() {
    if (!this.started || this.isPaused) return;
    const candidates = (this.npcs || [])
      .map((npc) => ({
        npc,
        dist: Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.gx, npc.gy)
      }))
      .filter((item) => isInTalkRange(item.npc, this.player.x, this.player.y))
      .sort((a, b) => a.dist - b.dist);

    if (candidates.length > 0) {
      this.player.stopMovement();
      this.pendingNpc = null;
      this.shopFlow.open(candidates[0].npc);
    } else {
      this.uiBridge.addLog("Không có NPC ở gần để nói chuyện (nhấn [F] khi lại gần NPC).");
    }
  }

  /**
   * Bind the configurable skill keys (U, I, O, P) and NPC interaction key (F).
   */
  bindSkillKeys() {
    if (this.skillKeyHandler) return;
    this.skillKeyHandler = (event) => {
      if (!this.started || this.isPaused) return;
      if (this.isTyping?.()) return;
      if (event.repeat) return;
      const key = normalizeKey(event);
      if (!key) return;

      if (key === "f") {
        event.preventDefault();
        this.interactWithNearbyNpc();
        return;
      }

      if (["u", "i", "o", "p"].includes(key)) {
        event.preventDefault();
        const pointer = this.input.activePointer;
        let aim = null;
        if (pointer) {
          aim = fromIso(pointer.worldX, pointer.worldY);
        }
        this.combat.castSkillByKey(key, aim);
      }
    };
    this.input.keyboard.on("keydown", this.skillKeyHandler);
  }

  startGame() {
    this.started = true;
    // Scope the bag to the active character before any load/save touches it.
    StorageManager.setCharacterId(readSession()?.activeCharacter?.id || null);
    this.quickSlots = loadQuickSlots(readSession()?.activeCharacter?.id);
    // Re-entering (or switching characters) must re-read before any upload, so the
    // initial save below cannot clobber the new character's server bag.
    this.inventorySync?.reset();
    this.setPaused(false);
    if (this.player?.sprite?.body) {
      this.player.sprite.body.enable = true;
    }

    this.sendNetworkJoin();

    // Reload save for the active user session
    this.savedData = StorageManager.load();
    if (this.savedData) {
      if (this.savedData.stats) {
        this.player.loadStats(this.savedData.stats);
      }
      if (this.savedData.position && typeof this.savedData.position.x === "number") {
        const { x, y } = this.savedData.position;
        const insideMarket =
          x >= MARKET_BOUNDS.x0 && x <= MARKET_BOUNDS.x1 && y >= MARKET_BOUNDS.y0 && y <= MARKET_BOUNDS.y1;
        if (insideMarket) this.player.setPosition(x, y);
      }
      if (this.savedData.questRewarded !== undefined) {
        this.uiBridge.setQuestRewarded(this.savedData.questRewarded);
      }
      this.uiBridge.updateHud(this.player.stats);
    }

    bridge.emit(EVENTS.GAME_STARTED);

    // Wear the character's saved gear. Persisted per character like the bag.
    this.player.applyEquipment(StorageManager.loadEquipment());
    this.emitEquipment();

    if (this.savedData) {
      this.uiBridge.addLog(
        `Chào mừng trở lại! Tải lại nhân vật Cấp ${this.player.stats.level} — Bạc: ${this.player.stats.coins}.`,
        "system"
      );
    } else {
      this.uiBridge.addLog("Bạn đã đặt chân đến Biện Kinh. Chúc hiệp khách hành tẩu bình an.", "system");
      this.player.setPosition(MARKET_SPAWN.x, MARKET_SPAWN.y);
    }

    this.saveGame(false);

    // Pull the character's server bag once the active character is known (source
    // of truth); falls back to / pushes the local bag when the server has none.
    this.inventorySync?.load();
  }

  update(time, delta) {
    if (!this.started || this.isPaused || !this.player) return;

    // Update player movement and animation
    this.player.update(time, delta);
    // Drive pending melee approaches (walk into range, then release the skill).
    this.combat.update?.(time);

    // Open a shop once the hero has walked within talking distance.
    if (this.pendingNpc) {
      if (isInTalkRange(this.pendingNpc, this.player.x, this.player.y)) {
        this.pendingNpc = null;
        this.player.stopMovement();
        this.uiBridge.addLog("Đã đến gần NPC. Nhấn phím [F] để nói chuyện.");
      }
    }

    // Update remote players (interpolation and animations)
    if (this.remotePlayerManager) {
      this.remotePlayerManager.update(time, delta);
    }

    // Broadcast local player coordinates to network (throttled every 50ms)
    if (this.networkClient?.isConnected) {
      if (!this.lastNetworkMoveTime || time - this.lastNetworkMoveTime > 50) {
        this.lastNetworkMoveTime = time;
        const px = Math.round(this.player.x);
        const py = Math.round(this.player.y);
        const vx = Math.round(this.player.sprite?.body?.velocity?.x || 0);
        const vy = Math.round(this.player.sprite?.body?.velocity?.y || 0);
        const isMoving = Math.abs(vx) > 5 || Math.abs(vy) > 5;

        // Movement, the stop transition, and respawn/teleport jumps are all
        // reported; a plain "isMoving" gate would leave peers rendering the
        // player at its pre-respawn position (see positionSync.shouldReportPosition).
        const reportPosition = shouldReportPosition({
          isMoving,
          wasMoving: this.wasMovingLastSync,
          x: px,
          y: py,
          lastReported: this.lastReportedPos
        });

        if (reportPosition) {
          this.wasMovingLastSync = isMoving;
          this.lastReportedPos = { x: px, y: py };
          this.networkClient.sendMove({
            x: px,
            y: py,
            vx,
            vy,
            direction: this.player.facing
          });
        }

        // Report the stats the client owns: defense (rolls wolf bites), attack and
        // crit (the server uses them to validate skill damage). Level/HP/MP stay
        // server-owned.
        const { defense, attack, critRate } = this.combat?.getEffectiveStats?.() || this.player.stats;
        if (
          defense !== this.lastReportedDefense ||
          attack !== this.lastReportedAttack ||
          critRate !== this.lastReportedCrit
        ) {
          this.lastReportedDefense = defense;
          this.lastReportedAttack = attack;
          this.lastReportedCrit = critRate;
          this.networkClient.sendStats({ defense, attack, critRate });
        }
      }
    }

    // Render enemies. Player health is server-authoritative now, so the client no
    // longer applies bite damage locally — the server tick bites and streams the
    // resulting `player_hp` back (see server gameSocket.tickBites).
    this.enemyManager.update(time, delta, this.player);

    // Update UI HUD & Minimap Radar
    this.uiBridge.updateHud(this.player.stats);
    this.uiBridge.drawMinimap(
      this.player,
      this.enemyManager.getAll(),
      MARKET_WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );
    this.uiBridge.drawCityMap(
      this.player,
      this.enemyManager.getAll(),
      MARKET_WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );
  }

  /**
   * Close the multiplayer client when this scene goes away.
   *
   * React unmounts and remounts the canvas whenever the game is re-entered or a
   * module reloads (Vite HMR), and Phaser then destroys the scene. Without this
   * the abandoned `NetworkClient` stays connected and keeps auto-reconnecting
   * with the same per-tab player id, so the server closes the other socket on
   * every join and the two clients fight forever — the live client just keeps
   * logging "Mất kết nối máy chủ. Đang tự động kết nối lại...".
   */
  bindSceneTeardown() {
    this.events.once("shutdown", this.shutdown, this);
    this.events.once("destroy", this.shutdown, this);
  }

  shutdown() {
    if (this.unloadHandler) {
      window.removeEventListener("beforeunload", this.unloadHandler);
    }
    if (this.unsubscribers) {
      this.unsubscribers.forEach((unsub) => unsub());
      this.unsubscribers = [];
    }
    if (this.networkClient) {
      this.networkClient.disconnect();
      this.networkClient = null;
    }
    if (this.remotePlayerManager) {
      this.remotePlayerManager.destroy();
      this.remotePlayerManager = null;
    }
    if (this.shopFlow) {
      this.shopFlow.destroy();
      this.shopFlow = null;
    }
    if (this.player) {
      this.player.destroy?.();
      this.player = null;
    }
    if (this.uiBridge) {
      this.uiBridge.destroy();
    }
    if (this.skillKeyHandler && this.input?.keyboard) {
      this.input.keyboard.off("keydown", this.skillKeyHandler);
      this.skillKeyHandler = null;
    }
  }
}

/**
 * Factory function to initialize Phaser game in React lifecycle
 * @param {string|HTMLElement} parent
 * @returns {Phaser.Game}
 */
export function createGame(parent) {
  const config = {
    type: Phaser.AUTO,
    parent: parent,
    width: 1280,
    height: 720,
    backgroundColor: "#24392b",
    physics: {
      default: "arcade",
      arcade: { debug: false }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [JiangHuScene]
  };

  return new Phaser.Game(config);
}
