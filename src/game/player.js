import * as Phaser from "phaser";
import { createHealthBar, layoutHealthBar } from "./healthBarView.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { defaultEquipment } from "./equipment.js";
import { directionFromVelocity } from "./heroDirections.js";
import { crossedTarget, shouldSnap, travelStep } from "./clickToMove.js";
import { HeroRigView, HERO_FOOT_Y } from "./heroRigView.js";
import { normalizeGender } from "./gender.js";
import { WORLD_POSITION_SCALE, WORLD_SCALE, WORLD_SPEED_SCALE } from "./worldConfig.js";

const S = WORLD_SCALE;
const POS = WORLD_POSITION_SCALE;

export class Player {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} [name]
   * @param {"male"|"female"} [gender]
   */
  constructor(scene, x = 640 * POS, y = 620 * POS, name = "Lãng Khách", gender = "male") {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;
    this.name = name;
    /** Character gender drives the rig's silhouette ("male" | "female"). */
    this.gender = normalizeGender(gender);
    /** Sect id selects the skill kit (see skills.js). */
    this.sect = "thieu-lam";

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
    /** Worn items, slot -> item id. Drawn as overlays on the body sheet. */
    this.equipment = defaultEquipment();
    // PK opt-in flag: only a flagged player may fight or be fought (see pvp.js).
    this.pkFlag = false;
    this.targetX = null;
    this.targetY = null;
    this.finalX = null;
    this.finalY = null;
    this.isMovingToTarget = false;
    // Signed remaining distance on the active leg, used to detect overshoot.
    this.lastLegDx = 0;
    this.lastLegDy = 0;

    // Movement & wuxia animation states
    this.stepPhase = 0;
    this.lastDustTime = 0;
    // Direction the hero faces (0..7, see heroDirections.js).
    this.facingDirection = 0;

    this.createPhysicsSprite(x, y);
    this.createVisuals(x, y);
    this.createKeyboard();
  }

  createKeyboard() {
    if (!this.scene?.input?.keyboard?.addKeys) return;
    this.keys = this.scene.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT", false);
  }

  createPhysicsSprite(x, y) {
    this.sprite = this.scene.physics.add.sprite(x, y, "entity-dot");
    this.sprite.setSize(24 * S, 20 * S);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);
    this.sprite.body.setDrag(700 * POS * WORLD_SPEED_SCALE, 700 * POS * WORLD_SPEED_SCALE);
    this.sprite.body.setMaxVelocity(220 * POS * WORLD_SPEED_SCALE, 220 * POS * WORLD_SPEED_SCALE);
    this.sprite.setVisible(false);
  }

  createVisuals(x, y) {
    const iso = toIso(x, y);
    this.visual = this.scene.add.container(iso.x, iso.y);
    this.visual.setDepth(isoDepth(x, y));
    this.visual.setScale(S);
    this.drawHero(this.visual);

    this.nameText = this.scene.add.text(iso.x, iso.y - 60 * S, this.name, {
      fontFamily: "Arial, Tahoma, sans-serif",
      fontSize: "12px",
      color: "#5cfc5c",
      stroke: "#081008",
      strokeThickness: 2,
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(isoDepth(x, y) + 100);

    this.nameText.setScale(S);

    // Health bar sits between the name and the character's head
    const healthBar = createHealthBar(this.scene, iso.x, iso.y, S);
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
      this.stats.maxHp,
      S
    );
  }

  /**
   * Build the shadow + the vector hero rig, drawn facing the current direction
   * with the current gear (so the hero is never blank before the game starts).
   */
  drawHero(container) {
    // Soft golden aura + ground shadow, matching the glowing hero in the
    // reference market screenshot.
    this.aura = this.scene.add.ellipse(0, HERO_FOOT_Y - 2, 96, 38, 0xffd36a, 0.2);
    this.aura.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.14, to: 0.4 },
      scaleX: { from: 0.92, to: 1.08 },
      scaleY: { from: 0.92, to: 1.08 },
      duration: 1400,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
    this.sparkles = this.scene.add.container(0, HERO_FOOT_Y);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const dot = this.scene.add.circle(
        Math.cos(angle) * (20 + (i % 3) * 8),
        -8 - (i % 4) * 7,
        2.0 + (i % 2) * 1.1,
        0xffe9a6,
        0.85
      );
      dot.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: dot,
        alpha: { from: 0.15, to: 0.95 },
        y: dot.y - 8,
        duration: 900 + i * 140,
        delay: i * 90,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      });
      this.sparkles.add(dot);
    }

    this.shadow = this.scene.add.ellipse(0, HERO_FOOT_Y, 42, 13, 0x090e0c, 0.45);

    // Body container carries the walk bob and attack recoil; the rig lives inside.
    this.body = this.scene.add.container(0, 0);
    this.rig = new HeroRigView(this.scene, { footOffsetY: HERO_FOOT_Y });
    this.rig.set(this.facingDirection, this.equipment, this.gender);
    this.body.add(this.rig.container);

    container.add([this.aura, this.sparkles, this.shadow, this.body]);
  }

  /**
   * Switch the hero's rendered silhouette (male/female) and redraw the rig.
   * @param {"male"|"female"} gender
   * @returns {boolean} whether the gender actually changed
   */
  setGender(gender) {
    const next = normalizeGender(gender);
    if (next === this.gender) return false;
    this.gender = next;
    this.rig?.set(this.facingDirection, this.equipment, this.gender);
    return true;
  }

  /**
   * Wear the given items and redraw the rig.
   * @param {Record<string, string|null>} [equipment]
   */
  applyEquipment(equipment = this.equipment) {
    this.equipment = { ...defaultEquipment(), ...(equipment || {}) };
    this.rig?.set(this.facingDirection, this.equipment, this.gender);
  }

  /**
   * Turn the hero to face a direction (0..7) and redraw the rig.
   * @param {number} direction
   */
  faceDirection(direction) {
    if (direction === this.facingDirection) return;
    this.facingDirection = direction;
    this.rig?.set(direction, this.equipment, this.gender);
  }

  /**
   * Switch the skill kit's sect id.
   * @param {string} sect
   */
  setSect(sect) {
    this.sect = typeof sect === "string" && sect ? sect : this.sect;
    return this.sect;
  }

  update(time, delta) {
    if (!this.sprite || !this.sprite.body) return;

    this.updateMovement(delta);

    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const speed = this.sprite.body.velocity.length();

    if (speed > 15) {
      // Face the way the hero appears to move on screen.
      this.faceDirection(directionFromVelocity(vx, vy));

      // Light procedural bob over the rig (the rig has no baked walk cycle).
      this.stepPhase += delta * 0.016 * Math.min(speed / 120, 1.8);
      this.rig?.animate(this.stepPhase);
      this.body.y = -Math.abs(Math.sin(this.stepPhase)) * 3.5;
      this.body.rotation = Phaser.Math.Linear(this.body.rotation, 0, 0.2);
      this.body.setScale(1, 1);

      const shadowFactor = 1 - (Math.abs(this.body.y) / 3.5) * 0.2;
      this.shadow.setScale(shadowFactor, shadowFactor);
      this.shadow.setAlpha(0.45 * shadowFactor);

      // Footstep dust puff when foot strikes the road
      if (time - this.lastDustTime > 190) {
        this.lastDustTime = time;
        this.spawnFootstepDust(this.sprite.x, this.sprite.y + 40, vx, vy);
      }
    } else {
      // Idle breathing cycle (Qi Gong internal breathing)
      this.rig?.animate(0);
      const breath = Math.sin(time * 0.0035);
      this.body.y = breath * 0.8;
      this.body.rotation = Phaser.Math.Linear(this.body.rotation, 0, 0.14);
      this.body.setScale(1 - breath * 0.012, 1 + breath * 0.018);

      this.shadow.setScale(1 + breath * 0.02, 1 + breath * 0.02);
      this.shadow.setAlpha(0.45);
    }

    // Depth sorting based on the isometric position of the ground cell
    const iso = toIso(this.sprite.x, this.sprite.y);
    const depth = isoDepth(this.sprite.x, this.sprite.y);
    this.visual.setPosition(iso.x, iso.y);
    this.visual.setDepth(depth);
    this.nameText.setPosition(iso.x, iso.y - 60 * S + this.body.y * 0.35);
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
    this.rig?.attack?.("slash");
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

  /**
   * Play the limb animation for a skill cast.
   * @param {"slash"|"kick"|"shockwave"|"aura"|string} [kind]
   */
  playSkillMotion(kind = "slash") {
    if (!this.body) return;
    this.rig?.attack?.(kind);

    const isKick = kind === "kick";
    const isChannel = kind === "aura";
    this.scene.tweens.add({
      targets: this.body,
      x: isChannel ? 0 : isKick ? -4 : 6,
      scaleX: isChannel ? 1.05 : 1.15,
      scaleY: isChannel ? 1.05 : 0.88,
      duration: isKick ? 110 : 90,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (this.body) this.body.x = 0;
      }
    });
  }

  updateMovement(delta = 0) {
    const isTyping =
      typeof this.scene?.isTyping === "function"
        ? this.scene.isTyping()
        : typeof document !== "undefined" &&
          (document.activeElement?.tagName === "INPUT" ||
            document.activeElement?.tagName === "TEXTAREA" ||
            !!document.activeElement?.isContentEditable ||
            document.activeElement?.getAttribute?.("contenteditable") === "true");

    const k = this.keys;
    const keyLeft = (!isTyping && (k?.A?.isDown || k?.LEFT?.isDown)) || this.touchDirection === "left";
    const keyRight = (!isTyping && (k?.D?.isDown || k?.RIGHT?.isDown)) || this.touchDirection === "right";
    const keyUp = (!isTyping && (k?.W?.isDown || k?.UP?.isDown)) || this.touchDirection === "up";
    const keyDown = (!isTyping && (k?.S?.isDown || k?.DOWN?.isDown)) || this.touchDirection === "down";

    if (keyLeft || keyRight || keyUp || keyDown) {
      this.isMovingToTarget = false;
      this.targetX = null;
      this.targetY = null;
      this.scene?.combat?.cancelPendingCast?.();

      let vx = 0;
      let vy = 0;
      if (keyLeft) vx -= 1;
      if (keyRight) vx += 1;
      if (keyUp) vy -= 1;
      if (keyDown) vy += 1;

      const vector = new Phaser.Math.Vector2(vx, vy);
      if (vector.length() > 0) {
        vector.normalize().scale(175 * POS * WORLD_SPEED_SCALE);
      }

      this.sprite.setVelocity(vector.x, vector.y);
      return;
    }

    // Click-to-move handling: travel one axis at a time (four-way movement).
    if (this.isMovingToTarget && this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.sprite.x;
      const dy = this.targetY - this.sprite.y;
      const speed = 175 * POS * WORLD_SPEED_SCALE;
      const step = travelStep(speed, delta);
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      // A long physics catch-up can move further than `step`; if the leg's
      // remaining distance flipped sign, the body crossed the target and must
      // snap instead of reversing (otherwise it oscillates every frame).
      const overshot = horizontal
        ? crossedTarget(this.lastLegDx, dx)
        : crossedTarget(this.lastLegDy, dy);

      if (overshot || (shouldSnap(dx, step) && shouldSnap(dy, step))) {
        // Snap the finished leg, then continue with the other axis. Kill the
        // velocity so a stale axis cannot overshoot before the next leg starts.
        this.sprite.setVelocity(0, 0);
        this.sprite.setPosition(this.targetX, this.targetY);
        const isFinalLeg =
          this.finalX === null ||
          this.finalY === null ||
          (Math.abs(this.finalX - this.targetX) <= 8 && Math.abs(this.finalY - this.targetY) <= 8);
        if (isFinalLeg) {
          this.stopMovement();
          return;
        }
        if (Math.abs(this.finalX - this.targetX) > 8) {
          this.targetX = this.finalX;
          this.targetY = this.sprite.y;
        } else {
          this.targetX = this.sprite.x;
          this.targetY = this.finalY;
        }
        this.lastLegDx = this.targetX - this.sprite.x;
        this.lastLegDy = this.targetY - this.sprite.y;
        return;
      }

      if (horizontal) {
        this.sprite.setVelocity(Math.sign(dx) * speed, 0);
      } else {
        this.sprite.setVelocity(0, Math.sign(dy) * speed);
      }
      this.lastLegDx = dx;
      this.lastLegDy = dy;
      return;
    }

    this.sprite.setVelocity(0, 0);
  }

  /**
   * Walk to a point using four-way movement. The longer axis is travelled
   * first, then the shorter one, so the character never moves diagonally.
   * @param {number} x
   * @param {number} y
   */
  moveTo(x, y) {
    this.finalX = x;
    this.finalY = y;
    this.isMovingToTarget = true;

    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.targetX = x;
      this.targetY = this.sprite.y;
    } else {
      this.targetX = this.sprite.x;
      this.targetY = y;
    }
    // Start the overshoot tracker from the new leg, otherwise reversing
    // direction mid-walk would look like crossing the old target and snap.
    this.lastLegDx = this.targetX - this.sprite.x;
    this.lastLegDy = this.targetY - this.sprite.y;
  }

  stopMovement() {
    this.isMovingToTarget = false;
    this.targetX = null;
    this.targetY = null;
    this.finalX = null;
    this.finalY = null;
    this.lastLegDx = 0;
    this.lastLegDy = 0;
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
    this.nameText.setPosition(iso.x, iso.y - 60 * S);
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

  /** Coarse left/right facing derived from the current direction. */
  get facing() {
    return this.facingDirection >= 5 && this.facingDirection <= 7 ? "left" : "right";
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

  destroy() {
    if (this.keys && this.scene?.input?.keyboard?.removeKey) {
      Object.values(this.keys).forEach((key) => {
        try {
          this.scene.input.keyboard.removeKey(key);
        } catch {
          // Ignore teardown errors
        }
      });
      this.keys = null;
    }
    if (this.visual) {
      this.visual.destroy?.();
      this.visual = null;
    }
    if (this.nameText) {
      this.nameText.destroy?.();
      this.nameText = null;
    }
    if (this.hpBack) {
      this.hpBack.destroy?.();
      this.hpBack = null;
    }
    if (this.hpFill) {
      this.hpFill.destroy?.();
      this.hpFill = null;
    }
    if (this.sprite) {
      this.sprite.destroy?.();
      this.sprite = null;
    }
  }
}
