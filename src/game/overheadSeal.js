/**
 * A buff seal that floats above a character's head (e.g. Kim Cang Bất Hoại's
 * 卍). Shared by the local hero and remote peers so both render and clean up
 * the same way.
 */

import { ensureOverheadTexture } from "./lazyAssets.js";

/** Default scale in rig units (the hero container is scaled by WORLD_SCALE). */
export const OVERHEAD_SEAL_SCALE = 0.05;
/** Default rig-space height above the feet, clearing the nameplate. */
export const OVERHEAD_SEAL_OFFSET_Y = -80;

export class OverheadSeal {
  /**
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Container} container character container
   */
  constructor(scene, container) {
    this.scene = scene;
    this.container = container;
    this.sprite = null;
    this.request = null;
    this.offsetY = OVERHEAD_SEAL_OFFSET_Y;
  }

  /**
   * Show a texture above the character, replacing any current seal.
   * @param {string} key Phaser texture key
   * @param {number} [scale=OVERHEAD_SEAL_SCALE]
   * @param {number} [offsetY=OVERHEAD_SEAL_OFFSET_Y]
   */
  show(key, scale = OVERHEAD_SEAL_SCALE, offsetY = OVERHEAD_SEAL_OFFSET_Y) {
    if (!this.container) return;
    this.request = { key, scale, offsetY };
    this.update();
  }

  /**
   * Create the sprite once its texture is ready and keep it aligned with the
   * character's walk bob. A texture that is still downloading is retried on the
   * next frame.
   * @param {number} [bodyY=0] current walk-bob offset
   */
  update(bodyY = 0) {
    const request = this.request;
    if (request) {
      ensureOverheadTexture(this.scene, request.key);
      if (this.scene?.textures?.exists && !this.scene.textures.exists(request.key)) return;

      if (!this.sprite && typeof this.scene?.add?.sprite === "function") {
        this.sprite = this.scene.add.sprite(0, request.offsetY, request.key);
        this.sprite.setOrigin?.(0.5, 0.5);
        this.container.add?.(this.sprite);
      } else if (this.sprite?.setTexture) {
        this.sprite.setTexture(request.key);
      }

      if (this.sprite) {
        this.offsetY = request.offsetY;
        this.sprite.setScale?.(request.scale);
        this.sprite.setVisible?.(true);
      }
      this.request = null;
    }

    if (this.sprite) {
      this.sprite.setPosition?.(0, this.offsetY + bodyY * 0.35);
    }
  }

  /** Hide the seal while keeping its sprite for the next buff. */
  hide() {
    this.request = null;
    this.sprite?.setVisible?.(false);
  }

  destroy() {
    this.request = null;
    this.sprite?.destroy?.();
    this.sprite = null;
  }
}
