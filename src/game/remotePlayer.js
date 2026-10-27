import * as Phaser from "phaser";
import { createHealthBar, layoutHealthBar } from "./healthBarView.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { directionFromVelocity } from "./heroDirections.js";
import { HeroRigView, HERO_FOOT_Y } from "./heroRigView.js";
import { createHeroShadow } from "./heroShadow.js";
import { normalizeGender } from "./gender.js";
import { ensureVfxTexture } from "./lazyAssets.js";
import { OverheadSeal } from "./overheadSeal.js";
import { WORLD_POSITION_SCALE, WORLD_SCALE } from "./worldConfig.js";

const S = WORLD_SCALE;
const POS = WORLD_POSITION_SCALE;

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
    this.x = typeof data.x === "number" ? data.x : 640 * POS;
    this.y = typeof data.y === "number" ? data.y : 620 * POS;
    this.targetX = this.x;
    this.targetY = this.y;
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    /** Direction the peer faces (0..7, see heroDirections.js). */
    this.facingDirection = 0;
    /** Worn equipment slots (slot -> item id), synced from the server. */
    this.equipment = data.equipment || {};
    this.hp = Number.isFinite(data.hp) ? data.hp : 100;
    this.maxHp = Number.isFinite(data.maxHp) && data.maxHp > 0 ? data.maxHp : 100;
    this.pkFlag = data.pkFlag === true;
    /** Character this avatar belongs to, used to collapse stale duplicates. */
    this.characterId = data.characterId || null;
    /** Gender synced from the server; drives the rig silhouette. */
    this.gender = normalizeGender(data.gender);
    this.walkPhase = 0;

    this.createVisuals();
  }

  createVisuals() {
    const iso = toIso(this.x, this.y);
    this.container = this.scene.add.container(iso.x, iso.y);
    this.container.setDepth(isoDepth(this.x, this.y));
    this.container.setScale(S);
    this.overheadSeal = new OverheadSeal(this.scene, this.container);

    // 1. Soft contact shadow under the feet, matching the local hero.
    this.shadow = createHeroShadow(this.scene, HERO_FOOT_Y);

    // 2. Body container for animations
    this.body = this.scene.add.container(0, 0);

    // 3. Vector hero rig, drawn wearing the peer's synced equipment
    this.rig = new HeroRigView(this.scene, { footOffsetY: HERO_FOOT_Y });
    this.rig.set(this.facingDirection, this.equipment, this.gender);
    this.body.add(this.rig.container);

    this.container.add([...this.shadow.layers.map((layer) => layer.obj), this.body]);

    // 4. Overhead name (authentic JX2 style)
    this.nameText = this.scene.add
      .text(iso.x, iso.y - 60 * S, this.displayName, {
        fontFamily: "Arial, Tahoma, sans-serif",
        fontSize: "12px",
        color: this.pkFlag ? "#ff5555" : "#5cfc5c",
        stroke: "#081008",
        strokeThickness: 2,
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(isoDepth(this.x, this.y) + 100);

    this.nameText.setScale(S);

    const healthBar = createHealthBar(this.scene, iso.x, iso.y, S);
    this.hpBack = healthBar.back;
    this.hpFill = healthBar.fill;
    this.updateHealthBar(iso.x, iso.y);
  }

  /**
   * Turn the peer to face a direction (0..7) and redraw the rig.
   * @param {number} direction
   */
  faceDirection(direction) {
    if (direction === this.facingDirection) return;
    this.facingDirection = direction;
    this.rig?.set(direction, this.equipment, this.gender);
  }

  /**
   * Replace the peer's worn slots (synced from the server) and redraw the rig.
   * @param {Record<string, string|null>} equipment
   */
  applyEquipment(equipment) {
    this.equipment = equipment || {};
    this.rig?.set(this.facingDirection, this.equipment, this.gender);
  }

  /**
   * Reposition and redraw the overhead health bar from the reported HP.
   * @param {number} x
   * @param {number} y
   */
  updateHealthBar(x, y) {
    layoutHealthBar({ back: this.hpBack, fill: this.hpFill }, x, y, isoDepth(this.x, this.y), this.hp, this.maxHp, S);
  }

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
   * Blink the peer for a moment when the server reports damage on them. The
   * overhead bar alone is easy to miss mid-fight, and the client draws its own
   * optimistic damage numbers, so without this a landed hit looks like nothing.
   */
  flashHit() {
    if (!this.container || !this.container.active) return;
    this.container.setAlpha(0.55);
    this.scene?.time?.delayedCall?.(150, () => {
      if (this.container && this.container.active) this.container.setAlpha(1);
    });
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
    // A peer holding a weapon with swing art plays that instead.
    if (this.rig?.attack?.("slash") === true) return;

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

      // Prefer the reported network velocity for facing; fall back to the
      // direction of travel while catching up to the target.
      let mdx = this.vx;
      let mdy = this.vy;
      if (Math.hypot(mdx, mdy) < 1) {
        mdx = this.targetX - this.x;
        mdy = this.targetY - this.y;
      }

      this.faceDirection(directionFromVelocity(mdx, mdy));
      this.walkPhase += delta * 0.012;
      this.rig?.animate(this.walkPhase);
      if (this.body) this.body.y = -Math.abs(Math.sin(this.walkPhase)) * 3.5;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
      if (this.body) this.body.y = 0;
      this.rig?.animate(0);
    }

    // Depth sorting (isometric)
    const iso = toIso(this.x, this.y);
    const depth = isoDepth(this.x, this.y);
    this.container.setPosition(iso.x, iso.y);
    this.container.setDepth(depth);

    if (this.nameText) {
      this.nameText.setPosition(iso.x, iso.y - 60 * S + (this.body?.y || 0) * 0.35);
      this.nameText.setDepth(depth + 100);
    }

    this.updateHealthBar(iso.x, iso.y + (this.body?.y || 0) * 0.35);
    this.overheadSeal?.update(this.body?.y || 0);
  }

  /**
   * Display a continuously rotating ground formation circle under the peer's feet.
   * Stays flat on the ground and follows the character while the buff is active.
   * @param {string} [key="vfx-la-han-tran"]
   * @param {number} [scale=0.6]
   */
  showFormation(key = "vfx-la-han-tran", scale = 0.6) {
    if (!this.container || typeof this.scene?.add?.sprite !== "function") return;
    // Queue the sheet on first use; skip this frame while it downloads.
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
      this.formationSprite.setOrigin(0.5, 0.5);
      this.formationSprite.setScale(targetScale);
      const bodyIndex = this.container.getIndex ? this.container.getIndex(this.body) : -1;
      if (bodyIndex >= 0 && this.container.addAt) {
        this.container.addAt(this.formationSprite, bodyIndex);
      } else if (this.container.add) {
        this.container.add(this.formationSprite);
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
    if (this.formationTimer) {
      this.formationTimer.remove?.();
      this.formationTimer = null;
    }
    if (this.formationSprite) {
      this.formationSprite.setVisible?.(false);
      this.formationSprite.stop?.();
    }
  }

  /**
   * Float a buff seal above the peer's head (e.g. Kim Cang Bất Hoại's 卍).
   * @param {string} key Phaser texture key
   * @param {number} [scale] scale in rig units
   * @param {number} [offsetY] rig-space height above the feet
   */
  showOverhead(key, scale, offsetY) {
    this.overheadSeal?.show(key, scale, offsetY);
  }

  /**
   * Hide the overhead buff seal when its buff expires or the peer leaves.
   */
  hideOverhead() {
    this.overheadSeal?.hide();
  }

  destroy() {
    if (this.formationTimer) {
      this.formationTimer.remove?.();
      this.formationTimer = null;
    }
    if (this.overheadTimer) {
      this.overheadTimer.remove?.();
      this.overheadTimer = null;
    }
    if (this.formationSprite) {
      this.formationSprite.destroy?.();
      this.formationSprite = null;
    }
    this.overheadSeal?.destroy();
    this.overheadSeal = null;
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

