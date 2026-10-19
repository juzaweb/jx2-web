import * as Phaser from "phaser";
import { WorldManager, WORLD_CONFIG } from "./world.js";
import { WORLD_POSITION_SCALE, WORLD_SCALE } from "./worldConfig.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled, playTone } from "./combat.js";
import { UIBridgeAdapter } from "./uiBridgeAdapter.js";
import { StorageManager } from "./storage.js";
import { bridge, EVENTS } from "./bridge.js";
import { getQuantities, getQuantity, consumeQuantity, addQuantity, setQuantities, getItemById, QUICK_ITEMS } from "./items.js";
import { planEquip, equippedIn } from "./equipment.js";
import { NetworkClient } from "./networkClient.js";
import { RemotePlayerManager } from "./remotePlayerManager.js";
import { readSession } from "./session.js";
import { shouldReportPosition } from "./positionSync.js";
import { InventorySyncer } from "./inventorySync.js";
import { apiClient } from "./apiClient.js";
import { toIso, fromIso, isoDepth, isoBounds } from "./isoProjection.js";
import { PVP_ATTACK_RANGE } from "./pvp.js";

/** Hotbar slot -> consumable, used so useItem can look up the item behind a key. */
const CONSUMABLE_BY_SLOT = new Map(QUICK_ITEMS.map((item) => [item.useSlot, item]));

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
    // The hero is drawn procedurally (see heroRig.js); only the portrait art is
    // still loaded from disk.
    this.load.image("hero-portrait", "/hero_portrait.png");
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

    // Configure world and camera bounds. Physics/collisions stay in the flat
    // "ground" plane; the camera lives in isometric screen space, so its bounds
    // come from the projected diamond that contains the whole ground rectangle.
    const isoBox = isoBounds(WORLD_CONFIG.width, WORLD_CONFIG.height);
    this.cameras.main.setBounds(
      isoBox.minX - 400,
      isoBox.minY - 400,
      isoBox.maxX - isoBox.minX + 800,
      isoBox.maxY - isoBox.minY + 800
    );
    this.physics.world.setBounds(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height);

    // Initialize subsystems
    this.worldManager = new WorldManager(this);
    this.worldManager.create();

    // Seed the name from the cached session; App re-emits SET_PLAYER_NAME once it
    // has refreshed the profile from the backend.
    let initialName = "Lãng Khách";
    const session = readSession();
    initialName =
      session?.activeCharacter?.name ||
      session?.user?.displayName ||
      session?.user?.username ||
      initialName;

    this.player = new Player(this, 640 * WORLD_POSITION_SCALE, 620 * WORLD_POSITION_SCALE, initialName);
    this.enemyManager = new EnemyManager(this);
    this.enemyManager.create([]);

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
      setQuantities,
      onAdopt: () => {
        this.uiBridge.updateInventory();
        this.uiBridge.addLog("Đã đồng bộ hành trang từ máy chủ.", "system");
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
        this.player.setPosition(this.savedData.position.x, this.savedData.position.y);
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

    // Mouse input handlers (Left click: Move or Attack Enemy, Right click: Kiếm Khí)
    this.input.on("pointerdown", (pointer) => {
      if (!this.started || this.isPaused) return;

      // Do not handle when clicking on interactive HUD elements or React overlays
      const target = pointer.event.target;
      if (target?.closest?.(".metal-card, .top-left-panel, .bottom-dock, .mobile-controls, button, input, .overlay")) {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.combat.performSkill();
        return;
      }

      const ground = fromIso(pointer.worldX, pointer.worldY);
      const worldX = ground.x;
      const worldY = ground.y;

      // Check if clicking directly on a living enemy
      const clickedEnemy = this.enemyManager
        .getAlive()
        .find((wolf) => Phaser.Math.Distance.Between(worldX, worldY, wolf.x, wolf.y) < 38);

      if (clickedEnemy) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, clickedEnemy.x, clickedEnemy.y);
        if (dist <= 85) {
          this.player.stopMovement();
          this.combat.performAttack();
        } else {
          this.player.moveTo(clickedEnemy.x, clickedEnemy.y);
          this.showClickIndicator(clickedEnemy.x, clickedEnemy.y, 0xff5252);
        }
        return;
      }

      // Check if clicking directly on another player (PvP)
      const clickedPlayer = this.remotePlayerManager
        .getAll()
        .find(
          (rp) =>
            rp.container?.active &&
            Phaser.Math.Distance.Between(worldX, worldY, rp.x, rp.y) < 42
        );

      if (clickedPlayer) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          clickedPlayer.x,
          clickedPlayer.y
        );
        if (dist <= PVP_ATTACK_RANGE) {
          this.player.stopMovement();
          this.combat.performPvpAttack(clickedPlayer);
        } else {
          this.player.moveTo(clickedPlayer.x, clickedPlayer.y);
          this.showClickIndicator(clickedPlayer.x, clickedPlayer.y, 0xff5252);
        }
        return;
      }

      // Check if clicking directly on an NPC
      const npcs = this.worldManager?.getNPCs?.() || [];
      const clickedNPC = npcs.find(
        (npc) => Phaser.Math.Distance.Between(worldX, worldY, npc.x, npc.y) < 42
      );

      if (clickedNPC) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, clickedNPC.x, clickedNPC.y);
        if (dist > 75) {
          const angle = Phaser.Math.Angle.Between(clickedNPC.x, clickedNPC.y, this.player.x, this.player.y);
          const approachDist = 60;
          const targetX = clickedNPC.x + Math.cos(angle) * approachDist;
          const targetY = clickedNPC.y + Math.sin(angle) * approachDist;
          this.player.moveTo(targetX, targetY);
          this.showClickIndicator(targetX, targetY, 0x22c55e);
        } else {
          this.player.stopMovement();
        }
        this.uiBridge.addLog(clickedNPC.dialogue, "near");
        return;
      }

      // Left click on terrain: Move to destination
      this.isPointerMoving = true;
      this.player.moveTo(worldX, worldY);
      this.showClickIndicator(worldX, worldY, 0xffdd59);
    });

    // Hold-to-move continuous cursor tracking
    this.input.on("pointermove", (pointer) => {
      if (!this.started || this.isPaused || !this.isPointerMoving || !pointer.isDown || pointer.rightButtonDown()) {
        return;
      }

      const target = pointer.event.target;
      if (target?.closest?.(".metal-card, .top-left-panel, .bottom-dock, .mobile-controls, button, input, .overlay")) {
        return;
      }

      const ground = fromIso(pointer.worldX, pointer.worldY);
      this.player.moveTo(ground.x, ground.y);
    });

    this.input.on("pointerup", () => {
      this.isPointerMoving = false;
    });

    // Allow standard typing in HTML form inputs (e.g. login form, chat)
    this.input.keyboard.preventDefault = false;
    const isTyping = () => {
      const tag = typeof document !== "undefined" && document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA";
    };

    // Keyboard Hotkeys
    this.input.keyboard.on("keydown-SPACE", () => {
      if (!isTyping() && this.started && !this.isPaused) this.combat.performAttack();
    });

    this.input.keyboard.on("keydown-Q", () => {
      if (!isTyping() && this.started && !this.isPaused) this.combat.performSkill();
    });

    this.input.keyboard.on("keydown-ONE", () => {
      if (!isTyping() && this.started && !this.isPaused) this.useItem(1);
    });

    this.input.keyboard.on("keydown-TWO", () => {
      if (!isTyping() && this.started && !this.isPaused) this.useItem(2);
    });

    this.input.keyboard.on("keydown-THREE", () => {
      if (!isTyping() && this.started && !this.isPaused) this.useItem(3);
    });

    this.input.keyboard.on("keydown-FOUR", () => {
      if (!isTyping() && this.started && !this.isPaused) this.useItem(4);
    });

    this.input.keyboard.on("keydown-EIGHT", () => {
      if (!isTyping() && this.started && !this.isPaused) this.combat.performSkill();
    });

    this.input.keyboard.on("keydown-P", () => {
      if (!isTyping() && this.started) this.togglePk();
    });

    // Listen to React UI Actions via Game Bridge
    this.unsubscribers.push(
      bridge.on(EVENTS.ACTION_START, () => this.startGame()),
      bridge.on(EVENTS.ACTION_ATTACK, () => {
        if (this.started && !this.isPaused) this.combat.performAttack();
      }),
      bridge.on(EVENTS.ACTION_SKILL, () => {
        if (this.started && !this.isPaused) this.combat.performSkill();
      }),
      bridge.on(EVENTS.ACTION_USE_POTION, (slot) => {
        if (this.started && !this.isPaused) this.useItem(slot);
      }),
      bridge.on(EVENTS.ACTION_EQUIP_ITEM, (itemId) => this.equipItem(itemId)),
      bridge.on(EVENTS.ACTION_UNEQUIP_SLOT, (slot) => this.unequipSlot(slot)),
      bridge.on(EVENTS.ACTION_MOVE, (direction) => {
        if (!this.isPaused) this.player.setTouchDirection(direction);
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
      WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );
    this.uiBridge.drawCityMap(
      this.player,
      this.enemyManager.getAll(),
      WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );

    // Auto-start game immediately without start modal
    this.startGame();
  }

  useItem(slot) {
    if (!this.player || !this.started) return;

    const item = CONSUMABLE_BY_SLOT.get(slot);
    if (!item) return;

    // Refuse an empty stack before any effect runs, so a depleted consumable can
    // never heal for free.
    if (getQuantity(item.id) <= 0) {
      this.uiBridge.addLog(`Hành trang đã hết ${item.name}.`, "guide");
      return;
    }

    if (!this.applyItemEffect(slot)) return;

    // Deduct only after a real use; an effect refused above (e.g. health full)
    // returns false and leaves the stack intact. The live HUD shows the remainder.
    const { ok } = consumeQuantity(item.id, 1);
    if (!ok) return;

    this.onInventoryChanged();
  }

  /**
   * Run the effect for a hotbar consumable slot.
   * @param {number} slot
   * @returns {boolean} whether the item was actually consumed by the player
   */
  applyItemEffect(slot) {
    if (slot === 1) {
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

    if (slot === 2) {
      // Đại Hoàn Đan (+25 MP)
      if (this.player.stats.mp >= this.player.stats.maxMp) {
        this.uiBridge.addLog("Nội lực đã tràn đầy, không cần dùng Đại Hoàn Đan.", "guide");
        return false;
      }
      const restored = this.player.restoreMp(25);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `+${restored} MP`, "#74c0fc");
      playTone(580, 0.12, "sine", 0.03);
      this.uiBridge.addLog(`Đã dùng Đại Hoàn Đan: hồi phục ${restored} MP.`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      return true;
    }

    if (slot === 3) {
      // Nữ Nhi Hồng (+50 HP & +30 MP) — pointless and now wasteful when both are full
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
      this.combat.showFloatText(this.player.x, this.player.y - 68, `Ấm lòng! +HP +MP`, "#ffd43b");
      playTone(440, 0.15, "triangle", 0.035);
      this.uiBridge.addLog(`Uống Nữ Nhi Hồng: Hồi phục ${healed} HP và ${restored} MP!`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      return true;
    }

    if (slot === 4) {
      // Hồi Thành Phù (Về điểm hồi sinh Biện Kinh)
      this.player.setPosition(640 * WORLD_POSITION_SCALE, 620 * WORLD_POSITION_SCALE);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `Về Biện Kinh`, "#ffdd59");
      playTone(330, 0.2, "sine", 0.04);
      this.uiBridge.addLog("Đã dùng Hồi Thành Phù quay về trung tâm Biện Kinh.", "system");
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
    // The Biện Kinh map is now a large square city, so the camera keeps a wider
    // view than the original 1:1 ratio: the player sees a generous slice of the
    // city (matching the world map) instead of a cramped corner.
    const h = this.scale.height || 600;
    const w = this.scale.width || 800;
    const targetZoom = Math.min(h / (700 * WORLD_SCALE), w / (600 * WORLD_SCALE));
    const zoom = Phaser.Math.Clamp(targetZoom, 0.15, 3.0);
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

    this.remotePlayerManager.setLocalPlayerId(playerId);
    this.combat.setLocalPlayerId(playerId);
    this.networkClient.join({
      id: playerId,
      username,
      displayName,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      vx: 0,
      vy: 0,
      direction: this.player.facing,
      equipment: { ...this.player.equipment },
      level: this.player.stats?.level || 1,
      hp: this.player.stats?.hp || 100,
      maxHp: this.player.stats?.maxHp || 100,
      defense: this.player.stats?.defense ?? 6,
      pkFlag: this.player.pkFlag === true
    });
  }

  startGame() {
    this.started = true;
    // Scope the bag to the active character before any load/save touches it.
    StorageManager.setCharacterId(readSession()?.activeCharacter?.id || null);
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
        this.player.setPosition(this.savedData.position.x, this.savedData.position.y);
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
      this.player.setPosition(640 * WORLD_POSITION_SCALE, 620 * WORLD_POSITION_SCALE);
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

        // Report the parts of the player block the client owns (HP ceiling from
        // level-ups, defense for wolf bites). The server owns the current HP.
        const { maxHp, defense, level } = this.player.stats;
        if (maxHp !== this.lastReportedMaxHp || defense !== this.lastReportedDefense) {
          this.lastReportedMaxHp = maxHp;
          this.lastReportedDefense = defense;
          this.networkClient.sendStats({ maxHp, defense, level });
        }
      }
    }

    // Render enemies. Player health is server-authoritative now, so the client no
    // longer applies bite damage locally — the server tick bites and streams the
    // resulting `player_hp` back (see server gameSocket.tickBites).
    this.enemyManager.update(time, delta, this.player);

    // Update collectible loot drops
    this.combat.updateDrops(time);

    // Update UI HUD & Minimap Radar
    this.uiBridge.updateHud(this.player.stats);
    this.uiBridge.drawMinimap(
      this.player,
      this.enemyManager.getAll(),
      WORLD_CONFIG,
      this.remotePlayerManager?.getAll() || []
    );
    this.uiBridge.drawCityMap(
      this.player,
      this.enemyManager.getAll(),
      WORLD_CONFIG,
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
    if (this.uiBridge) {
      this.uiBridge.destroy();
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
