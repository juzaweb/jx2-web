import * as Phaser from "phaser";
import { WorldManager, WORLD_CONFIG } from "./world.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled, playTone } from "./combat.js";
import { UIBridgeAdapter } from "./uiBridgeAdapter.js";
import { StorageManager } from "./storage.js";
import { bridge, EVENTS } from "./bridge.js";
import { getQuantities } from "./items.js";
import { NetworkClient } from "./networkClient.js";
import { RemotePlayerManager } from "./remotePlayerManager.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
    this.isPaused = false;
    this.unsubscribers = [];
  }

  preload() {
    this.load.image("hero-sprite", "/hero.png");
    this.load.spritesheet("hero-side-walk", "/hero_side_walk.png", {
      frameWidth: 284,
      frameHeight: 320
    });
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

    // Configure world and camera bounds
    this.cameras.main.setBounds(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height);
    this.physics.world.setBounds(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height);

    // Initialize subsystems
    this.worldManager = new WorldManager(this);
    this.worldManager.create();

    // Resolve initial player name from active session if available
    let initialName = "Lãng Khách";
    try {
      const sessionStr = typeof localStorage !== "undefined" ? localStorage.getItem("jx2_user_session") : null;
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        if (parsed?.user?.displayName || parsed?.user?.username) {
          initialName = parsed.user.displayName || parsed.user.username;
        }
      }
    } catch {
      // fallback to default
    }

    this.player = new Player(this, 640, 620, initialName);
    this.enemyManager = new EnemyManager(this);
    this.enemyManager.create();

    // Static physics collisions between world obstacles and entities
    const obstacles = this.worldManager.getObstacles();
    if (obstacles) {
      this.physics.add.collider(this.player.sprite, obstacles);
      this.physics.add.collider(this.enemyManager.group, obstacles);
    }

    // UI Bridge Adapter to communicate with React components
    this.uiBridge = new UIBridgeAdapter();

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

    // Camera follow player
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
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

      const worldX = pointer.worldX;
      const worldY = pointer.worldY;

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

      this.player.moveTo(pointer.worldX, pointer.worldY);
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

    // Auto-start game immediately without start modal
    this.startGame();
  }

  useItem(slot) {
    if (!this.player || !this.started) return;

    if (slot === 1) {
      // Kim Sáng Dược (+35 HP)
      if (this.player.stats.hp >= this.player.stats.maxHp) {
        this.uiBridge.addLog("Sinh lực đã đầy, không cần dùng Kim Sáng Dược.", "guide");
        return;
      }
      const healed = this.player.heal(35);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `+${healed} HP`, "#69db7c");
      playTone(520, 0.12, "triangle", 0.03);
      this.uiBridge.addLog(`Đã dùng Kim Sáng Dược: hồi phục ${healed} HP.`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 2) {
      // Đại Hoàn Đan (+25 MP)
      if (this.player.stats.mp >= this.player.stats.maxMp) {
        this.uiBridge.addLog("Nội lực đã tràn đầy, không cần dùng Đại Hoàn Đan.", "guide");
        return;
      }
      const restored = this.player.restoreMp(25);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `+${restored} MP`, "#74c0fc");
      playTone(580, 0.12, "sine", 0.03);
      this.uiBridge.addLog(`Đã dùng Đại Hoàn Đan: hồi phục ${restored} MP.`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 3) {
      // Nữ Nhi Hồng (+50 HP & +30 MP)
      const healed = this.player.heal(50);
      const restored = this.player.restoreMp(30);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `Ấm lòng! +HP +MP`, "#ffd43b");
      playTone(440, 0.15, "triangle", 0.035);
      this.uiBridge.addLog(`Uống Nữ Nhi Hồng: Hồi phục ${healed} HP và ${restored} MP!`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 4) {
      // Hồi Thành Phù (Về điểm hồi sinh Trường An)
      this.player.setPosition(640, 620);
      this.combat.showFloatText(this.player.x, this.player.y - 68, `Về Trường An`, "#ffdd59");
      playTone(330, 0.2, "sine", 0.04);
      this.uiBridge.addLog("Đã dùng Hồi Thành Phù quay về trung tâm Trường An.", "system");
      this.saveGame(false);
    }
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
      audioEnabled: isAudioEnabled(),
      inventory: getQuantities()
    });

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
    window.location.reload();
  }

  updateCameraZoom() {
    // Reference resolution: 800 x 600 (classic JX2 viewport)
    // In original JX2, character height is ~82px in a 600px tall frame (82/600 ~= 13.67%).
    // Setting zoom proportional to frame height maintains the exact 13.67% character-to-frame ratio across all screens.
    const h = this.scale.height || 600;
    const w = this.scale.width || 800;
    const targetZoom = Math.min(h / 600, w / 480);
    const zoom = Phaser.Math.Clamp(targetZoom, 0.65, 4.0);
    this.cameras.main.setZoom(zoom);
  }

  showClickIndicator(x, y, color = 0xffdd59) {
    const ring = this.add.circle(x, y, 5, color, 0.25);
    ring.setStrokeStyle(2, color, 0.95);
    ring.setDepth(y);

    this.tweens.add({
      targets: ring,
      radius: 17,
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
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

    try {
      const sessionStr = typeof localStorage !== "undefined" ? localStorage.getItem("jx2_user_session") : null;
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        if (parsed?.user?.id) {
          playerId = `${parsed.user.id}_${tabId}`;
          username = parsed.user.username || username;
          displayName = parsed.user.displayName || username;
        }
      }
    } catch {
      // fallback
    }

    this.remotePlayerManager.setLocalPlayerId(playerId);
    this.networkClient.join({
      id: playerId,
      username,
      displayName,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      vx: 0,
      vy: 0,
      direction: this.player.visual?.scaleX < 0 ? "left" : "right",
      stance: this.player.currentStance || "front",
      level: this.player.stats?.level || 1,
      hp: this.player.stats?.hp || 100,
      maxHp: this.player.stats?.maxHp || 100
    });
  }

  startGame() {
    this.started = true;
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

    if (this.savedData) {
      this.uiBridge.addLog(
        `Chào mừng trở lại! Tải lại nhân vật Cấp ${this.player.stats.level} — Bạc: ${this.player.stats.coins}.`,
        "system"
      );
    } else {
      this.uiBridge.addLog("Bạn đã đặt chân đến Trường An. Chúc hiệp khách hành tẩu bình an.", "system");
      this.player.setPosition(640, 620);
    }

    this.saveGame(false);
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
        const vx = Math.round(this.player.sprite?.body?.velocity?.x || 0);
        const vy = Math.round(this.player.sprite?.body?.velocity?.y || 0);
        const isMoving = Math.abs(vx) > 5 || Math.abs(vy) > 5;

        if (isMoving || this.wasMovingLastSync) {
          this.wasMovingLastSync = isMoving;
          this.networkClient.sendMove({
            x: Math.round(this.player.x),
            y: Math.round(this.player.y),
            vx,
            vy,
            direction: this.player.visual?.scaleX < 0 ? "left" : "right",
            stance: this.player.currentStance || "front"
          });
        }
      }

      // Report enemy positions to the server (throttled) so players share one world state
      if (!this.lastEnemySyncTime || time - this.lastEnemySyncTime > 500) {
        this.lastEnemySyncTime = time;
        const enemies = this.enemyManager
          .getAlive()
          .map((wolf) => ({ id: wolf.id, x: Math.round(wolf.x), y: Math.round(wolf.y) }));

        if (enemies.length) {
          this.networkClient.sendEnemyMove(enemies);
        }
      }
    }

    // Update enemies and check attacks against player
    this.enemyManager.update(time, delta, this.player, (wolf) => {
      if (this.started && !this.isPaused) {
        this.combat.damagePlayer(7);
      }
    });

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
