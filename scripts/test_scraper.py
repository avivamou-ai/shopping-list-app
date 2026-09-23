"""
בדיקה חד-פעמית: הבאת רשימת הסניפים של רמי לוי, כדי לאתר את מספר הסניף באשדוד.
לא רץ בפריסה - זה סקריפט אבחון בלבד, ר' .github/workflows/test-price-scraper.yml
"""
import os
import re
import sys

from il_supermarket_scarper import ScarpingTask, ScraperFactory

output_dir = "scraper_test_output"

task = ScarpingTask(
    enabled_scrapers=[ScraperFactory.RAMI_LEVY.name],
    output_configuration={"output_mode": "disk", "base_storage_path": output_dir},
    file_name_regex=r"Stores",
    timeout_in_seconds=300,
)
task.start(limit=1)
task.join()

files = []
for root, _dirs, filenames in os.walk(output_dir):
    for name in filenames:
        files.append(os.path.join(root, name))

if not files:
    print("FAILURE: no store file was downloaded")
    sys.exit(1)

path = files[0]
print(f"Downloaded: {path} ({os.path.getsize(path)} bytes)")

with open(path, "rb") as fh:
    raw = fh.read()

# These government XML files are commonly UTF-16 encoded (with a BOM);
# fall back to UTF-8 if that guess is wrong.
try:
    content = raw.decode("utf-16")
except UnicodeError:
    content = raw.decode("utf-8", errors="replace")

print("=== RAW SNIPPET (first 1500 chars) ===")
print(content[:1500])
print("=== END SNIPPET ===")

# Try a few common tag names for a per-store record, since the exact schema is unknown
for tag in ("Store", "STORE", "Branch"):
    blocks = re.findall(rf"<{tag}>.*?</{tag}>", content, flags=re.DOTALL)
    if blocks:
        print(f"Total <{tag}> records: {len(blocks)}")
        ashdod_blocks = [b for b in blocks if "אשדוד" in b]
        print(f"Records matching 'אשדוד': {len(ashdod_blocks)}")
        for b in ashdod_blocks:
            print("----")
            print(b)
        break
else:
    print("No Store/STORE/Branch tags found - inspect the raw snippet above to find the real schema")
