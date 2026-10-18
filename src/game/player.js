import * as Phaser from "phaser";
import { createHealthBar, layoutHealthBar } from "./healthBarView.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { EQUIPMENT_SLOTS, defaultEquipment, equippedIn } from "./equipment.js";
import {
  directionFromVelocity,
  idleFrame,
  walkAnimKey,
  ensureHeroWalkAnims,
  HERO8_DISPLAY,
  HERO8_FOOT_Y
} from "./heroDirections.js";

/**
 * Hero sprite display size (front stance). Full-canvas equipment art (116x320
 * like hero.png) is drawn at the same size so it lines up with the body.
 */
const HERO_DISPLAY = { w: 30, h: 82 };

/**
 * Per-slot placeholder geometry, in body-local coordinates (same space as the
 * hero sprite, which is centred on the body container). Used until real layered
 * art exists for a slot.
 */
const EQUIPMENT_LAYOUT = {
  color: {
    boots: 0x8a6a3a,
    armor: 0x7fb0d8,
    helmet: 0xf0c85a,
    accessory: 0xc06ad9,
    weapon: 0xd7e3e8
  },
  front: {
    boots: { x: 0, y: 20, w: 30, h: 12 },
    armor: { x: 0, y: -2, w: 34, h: 34 },
    helmet: { x: 0, y: -25, w: 26, h: 14 },
    accessory: { x: -10, y: -6, w: 12, h: 12 },
    weapon: { x: 14, y: 6, w: 10, h: 48, angle: 12 }
  },
  side: {
    boots: { x: 4, y: 20, w: 30, h: 12 },
    armor: { x: 2, y: -2, w: 30, h: 34 },
    helmet: { x: 2, y: -25, w: 24, h: 14 },
    accessory: { x: -4, y: -6, w: 12, h: 12 },
    weapon: { x: 18, y: 6, w: 10, h: 48, angle: 20 }
  }
};

export class Player {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} [name]
   */
  constructor(scene, x = 640, y = 620, name = "Lãng Khách") {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;
    this.name = name;

    this.stats = {
      level: 1,
      hp: 100,
      maxHp: 100,
      mp: 60,
      maxMp: 60,
      attack: 24,
      defense: 6,
      critRate: 0.12,
      critDamage: 1.5,
      exp: 0,
      nextExp: 100,
      coins: 0,
      kills: 0
    };

    this.touchDirection = null;
    this.invulnerable = false;
    /** Worn items, slot -> item id. Visual layers live in this.equipLayers. */
    this.equipment = defaultEquipment();
    this.equipLayers = null;
    // PK opt-in flag: only a flagged player may fight or be fought (see pvp.js).
    this.pkFlag = false;
    this.targetX = null;
    this.targetY = null;
    this.isMovingToTarget = false;

    // Movement & wuxia animation states
    this.stepPhase = 0;
    this.lastDustTime = 0;
    this.currentStance = "front"; // "front" | "side"
    // Sprite column (0..7) the hero currently faces on the 8-direction sheet.
    this.facingColumn = 0;

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
    const iso = toIso(x, y);
    this.visual = this.scene.add.container(iso.x, iso.y);
    this.visual.setDepth(isoDepth(x, y));
    this.drawHero(this.visual);

    this.nameText = this.scene.add.text(iso.x, iso.y - 60, this.name, {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "12px",
      color: "#5cfc5c",
      stroke: "#081008",
      strokeThickness: 2,
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(isoDepth(x, y) + 100);

    // Health bar sits between the name and the character's head
    const healthBar = createHealthBar(this.scene, iso.x, iso.y);
    this.hpBack = healthBar.back;
    this.hpFill = healthBar.fill;
    this.updateHealthBar(iso.x, iso.y, isoDepth(x, y));
  }

  /**
   * Reposition and redraw the overhead health bar from the current stats.
   * @param {number} x
   * @param {number} y - world Y the bar is drawn relative to (follows the walk bob)
   * @param {number} [depthBase=y] - stable Y used for depth sorting
   */
  updateHealthBar(x, y, depthBase = y) {
    layoutHealthBar(
      { back: this.hpBack, fill: this.hpFill },
      x,
      y,
      depthBase,
      this.stats.hp,
      this.stats.maxHp
    );
  }

  drawHero(container) {
    // 1. Soft ground shadow under character feet
    this.shadow = this.scene.add.ellipse(0, 41, 42, 13, 0x090e0c, 0.45);

    // 2. Character body container for isolated walk cycle, squash/stretch, tilt & attack recoil
    this.body = this.scene.add.container(0, 0);

    // 2. Animated 8-direction hero. Every direction's walk cycle is registered
    //    once here; the current facing chooses which one plays.
    this.has8Dir = this.scene.textures.exists("hero-8dir");
    ensureHeroWalkAnims(this.scene);

    if (this.has8Dir) {
      this.heroImage = this.scene.add.sprite(0, 0, "hero-8dir", idleFrame(this.facingColumn));
      this.heroImage.setOrigin(0.5, 1);
      this.heroImage.setDisplaySize(HERO8_DISPLAY.w, HERO8_DISPLAY.h);
      this.heroImage.y = HERO8_FOOT_Y;

      this.body.add([this.heroImage]);
      this.createEquipmentLayers();
      container.add([this.shadow, this.body]);
      return;
    }

    // Fallback: static single-frame art if the 8-direction sheet is missing.
    if (this.scene.textures.exists("hero-sprite")) {
      this.heroImage = this.scene.add.sprite(0, 0, "hero-sprite");
      this.heroImage.setDisplaySize(30, 82);
      this.heroImage.setOrigin(0.5, 0.5);

      this.body.add([this.heroImage]);
      this.createEquipmentLayers();
      container.add([this.shadow, this.body]);
      return;
    }

    // Fallback vector drawing if texture fails to load

    // 3. Back coat tails (Royal blue & white lining flowing behind)
    const backCoat = this.scene.add.polygon(0, 10, [[-9, -6], [9, -6], [14, 16], [-14, 16]], 0x1e3a8a).setStrokeStyle(1.2, 0x172554);
    const whiteTail = this.scene.add.polygon(-6, 12, [[-6, -6], [2, -6], [0, 14], [-10, 12]], 0xf1f5f9, 0.95).setStrokeStyle(1, 0xcfd8dc);

    // 4. Lower body: Crimson red martial trousers & Purple greaves
    const legL = this.scene.add.rectangle(-6, 13, 5.5, 10, 0xb91c1c);
    const legR = this.scene.add.rectangle(6, 13, 5.5, 10, 0xb91c1c);

    // Purple tall boots (Ủng chiến tím)
    const bootL = this.scene.add.rectangle(-6, 21, 6.5, 11, 0x6b21a8).setStrokeStyle(1, 0x3b0764);
    const bootR = this.scene.add.rectangle(6, 21, 6.5, 11, 0x6b21a8).setStrokeStyle(1, 0x3b0764);

    // Silver circular knee ornaments (Họa tiết nguyệt ngân)
    const kneeL = this.scene.add.circle(-6, 17, 2.6, 0xe2e8f0).setStrokeStyle(1, 0x475569);
    const kneeR = this.scene.add.circle(6, 17, 2.6, 0xe2e8f0).setStrokeStyle(1, 0x475569);

    // Cyan boot decorative bands
    const bandL = this.scene.add.line(0, 0, -9, 23, -3, 23, 0x38bdf8).setLineWidth(1.2);
    const bandR = this.scene.add.line(0, 0, 3, 23, 9, 23, 0x38bdf8).setLineWidth(1.2);

    // Dark indigo martial shoes
    const shoeL = this.scene.add.ellipse(-6, 26, 8, 3.5, 0x2e1065);
    const shoeR = this.scene.add.ellipse(6, 26, 8, 3.5, 0x2e1065);

    // 5. White front apron with red accents (Vạt áo trắng họa tiết đỏ)
    const frontApron = this.scene.add.rectangle(0, 10, 14, 16, 0xf8fafc).setStrokeStyle(1, 0xcfd8dc);
    const apronHem = this.scene.add.rectangle(0, 17, 14, 2.5, 0x1d4ed8);
    const ribbonL = this.scene.add.line(0, 0, -4, 4, -4, 15, 0xdc2626).setLineWidth(1.8);
    const ribbonR = this.scene.add.line(0, 0, 4, 4, 4, 15, 0xdc2626).setLineWidth(1.8);

    // 6. Upper Torso (Áo lam Võ Đang - Royal Blue Tunic)
    const tunic = this.scene.add.rectangle(0, -3, 20, 15, 0x2563eb).setStrokeStyle(1.5, 0x1d4ed8);
    const tunicRoll = this.scene.add.ellipse(0, 3, 20, 5, 0x1e40af);
    const collar = this.scene.add.arc(0, -9, 4.5, 0, 180, false, 0xdc2626).setStrokeStyle(1.8, 0xef4444);

    // White shoulder racing stripes
    const shoulderL = this.scene.add.line(0, 0, -8, -10, -11, -3, 0xffffff).setLineWidth(1.5);
    const shoulderR = this.scene.add.line(0, 0, 8, -10, 11, -3, 0xffffff).setLineWidth(1.5);

    // Red chest accent seams
    const redSeamL = this.scene.add.line(0, 0, -4, -8, -7, -2, 0xdc2626).setLineWidth(1.4);
    const redSeamR = this.scene.add.line(0, 0, 4, -8, 7, -2, 0xdc2626).setLineWidth(1.4);

    // 7. Arms with studded leather bracers (Giáp cổ tay đinh tán)
    // Left arm
    const sleeveL = this.scene.add.rectangle(-11, -4, 5, 8, 0x2563eb);
    const bracerL = this.scene.add.rectangle(-12, 1, 5.5, 5.5, 0x292524).setStrokeStyle(0.8, 0x78716c);
    const studL1 = this.scene.add.circle(-12, 0, 0.9, 0xffffff);
    const studL2 = this.scene.add.circle(-12, 2.4, 0.9, 0xffffff);
    const handL = this.scene.add.circle(-12, 6, 2.2, 0xfcd34d);

    // Right arm (Holding sword)
    const sleeveR = this.scene.add.rectangle(11, -4, 5, 8, 0x2563eb);
    const bracerR = this.scene.add.rectangle(12, 1, 5.5, 5.5, 0x292524).setStrokeStyle(0.8, 0x78716c);
    const studR1 = this.scene.add.circle(12, 0, 0.9, 0xffffff);
    const studR2 = this.scene.add.circle(12, 2.4, 0.9, 0xffffff);
    const handR = this.scene.add.circle(12, 6, 2.2, 0xfcd34d);

    // 8. Longsword (Trường kiếm chuôi vàng)
    const swordPommel = this.scene.add.circle(13, 0, 1.8, 0xf59e0b);
    const swordGuard = this.scene.add.rectangle(13, 3, 7, 2.5, 0xf59e0b).setStrokeStyle(0.6, 0xb45309);
    const swordBlade = this.scene.add.line(0, 0, 13, 5, 16, 24, 0xe2e8f0).setLineWidth(2.5);
    const swordTip = this.scene.add.circle(16, 24, 1.2, 0xffffff);

    // 9. Head, Face & Hair Topknot (Búi tóc đỉnh đầu cài ngọc)
    const neck = this.scene.add.rectangle(0, -11, 5, 4, 0xfde68a);
    const face = this.scene.add.ellipse(0, -17, 12, 13.5, 0xfef08a).setStrokeStyle(1, 0xd97706, 0.4);

    // Facial features (Eyes & Eyebrows)
    const eyeL = this.scene.add.rectangle(-3, -17, 2, 1, 0x0f172a);
    const eyeR = this.scene.add.rectangle(3, -17, 2, 1, 0x0f172a);
    const eyebrowL = this.scene.add.line(0, 0, -4.5, -19, -1.5, -18.5, 0x0f172a).setLineWidth(1);
    const eyebrowR = this.scene.add.line(0, 0, 1.5, -18.5, 4.5, -19, 0x0f172a).setLineWidth(1);

    // Long hair framing locks (Lọn tóc dài rủ hai bên)
    const lockL = this.scene.add.line(0, 0, -5.5, -20, -7.5, -9, 0x0f172a).setLineWidth(2);
    const lockR = this.scene.add.line(0, 0, 5.5, -20, 7.5, -9, 0x0f172a).setLineWidth(2);
    const fringe = this.scene.add.triangle(0, -21, -5.5, 0, 5.5, 0, 0, 3.5, 0x0f172a);
    const hairCrown = this.scene.add.ellipse(0, -22, 13, 8, 0x0f172a);

    // Topknot & Jade ring (Búi tóc & Trâm ngọc xanh)
    const bun = this.scene.add.circle(0, -27, 4.2, 0x0f172a);
    const jadeRing = this.scene.add.rectangle(0, -24.5, 5, 2.2, 0x10b981).setStrokeStyle(0.8, 0x047857);
    const bunTop = this.scene.add.triangle(0, -31, -2.5, 2, 2.5, 2, 0, -2, 0x0f172a);

    this.body.add([
      backCoat,
      whiteTail,
      legL,
      legR,
      bootL,
      bootR,
      kneeL,
      kneeR,
      bandL,
      bandR,
      shoeL,
      shoeR,
      frontApron,
      apronHem,
      ribbonL,
      ribbonR,
      tunic,
      tunicRoll,
      collar,
      shoulderL,
      shoulderR,
      redSeamL,
      redSeamR,
      sleeveL,
      bracerL,
      studL1,
      studL2,
      handL,
      sleeveR,
      bracerR,
      studR1,
      studR2,
      handR,
      swordBlade,
      swordTip,
      swordGuard,
      swordPommel,
      neck,
      face,
      eyeL,
      eyeR,
      eyebrowL,
      eyebrowR,
      lockL,
      lockR,
      fringe,
      hairCrown,
      bun,
      jadeRing,
      bunTop
    ]);

    this.createEquipmentLayers();
    container.add([this.shadow, this.body]);
  }

  /**
   * Build one sprite per equipment slot, stacked over the body in layer order.
   * A slot shows real art when a texture `equip-<slot>-<itemId>` is loaded;
   * otherwise it falls back to a tinted placeholder block. Layers start hidden.
   */
  createEquipmentLayers() {
    if (this.equipLayers) return;

    // The 8-direction art already bakes the full outfit into the sprite and the
    // legacy 116x320 overlays no longer line up with it, so no layers are built
    // while the animated hero is in use. Equipment data/UI are unaffected.
    if (this.has8Dir) return;

    this.equipLayers = {};
    this.equipArt = {};

    const defaultTexture = this.scene.textures.exists("equip-placeholder")
      ? "equip-placeholder"
      : "entity-dot";

    EQUIPMENT_SLOTS.forEach(({ key }) => {
      const layer = this.scene.add.sprite(0, 0, defaultTexture);
      layer.setOrigin(0.5, 0.5);
      layer.setVisible(false);
      this.body.add(layer);
      this.equipLayers[key] = layer;
    });

    this.layoutEquipment();
  }

  /**
   * Position/size every equipment layer for the current stance and visibility.
   * Real art is a full-canvas overlay drawn at the hero's size (front stance
   * only, until side art exists); placeholders use the per-slot boxes.
   */
  layoutEquipment() {
    if (!this.equipLayers) return;
    const side = this.currentStance === "side";
    const box = side ? EQUIPMENT_LAYOUT.side : EQUIPMENT_LAYOUT.front;

    EQUIPMENT_SLOTS.forEach(({ key }) => {
      const layer = this.equipLayers[key];
      if (!layer) return;
      const equipped = Boolean(equippedIn(this.equipment, key));
      const hasArt = Boolean(this.equipArt?.[key]);

      if (hasArt) {
        layer.setPosition(0, 0);
        layer.setAngle(0);
        layer.setDisplaySize(HERO_DISPLAY.w, HERO_DISPLAY.h);
        layer.setVisible(equipped && !side);
        return;
      }

      const b = box[key];
      if (!b) return;
      layer.setPosition(b.x, b.y);
      layer.setAngle(b.angle || 0);
      layer.setDisplaySize(b.w, b.h);
      layer.setVisible(equipped);
    });
  }

  /**
   * Show the worn items: real layered art when available, otherwise a tinted
   * placeholder block. Safe to call repeatedly (stance changes re-run it).
   * @param {Record<string, string|null>} [equipment]
   */
  applyEquipment(equipment = this.equipment) {
    this.equipment = { ...defaultEquipment(), ...(equipment || {}) };
    if (!this.equipLayers) return;

    this.equipArt = {};
    EQUIPMENT_SLOTS.forEach(({ key }) => {
      const layer = this.equipLayers[key];
      if (!layer) return;

      const itemId = equippedIn(this.equipment, key);
      const artKey = itemId ? `equip-${key}-${itemId}` : null;
      const hasArt = Boolean(artKey && this.scene.textures.exists(artKey));
      this.equipArt[key] = hasArt ? artKey : null;

      if (hasArt) {
        layer.setTexture(artKey);
        layer.clearTint();
      } else {
        layer.setTexture(
          this.scene.textures.exists("equip-placeholder") ? "equip-placeholder" : "entity-dot"
        );
        layer.setTint(EQUIPMENT_LAYOUT.color[key]);
      }
    });

    this.layoutEquipment();
  }

  /**
   * Turn the hero to a sprite column (0..7) and start that direction's walk
   * cycle. Also keeps `currentStance` in sync for equipment gating and the
   * network report.
   * @param {number} column
   */
  faceDirection(column) {
    if (!this.heroImage || !this.has8Dir) return;

    this.facingColumn = column;
    const nextStance = column === 0 ? "front" : "side";
    if (nextStance !== this.currentStance) {
      this.currentStance = nextStance;
      this.layoutEquipment();
    }

    const key = walkAnimKey(column);
    if (this.scene.anims.exists(key)) {
      this.heroImage.play(key, true);
    }
  }

  /** Stop the walk cycle and hold the idle pose for the current direction. */
  idlePose() {
    if (!this.heroImage || !this.has8Dir) return;
    if (this.heroImage.anims.isPlaying) {
      this.heroImage.stop();
    }
    this.heroImage.setFrame(idleFrame(this.facingColumn));
  }

  createKeyboard() {
    this.keys = this.scene.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q", false);
  }

  update(time, delta) {
    if (!this.sprite || !this.sprite.body) return;

    this.updateMovement();

    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const speed = this.sprite.body.velocity.length();

    if (speed > 15) {
      if (this.has8Dir) {
        // Face the way we move on screen; the sheet's own walk cycle carries the
        // legwork, so no procedural bob/squash is layered on top of it.
        this.faceDirection(directionFromVelocity(vx, vy));
        this.body.y = Phaser.Math.Linear(this.body.y, 0, 0.35);
      } else {
        // Legacy fallback: procedural bob over the static art.
        this.stepPhase += delta * 0.016 * Math.min(speed / 120, 1.8);
        this.body.y = -Math.abs(Math.sin(this.stepPhase)) * 4.5;
      }

      this.body.rotation = Phaser.Math.Linear(this.body.rotation, 0, 0.2);
      this.body.setScale(1, 1);
      this.shadow.setScale(1, 1);
      this.shadow.setAlpha(0.45);

      // Footstep dust puff when foot strikes the road
      if (time - this.lastDustTime > 190) {
        this.lastDustTime = time;
        this.spawnFootstepDust(this.sprite.x, this.sprite.y + 40, vx, vy);
      }
    } else {
      // Stopped moving - hold the idle pose facing the last direction
      this.idlePose();

      // Idle breathing cycle (Qi Gong internal breathing)
      const breath = Math.sin(time * 0.0035);
      const breathBounce = breath * 0.8;
      const bodyScaleY = 1 + breath * 0.018;
      const bodyScaleX = 1 - breath * 0.012;

      this.body.y = breathBounce;
      this.body.rotation = Phaser.Math.Linear(this.body.rotation, 0, 0.14);
      this.body.setScale(bodyScaleX, bodyScaleY);

      this.shadow.setScale(1 + breath * 0.02, 1 + breath * 0.02);
      this.shadow.setAlpha(0.45);
    }

    // Depth sorting based on the isometric position of the ground cell
    const iso = toIso(this.sprite.x, this.sprite.y);
    const depth = isoDepth(this.sprite.x, this.sprite.y);
    this.visual.setPosition(iso.x, iso.y);
    this.visual.setDepth(depth);
    this.nameText.setPosition(iso.x, iso.y - 60 + this.body.y * 0.35);
    this.nameText.setDepth(depth + 100);
    this.updateHealthBar(iso.x, iso.y + this.body.y * 0.35, depth);
  }

  spawnFootstepDust(x, y, vx, vy) {
    const base = toIso(x, y);
    const offsetX = -Math.sign(vx) * (7 + Math.random() * 4);
    const offsetY = (Math.random() - 0.5) * 3;

    const dust = this.scene.add.ellipse(base.x + offsetX, base.y + offsetY, 7, 4, 0xc4b998, 0.42);
    dust.setDepth(isoDepth(x, y) - 2);

    this.scene.tweens.add({
      targets: dust,
      x: dust.x + offsetX * 0.4,
      y: dust.y - 2,
      scaleX: 1.8,
      scaleY: 1.4,
      alpha: 0,
      duration: 280,
      ease: "Quad.easeOut",
      onComplete: () => dust.destroy()
    });
  }

  playAttackMotion() {
    if (!this.body) return;
    this.scene.tweens.add({
      targets: this.body,
      x: 7,
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 75,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (this.body) this.body.x = 0;
      }
    });
  }

  playSkillMotion() {
    if (!this.body) return;
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1.15,
      scaleY: 0.88,
      duration: 80,
      yoyo: true,
      ease: "Quad.easeOut"
    });
  }

  updateMovement() {
    const isTyping = typeof document !== "undefined" && (
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA"
    );
    if (isTyping) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    const k = this.keys;
    const keyLeft = k.A.isDown || k.LEFT.isDown || this.touchDirection === "left";
    const keyRight = k.D.isDown || k.RIGHT.isDown || this.touchDirection === "right";
    const keyUp = k.W.isDown || k.UP.isDown || this.touchDirection === "up";
    const keyDown = k.S.isDown || k.DOWN.isDown || this.touchDirection === "down";

    // If keyboard or touch-dpad is active, cancel target movement and prioritize keys
    if (keyLeft || keyRight || keyUp || keyDown) {
      this.isMovingToTarget = false;
      this.targetX = null;
      this.targetY = null;

      let vx = 0;
      let vy = 0;
      if (keyLeft) vx -= 1;
      if (keyRight) vx += 1;
      if (keyUp) vy -= 1;
      if (keyDown) vy += 1;

      const vector = new Phaser.Math.Vector2(vx, vy);
      if (vector.length() > 0) {
        vector.normalize().scale(175);
      }

      this.sprite.setVelocity(vector.x, vector.y);
      return;
    }

    // Click-to-move handling
    if (this.isMovingToTarget && this.targetX !== null && this.targetY !== null) {
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.targetX, this.targetY);

      if (dist <= 8) {
        this.stopMovement();
        return;
      }

      const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.targetX, this.targetY);
      const vx = Math.cos(angle) * 175;
      const vy = Math.sin(angle) * 175;

      this.sprite.setVelocity(vx, vy);
      return;
    }

    this.sprite.setVelocity(0, 0);
  }

  moveTo(x, y) {
    this.targetX = x;
    this.targetY = y;
    this.isMovingToTarget = true;
  }

  stopMovement() {
    this.isMovingToTarget = false;
    this.targetX = null;
    this.targetY = null;
    if (this.sprite?.body) {
      this.sprite.setVelocity(0, 0);
    }
  }

  setName(name) {
    if (!name) return;
    this.name = name;
    if (this.nameText) {
      this.nameText.setText(name);
    }
  }

  /**
   * Brief hit reaction driven by a server HP drop: flicker the body and grant a
   * short local immunity window so the render matches the server's i-frames.
   */
  flashHit() {
    if (!this.visual) return;
    this.invulnerable = true;
    this.visual.setAlpha(0.45);
    this.scene.time.delayedCall(700, () => {
      this.invulnerable = false;
      if (this.visual) this.visual.setAlpha(1);
    });
  }

  /**
   * Set the PK opt-in flag and reflect it on the overhead name (red when flagged).
   * @param {boolean} flagged
   */
  setPkFlag(flagged) {
    this.pkFlag = flagged === true;
    if (this.nameText) {
      this.nameText.setColor(this.pkFlag ? "#ff5555" : "#5cfc5c");
    }
  }

  setPosition(x, y) {
    this.stopMovement();
    this.sprite.setPosition(x, y);
    const iso = toIso(x, y);
    const depth = isoDepth(x, y);
    this.visual.setPosition(iso.x, iso.y);
    this.visual.setDepth(depth);
    this.nameText.setPosition(iso.x, iso.y - 60);
    this.nameText.setDepth(depth + 100);
    this.updateHealthBar(iso.x, iso.y, depth);
  }

  respawn() {
    this.stopMovement();
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

  /** Coarse left/right facing derived from the current sprite column. */
  get facing() {
    return this.facingColumn >= 5 ? "left" : "right";
  }

  get attack() {
    return this.stats?.attack ?? 24;
  }

  get defense() {
    return this.stats?.defense ?? 6;
  }

  get critRate() {
    return this.stats?.critRate ?? 0.12;
  }

  get critDamage() {
    return this.stats?.critDamage ?? 1.5;
  }
}
