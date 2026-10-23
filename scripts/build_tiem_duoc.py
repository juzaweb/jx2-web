"""Extract the herb shop (Dược Điểm) building from reference art.

The source art contains the building facade drawn over a baked checkerboard
background. This script flood-fills the background from the border, removes
anti-aliasing fringing, tightly crops the building, and outputs the transparent
runtime image at public/duoc-diem.png.

Run: python3 scripts/build_tiem_duoc.py
"""

from collections import deque
from pathlib import Path
import sys

try:
    import numpy as np
    from PIL import Image
except ImportError as err:
    sys.exit(
        f"Missing dependency ({err}). Please install pillow and numpy: pip install pillow numpy"
    )

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "example" / "tiem-duoc.png"
TARGET = ROOT / "public" / "duoc-diem.png"


def background_mask(arr):
    """Flood-fill the baked checkerboard background from the image borders."""
    rgb = arr.astype(np.int16)
    channel_diff = np.max(np.abs(rgb[:, :, :2] - rgb[:, :, 1:]), axis=2)
    diff_rb = np.abs(rgb[:, :, 0] - rgb[:, :, 2])
    max_diff = np.maximum(channel_diff, diff_rb)
    candidate = (max_diff <= 8) & (rgb.min(axis=2) >= 150)

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
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < height and 0 <= nx < width:
                if not filled[ny, nx] and candidate[ny, nx]:
                    filled[ny, nx] = True
                    queue.append((ny, nx))

    return filled


def de_fringe(alpha, rgb):
    """Drop the one-pixel halo left by anti-aliasing against the checkerboard."""
    channel_diff = np.max(np.abs(rgb[:, :, :2] - rgb[:, :, 1:]), axis=2)
    diff_rb = np.abs(rgb[:, :, 0] - rgb[:, :, 2])
    max_diff = np.maximum(channel_diff, diff_rb)
    near_grey = (max_diff <= 10) & (rgb.min(axis=2) >= 140)

    solid = alpha > 0
    edge = np.zeros_like(solid)
    edge[1:, :] |= ~solid[:-1, :]
    edge[:-1, :] |= ~solid[1:, :]
    edge[:, 1:] |= ~solid[:, :-1]
    edge[:, :-1] |= ~solid[:, 1:]
    alpha[solid & edge & near_grey] = 0


def build_building():
    if not SOURCE.exists():
        raise SystemExit(f"source not found: {SOURCE}")

    img = Image.open(SOURCE).convert("RGB")
    arr = np.array(img)

    bg_mask = background_mask(arr)
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    de_fringe(alpha, arr.astype(np.int16))

    rgba = np.dstack([arr, alpha])
    out_img = Image.fromarray(rgba, "RGBA")

    bbox = out_img.getbbox()
    if not bbox:
        raise SystemExit("no building content found")

    cropped = out_img.crop(bbox)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(TARGET)
    print(f"saved {cropped.size[0]}x{cropped.size[1]} herb shop to {TARGET}")


if __name__ == "__main__":
    build_building()
