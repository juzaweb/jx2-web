"""Extract and build La Hán Trận VFX spritesheet and icon from Row 2 of the art sheet.

Run: python3 scripts/build_skill_la_han_tran.py
"""

from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = Path("/var/folders/zz/38wct_p13gz3pb0f2jmy1h140000gn/T/orca-paste-1792568787980-e88d15ab-99e4-4530-9330-5f1cf34ec4a0.png")
VFX_DIR = ROOT / "public" / "skills" / "vfx" / "la_han_tran"
ICON_PATH = ROOT / "public" / "skills" / "la_han_tran.png"

ROW_Y0 = 258
ROW_Y1 = 506
BASE_Y = 505
TARGET_BASE_Y = 230

COL_BOUNDS = [
    (0, 186),
    (187, 380),
    (381, 575),
    (576, 765)
]
CENTERS_X = [92.5, 289.0, 481.0, 670.5]


def key_cell(raw):
    """Key out neutral grey checkerboard and feather edges."""
    rgb = raw.astype(np.float32)
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    sat = high - low
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    sat_alpha = np.clip((sat - 12.0) / 16.0, 0.0, 1.0)
    lum_alpha = np.clip((lum - 170.0) / 40.0, 0.0, 1.0)
    combined_alpha = np.maximum(sat_alpha, lum_alpha)

    grey_zone = (sat <= 14) & (lum >= 65) & (lum <= 145)
    combined_alpha[grey_zone] = 0.0
    combined_alpha[combined_alpha < 0.05] = 0.0

    out_rgba = np.zeros((raw.shape[0], raw.shape[1], 4), dtype=np.uint8)
    out_rgba[:, :, :3] = raw
    out_rgba[:, :, 3] = (combined_alpha * 255).astype(np.uint8)
    return out_rgba


def de_fringe(alpha, rgb):
    """Drop the one-to-two-pixel halo left by anti-aliasing against the checkerboard."""
    near_grey = (rgb.max(axis=2) - rgb.min(axis=2) <= 18) & (rgb.min(axis=2) >= 50)
    for _ in range(2):
        solid = alpha > 0
        edge = np.zeros_like(solid)
        edge[1:, :] |= ~solid[:-1, :]
        edge[:-1, :] |= ~solid[1:, :]
        edge[:, 1:] |= ~solid[:, :-1]
        edge[:, :-1] |= ~solid[:, 1:]
        alpha[solid & edge & near_grey] = 0


def build():
    VFX_DIR.mkdir(parents=True, exist_ok=True)
    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)

    sheet_src = Image.open(SOURCE_PATH).convert("RGB")
    src_arr = np.array(sheet_src)

    sheet = Image.new("RGBA", (1024, 256), (0, 0, 0, 0))
    frames = []

    for i, (x0, x1) in enumerate(COL_BOUNDS):
        cx = CENTERS_X[i]
        raw = src_arr[ROW_Y0:ROW_Y1, x0:x1]
        keyed = key_cell(raw)

        alpha = keyed[:, :, 3].copy()
        de_fringe(alpha, keyed[:, :, :3].astype(int))
        keyed[:, :, 3] = alpha

        frame = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        dst_x = int(round(128 - (cx - x0)))
        dst_y = TARGET_BASE_Y - (BASE_Y - ROW_Y0)
        frame.paste(Image.fromarray(keyed, "RGBA"), (dst_x, dst_y))

        frame_path = VFX_DIR / f"frame-{i + 1}.png"
        frame.save(frame_path)
        frames.append(frame)
        sheet.paste(frame, (i * 256, 0))

    sheet_path = VFX_DIR / "sheet.png"
    sheet.save(sheet_path)

    # Save sheet.json metadata
    json_path = VFX_DIR / "sheet.json"
    json_path.write_text(
        '{\n  "frameWidth": 256,\n  "frameHeight": 256,\n  "frameCount": 4,\n  "fps": 8,\n  "source": "Gemini sheet row 2 (background keyed)"\n}\n'
    )

    # Build 64x64 icon from Frame 1 (clean golden formation + palm)
    f1 = frames[0]
    bbox = f1.getbbox()
    crop1 = f1.crop(bbox)
    w, h = crop1.size
    dim = max(w, h)
    sq = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    sq.paste(crop1, ((dim - w) // 2, (dim - h) // 2))
    icon = sq.resize((64, 64), Image.Resampling.LANCZOS)
    icon.save(ICON_PATH)

    print(f"Generated {sheet_path}")
    print(f"Generated {ICON_PATH}")


if __name__ == "__main__":
    build()
