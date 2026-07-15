"""Pick the next N un-synthesized, *productive* tickers for the daily batch.

Productive = the evidence bundle actually contains named counterparty rows (so
synthesis will yield edges); anonymized bundles (only "Pihak berelasi 1" with no
name) are skipped — they wait for the annual-FS pass. Un-synthesized = no
edges/<TICKER>.json yet (an existing file, even empty, counts as already attempted).

Usage: python3 vc_next_batch.py [N]   ->  prints up to N tickers, space-separated.
"""
import glob
import json
import sys
from pathlib import Path

from vc_extract_filing import _is_row

MIN_NAMED_ROWS = 3   # below this a bundle is treated as anonymized/unproductive


def named_row_count(bundle) -> int:
    return sum(1 for s in bundle.get('snippets', [])
              for ln in s.get('text', '').split('\n') if _is_row(ln))


def next_batch(n=5, ev_dir='valuechain/evidence', ed_dir='valuechain/edges'):
    done = {Path(f).stem for f in glob.glob(f'{ed_dir}/*.json')}
    out = []
    for f in sorted(glob.glob(f'{ev_dir}/*.json')):
        tk = Path(f).stem
        if tk in done:
            continue
        try:
            b = json.load(open(f))
        except Exception:
            continue
        if named_row_count(b) >= MIN_NAMED_ROWS:
            out.append(tk)
        if len(out) >= n:
            break
    return out


if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    print(' '.join(next_batch(n)))
