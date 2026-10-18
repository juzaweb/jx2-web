import * as Phaser from "phaser";
import { createHealthBar, layoutHealthBar } from "./healthBarView.js";
import { toIso, isoDepth } from "./isoProjection.js";

/** Distance (px) a packet may move a peer before it is treated as a teleport. */
const TELEPORT_SNAP_THRESHOLD = 200;

/**
 * RemotePlayer
 * Represents an online remote player character in the game world.
 */
export class RemotePlayer {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} data
   */
  constructor(scene, data = {}) {
    this.scene = scene;
    this.id = data.id;
    this.username = data.username || "Lãng Khách";
    this.displayName = data.displayName || this.username;
    this.x = typeof data.x === "number" ? data.x : 640;
    this.y = typeof data.y === "number" ? data.y : 620;
    this.targetX = this.x;
    this.targetY = this.y;
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    this.direction = data.direction === "left" ? "left" : "right";
    this.stance = data.stance === "side" ? "side" : "front";
    this.hp = Number.isFinite(data.hp) ? data.hp : 100;
    this.maxHp = Number.isFinite(data.maxHp) && data.maxHp > 0 ? data.maxHp : 100;
    this.pkFlag = data.pkFlag === true;

    this.stepPhase = 0;
    this.createVisuals();
  }

  createVisuals() {
    const iso = toIso(this.x, this.y);
    this.container = this.scene.add.container(iso.x, iso.y);
    this.container.setDepth(isoDepth(this.x, this.y));

    // 1. Soft ground shadow under feet
    this.shadow = this.scene.add.ellipse(0, 41, 42, 13, 0x090e0c, 0.45);

    // 2. Body container for animations
    this.body = this.scene.add.container(0, 0);

    // 3. Hero sprite
    if (this.scene.textures.exists("hero-sprite")) {
      this.heroImage = this.scene.add.sprite(0, 0, "hero-sprite");
      this.heroImage.setDisplaySize(30, 82);
      this.heroImage.setOrigin(0.5, 0.5);
      this.body.add(this.heroImage);
    }

    this.container.add([this.shadow, this.body]);

    // 4. Overhead name (authentic JX2 style)
    this.nameText = this.scene.add
      .text(iso.x, iso.y - 60, this.displayName, {
        fontFamily: "Arial, Tahoma, sans-serif",
        fontSize: "12px",
        color: this.pkFlag ? "#ff5555" : "#5cfc5c",
        stroke: "#081008",
        strokeThickness: 2,
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(isoDepth(this.x, this.y) + 100);

    const healthBar = createHealthBar(this.scene, iso.x, iso.y);
    this.hpBack = healthBar.back;
    this.hpFill = healthBar.fill;
    this.updateHealthBar(iso.x, iso.y);

    this.applyStance(this.stance);
    this.applyDirection(this.direction);
  }

  applyDirection(dir) {
    this.direction = dir;
    const facing = dir === "left" ? -1 : 1;
    if (this.body) {
      this.body.setScale(facing, 1);
    }
  }

  applyStance(stance) {
    this.stance = stance;
    if (!this.heroImage) return;

    if (stance === "side") {
      if (this.scene.textures.exists("hero-side-walk")) {
        this.heroImage.setTexture("hero-side-walk", 0);
        this.heroImage.setDisplaySize(73, 82);
        this.heroImage.setOrigin(0.44, 0.5);
      }
    } else {
      if (this.heroImage.anims && this.heroImage.anims.isPlaying) {
        this.heroImage.stop();
      }
      if (this.scene.textures.exists("hero-sprite")) {
        this.heroImage.setTexture("hero-sprite");
        this.heroImage.setDisplaySize(30, 82);
        this.heroImage.setOrigin(0.5, 0.5);
      }
    }
  }

  /**
   * Reposition and redraw the overhead health bar from the reported HP.
   * @param {number} x
   * @param {number} y
   */
  updateHealthBar(x, y) {
    layoutHealthBar({ back: this.hpBack, fill: this.hpFill }, x, y, isoDepth(this.x, this.y), this.hp, this.maxHp);
  }

  /**
   * Apply an authoritative HP report relayed by the server so peers see each
   * other's health. Unusable values are ignored rather than clearing the bar.
   * @param {{hp?:number, maxHp?:number}} stats
   */
  /**
   * Update this peer's PK flag and recolour the overhead name accordingly.
   * @param {boolean} flagged
   */
  applyPkFlag(flagged) {
    this.pkFlag = flagged === true;
    if (this.nameText) {
      this.nameText.setColor(this.pkFlag ? "#ff5555" : "#5cfc5c");
    }
  }

  applyStats(stats = {}) {
    if (Number.isFinite(stats.maxHp) && stats.maxHp > 0) {
      this.maxHp = stats.maxHp;
    }
    if (Number.isFinite(stats.hp)) {
      this.hp = stats.hp;
    }
  }

  /**
   * Update position and animation from network packet
   * @param {Object} moveData
   */
  setTarget(moveData = {}) {
    if (typeof moveData.x === "number") this.targetX = moveData.x;
    if (typeof moveData.y === "number") this.targetY = moveData.y;
    if (typeof moveData.vx === "number") this.vx = moveData.vx;
    if (typeof moveData.vy === "number") this.vy = moveData.vy;

    if (moveData.direction && moveData.direction !== this.direction) {
      this.applyDirection(moveData.direction);
    }
    if (moveData.stance && moveData.stance !== this.stance) {
      this.applyStance(moveData.stance);
    }

    // A respawn or teleport arrives as one large jump; snap there at once so the
    // peer appears in the new spot instead of sliding across the whole map.
    if (Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY) > TELEPORT_SNAP_THRESHOLD) {
      this.x = this.targetX;
      this.y = this.targetY;
      const snapIso = toIso(this.x, this.y);
      if (this.container) this.container.setPosition(snapIso.x, snapIso.y);
    }
  }

  /**
   * Play visual sword attack arc
   * @param {boolean} facingRight
   */
  playAttack(facingRight = true) {
    const slashOffsetX = facingRight ? 16 : -16;
    const base = toIso(this.x, this.y);
    const slash = this.scene.add
      .arc(
        base.x + slashOffsetX,
        base.y - 7,
        34,
        facingRight ? -70 : 110,
        facingRight ? 70 : 250,
        false,
        0xe9d59c,
        0.9
      )
      .setStrokeStyle(5, 0xf2e3bd, 0.95)
      .setDepth(isoDepth(this.x, this.y) + 10);

    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.4,
      duration: 190,
      onComplete: () => slash.destroy()
    });
  }

  /**
   * Play visual Kiếm Khí skill ring
   */
  playSkill() {
    const base = toIso(this.x, this.y);
    const ring = this.scene.add
      .circle(base.x, base.y, 24, 0x80d7e9, 0.2)
      .setStrokeStyle(4, 0xb8e9f0, 0.9)
      .setDepth(isoDepth(this.x, this.y) + 5);

    this.scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy()
    });
  }

  /**
   * Frame update with smooth interpolation
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    if (!this.container || !this.container.active) return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);

    if (dist > 1.5) {
      // Smooth linear interpolation towards target network coordinates
      this.x = Phaser.Math.Linear(this.x, this.targetX, 0.22);
      this.y = Phaser.Math.Linear(this.y, this.targetY, 0.22);

      this.stepPhase += delta * 0.012;
      const bounceY = -Math.abs(Math.sin(this.stepPhase)) * 3.5;
      if (this.body) this.body.y = bounceY;

      if (this.stance === "side" && this.heroImage && this.scene.anims.exists("player-side-walk")) {
        if (!this.heroImage.anims.isPlaying) {
          this.heroImage.play("player-side-walk");
        }
      }
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
      if (this.body) this.body.y = 0;

      if (this.stance === "side" && this.heroImage && this.heroImage.anims.isPlaying) {
        this.heroImage.stop();
        this.heroImage.setFrame(0);
      }
    }

    // Depth sorting (isometric)
    const iso = toIso(this.x, this.y);
    const depth = isoDepth(this.x, this.y);
    this.container.setPosition(iso.x, iso.y);
    this.container.setDepth(depth);

    if (this.nameText) {
      this.nameText.setPosition(iso.x, iso.y - 60 + (this.body?.y || 0) * 0.35);
      this.nameText.setDepth(depth + 100);
    }

    this.updateHealthBar(iso.x, iso.y + (this.body?.y || 0) * 0.35);
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    if (this.nameText) {
      this.nameText.destroy();
      this.nameText = null;
    }
    if (this.hpBack) {
      this.hpBack.destroy();
      this.hpBack = null;
    }
    if (this.hpFill) {
      this.hpFill.destroy();
      this.hpFill = null;
    }
  }
}

