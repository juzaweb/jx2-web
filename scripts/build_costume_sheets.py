"""Build modular pixel spritesheets for wuxia costume items.

Produces:
1. public/hero-hat-non-truc.png (Plain bamboo conical hat for male)
2. public/hero-hat-non-mang.png (Veiled bamboo conical hat for female)
3. public/hero-armor-lang-khach-male.png (Wuxia robe for male)
4. public/hero-armor-lang-khach-female.png (Wuxia robe for female)
5. public/hero-pants-lang-khach-male.png (Trousers & boots for male)
6. public/hero-pants-lang-khach-female.png (Trousers & boots for female - shared with male)

Dimensions: 512x640 RGBA (4 columns x 4 rows of 128x160 frames).
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
DOCS_EXAMPLE = ROOT / "docs" / "example"

FRAME_W = 128
FRAME_H = 160
COLS = 4
ROWS = 4
SHEET_W = FRAME_W * COLS
SHEET_H = FRAME_H * ROWS

def load_body(gender="male"):
    path = PUBLIC / f"hero-body-{gender}.png"
    im = Image.open(path).convert("RGBA")
    return np.array(im)

def get_frame(sheet_arr, r, c):
    return sheet_arr[r * FRAME_H:(r + 1) * FRAME_H, c * FRAME_W:(c + 1) * FRAME_W]

def get_body_features(f):
    alpha = f[:, :, 3]
    ys, xs = np.where(alpha > 20)
    if len(ys) == 0:
        return None
    
    head_top = int(ys.min())
    feet_bottom = int(ys.max())
    
    # Calculate horizontal centroid of the head (y in [head_top, head_top + 32])
    head_ys, head_xs = np.where((alpha > 20) & (np.arange(160)[:, None] <= head_top + 32))
    cx = float(head_xs.mean()) if len(head_xs) > 0 else float(xs.mean())
    
    return {
        "head_top": head_top,
        "feet_bottom": feet_bottom,
        "cx": cx,
        "alpha": alpha,
        "f": f
    }

def draw_hat(draw, r, c, feat, veiled=False):
    cx = int(round(feat["cx"]))
    ht = feat["head_top"]
    
    c_hi = (218, 196, 150, 255)
    c_base = (194, 165, 110, 255)
    c_shadow = (150, 122, 67, 255)
    c_dark = (90, 69, 32, 255)
    c_under = (110, 85, 45, 255)
    c_strap = (34, 32, 30, 255)
    
    apex_y = ht - 11
    brim_y = ht + 20
    
    if r == 0:  # Front
        apex_x = cx
        half_w = 36
        left_x = cx - half_w
        right_x = cx + half_w
        
        poly = [(apex_x, apex_y), (right_x, brim_y), (cx, brim_y + 4), (left_x, brim_y)]
        draw.polygon(poly, fill=c_base, outline=c_dark)
        draw.polygon([(apex_x, apex_y), (cx + 18, brim_y - 2), (cx, brim_y + 3), (left_x + 10, brim_y)], fill=c_hi)
        draw.polygon([(apex_x, apex_y), (right_x, brim_y), (cx + 12, brim_y + 2)], fill=c_shadow)
        
        for dx in [-24, -12, 0, 12, 24]:
            draw.line([(apex_x, apex_y + 2), (cx + dx, brim_y + 2)], fill=c_dark, width=1)
        draw.arc([cx - 18, apex_y + 8, cx + 18, apex_y + 20], 0, 180, fill=c_shadow, width=1)
        draw.arc([cx - 28, apex_y + 16, cx + 28, apex_y + 30], 0, 180, fill=c_shadow, width=1)
        draw.line([(left_x + 2, brim_y + 1), (right_x - 2, brim_y + 1)], fill=c_under, width=2)
        
        if not veiled:
            draw.line([(cx - 10, brim_y + 2), (cx - 2, ht + 34)], fill=c_strap, width=2)
            draw.line([(cx + 10, brim_y + 2), (cx + 2, ht + 34)], fill=c_strap, width=2)
            draw.rectangle([cx - 3, ht + 33, cx + 3, ht + 36], fill=c_strap)
            draw.line([(cx - 1, ht + 36), (cx - 3, ht + 43)], fill=c_strap, width=1)
            draw.line([(cx + 1, ht + 36), (cx + 4, ht + 44)], fill=c_strap, width=1)
        else:
            veil_fill = (235, 242, 248, 165)
            veil_line = (185, 200, 215, 190)
            veil_bottom = ht + 46
            draw.polygon([(left_x + 4, brim_y + 2), (cx - 8, brim_y + 3), (cx - 6, veil_bottom), (left_x + 6, veil_bottom - 2)], fill=veil_fill)
            draw.polygon([(cx + 8, brim_y + 3), (right_x - 4, brim_y + 2), (right_x - 6, veil_bottom - 2), (cx + 6, veil_bottom)], fill=veil_fill)
            for vx in range(left_x + 8, right_x - 8, 5):
                draw.line([(vx, brim_y + 2), (vx, veil_bottom)], fill=veil_line, width=1)
            draw.line([(left_x + 6, veil_bottom - 2), (cx - 6, veil_bottom)], fill=veil_line, width=1)
            draw.line([(cx + 6, veil_bottom), (right_x - 6, veil_bottom - 2)], fill=veil_line, width=1)

    elif r in (1, 2):  # Side profile
        apex_x = cx - 2
        front_x = cx + 32
        back_x = cx - 30
        
        poly = [(apex_x, apex_y), (front_x, brim_y - 1), (cx + 2, brim_y + 4), (back_x, brim_y + 2)]
        draw.polygon(poly, fill=c_base, outline=c_dark)
        draw.polygon([(apex_x, apex_y), (front_x - 4, brim_y), (cx - 4, brim_y + 2)], fill=c_hi)
        draw.polygon([(apex_x, apex_y), (back_x, brim_y + 2), (cx - 8, brim_y + 3)], fill=c_shadow)
        
        draw.line([(apex_x, apex_y + 2), (front_x - 8, brim_y + 1)], fill=c_dark, width=1)
        draw.line([(apex_x, apex_y + 2), (cx, brim_y + 3)], fill=c_dark, width=1)
        draw.line([(apex_x, apex_y + 2), (back_x + 8, brim_y + 2)], fill=c_dark, width=1)
        
        if not veiled:
            draw.line([(cx, brim_y + 2), (cx + 6, ht + 33)], fill=c_strap, width=2)
            draw.line([(cx + 6, ht + 33), (cx + 8, ht + 41)], fill=c_strap, width=1)
        else:
            veil_fill = (235, 242, 248, 165)
            veil_line = (185, 200, 215, 190)
            veil_bottom = ht + 48
            draw.polygon([(back_x + 2, brim_y + 2), (front_x - 2, brim_y), (front_x - 4, veil_bottom - 4), (back_x + 4, veil_bottom)], fill=veil_fill)
            for vx in range(back_x + 6, front_x - 4, 6):
                draw.line([(vx, brim_y + 2), (vx, veil_bottom - 2)], fill=veil_line, width=1)

    elif r == 3:  # Back
        apex_x = cx
        half_w = 36
        left_x = cx - half_w
        right_x = cx + half_w
        
        poly = [(apex_x, apex_y), (right_x, brim_y), (cx, brim_y + 5), (left_x, brim_y)]
        draw.polygon(poly, fill=c_base, outline=c_dark)
        draw.polygon([(apex_x, apex_y), (cx + 10, brim_y + 2), (cx - 15, brim_y + 3)], fill=c_shadow)
        
        for dx in [-24, -12, 0, 12, 24]:
            draw.line([(apex_x, apex_y + 2), (cx + dx, brim_y + 3)], fill=c_dark, width=1)
        draw.arc([cx - 20, apex_y + 10, cx + 20, apex_y + 24], 0, 180, fill=c_shadow, width=1)
        draw.arc([cx - 30, apex_y + 18, cx + 30, apex_y + 32], 0, 180, fill=c_shadow, width=1)
        
        if veiled:
            veil_fill = (235, 242, 248, 185)
            veil_line = (185, 200, 215, 205)
            veil_bottom = ht + 52
            draw.polygon([(left_x + 4, brim_y + 2), (right_x - 4, brim_y + 2), (right_x - 6, veil_bottom), (left_x + 6, veil_bottom)], fill=veil_fill)
            for vx in range(left_x + 8, right_x - 8, 5):
                draw.line([(vx, brim_y + 3), (vx, veil_bottom)], fill=veil_line, width=1)

def build_sheet(generator_fn, body_arr, **kwargs):
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    frames = [[None for _ in range(COLS)] for _ in range(ROWS)]
    
    for r in [0, 2, 3]:
        for c in range(COLS):
            f_body = get_frame(body_arr, r, c)
            feat = get_body_features(f_body)
            f_out = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            if feat:
                draw = ImageDraw.Draw(f_out)
                generator_fn(draw, r, c, feat, **kwargs)
            frames[r][c] = f_out
            
    for c in range(COLS):
        r2_img = frames[2][c]
        r1_img = r2_img.transpose(Image.FLIP_LEFT_RIGHT)
        frames[1][c] = r1_img

    for r in range(ROWS):
        for c in range(COLS):
            sheet.paste(frames[r][c], (c * FRAME_W, r * FRAME_H))
            
    return sheet

def build_hat_from_source(source_path, body_arr):
    """Process Gemini generated male hat sheet into runtime 512x640 spritesheet."""
    im = Image.open(source_path).convert("RGBA")
    arr = np.array(im)
    is_bg = (arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240)
    arr[is_bg, 3] = 0

    keyed = Image.fromarray(arr)
    w, h = keyed.size
    half_w, half_h = w // 2, h // 2

    tl_c = keyed.crop(keyed.crop((0, 0, half_w, half_h)).getbbox())
    tr_c = keyed.crop(keyed.crop((half_w, 0, w, half_h)).getbbox())
    bl_c = keyed.crop(keyed.crop((0, half_h, half_w, h)).getbbox())

    bl_arr = np.array(bl_c)
    cutoff = int(bl_c.height * 0.76)
    bl_arr[cutoff:, :, 3] = 0
    bl_clean = Image.fromarray(bl_arr)

    HAT_W = 72
    tl_scaled = tl_c.resize((HAT_W, int(round(tl_c.height * (HAT_W / tl_c.width)))), Image.Resampling.LANCZOS)
    tr_scaled = tr_c.resize((HAT_W, int(round(tr_c.height * (HAT_W / tr_c.width)))), Image.Resampling.LANCZOS)
    bl_scaled = bl_clean.resize((HAT_W, int(round(bl_clean.height * (HAT_W / bl_clean.width)))), Image.Resampling.LANCZOS)

    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))

    for r in range(ROWS):
        for c in range(COLS):
            f_body = get_frame(body_arr, r, c)
            feat = get_body_features(f_body)
            if not feat:
                continue
            ht = feat["head_top"]
            cx = int(round(feat["cx"]))
            frame_hat = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))

            if r == 0:  # Front
                h_img = tl_scaled
                frame_hat.paste(h_img, (cx - h_img.width // 2, ht - 8), h_img)
            elif r == 2:  # Right
                h_img = tr_scaled
                frame_hat.paste(h_img, (cx - h_img.width // 2 + 1, ht - 8), h_img)
            elif r == 1:  # Left (mirror right)
                h_img = tr_scaled.transpose(Image.FLIP_LEFT_RIGHT)
                frame_hat.paste(h_img, (cx - h_img.width // 2 - 1, ht - 8), h_img)
            elif r == 3:  # Back
                h_img = bl_scaled
                frame_hat.paste(h_img, (cx - h_img.width // 2, ht - 8), h_img)

            sheet.paste(frame_hat, (c * FRAME_W, r * FRAME_H))

    return sheet

def build_veiled_hat_female(source_path, body_arr):
    """Process female veiled conical hat (non-nu.png) into runtime 512x640 spritesheet."""
    im = Image.open(source_path).convert("RGBA")
    w, h = im.size
    hw, hh = w // 2, h // 2

    tl = im.crop((0, 0, hw, hh))
    tl_c = tl.crop(tl.getbbox())
    tr = im.crop((hw, 0, w, hh))
    tr_c = tr.crop(tr.getbbox())
    bl = im.crop((0, hh, hw, h))
    bl_c = bl.crop(bl.getbbox())

    HAT_W = 76
    tl_scaled = tl_c.resize((HAT_W, int(round(tl_c.height * (HAT_W / tl_c.width)))), Image.Resampling.LANCZOS)
    tr_scaled = tr_c.resize((HAT_W, int(round(tr_c.height * (HAT_W / tr_c.width)))), Image.Resampling.LANCZOS)
    bl_scaled = bl_c.resize((HAT_W, int(round(bl_c.height * (HAT_W / bl_c.width)))), Image.Resampling.LANCZOS)

    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))

    for r in range(ROWS):
        for c in range(COLS):
            f_body = get_frame(body_arr, r, c)
            feat = get_body_features(f_body)
            if not feat:
                continue
            ht = feat["head_top"]
            cx = int(round(feat["cx"]))
            frame_hat = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))

            if r == 0:  # Front
                h_img = tl_scaled
                frame_hat.paste(h_img, (cx - h_img.width // 2, ht - 8), h_img)
            elif r == 2:  # Right
                h_img = tr_scaled
                frame_hat.paste(h_img, (cx - h_img.width // 2 + 1, ht - 8), h_img)
            elif r == 1:  # Left (mirror right)
                h_img = tr_scaled.transpose(Image.FLIP_LEFT_RIGHT)
                frame_hat.paste(h_img, (cx - h_img.width // 2 - 1, ht - 8), h_img)
            elif r == 3:  # Back
                h_img = bl_scaled
                frame_hat.paste(h_img, (cx - h_img.width // 2, ht - 8), h_img)

            sheet.paste(frame_hat, (c * FRAME_W, r * FRAME_H))

    return sheet

def build_robe_male_from_source(source_path, body_arr):
    """Build male robe from docs/example/ao.png."""
    ao_raw = Image.open(source_path).convert("RGBA")
    robe_sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            source_r = 0 if r == 0 else (3 if r == 3 else 1)
            cell = ao_raw.crop((c * 512, source_r * 512, (c + 1) * 512, (source_r + 1) * 512))
            bbox = cell.getbbox()
            if not bbox:
                continue
            cropped = cell.crop(bbox)
            if r == 1:
                cropped = cropped.transpose(Image.FLIP_LEFT_RIGHT)

            f = get_frame(body_arr, r, c)
            feat = get_body_features(f)
            if not feat:
                continue
            ht = feat["head_top"]
            cx = int(round(feat["cx"]))

            if r == 0:
                TARGET_W = 62
                ratio = TARGET_W / cropped.width
                target_h = int(round(cropped.height * ratio))
                scaled = cropped.resize((TARGET_W, target_h), Image.Resampling.LANCZOS)
                pos_x = cx - TARGET_W // 2
                pos_y = ht + 33
            elif r == 3:
                TARGET_W = 60
                ratio = TARGET_W / cropped.width
                target_h = int(round(cropped.height * ratio))
                scaled = cropped.resize((TARGET_W, target_h), Image.Resampling.LANCZOS)
                pos_x = cx - TARGET_W // 2
                pos_y = ht + 33
            else:  # Side (r=1, 2)
                TARGET_H = 52
                ratio = TARGET_H / cropped.height
                target_w = int(round(cropped.width * ratio))
                scaled = cropped.resize((target_w, TARGET_H), Image.Resampling.LANCZOS)
                pos_x = cx - target_w // 2 + (2 if r == 2 else -2)
                pos_y = ht + 33

            frame_robe = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            frame_robe.paste(scaled, (pos_x, pos_y), scaled)
            robe_sheet.paste(frame_robe, (c * FRAME_W, r * FRAME_H))

    return robe_sheet

def build_robe_female_from_source(source_path, body_arr):
    """Build female robe from docs/example/ao-nu.png."""
    ao_raw = Image.open(source_path).convert("RGBA")
    robe_sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            cell = ao_raw.crop((c * 512, r * 512, (c + 1) * 512, (r + 1) * 512))
            bbox = cell.getbbox()
            if not bbox:
                continue
            cropped = cell.crop(bbox)

            f = get_frame(body_arr, r, c)
            feat = get_body_features(f)
            if not feat:
                continue
            ht = feat["head_top"]
            cx = int(round(feat["cx"]))

            TARGET_H = 56
            ratio = TARGET_H / cropped.height
            target_w = int(round(cropped.width * ratio))
            scaled = cropped.resize((target_w, TARGET_H), Image.Resampling.LANCZOS)

            pos_x = cx - target_w // 2 + (1 if r == 2 else (-1 if r == 1 else 0))
            pos_y = ht + 36

            frame_robe = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            frame_robe.paste(scaled, (pos_x, pos_y), scaled)
            robe_sheet.paste(frame_robe, (c * FRAME_W, r * FRAME_H))

    return robe_sheet

def build_pants_male_from_source(source_path, body_arr):
    """Build male trousers and boots from docs/example/quan.png."""
    im = Image.open(source_path).convert("RGB")
    arr = np.array(im, dtype=float)
    bg_ref = np.array([174.0, 182.0, 189.0])
    dist = np.linalg.norm(arr - bg_ref, axis=2)
    sparkle = (arr[:, :, 0] > 220) & (arr[:, :, 1] > 220) & (arr[:, :, 2] > 220)
    is_bg = (dist < 22) | ((dist < 35) & (arr[:, :, 2] >= arr[:, :, 0])) | (sparkle & (np.arange(2048)[:, None] > 1850) & (np.arange(2048)[None, :] > 1850))

    out_rgba = np.zeros((2048, 2048, 4), dtype=np.uint8)
    out_rgba[:, :, :3] = np.array(im)
    out_rgba[:, :, 3] = np.where(is_bg, 0, 255)
    quan_keyed = Image.fromarray(out_rgba)

    pants_sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            cell = quan_keyed.crop((c * 512, r * 512, (c + 1) * 512, (r + 1) * 512))
            bbox = cell.getbbox()
            if not bbox:
                continue
            cropped = cell.crop(bbox)

            f = get_frame(body_arr, r, c)
            feat = get_body_features(f)
            if not feat:
                continue
            fb = feat["feet_bottom"]
            cx = int(round(feat["cx"]))

            TARGET_H = 68
            ratio = TARGET_H / cropped.height
            target_w = int(round(cropped.width * ratio))
            scaled = cropped.resize((target_w, TARGET_H), Image.Resampling.LANCZOS)

            frame_pants = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            pos_x = cx - target_w // 2
            pos_y = fb - TARGET_H
            frame_pants.paste(scaled, (pos_x, pos_y), scaled)
            pants_sheet.paste(frame_pants, (c * FRAME_W, r * FRAME_H))

    return pants_sheet

def extract_icon(img, bbox, size=(48, 48)):
    """Extract a centered square item icon with transparency padding."""
    cropped = img.crop(bbox)
    icon = Image.new("RGBA", size, (0, 0, 0, 0))
    scale = min((size[0] - 4) / cropped.width, (size[1] - 4) / cropped.height)
    new_w = int(round(cropped.width * scale))
    new_h = int(round(cropped.height * scale))
    scaled = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    icon.paste(scaled, ((size[0] - new_w) // 2, (size[1] - new_h) // 2), scaled)
    return icon

def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    body_male = load_body("male")
    body_female = load_body("female")
    
    # 1. Male Conical Hat (hero-hat-non-truc.png)
    source_hat_m = DOCS_EXAMPLE / "non-truc.png"
    if source_hat_m.exists():
        print(f"Building official hero-hat-non-truc.png from {source_hat_m.name}...")
        hat_m = build_hat_from_source(source_hat_m, body_male)
        hat_m.save(PUBLIC / "hero-hat-non-truc.png")
    else:
        print("Generating procedural hero-hat-non-truc.png...")
        hat_m = build_sheet(draw_hat, body_male, veiled=False)
        hat_m.save(PUBLIC / "hero-hat-non-truc.png")

    # 2. Female Veiled Conical Hat (hero-hat-non-mang.png)
    source_hat_f = DOCS_EXAMPLE / "non-nu.png"
    if source_hat_f.exists():
        print(f"Building official hero-hat-non-mang.png from {source_hat_f.name}...")
        hat_f = build_veiled_hat_female(source_hat_f, body_female)
        hat_f.save(PUBLIC / "hero-hat-non-mang.png")
    else:
        print("Generating procedural hero-hat-non-mang.png...")
        hat_f = build_sheet(draw_hat, body_female, veiled=True)
        hat_f.save(PUBLIC / "hero-hat-non-mang.png")
    
    # 3. Male Robe (hero-armor-lang-khach-male.png)
    source_robe_m = DOCS_EXAMPLE / "ao.png"
    if source_robe_m.exists():
        print(f"Building official hero-armor-lang-khach-male.png from {source_robe_m.name}...")
        armor_m = build_robe_male_from_source(source_robe_m, body_male)
        armor_m.save(PUBLIC / "hero-armor-lang-khach-male.png")
    else:
        print("Using existing hero-armor-lang-khach-male.png...")

    # 4. Female Robe (hero-armor-lang-khach-female.png)
    source_robe_f = DOCS_EXAMPLE / "ao-nu.png"
    if source_robe_f.exists():
        print(f"Building official hero-armor-lang-khach-female.png from {source_robe_f.name}...")
        armor_f = build_robe_female_from_source(source_robe_f, body_female)
        armor_f.save(PUBLIC / "hero-armor-lang-khach-female.png")
    else:
        print("Warning: docs/example/ao-nu.png not found!")

    # 5. Male Pants (hero-pants-lang-khach-male.png)
    source_pants_m = DOCS_EXAMPLE / "quan.png"
    if source_pants_m.exists():
        print(f"Building official hero-pants-lang-khach-male.png from {source_pants_m.name}...")
        pants_m = build_pants_male_from_source(source_pants_m, body_male)
        pants_m.save(PUBLIC / "hero-pants-lang-khach-male.png")
    else:
        print("Using existing hero-pants-lang-khach-male.png...")
        pants_m = Image.open(PUBLIC / "hero-pants-lang-khach-male.png")

    # 6. Female Pants (hero-pants-lang-khach-female.png) - SHARED WITH MALE
    print("Generating hero-pants-lang-khach-female.png (shared with male)...")
    pants_f = Image.open(PUBLIC / "hero-pants-lang-khach-male.png")
    pants_f.save(PUBLIC / "hero-pants-lang-khach-female.png")

    # 7. Item Icons
    if source_hat_m.exists():
        im_hm = Image.open(source_hat_m).convert("RGBA")
        arr = np.array(im_hm)
        is_bg = (arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240)
        arr[is_bg, 3] = 0
        keyed = Image.fromarray(arr)
        tl_c = keyed.crop((0, 0, keyed.width // 2, keyed.height // 2))
        icon_hat_m = extract_icon(tl_c, tl_c.getbbox())
        icon_hat_m.save(PUBLIC / "icon-hat-non-truc.png")

    if source_hat_f.exists():
        im_hf = Image.open(source_hat_f).convert("RGBA")
        tl_hf = im_hf.crop((0, 0, im_hf.width // 2, im_hf.height // 2))
        icon_hat_f = extract_icon(tl_hf, tl_hf.getbbox())
        icon_hat_f.save(PUBLIC / "icon-hat-non-mang.png")

    if source_robe_m.exists():
        ao_m = Image.open(source_robe_m).convert("RGBA")
        ao_cell0 = ao_m.crop((0, 0, 512, 512))
        icon_ao = extract_icon(ao_cell0, ao_cell0.getbbox())
        icon_ao.save(PUBLIC / "icon-armor-lang-khach.png")

    print("All modular costume spritesheets and icons generated successfully.")

if __name__ == "__main__":
    main()
