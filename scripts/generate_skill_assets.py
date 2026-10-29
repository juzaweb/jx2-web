"""Asset generation and build pipeline for JX2-Web Sect Skills.

Uses the local ComfyUI generation API (http://192.168.1.14:8090)
to generate 1024x1024 skill icons and 1024x256 VFX sprite sheets,
then processes and exports them to public/skills/ and public/skills/vfx/.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DOCS_EXAMPLE = ROOT / "docs" / "example"
PUBLIC_SKILLS = ROOT / "public" / "skills"
PUBLIC_VFX = PUBLIC_SKILLS / "vfx"

API_HOST = "http://192.168.1.14:8090"
API_KEY = os.environ.get("LOCAL_API_KEY", "0dymsz5jbein9huwfxtqg72kv3co461l")

FRAME_SIZE = 256
ICON_SIZE = 128
PANEL_COUNT = 4

# Definitions for all 8 Nga My and Ngu Doc skills
SKILL_SPECS = [
    # Nga My (kiem)
    {
        "id": "nga_my_kiem_phap",
        "icon_prompt": None,  # already exists in docs/example
        "vfx_prompt": None,   # already exists in docs/example
    },
    {
        "id": "mong_diep_thoi_tam",
        "icon_prompt": None,  # already exists in docs/example
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of a swarm of spectral dream butterflies erupting, "
            "top-down combat view. Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: a cluster of glowing violet spirit butterflies forming at the sword tip; "
            "Frame 2: butterflies surging forward in an undulating spiral vortex; "
            "Frame 3: butterfly swarm bursting into a shimmering cloud of purple stardust on impact; "
            "Frame 4: fading violet sparkles and faint glowing moth wings dissolving. "
            "Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw"
        ),
    },
    {
        "id": "tu_hang_pho_do",
        "icon_prompt": (
            "A 2D game skill icon of Merciful Compassion Healing (Từ Hàng Phổ Độ), Buddhist Emei style. "
            "A pure blooming white-pink sacred lotus floating on calm water, radiating restorative emerald "
            "beams and sparkling dewdrop particles. Dark velvet background, borderless, no frame. "
            "Soothing divine aura, game UI healing asset --ar 1:1 --v 6.0 --no border frame"
        ),
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of a sacred blooming lotus healing aura, top-down isometric view. "
            "Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: glowing jade lotus bud opening at the hero's feet; "
            "Frame 2: lotus in full bloom radiating upward emerald light beams; "
            "Frame 3: shower of divine sparkling water drops and glowing jade petals raining down; "
            "Frame 4: soft residual green healing mist fading peacefully. "
            "Solid pure white background, 256x256 cell size, clean transparent VFX ready --ar 4:1 --v 6.0 --style raw"
        ),
    },
    {
        "id": "luu_thuy_khanh_van",
        "icon_prompt": (
            "A 2D skill icon of Flowing Water & Auspicious Clouds (Lưu Thủy Khánh Vân), Wuxia speed buff. "
            "A graceful white crane feather gliding over spiraling crystal-blue water ripples and auspicious silver clouds. "
            "Dark teal background, borderless, no frame. Airy, swift and elegant design --ar 1:1 --v 6.0 --no border frame"
        ),
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of spiraling water ribbons and wind cloud wisps, top-down perspective. "
            "Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: swirling rings of crystal blue water and white wind gathering at the feet; "
            "Frame 2: wind and water spirals surging upward around the body; "
            "Frame 3: outward burst of gentle water droplets and floating auspicious cloud puffs; "
            "Frame 4: trailing faint wind ribbons dissipating into the sprint path. "
            "Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw"
        ),
    },
    # Ngu Doc (dao)
    {
        "id": "ngu_doc_tam_phap",
        "icon_prompt": (
            "A 2D game skill icon of the Five Poisons Saber Art (Ngũ Độc Đao Pháp), dark Wuxia style. "
            "A heavy curved blackened steel saber dripping with glowing toxic emerald venom, entwined by a venomous green pit viper. "
            "Dark moody parchment background, borderless, no frame. Sinister martial aura, sharp icon clarity --ar 1:1 --v 6.0 --no border frame"
        ),
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of a toxic green curved saber slash, isometric combat view. "
            "Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: saber blade igniting with bubbling green acid miasma; "
            "Frame 2: wide sweeping crescent slash leaving a vibrant emerald green venom trail; "
            "Frame 3: slash trail splashing into acid droplets and small poison bubbles; "
            "Frame 4: dispersing green vapor wisps fading away. "
            "Solid pure white background, 256x256 frame size, high contrast --ar 4:1 --v 6.0 --style raw"
        ),
    },
    {
        "id": "truy_tam_doc",
        "icon_prompt": (
            "A 2D game skill icon of Heart-Piercing Venom (Truy Tâm Độc), Five Poisons assassin art. "
            "A wicked jagged poisoned throwing needle flying forward aimed at a dark glowing cursed human heart silhouette, "
            "dripping purple scorpion poison. Deep obsidian background, borderless, no frame. "
            "Dark and lethal iconography --ar 1:1 --v 6.0 --no border frame"
        ),
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of a flying poison needle piercing and bursting, isometric view. "
            "Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: a sharp purple poison needle streaking forward with a toxic smoke tail; "
            "Frame 2: needle striking the target point with an acidic purple flash; "
            "Frame 3: explosive burst of toxic purple needles and acid blood droplets flying outward; "
            "Frame 4: fading dark purple poison smoke dissolving. "
            "Solid pure white background, 256x256 cell size --ar 4:1 --v 6.0 --style raw"
        ),
    },
    {
        "id": "van_doc_chieu_hong",
        "icon_prompt": (
            "A 2D game skill icon of Ten Thousand Poisons Gu Summoning (Vạn Độc Triệu Cổ), Wuxia necromancy style. "
            "An ancient weathered dark clay Gu pot overflowing with swarming glowing purple centipedes, "
            "horned beetles, and toxic green smoke fumes. Pitch black background, borderless, no frame. "
            "Eerie and terrifying asset --ar 1:1 --v 6.0 --no border frame"
        ),
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of a swarming poisonous insect explosion on the ground, top-down isometric view. "
            "Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: bubbling pool of green acid forming with glowing insect eyes; "
            "Frame 2: violent eruption of toxic purple miasma and swarming spectral centipedes bursting upward; "
            "Frame 3: expanding shockwave cloud of stinging venomous insects and green acid splashes; "
            "Frame 4: cloud dissipating into lingering toxic ground sludge and fading fumes. "
            "Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw"
        ),
    },
    {
        "id": "u_hong_phiet_anh",
        "icon_prompt": (
            "A 2D skill icon of the Nether Ghost Phantom Strike (U Hồn Phiệt Ảnh), dark assassin buff. "
            "A terrifying ghostly specter with glowing purple hollow eyes looming behind a pair of crossed curved daggers, "
            "surrounded by ethereal phantom smoke. Dark abyss background, borderless, no frame. "
            "Menacing dark fantasy design --ar 1:1 --v 6.0 --no border frame"
        ),
        "vfx_prompt": (
            "A 2D game VFX sprite sheet of a rising ghostly specter and soul fire burst, top-down isometric perspective. "
            "Single horizontal row of 4 animation frames from left to right: "
            "Frame 1: dark purple shadowy smoke rising from the hero's silhouette; "
            "Frame 2: a demonic specter phantom shrieking upward with glowing purple eyes; "
            "Frame 3: specter bursting into radial phantom soul flames and skull-shaped smoke wisps; "
            "Frame 4: soul flames settling into a sinister dark purple critical-strike aura around the body. "
            "Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw"
        ),
    },
]


def api_request(path: str, data: dict = None) -> dict:
    """Send authenticated JSON request to the API."""
    url = f"{API_HOST}{path}"
    headers = {"X-API-Key": API_KEY}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def wait_for_job(job_id: str, label: str) -> dict:
    """Poll job until completion."""
    start = time.time()
    while True:
        job = api_request(f"/v1/jobs/{job_id}")
        status = job.get("status")
        progress = job.get("progress", 0.0)
        elapsed = time.time() - start
        print(f"  [{label}] status: {status}, progress: {progress}%, elapsed: {elapsed:.1f}s", flush=True)

        if status == "succeeded":
            return job
        elif status in ("failed", "canceled"):
            raise RuntimeError(f"Job {job_id} {status}: {job.get('error')}")
        time.sleep(2)


def download_file(url: str, dest_path: Path):
    """Download output file, rewriting host to API_HOST."""
    parsed = urllib.parse.urlparse(url)
    direct_url = f"{API_HOST}{parsed.path}"
    req = urllib.request.Request(direct_url, headers={"X-API-Key": API_KEY})
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req) as r, open(dest_path, "wb") as f:
        f.write(r.read())
    print(f"  Downloaded: {dest_path}")


def generate_image(prompt: str, width: int, height: int, label: str) -> str:
    """Generate image via /v1/images and return job_id."""
    print(f"Starting image generation: {label} ({width}x{height})")
    resp = api_request("/v1/images", {
        "prompt": prompt,
        "width": width,
        "height": height,
        "steps": 8
    })
    job_id = resp["job_id"]
    job = wait_for_job(job_id, label)
    return job


def make_vfx_spritesheet(img_job_id: str, label: str) -> dict:
    """Convert white-background image to transparent spritesheet via /v1/sprites."""
    print(f"Keying out background via /v1/sprites for: {label}")
    resp = api_request("/v1/sprites", {
        "from_job": img_job_id,
        "background": "color",
        "key_color": "#ffffff",
        "tolerance": 28,
        "trim": False
    })
    sprite_job_id = resp["job_id"]
    return wait_for_job(sprite_job_id, f"{label}-cutout")


def build_icon(src_path: Path, dst_path: Path) -> None:
    """Resize icon to 128x128 RGBA with center square crop."""
    with Image.open(src_path) as art:
        square = art.convert("RGBA")
        side = min(square.size)
        left = (square.width - side) // 2
        top = (square.height - side) // 2
        square = square.crop((left, top, left + side, top + side))
        icon = square.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    icon.save(dst_path, "PNG", optimize=True)
    print(f"Built icon: {dst_path.relative_to(ROOT)} ({ICON_SIZE}x{ICON_SIZE})")


def build_vfx(src_path: Path, vfx_dir: Path) -> None:
    """Slice 4-panel VFX spritesheet into 256x256 frames and write sheet.png + sheet.json."""
    vfx_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(src_path) as source:
        source_rgba = source.convert("RGBA")
        src_width, src_height = source_rgba.size
        panel_width = src_width // PANEL_COUNT
        frames = []
        top_offset = max(0, (FRAME_SIZE - src_height) // 2)

        for i in range(PANEL_COUNT):
            box = (i * panel_width, 0, (i + 1) * panel_width, src_height)
            panel = source_rgba.crop(box)
            if panel.height > FRAME_SIZE or panel.width > FRAME_SIZE:
                panel = panel.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS)
                frame = panel
            else:
                frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
                frame.paste(panel, (0, top_offset), panel)
            frames.append(frame)

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        frame.save(vfx_dir / f"frame-{index + 1}.png", "PNG", optimize=True)
        sheet.paste(frame, (index * FRAME_SIZE, 0))

    sheet.save(vfx_dir / "sheet.png", "PNG", optimize=True)
    (vfx_dir / "sheet.json").write_text(
        "{\n"
        '  "frameWidth": 256,\n'
        '  "frameHeight": 256,\n'
        '  "frameCount": 4,\n'
        '  "fps": 12,\n'
        f'  "source": "{src_path.relative_to(ROOT)}"\n'
        "}\n"
    )
    print(f"Built VFX: {vfx_dir.relative_to(ROOT) / 'sheet.png'} ({FRAME_SIZE * len(frames)}x{FRAME_SIZE})")


def process_skill(spec: dict) -> None:
    skill_id = spec["id"]
    print(f"\n==========================================")
    print(f"Processing Skill: {skill_id}")
    print(f"==========================================")

    # 1. ICON
    icon_src = DOCS_EXAMPLE / f"{skill_id}-icon.png"
    if not icon_src.exists():
        if spec.get("icon_prompt"):
            job = generate_image(spec["icon_prompt"], 1024, 1024, f"{skill_id}-icon")
            files = job.get("files", [])
            if files:
                download_file(files[0]["url"], icon_src)
        else:
            print(f"  Warning: No icon prompt and {icon_src} does not exist!")

    if icon_src.exists():
        build_icon(icon_src, PUBLIC_SKILLS / f"{skill_id}.png")

    # 2. VFX SPRITESHEET
    vfx_src = DOCS_EXAMPLE / f"{skill_id}.png"
    if not vfx_src.exists():
        if spec.get("vfx_prompt"):
            img_job = generate_image(spec["vfx_prompt"], 1024, 256, f"{skill_id}-vfx-raw")
            # Save raw file as backup
            if img_job.get("files"):
                download_file(img_job["files"][0]["url"], DOCS_EXAMPLE / f"{skill_id}-raw.png")

            # Cut out background to transparent spritesheet
            sprite_job = make_vfx_spritesheet(img_job["job_id"], skill_id)
            for f in sprite_job.get("files", []):
                if f["filename"] == "spritesheet.png":
                    download_file(f["url"], vfx_src)
                    break
        else:
            print(f"  Warning: No vfx prompt and {vfx_src} does not exist!")

    if vfx_src.exists():
        build_vfx(vfx_src, PUBLIC_VFX / skill_id)


def main():
    target_id = sys.argv[1] if len(sys.argv) > 1 else None
    for spec in SKILL_SPECS:
        if target_id and spec["id"] != target_id:
            continue
        process_skill(spec)
    print("\nAll requested skill assets processed successfully!")


if __name__ == "__main__":
    main()

