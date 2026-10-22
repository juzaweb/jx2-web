/**
 * Vegetation art cropped from the reference sheet, sized in rig units (the
 * caller applies the world scale on top). `height` is the rendered height, so
 * every kind lands at the same scale the old procedural trees used.
 */
export const VEGETATION_SPRITES = {
  "tree-large": { key: "veg-tree-large", url: "/veg/tree-large.webp", height: 130 },
  "tree-medium": { key: "veg-tree-medium", url: "/veg/tree-medium.webp", height: 100 },
  "bush-large": { key: "veg-bush-large", url: "/veg/bush-large.webp", height: 58 },
  "bush-medium": { key: "veg-bush-medium", url: "/veg/bush-medium.webp", height: 52 },
  "bush-small": { key: "veg-bush-small", url: "/veg/bush-small.webp", height: 40 },
  grass: { key: "veg-grass", url: "/veg/grass.webp", height: 30 }
};

/**
 * Ground-anchored vegetation sprite. The container origin is the plant's base
 * so it lines up with the shadow and depth sorting.
 * @param {import("phaser").Scene} scene
 * @param {keyof typeof VEGETATION_SPRITES} kind
 */
export function createVegetation(scene, kind) {
  const def = VEGETATION_SPRITES[kind] || VEGETATION_SPRITES["bush-large"];
  const c = scene.add.container(0, 0);
  const img = scene.add.image(0, 0, def.key).setOrigin(0.5, 1);
  img.setScale(def.height / img.height);
  c.add(img);
  return c;
}

