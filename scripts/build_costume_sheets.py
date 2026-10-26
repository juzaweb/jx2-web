"""Build modular pixel spritesheets for wuxia costume items.

Produces:
1. public/hero-hat-non-truc.png (Plain bamboo conical hat for male)
2. public/hero-hat-non-mang.png (Veiled bamboo conical hat for female)
3. public/hero-armor-lang-khach-male.png (Wuxia robe for male)
4. public/hero-armor-lang-khach-female.png (Wuxia robe for female)
5. public/hero-pants-lang-khach-male.png (Trousers & boots for male)
6. public/hero-pants-lang-khach-female.png (Trousers & boots for female)

Dimensions: 512x640 RGBA (4 columns x 4 rows of 128x160 frames).
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

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
    
    # Identify arm pixels (torso level, but outside center body core)
    # Core body width in torso is typically |x - cx| <= 14
    torso_ys, torso_xs = np.where((alpha > 20) & (np.arange(160)[:, None] >= 55) & (np.arange(160)[:, None] <= 115))
    
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
    
    # Colors
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
        
        # Conical body
        poly = [(apex_x, apex_y), (right_x, brim_y), (cx, brim_y + 4), (left_x, brim_y)]
        draw.polygon(poly, fill=c_base, outline=c_dark)
        
        # Upper highlight
        draw.polygon([(apex_x, apex_y), (cx + 18, brim_y - 2), (cx, brim_y + 3), (left_x + 10, brim_y)], fill=c_hi)
        # Shadow on right/lower side
        draw.polygon([(apex_x, apex_y), (right_x, brim_y), (cx + 12, brim_y + 2)], fill=c_shadow)
        
        # Nan tre radial rib lines
        for dx in [-24, -12, 0, 12, 24]:
            draw.line([(apex_x, apex_y + 2), (cx + dx, brim_y + 2)], fill=c_dark, width=1)
        # Concentric weave rings
        draw.arc([cx - 18, apex_y + 8, cx + 18, apex_y + 20], 0, 180, fill=c_shadow, width=1)
        draw.arc([cx - 28, apex_y + 16, cx + 28, apex_y + 30], 0, 180, fill=c_shadow, width=1)
        
        # Brim underside depth
        draw.line([(left_x + 2, brim_y + 1), (right_x - 2, brim_y + 1)], fill=c_under, width=2)
        
        if not veiled:
            # Chin straps
            draw.line([(cx - 10, brim_y + 2), (cx - 2, ht + 34)], fill=c_strap, width=2)
            draw.line([(cx + 10, brim_y + 2), (cx + 2, ht + 34)], fill=c_strap, width=2)
            # Tied knot & ends
            draw.rectangle([cx - 3, ht + 33, cx + 3, ht + 36], fill=c_strap)
            draw.line([(cx - 1, ht + 36), (cx - 3, ht + 43)], fill=c_strap, width=1)
            draw.line([(cx + 1, ht + 36), (cx + 4, ht + 44)], fill=c_strap, width=1)
        else:
            # White translucent veil hanging from brim
            veil_fill = (235, 242, 248, 165)
            veil_line = (185, 200, 215, 190)
            veil_bottom = ht + 46
            
            # Left drape
            draw.polygon([(left_x + 4, brim_y + 2), (cx - 8, brim_y + 3), (cx - 6, veil_bottom), (left_x + 6, veil_bottom - 2)], fill=veil_fill)
            # Right drape
            draw.polygon([(cx + 8, brim_y + 3), (right_x - 4, brim_y + 2), (right_x - 6, veil_bottom - 2), (cx + 6, veil_bottom)], fill=veil_fill)
            # Center soft slit / folds
            for vx in range(left_x + 8, right_x - 8, 5):
                draw.line([(vx, brim_y + 2), (vx, veil_bottom)], fill=veil_line, width=1)
            # Bottom hem
            draw.line([(left_x + 6, veil_bottom - 2), (cx - 6, veil_bottom)], fill=veil_line, width=1)
            draw.line([(cx + 6, veil_bottom), (right_x - 6, veil_bottom - 2)], fill=veil_line, width=1)

    elif r in (1, 2):  # Side profile (R2=Right, R1 will be mirrored from R2)
        apex_x = cx - 2
        front_x = cx + 32
        back_x = cx - 30
        
        poly = [(apex_x, apex_y), (front_x, brim_y - 1), (cx + 2, brim_y + 4), (back_x, brim_y + 2)]
        draw.polygon(poly, fill=c_base, outline=c_dark)
        draw.polygon([(apex_x, apex_y), (front_x - 4, brim_y), (cx - 4, brim_y + 2)], fill=c_hi)
        draw.polygon([(apex_x, apex_y), (back_x, brim_y + 2), (cx - 8, brim_y + 3)], fill=c_shadow)
        
        # Rib lines
        draw.line([(apex_x, apex_y + 2), (front_x - 8, brim_y + 1)], fill=c_dark, width=1)
        draw.line([(apex_x, apex_y + 2), (cx, brim_y + 3)], fill=c_dark, width=1)
        draw.line([(apex_x, apex_y + 2), (back_x + 8, brim_y + 2)], fill=c_dark, width=1)
        
        if not veiled:
            # Chin strap along jaw
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

def draw_robe(draw, r, c, feat, gender="male"):
    cx = int(round(feat["cx"]))
    alpha = feat["alpha"]
    
    if gender == "male":
        c_hi = (131, 153, 170, 255)
        c_base = (100, 123, 140, 255)
        c_shadow = (69, 88, 102, 255)
        c_dark = (43, 56, 66, 255)
        c_belt = (56, 51, 46, 255)
        c_gold = (194, 161, 105, 255)
        c_pouch = (112, 72, 56, 255)
        c_bracer = (74, 60, 53, 255)
        c_bwrap = (42, 32, 26, 255)
    else:
        c_hi = (192, 216, 228, 255)
        c_base = (160, 188, 208, 255)
        c_shadow = (119, 152, 176, 255)
        c_dark = (75, 104, 125, 255)
        c_belt = (86, 121, 144, 255)
        c_gold = (110, 145, 168, 255)
        c_pouch = (101, 134, 157, 255)
        c_bracer = (101, 134, 157, 255)
        c_bwrap = (75, 104, 125, 255)

    if r == 0:  # Front
        # Shoulders & Torso: Y in [60, 92]
        # Shoulders span ~ cx - 24 to cx + 24
        sh_left = cx - 22
        sh_right = cx + 22
        w_left = cx - 17
        w_right = cx + 17
        
        # Robe upper body
        torso_poly = [
            (sh_left, 62), (cx - 7, 56), (cx + 7, 56), (sh_right, 62),
            (sh_right + 3, 75), (w_right, 90), (w_left, 90), (sh_left - 3, 75)
        ]
        draw.polygon(torso_poly, fill=c_base, outline=c_dark)
        
        # Cross collar (V-neck from right shoulder to left waist)
        # Right collar flap over left
        draw.polygon([(cx - 6, 56), (cx + 8, 56), (cx + 2, 74), (cx - 4, 74)], fill=c_hi)
        draw.line([(cx + 8, 56), (cx - 6, 76), (w_left + 2, 90)], fill=c_dark, width=2)
        draw.line([(cx - 7, 56), (cx + 2, 72)], fill=c_dark, width=2)
        
        # Torso fold shading
        draw.polygon([(sh_left, 62), (w_left, 90), (cx - 8, 90), (cx - 5, 76)], fill=c_shadow)
        
        # Lower coat tails (Y in [90, 114])
        skirt_poly = [(w_left - 1, 90), (w_right + 1, 90), (w_right + 4, 112), (w_left - 4, 112)]
        draw.polygon(skirt_poly, fill=c_base, outline=c_dark)
        # Center slit
        draw.line([(cx, 96), (cx, 112)], fill=c_dark, width=1)
        draw.polygon([(w_left - 1, 90), (cx, 112), (w_left - 4, 112)], fill=c_shadow)
        
        # Sash / Belt (Y in [88, 95])
        draw.rectangle([w_left - 1, 88, w_right + 1, 95], fill=c_belt, outline=c_dark)
        if gender == "male":
            # Belt tied rope & pouch on left hip
            draw.line([(cx - 5, 89), (cx - 10, 95)], fill=c_gold, width=2)
            draw.ellipse([cx - 15, 93, cx - 9, 102], fill=c_pouch, outline=c_dark)
            draw.line([(cx - 12, 93), (cx - 12, 89)], fill=c_gold, width=1)
        else:
            # Ribbon bow at center
            draw.rectangle([cx - 4, 89, cx + 4, 94], fill=c_gold)
            draw.polygon([(cx - 4, 94), (cx - 7, 104), (cx - 2, 103)], fill=c_gold, outline=c_dark)
            draw.polygon([(cx + 4, 94), (cx + 7, 104), (cx + 2, 103)], fill=c_gold, outline=c_dark)
            
        # Bracers on forearms: find arm pixels in Y in [82, 110]
        for y in range(84, 110):
            row_xs = np.where((alpha[y, :] > 20) & ((np.arange(128) < cx - 18) | (np.arange(128) > cx + 18)))[0]
            if len(row_xs) > 0:
                for x in row_xs:
                    is_edge = (x == row_xs.min() or x == row_xs.max() or y % 4 == 0)
                    draw.point((x, y), fill=c_bwrap if is_edge else c_bracer)

    elif r in (1, 2):  # Side profile
        # Extend up to neck nape (Y=54) and cover full upper arm/torso
        poly = [
            (cx - 12, 54), (cx + 8, 56), (cx + 14, 72), (cx + 11, 90),
            (cx - 11, 90), (cx - 14, 72)
        ]
        draw.polygon(poly, fill=c_base, outline=c_dark)
        draw.polygon([(cx - 12, 60), (cx - 10, 90), (cx - 2, 90), (cx - 4, 60)], fill=c_shadow)
        
        # Lower coat tails
        skirt_poly = [(cx - 10, 90), (cx + 10, 90), (cx + 12, 112), (cx - 12, 112)]
        draw.polygon(skirt_poly, fill=c_base, outline=c_dark)
        draw.polygon([(cx - 10, 90), (cx - 12, 112), (cx - 2, 112)], fill=c_shadow)
        
        # Belt
        draw.rectangle([cx - 11, 88, cx + 11, 95], fill=c_belt, outline=c_dark)
        
        # Upper sleeve and bracer coverage on side profile
        for y in range(65, 84):
            arm_xs = np.where((alpha[y, :] > 20) & (np.arange(128) > cx + 4))[0]
            for x in arm_xs:
                draw.point((x, y), fill=c_base if x < arm_xs.max() else c_dark)
        for y in range(80, 112):
            row_xs = np.where((alpha[y, :] > 20) & (np.abs(np.arange(128) - cx) >= 5))[0]
            if len(row_xs) > 0:
                for x in row_xs:
                    is_edge = (x == row_xs.min() or x == row_xs.max() or y % 4 == 0)
                    draw.point((x, y), fill=c_bwrap if is_edge else c_bracer)

    elif r == 3:  # Back
        sh_left = cx - 22
        sh_right = cx + 22
        w_left = cx - 17
        w_right = cx + 17
        
        torso_poly = [
            (sh_left, 62), (cx - 7, 56), (cx + 7, 56), (sh_right, 62),
            (sh_right + 3, 75), (w_right, 90), (w_left, 90), (sh_left - 3, 75)
        ]
        draw.polygon(torso_poly, fill=c_base, outline=c_dark)
        # Center seam line
        draw.line([(cx, 56), (cx, 90)], fill=c_dark, width=1)
        draw.polygon([(sh_left, 62), (w_left, 90), (cx - 8, 90), (cx - 5, 76)], fill=c_shadow)
        
        # Lower skirt
        skirt_poly = [(w_left - 1, 90), (w_right + 1, 90), (w_right + 3, 112), (w_left - 3, 112)]
        draw.polygon(skirt_poly, fill=c_base, outline=c_dark)
        draw.line([(cx, 90), (cx, 112)], fill=c_dark, width=1)
        draw.polygon([(w_left - 1, 90), (cx, 112), (w_left - 3, 112)], fill=c_shadow)
        
        # Belt
        draw.rectangle([w_left - 1, 88, w_right + 1, 95], fill=c_belt, outline=c_dark)
        # Tied sash at rear
        draw.rectangle([cx - 4, 90, cx + 4, 96], fill=c_gold)
        draw.line([(cx - 2, 96), (cx - 4, 105)], fill=c_gold, width=2)
        draw.line([(cx + 2, 96), (cx + 4, 105)], fill=c_gold, width=2)
        
        # Forearms
        for y in range(84, 110):
            row_xs = np.where((alpha[y, :] > 20) & ((np.arange(128) < cx - 18) | (np.arange(128) > cx + 18)))[0]
            if len(row_xs) > 0:
                for x in row_xs:
                    is_edge = (x == row_xs.min() or x == row_xs.max() or y % 4 == 0)
                    draw.point((x, y), fill=c_bwrap if is_edge else c_bracer)

def draw_pants(draw, r, c, feat, gender="male"):
    cx = int(round(feat["cx"]))
    alpha = feat["alpha"]
    fb = feat["feet_bottom"]
    
    if gender == "male":
        c_hi = (109, 92, 82, 255)
        c_base = (82, 67, 58, 255)
        c_shadow = (56, 43, 36, 255)
        c_dark = (36, 26, 20, 255)
        c_wrap = (46, 37, 32, 255)
        c_cord = (130, 112, 93, 255)
        c_shoe = (37, 34, 32, 255)
        c_sole = (234, 234, 234, 255)
    else:
        c_hi = (243, 239, 234, 255)
        c_base = (221, 213, 203, 255)
        c_shadow = (181, 169, 155, 255)
        c_dark = (136, 124, 111, 255)
        c_wrap = (240, 237, 232, 255)
        c_cord = (164, 153, 140, 255)
        c_shoe = (37, 34, 32, 255)
        c_sole = (234, 234, 234, 255)

    # 1. Trousers (Y in [94, 136])
    # Follow the body leg mask in this region and expand 1-2px for baggy folds
    for y in range(94, 136):
        leg_xs = np.where((alpha[y, :] > 20) & (np.abs(np.arange(128) - cx) <= 24))[0]
        if len(leg_xs) > 0:
            x_min = max(0, leg_xs.min() - 1)
            x_max = min(127, leg_xs.max() + 1)
            for x in range(x_min, x_max + 1):
                is_edge = (x == x_min or x == x_max)
                is_shadow = (x < cx - 4 and r == 0) or (x > cx + 6 and r == 3)
                fill_color = c_dark if is_edge else (c_shadow if is_shadow else c_base)
                draw.point((x, y), fill=fill_color)

    # 2. Xà cạp leg wraps (Y in [136, 148])
    for y in range(136, 148):
        shin_xs = np.where((alpha[y, :] > 20) & (np.abs(np.arange(128) - cx) <= 22))[0]
        if len(shin_xs) > 0:
            for x in shin_xs:
                is_edge = (x == shin_xs.min() or x == shin_xs.max())
                is_cord = ((x + y) % 4 == 0 or (x - y) % 4 == 0)
                if is_edge:
                    draw.point((x, y), fill=c_dark)
                elif is_cord:
                    draw.point((x, y), fill=c_cord)
                else:
                    draw.point((x, y), fill=c_wrap)

    # 3. Shoes (Y in [148, fb + 1])
    for y in range(148, min(160, fb + 2)):
        foot_xs = np.where((alpha[y, :] > 20) & (np.abs(np.arange(128) - cx) <= 24))[0]
        if len(foot_xs) > 0:
            for x in foot_xs:
                is_sole = (y >= fb - 1)
                is_edge = (x == foot_xs.min() or x == foot_xs.max() or y == 148)
                if is_sole:
                    draw.point((x, y), fill=c_sole)
                elif is_edge:
                    draw.point((x, y), fill=c_dark)
                else:
                    draw.point((x, y), fill=c_shoe)

def build_sheet(generator_fn, body_arr, **kwargs):
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    frames = [[None for _ in range(COLS)] for _ in range(ROWS)]
    
    # Generate R0 (Front), R2 (Right), R3 (Back)
    for r in [0, 2, 3]:
        for c in range(COLS):
            f_body = get_frame(body_arr, r, c)
            feat = get_body_features(f_body)
            f_out = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            if feat:
                draw = ImageDraw.Draw(f_out)
                generator_fn(draw, r, c, feat, **kwargs)
            frames[r][c] = f_out
            
    # Rebuild R1 (Left) as horizontal mirror of R2 (Right)
    for c in range(COLS):
        r2_img = frames[2][c]
        r1_img = r2_img.transpose(Image.FLIP_LEFT_RIGHT)
        frames[1][c] = r1_img

    # Paste into final sheet
    for r in range(ROWS):
        for c in range(COLS):
            sheet.paste(frames[r][c], (c * FRAME_W, r * FRAME_H))
            
    return sheet

def build_hat_from_source(source_path, body_arr):
    """Process Gemini generated hat sheet into runtime 512x640 spritesheet."""
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

    # For back view (bl_c), remove the strap hanging under the brim
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

def extract_hat_icon(source_path):
    """Extract a 48x48 inventory item icon from the front hat angle."""
    im = Image.open(source_path).convert("RGBA")
    arr = np.array(im)
    is_bg = (arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240)
    arr[is_bg, 3] = 0
    keyed = Image.fromarray(arr)
    w, h = keyed.size
    tl_c = keyed.crop(keyed.crop((0, 0, w // 2, h // 2)).getbbox())
    
    icon = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    scale = min(44 / tl_c.width, 44 / tl_c.height)
    new_w = int(round(tl_c.width * scale))
    new_h = int(round(tl_c.height * scale))
    scaled = tl_c.resize((new_w, new_h), Image.Resampling.LANCZOS)
    icon.paste(scaled, ((48 - new_w) // 2, (48 - new_h) // 2), scaled)
    return icon

def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    body_male = load_body("male")
    body_female = load_body("female")
    
    source_hat = ROOT / "docs" / "example" / "non-truc.png"
    if source_hat.exists():
        print(f"Building official hero-hat-non-truc.png from {source_hat.name}...")
        hat_plain = build_hat_from_source(source_hat, body_male)
        hat_plain.save(PUBLIC / "hero-hat-non-truc.png")
        icon_hat = extract_hat_icon(source_hat)
        icon_hat.save(PUBLIC / "icon-hat-non-truc.png")
    else:
        print("Generating procedural hero-hat-non-truc.png...")
        hat_plain = build_sheet(draw_hat, body_male, veiled=False)
        hat_plain.save(PUBLIC / "hero-hat-non-truc.png")
    
    print("Generating hero-hat-non-mang.png...")
    hat_veil = build_sheet(draw_hat, body_female, veiled=True)
    hat_veil.save(PUBLIC / "hero-hat-non-mang.png")
    
    print("Generating hero-armor-lang-khach-male.png...")
    armor_m = build_sheet(draw_robe, body_male, gender="male")
    armor_m.save(PUBLIC / "hero-armor-lang-khach-male.png")
    
    print("Generating hero-armor-lang-khach-female.png...")
    armor_f = build_sheet(draw_robe, body_female, gender="female")
    armor_f.save(PUBLIC / "hero-armor-lang-khach-female.png")
    
    print("Generating hero-pants-lang-khach-male.png...")
    pants_m = build_sheet(draw_pants, body_male, gender="male")
    pants_m.save(PUBLIC / "hero-pants-lang-khach-male.png")
    
    print("Generating hero-pants-lang-khach-female.png...")
    pants_f = build_sheet(draw_pants, body_female, gender="female")
    pants_f.save(PUBLIC / "hero-pants-lang-khach-female.png")
    
    print("All 6 costume spritesheets generated successfully.")

if __name__ == "__main__":
    main()
