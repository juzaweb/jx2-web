"""Build the Đại Tu Di Chưởng skill icon.

The source (`docs/example/dai-tu-icon.png`) is an authored square illustration of
the Great Sumeru Palm. The icon is a centred square crop resized to 128x128 RGBA.

Run: python3 scripts/build_skill_dai_tu_di_chuong.py
Requires Pillow (python3 -m pip install pillow).
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "example" / "dai-tu-icon.png"
OUTPUT = ROOT / "public" / "skills" / "dai_tu_di_chuong.png"
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
        icon = square.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUTPUT, "PNG", optimize=True)
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()

