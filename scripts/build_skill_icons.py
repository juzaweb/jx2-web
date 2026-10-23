"""Build the Thiếu Lâm palm-kit skill icons as vector emblems.

The two skills that still had no art (`la_han_quyen`, `thieu_lam_truong_phap`)
are drawn here as SVG emblems on a transparent background, so the gold tile in
`skills-modal.css` still provides the frame. Icons are rendered to 128x128 PNG
(crisp on retina, downscaled to 64 by CSS) with `rsvg-convert`.

Run: python3 scripts/build_skill_icons.py
"""

from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "skills"
SIZE = 128

if shutil.which("rsvg-convert") is None:  # checked at import so a bare run fails fast
    raise SystemExit(
        "rsvg-convert not found. Install librsvg first (macOS: `brew install librsvg`)."
    )

DEFS = """
    <linearGradient id="gold" gradientUnits="userSpaceOnUse"
        x1="18" y1="16" x2="96" y2="122">
      <stop offset="0" stop-color="#FFE9A4"/>
      <stop offset="0.28" stop-color="#F0BC55"/>
      <stop offset="0.62" stop-color="#CC8620"/>
      <stop offset="1" stop-color="#7E4708"/>
    </linearGradient>
    <linearGradient id="arc" gradientUnits="userSpaceOnUse"
        x1="20" y1="10" x2="110" y2="50">
      <stop offset="0" stop-color="#FFFDF0"/>
      <stop offset="0.55" stop-color="#FFD873"/>
      <stop offset="1" stop-color="#FFB229"/>
    </linearGradient>
    <linearGradient id="thumb" gradientUnits="userSpaceOnUse"
        x1="38" y1="60" x2="74" y2="88">
      <stop offset="0" stop-color="#E7A83F"/>
      <stop offset="0.6" stop-color="#B97514"/>
      <stop offset="1" stop-color="#6B3B06"/>
    </linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
"""

# La Hán Quyền — clenched fist (拳), knuckles toward the viewer.
FIST_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 128">
  <defs>{DEFS}</defs>

  <g id="hand">
    <rect x="36" y="50" width="56" height="46" rx="14"/>
    <rect x="39" y="30" width="12.5" height="26" rx="6.2"/>
    <rect x="52.5" y="26" width="12.5" height="30" rx="6.2"/>
    <rect x="66" y="28" width="12.5" height="28" rx="6.2"/>
    <rect x="79" y="33" width="11" height="23" rx="5.5"/>
    <path id="thumbShape" d="M38 74 q0-9 9-11 l14-3 q9-2 12 7 q3 9-6 12 l-20 5 q-9 2-9-10 z"/>
    <rect x="46" y="92" width="36" height="17" rx="6"/>
  </g>

  <!-- outer glow, then a dark rim, then the gold body -->
  <use xlink:href="#hand" filter="url(#glow)" fill="#FFB024" opacity="0.5"/>
  <g fill="#43230A" stroke="#43230A" stroke-width="5" stroke-linejoin="round">
    <use xlink:href="#hand"/>
  </g>
  <g fill="url(#gold)">
    <use xlink:href="#hand"/>
  </g>

  <!-- knuckle creases -->
  <g stroke="#7C4609" stroke-width="2" stroke-linecap="round" opacity="0.55">
    <path d="M52.5 44 v14"/>
    <path d="M65.8 42 v16"/>
    <path d="M79 45 v13"/>
  </g>
  <!-- thumb shading so the folded fingers read as a separate form -->
  <use xlink:href="#thumbShape" fill="url(#thumb)" opacity="0.55"/>
  <use xlink:href="#thumbShape" fill="none" stroke="#6B3B06" stroke-width="2" opacity="0.45"/>
  <path d="M43 68 q7-3 12 1" stroke="#FFF0BE" stroke-width="2.4" fill="none"
        stroke-linecap="round" opacity="0.7"/>
  <!-- thumb crease + cuff band -->
  <path d="M46 66 q12-2 22 5" stroke="#8B5310" stroke-width="2" fill="none"
        stroke-linecap="round" opacity="0.45"/>
  <path d="M50 99 h28" stroke="#5E3307" stroke-width="2" opacity="0.6"/>

  <!-- rim light on the top edges -->
  <g stroke="#FFF3C2" stroke-width="2.4" stroke-linecap="round" opacity="0.55" fill="none">
    <path d="M40 38 q5-6 11-2"/>
    <path d="M54 34 q5-6 11-2"/>
    <path d="M67 36 q5-6 11-2"/>
    <path d="M80 40 q4-5 9-1"/>
    <path d="M39 62 q4-6 11-4"/>
  </g>

  <!-- impact sparks -->
  <g stroke="url(#arc)" stroke-width="4" stroke-linecap="round" opacity="0.9">
    <path d="M20 40 l7 5"/>
    <path d="M17 56 h9"/>
    <path d="M108 42 l-7 5"/>
    <path d="M112 58 h-8"/>
  </g>
</svg>
"""

# Thiếu Lâm Chưởng Pháp — open palm (掌) gathering energy.
PALM_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 128">
  <defs>{DEFS}</defs>

  <g id="hand">
    <rect x="44" y="58" width="44" height="46" rx="12"/>
    <rect x="45" y="36" width="11" height="30" rx="5.5"/>
    <rect x="57" y="27" width="11" height="39" rx="5.5"/>
    <rect x="69" y="31" width="11" height="35" rx="5.5"/>
    <rect x="81" y="39" width="9.5" height="27" rx="4.8"/>
    <path d="M46 76 q-11 0-18 7 q-6 6 0 11 q7 6 15 1 q7-5 9-12 z"/>
    <rect x="52" y="100" width="28" height="15" rx="5"/>
  </g>

  <use xlink:href="#hand" filter="url(#glow)" fill="#FFC24A" opacity="0.5"/>
  <g fill="#43230A" stroke="#43230A" stroke-width="5" stroke-linejoin="round">
    <use xlink:href="#hand"/>
  </g>
  <g fill="url(#gold)">
    <use xlink:href="#hand"/>
  </g>

  <!-- palm lines -->
  <g stroke="#8B5310" fill="none" stroke-linecap="round" opacity="0.45">
    <path d="M54 78 q11 7 22 1" stroke-width="2.2"/>
    <path d="M57 88 q9 5 17 1" stroke-width="2"/>
  </g>
  <path d="M55 104 h22" stroke="#5E3307" stroke-width="2" opacity="0.55"/>

  <!-- rim light down the fingers -->
  <g stroke="#FFF3C2" stroke-width="2.4" stroke-linecap="round" opacity="0.55" fill="none">
    <path d="M47 46 q4-6 8-3"/>
    <path d="M59 38 q4-7 8-3"/>
    <path d="M71 41 q4-6 8-3"/>
    <path d="M82 48 q3-5 7-2"/>
    <path d="M46 66 q4-5 9-4"/>
  </g>

  <!-- gathering energy: arc + motes -->
  <path d="M28 36 q36-26 72-4" fill="none" stroke="url(#arc)" stroke-width="4.5"
        stroke-linecap="round" opacity="0.95"/>
  <path d="M24 30 q40-26 80-4" fill="none" stroke="#FFE7A6" stroke-width="2.5"
        stroke-linecap="round" opacity="0.5"/>
  <g fill="#FFF4CC">
    <circle cx="64" cy="12" r="3.4"/>
    <circle cx="20" cy="56" r="2.8"/>
    <circle cx="110" cy="50" r="2.8"/>
    <circle cx="96" cy="18" r="2"/>
  </g>
</svg>
"""

ICONS = {
    "la_han_quyen": FIST_SVG,
    "thieu_lam_truong_phap": PALM_SVG,
}


def render(svg: str, out_path: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        svg_path = Path(tmp) / "icon.svg"
        svg_path.write_text(svg, encoding="utf-8")
        subprocess.run(
            [
                "rsvg-convert",
                "--width",
                str(SIZE),
                "--height",
                str(SIZE),
                "--keep-aspect-ratio",
                str(svg_path),
                "--output",
                str(out_path),
            ],
            check=True,
        )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for skill_id, svg in ICONS.items():
        out_path = OUT_DIR / f"{skill_id}.png"
        render(svg, out_path)
        print(f"wrote {out_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
