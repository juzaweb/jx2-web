import { getNpcName } from "./npcData.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { WORLD_SCALE } from "./worldConfig.js";

const S = WORLD_SCALE;

const NPC_PALETTES = {
  herbalist: { robe: 0x6d2a2a, trim: 0xf1e6c9, sash: 0x2b1414, hair: 0x1c1712, skin: 0xf1c27d },
  scholar: { robe: 0xf1ede2, trim: 0xb02a2a, sash: 0x7c1d1d, hair: 0xffffff, skin: 0xf3d3a5 },
  merchant: { robe: 0x2d5a6e, trim: 0xd9b45c, sash: 0x1c3642, hair: 0x2a2018, skin: 0xe9bd8a },
  ambassador: { robe: 0x7a4b2c, trim: 0xe3c26b, sash: 0x3d2415, hair: 0x201811, skin: 0xf0c894 },
  martial: { robe: 0x38455f, trim: 0xcfd7e6, sash: 0x1d2433, hair: 0x171512, skin: 0xe8be92 },
  sage: { robe: 0x3e5a4b, trim: 0xd9c18a, sash: 0x24382e, hair: 0xe8e3d8, skin: 0xefca9a },
  villager: { robe: 0x4f6152, trim: 0xc9b98f, sash: 0x2d392f, hair: 0x241c15, skin: 0xe7ba86 }
};

/** Overhead-name NPC painter used by the market scene. */

export function createNpc(scene, npc, obstacles) {
    const anchor = toIso(npc.x, npc.y);
    const c = scene.add.container(anchor.x, anchor.y);
    const palette = NPC_PALETTES[npc.type] || NPC_PALETTES.villager;

    const shadow = scene.add.ellipse(0, 2, 36, 12, 0x0b0f09, 0.45);
    const body = scene.add.container(0, 0);
    const g = scene.add.graphics();

    // Flowing robe.
    g.fillStyle(palette.robe, 1);
    g.lineStyle(1.6, 0x241a12, 1);
    g.fillPoints(
      [
        { x: -12, y: -22 },
        { x: 12, y: -22 },
        { x: 18, y: 8 },
        { x: -18, y: 8 }
      ],
      true
    );
    g.strokePoints(
      [
        { x: -12, y: -22 },
        { x: 12, y: -22 },
        { x: 18, y: 8 },
        { x: -18, y: 8 }
      ],
      true,
      true
    );
    // Robe shading + hem.
    g.fillStyle(0x000000, 0.14);
    g.fillPoints(
      [
        { x: 4, y: -22 },
        { x: 12, y: -22 },
        { x: 18, y: 8 },
        { x: 8, y: 8 }
      ],
      true
    );
    g.fillStyle(palette.sash, 1);
    g.fillRect(-13, -8, 26, 5);
    g.fillRect(-2, -3, 5, 14);
    g.fillStyle(palette.trim, 1);
    g.fillPoints(
      [
        { x: -7, y: -22 },
        { x: 0, y: -11 },
        { x: 7, y: -22 }
      ],
      true
    );
    // Sleeves.
    g.fillStyle(palette.robe, 1);
    g.fillRoundedRect(-19, -18, 38, 12, 5);
    g.lineStyle(1.2, 0x241a12, 1);
    g.strokeRoundedRect(-19, -18, 38, 12, 5);
    g.fillStyle(palette.trim, 0.9);
    g.fillRect(-19, -9, 38, 2.5);
    // Hands.
    g.fillStyle(palette.skin, 1);
    g.fillCircle(-17, -5, 3.5);
    g.fillCircle(17, -5, 3.5);

    // Head.
    g.fillStyle(palette.skin, 1);
    g.lineStyle(1.2, 0xb57c4b, 1);
    g.fillCircle(0, -31, 9);
    g.strokeCircle(0, -31, 9);
    // Hair.
    g.fillStyle(palette.hair, 1);
    g.fillEllipse(0, -36, 18, 12);
    g.fillCircle(0, -40, 5);
    g.fillRect(-9, -36, 5, 10);
    g.fillRect(4, -36, 5, 10);
    // Eyes.
    g.fillStyle(0x241a12, 1);
    g.fillCircle(-3.5, -30, 1.2);
    g.fillCircle(3.5, -30, 1.2);

    if (npc.type === "scholar" || npc.type === "sage") {
      g.fillStyle(0xf4f1e7, 1);
      g.fillTriangle(-5, -24, 0, -10, 5, -24);
      g.fillStyle(palette.hair, 1);
      g.fillRect(-6, -46, 12, 5);
    }
    if (npc.type === "herbalist") {
      g.fillStyle(0xd8b45d, 1);
      g.fillRect(-7, -44, 14, 4);
      g.fillStyle(0x4d7c2f, 1);
      g.fillEllipse(17, -12, 10, 16);
    }
    if (npc.type === "martial") {
      g.fillStyle(0x8d99ae, 1);
      g.fillRect(17, -42, 3, 42);
      g.fillStyle(0xd8b45d, 1);
      g.fillRect(14, -38, 9, 4);
    }
    if (npc.type === "merchant" || npc.type === "ambassador") {
      g.fillStyle(0xd8b45d, 1);
      g.fillCircle(-17, -32, 6);
    }

    body.add(g);

    const nameLabel = scene.add
      .text(0, -58, getNpcName(npc), {
        fontFamily: "Arial, Tahoma, sans-serif",
        fontSize: "9px",
        color: "#e6e2d3",
        stroke: "#202016",
        strokeThickness: 2.4,
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    c.add([shadow, body, nameLabel]);
    c.setData("nameLabel", nameLabel);
    c.setDepth(isoDepth(npc.x, npc.y));
    c.setScale(S);

    // Gentle idle breathing.
    scene.tweens.add({
      targets: body,
      y: -1.4,
      duration: 1100 + (npc.id.length % 5) * 130,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });

    if (obstacles) {
      const col = obstacles.create(npc.x, npc.y + 8 * S, "entity-dot");
      col.setSize(28 * S, 18 * S);
      col.setVisible(false);
      col.refreshBody();
    }
    return c;
  }

