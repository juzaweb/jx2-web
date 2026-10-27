"""Draw the self-authored Kiếm Khí (sword qi) skill icon.

A cyan blade with two qi arcs on a dark navy roundel, 128x128 RGBA. The
holographic tile in `skills-modal.css` frames it; `object-fit: cover` keeps it
square in the hotbar. This is original vector-style art (no external source).

Run: python3 scripts/build_skill_kiem_khi.py
Requires Pillow (python3 -m pip install pillow).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "public" / "skills" / "kiem_khi.png"
SIZE = 128
SCALE = 4  # Draw large, then downscale for smooth edges.


def radial_disc(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, inner: str, outer: str) -> None:
    steps = int(r)
    for i in range(steps, 0, -1):
        t = i / steps
        color = tuple(
            int(int(inner[k : k + 2], 16) * (1 - t) + int(outer[k : k + 2], 16) * t)
            for k in (1, 3, 5)
        )
        draw.ellipse((cx - i, cy - i, cx + i, cy + i), fill=color)


def main() -> None:
    s = SIZE * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark roundel with a soft cyan inner glow.
    radial_disc(draw, s / 2, s / 2, s * 0.47, "#1b4a63", "#071018")
    draw.ellipse(
        (s * 0.04, s * 0.04, s * 0.96, s * 0.96),
        outline=(96, 200, 231, 255),
        width=int(s * 0.014),
    )

    # Qi swirls: two crescents around the blade.
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for offset, width in ((0.30, 0.030), (0.38, 0.018)):
        box = (s * (0.5 - offset), s * (0.5 - offset), s * (0.5 + offset), s * (0.5 + offset))
        gdraw.arc(box, start=205, end=335, fill=(150, 235, 255, 230), width=int(s * width))
        gdraw.arc(box, start=25, end=155, fill=(90, 190, 230, 190), width=int(s * width))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.012))
    img.alpha_composite(glow)
    draw = ImageDraw.Draw(img)

    # Blade: bright core with a darker steel edge.
    cx = s / 2
    blade = [
        (cx, s * 0.13),
        (cx + s * 0.085, s * 0.30),
        (cx + s * 0.055, s * 0.66),
        (cx - s * 0.055, s * 0.66),
        (cx - s * 0.085, s * 0.30),
    ]
    draw.polygon(blade, fill=(206, 244, 255, 255), outline=(110, 190, 220, 255))
    draw.line([(cx, s * 0.20), (cx, s * 0.58)], fill=(255, 255, 255, 255), width=int(s * 0.018))

    # Cross-guard, grip and pommel.
    draw.rounded_rectangle(
        (cx - s * 0.155, s * 0.655, cx + s * 0.155, s * 0.705),
        radius=s * 0.018,
        fill=(212, 175, 55, 255),
        outline=(255, 224, 130, 255),
        width=int(s * 0.008),
    )
    draw.rounded_rectangle(
        (cx - s * 0.035, s * 0.70, cx + s * 0.035, s * 0.86),
        radius=s * 0.02,
        fill=(110, 70, 35, 255),
    )
    draw.ellipse(
        (cx - s * 0.045, s * 0.845, cx + s * 0.045, s * 0.925),
        fill=(226, 190, 90, 255),
    )

    icon = img.resize((SIZE, SIZE), Image.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUTPUT, "PNG", optimize=True)
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
