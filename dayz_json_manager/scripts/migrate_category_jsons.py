import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parents[2]
ITENS_DIR = BASE_DIR / 'serverfiles' / 'profiles' / 'Askal' / 'database' / 'Itens'
BACKUP_DIR = ITENS_DIR / '_backup_migration'
BACKUP_DIR.mkdir(exist_ok=True)

# Default values
DEF_NOMINAL = 0
DEF_LIFETIME = 14400
DEF_MIN = 0
DEF_QUANTMIN = -1
DEF_QUANTMAX = -1
DEF_RESTOCK = 1800
DEF_COST = 100

MANDATORY_FLAGS_INT = {
    'count_in_map': 1,
    'deloot': 0,
}
BOOLEAN_FLAG_CANDIDATES = ['Market', 'Store', 'P2P', 'Events', 'Secure']

SKIP_FILES = {'_Trash.json', '_Pending.json', 'empty.json'}

def migrate_item(item: dict, cat_defaults: dict):
    # Add numeric fields if missing
    item.setdefault('nominal', DEF_NOMINAL)
    item.setdefault('lifetime', DEF_LIFETIME)
    item.setdefault('min', DEF_MIN)
    item.setdefault('quantmin', DEF_QUANTMIN)
    item.setdefault('quantmax', DEF_QUANTMAX)
    # variants ensure object
    if 'variants' not in item or not isinstance(item['variants'], dict):
        item['variants'] = {}
    # flags list->dict
    flags = item.get('flags', [])
    if isinstance(flags, list):
        flags_dict = {f: True for f in flags}
    elif isinstance(flags, dict):
        flags_dict = dict(flags)
    else:
        flags_dict = {}
    # Ensure candidates
    for cand in BOOLEAN_FLAG_CANDIDATES:
        flags_dict.setdefault(cand, False)
    # Mandatory ints override
    for k, v in MANDATORY_FLAGS_INT.items():
        flags_dict[k] = v
    item['flags'] = flags_dict
    # Ensure restock/cost placeholders at item level (mirrors category defaults for now)
    item['restock'] = cat_defaults.get('restock', DEF_RESTOCK)
    item['cost'] = cat_defaults.get('cost', DEF_COST)
    return item

def determine_category_defaults(cat_name: str, items: dict):
    # Try deriving cost from first item 'value'
    cost = None
    for _, it in items.items():
        if isinstance(it, dict) and 'value' in it:
            cost = it.get('value')
            break
    if cost is None:
        cost = DEF_COST
    restock = DEF_RESTOCK
    return {'restock': restock, 'cost': cost}

def migrate_file(path: Path):
    original = json.loads(path.read_text(encoding='utf-8'))
    changed = False

    cats = original.get('Categories')
    if not isinstance(cats, dict):
        return False, 'No Categories'

    # Initialize CategoryDefaults structure
    category_defaults = original.get('CategoryDefaults', {})

    for cat_name, items in cats.items():
        if not isinstance(items, dict):
            continue
        # Determine defaults if not present
        if cat_name not in category_defaults:
            category_defaults[cat_name] = determine_category_defaults(cat_name, items)
            changed = True
        defaults = category_defaults[cat_name]
        for item_name, item in items.items():
            if not isinstance(item, dict):
                continue
            before = json.dumps(item, sort_keys=True)
            migrate_item(item, defaults)
            after = json.dumps(item, sort_keys=True)
            if before != after:
                changed = True

    original['CategoryDefaults'] = category_defaults
    # Update metadata
    original['database_version'] = '0.3'
    original['last_updated'] = datetime.utcnow().strftime('%Y-%m-%d')

    if changed:
        # Backup
        backup_path = BACKUP_DIR / path.name
        if not backup_path.exists():
            backup_path.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
        path.write_text(json.dumps(original, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        return True, 'Updated'
    return False, 'No changes'

def main():
    updated = 0
    processed = 0
    for file in sorted(ITENS_DIR.glob('*.json')):
        if file.name in SKIP_FILES:
            continue
        changed, msg = migrate_file(file)
        processed += 1
        if changed:
            updated += 1
            print(f"[UPDATED] {file.name}: {msg}")
        else:
            print(f"[SKIP]    {file.name}: {msg}")
    print(f"Done. Processed {processed}, updated {updated}. Backups in {BACKUP_DIR}")

if __name__ == '__main__':
    main()
