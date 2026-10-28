import * as Phaser from "phaser";
import { createHealthBar, layoutHealthBar } from "./healthBarView.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { defaultEquipment, equippedWeaponType } from "./equipment.js";
import { directionFromVelocity } from "./heroDirections.js";
import { crossedTarget, shouldSnap, travelStep } from "./clickToMove.js";
import { HeroRigView, HERO_FOOT_Y } from "./heroRigView.js";
import { createHeroShadow } from "./heroShadow.js";
import { normalizeGender } from "./gender.js";
import { ensureVfxTexture } from "./lazyAssets.js";
import { OverheadSeal } from "./overheadSeal.js";
import { WORLD_POSITION_SCALE, WORLD_SCALE, WORLD_SPEED_SCALE, BASE_WALK_SPEED } from "./worldConfig.js";
import {
  BASE_ATTACK,
  BASE_ATTACK_SPEED,
  BASE_CRIT_DAMAGE,
  BASE_CRIT_RATE,
  BASE_DEFENSE
} from "./combatConfig.js";

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
    /** Weapon type worn; selects which skill kit may be cast (see weapons.js). */
    this.weaponType = null;

    this.stats = {
      level: 1,
      hp: 100,
      maxHp: 100,
      mp: 60,
      maxMp: 60,
      attack: BASE_ATTACK,
      defense: BASE_DEFENSE,
      attackSpeed: BASE_ATTACK_SPEED,
      critRate: BASE_CRIT_RATE,
      critDamage: BASE_CRIT_DAMAGE,
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
    this.overheadSeal = new OverheadSeal(this.scene, this.visual);

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
    // Soft contact shadow only (nested ellipses). No aura ring or sparkles:
    // buff/skill formation rings are handled separately.
    this.shadow = createHeroShadow(this.scene, HERO_FOOT_Y);

    // Body container carries the walk bob and attack recoil; the rig lives inside.
    this.body = this.scene.add.container(0, 0);
    this.rig = new HeroRigView(this.scene, { footOffsetY: HERO_FOOT_Y });
    this.rig.set(this.facingDirection, this.equipment, this.gender);
    this.body.add(this.rig.container);

    container.add([...this.shadow.layers.map((layer) => layer.obj), this.body]);
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
   * Wear the given items and redraw the rig. Combat bonuses are derived on the
   * server and arrive as `player_stats`, so nothing is folded into `stats` here.
   * @param {Record<string, string|null>} [equipment]
   */
  applyEquipment(equipment = this.equipment) {
    this.equipment = { ...defaultEquipment(), ...(equipment || {}) };
    this.weaponType = equippedWeaponType(this.equipment);
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
   * Switch the skill kit's weapon type (derived from the worn weapon).
   * @param {string} weaponType
   */
  setWeaponType(weaponType) {
    this.weaponType = typeof weaponType === "string" && weaponType ? weaponType : this.weaponType;
    return this.weaponType;
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
      this.stepPhase += delta * 0.016 * Math.min(speed / (120 * POS * WORLD_SPEED_SCALE), 1.8);
      this.rig?.animate(this.stepPhase);
      this.body.y = -Math.abs(Math.sin(this.stepPhase)) * 3.5;
      this.body.rotation = Phaser.Math.Linear(this.body.rotation, 0, 0.2);
      this.body.setScale(1, 1);

      const shadowFactor = 1 - (Math.abs(this.body.y) / 3.5) * 0.2;
      this.shadow.setFactor(shadowFactor);

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

      this.shadow.setFactor(1 + breath * 0.02);
    }

    // Depth sorting based on the isometric position of the ground cell
    const iso = toIso(this.sprite.x, this.sprite.y);
    const depth = isoDepth(this.sprite.x, this.sprite.y);
    this.visual.setPosition(iso.x, iso.y);
    this.visual.setDepth(depth);
    this.nameText.setPosition(iso.x, iso.y - 60 * S + this.body.y * 0.35);
    this.nameText.setDepth(depth + 100);
    this.updateHealthBar(iso.x, iso.y + this.body.y * 0.35, depth);
    this.overheadSeal?.update(this.body?.y || 0);
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

  /**
   * Play the normal-attack motion.
   * @returns {boolean} `true` when the weapon's baked strike sheet played (the
   *   art already contains the slash arc, so the caller must not draw one)
   */
  playAttackMotion() {
    if (!this.body) return false;
    const bakedStrike = this.rig?.attack?.("basic") === true;
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
    return bakedStrike;
  }

  /**
   * Play the limb animation for a skill cast.
   * @param {"basic"|"slash"|"kick"|"shockwave"|"aura"|string} [kind]
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

      const speed = BASE_WALK_SPEED * POS * WORLD_SPEED_SCALE * this.getSpeedMultiplier();
      const vector = new Phaser.Math.Vector2(vx, vy);
      if (vector.length() > 0) {
        vector.normalize().scale(speed);
      }

      this.sprite.setVelocity(vector.x, vector.y);
      return;
    }

    // Click-to-move handling: travel one axis at a time (four-way movement).
    if (this.isMovingToTarget && this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.sprite.x;
      const dy = this.targetY - this.sprite.y;
      const speed = BASE_WALK_SPEED * POS * WORLD_SPEED_SCALE * this.getSpeedMultiplier();
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

  /**
   * Whether the player is holding a movement input right now (keyboard or touch).
   * Auto-move consumers (PvP chase, NPC approach) use this to yield to the player.
   * @returns {boolean}
   */
  hasManualMoveInput() {
    if (this.touchDirection) return true;
    const k = this.keys;
    if (!k) return false;
    return Boolean(
      k.A?.isDown ||
        k.D?.isDown ||
        k.W?.isDown ||
        k.S?.isDown ||
        k.LEFT?.isDown ||
        k.RIGHT?.isDown ||
        k.UP?.isDown ||
        k.DOWN?.isDown
    );
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
    this.hideFormation();
    this.hideOverhead();
  }

  /**
   * Move the respawn point, used when the hero travels to another map so a
   * death (or the Hồi Thành Phù) returns them to the map they are on.
   * @param {{x:number, y:number}} point
   */
  setSpawn(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    this.spawnX = point.x;
    this.spawnY = point.y;
  }

  setTouchDirection(direction) {
    this.touchDirection = direction;
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

  /**
   * Current movement speed multiplier derived from active buffs.
   * Clamped to a positive floor so debuffs never freeze or reverse movement.
   * @returns {number}
   */
  getSpeedMultiplier() {
    const effective = this.scene?.combat?.getEffectiveStats?.();
    const gmMult = this.gmSpeedBoost ? 2.0 : 1.0;
    return Math.max(0.1, 1 + (Number(effective?.speedPct) || 0)) * gmMult;
  }

  /**
   * Display a continuously rotating ground formation circle under the character's feet.
   * Stays flat on the ground and follows the character while the buff is active.
   * @param {string} [key="vfx-la-han-tran"]
   * @param {number} [scale=0.6]
   */
  showFormation(key = "vfx-la-han-tran", scale = 0.6) {
    if (!this.visual || typeof this.scene?.add?.sprite !== "function") return;
    // The formation sheet may not be loaded yet; queue it and bail out until the
    // next update retries (the buff re-applies the ring every frame).
    ensureVfxTexture(this.scene, key);
    if (this.scene.textures?.exists && !this.scene.textures.exists(key)) return;

    const animKey = `${key}-spin`;
    if (this.scene.anims && !this.scene.anims.exists(animKey)) {
      const texture = this.scene.textures?.get?.(key);
      const frameTotal = texture?.frameTotal ?? 16;
      const frameCount = Math.max(1, frameTotal - 1);
      const frames = this.scene.anims.generateFrameNumbers?.(key, { start: 0, end: frameCount - 1 });
      if (frames && frames.length > 0) {
        this.scene.anims.create({
          key: animKey,
          frames,
          frameRate: 12,
          repeat: -1
        });
      }
    }

    const targetScale = typeof scale === "number" ? scale : 0.6;
    if (!this.formationSprite) {
      this.formationSprite = this.scene.add.sprite(0, HERO_FOOT_Y, key);
      // Origin at center (128, 128) of 256x256 frame
      this.formationSprite.setOrigin(0.5, 0.5);
      this.formationSprite.setScale(targetScale);
      // Place behind body rig so character stands on top of the formation ring
      const bodyIndex = this.visual.getIndex ? this.visual.getIndex(this.body) : -1;
      if (bodyIndex >= 0 && this.visual.addAt) {
        this.visual.addAt(this.formationSprite, bodyIndex);
      } else if (this.visual.add) {
        this.visual.add(this.formationSprite);
      }
    } else {
      this.formationSprite.setScale?.(targetScale);
    }

    this.formationSprite.setVisible?.(true);
    if (this.formationSprite.play && (!this.formationSprite.anims?.isPlaying || this.formationSprite.anims?.currentAnim?.key !== animKey)) {
      this.formationSprite.play(animKey, true);
    }
  }

  /**
   * Hide the formation circle when the buff expires or is cleared.
   */
  hideFormation() {
    if (this.formationSprite) {
      this.formationSprite.setVisible?.(false);
      this.formationSprite.stop?.();
    }
  }

  /**
   * Float a buff seal above the hero's head (e.g. the 卍 of Kim Cang Bất Hoại).
   * @param {string} key Phaser texture key
   * @param {number} [scale] scale in rig units
   * @param {number} [offsetY] rig-space height above the feet
   */
  showOverhead(key, scale, offsetY) {
    this.overheadSeal?.show(key, scale, offsetY);
  }

  /**
   * Hide the overhead buff seal when its buff expires or is cleared.
   */
  hideOverhead() {
    this.overheadSeal?.hide();
  }

  destroy() {
    if (this.formationSprite) {
      this.formationSprite.destroy?.();
      this.formationSprite = null;
    }
    this.overheadSeal?.destroy();
    this.overheadSeal = null;
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
