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


def ticker_names(anak_path='dashboard/public/anak_perusahaan.json'):
    data = json.loads(Path(anak_path).read_text())
    return {tk: rec.get('Company Name', tk) for tk, rec in data.items()}


def add_reciprocity(out, names):
    """For every real edge whose counterparty resolves to a tracked ticker B, add B a
    `derived` reverse edge naming the disclosing parent. Real edges win; unlisted
    counterparties are skipped."""
    real = {(p, normalize_name(e['counterparty']), e['direction'])
            for p, rec in out.items() for e in rec['edges'] if not e.get('derived')}
    seen, additions = set(), []
    for parent, rec in out.items():
        pname = rec.get('company') or parent
        for e in rec['edges']:
            if e.get('derived'):
                continue
            b = e.get('counterparty_ticker')
            if not b:
                continue
            rev = 'supplier' if e['direction'] == 'customer' else 'customer'
            key = (b, normalize_name(pname), rev)
            if key in real or key in seen:
                continue
            seen.add(key)
            additions.append((b, {
                'counterparty': pname, 'counterparty_ticker': parent, 'direction': rev,
                'flow': e['flow'], 'confidence': e['confidence'],
                'evidence_quote': e['evidence_quote'], 'source_url': e['source_url'],
                'source_type': e['source_type'], 'source_date': e['source_date'],
                'retrieved_date': e.get('retrieved_date'), 'derived': True, 'via': parent,
            }))
    for b, edge in additions:
        out.setdefault(b, {'company': names.get(b, b), 'edges': []})['edges'].append(edge)
    return out


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
    add_reciprocity(result, ticker_names())
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    n_edges = sum(len(v['edges']) for v in result.values())
    print(f'wrote {OUT_PATH}  ({len(result)} parents, {n_edges} edges)')


if __name__ == '__main__':
    main()
