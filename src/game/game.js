import * as Phaser from "phaser";
import { WorldManager, WORLD_CONFIG } from "./world.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled, playTone } from "./combat.js";
import { UIBridgeAdapter } from "./uiBridgeAdapter.js";
import { StorageManager } from "./storage.js";
import { bridge, EVENTS } from "./bridge.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
    this.isPaused = false;
    this.unsubscribers = [];
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

    this.player = new Player(this, 640, 620);
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

    // Keyboard Hotkeys
    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.started && !this.isPaused) this.combat.performAttack();
    });

    this.input.keyboard.on("keydown-Q", () => {
      if (this.started && !this.isPaused) this.combat.performSkill();
    });

    this.input.keyboard.on("keydown-ONE", () => {
      if (this.started && !this.isPaused) this.useItem(1);
    });

    this.input.keyboard.on("keydown-TWO", () => {
      if (this.started && !this.isPaused) this.useItem(2);
    });

    this.input.keyboard.on("keydown-THREE", () => {
      if (this.started && !this.isPaused) this.useItem(3);
    });

    this.input.keyboard.on("keydown-FOUR", () => {
      if (this.started && !this.isPaused) this.useItem(4);
    });

    this.input.keyboard.on("keydown-EIGHT", () => {
      if (this.started && !this.isPaused) this.combat.performSkill();
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
      bridge.on(EVENTS.ACTION_SET_PAUSED, (paused) => this.setPaused(paused))
    );

    // Enemy respawn loop
    this.spawnTimer = this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => {
        if (this.started && !this.isPaused) {
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
    this.uiBridge.drawMinimap(this.player, this.enemyManager.getAll(), WORLD_CONFIG);
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
      this.combat.showFloatText(this.player.x, this.player.y - 45, `+${healed} HP`, "#69db7c");
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
      this.combat.showFloatText(this.player.x, this.player.y - 45, `+${restored} MP`, "#74c0fc");
      playTone(580, 0.12, "sine", 0.03);
      this.uiBridge.addLog(`Đã dùng Đại Hoàn Đan: hồi phục ${restored} MP.`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 3) {
      // Nữ Nhi Hồng (+50 HP & +30 MP)
      const healed = this.player.heal(50);
      const restored = this.player.restoreMp(30);
      this.combat.showFloatText(this.player.x, this.player.y - 50, `Ấm lòng! +HP +MP`, "#ffd43b");
      playTone(440, 0.15, "triangle", 0.035);
      this.uiBridge.addLog(`Uống Nữ Nhi Hồng: Hồi phục ${healed} HP và ${restored} MP!`, "combat");
      this.uiBridge.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 4) {
      // Hồi Thành Phù (Về điểm hồi sinh Trường An)
      this.player.setPosition(640, 620);
      this.combat.showFloatText(this.player.x, this.player.y - 45, `Về Trường An`, "#ffdd59");
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
      audioEnabled: isAudioEnabled()
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
    const zoom = Math.min(this.scale.width / 1000, this.scale.height / 570, 1.15);
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

  startGame() {
    this.started = true;
    this.setPaused(false);
    this.player.sprite.body.enable = true;
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
    this.uiBridge.drawMinimap(this.player, this.enemyManager.getAll(), WORLD_CONFIG);
  }

  shutdown() {
    if (this.unloadHandler) {
      window.removeEventListener("beforeunload", this.unloadHandler);
    }
    if (this.unsubscribers) {
      this.unsubscribers.forEach((unsub) => unsub());
      this.unsubscribers = [];
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
