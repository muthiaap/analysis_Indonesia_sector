"""Merge per-company edge files into the dashboard artifact.

Applies the freshness disposition, dedupes by (parent, counterparty, direction),
and resolves counterparties that are themselves listed to their ticker.
"""
import json
from datetime import date
from pathlib import Path

from vc_names import normalize_name
from vc_freshness import apply_freshness

EDGES_DIR = Path('valuechain/edges')
OUT_PATH = Path('dashboard/public/value_chain_edges.json')


def build_universe_index(anak_path: str = 'dashboard/public/anak_perusahaan.json') -> dict:
    data = json.loads(Path(anak_path).read_text())
    return {normalize_name(rec['Company Name']): tk for tk, rec in data.items()}


def resolve_counterparty_ticker(name: str, index: dict):
    return index.get(normalize_name(name))


def assemble(edge_files, run_date: str, universe_index: dict) -> dict:
    out, seen = {}, set()
    for f in edge_files:
        rec = json.loads(Path(f).read_text())
        parent = rec['ticker']
        bucket = out.setdefault(parent, {'company': rec.get('company', ''),
                                         'edges': []})
        for edge in rec['edges']:
            fresh = apply_freshness(edge, run_date)
            if fresh is None:
                continue
            key = (parent, normalize_name(fresh['counterparty']),
                   fresh['direction'])
            if key in seen:
                continue
            seen.add(key)
            fresh = dict(fresh)
            fresh['counterparty_ticker'] = resolve_counterparty_ticker(
                fresh['counterparty'], universe_index)
            bucket['edges'].append(fresh)
    return out


def main():
    run_date = date.today().isoformat()
    index = build_universe_index()
    files = sorted(EDGES_DIR.glob('*.json'))
    result = assemble(files, run_date, index)
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    n_edges = sum(len(v['edges']) for v in result.values())
    print(f'wrote {OUT_PATH}  ({len(result)} parents, {n_edges} edges)')


if __name__ == '__main__':
    main()
