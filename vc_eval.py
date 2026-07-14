"""Hand-labeled precision report + go/no-go gate for the M1 proof run."""
import json
import sys
from pathlib import Path

from vc_names import normalize_name

EDGES_PATH = Path('dashboard/public/value_chain_edges.json')
LABELS_PATH = Path('valuechain/labels.json')
GATE_THRESHOLD = 0.85


def edge_id(parent: str, counterparty: str, direction: str) -> str:
    return f'{parent}|{normalize_name(counterparty)}|{direction}'


def precision_by_tier(labeled_edges) -> dict:
    tiers = {}
    for e in labeled_edges:
        d = tiers.setdefault(e['confidence'], {'n': 0, 'correct': 0})
        d['n'] += 1
        if e['correct']:
            d['correct'] += 1
    for d in tiers.values():
        d['precision'] = d['correct'] / d['n'] if d['n'] else 0.0
    return tiers


def gate(tiers: dict, threshold: float = GATE_THRESHOLD) -> bool:
    h = tiers.get('high', {'n': 0, 'precision': 0.0})
    return h['n'] > 0 and h['precision'] >= threshold


def _flatten(edges_doc):
    for parent, rec in edges_doc.items():
        for e in rec['edges']:
            yield parent, e


def main():
    doc = json.loads(EDGES_PATH.read_text())
    if not LABELS_PATH.exists():
        template = {edge_id(p, e['counterparty'], e['direction']): None
                    for p, e in _flatten(doc)}
        LABELS_PATH.parent.mkdir(parents=True, exist_ok=True)
        LABELS_PATH.write_text(json.dumps(template, ensure_ascii=False, indent=1))
        print(f'wrote label template with {len(template)} edges to {LABELS_PATH}')
        print('Fill each value with true (correct + right direction) or false, '
              'then re-run.')
        return

    labels = json.loads(LABELS_PATH.read_text())
    labeled = []
    for p, e in _flatten(doc):
        v = labels.get(edge_id(p, e['counterparty'], e['direction']))
        if v is None:
            print(f'ERROR: unlabeled edge {edge_id(p, e["counterparty"], e["direction"])}')
            sys.exit(1)
        labeled.append({'confidence': e['confidence'], 'correct': bool(v)})

    tiers = precision_by_tier(labeled)
    print('=== precision by confidence tier ===')
    for t in ('high', 'medium', 'low'):
        d = tiers.get(t)
        if d:
            print(f'  {t:6s} {d["correct"]:3d}/{d["n"]:<3d}  {d["precision"]*100:5.1f}%')
    passed = gate(tiers)
    print(f'\nGATE (high precision >= {GATE_THRESHOLD:.0%}): '
          f'{"PASS -> proceed to batch" if passed else "FAIL -> iterate"}')


if __name__ == '__main__':
    main()
