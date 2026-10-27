"""Turn the 4x4 body sheets in docs/example into runtime spritesheets.

The source art is laid out as four rows with four walk frames per row. Source
sheets do not agree on the order of the two side rows, so each source declares
which of its rows holds the left-facing and the right-facing walk. The runtime
sheet always stores the rows as front, left, right, back, which is what
`ROW_BY_DIRECTION` in heroBody.js expects. Sources may either come with a baked
checkerboard background or with a real alpha channel; both are normalised to a
clean cut-out. This script:

1. keys the neutral-gray checkerboard out (with edge matting so no gray fringe
   survives) when the source is opaque, or reuses its alpha channel when the
   source is already transparent,
2. drops stray noise specks,
3. detects the four column/row bands from the foreground mask,
4. re-anchors every frame to one ground line and normalises the row scale,
5. reorders the rows so the sheet always reads front, left, right, back,

before writing the public spritesheets consumed by heroBody.js.

Two alignment layouts are supported. `frame` (default) crops every pose to its
own bounding box, which suits a bare body. `cell` keeps the fixed 4x4 cell grid
and anchors each cell on its body: sheets that already hold a weapon have a
blade sticking out of the silhouette, and cropping to the bbox would slide the
character around (and make the sword jitter) from frame to frame. The body is
located by eroding the mask, which removes thin props before measuring, so the
sword neither shifts the horizontal anchor nor becomes the ground line.

An animation that is swapped into the same rig (the attack swing) must draw the
character at exactly the walk sheet's scale, or the hero visibly changes size
mid-swing. Such a source declares `scale_from`, naming the output whose scale it
reuses, plus an optional wider `frame_w` when its effect art reaches past the
body.

Run: python3 scripts/build_hero_body.py
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / "docs" / "example"
PUBLIC = ROOT / "public"

# Runtime row order: 0 = front, 1 = left-facing, 2 = right-facing, 3 = back.
LEFT_ROW = 1
RIGHT_ROW = 2

SOURCES = {
    "hero-body-male.png": {
        "path": EXAMPLE / "body-men-v2.png",
        # Source row order: front, right-facing, left-facing, back.
        "row_map": {0: 0, LEFT_ROW: 2, RIGHT_ROW: 1, 3: 3},
        "align": "frame",
    },
    "hero-body-female.png": {
        "path": EXAMPLE / "body-women-v2.png",
        # Source row order: front, right-facing, left-facing, back.
        "row_map": {0: 0, LEFT_ROW: 2, RIGHT_ROW: 1, 3: 3},
        "align": "frame",
    },
    "hero-body-male-sword.png": {
        # Male hero with the blade already in hand, so the rig skips the
        # vector weapon overlay for this sheet (see WEAPON_BODY_TEXTURES).
        "path": EXAMPLE / "nv-camkiem.png",
        # Source row order: front, right-facing, left-facing, back.
        "row_map": {0: 0, LEFT_ROW: 2, RIGHT_ROW: 1, 3: 3},
        "align": "cell",
    },
    "hero-body-male-sword-attack.png": {
        # Same hero mid-swing, four frames per direction; the third frame holds
        # the slash arc, which reaches far wider than the body. Frames are
        # therefore wider than the walk sheet and the pose is drawn at the walk
        # sheet's scale, so the hero does not change size while attacking.
        "path": EXAMPLE / "nv-chem.png",
        # Source row order: front, right-facing, left-facing, back.
        "row_map": {0: 0, LEFT_ROW: 2, RIGHT_ROW: 1, 3: 3},
        "align": "cell",
        "frame_w": 192,
        "scale_from": "hero-body-male-sword.png",
    },
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
# Alpha below this becomes fully transparent for cut-out sources. Generated art
# leaves a pale checkerboard rim around the silhouette; cutting it before the
# minify keeps the sprite crisp instead of surrounded by a bright halo.
SOURCE_ALPHA_CUTOFF = 128
# Pixels trimmed from the cut-out silhouette to drop that rim entirely.
CUTOUT_ERODE_PX = 1
# Erosion window used by the `cell` layout to find the body without the blade.
# `ImageFilter.MinFilter` needs an odd window and erodes by (window - 1) / 2 px,
# so the soles sit exactly that many pixels below the eroded core.
CORE_ERODE_PX = 21
# Transparent gutter kept inside each frame. Spritesheets have no padding, so art
# that reaches a frame edge gets sampled into the neighbouring pose when the
# sampler filters across the boundary.
FRAME_SAFE_MARGIN = 2


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


def _has_transparency(image):
    """Whether the source already carries a real alpha cut-out."""
    if image.mode not in ("RGBA", "LA", "PA"):
        return False
    alpha = np.asarray(image.getchannel("A"))
    return bool((alpha < 255).any())


def _load_source(source):
    """Return the cleaned RGBA source plus the filter to minify it with."""
    image = Image.open(source)
    if _has_transparency(image):
        cutout = image.convert("RGBA")
        table = [255 if value >= SOURCE_ALPHA_CUTOFF else 0 for value in range(256)]
        alpha = cutout.getchannel("A").point(table)
        if CUTOUT_ERODE_PX:
            size = CUTOUT_ERODE_PX * 2 + 1
            alpha = alpha.filter(ImageFilter.MinFilter(size))
        cutout.putalpha(alpha)
        rgba = np.asarray(cutout).copy()
        # Area averaging never overshoots, so a cut-out keeps clean edges.
        downscale = Image.BOX
    else:
        rgba = _matte(image)
        downscale = Image.LANCZOS
    _drop_specks(rgba[..., 3])
    return rgba, downscale


def build_frame_sheet(source, row_map):
    """`frame` layout: crop every pose to its own bbox (bare body sheets)."""
    rgba, downscale = _load_source(source)
    alpha = rgba[..., 3]
    columns, rows = _grid_bands(alpha)
    source_image = Image.fromarray(rgba, "RGBA")

    out = Image.new("RGBA", (FRAME_W * COLS, FRAME_H * ROWS), (0, 0, 0, 0))

    for row in range(ROWS):
        source_row = row_map[row]
        cells = []
        boxes = []
        for col in range(COLS):
            box = _bbox(alpha, columns[col], rows[source_row])
            boxes.append(box)
            cells.append(source_image.crop(box))

        tallest = max(box[3] - box[1] for box in boxes)
        scale = CONTENT_H / tallest
        baseline = max(box[3] for box in boxes)

        for col, (cell, box) in enumerate(zip(cells, boxes)):
            scaled = cell.resize(
                (max(1, round(cell.width * scale)), max(1, round(cell.height * scale))),
                downscale,
            )
            lift = round((baseline - box[3]) * scale)
            paste_x = CONTENT_CENTER_X - scaled.width // 2
            paste_y = CONTENT_BOTTOM - lift - scaled.height
            _blit(
                out,
                scaled,
                col * FRAME_W + paste_x,
                row * FRAME_H + paste_y,
                (
                    col * FRAME_W,
                    row * FRAME_H,
                    (col + 1) * FRAME_W,
                    (row + 1) * FRAME_H,
                ),
            )

    return out


def _body_core(alpha):
    """Foreground mask with thin props eroded away, so a held blade is ignored.

    The body is the thick mass of the sprite; a blade or spear shaft is only a
    few pixels wide, so eroding by CORE_ERODE_RADIUS removes it entirely.
    """
    solid = Image.fromarray(np.where(alpha > 0, 255, 0).astype(np.uint8))
    return np.asarray(solid.filter(ImageFilter.MinFilter(_core_window()))) > 0


def _core_window():
    """`MinFilter` window for CORE_ERODE_PX; it must be odd."""
    return CORE_ERODE_PX if CORE_ERODE_PX % 2 else CORE_ERODE_PX + 1


def _core_radius():
    """Pixels `MinFilter` shaves off the silhouette on every side."""
    return (_core_window() - 1) // 2


def _blit(dst, src, x, y, clip=None):
    """Composite `src` onto `dst` at (x, y), clipped to `clip` (default: `dst`).

    A frame may only ever hold its own pose, so the paste is clipped to the frame
    rectangle. Without that, a pose whose art overhangs its cell (a blade poking
    past the cell edge) would bleed into the neighbouring frame and show up as
    stray pixels above another direction's head.
    """
    left, top, right, bottom = clip or (0, 0, dst.width, dst.height)
    dst_x = max(0, x, left)
    dst_y = max(0, y, top)
    dst_right = min(dst.width, right, x + src.width)
    dst_bottom = min(dst.height, bottom, y + src.height)
    width = dst_right - dst_x
    height = dst_bottom - dst_y
    if width <= 0 or height <= 0:
        return
    src_x = dst_x - x
    src_y = dst_y - y
    dst.alpha_composite(src.crop((src_x, src_y, src_x + width, src_y + height)), (dst_x, dst_y))


def build_cell_sheet(source, row_map, frame_w=FRAME_W, scale=None):
    """`cell` layout: keep the source grid and anchor on the body itself.

    Used for sheets that already hold a weapon. Each pose is cropped from its
    fixed cell, so the spacing the artist drew is preserved, and every pose is
    anchored on its own body: the head's centre line lands on the frame centre
    and the soles land on the shared ground line. Measuring the body (rather than
    the silhouette) keeps the blade from dragging the character off-centre and
    from becoming the ground line.

    `scale` overrides the computed one so a companion sheet (the attack swing)
    renders the hero at the same size as this one. `frame_w` widens the frame for
    art that reaches further than the body, such as a slash arc.
    """
    rgba, downscale = _load_source(source)
    alpha = rgba[..., 3]
    core = _body_core(alpha)
    core_radius = _core_radius()
    source_image = Image.fromarray(rgba, "RGBA")

    height, width = alpha.shape
    if width % COLS or height % ROWS:
        raise SystemExit(f"source {source.name} is not an even {COLS}x{ROWS} grid")
    cell_w = width // COLS
    cell_h = height // ROWS

    metrics = []
    for row in range(ROWS):
        source_row = row_map[row]
        for col in range(COLS):
            left = col * cell_w
            top = source_row * cell_h
            cell_alpha = alpha[top : top + cell_h, left : left + cell_w]
            cell_core = core[top : top + cell_h, left : left + cell_w]
            ys, xs = np.where(cell_alpha > 0)
            core_y, core_x = np.where(cell_core)
            if len(xs) == 0 or len(core_x) == 0:
                raise SystemExit(f"no body found in {source.name} at row {row}, column {col}")

            # Anchor horizontally on the head: it is the one mass the swinging
            # arms and the blade never merge into, and the whole core's centroid
            # drifts by more than a dozen source pixels on poses where the arm
            # touches the torso.
            core_top = int(core_y.min())
            core_height = int(core_y.max()) - core_top + 1
            head = cell_core[core_top : core_top + max(1, core_height // 4)]
            _, head_x = np.where(head)

            # Anchor vertically on the soles: the core is eroded, so the real
            # ground sits `core_radius` px below its bottom edge.
            feet_y = min(cell_h, int(core_y.max()) + 1 + core_radius)
            body_cx = float(head_x.mean()) if len(head_x) else float(core_x.mean())

            metrics.append(
                {
                    "row": row,
                    "col": col,
                    "box": (left, top, left + cell_w, top + cell_h),
                    "height": int(ys.max() - ys.min() + 1),
                    "body_cx": body_cx,
                    "feet_y": float(feet_y),
                    # Widest reach of the silhouette (blade included) measured
                    # from the body centre; drives the shared scale.
                    "half_extent": max(
                        abs(float(xs.min()) - body_cx),
                        abs(float(xs.max() + 1) - body_cx),
                    ),
                }
            )

    tallest = max(metric["height"] for metric in metrics)
    widest = max(metric["half_extent"] for metric in metrics)
    if scale is None:
        scale = min(CONTENT_H / tallest, (frame_w / 2 - FRAME_SAFE_MARGIN) / widest)

    out = Image.new("RGBA", (frame_w * COLS, FRAME_H * ROWS), (0, 0, 0, 0))
    for metric in metrics:
        cell = source_image.crop(metric["box"])
        scaled_w = max(1, round(cell.width * scale))
        scaled_h = max(1, round(cell.height * scale))
        cell = cell.resize((scaled_w, scaled_h), downscale)
        centre_x = frame_w / 2 - metric["body_cx"] * (scaled_w / cell_w)
        ground_y = CONTENT_BOTTOM - metric["feet_y"] * (scaled_h / cell_h)
        frame_x = metric["col"] * frame_w
        frame_y = metric["row"] * FRAME_H
        _blit(
            out,
            cell,
            frame_x + round(centre_x),
            frame_y + round(ground_y),
            (frame_x, frame_y, frame_x + frame_w, frame_y + FRAME_H),
        )

    print(
        f"  cell layout: frame {frame_w}x{FRAME_H} tallest={tallest}px "
        f"widest half-extent={widest:.0f}px -> scale {scale:.4f} "
        f"(content {tallest * scale:.0f}px of {CONTENT_H}px, "
        f"reach {widest * scale:.0f}px of {frame_w / 2 - FRAME_SAFE_MARGIN:.0f}px)"
    )
    return out, scale


def build_sheet(filename, source, config, shared_scales):
    """Build one runtime sheet, returning it plus the scale it was drawn at.

    A config may name another output in `scale_from` to reuse that sheet's scale,
    so an animation that is swapped into the same rig keeps the hero's size.
    That sheet must already have been built; a typo or a reordering would
    otherwise silently redraw the hero at a different scale.
    """
    row_map = config["row_map"]
    if config.get("align", "frame") == "cell":
        scale_from = config.get("scale_from")
        if scale_from is None:
            scale = None
        elif scale_from in shared_scales:
            scale = shared_scales[scale_from]
        else:
            raise SystemExit(
                f"{filename}: scale_from {scale_from!r} must be built first "
                "(it has to appear earlier in SOURCES)"
            )
        return build_cell_sheet(
            source,
            row_map,
            frame_w=config.get("frame_w", FRAME_W),
            scale=scale,
        )
    return build_frame_sheet(source, row_map), None


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    shared_scales = {}
    for filename, config in SOURCES.items():
        source = config["path"]
        if not source.exists():
            raise SystemExit(f"missing source sheet: {source}")
        sheet, scale = build_sheet(filename, source, config, shared_scales)
        if scale is not None:
            shared_scales[filename] = scale
        target = PUBLIC / filename
        sheet.save(target, optimize=True)
        print(f"wrote {target.relative_to(ROOT)} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
