/**
 * The glowing ring drawn under the touch auto-target.
 *
 * A single reusable container holds one halo: it is created on first use (the
 * mobile layout may never need it) and then simply repositioned as the picked
 * target moves, so per-frame auto-targeting allocates nothing.
 */

import { isoDepth } from "./isoProjection.js";

/**
 * Ring size in *screen* pixels: a small halo hugging the feet, not an AoE
 * radius. The gameplay camera is zoomed far out (about 0.13 on a phone), so a
 * world-sized halo would render as a handful of pixels and be invisible;
 * `show()` divides by the camera zoom to keep this size on screen at every
 * resolution.
 */
const RING_WIDTH = 26;
const RING_HEIGHT = 13;

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
    this.ring = null;
    this.pulse = null;
    /** Kind the ring was last painted for, so a recolor only happens on switch. */
    this.kind = null;
  }

  /**
   * Build the ring on first use. Returns null when the scene cannot add objects
   * yet (tests, or a scene still booting).
   * @returns {Phaser.GameObjects.Container|null}
   */
  create() {
    if (this.container) return this.container;

    const scene = this.scene;
    if (!scene?.add?.container || !scene?.add?.ellipse) return null;

    const color = TARGET_RING_COLORS.monster;
    this.container = scene.add.container(0, 0).setVisible(false);
    this.ring = scene.add
      .ellipse(0, 0, RING_WIDTH, RING_HEIGHT, color, 0.22)
      .setStrokeStyle(2, color, 0.95);
    this.container.add([this.ring]);
    this.kind = "monster";

    // A slow breath so the halo reads as "live" without distracting from combat.
    // It animates the shape, never the container: the container scale is taken
    // by the zoom compensation.
    this.pulse = scene.tweens?.add?.({
      targets: this.ring,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 640,
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

    // Divide out the camera zoom so the halo keeps its screen size when the
    // window is resized (zoom is derived from the viewport width).
    const zoom = Number(this.scene?.cameras?.main?.zoom);
    const scale = Number.isFinite(zoom) && zoom > 0 ? 1 / zoom : 1;

    container
      .setPosition(x, y)
      .setDepth(isoDepth(x, y) - 1)
      .setScale(scale)
      .setVisible(true);
  }

  /**
   * @param {"player"|"monster"} kind
   */
  recolor(kind) {
    const color = TARGET_RING_COLORS[kind] || TARGET_RING_COLORS.monster;
    this.ring?.setFillStyle?.(color, 0.22);
    this.ring?.setStrokeStyle?.(2, color, 0.95);
  }

  /** Take the ring off screen without throwing the shape away. */
  hide() {
    this.container?.setVisible?.(false);
  }

  /** Release the shape (scene teardown). */
  destroy() {
    this.pulse?.stop?.();
    this.pulse = null;
    this.container?.destroy?.();
    this.container = null;
    this.ring = null;
    this.kind = null;
  }
}
