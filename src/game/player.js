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
    this.targetX = null;
    this.targetY = null;
    this.isMovingToTarget = false;

    // Movement & wuxia animation states
    this.stepPhase = 0;
    this.lastDustTime = 0;
    this.lastTrailTime = 0;
    this.currentStance = "front"; // "front" | "side"

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
    // 1. Soft ground shadow
    this.shadow = this.scene.add.ellipse(0, 34, 40, 13, 0x090e0c, 0.45);

    // 2. Character body container for isolated walk cycle, squash/stretch, tilt & attack recoil
    this.body = this.scene.add.container(0, 0);

    // Register side walk animation (Clean 2-frame strides)
    if (this.scene.textures.exists("hero-side-walk") && !this.scene.anims.exists("player-side-walk")) {
      this.scene.anims.create({
        key: "player-side-walk",
        frames: this.scene.anims.generateFrameNumbers("hero-side-walk", { start: 0, end: 1 }),
        frameRate: 6,
        repeat: -1
      });
    }

    // 2. High-definition character visuals (Clean 2-leg authentic models)
    if (this.scene.textures.exists("hero-sprite")) {
      this.aura = this.scene.add.circle(0, 0, 32, 0x3b82f6, 0.06);
      this.heroImage = this.scene.add.sprite(0, 0, "hero-sprite");
      this.heroImage.setDisplaySize(28, 76);
      this.heroImage.setOrigin(0.5, 0.5);

      this.body.add([this.aura, this.heroImage]);
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

    container.add([this.shadow, this.body]);
  }

  setStance(stance) {
    if (this.currentStance === stance || !this.heroImage) return;
    this.currentStance = stance;

    if (stance === "side") {
      if (this.scene.textures.exists("hero-side-walk")) {
        this.heroImage.setTexture("hero-side-walk", 0);
        this.heroImage.setDisplaySize(67, 76);
        this.heroImage.setOrigin(0.44, 0.5);
      }
    } else {
      if (this.heroImage.anims && this.heroImage.anims.isPlaying) {
        this.heroImage.stop();
      }
      if (this.scene.textures.exists("hero-sprite")) {
        this.heroImage.setTexture("hero-sprite");
        this.heroImage.setDisplaySize(28, 76);
        this.heroImage.setOrigin(0.5, 0.5);
      }
    }
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
      // Prioritize side profile view when moving horizontally (turn sideways, not crab walking)
      const isHorizontal = Math.abs(vx) >= Math.abs(vy) * 0.65;
      this.setStance(isHorizontal ? "side" : "front");

      if (this.currentStance === "side") {
        if (this.scene.anims.exists("player-side-walk") && !this.heroImage.anims.isPlaying) {
          this.heroImage.play("player-side-walk");
        }
      } else {
        if (this.heroImage.anims && this.heroImage.anims.isPlaying) {
          this.heroImage.stop();
        }
      }

      // Advance walk cycle synchronized with actual movement velocity
      this.stepPhase += delta * 0.016 * Math.min(speed / 120, 1.8);

      // Dynamic bobbing: natural arc of legs pushing up and landing
      const sinStep = Math.sin(this.stepPhase);
      const bounceY = -Math.abs(sinStep) * 4.5;

      // Natural stride stretch & compression along movement pace (2 legs only, no 3rd leg)
      const strideScale = Math.sin(this.stepPhase * 2) * 0.035;
      this.body.setScale(1 + strideScale, 1 - strideScale);

      // Subtle forward lean / aerodynamic sprint tilt
      const targetTilt = 0.065;
      this.body.rotation = Phaser.Math.Linear(this.body.rotation, targetTilt, 0.18);
      this.body.y = bounceY;

      // Dynamic ground shadow responds to elevation
      const shadowFactor = 1 - (Math.abs(bounceY) / 4.5) * 0.22;
      this.shadow.setScale(shadowFactor, shadowFactor);
      this.shadow.setAlpha(0.48 * shadowFactor);

      // Footstep dust puff when foot strikes the road
      if (time - this.lastDustTime > 190) {
        this.lastDustTime = time;
        this.spawnFootstepDust(this.sprite.x, this.sprite.y + 32, vx, vy);
      }

      // Wuxia Qinggong ghost afterimage trail
      if (speed > 40 && time - this.lastTrailTime > 68) {
        this.lastTrailTime = time;
        this.spawnGhostTrail(this.sprite.x, this.sprite.y, this.visual.scaleX, this.body.rotation, this.body.y);
      }
    } else {
      // Stopped moving - reset walk animation
      if (this.currentStance === "side" && this.heroImage.anims && this.heroImage.anims.isPlaying) {
        this.heroImage.stop();
        this.heroImage.setFrame(0);
      }

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

    // Depth sorting based on Y position
    this.sprite.setDepth(this.sprite.y);
    this.visual.setPosition(this.sprite.x, this.sprite.y);
    this.visual.setDepth(this.sprite.y);
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 56 + this.body.y * 0.35);
  }

  spawnGhostTrail(x, y, facing, rotation, bodyOffsetY) {
    if (!this.heroImage) return;

    const currentTexture = this.heroImage.texture.key;
    const currentFrame = this.heroImage.frame ? this.heroImage.frame.name : 0;
    const ghost = this.scene.add.sprite(x, y + bodyOffsetY, currentTexture, currentFrame);
    ghost.setDisplaySize(this.heroImage.displayWidth, this.heroImage.displayHeight);
    ghost.setOrigin(this.heroImage.originX, this.heroImage.originY);
    ghost.setScale(facing * (this.heroImage.displayWidth / (ghost.width || 1)), this.heroImage.displayHeight / (ghost.height || 1));
    ghost.setRotation(rotation);
    ghost.setDepth(y - 1);
    ghost.setTint(0x38bdf8); // Azure martial sword qi tint
    ghost.setAlpha(0.38);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: facing * (this.heroImage.displayWidth / (ghost.width || 1)) * 1.05,
      scaleY: (this.heroImage.displayHeight / (ghost.height || 1)) * 1.05,
      duration: 250,
      ease: "Cubic.easeOut",
      onComplete: () => ghost.destroy()
    });
  }

  spawnFootstepDust(x, y, vx, vy) {
    const offsetX = -Math.sign(vx) * (7 + Math.random() * 4);
    const offsetY = (Math.random() - 0.5) * 3;

    const dust = this.scene.add.ellipse(x + offsetX, y + offsetY, 7, 4, 0xc4b998, 0.42);
    dust.setDepth(y - 2);

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

      if (vx !== 0) {
        this.visual.setScale(vx < 0 ? -1 : 1, 1);
      }
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

      if (Math.abs(vx) > 10) {
        this.visual.setScale(vx < 0 ? -1 : 1, 1);
      }
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

  setPosition(x, y) {
    this.stopMovement();
    this.sprite.setPosition(x, y);
    this.visual.setPosition(x, y);
    this.nameText.setPosition(x, y - 55);
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
}
