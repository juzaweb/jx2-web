/**
 * Soft contact shadow for characters standing on the ground.
 *
 * A single hard-edged ellipse reads as a disc the character floats above,
 * especially once the aura ring is gone. Stacking a tight dark core inside a
 * wider, fainter halo fakes a soft gradient, so the feet look planted.
 */

/** Layers in rig units: [width, height, yOffset, alpha], widest/faintest first. */
const SHADOW_LAYERS = [
  [52, 18, 0, 0.09],
  [36, 12, 0, 0.16],
  [22, 7, -1, 0.3]
];

/**
 * Build the shadow stack for one character.
 *
 * @param {Phaser.Scene} scene
 * @param {number} footY - rig-space Y of the feet (the ground contact line)
 * @returns {{
 *   layers: { obj: Phaser.GameObjects.Ellipse, baseAlpha: number }[],
 *   setFactor: (factor: number) => void
 * }}
 */
export function createHeroShadow(scene, footY) {
  const layers = SHADOW_LAYERS.map(([width, height, offsetY, alpha]) => {
    const obj = scene.add.ellipse(0, footY + offsetY, width, height, 0x000000);
    // Start at the layer's own alpha: the fill stays opaque so `setFactor` can
    // drive the object alpha, but a consumer that never calls `setFactor` (the
    // remote-player avatar) would otherwise paint a solid black disc.
    obj.setAlpha(alpha);
    return { obj, baseAlpha: alpha };
  });

  return {
    layers,
    /**
     * Scale and fade every layer together, e.g. while the body bobs.
     * @param {number} factor - 1 is neutral; lower means lifted/smaller
     */
    setFactor(factor) {
      for (const { obj, baseAlpha } of layers) {
        obj.setScale(factor, factor);
        obj.setAlpha(baseAlpha * factor);
      }
    }
  };
}
