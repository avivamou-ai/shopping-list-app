"""
מריץ אחת ליום דרך GitHub Actions (.github/workflows/sync-prices.yml).
מוריד את קובץ המחירים העדכני מכל סניף שהוגדר להלן, ומעדכן את טבלת
`prices` ב-Supabase (upsert לפי chain+store_id+barcode).
"""
import os
import re
import shutil
import sys

import requests
from il_supermarket_scarper import ScarpingTask

from categorize import classify_category

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# רשת (עברית לתצוגה) -> (שם הסקרייפר בספרייה, מספר הסניף)
STORE_TARGETS = {
    "רמי לוי": ("RAMI_LEVY", "026"),
    "אושר עד": ("OSHER_AD", "009"),
    "יוחננוף": ("YOHANANOF", "005"),
    "קרפור": ("YAYNO_BITAN_AND_CARREFOUR", "060"),
    "שופרסל": ("SHUFERSAL", "166"),
    "המפיץ": ("SHUFERSAL", "161"),
}

OUTPUT_DIR = "scraper_output"


def decode(raw: bytes) -> str:
    for encoding in ("utf-16", "utf-16-be", "utf-16-le", "utf-8"):
        try:
            candidate = raw.decode(encoding)
        except UnicodeError:
            continue
        if candidate.lstrip().startswith("<") and "Root" in candidate[:80]:
            return candidate
    return raw.decode("utf-8", errors="replace")


def parse_items(xml_text: str):
    items = []
    for block in re.findall(r"<Item[ >].*?</Item>", xml_text, flags=re.DOTALL):
        def field(tag):
            m = re.search(rf"<{tag}>(.*?)</{tag}>", block, flags=re.DOTALL)
            return m.group(1).strip() if m else None

        barcode = field("ItemCode")
        name = field("ItemName") or field("ItemNm")
        price_text = field("ItemPrice")
        if not (barcode and name and price_text):
            continue
        try:
            price = float(price_text)
        except ValueError:
            continue
        items.append({"barcode": barcode, "item_name": name, "price": price})
    return items


def upsert_prices(rows):
    if not rows:
        return
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/prices",
        params={"on_conflict": "chain,store_id,barcode"},
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        json=rows,
        timeout=120,
    )
    if not resp.ok:
        print(f"Supabase upsert failed ({resp.status_code}): {resp.text[:500]}")
        resp.raise_for_status()


exit_code = 0

for chain_label, (scraper_name, store_id) in STORE_TARGETS.items():
    print(f"\n=== {chain_label} (סניף {store_id}) ===")

    # Prefer the full daily catalog (PriceFull) over the intraday delta
    # file (Price), which only lists items that changed since the last
    # update and is far too small to be useful here. Not every chain
    # publishes a PriceFull file (e.g. Rami Levi didn't in testing), so
    # fall back to PRICE_FILE if PRICE_FULL_FILE isn't found.
    files = []
    for file_types in (["PRICE_FULL_FILE"], ["PRICE_FILE"]):
        # DumpFolderNames uses the scraper's class name (e.g. "Yohananof"),
        # which doesn't always match the ScraperFactory enum key
        # (e.g. "YOHANANOF") - clear the whole output dir and search it
        # afterwards rather than guessing the per-chain subfolder name.
        if os.path.isdir(OUTPUT_DIR):
            shutil.rmtree(OUTPUT_DIR)

        task = ScarpingTask(
            enabled_scrapers=[scraper_name],
            files_types=file_types,
            output_configuration={"output_mode": "disk", "base_storage_path": OUTPUT_DIR},
            file_name_regex=rf"-{store_id}-\d{{8}}",
            timeout_in_seconds=600,
        )
        task.start(limit=1)
        task.join()

        for root, _dirs, filenames in os.walk(OUTPUT_DIR):
            for name in filenames:
                files.append(os.path.join(root, name))

        if files:
            print(f"(using {file_types[0]})")
            break

    if not files:
        print(f"WARNING: no price file found for {chain_label} store {store_id}")
        exit_code = 1
        continue

    path = files[0]
    with open(path, "rb") as fh:
        content = decode(fh.read())

    items = parse_items(content)
    print(f"Parsed {len(items)} items from {path}")

    if not items:
        print(f"WARNING: 0 items parsed for {chain_label} store {store_id}")
        exit_code = 1
        continue

    # de-duplicate by barcode (keep the last occurrence) - a single INSERT
    # with ON CONFLICT DO UPDATE fails if the same conflict target appears
    # twice in one statement, and full catalogs sometimes list a barcode
    # more than once (e.g. weighted items, promo variants)
    by_barcode = {}
    for item in items:
        by_barcode[item["barcode"]] = item
    rows = [
        {
            "chain": chain_label,
            "store_id": store_id,
            "barcode": item["barcode"],
            "item_name": item["item_name"],
            "price": item["price"],
            "category": classify_category(item["item_name"]),
        }
        for item in by_barcode.values()
    ]

    # batch in chunks to keep each request reasonably sized
    batch_size = 1000
    for i in range(0, len(rows), batch_size):
        upsert_prices(rows[i:i + batch_size])
    print(f"Upserted {len(rows)} rows for {chain_label}")

sys.exit(exit_code)
