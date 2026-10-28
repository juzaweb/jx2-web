"""Draw the TEMPORARY citizen NPC sheet used by the newbie quest NPCs.

There is no final art for the shopkeepers/guards yet, so this script paints a
simple robed wuxia figure procedurally with PIL. The output keeps the same
280x520 frame geometry as ``npc-duoc.png`` (feet on a shared ground line, one
row of four idle poses), so it can be replaced later by real art without any
code change: just overwrite ``public/npc-citizen.png``.

The base palette is deliberately light/neutral; the scene applies a per-role
``setTint`` to colour each NPC.

Run: python3 scripts/build_npc_citizen.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "public" / "npc-citizen.png"

FRAME_W = 280
FRAME_H = 520
FRAMES = 4
# Vertical breathing offset per frame, in pixels.
BOB = [0, 1, 2, 1]

ROBE = (228, 224, 214, 255)
ROBE_DARK = (198, 192, 180, 255)
ROBE_LIGHT = (244, 240, 232, 255)
SASH = (150, 128, 96, 255)
SKIN = (226, 206, 186, 255)
HAIR = (72, 62, 52, 255)
BOOTS = (84, 76, 66, 255)
OUTLINE = (58, 52, 44, 180)


def draw_frame(draw, ox, oy, bob):
    """Paint one pose with its feet anchored at `oy` and its centre at `ox`."""
    cx = ox + FRAME_W // 2
    top = oy + 150 + bob
    hem = oy + 480 + bob

    # Robe body: shoulders narrower than the hem.
    draw.polygon(
        [
            (cx - 40, top + 40),
            (cx + 40, top + 40),
            (cx + 62, hem),
            (cx - 62, hem),
        ],
        fill=ROBE,
        outline=OUTLINE,
    )
    # Front panel highlight.
    draw.polygon(
        [
            (cx - 14, top + 46),
            (cx + 18, top + 46),
            (cx + 26, hem - 6),
            (cx - 22, hem - 6),
        ],
        fill=ROBE_LIGHT,
        outline=None,
    )
    # Sleeves.
    draw.polygon(
        [(cx - 40, top + 44), (cx - 78, top + 180), (cx - 48, top + 198), (cx - 18, top + 70)],
        fill=ROBE_DARK,
        outline=OUTLINE,
    )
    draw.polygon(
        [(cx + 40, top + 44), (cx + 78, top + 180), (cx + 48, top + 198), (cx + 18, top + 70)],
        fill=ROBE_DARK,
        outline=OUTLINE,
    )
    # Sash.
    draw.rectangle([cx - 52, top + 150, cx + 52, top + 176], fill=SASH)
    draw.line([cx - 60, top + 192, cx - 44, top + 300], fill=SASH, width=8)
    # Boots.
    draw.rectangle([cx - 40, hem - 22, cx - 6, hem + 6], fill=BOOTS)
    draw.rectangle([cx + 6, hem - 22, cx + 40, hem + 6], fill=BOOTS)
    # Neck + head.
    draw.rectangle([cx - 9, top + 18, cx + 9, top + 44], fill=SKIN)
    draw.ellipse([cx - 26, top - 34, cx + 26, top + 30], fill=SKIN, outline=OUTLINE)
    # Hair cap and topknot.
    draw.chord([cx - 28, top - 38, cx + 28, top + 12], 180, 360, fill=HAIR)
    draw.ellipse([cx - 10, top - 54, cx + 10, top - 30], fill=HAIR)
    # Simple eyes so the face reads at game scale.
    draw.ellipse([cx - 14, top - 4, cx - 8, top + 2], fill=HAIR)
    draw.ellipse([cx + 8, top - 4, cx + 14, top + 2], fill=HAIR)


def main():
    sheet = Image.new("RGBA", (FRAME_W * FRAMES, FRAME_H), (0, 0, 0, 0))
    for index in range(FRAMES):
        cell = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        draw_frame(ImageDraw.Draw(cell), 0, 0, BOB[index])
        sheet.alpha_composite(cell, (index * FRAME_W, 0))

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(TARGET)
    print(f"wrote {TARGET} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
