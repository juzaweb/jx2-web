"""Turn the 4x4 body sheets in docs/example into runtime spritesheets.

The source art is laid out as four rows (front, left, right, back) with four
walk frames per row, drawn on transparent cells of 448x600. The character's
feet sit on a different line in every row, so this script re-anchors each frame
to one ground line and normalises the row scale before writing the public
spritesheets consumed by heroBody.js.

Run: python3 scripts/build_hero_body.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / "docs" / "example"
PUBLIC = ROOT / "public"

SOURCES = {
    "hero-body-male.png": EXAMPLE / "body-men.png",
    "hero-body-female.png": EXAMPLE / "body-women.png",
}

COLS = 4
ROWS = 4
FRAME_W = 280
FRAME_H = 520
CONTENT_H = 500
CONTENT_BOTTOM = FRAME_H - 10
CONTENT_CENTER_X = FRAME_W // 2


def frame_bbox(cell):
    box = cell.getchannel("A").getbbox()
    if box is None:
        raise ValueError("empty body frame")
    return box


def build_sheet(source):
    sheet = Image.open(source).convert("RGBA")
    cell_w = sheet.width // COLS
    cell_h = sheet.height // ROWS
    out = Image.new("RGBA", (FRAME_W * COLS, FRAME_H * ROWS), (0, 0, 0, 0))

    for row in range(ROWS):
        cells = [
            sheet.crop(
                (
                    col * cell_w,
                    row * cell_h,
                    (col + 1) * cell_w,
                    (row + 1) * cell_h,
                )
            )
            for col in range(COLS)
        ]
        boxes = [frame_bbox(cell) for cell in cells]
        tallest = max(box[3] - box[1] for box in boxes)
        scale = CONTENT_H / tallest

        for col, (cell, box) in enumerate(zip(cells, boxes)):
            scaled = cell.resize(
                (round(cell.width * scale), round(cell.height * scale)),
                Image.LANCZOS,
            )
            left, _top, _right, bottom = (round(v * scale) for v in box)
            paste_x = CONTENT_CENTER_X - round(scaled.width / 2)
            paste_y = CONTENT_BOTTOM - bottom

            src_left = max(0, -paste_x)
            src_top = max(0, -paste_y)
            src_right = min(scaled.width, FRAME_W - paste_x)
            src_bottom = min(scaled.height, FRAME_H - paste_y)
            if src_right <= src_left or src_bottom <= src_top:
                continue

            piece = scaled.crop((src_left, src_top, src_right, src_bottom))
            out.alpha_composite(
                piece,
                (col * FRAME_W + paste_x + src_left, row * FRAME_H + paste_y + src_top),
            )

    return out


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for filename, source in SOURCES.items():
        if not source.exists():
            raise SystemExit(f"missing source sheet: {source}")
        sheet = build_sheet(source)
        target = PUBLIC / filename
        sheet.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE).save(
            target, optimize=True
        )
        print(f"wrote {target.relative_to(ROOT)} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
