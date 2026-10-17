import * as Phaser from "phaser";

export class Player {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   */
  constructor(scene, x = 640, y = 620) {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;

    this.stats = {
      level: 1,
      hp: 100,
      maxHp: 100,
      mp: 60,
      maxMp: 60,
      exp: 0,
      nextExp: 100,
      coins: 0,
      kills: 0
    };

    this.touchDirection = null;
    this.invulnerable = false;

    this.createPhysicsSprite(x, y);
    this.createVisuals(x, y);
    this.createKeyboard();
  }

  createPhysicsSprite(x, y) {
    this.sprite = this.scene.physics.add.sprite(x, y, "entity-dot");
    this.sprite.setSize(24, 20);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);
    this.sprite.body.setDrag(700, 700);
    this.sprite.body.setMaxVelocity(220, 220);
    this.sprite.setVisible(false);
  }

  createVisuals(x, y) {
    this.visual = this.scene.add.container(x, y);
    this.visual.setDepth(y);
    this.drawHero(this.visual);

    this.nameText = this.scene.add.text(x, y - 42, "Lãng Khách", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#fff0c5",
      stroke: "#1c211c",
      strokeThickness: 3,
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(700);
  }

  drawHero(container) {
    const shadow = this.scene.add.ellipse(0, 18, 42, 14, 0x0b100d, 0.45);
    const cloak = this.scene.add.triangle(0, 2, -15, -8, 14, -8, 0, 22, 0x9d3433).setStrokeStyle(2, 0x5c2423);
    const body = this.scene.add.ellipse(0, 0, 23, 28, 0x263c53).setStrokeStyle(2, 0x9cb2b9);
    const belt = this.scene.add.rectangle(0, 7, 22, 4, 0xd5b66d);
    const head = this.scene.add.circle(0, -19, 10, 0xe4bd91).setStrokeStyle(2, 0x6a4d3b);
    const hair = this.scene.add.ellipse(0, -26, 23, 10, 0x20201d);
    const hat = this.scene.add.triangle(0, -30, -16, 3, 0, -12, 16, 3, 0x2b2925).setStrokeStyle(1, 0xc4a05b);
    const sword = this.scene.add.line(16, -1, 0, -17, 2, 17, 0xe6e2cf).setOrigin(0).setLineWidth(3);
    const glow = this.scene.add.circle(0, -1, 25, 0x6da7cc, 0.06);

    container.add([glow, shadow, cloak, body, belt, head, hair, hat, sword]);
  }

  createKeyboard() {
    this.keys = this.scene.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q");
  }

  update(time, delta) {
    if (!this.sprite || !this.sprite.body) return;

    // Depth sorting
    this.sprite.setDepth(this.sprite.y);
    this.visual.setPosition(this.sprite.x, this.sprite.y);
    this.visual.setDepth(this.sprite.y);
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 55);

    this.updateMovement();
  }

  updateMovement() {
    const k = this.keys;
    const left = k.A.isDown || k.LEFT.isDown || this.touchDirection === "left";
    const right = k.D.isDown || k.RIGHT.isDown || this.touchDirection === "right";
    const up = k.W.isDown || k.UP.isDown || this.touchDirection === "up";
    const down = k.S.isDown || k.DOWN.isDown || this.touchDirection === "down";

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    const vector = new Phaser.Math.Vector2(vx, vy);
    if (vector.length() > 0) {
      vector.normalize().scale(175);
    }

    this.sprite.setVelocity(vector.x, vector.y);

    if (vx !== 0) {
      this.visual.setScale(vx < 0 ? -1 : 1, 1);
    }
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
    this.visual.setPosition(x, y);
    this.nameText.setPosition(x, y - 55);
  }

  respawn() {
    this.setPosition(this.spawnX, this.spawnY);
    this.sprite.setVelocity(0, 0);
  }

  setTouchDirection(direction) {
    this.touchDirection = direction;
  }

  loadStats(savedStats) {
    if (!savedStats || typeof savedStats !== "object") return;
    this.stats = {
      ...this.stats,
      ...savedStats
    };
  }

  heal(amount) {
    const prev = this.stats.hp;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
    return this.stats.hp - prev;
  }

  restoreMp(amount) {
    const prev = this.stats.mp;
    this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + amount);
    return this.stats.mp - prev;
  }

  get x() {
    return this.sprite ? this.sprite.x : this.spawnX;
  }

  get y() {
    return this.sprite ? this.sprite.y : this.spawnY;
  }
}
