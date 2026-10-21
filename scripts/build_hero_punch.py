"""Generate punch action spritesheets (512x640) for male and female characters.

Four direction rows (front, left, right, back) x four punch frames per row:
0: Windup / Ready stance
1: Strike / Power extension with martial arts fist trail
2: Impact peak / Punch apex with energy aura
3: Recovery / Retract

Run: python3 scripts/build_hero_punch.py
"""

from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

COLS = 4
ROWS = 4
FRAME_W = 128
FRAME_H = 160
CONTENT_CENTER_X = FRAME_W // 2
CONTENT_BOTTOM = FRAME_H

TARGETS = {
    "hero-punch-male.png": PUBLIC / "hero-body-male.png",
    "hero-punch-female.png": PUBLIC / "hero-body-female.png",
}

def create_punch_frame(base_img, row_idx, col_idx, gender):
    """Derive punch frame (128x160) from base body idle frame."""
    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))

    # Direction vectors for punch displacement (row 0: down, row 1: left, row 2: right, row 3: up)
    dirs = [
        (0, 5),    # 0: Down / Front
        (-10, 2),  # 1: Left
        (10, 2),   # 2: Right
        (0, -6)    # 3: Up / Back
    ]
    dx, dy = dirs[row_idx]

    # Frame progression offsets:
    # 0: Windup (-dx*0.3, -2)
    # 1: Strike (+dx*0.9, +dy*0.8)
    # 2: Impact (+dx*1.2, +dy*1.0)
    # 3: Recovery (+dx*0.4, +dy*0.3)
    factors = [-0.35, 0.9, 1.2, 0.45]
    f = factors[col_idx]

    shift_x = int(round(dx * f))
    shift_y = int(round(dy * f))

    # Paste base character with directional body shift
    frame.paste(base_img, (shift_x, shift_y), base_img)

    # Overlay martial arts energy / fist punch effect on frames 1 and 2
    if col_idx in (1, 2):
        overlay = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Calculate fist center position
        base_fist_x = CONTENT_CENTER_X + (18 if row_idx == 2 else (-18 if row_idx == 1 else (6 if row_idx == 0 else -6)))
        base_fist_y = CONTENT_BOTTOM - 68

        fist_x = base_fist_x + shift_x + int(dx * 0.8)
        fist_y = base_fist_y + shift_y + int(dy * 0.8)

        # Draw punch energy aura (gold/cyan wuxia Qi glow)
        radius = 12 if col_idx == 1 else 16
        color_core = (255, 240, 180, 230) if gender == "male" else (255, 220, 200, 230)
        color_glow = (255, 180, 60, 140) if gender == "male" else (255, 120, 180, 140)

        # Energy trail line behind punch
        start_x = fist_x - int(dx * 0.9)
        start_y = fist_y - int(dy * 0.9)
        draw.line([(start_x, start_y), (fist_x, fist_y)], fill=(255, 220, 100, 180), width=6)
        draw.line([(start_x, start_y), (fist_x, fist_y)], fill=(255, 255, 220, 240), width=2)

        # Outer glow circle
        draw.ellipse([fist_x - radius, fist_y - radius, fist_x + radius, fist_y + radius], fill=color_glow)
        # Inner core circle
        draw.ellipse([fist_x - (radius // 2), fist_y - (radius // 2), fist_x + (radius // 2), fist_y + (radius // 2)], fill=color_core)

        # Flash star burst on impact frame (col 2)
        if col_idx == 2:
            s = 10
            draw.line([(fist_x - s, fist_y), (fist_x + s, fist_y)], fill=(255, 255, 255, 240), width=2)
            draw.line([(fist_x, fist_y - s), (fist_x, fist_y + s)], fill=(255, 255, 255, 240), width=2)

        frame = Image.alpha_composite(frame, overlay)

    return frame

def build_punch_sheet(source_path, gender):
    if not source_path.exists():
        raise FileNotFoundError(f"Missing base body sheet: {source_path}")

    body_sheet = Image.open(source_path).convert("RGBA")
    out_sheet = Image.new("RGBA", (FRAME_W * COLS, FRAME_H * ROWS), (0, 0, 0, 0))

    for row in range(ROWS):
        # Base frame is column 0 (idle pose) of each row in body sheet
        crop_box = (0, row * FRAME_H, FRAME_W, (row + 1) * FRAME_H)
        base_idle = body_sheet.crop(crop_box)

        for col in range(COLS):
            punch_frame = create_punch_frame(base_idle, row, col, gender)
            out_sheet.paste(punch_frame, (col * FRAME_W, row * FRAME_H))

    return out_sheet

def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for target_name, source_path in TARGETS.items():
        gender = "female" if "female" in target_name else "male"
        print(f"Generating {target_name} from {source_path.name}...")
        sheet = build_punch_sheet(source_path, gender)
        target_path = PUBLIC / target_name
        sheet.save(target_path, optimize=True)
        print(f"Wrote {target_path.relative_to(ROOT)} ({sheet.width}x{sheet.height})")

if __name__ == "__main__":
    main()
