"""Build the Như Lai Thần Chưởng VFX spritesheet and icon.

The source sheet ships four palm illustrations in a single row on a transparent
background. The four panels are normalised to a shared scale, centred in
256x256 frames, and packed into a 1024x256 spritesheet. Frame 1 (the clean palm
in the energy swirl) is reused as the 64x64 hotbar icon.

Run: python3 scripts/build_skill_nhu_lai_than_chuong.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "docs" / "example" / "nhu-lai-than-chuong.png"
VFX_DIR = ROOT / "public" / "skills" / "vfx" / "nhu_lai_than_chuong"
ICON_PATH = ROOT / "public" / "skills" / "nhu_lai_than_chuong.png"

PANEL_BOUNDS = [(0, 432), (432, 890), (890, 1259), (1259, 1640)]
FRAME_SIZE = 256
CONTENT_SIZE = 240
ALPHA_THRESHOLD = 8
ICON_SIZE = 64
ICON_FRAME = 0

# Panels 2-4 (indexes 1-3) were illustrated with a flat cream backdrop that is cropped into a
# hard rectangle. Feather the cut edges so the sheet does not show a beige box on
# the dark ground; panels with organic fire/cloud outlines are left untouched.
FEATHER_EDGES = {
    0: {},
    1: {"left": 20},
    2: {"top": 40, "left": 40, "right": 40},
    3: {"top": 18, "left": 28, "bottom": 34}
}


def feather_alpha(frame, edges):
    """Fade a frame's alpha toward the requested straight cut edges."""
    if not edges:
        return frame
    alpha = np.array(frame)[:, :, 3].astype(np.float32)
    ys, xs = np.where(alpha > ALPHA_THRESHOLD)
    if not len(xs):
        return frame
    top, bottom = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())

    def ramp(distance, length):
        t = np.clip(distance / length, 0.0, 1.0)
        return t * t * (3 - 2 * t)

    height, width = alpha.shape
    rows = np.ones(height, dtype=np.float32)
    cols = np.ones(width, dtype=np.float32)
    if "top" in edges:
        end = min(height, top + edges["top"])
        rows[top:end] *= ramp(np.arange(end - top, dtype=np.float32), float(edges["top"]))
    if "bottom" in edges:
        start = max(0, bottom - edges["bottom"] + 1)
        rows[start : bottom + 1] *= ramp(
            np.arange(bottom - start, -1, -1, dtype=np.float32), float(edges["bottom"])
        )
    if "left" in edges:
        end = min(width, left + edges["left"])
        cols[left:end] *= ramp(np.arange(end - left, dtype=np.float32), float(edges["left"]))
    if "right" in edges:
        start = max(0, right - edges["right"] + 1)
        cols[start : right + 1] *= ramp(
            np.arange(right - start, -1, -1, dtype=np.float32), float(edges["right"])
        )
    alpha *= rows[:, None] * cols[None, :]

    out = frame.copy()
    out.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return out


def content_box(alpha):
    """Bounding box of the visible pixels in one panel."""
    ys, xs = np.where(alpha > ALPHA_THRESHOLD)
    if not len(xs):
        raise ValueError("Panel has no visible pixels")
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def build():
    VFX_DIR.mkdir(parents=True, exist_ok=True)
    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)

    source = Image.open(SOURCE_PATH).convert("RGBA")

    panels = []
    for x0, x1 in PANEL_BOUNDS:
        panel = source.crop((x0, 0, x1, source.height))
        box = content_box(np.array(panel)[:, :, 3])
        panels.append(panel.crop(box))

    # One scale for every frame keeps the palm the same apparent size across the
    # travel/impact sequence.
    widest = max(panel.width for panel in panels)
    tallest = max(panel.height for panel in panels)
    scale = min(CONTENT_SIZE / widest, CONTENT_SIZE / tallest)

    frames = []
    for index, panel in enumerate(panels):
        width = max(1, round(panel.width * scale))
        height = max(1, round(panel.height * scale))
        resized = panel.resize((width, height), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        frame.paste(
            resized,
            ((FRAME_SIZE - width) // 2, (FRAME_SIZE - height) // 2),
            resized,
        )
        frames.append(feather_alpha(frame, FEATHER_EDGES[index]))

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        frame.save(VFX_DIR / f"frame-{index + 1}.png")
        sheet.paste(frame, (index * FRAME_SIZE, 0))

    sheet.save(VFX_DIR / "sheet.png")
    (VFX_DIR / "sheet.json").write_text(
        "{\n"
        '  "frameWidth": 256,\n'
        '  "frameHeight": 256,\n'
        '  "frameCount": 4,\n'
        '  "fps": 12,\n'
        '  "source": "docs/example/nhu-lai-than-chuong.png (four panels, transparency preserved)"\n'
        "}\n"
    )

    icon_frame = frames[ICON_FRAME]
    icon_box = icon_frame.getbbox()
    if not icon_box:
        raise ValueError("Icon frame has no visible pixels")
    icon = icon_frame.crop(icon_box)
    side = max(icon.width, icon.height)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(
        icon,
        ((side - icon.width) // 2, (side - icon.height) // 2),
        icon,
    )
    square.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS).save(ICON_PATH)

    print(f"Generated {VFX_DIR / 'sheet.png'}")
    print(f"Generated {ICON_PATH}")


if __name__ == "__main__":
    build()
