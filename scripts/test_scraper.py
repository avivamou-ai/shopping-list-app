"""
בדיקה חד-פעמית: איתור הסניפים הרלוונטיים באשדוד בכמה רשתות בבת אחת.
לא רץ בפריסה - זה סקריפט אבחון בלבד, ר' .github/workflows/test-price-scraper.yml
"""
import os
import re

from il_supermarket_scarper import ScarpingTask, ScraperFactory

output_dir = "scraper_test_output"

# רשת -> מחרוזת חיפוש בכתובת (מהמשתמש, כפי שנמסר)
# אושר עד ויוחננוף כבר אותרו בהצלחה בסבבים קודמים
TARGETS = {
    "SHUFERSAL": "הבושם",
}

QUOTE_CHARS = "'׳’״\""


def normalize(text):
    return re.sub(f"[{re.escape(QUOTE_CHARS)}\\s]", "", text)


NORMALIZED_TARGETS = {name: normalize(street) for name, street in TARGETS.items()}

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

        content = None
        for encoding in ("utf-16", "utf-16-be", "utf-16-le", "utf-8"):
            try:
                candidate = raw.decode(encoding)
            except UnicodeError:
                continue
            # a correctly-decoded government XML file starts with a
            # recognizable ASCII tag; anything else means we guessed
            # the wrong encoding/byte order
            if candidate.lstrip().startswith("<") and "Root" in candidate[:50]:
                content = candidate
                print(f"(decoded with {encoding})")
                break
        if content is None:
            content = raw.decode("utf-8", errors="replace")
            print("(could not confidently decode - falling back to utf-8 with replacement)")

        blocks = []
        for tag in ("Store", "STORE", "Branch"):
            blocks = re.findall(rf"<{tag}>.*?</{tag}>", content, flags=re.DOTALL)
            if blocks:
                break
        print(f"Total store records: {len(blocks)}")

        if not blocks:
            print("No store blocks found with known tag names - raw snippet:")
            print(content[:1500])
            continue

        normalized_blocks = [(b, normalize(b)) for b in blocks]
        for scraper_name, norm_street in NORMALIZED_TARGETS.items():
            hits = [b for b, nb in normalized_blocks if norm_street in nb]
            if hits:
                print(f"-- matches for '{TARGETS[scraper_name]}' ({scraper_name}): {len(hits)}")
                for b in hits:
                    print(b)

        # Fallback / cross-check: Ashdod's municipal city code is 70
        # (confirmed from the Rami Levi and Osher Ad store files), so any
        # store carrying that code is in Ashdod regardless of how its
        # street name is spelled/punctuated in this file.
        city_hits = [b for b in blocks if "<City>70</City>" in b]
        print(f"-- stores with <City>70</City> (Ashdod): {len(city_hits)}")
        for b in city_hits:
            print(b)
