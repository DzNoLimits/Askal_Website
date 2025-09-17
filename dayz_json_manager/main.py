from flask import Flask, jsonify, request, send_from_directory, abort
import json
from pathlib import Path

# Paths to JSON files in the workspace
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(r"d:/Dayz/Askal_Website/serverfiles/profiles/Askal/database/Itens")
WEAPONS_PATH = DATA_DIR / "Weapons.json"
CL0THINGS_PATH = DATA_DIR / "Clothings.json"  # kept for compatibility, see dynamic routes below
ICONS_DIR = Path(r"d:/Dayz/Askal_Website/data/icons")
PENDING_PATH = DATA_DIR / "_Pending.json"  # underscore to avoid appearing as dataset
TRASH_PATH = DATA_DIR / "_Trash.json"     # recycle bin for deleted classnames

app = Flask(__name__, static_folder=str(BASE_DIR / 'static'), static_url_path='')


def read_json(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"JSON file not found: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path: Path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def _extract_categories(raw: dict):
    """Attempt to extract a Categories mapping from various legacy shapes.
    Expected modern shape: { 'Categories': { ... } }
    Legacy example seen: { 'database_version':..., 'last_updated':..., 'Consumables': { 'Consumables': { ...items... } } }
    """
    if isinstance(raw, dict) and isinstance(raw.get('Categories'), dict):
        return raw['Categories']
    # Try to infer from legacy keys
    meta_keys = {'database_version', 'last_updated'}
    # Consider only dict-valued non-meta keys
    candidates = [k for k, v in raw.items() if k not in meta_keys and isinstance(v, dict)]
    if len(candidates) == 1:
        outer = candidates[0]
        inner = raw.get(outer)
        if isinstance(inner, dict):
            # If inner has a single dict-valued key, use it as category
            inner_dict_keys = [k for k, v in inner.items() if isinstance(v, dict)]
            if len(inner_dict_keys) == 1:
                ik = inner_dict_keys[0]
                inner_m = inner.get(ik)
                if isinstance(inner_m, dict):
                    return {ik: inner_m}
            # Otherwise treat inner as already categories map
            return inner
    # Fallback empty
    return {}


def _normalize_for_frontend(raw: dict):
    cats = _extract_categories(raw)
    # Normalize variants: if item.variants is a list, convert to mapping { name: {} }
    if isinstance(cats, dict):
        for cat, items in list(cats.items()):
            if not isinstance(items, dict):
                continue
            for cls, it in list(items.items()):
                if isinstance(it, dict) and 'variants' in it:
                    v = it.get('variants')
                    if isinstance(v, list):
                        mapping = {str(name): {} for name in v}
                        it['variants'] = mapping
    return {'Categories': cats}


def generic_get(path: Path, label: str):
    try:
        data = read_json(path)
    except FileNotFoundError:
        return jsonify({'detail': f'{label} not found on server'}), 404
    # Always normalize to ensure frontend has 'Categories'
    norm = _normalize_for_frontend(data)
    return jsonify(norm)


@app.route('/api/pending', methods=['GET'])
def get_pending():
    # Pending store is optional; return empty list if missing
    if not PENDING_PATH.exists():
        return jsonify({"items": []})
    try:
        data = read_json(PENDING_PATH)
        if not isinstance(data, dict) or 'items' not in data:
            data = {"items": []}
    except Exception:
        data = {"items": []}
    return jsonify(data)


@app.route('/api/pending', methods=['PUT'])
def put_pending():
    try:
        payload = request.get_json()
    except Exception:
        return jsonify({'detail': 'Invalid JSON payload'}), 400
    if not isinstance(payload, dict) or 'items' not in payload or not isinstance(payload['items'], list):
        return jsonify({'detail': "Payload must be an object with 'items' array"}), 400
    # Normalize items to objects { name: str }
    norm_items = []
    for it in payload['items']:
        if isinstance(it, str):
            name = it.strip()
            if name:
                norm_items.append({"name": name})
        elif isinstance(it, dict):
            name = str(it.get('name', '')).strip()
            if name:
                norm_items.append({"name": name})
    write_json(PENDING_PATH, {"items": norm_items})
    return jsonify({'status': 'ok', 'count': len(norm_items)})


@app.route('/api/weapons', methods=['GET'])
def get_weapons():
    return generic_get(WEAPONS_PATH, 'Weapons.json')


@app.route('/api/clothings', methods=['GET'])
def get_clothings():
    # Backward compatibility; prefer /api/clothings via dynamic route below
    path = next((p for p in DATA_DIR.glob('*.json') if p.stem.lower() == 'clothings'), None)
    return generic_get(path or DATA_DIR / 'Clothings.json', 'Clothings.json')


def generic_put(path: Path, label: str):
    try:
        payload = request.get_json()
    except Exception:
        return jsonify({'detail': 'Invalid JSON payload'}), 400
    if not payload or 'data' not in payload:
        return jsonify({'detail': "Missing 'data' in payload"}), 400
    data = payload['data']
    if not isinstance(data, dict) or 'Categories' not in data:
        return jsonify({'detail': f"Invalid {label} format: missing 'Categories'"}), 400
    # Preserve any existing metadata fields when writing back
    existing = {}
    try:
        existing = read_json(path)
    except Exception:
        existing = {}
    out = {}
    # Keep all non-Categories top-level keys
    if isinstance(existing, dict):
        for k, v in existing.items():
            if k != 'Categories':
                out[k] = v
    # Write normalized Categories
    out['Categories'] = data['Categories']
    try:
        write_json(path, out)
    except Exception as e:
        return jsonify({'detail': f'Failed to write {label}: {e}'}), 500
    return jsonify({'status': 'ok'})


@app.route('/api/weapons', methods=['PUT'])
def save_weapons():
    return generic_put(WEAPONS_PATH, 'Weapons.json')


@app.route('/api/clothings', methods=['PUT'])
def save_clothings():
    path = next((p for p in DATA_DIR.glob('*.json') if p.stem.lower() == 'clothings'), None)
    return generic_put(path or DATA_DIR / 'Clothings.json', 'Clothings.json')


def dataset_map():
    """Return a dict mapping dataset name (lowercase stem) -> Path for all JSONs."""
    # Exclude underscore-prefixed files (e.g., _Pending.json)
    return {p.stem.lower(): p for p in DATA_DIR.glob('*.json') if not p.name.startswith('_')}


@app.route('/api/datasets', methods=['GET'])
def list_datasets():
    mp = dataset_map()
    # Return sorted list of dataset names
    return jsonify(sorted(mp.keys()))

@app.route('/api/datasets', methods=['POST'])
def create_dataset():
    try:
        payload = request.get_json() or {}
    except Exception:
        return jsonify({'detail': 'Invalid JSON payload'}), 400
    name = str(payload.get('name', '')).strip()
    if not name:
        return jsonify({'detail': 'Missing dataset name'}), 400
    # sanitize filename
    safe = ''.join(ch for ch in name if ch.isalnum() or ch in ('_', '-', ' ')).strip().replace(' ', '')
    if not safe:
        return jsonify({'detail': 'Invalid dataset name'}), 400
    path = DATA_DIR / f"{safe}.json"
    if path.exists():
        return jsonify({'detail': 'Dataset already exists'}), 409
    # initial content
    content = { 'database_version': 1, 'last_updated': '', 'Categories': {} }
    write_json(path, content)
    return jsonify({'status': 'ok', 'dataset': safe}), 201


@app.route('/api/<dataset>', methods=['GET'])
def get_dataset(dataset: str):
    mp = dataset_map()
    key = dataset.lower()
    if key not in mp:
        return jsonify({'detail': f'dataset {dataset} not found'}), 404
    return generic_get(mp[key], f'{mp[key].name}')


@app.route('/api/<dataset>', methods=['PUT'])
def put_dataset(dataset: str):
    mp = dataset_map()
    key = dataset.lower()
    if key not in mp:
        return jsonify({'detail': f'dataset {dataset} not found'}), 404
    return generic_put(mp[key], f'{mp[key].name}')


@app.route('/img/<path:filename>')
def serve_icons(filename: str):
    # Serve image assets (e.g., delete.png) from ICONS_DIR
    if not (ICONS_DIR / filename).exists():
        abort(404)
    return send_from_directory(str(ICONS_DIR), filename)


@app.route('/api/trash', methods=['GET'])
def get_trash():
    if not TRASH_PATH.exists():
        return jsonify({"classes": []})
    try:
        data = read_json(TRASH_PATH)
        if not isinstance(data, dict) or 'classes' not in data:
            data = {"classes": []}
    except Exception:
        data = {"classes": []}
    return jsonify(data)


@app.route('/api/trash', methods=['PUT'])
def put_trash():
    try:
        payload = request.get_json() or {}
    except Exception:
        return jsonify({'detail': 'Invalid JSON payload'}), 400
    classes = payload.get('classes', [])
    if not isinstance(classes, list):
        return jsonify({'detail': "'classes' must be a list"}), 400
    # normalize to unique, trimmed
    norm = []
    seen = set()
    for c in classes:
        n = str(c).strip()
        if n and n not in seen:
            seen.add(n)
            norm.append(n)
    write_json(TRASH_PATH, {"classes": norm})
    return jsonify({'status': 'ok', 'count': len(norm)})


@app.route('/api/trash', methods=['POST'])
def append_trash():
    try:
        payload = request.get_json() or {}
    except Exception:
        return jsonify({'detail': 'Invalid JSON payload'}), 400
    new_classes = payload.get('classes', [])
    if isinstance(new_classes, str):
        new_classes = [new_classes]
    if not isinstance(new_classes, list):
        return jsonify({'detail': "'classes' must be a list or string"}), 400
    # load existing
    cur = []
    if TRASH_PATH.exists():
        try:
            data = read_json(TRASH_PATH)
            cur = list(data.get('classes', [])) if isinstance(data, dict) else []
        except Exception:
            cur = []
    # merge
    s = {str(x).strip() for x in cur if str(x).strip()}
    for c in new_classes:
        n = str(c).strip()
        if n:
            s.add(n)
    out = sorted(s)
    write_json(TRASH_PATH, {"classes": out})
    return jsonify({'status': 'ok', 'count': len(out)})


@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def static_proxy(path):
    # Serve static files from the static folder
    full = BASE_DIR / 'static'
    if (full / path).exists():
        return send_from_directory(str(full), path)
    else:
        abort(404)


if __name__ == '__main__':
    # Simple dev server
    app.run(host='127.0.0.1', port=8000, debug=True)
