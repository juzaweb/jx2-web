"""Build the Kim Cang Bất Hoại skill icon.

The source (`docs/example/kim-canh-bat-hoai-icon.png`) is an authored square
illustration of the Indestructible Vajra Body. The icon is a centred square crop
resized to 128x128 RGBA.

Run: python3 scripts/build_skill_kim_cang_bat_hoai.py
Requires Pillow (python3 -m pip install pillow).
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "example" / "kim-canh-bat-hoai-icon.png"
OUTPUT = ROOT / "public" / "skills" / "kim_cang_bat_hoai.png"
SIZE = 128


def main() -> None:
    src = SOURCE
    if not src.exists():
        alt = ROOT / "docs" / "example" / "kim-cang-bat-hoai-icon.png"
        if alt.exists():
            src = alt
        else:
            raise SystemExit(f"Source art not found: {SOURCE}")

    with Image.open(src) as art:
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
