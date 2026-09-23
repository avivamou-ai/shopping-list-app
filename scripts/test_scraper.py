"""
בדיקה חד-פעמית: איתור הסניפים הרלוונטיים באשדוד בכמה רשתות בבת אחת.
לא רץ בפריסה - זה סקריפט אבחון בלבד, ר' .github/workflows/test-price-scraper.yml
"""
import os
import re

from il_supermarket_scarper import ScarpingTask, ScraperFactory

output_dir = "scraper_test_output"

# רשת -> מחרוזת חיפוש בכתובת (מהמשתמש, כפי שנמסר)
TARGETS = {
    "OSHER_AD": "בעלי המלאכה",
    "YAYNO_BITAN_AND_CARREFOUR": "מנחם בגין",
    "YOHANANOF": "ז'בוטינסקי",
    "VICTORY_NEW_SOURCE": "הטיילת",
    "SHUFERSAL": "הבושם",
}

task = ScarpingTask(
    enabled_scrapers=list(TARGETS.keys()),
    output_configuration={"output_mode": "disk", "base_storage_path": output_dir},
    file_name_regex=r"Stores",
    timeout_in_seconds=600,
)
task.start(limit=1)
task.join()

for root, _dirs, filenames in os.walk(output_dir):
    for name in filenames:
        path = os.path.join(root, name)
        chain_folder = os.path.basename(root)
        print(f"\n=== {chain_folder}: {path} ({os.path.getsize(path)} bytes) ===")

        with open(path, "rb") as fh:
            raw = fh.read()
        try:
            content = raw.decode("utf-16")
        except UnicodeError:
            content = raw.decode("utf-8", errors="replace")

        blocks = re.findall(r"<Store>.*?</Store>", content, flags=re.DOTALL)
        print(f"Total <Store> records: {len(blocks)}")

        # search every target street against this file - simplest and robust,
        # since folder names don't map 1:1 to scraper names
        for scraper_name, street in TARGETS.items():
            hits = [b for b in blocks if street in b]
            if hits:
                print(f"-- matches for '{street}' ({scraper_name}): {len(hits)}")
                for b in hits:
                    print(b)
