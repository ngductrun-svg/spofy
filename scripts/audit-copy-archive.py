"""One-time, reproducible audit of the real archive image variants.

Requires Pillow only when regenerating the manifest; normal builds verify the
checked-in files with Node.js and do not need Python or Pillow.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from pathlib import Path
import json
import shutil
import sys
from PIL import Image

PROJECT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (PROJECT.parent / "spofy-web-assets").resolve()
DESTINATION = (PROJECT / "public" / "archive").resolve()
CATALOG_SHA = "2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291"

catalog_bytes = (PROJECT / "public" / "archive-data.json").read_bytes()
assert sha256(catalog_bytes).hexdigest() == CATALOG_SHA, "Archive catalog changed"
catalog = json.loads(catalog_bytes)
assert len(catalog["events"]) == 51 and len(catalog["photos"]) == 1471
assert DESTINATION.is_relative_to(PROJECT / "public")
paths = [(photo, photo[kind]) for photo in catalog["photos"] for kind in ("image", "thumb")]
assert len({relative for _, relative in paths}) == 2942
actual_paths = {str(path.relative_to(SOURCE)).replace("\\", "/") for folder in ("photos", "thumbs") for path in (SOURCE / folder).glob("*") if path.is_file()}
assert actual_paths == {relative for _, relative in paths}, "Source set does not exactly match the catalog"

def inspect(entry):
    photo, relative = entry
    source = (SOURCE / relative).resolve()
    assert source.is_relative_to(SOURCE), "Unsafe source path"
    payload = source.read_bytes()
    digest = sha256(payload).hexdigest()
    with Image.open(source) as image:
        assert image.format == "WEBP", f"Unexpected format: {relative}"
        width, height = image.size
        image.load()  # Actually decode every image; metadata alone is insufficient.
    assert width > 0 and height > 0
    destination = (DESTINATION / relative).resolve()
    assert destination.is_relative_to(DESTINATION), "Unsafe destination path"
    if destination.exists():
        assert sha256(destination.read_bytes()).hexdigest() == digest, f"Existing asset differs; refusing overwrite: {relative}"
    return relative, {"sha256": digest, "bytes": len(payload), "width": width, "height": height}

with ThreadPoolExecutor(max_workers=6) as executor:
    files = dict(executor.map(inspect, paths))

variants = {}
mismatches = []
for photo in catalog["photos"]:
    full, thumb = files[photo["image"]], files[photo["thumb"]]
    variants[photo["id"]] = [thumb["width"], full["width"]]
    expected = [photo.get("full_width"), photo.get("full_height")]
    actual = [full["width"], full["height"]]
    if expected != actual:
        mismatches.append({"id": photo["id"], "catalog": expected, "actual": actual})

# Do not copy any bytes until all source files and existing destination files
# have passed inspection. There is no deletion or production operation here.
for _, relative in paths:
    destination = DESTINATION / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(SOURCE / relative, destination)
    assert sha256(destination.read_bytes()).hexdigest() == files[relative]["sha256"]

manifest = {"version": 1, "catalogSha256": CATALOG_SHA, "eventCount": 51, "photoCount": 1471,
    "fileCount": len(files), "totalBytes": sum(value["bytes"] for value in files.values()),
    "fullDimensionMismatches": mismatches, "files": files}
(PROJECT / "scripts" / "archive-assets-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
(PROJECT / "src" / "archiveVariants.json").write_text(json.dumps(variants, separators=(",", ":")) + "\n", encoding="utf-8")
assert sha256((PROJECT / "public" / "archive-data.json").read_bytes()).hexdigest() == CATALOG_SHA
print(json.dumps({key: value for key, value in manifest.items() if key != "files"}, ensure_ascii=False))
print("PASS: all 2,942 WebP variants fully decoded and copied; source catalog and existing hero bytes preserved.")
