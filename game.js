import * as Phaser from "phaser";
import { WorldManager, WORLD_CONFIG } from "./world.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { CombatSystem, toggleAudio } from "./combat.js";
import { UIManager } from "./ui.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
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

    this.uiManager = new UIManager();
    this.combat = new CombatSystem(this, this.player, this.enemyManager, this.uiManager);

    // Camera follow player
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateCameraZoom();

    // Scale resize handler
    this.scale.on("resize", () => this.updateCameraZoom());

    // Input handlers
    this.input.on("pointerdown", (pointer) => {
      if (this.started && !pointer.event.target?.closest?.("button")) {
        this.combat.performAttack();
      }
    });

    this.input.keyboard.on("keydown-SPACE", () => {
      if (this.started) this.combat.performAttack();
    });

    this.input.keyboard.on("keydown-Q", () => {
      if (this.started) this.combat.performSkill();
    });

    // Wire UI controls
    this.uiManager.initControls({
      onStart: () => this.startGame(),
      onSoundToggle: () => toggleAudio(),
      onMove: (direction) => this.player.setTouchDirection(direction),
      onAttack: () => {
        if (this.started) this.combat.performAttack();
      }
    });

    // Enemy respawn loop
    this.spawnTimer = this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => this.enemyManager.respawnEnemies()
    });

    // Initial HUD update
    this.uiManager.updateHud(this.player.stats);
  }

  updateCameraZoom() {
    const zoom = Math.min(this.scale.width / 1000, this.scale.height / 570, 1.1);
    this.cameras.main.setZoom(zoom);
  }

  startGame() {
    this.started = true;
    this.player.sprite.body.enable = true;
    this.uiManager.addLog("Bạn đã đặt chân đến Trường An. Chúc hiệp khách hành tẩu bình an.");
    this.player.setPosition(640, 620);
  }

  update(time, delta) {
    if (!this.player) return;

    // Update player movement and animation
    this.player.update(time, delta);

    // Update enemies and check attacks against player
    this.enemyManager.update(time, delta, this.player, (wolf) => {
      if (this.started) {
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
