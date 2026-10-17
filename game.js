import * as Phaser from "phaser";
import { WorldManager, WORLD_CONFIG } from "./world.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled } from "./combat.js";
import { UIManager } from "./ui.js";
import { StorageManager } from "./storage.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
    this.isPaused = false;
  }

  create() {
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
        const soundBtn = document.getElementById("sound-btn");
        if (soundBtn) {
          soundBtn.innerHTML = `ÂM THANH: <span>${this.savedData.audioEnabled ? "ON" : "OFF"}</span>`;
        }
      }
      this.uiManager.updateStartButton(`TIẾP TỤC HÀNH TẨU (CẤP ${this.player.stats.level})`);
    }

    // Camera follow player
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateCameraZoom();

    // Scale resize handler
    this.scale.on("resize", () => this.updateCameraZoom());

    // Input handlers (only process when active and not paused)
    this.input.on("pointerdown", (pointer) => {
      if (this.started && !this.isPaused && !pointer.event.target?.closest?.("button")) {
        this.combat.performAttack();
      }
    });

    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.started && !this.isPaused) {
        this.combat.performAttack();
      }
    });

    this.input.keyboard.on("keydown-Q", () => {
      if (this.started && !this.isPaused) {
        this.combat.performSkill();
      }
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
      this.uiManager.addLog("Đã lưu tiến trình giang hồ thành công.");
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
    const zoom = Math.min(this.scale.width / 1000, this.scale.height / 570, 1.1);
    this.cameras.main.setZoom(zoom);
  }

  startGame() {
    this.started = true;
    this.setPaused(false);
    this.player.sprite.body.enable = true;

    if (this.savedData) {
      this.uiManager.addLog(
        `Chào mừng trở lại! Tải lại nhân vật Cấp ${this.player.stats.level} — Bạc: ${this.player.stats.coins}.`
      );
    } else {
      this.uiManager.addLog("Bạn đã đặt chân đến Trường An. Chúc hiệp khách hành tẩu bình an.");
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

    // Update UI HUD
    this.uiManager.updateHud(this.player.stats);
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
