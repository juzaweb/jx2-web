"""Slice the hero 8-direction sprite mock into a transparent Phaser atlas.

Input : a reference sheet laid out as 8 direction columns x 6 animation rows
        (row 0 = idle, rows 1..5 = walk cycle), each character drawn on a white
        background.
Output: public/hero_8dir.png - a spritesheet of 8 cols x 6 rows at 64x96 per
        frame, background keyed out and every frame anchored at the feet.

Run: python3 scripts/extract_hero_8dir.py
"""

import os
import sys
from collections import deque

import numpy as np
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "hero_8dir_mock.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
OUT = os.path.abspath(os.path.join(OUT_DIR, "hero_8dir.png"))
PREVIEW = "/tmp/hero_8dir_preview.png"

FRAME_W, FRAME_H = 64, 96
COLS, ROWS = 8, 6

# Direction column centers (0 deg, 45 deg, ... 315 deg) and row bands measured
# on the source mock (see scripts/README notes).
COL_CENTERS = [221, 327, 432, 539, 653, 762, 871, 978]
ROW_BANDS = [
    (208, 298),
    (304, 390),
    (396, 482),
    (487, 573),
    (579, 664),
    (671, 757),
]

WHITE_TOL = 238  # >= this on every channel counts as background candidate


def background_mask(rgb):
    """Flood-fill near-white pixels from the border so interior white clothing
    (the hero's apron) is preserved. Returns True where pixels are background."""
    h, w, _ = rgb.shape
    near_white = np.all(rgb >= WHITE_TOL, axis=2)
    bg = np.zeros((h, w), dtype=bool)
    q = deque()

    def push(y, x):
        if 0 <= y < h and 0 <= x < w and near_white[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    while q:
        y, x = q.popleft()
        push(y - 1, x)
        push(y + 1, x)
        push(y, x - 1)
        push(y, x + 1)
    return bg


def extract_cell(mock, cx, band):
    y0, y1 = band
    # Half-width kept below the ~105px column pitch; the left edge is clamped
    # past the label boxes (which end at x=169) so they never bleed into col 0.
    x0, x1 = max(176, cx - 52), min(mock.shape[1], cx + 52)
    rgb = mock[y0:y1, x0:x1]
    nonwhite = np.any(rgb < WHITE_TOL, axis=2)
    ys, xs = np.where(nonwhite)
    if len(xs) == 0:
        return None
    bx0, bx1 = xs.min(), xs.max() + 1
    by0, by1 = ys.min(), ys.max() + 1
    crop = rgb[by0:by1, bx0:bx1].copy()

    bg = background_mask(crop)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([crop.astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


def main():
    if not os.path.exists(SRC):
        sys.exit(f"Source mock not found: {SRC}")
    mock = np.asarray(Image.open(SRC).convert("RGB")).astype(int)

    atlas = Image.new("RGBA", (COLS * FRAME_W, ROWS * FRAME_H), (0, 0, 0, 0))
    for r, band in enumerate(ROW_BANDS):
        for c, cx in enumerate(COL_CENTERS):
            cell = extract_cell(mock, cx, band)
            if cell is None:
                print(f"  empty cell r{r} c{c}")
                continue
            # Scale to fit the frame leaving a 2px margin, anchor at feet.
            max_w, max_h = FRAME_W - 4, FRAME_H - 2
            scale = min(max_w / cell.width, max_h / cell.height, 1.0)
            if scale < 1.0:
                cell = cell.resize(
                    (max(1, round(cell.width * scale)), max(1, round(cell.height * scale))),
                    Image.LANCZOS,
                )
            px = c * FRAME_W + (FRAME_W - cell.width) // 2
            py = r * FRAME_H + FRAME_H - cell.height - 1
            atlas.alpha_composite(cell, (px, py))

    os.makedirs(OUT_DIR, exist_ok=True)
    atlas.save(OUT)
    print(f"wrote {OUT} ({atlas.width}x{atlas.height})")

    # Preview on a mid-gray checker so transparency and edges are visible.
    checker = Image.new("RGBA", atlas.size, (60, 60, 60, 255))
    for y in range(0, atlas.height, 16):
        for x in range(0, atlas.width, 16):
            if (x // 16 + y // 16) % 2 == 0:
                for yy in range(y, min(y + 16, atlas.height)):
                    for xx in range(x, min(x + 16, atlas.width)):
                        checker.putpixel((xx, yy), (90, 90, 90, 255))
    checker.alpha_composite(atlas)
    checker.save(PREVIEW)
    print(f"wrote preview {PREVIEW}")


if __name__ == "__main__":
    main()
