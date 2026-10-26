"""Generate the "dao" (saber) attack cursor used by the game canvas.

The scene swaps the mouse cursor to this image while the pointer hovers a living
monster or a PK-flagged peer, so the player can tell that a left click would
attack instead of walk (see src/game/hoverCursor.js).

The art is drawn at 8x and downsampled with LANCZOS so a 32 px PNG keeps clean
edges. The hotspot is the blade tip (top-left), which reads as "this exact pixel
is the point I am aiming at".

Usage:
    python3 scripts/build_dao_cursor.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUTPUT = Path(__file__).resolve().parent.parent / "public" / "cursors" / "dao-attack.png"

SIZE = 32
SUPERSAMPLE = 8
SCALE = SIZE * SUPERSAMPLE

WHITE = (255, 255, 255, 255)
INK = (16, 18, 20, 255)
STEEL = (230, 238, 247, 255)
STEEL_SHADE = (176, 191, 209, 255)
GOLD = (226, 172, 68, 255)
GRIP = (92, 58, 34, 255)

# Unit directions of the blade: u runs tip -> pommel, p is the cross direction.
U = (1 / math.sqrt(2), 1 / math.sqrt(2))
P = (1 / math.sqrt(2), -1 / math.sqrt(2))

TIP = (3.0, 3.0)
GUARD = (20.6, 20.6)
POMMEL = (28.4, 28.4)
BLADE_HALF_WIDTH = 2.25
GUARD_HALF_LENGTH = 5.1
GUARD_HALF_THICKNESS = 1.05
GRIP_HALF_WIDTH = 1.3


def point(origin: tuple[float, float], along: float, across: float) -> tuple[float, float]:
    """Translate a point `along` the blade and `across` its cross direction."""
    return (
        origin[0] + U[0] * along + P[0] * across,
        origin[1] + U[1] * along + P[1] * across,
    )


def scale_points(points) -> list[tuple[float, float]]:
    return [(x * SUPERSAMPLE, y * SUPERSAMPLE) for x, y in points]


def paint(draw: ImageDraw.ImageDraw, points, fill) -> None:
    """Fill a shape with a dark ink edge and a white halo for dark maps."""
    shape = scale_points(points)
    draw.polygon(shape, outline=WHITE, width=int(1.9 * SUPERSAMPLE))
    draw.polygon(shape, outline=INK, width=int(1.0 * SUPERSAMPLE))
    draw.polygon(shape, fill=fill)


def main() -> None:
    image = Image.new("RGBA", (SCALE, SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Blade: a tapered triangle from the hotspot tip down to the guard.
    blade = [
        TIP,
        point(GUARD, 0, BLADE_HALF_WIDTH),
        point(GUARD, 0, -BLADE_HALF_WIDTH),
    ]
    paint(draw, blade, STEEL)

    # A narrow shadow strip along one edge gives the flat polygon some volume.
    # It stops short of the tip so the hotspot pixel stays a crisp point.
    shade = [
        point(GUARD, -1.0, BLADE_HALF_WIDTH * 0.3),
        point(GUARD, -1.0, BLADE_HALF_WIDTH * 0.92),
        point(GUARD, -7.0, BLADE_HALF_WIDTH * 0.35),
    ]
    draw.polygon(scale_points(shade), fill=STEEL_SHADE)

    # Cross guard, perpendicular to the blade.
    guard = [
        point(GUARD, -GUARD_HALF_THICKNESS, -GUARD_HALF_LENGTH),
        point(GUARD, -GUARD_HALF_THICKNESS, GUARD_HALF_LENGTH),
        point(GUARD, GUARD_HALF_THICKNESS, GUARD_HALF_LENGTH),
        point(GUARD, GUARD_HALF_THICKNESS, -GUARD_HALF_LENGTH),
    ]
    paint(draw, guard, GOLD)

    # Grip from the guard to the pommel, plus a round pommel cap.
    grip = [
        point(GUARD, 0.4, GRIP_HALF_WIDTH),
        point(POMMEL, -1.2, GRIP_HALF_WIDTH),
        point(POMMEL, -1.2, -GRIP_HALF_WIDTH),
        point(GUARD, 0.4, -GRIP_HALF_WIDTH),
    ]
    paint(draw, grip, GRIP)

    cap = 1.75
    pommel = [
        (POMMEL[0] - cap, POMMEL[1]),
        (POMMEL[0], POMMEL[1] - cap),
        (POMMEL[0] + cap, POMMEL[1]),
        (POMMEL[0], POMMEL[1] + cap),
    ]
    paint(draw, pommel, GOLD)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.resize((SIZE, SIZE), Image.LANCZOS).save(OUTPUT)
    print(f"wrote {OUTPUT.relative_to(OUTPUT.parents[2])} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
