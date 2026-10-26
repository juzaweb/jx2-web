"""Build the Thiếu Lâm Tâm Pháp skill icon.

The source (`docs/example/thieu-lam.png`) is a single full-bleed illustration of
a meditating monk inside a golden sunburst — no transparency to key out, so the
icon is a centred square crop resized to 128x128 RGBA. The holographic tile in
`skills-modal.css` frames it; `object-fit: cover` keeps it square in the hotbar.

Run: python3 scripts/build_skill_thieu_lam_tam_phap.py
Requires Pillow (python3 -m pip install pillow).
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "example" / "thieu-lam.png"
OUTPUT = ROOT / "public" / "skills" / "thieu_lam_tam_phap.png"
SIZE = 128


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source art not found: {SOURCE}")

    with Image.open(SOURCE) as art:
        square = art.convert("RGBA")
        side = min(square.size)
        left = (square.width - side) // 2
        top = (square.height - side) // 2
        square = square.crop((left, top, left + side, top + side))
        icon = square.resize((SIZE, SIZE), Image.LANCZOS)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUTPUT, "PNG", optimize=True)
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
