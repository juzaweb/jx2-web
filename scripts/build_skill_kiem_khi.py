"""Build the Kiếm Khí VFX spritesheet and hotbar icon.

The source sheet (`docs/example/kiem-khi.png`) ships four cyan sword-qi
illustrations in a single row on a transparent background:

1-2. the flying blade shard with its thrust trail (panel 2 repeats panel 1),
3.   the vortex as the shard reaches its target,
4.   the burst that owns the impact (there is no separate vector blast).

Panels are detected from the alpha channel (their painted extents do not line
up with exact quarters), normalised to a shared scale and centred in 256x256
frames. The repeated travel panel is dropped, and the burst is held for one
extra frame so it stays on screen for a beat before Phaser destroys the sprite
(a one-shot frame would blink out in 83 ms). The result is the usual 4-frame
1024x256 sheet: 1 travel frame plus a 3-frame impact (vortex, burst, hold).

The authored square painting in `docs/example/kiem-khi-icon.png` becomes the
128x128 hotbar icon.

Run: python3 scripts/build_skill_kiem_khi.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "docs" / "example" / "kiem-khi.png"
ICON_SOURCE_PATH = ROOT / "docs" / "example" / "kiem-khi-icon.png"
VFX_DIR = ROOT / "public" / "skills" / "vfx" / "kiem_khi"
ICON_PATH = ROOT / "public" / "skills" / "kiem_khi.png"

FRAME_SIZE = 256
CONTENT_SIZE = 240
ALPHA_THRESHOLD = 8
EXPECTED_PANELS = 4
DUPLICATE_TOLERANCE = 1.0  # mean abs pixel difference (0-255) of a repeated panel
ICON_SIZE = 128
ICON_PADDING = 0


def panel_bounds(alpha: np.ndarray) -> list[tuple[int, int]]:
    """Column ranges of the visible panels, left to right."""
    columns = (alpha > ALPHA_THRESHOLD).any(axis=0)
    bounds: list[tuple[int, int]] = []
    start = None
    for x, visible in enumerate(columns):
        if visible and start is None:
            start = x
        elif not visible and start is not None:
            bounds.append((start, x))
            start = None
    if start is not None:
        bounds.append((start, len(columns)))

    if len(bounds) != EXPECTED_PANELS:
        raise ValueError(f"expected {EXPECTED_PANELS} panels, found {len(bounds)}: {bounds}")
    return bounds


def content_box(alpha: np.ndarray) -> tuple[int, int, int, int]:
    """Bounding box of the visible pixels in one panel."""
    ys, xs = np.where(alpha > ALPHA_THRESHOLD)
    if not len(xs):
        raise ValueError("Panel has no visible pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def looks_identical(first: Image.Image, second: Image.Image) -> bool:
    """Whether two panels paint the same picture, ignoring sub-pixel noise."""
    width = min(first.width, second.width)
    height = min(first.height, second.height)
    a = np.asarray(first.crop((0, 0, width, height)), dtype=np.int16)
    b = np.asarray(second.crop((0, 0, width, height)), dtype=np.int16)
    return float(np.abs(a - b).mean()) < DUPLICATE_TOLERANCE


def build_frames(source: Image.Image) -> list[Image.Image]:
    """Crop every panel and place it in a centred 256x256 frame."""
    panels = []
    for x0, x1 in panel_bounds(np.array(source)[:, :, 3]):
        panel = source.crop((x0, 0, x1, source.height))
        panels.append(panel.crop(content_box(np.array(panel)[:, :, 3])))

    # The art repeats its travel pose; drop the repeat so the shard does not
    # freeze mid-flight. The remaining panels are blade, vortex and burst.
    unique = [panels[0]]
    for panel in panels[1:]:
        if not looks_identical(unique[-1], panel):
            unique.append(panel)
    if len(unique) < 2:
        raise ValueError("source sheet has no distinct animation panels")
    # Hold the burst so it stays visible before Phaser destroys the one-shot
    # sprite instead of blinking out on a single 83 ms frame.
    unique.append(unique[-1])

    # One scale for every frame keeps the shard the same apparent size across
    # the travel/impact sequence.
    widest = max(panel.width for panel in unique)
    tallest = max(panel.height for panel in unique)
    scale = min(CONTENT_SIZE / widest, CONTENT_SIZE / tallest)

    frames = []
    for panel in unique:
        width = max(1, round(panel.width * scale))
        height = max(1, round(panel.height * scale))
        resized = panel.resize((width, height), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        frame.paste(resized, ((FRAME_SIZE - width) // 2, (FRAME_SIZE - height) // 2), resized)
        frames.append(frame)
    return frames


def build_icon() -> None:
    """Shrink the authored painting to the hotbar icon size."""
    icon = Image.open(ICON_SOURCE_PATH).convert("RGBA")
    if ICON_PADDING:
        icon = icon.crop((
            ICON_PADDING,
            ICON_PADDING,
            icon.width - ICON_PADDING,
            icon.height - ICON_PADDING
        ))
    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    icon.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS).save(ICON_PATH, optimize=True)
    print(f"wrote {ICON_PATH.relative_to(ROOT)} ({ICON_SIZE}x{ICON_SIZE})")


def build() -> None:
    VFX_DIR.mkdir(parents=True, exist_ok=True)
    frames = build_frames(Image.open(SOURCE_PATH).convert("RGBA"))

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        frame.save(VFX_DIR / f"frame-{index + 1}.png")
        sheet.paste(frame, (index * FRAME_SIZE, 0))
    sheet.save(VFX_DIR / "sheet.png", optimize=True)

    (VFX_DIR / "sheet.json").write_text(
        "{\n"
        f'  "frameWidth": {FRAME_SIZE},\n'
        f'  "frameHeight": {FRAME_SIZE},\n'
        f'  "frameCount": {len(frames)},\n'
        '  "fps": 12,\n'
        '  "source": "docs/example/kiem-khi.png (four panels, transparency preserved)"\n'
        "}\n"
    )

    print(f"wrote {(VFX_DIR / 'sheet.png').relative_to(ROOT)} ({sheet.width}x{sheet.height})")
    build_icon()


if __name__ == "__main__":
    build()
