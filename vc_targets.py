"""Select and describe the companies to research."""
import csv
import json
from pathlib import Path

from vc_names import normalize_name

SEED_TICKERS = ['ADRO', 'UNTR', 'ASII', 'SMGR', 'INTP',
                'TLKM', 'TAPG', 'PGAS', 'WIKA', 'JPFA']

# Seed tickers absent from anak_perusahaan.json (which is the only company-name
# source in this repo). Names verified from IDX listings.
FALLBACK_NAMES = {
    'TLKM': 'Telkom Indonesia (Persero) Tbk',
    'JPFA': 'Japfa Comfeed Indonesia Tbk',
}


def build_aliases(legal_name: str, ticker: str) -> list[str]:
    """Name variants used to spot mentions in evidence text: the raw legal
    name, a clean title-cased core, and the ticker. Deduped, order-preserving."""
    core = normalize_name(legal_name)
    candidates = [legal_name.strip(), core.title(), ticker]
    seen, out = set(), []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _sector_by_ticker(lk_path: str) -> dict:
    idx = {}
    with open(lk_path, newline='') as f:
        for row in csv.DictReader(f):
            idx.setdefault(row['Ticker'], row['Sektor'])
    return idx


def load_targets(tickers: list[str] | None = None,
                 anak_path: str = 'dashboard/public/anak_perusahaan.json',
                 lk_path: str = 'all_lk.csv') -> list[dict]:
    """-> [{ticker, legal_name, aliases, sector}] for the requested tickers
    (defaults to SEED_TICKERS)."""
    tickers = tickers or SEED_TICKERS
    anak = json.loads(Path(anak_path).read_text())
    sectors = _sector_by_ticker(lk_path)
    out = []
    for tk in tickers:
        legal = anak.get(tk, {}).get('Company Name') or FALLBACK_NAMES.get(tk, tk)
        out.append({
            'ticker': tk,
            'legal_name': legal,
            'aliases': build_aliases(legal, tk),
            'sector': sectors.get(tk, ''),
        })
    return out
