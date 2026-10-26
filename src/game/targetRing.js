/**
 * The glowing ring drawn under the touch auto-target.
 *
 * A single reusable container holds the halo: it is created on first use (the
 * mobile layout may never need it) and then simply repositioned as the picked
 * target moves, so per-frame auto-targeting allocates nothing.
 */

import { isoDepth } from "./isoProjection.js";

/** Ground-space size of the ring: a flattened ellipse, like the AoE indicator. */
const RING_WIDTH = 92;
const RING_HEIGHT = 46;

/** Ring colour per target kind: red for a duellist, gold for a monster. */
export const TARGET_RING_COLORS = {
  player: 0xff4d4d,
  monster: 0xffd166
};

export class TargetRing {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.container = null;
    this.glow = null;
    this.ring = null;
    this.inner = null;
    this.pulse = null;
    /** Kind the ring was last painted for, so a recolor only happens on switch. */
    this.kind = null;
  }

  /**
   * Build the shapes on first use. Returns null when the scene cannot add
   * objects yet (tests, or a scene still booting).
   * @returns {Phaser.GameObjects.Container|null}
   */
  create() {
    if (this.container) return this.container;

    const scene = this.scene;
    if (!scene?.add?.container || !scene?.add?.ellipse) return null;

    const color = TARGET_RING_COLORS.monster;
    this.container = scene.add.container(0, 0).setVisible(false);
    this.glow = scene.add.ellipse(0, 0, RING_WIDTH * 1.5, RING_HEIGHT * 1.5, color, 0.12);
    this.ring = scene.add
      .ellipse(0, 0, RING_WIDTH, RING_HEIGHT, color, 0.06)
      .setStrokeStyle(3, color, 0.95);
    this.inner = scene.add
      .ellipse(0, 0, RING_WIDTH * 0.55, RING_HEIGHT * 0.55, color, 0.05)
      .setStrokeStyle(2, color, 0.7);
    this.container.add([this.glow, this.ring, this.inner]);
    this.kind = "monster";

    // A slow breath so the halo reads as "live" without distracting from combat.
    this.pulse = scene.tweens?.add?.({
      targets: this.container,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    return this.container;
  }

  /**
   * Paint the ring under a target's feet.
   * @param {number} x world X
   * @param {number} y world Y
   * @param {"player"|"monster"} [kind]
   */
  show(x, y, kind = "monster") {
    const container = this.create();
    if (!container) return;

    if (kind !== this.kind) {
      this.recolor(kind);
      this.kind = kind;
    }

    container
      .setPosition(x, y)
      .setDepth(isoDepth(x, y) - 1)
      .setVisible(true);
  }

  /**
   * @param {"player"|"monster"} kind
   */
  recolor(kind) {
    const color = TARGET_RING_COLORS[kind] || TARGET_RING_COLORS.monster;
    this.glow?.setFillStyle?.(color, 0.12);
    this.ring?.setFillStyle?.(color, 0.06);
    this.ring?.setStrokeStyle?.(3, color, 0.95);
    this.inner?.setFillStyle?.(color, 0.05);
    this.inner?.setStrokeStyle?.(2, color, 0.7);
  }

  /** Take the ring off screen without throwing the shapes away. */
  hide() {
    this.container?.setVisible?.(false);
  }

  /** Release the shapes (scene teardown). */
  destroy() {
    this.pulse?.stop?.();
    this.pulse = null;
    this.container?.destroy?.();
    this.container = null;
    this.glow = null;
    this.ring = null;
    this.inner = null;
    this.kind = null;
  }
}
