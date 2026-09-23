"""
בדיקה חד-פעמית: האם ניתן להוריד קובץ מחירים בודד מרמי לוי מתוך GitHub Actions?
לא רץ בפריסה - זה סקריפט אבחון בלבד, ר' .github/workflows/test-price-scraper.yml
"""
import os
import sys

from il_supermarket_scarper import ScarpingTask, ScraperFactory

output_dir = "scraper_test_output"

task = ScarpingTask(
    enabled_scrapers=[ScraperFactory.RAMI_LEVY],
    output_configuration={"output_mode": "disk", "base_storage_path": output_dir},
    timeout_in_seconds=300,
)
task.start(limit=1)
task.join()

files = []
for root, _dirs, filenames in os.walk(output_dir):
    for name in filenames:
        path = os.path.join(root, name)
        files.append((path, os.path.getsize(path)))

if not files:
    print("FAILURE: no files were downloaded")
    sys.exit(1)

print(f"SUCCESS: downloaded {len(files)} file(s)")
for path, size in files:
    print(f"  {path} ({size} bytes)")
