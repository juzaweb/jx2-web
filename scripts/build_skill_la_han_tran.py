"""Extract and build La Hán Trận VFX spritesheet and icon from the 16-frame formation sheet.

Run: python3 scripts/build_skill_la_han_tran.py
"""

from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = Path("/var/folders/zz/38wct_p13gz3pb0f2jmy1h140000gn/T/orca-paste-1792575332575-fe827c2e-aadf-43ec-890a-0a8a4cc87122.png")
ICON_SOURCE_PATH = ROOT / "docs" / "example" / "la-han-tran-icon.png"
VFX_DIR = ROOT / "public" / "skills" / "vfx" / "la_han_tran"
ICON_PATH = ROOT / "public" / "skills" / "la_han_tran.png"
ICON_SIZE = 128

COL_BOUNDS = [(0, 189), (189, 380), (380, 572), (572, 765)]


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


def build_icon():
    if not ICON_SOURCE_PATH.exists():
        raise SystemExit(f"Icon source art not found: {ICON_SOURCE_PATH}")
    with Image.open(ICON_SOURCE_PATH) as art:
        square = art.convert("RGBA")
        side = min(square.size)
        left = (square.width - side) // 2
        top = (square.height - side) // 2
        square = square.crop((left, top, left + side, top + side))
        icon = square.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)
    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    icon.save(ICON_PATH, "PNG", optimize=True)
    print(f"wrote {ICON_PATH.relative_to(ROOT)} ({ICON_SIZE}x{ICON_SIZE})")


def build():
    build_icon()

    if not SOURCE_PATH.exists():
        print(f"VFX source not found ({SOURCE_PATH}); skipped VFX spritesheet build.")
        return

    VFX_DIR.mkdir(parents=True, exist_ok=True)
    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)

    sheet_src = Image.open(SOURCE_PATH).convert("RGB")
    src_arr = np.array(sheet_src)

    sheet = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    frames = []

    for r in range(4):
        y0 = r * 256
        y1 = (r + 1) * 256
        for c in range(4):
            x0, x1 = COL_BOUNDS[c]
            raw = src_arr[y0:y1, x0:x1]
            keyed = key_cell(raw)
            alpha = keyed[:, :, 3].copy()
            de_fringe(alpha, keyed[:, :, :3].astype(int))
            keyed[:, :, 3] = alpha

            # Find exact centroid of this cell
            y_idx, x_idx = np.where(alpha > 30)
            cx_cell = x_idx.mean() if len(x_idx) > 0 else (x1 - x0) / 2
            cy_cell = y_idx.mean() if len(y_idx) > 0 else 128

            frame = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
            dst_x = int(round(128 - cx_cell))
            dst_y = int(round(128 - cy_cell))
            frame.paste(Image.fromarray(keyed, "RGBA"), (dst_x, dst_y))

            frames.append(frame)
            idx = r * 4 + c
            col = idx % 4
            row = idx // 4
            sheet.paste(frame, (col * 256, row * 256))
            frame.save(VFX_DIR / f"frame-{idx + 1}.png")

    sheet.save(VFX_DIR / "sheet.png")

    # Save sheet.json metadata
    (VFX_DIR / "sheet.json").write_text(
        '{\n  "frameWidth": 256,\n  "frameHeight": 256,\n  "frameCount": 16,\n  "fps": 12,\n  "source": "New formation sheet (16 rotation frames centered at 128,128)"\n}\n'
    )
    print(f"Generated {VFX_DIR / 'sheet.png'}")


if __name__ == "__main__":
    build()
