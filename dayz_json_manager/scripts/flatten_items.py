import json
import os
from datetime import datetime
from pathlib import Path

# Configuration
BASE_DIR = Path(__file__).resolve().parents[2]  # d:/Dayz/Askal_Website
ITENS_DIR = BASE_DIR / 'serverfiles' / 'profiles' / 'Askal' / 'database' / 'Itens'
OUTPUT_FILE = BASE_DIR / 'serverfiles' / 'profiles' / 'Askal' / 'database' / 'itens_flat.json'
DATABASE_VERSION = '0.3'

# Categories JSON may contain per-category defaults for restock/cost in future.
# For now we infer restock and cost from first item in category if present, else fallback.
CATEGORY_DEFAULTS = {
    # category_name: { 'restock': value, 'cost': value }
    # can be extended manually
}

# Fallback defaults if not derivable
FALLBACK_RESTOCK = 1800
FALLBACK_COST = 100
FALLBACK_LIFETIME = 14400
FALLBACK_NOMINAL = 0
FALLBACK_MIN = 0
FALLBACK_QUANTMIN = -1
FALLBACK_QUANTMAX = -1

# Flags we always want to ensure exist (with default values if missing)
MANDATORY_FLAGS_INT = {
    'count_in_map': 1,
    'deloot': 0,
}
# Boolean style flags we might see in original JSONs; default False
BOOLEAN_FLAG_CANDIDATES = [
    'Market', 'Store', 'P2P', 'Events', 'Secure'
]

SKIP_FILES = { '_Trash.json', '_Pending.json', 'empty.json' }


def load_category_file(path: Path):
    try:
        with path.open('r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Failed to load {path.name}: {e}")
        return None


def derive_category_defaults(cat_name: str, cat_data: dict) -> dict:
    # If already configured manually
    if cat_name in CATEGORY_DEFAULTS:
        return CATEGORY_DEFAULTS[cat_name]
    # Try to derive from first item value/tier or explicit fields if exist
    if isinstance(cat_data, dict):
        for item_name, item_obj in cat_data.items():
            if not isinstance(item_obj, dict):
                continue
            # Heuristic: use 'value' as cost if present
            cost = item_obj.get('value', FALLBACK_COST)
            # No restock info in original sample; use fallback
            return {'restock': FALLBACK_RESTOCK, 'cost': cost}
    return {'restock': FALLBACK_RESTOCK, 'cost': FALLBACK_COST}


def normalize_flags(item_obj: dict) -> dict:
    # Original item flags may be list; convert to dict of booleans
    original_flags = item_obj.get('flags', [])
    flags_dict = {}
    if isinstance(original_flags, list):
        for fl in original_flags:
            flags_dict[str(fl)] = True
    elif isinstance(original_flags, dict):
        flags_dict.update(original_flags)
    # Ensure boolean candidates present
    for cand in BOOLEAN_FLAG_CANDIDATES:
        flags_dict.setdefault(cand, False)
    # Add mandatory int flags (overwrite if present)
    for k, v in MANDATORY_FLAGS_INT.items():
        flags_dict[k] = v
    return flags_dict


def build_item_entry(item_name: str, item_obj: dict, category: str, cat_defaults: dict) -> dict:
    flags = normalize_flags(item_obj)
    entry = {
        'nominal': item_obj.get('nominal', FALLBACK_NOMINAL),
        'lifetime': item_obj.get('lifetime', FALLBACK_LIFETIME),
        'restock': cat_defaults['restock'],  # category-level override
        'min': item_obj.get('min', FALLBACK_MIN),
        'quantmin': item_obj.get('quantmin', FALLBACK_QUANTMIN),
        'quantmax': item_obj.get('quantmax', FALLBACK_QUANTMAX),
        'cost': cat_defaults['cost'],        # category-level override
        'flags': flags,
        'category': [category.lower()],
        'tags': item_obj.get('tags', []),
        'usage': item_obj.get('usage', []),
        'values': item_obj.get('values', []),
        'variants': item_obj.get('variants', {}),
    }
    # Ensure arrays
    for arr_field in ('tags', 'usage', 'values'):
        if not isinstance(entry[arr_field], list):
            entry[arr_field] = []
    # Ensure variants is object
    if not isinstance(entry['variants'], dict):
        entry['variants'] = {}
    return entry


def flatten_items():
    items = {}
    for file in sorted(os.listdir(ITENS_DIR)):
        if not file.endswith('.json') or file in SKIP_FILES:
            continue
        path = ITENS_DIR / file
        data = load_category_file(path)
        if not data:
            continue
        # The expected structure per category file: {"database_version": ..., "Categories": { "CategoryName": { itemName: { ... } } } }
        categories = data.get('Categories', {})
        for cat_name, cat_data in categories.items():
            cat_defaults = derive_category_defaults(cat_name, cat_data)
            if isinstance(cat_data, dict):
                for item_name, item_obj in cat_data.items():
                    if not isinstance(item_obj, dict):
                        continue
                    entry = build_item_entry(item_name, item_obj, cat_name, cat_defaults)
                    # Merge categories if item appears in multiple categories
                    if item_name in items:
                        # Combine category arrays unique
                        existing = items[item_name]
                        existing['category'] = sorted(set(existing['category']) | set(entry['category']))
                        # Union of tags/usage/values
                        for field in ('tags', 'usage', 'values'):
                            existing[field] = sorted(set(existing[field]) | set(entry[field]))
                        # Flags: keep True if any True (for boolean ones); ints stay as is (count_in_map, deloot)
                        for fk, fv in entry['flags'].items():
                            if isinstance(fv, bool):
                                existing['flags'][fk] = existing['flags'].get(fk, False) or fv
                        # Category-level fields cost/restock: we keep the minimum restock and minimum cost (heuristic)
                        existing['restock'] = min(existing['restock'], entry['restock'])
                        existing['cost'] = min(existing['cost'], entry['cost'])
                    else:
                        items[item_name] = entry
    result = {
        'database_version': DATABASE_VERSION,
        'last_updated': datetime.utcnow().strftime('%Y-%m-%d'),
        'Items': items
    }
    return result


def main():
    result = flatten_items()
    OUTPUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"[OK] Flatten database written to: {OUTPUT_FILE}")
    print(f"Total items: {len(result['Items'])}")

if __name__ == '__main__':
    main()
