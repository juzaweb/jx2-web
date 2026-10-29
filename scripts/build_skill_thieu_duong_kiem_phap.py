"""Build the Thiếu Dương Kiếm Pháp VFX spritesheet and icon.

The source sheet ships four sword/slash illustrations in a single row on a
transparent background. The four panels (each 256x254) are placed into 256x256
frames and packed into a 1024x256 spritesheet.
The icon is cropped and resized from docs/example/thieu_duong_kiem_phap-icon.png.

Run: python3 scripts/build_skill_thieu_duong_kiem_phap.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "docs" / "example" / "thieu_duong_kiem_phap.png"
ICON_SOURCE_PATH = ROOT / "docs" / "example" / "thieu_duong_kiem_phap-icon.png"
VFX_DIR = ROOT / "public" / "skills" / "vfx" / "thieu_duong_kiem_phap"
ICON_PATH = ROOT / "public" / "skills" / "thieu_duong_kiem_phap.png"

FRAME_SIZE = 256
ICON_SIZE = 128
PANEL_COUNT = 4


def build_icon() -> None:
    """Build the 128x128 RGBA skill icon."""
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
    print(f"Generated {ICON_PATH.relative_to(ROOT)} ({ICON_SIZE}x{ICON_SIZE})")


def build_vfx() -> None:
    """Build the 1024x256 VFX spritesheet and individual frames."""
    if not SOURCE_PATH.exists():
        raise SystemExit(f"VFX source art not found: {SOURCE_PATH}")

    VFX_DIR.mkdir(parents=True, exist_ok=True)

    with Image.open(SOURCE_PATH) as source:
        source_rgba = source.convert("RGBA")
        src_width, src_height = source_rgba.size
        panel_width = src_width // PANEL_COUNT

        frames = []
        top_offset = (FRAME_SIZE - src_height) // 2

        for i in range(PANEL_COUNT):
            box = (i * panel_width, 0, (i + 1) * panel_width, src_height)
            panel = source_rgba.crop(box)

            frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            frame.paste(panel, (0, top_offset), panel)
            frames.append(frame)

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        frame.save(VFX_DIR / f"frame-{index + 1}.png", "PNG", optimize=True)
        sheet.paste(frame, (index * FRAME_SIZE, 0))

    sheet.save(VFX_DIR / "sheet.png", "PNG", optimize=True)

    (VFX_DIR / "sheet.json").write_text(
        "{\n"
        '  "frameWidth": 256,\n'
        '  "frameHeight": 256,\n'
        '  "frameCount": 4,\n'
        '  "fps": 12,\n'
        '  "source": "docs/example/thieu_duong_kiem_phap.png (four panels, transparency preserved)"\n'
        "}\n"
    )

    print(f"Generated {VFX_DIR.relative_to(ROOT) / 'sheet.png'} ({FRAME_SIZE * len(frames)}x{FRAME_SIZE})")


def main() -> None:
    build_icon()
    build_vfx()


if __name__ == "__main__":
    main()

