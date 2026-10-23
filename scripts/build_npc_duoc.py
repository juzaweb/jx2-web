"""Turn the herb-shop NPC sheet into a runtime spritesheet.

The source art is a 10x4 grid of poses drawn over a baked checkerboard
background. Only the first row (the shopkeeper's idle poses) is used here: its
cells are cut out with a connected-component background removal, re-anchored to
one ground line and normalised to a 280x520 frame so the scene can play the
row as an idle animation.

Run: python3 scripts/build_npc_duoc.py
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "example" / "duoc.png"
TARGET = ROOT / "public" / "npc-duoc.png"

# The first row sits between these scanlines in the source (the rows are not
# evenly spaced: the art was generated, not tiled).
ROW_TOP = 90
ROW_BOTTOM = 510
COLUMNS = 10

FRAME_W = 280
FRAME_H = 520
CONTENT_H = 480
CONTENT_BOTTOM = FRAME_H - 10
CONTENT_CENTER_X = FRAME_W // 2


def background_mask(region):
    """Flood-fill the baked checkerboard from the border.

    The checkerboard is made of two near-greys (about 170 and 221) plus the
    anti-aliased seams between them. The fill is only seeded from the border, so
    grey hair or pale cloth enclosed by the character's outline is preserved.
    """
    rgb = region.astype(np.int16)
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    candidate = ((high - low) <= 12) & (low >= 115) & (high <= 246)

    height, width = candidate.shape
    filled = np.zeros((height, width), dtype=bool)
    queue = deque()

    def seed(y, x):
        if candidate[y, x] and not filled[y, x]:
            filled[y, x] = True
            queue.append((y, x))

    for x in range(width):
        seed(0, x)
        seed(height - 1, x)
    for y in range(height):
        seed(y, 0)
        seed(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if x > 0:
            seed(y, x - 1)
        if x < width - 1:
            seed(y, x + 1)
        if y > 0:
            seed(y - 1, x)
        if y < height - 1:
            seed(y + 1, x)

    return filled


def de_fringe(alpha, rgb):
    """Drop the one-pixel halo left by anti-aliasing against the checkerboard."""
    near_grey = (rgb.max(axis=2) - rgb.min(axis=2) <= 14) & (rgb.min(axis=2) >= 130)
    solid = alpha > 0
    edge = np.zeros_like(solid)
    edge[1:, :] |= ~solid[:-1, :]
    edge[:-1, :] |= ~solid[1:, :]
    edge[:, 1:] |= ~solid[:, :-1]
    edge[:, :-1] |= ~solid[:, 1:]
    alpha[solid & edge & near_grey] = 0


def build_sheet():
    sheet = Image.open(SOURCE).convert("RGB")
    row = np.array(sheet.crop((0, ROW_TOP, sheet.width, ROW_BOTTOM)))

    background = background_mask(row)
    alpha = np.where(background, 0, 255).astype(np.uint8)
    de_fringe(alpha, row.astype(np.int16))
    cutout = Image.fromarray(np.dstack([row, alpha]), "RGBA")

    cell_w = sheet.width / COLUMNS
    cells = []
    for col in range(COLUMNS):
        left = round(col * cell_w)
        right = round((col + 1) * cell_w)
        cell = cutout.crop((left, 0, right, cutout.height))
        box = cell.getchannel("A").getbbox()
        if box:
            cells.append(cell.crop(box))

    if not cells:
        raise SystemExit("no NPC frames found in the first row")

    tallest = max(cell.height for cell in cells)
    scale = CONTENT_H / tallest
    out = Image.new("RGBA", (FRAME_W * COLUMNS, FRAME_H), (0, 0, 0, 0))

    for col, cell in enumerate(cells):
        scaled = cell.resize(
            (round(cell.width * scale), round(cell.height * scale)),
            Image.LANCZOS,
        )
        paste_x = col * FRAME_W + CONTENT_CENTER_X - scaled.width // 2
        paste_y = CONTENT_BOTTOM - scaled.height
        out.alpha_composite(scaled, (paste_x, paste_y))

    return out


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    sheet = build_sheet()
    sheet.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE).save(
        TARGET, optimize=True
    )
    print(f"wrote {TARGET.relative_to(ROOT)} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
