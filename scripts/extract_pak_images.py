import os
import struct
import io
from PIL import Image

DATA_DIR = r"D:\games\onl\VLTK2\data"
OUTPUT_BASE_DIR = r"D:\projects\jx2-web\extracted_images"

def extract_images_from_paks():
    os.makedirs(OUTPUT_BASE_DIR, exist_ok=True)
    pak_files = [f for f in os.listdir(DATA_DIR) if f.endswith(".pak")]

    total_extracted = 0
    summary = {}

    for pak_name in pak_files:
        pak_path = os.path.join(DATA_DIR, pak_name)
        folder_name = os.path.splitext(pak_name)[0]
        out_folder = os.path.join(OUTPUT_BASE_DIR, folder_name)

        try:
            with open(pak_path, "rb") as f:
                magic = f.read(4)
                if magic != b"PACK":
                    continue

                file_count, table_offset = struct.unpack("<II", f.read(8))
                f.seek(table_offset)
                table = [struct.unpack("<IIII", f.read(16)) for _ in range(file_count)]

                pak_extracted = 0

                for idx, (id_, off, size, zflag) in enumerate(table):
                    # Flag 0 indicates uncompressed payload
                    if (zflag >> 28) == 0 and size > 0:
                        f.seek(off)
                        header = f.read(min(16, size))

                        ext = None
                        if header.startswith(b"\xff\xd8\xff"):
                            ext = "jpg"
                        elif header.startswith(b"\x89PNG"):
                            ext = "png"
                        elif header.startswith(b"BM"):
                            ext = "bmp"
                        elif len(header) >= 3 and header[:3] in [b"\x00\x00\x02", b"\x00\x00\x0a"]:
                            ext = "tga"

                        if ext:
                            f.seek(off)
                            data = f.read(size)
                            os.makedirs(out_folder, exist_ok=True)

                            # Determine resolution for friendly naming if PIL can open
                            res_str = ""
                            try:
                                with Image.open(io.BytesIO(data)) as img:
                                    res_str = f"_{img.size[0]}x{img.size[1]}"
                            except Exception:
                                pass

                            filename = f"{folder_name}_{id_:08x}{res_str}.{ext}"
                            file_path = os.path.join(out_folder, filename)

                            with open(file_path, "wb") as out_f:
                                out_f.write(data)

                            pak_extracted += 1

                if pak_extracted > 0:
                    summary[pak_name] = pak_extracted
                    total_extracted += pak_extracted
                    print(f"[{pak_name}] Extracted {pak_extracted} images -> {out_folder}")

        except Exception as e:
            print(f"Error processing {pak_name}: {e}")

    print("\n" + "=" * 50)
    print(f"Extraction complete! Total images extracted: {total_extracted}")
    print(f"Destination folder: {OUTPUT_BASE_DIR}")
    print("=" * 50)

if __name__ == "__main__":
    extract_images_from_paks()

