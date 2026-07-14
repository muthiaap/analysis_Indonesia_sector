"""Extract counterparty-bearing note sections from local IDX financial statements.

The interim (2026-I) statements are digital, bilingual, XBRL-tagged PDFs. Related-
party transaction TABLES carry the counterparty names + amounts (each row also
contains the words 'pihak berelasi'/'related party'); most other 'berelasi' pages are
narrative policy text with no names. We keep the table pages (and adjacent
continuation pages) plus any customer-concentration page, and hand those to synthesis.
"""
import json
import re
import sys
from pathlib import Path

FS_DIR = '/Users/67620/scrap_sector/scrap_idx/laporan_keuangan'
DST_DIR = Path('valuechain/evidence')

_RP_KW = ('berelasi', 'related part')
_CONC = re.compile(r'konsentrasi', re.I)
_CONC_CTX = ('pelanggan', 'customer', '10%')
# A counterparty row: a PT/CV name followed later on the line by an amount-like number.
_ROW = re.compile(r'\b(?:PT|CV)\s+[A-Z][\w().,&/\- ]{2,}?[\d.,]{2,}')


def _row_count(text: str) -> int:
    return sum(1 for ln in text.split('\n') if _ROW.search(ln))


def select_note_pages(pages) -> list:
    sel = set()
    for i, t in enumerate(pages):
        low = t.lower()
        is_rp = any(k in low for k in _RP_KW)
        is_conc = _CONC.search(t) and any(c in low for c in _CONC_CTX)
        if (is_rp and _row_count(t) >= 2) or is_conc:
            sel.add(i)
    # continuation pages: a rows-heavy page adjacent to an already-selected page
    for i, t in enumerate(pages):
        if i not in sel and _row_count(t) >= 2 and ((i - 1) in sel or (i + 1) in sel):
            sel.add(i)
    # fallback: related-party mentioned but no table matched -> keep those pages so
    # nothing is silently dropped (synthesis can still read narrative names).
    if not sel:
        for i, t in enumerate(pages):
            if any(k in t.lower() for k in _RP_KW):
                sel.add(i)
    return sorted(sel)


def extract_bundle(ticker, fs_dir=FS_DIR, run_date='2026-03-31',
                   collected_date='2026-07-14'):
    path = Path(fs_dir) / f'FinancialStatement-2026-I-{ticker}.pdf'
    if not path.exists():
        return None
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        pages = [(p.extract_text() or '') for p in pdf.pages]
    url = f'https://www.idx.co.id/en/listed-companies/company-profiles/{ticker}'
    snippets = [{'source_url': url, 'source_type': 'filing', 'source_date': run_date,
                 'text': pages[i].strip()}
                for i in select_note_pages(pages) if pages[i].strip()]
    return {'ticker': ticker, 'collected_date': collected_date,
            'source_file': path.name, 'snippets': snippets}


def all_tickers(fs_dir=FS_DIR):
    pat = re.compile(r'FinancialStatement-2026-I-([A-Z0-9]+)\.pdf$')
    out = []
    for p in Path(fs_dir).glob('FinancialStatement-2026-I-*.pdf'):
        m = pat.match(p.name)
        if m:
            out.append(m.group(1))
    return sorted(out)


def main():
    tickers = sys.argv[1:] or all_tickers()
    DST_DIR.mkdir(parents=True, exist_ok=True)
    written = empty = missing = 0
    for tk in tickers:
        bundle = extract_bundle(tk)
        if bundle is None:
            missing += 1
            continue
        if not bundle['snippets']:
            empty += 1
            continue
        (DST_DIR / f'{tk}.json').write_text(
            json.dumps(bundle, ensure_ascii=False, indent=1))
        written += 1
    print(f'tickers={len(tickers)}  written={written}  '
          f'empty(no note pages)={empty}  missing_pdf={missing}')


if __name__ == '__main__':
    main()
