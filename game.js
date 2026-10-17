import * as Phaser from "phaser";
import { WorldManager, WORLD_CONFIG } from "./world.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled, playTone } from "./combat.js";
import { UIManager } from "./ui.js";
import { StorageManager } from "./storage.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
    this.isPaused = false;
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

    // Static physics collisions between world obstacles (buildings) and entities
    const obstacles = this.worldManager.getObstacles();
    if (obstacles) {
      this.physics.add.collider(this.player.sprite, obstacles);
      this.physics.add.collider(this.enemyManager.group, obstacles);
    }

    this.uiManager = new UIManager();

    // Combat system with state change hook for auto-saving
    this.combat = new CombatSystem(
      this,
      this.player,
      this.enemyManager,
      this.uiManager,
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
        this.uiManager.setQuestRewarded(this.savedData.questRewarded);
      }
      if (this.savedData.audioEnabled !== undefined) {
        setAudioEnabled(this.savedData.audioEnabled);
        this.uiManager.updateSoundButton(this.savedData.audioEnabled);
      }
      this.uiManager.updateStartButton(`TIẾP TỤC HÀNH TẨU (CẤP ${this.player.stats.level})`);
    }

    // Camera follow player
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateCameraZoom();

    // Scale resize handler
    this.scale.on("resize", () => this.updateCameraZoom());

    // Mouse input handlers (Left click: Basic Attack, Right click: Kiếm Khí)
    this.input.on("pointerdown", (pointer) => {
      if (!this.started || this.isPaused) return;

      // Do not attack when clicking on interactive HUD elements
      const target = pointer.event.target;
      if (target?.closest?.(".metal-card, .top-left-panel, .bottom-dock, .mobile-controls, button, input")) {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.combat.performSkill();
      } else {
        this.combat.performAttack();
      }
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

    // Wire UI controls
    this.uiManager.initControls({
      onStart: () => this.startGame(),
      onSoundToggle: () => {
        const enabled = toggleAudio();
        this.saveGame(false);
        return enabled;
      },
      onMove: (direction) => {
        if (!this.isPaused) {
          this.player.setTouchDirection(direction);
        }
      },
      onAttack: () => {
        if (this.started && !this.isPaused) {
          this.combat.performAttack();
        }
      },
      onSkill: () => {
        if (this.started && !this.isPaused) {
          this.combat.performSkill();
        }
      },
      onUseItem: (slot) => {
        if (this.started && !this.isPaused) {
          this.useItem(slot);
        }
      },
      onPauseChange: (paused) => this.setPaused(paused),
      onSave: () => this.saveGame(true),
      onReset: () => {
        if (window.confirm("Bạn có chắc chắn muốn xóa dữ liệu đã lưu và chơi lại từ đầu không?")) {
          this.resetGame();
        }
      }
    });

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
    window.addEventListener("beforeunload", () => {
      if (this.started) {
        this.saveGame(false);
      }
    });

    // Initial HUD update
    this.uiManager.updateHud(this.player.stats);
    this.uiManager.drawMinimap(this.player, this.enemyManager.getAll(), WORLD_CONFIG);
  }

  useItem(slot) {
    if (!this.player || !this.started) return;

    if (slot === 1) {
      // Kim Sáng Dược (+35 HP)
      if (this.player.stats.hp >= this.player.stats.maxHp) {
        this.uiManager.addLog("Sinh lực đã đầy, không cần dùng Kim Sáng Dược.", "guide");
        return;
      }
      const healed = this.player.heal(35);
      this.combat.showFloatText(this.player.x, this.player.y - 45, `+${healed} HP`, "#69db7c");
      playTone(520, 0.12, "triangle", 0.03);
      this.uiManager.addLog(`Đã dùng Kim Sáng Dược: hồi phục ${healed} HP.`, "combat");
      this.uiManager.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 2) {
      // Đại Hoàn Đan (+25 MP)
      if (this.player.stats.mp >= this.player.stats.maxMp) {
        this.uiManager.addLog("Nội lực đã tràn đầy, không cần dùng Đại Hoàn Đan.", "guide");
        return;
      }
      const restored = this.player.restoreMp(25);
      this.combat.showFloatText(this.player.x, this.player.y - 45, `+${restored} MP`, "#74c0fc");
      playTone(580, 0.12, "sine", 0.03);
      this.uiManager.addLog(`Đã dùng Đại Hoàn Đan: hồi phục ${restored} MP.`, "combat");
      this.uiManager.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 3) {
      // Nữ Nhi Hồng (+50 HP & +30 MP)
      const healed = this.player.heal(50);
      const restored = this.player.restoreMp(30);
      this.combat.showFloatText(this.player.x, this.player.y - 50, `Ấm lòng! +HP +MP`, "#ffd43b");
      playTone(440, 0.15, "triangle", 0.035);
      this.uiManager.addLog(`Uống Nữ Nhi Hồng: Hồi phục ${healed} HP và ${restored} MP!`, "combat");
      this.uiManager.updateHud(this.player.stats);
      this.saveGame(false);
    } else if (slot === 4) {
      // Hồi Thành Phù (Về điểm hồi sinh Trường An)
      this.player.setPosition(640, 620);
      this.combat.showFloatText(this.player.x, this.player.y - 45, `Về Trường An`, "#ffdd59");
      playTone(330, 0.2, "sine", 0.04);
      this.uiManager.addLog("Đã dùng Hồi Thành Phù quay về trung tâm Trường An.", "system");
      this.saveGame(false);
    }
  }

  setPaused(paused) {
    this.isPaused = !!paused;
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
      questRewarded: this.uiManager.questRewarded,
      audioEnabled: isAudioEnabled()
    });

    if (success && showFeedback) {
      this.uiManager.addLog("Đã lưu tiến trình giang hồ thành công.", "system");
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

  startGame() {
    this.started = true;
    this.setPaused(false);
    this.player.sprite.body.enable = true;

    if (this.savedData) {
      this.uiManager.addLog(
        `Chào mừng trở lại! Tải lại nhân vật Cấp ${this.player.stats.level} — Bạc: ${this.player.stats.coins}.`,
        "system"
      );
    } else {
      this.uiManager.addLog("Bạn đã đặt chân đến Trường An. Chúc hiệp khách hành tẩu bình an.", "system");
      this.player.setPosition(640, 620);
    }

    this.saveGame(false);
  }

  update(time, delta) {
    // Do not update when not started, paused, or player destroyed
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
    this.uiManager.updateHud(this.player.stats);
    this.uiManager.drawMinimap(this.player, this.enemyManager.getAll(), WORLD_CONFIG);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
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

export const game = new Phaser.Game(config);
