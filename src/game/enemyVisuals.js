/**
 * Procedural monster art.
 *
 * The game ships no monster sprites: every creature is a small vector group drawn
 * from its catalog palette. Kinds are intentionally limited — beast, humanoid,
 * armored and boss — which is enough to tell the three hunting tiers apart.
 *
 * Coordinates are rig units; the caller wraps the container and applies the world
 * scale, exactly like the hero rig.
 */

/**
 * @param {import("phaser").Scene} scene
 * @param {import("phaser").GameObjects.Container} container
 * @param {import("../enemyCatalog.js").MonsterDefinition} monster
 * @returns {import("phaser").GameObjects.Container} the same container
 */
export function drawMonster(scene, container, monster) {
  const visual = monster?.visual || {};
  const palette = visual.palette || {};
  const color = (key, fallback) =>
    Number.isFinite(palette[key]) ? palette[key] : fallback;

  switch (visual.kind) {
    case "humanoid":
      return drawHumanoid(scene, container, color, { armored: false });
    case "armored":
      return drawHumanoid(scene, container, color, { armored: true });
    case "boss":
      return drawHumanoid(scene, container, color, { armored: true, boss: true });
    case "beast":
    default:
      return drawBeast(scene, container, color);
  }
}

/**
 * Four-legged beast: low body, pointed ear, long tail.
 * @param {import("phaser").Scene} scene
 * @param {import("phaser").GameObjects.Container} container
 * @param {(key:string, fallback:number) => number} color
 */
function drawBeast(scene, container, color) {
  const shadow = scene.add.ellipse(0, 13, 42, 12, color("shadow", 0x0b100d), 0.35);
  const tail = scene.add
    .line(-19, 0, -1, 0, -10, -8, color("tail", 0x858c87))
    .setLineWidth(4);
  const body = scene.add
    .ellipse(0, 0, 36, 20, color("body", 0x747b79))
    .setStrokeStyle(2, color("dark", 0x353d3a));
  const head = scene.add
    .circle(17, -6, 10, color("head", 0x929b96))
    .setStrokeStyle(2, color("dark", 0x353d3a));
  const ear = scene.add.triangle(16, -16, -5, 8, 0, -7, 6, 7, color("ear", 0x626b67));
  const muzzle = scene.add.triangle(27, -2, -2, -5, 9, 0, -2, 5, color("muzzle", 0xadb4a8));
  const eye = scene.add.circle(20, -8, 2, color("accent", 0xffd26b));
  const leg1 = scene.add.rectangle(-10, 11, 5, 12, color("leg", 0x424b48));
  const leg2 = scene.add.rectangle(8, 11, 5, 12, color("leg", 0x424b48));

  container.add([shadow, tail, body, head, ear, muzzle, eye, leg1, leg2]);
  return container;
}

/**
 * Two-legged fighter. The armored variant adds shoulder plates, a helmet and a
 * shield; the boss variant adds a cape and a crest.
 * @param {import("phaser").Scene} scene
 * @param {import("phaser").GameObjects.Container} container
 * @param {(key:string, fallback:number) => number} color
 * @param {{armored?: boolean, boss?: boolean}} variant
 */
function drawHumanoid(scene, container, color, { armored = false, boss = false } = {}) {
  const parts = [];

  parts.push(scene.add.ellipse(0, 15, boss ? 52 : 36, boss ? 14 : 10, color("shadow", 0x0b100d), 0.35));

  if (boss) {
    // Cape behind the body.
    parts.push(
      scene.add.triangle(0, 2, -26, 16, 0, -24, 26, 16, color("cloth", 0x8c2f24)).setAlpha(0.95)
    );
  }

  const legWidth = boss ? 9 : 7;
  const legHeight = boss ? 18 : 14;
  parts.push(scene.add.rectangle(-8, 9, legWidth, legHeight, color("leg", 0x4a3524)));
  parts.push(scene.add.rectangle(7, 9, legWidth, legHeight, color("leg", 0x4a3524)));

  // Torso + belt.
  const torsoWidth = boss ? 30 : 24;
  const torsoHeight = boss ? 32 : 26;
  parts.push(
    scene.add
      .rectangle(0, -2, torsoWidth, torsoHeight, color("body", 0x6b4a2f))
      .setStrokeStyle(2, color("dark", 0x3a2716))
  );
  parts.push(scene.add.rectangle(0, 6, torsoWidth, 4, color("cloth", 0x8c2f24)));

  // Head and hood.
  parts.push(
    scene.add.circle(0, boss ? -22 : -18, boss ? 11 : 9, color("head", 0xc9a07a))
  );
  parts.push(
    scene.add.triangle(
      0,
      boss ? -32 : -27,
      -12, 12,
      0, -8,
      12, 12,
      color("cloth", 0x8c2f24)
    )
  );

  if (armored) {
    parts.push(scene.add.rectangle(-14, -8, 8, 9, color("body", 0x6f7783)).setStrokeStyle(1, color("dark", 0x3d434c)));
    parts.push(scene.add.rectangle(14, -8, 8, 9, color("body", 0x6f7783)).setStrokeStyle(1, color("dark", 0x3d434c)));
    parts.push(scene.add.rectangle(0, boss ? -32 : -26, boss ? 22 : 18, 7, color("dark", 0x3d434c)));
    // Shield on the off hand.
    parts.push(
      scene.add
        .ellipse(-16, 0, 11, 20, color("body", 0x6f7783))
        .setStrokeStyle(2, color("accent", 0xffc44d))
    );
  }

  if (boss) {
    parts.push(scene.add.triangle(0, -40, -5, 6, 0, -10, 5, 6, color("accent", 0xf5c542)));
  }

  // Weapon (spear for the boss, blade otherwise).
  parts.push(
    scene.add
      .line(15, -4, 0, 0, boss ? 12 : 8, boss ? -34 : -22, color("accent", 0xd8543f))
      .setLineWidth(boss ? 4 : 3)
  );

  container.add(parts);
  return container;
}
