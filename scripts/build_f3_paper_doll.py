"""
Builds modular F3 Character Paper-Doll assets:
- Base bodies: hero-preview-male.png, hero-preview-female.png
- Equipment overlays (480 x 800):
  - hero-preview-hat-non-truc.png (male hat)
  - hero-preview-hat-non-mang.png (female hat)
  - hero-preview-armor-lang-khach-male.png (male robe)
  - hero-preview-armor-lang-khach-female.png (female robe)
  - hero-preview-pants-lang-khach-male.png (male pants)
  - hero-preview-pants-lang-khach-female.png (female pants)
"""

from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
EXAMPLE = ROOT / "docs" / "example"

TARGET_W, TARGET_H = 480, 800
CANVAS_W, CANVAS_H = 750, 1250

def run():
    im = Image.open(EXAMPLE / "nhanvat.png").convert("RGBA")
    arr = np.array(im)
    is_bg = (arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240)
    arr[is_bg, 3] = 0
    keyed = Image.fromarray(arr)

    # 1. Male Pieces
    pants_m = keyed.crop((1520, 775, 1940, 1520)).crop()
    robe_m = keyed.crop((30, 620, 720, 1320)).crop()
    hat_m_raw = keyed.crop((50, 100, 650, 420)).crop()
    # Scale male hat slightly for natural skull coverage
    hw_m = 660
    hh_m = int(round(hat_m_raw.height * (hw_m / hat_m_raw.width)))
    hat_m = hat_m_raw.resize((hw_m, hh_m), Image.Resampling.LANCZOS)

    # 2. Female Pieces
    hat_f_raw = keyed.crop((650, 90, 1360, 530)).crop()
    hw_f = 720
    hh_f = int(round(hat_f_raw.height * (hw_f / hat_f_raw.width)))
    hat_f = hat_f_raw.resize((hw_f, hh_f), Image.Resampling.LANCZOS)
    pants_f = keyed.crop((2385, 770, 2700, 1520)).crop()
    robe_f = keyed.crop((700, 620, 1350, 1350)).crop()

    # Helpers
    def make_canvas_layer(piece, pos):
        c = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        c.paste(piece, pos, piece)
        return c.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)

    # Generate Overlays
    layer_pants_m = make_canvas_layer(pants_m, (155, 505))
    layer_robe_m = make_canvas_layer(robe_m, (30, 165))
    layer_hat_m = make_canvas_layer(hat_m, ((CANVAS_W - hw_m) // 2, -30))

    layer_pants_f = make_canvas_layer(pants_f, (215, 505))
    layer_robe_f = make_canvas_layer(robe_f, (50, 165))
    layer_hat_f = make_canvas_layer(hat_f, ((CANVAS_W - hw_f) // 2, -30))

    # Save Overlays
    layer_pants_m.save(PUBLIC / "hero-preview-pants-lang-khach-male.png")
    layer_robe_m.save(PUBLIC / "hero-preview-armor-lang-khach-male.png")
    layer_hat_m.save(PUBLIC / "hero-preview-hat-non-truc.png")

    layer_pants_f.save(PUBLIC / "hero-preview-pants-lang-khach-female.png")
    layer_robe_f.save(PUBLIC / "hero-preview-armor-lang-khach-female.png")
    layer_hat_f.save(PUBLIC / "hero-preview-hat-non-mang.png")

    # Generate Male Base Body (Innerwear + Head)
    hero_m = Image.open(PUBLIC / "hero-preview-male.png").convert("RGBA")
    head_m_raw = hero_m.crop((95, 10, 265, 250))
    h_mw, h_mh = int(head_m_raw.width * 1.15), int(head_m_raw.height * 1.15)
    head_m_scaled = head_m_raw.resize((h_mw, h_mh), Image.Resampling.LANCZOS)

    # Hands
    hand_l = hero_m.crop((12, 520, 65, 615)).resize((45, 75), Image.Resampling.LANCZOS)
    hand_r = hero_m.crop((295, 520, 348, 615)).resize((45, 75), Image.Resampling.LANCZOS)

    base_m = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    base_m.paste(hand_l, (85, 640), hand_l)
    base_m.paste(hand_r, (625, 640), hand_r)
    base_m.paste(head_m_scaled, ((CANVAS_W - h_mw) // 2, 0), head_m_scaled)

    # Inner Pants & Robe
    p_arr_m = np.array(pants_m)
    alpha_pm = p_arr_m[:, :, 3] > 0
    gray_pm = np.dot(p_arr_m[:, :, :3], [0.2989, 0.5870, 0.1140])
    p_arr_m[alpha_pm, 0] = np.clip(gray_pm[alpha_pm] * 0.9 + 50, 0, 235).astype(np.uint8)
    p_arr_m[alpha_pm, 1] = np.clip(gray_pm[alpha_pm] * 0.9 + 48, 0, 230).astype(np.uint8)
    p_arr_m[alpha_pm, 2] = np.clip(gray_pm[alpha_pm] * 0.85 + 40, 0, 220).astype(np.uint8)
    inner_pants_m = Image.fromarray(p_arr_m)

    r_arr_m = np.array(robe_m)
    alpha_rm = r_arr_m[:, :, 3] > 0
    gray_rm = np.dot(r_arr_m[:, :, :3], [0.2989, 0.5870, 0.1140])
    r_arr_m[alpha_rm, 0] = np.clip(gray_rm[alpha_rm] * 1.1 + 50, 0, 245).astype(np.uint8)
    r_arr_m[alpha_rm, 1] = np.clip(gray_rm[alpha_rm] * 1.05 + 45, 0, 240).astype(np.uint8)
    r_arr_m[alpha_rm, 2] = np.clip(gray_rm[alpha_rm] * 0.95 + 35, 0, 230).astype(np.uint8)

    # Clear collar interior back
    is_inner_collar_m = (r_arr_m[:120, 280:410, 0] < 160) & (r_arr_m[:120, 280:410, 3] > 0)
    r_arr_m[:120, 280:410][is_inner_collar_m, 3] = 0
    inner_robe_m = Image.fromarray(r_arr_m)

    base_m.paste(inner_pants_m, (155, 505), inner_pants_m)
    base_m.paste(inner_robe_m, (30, 165), inner_robe_m)

    base_m_final = base_m.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    base_m_final.save(PUBLIC / "hero-preview-male.png")

    # Generate Female Base Body
    hero_f = Image.open(PUBLIC / "hero-preview-female.png").convert("RGBA")
    head_f_raw = hero_f.crop((90, 10, 240, 250))
    h_fw, h_fh = int(head_f_raw.width * 1.15), int(head_f_raw.height * 1.15)
    head_f_scaled = head_f_raw.resize((h_fw, h_fh), Image.Resampling.LANCZOS)

    hand_fl = hero_f.crop((12, 520, 65, 615)).resize((40, 70), Image.Resampling.LANCZOS)
    hand_fr = hero_f.crop((265, 520, 318, 615)).resize((40, 70), Image.Resampling.LANCZOS)

    base_f = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    base_f.paste(hand_fl, (90, 640), hand_fl)
    base_f.paste(hand_fr, (620, 640), hand_fr)
    base_f.paste(head_f_scaled, ((CANVAS_W - h_fw) // 2, 0), head_f_scaled)

    # Female Inner Robe
    r_arr_f = np.array(robe_f)
    alpha_rf = r_arr_f[:, :, 3] > 0
    gray_rf = np.dot(r_arr_f[:, :, :3], [0.2989, 0.5870, 0.1140])
    r_arr_f[alpha_rf, 0] = np.clip(gray_rf[alpha_rf] * 1.1 + 55, 0, 245).astype(np.uint8)
    r_arr_f[alpha_rf, 1] = np.clip(gray_rf[alpha_rf] * 1.08 + 50, 0, 240).astype(np.uint8)
    r_arr_f[alpha_rf, 2] = np.clip(gray_rf[alpha_rf] * 1.0 + 45, 0, 235).astype(np.uint8)

    is_inner_collar_f = (r_arr_f[:120, 280:410, 0] < 160) & (r_arr_f[:120, 280:410, 3] > 0)
    r_arr_f[:120, 280:410][is_inner_collar_f, 3] = 0
    inner_robe_f = Image.fromarray(r_arr_f)

    base_f.paste(pants_f, (215, 505), pants_f)
    base_f.paste(inner_robe_f, (50, 165), inner_robe_f)

    base_f_final = base_f.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    base_f_final.save(PUBLIC / "hero-preview-female.png")

    print("All 8 F3 paper-doll assets created successfully in public/!")

if __name__ == "__main__":
    run()
