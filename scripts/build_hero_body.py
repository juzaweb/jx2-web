"""Turn the 4x4 body sheets in docs/example into runtime spritesheets.

The source art is laid out as four rows (front, left, right, back) with four
walk frames per row. The generated sheets carry a checkerboard background and
uneven margins, so this script:

1. detects the four column/row bands from the foreground mask,
2. keys the neutral-gray checkerboard out (with edge matting so no gray fringe
   survives),
3. drops stray noise specks,
4. re-anchors every frame to one ground line and normalises the row scale
   before writing the public spritesheets consumed by heroBody.js.

Run: python3 scripts/build_hero_body.py
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / "docs" / "example"
PUBLIC = ROOT / "public"

SOURCES = {
    "hero-body-male.png": EXAMPLE / "body-men.png",
    "hero-body-female.png": EXAMPLE / "body-women.png",
}

# Frame geometry: keep in sync with the runtime copy in src/game/heroBody.js.
COLS = 4
ROWS = 4
FRAME_W = 128
FRAME_H = 160
CONTENT_H = 140
CONTENT_BOTTOM = FRAME_H
CONTENT_CENTER_X = FRAME_W // 2

# Checkerboard cells are neutral gray; the art itself is warm-toned. Anything
# this close to neutral (and this bright) is treated as background.
BG_MAX_SAT = 22
BG_MIN_VALUE = 45
BG_MAX_VALUE = 205
# Minimum run length (px) that counts as a sprite band rather than noise.
MIN_BAND = 25
# Connected components smaller than this are speckle noise.
MIN_COMPONENT = 30


def _runs(mask):
    """Contiguous True runs in a 1-D boolean mask."""
    out = []
    start = None
    for index, value in enumerate(mask):
        if value and start is None:
            start = index
        elif not value and start is not None:
            out.append((start, index - 1))
            start = None
    if start is not None:
        out.append((start, len(mask) - 1))
    return out


def _bands(projection, minimum):
    return [band for band in _runs(projection) if band[1] - band[0] + 1 >= minimum]


def _flood_background(near_bg):
    """Background = neutral-gray pixels connected to the image border."""
    height, width = near_bg.shape
    background = np.zeros_like(near_bg)
    queue = deque()

    def seed(y, x):
        if near_bg[y, x] and not background[y, x]:
            background[y, x] = True
            queue.append((y, x))

    for x in range(width):
        seed(0, x)
        seed(height - 1, x)
    for y in range(height):
        seed(y, 0)
        seed(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if y > 0:
            seed(y - 1, x)
        if y + 1 < height:
            seed(y + 1, x)
        if x > 0:
            seed(y, x - 1)
        if x + 1 < width:
            seed(y, x + 1)
    return background


def _erode(mask, iterations):
    core = mask.copy()
    for _ in range(iterations):
        eroded = core.copy()
        eroded[1:, :] &= core[:-1, :]
        eroded[:-1, :] &= core[1:, :]
        eroded[:, 1:] &= core[:, :-1]
        eroded[:, :-1] &= core[:, 1:]
        core = eroded
    return core


def _matte(image):
    """Key out the checkerboard, returning RGBA with clean edges."""
    rgb = np.asarray(image.convert("RGB")).astype(np.float64)
    height, width, _ = rgb.shape
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    near_bg = (
        (high - low <= BG_MAX_SAT)
        & (high >= BG_MIN_VALUE)
        & (high <= BG_MAX_VALUE)
    )
    background = _flood_background(near_bg)
    foreground = ~background
    core = _erode(foreground, 2)

    alpha = foreground.astype(np.float64)
    out_rgb = rgb.copy()
    ys, xs = np.where(foreground & ~core)
    for y, x in zip(ys, xs):
        neighbours = [
            rgb[ny, nx]
            for ny in range(max(0, y - 2), min(height, y + 3))
            for nx in range(max(0, x - 2), min(width, x + 3))
            if background[ny, nx]
        ]
        if not neighbours:
            continue
        backdrop = np.mean(neighbours, axis=0)
        cores = [
            rgb[ny, nx]
            for ny in range(max(0, y - 3), min(height, y + 4))
            for nx in range(max(0, x - 3), min(width, x + 4))
            if core[ny, nx]
        ]
        if not cores:
            alpha[y, x] = 0.0
            continue
        colour = np.mean(cores, axis=0)
        delta = colour - backdrop
        length = float(np.dot(delta, delta))
        if length < 1e-6:
            alpha[y, x] = 0.0
            continue
        alpha[y, x] = np.clip(float(np.dot(rgb[y, x] - backdrop, delta) / length), 0.0, 1.0)
        out_rgb[y, x] = colour

    alpha[alpha < 0.15] = 0.0
    alpha[alpha > 0.95] = 1.0
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    return rgba


def _drop_specks(alpha):
    """Zero out connected components smaller than MIN_COMPONENT pixels."""
    height, width = alpha.shape
    solid = alpha > 0
    seen = np.zeros_like(solid)
    for y in range(height):
        for x in range(width):
            if not solid[y, x] or seen[y, x]:
                continue
            component = []
            queue = deque([(y, x)])
            seen[y, x] = True
            while queue:
                cy, cx = queue.popleft()
                component.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and solid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
            if len(component) < MIN_COMPONENT:
                for cy, cx in component:
                    alpha[cy, cx] = 0


def _grid_bands(alpha):
    foreground = alpha > 0
    columns = _bands(foreground.any(axis=0), MIN_BAND)
    rows = _bands(foreground.any(axis=1), MIN_BAND)
    if len(columns) != COLS or len(rows) != ROWS:
        raise SystemExit(
            f"expected {COLS}x{ROWS} sprite bands, found {len(columns)}x{len(rows)}"
        )
    return columns, rows


def _bbox(alpha, band_x, band_y):
    """Tight bbox of one sprite inside its column/row bands."""
    x0, x1 = band_x
    y0, y1 = band_y
    sub = alpha[y0 : y1 + 1, x0 : x1 + 1] > 0
    ys, xs = np.where(sub)
    if len(xs) == 0:
        raise ValueError("empty body frame")
    return x0 + int(xs.min()), y0 + int(ys.min()), x0 + int(xs.max()) + 1, y0 + int(ys.max()) + 1


def _load_source(source):
    rgba = _matte(Image.open(source))
    _drop_specks(rgba[..., 3])
    return rgba


def build_sheet(source):
    rgba = _load_source(source)
    alpha = rgba[..., 3]
    columns, rows = _grid_bands(alpha)
    source_image = Image.fromarray(rgba, "RGBA")

    out = Image.new("RGBA", (FRAME_W * COLS, FRAME_H * ROWS), (0, 0, 0, 0))

    for row in range(ROWS):
        cells = []
        boxes = []
        for col in range(COLS):
            box = _bbox(alpha, columns[col], rows[row])
            boxes.append(box)
            cells.append(source_image.crop(box))

        tallest = max(box[3] - box[1] for box in boxes)
        scale = CONTENT_H / tallest
        baseline = max(box[3] for box in boxes)

        for col, (cell, box) in enumerate(zip(cells, boxes)):
            scaled = cell.resize(
                (max(1, round(cell.width * scale)), max(1, round(cell.height * scale))),
                Image.LANCZOS,
            )
            lift = round((baseline - box[3]) * scale)
            paste_x = CONTENT_CENTER_X - scaled.width // 2
            paste_y = CONTENT_BOTTOM - lift - scaled.height
            out.alpha_composite(scaled, (col * FRAME_W + paste_x, row * FRAME_H + paste_y))

    return out


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for filename, source in SOURCES.items():
        if not source.exists():
            raise SystemExit(f"missing source sheet: {source}")
        sheet = build_sheet(source)
        target = PUBLIC / filename
        sheet.save(target, optimize=True)
        print(f"wrote {target.relative_to(ROOT)} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
