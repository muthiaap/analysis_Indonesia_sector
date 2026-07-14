# Local-FS Value-Chain Pipeline + Reciprocity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace web filing-collection with deterministic extraction from the 738 local financial statements, add reciprocity (derived reverse edges), and validate on a 25-company sample against the M1 web results.

**Architecture:** New `vc_extract_filing.py` parses each local FS PDF (pdfplumber), selects the counterparty-bearing note pages, and writes an evidence bundle — reusing the existing `vc_schema`/`vc_freshness`/`vc_eval` and the synthesis contract unchanged. `vc_assemble.py` gains a reciprocity pass that adds `derived` reverse edges when a counterparty resolves to a tracked ticker. A runbook extracts all 738, synthesizes 25 via Claude Code subagents, assembles, and compares.

**Tech Stack:** Python 3.12, `pdfplumber` (already installed), `pytest`. Stdlib otherwise.

## Global Constraints

- Python 3.12; stdlib only except `pdfplumber` (already installed) for PDF reads and `pytest` for tests. No other new deps.
- Runtime modules are flat `vc_*.py` at repo root; paths relative to repo root.
- Local FS live at `/Users/67620/scrap_sector/scrap_idx/laporan_keuangan/FinancialStatement-2026-I-<TICKER>.pdf` (configurable). 738 tickers, digital text, XBRL-tagged. `source_date` for these = `2026-03-31` (Q1 2026 period end); `source_type` = `filing`.
- Edge schema unchanged. `derived` (bool) and `via` (str) are OPTIONAL edge fields; `validate_edge` already accepts unknown fields, so no schema edit is needed.
- Reciprocity rule (exact): a parent's `customer` edge to tracked ticker B ⇒ B gains a `supplier` edge naming the parent; a parent's `supplier` edge whose counterparty is tracked ticker B ⇒ B gains a `customer` edge naming the parent. Derived edges copy the parent edge's quote/source/confidence and set `derived: true, via: <parent ticker>`. A real edge on B for the same (counterparty, direction) wins — no derived duplicate. No derived edge when the counterparty is unlisted.
- Sample (25): ADRO, UNTR, ASII, SMGR, INTP, TLKM, TAPG, PGAS, WIKA, JPFA, PTBA, ITMG, ANTM, ADHI, PTPP, WSKT, WTON, WSBP, SMAR, AALI, INDF, ICBP, CPIN, MEDC, UNVR.

## File Structure

- Create: `vc_extract_filing.py` — local FS → evidence bundle (`select_note_pages`, `extract_bundle`, `all_tickers`, `main`).
- Create: `tests/test_vc_extract_filing.py`
- Modify: `vc_assemble.py` — add `ticker_names`, `add_reciprocity`; call it in `main`.
- Modify: `tests/test_vc_assemble.py` — reciprocity tests.
- Produce (runbook): 738 bundles in `valuechain/evidence/`, re-synthesized `valuechain/edges/` for the 25, `dashboard/public/value_chain_edges.json`, `valuechain/RESULTS-localfs.md`; M1 edges archived to `valuechain/edges_m1/`.

---

## Task 1: `vc_extract_filing.py` — local FS → evidence bundle

**Files:**
- Create: `vc_extract_filing.py`
- Test: `tests/test_vc_extract_filing.py`

**Interfaces:**
- Produces:
  - `select_note_pages(pages: list[str]) -> list[int]` — indices of pages that carry counterparty rows (related-party table pages + adjacent continuation pages + concentration pages). Pure over already-extracted page texts.
  - `extract_bundle(ticker: str, fs_dir: str = FS_DIR, run_date: str = '2026-03-31', collected_date: str = '2026-07-14') -> dict | None` — opens the PDF, returns an evidence bundle dict (or `None` if the file is missing).
  - `all_tickers(fs_dir: str = FS_DIR) -> list[str]`
  - `main()` — CLI: `python3 vc_extract_filing.py [TICKER ...]` (default all); writes non-empty bundles to `valuechain/evidence/<TICKER>.json`, prints a summary.

- [ ] **Step 1: Write the failing test**

Create `tests/test_vc_extract_filing.py`:

```python
from vc_extract_filing import select_note_pages


def test_selects_related_party_table_page_not_narrative():
    pages = [
        "General information\nEntity name PT Example Tbk",
        "Kebijakan akuntansi atas transaksi pihak berelasi dijelaskan sebagai berikut.",  # narrative, no rows
        ("Rincian saldo dengan pihak berelasi\n"
         "Pihak berelasi 1 PT Wijaya Karya Beton Tbk 17,983 Related party 1\n"
         "Pihak berelasi 2 PT Adhi Karya (Persero) Tbk 22,284 Related party 2"),        # rp + rows
        "Catatan lain tanpa relevansi apa pun di sini",
    ]
    assert select_note_pages(pages) == [2]


def test_includes_adjacent_continuation_rows_page():
    pages = [
        ("Transaksi pihak berelasi\n"
         "Pihak berelasi 1 PT Alpha 10,000\nPihak berelasi 2 PT Beta 5,000"),           # rp + rows (kept)
        "PT Gamma Tbk 3,000\nPT Delta 1,200\nPT Epsilon 900",                            # continuation rows, no keyword
        "Halaman lain",
    ]
    assert select_note_pages(pages) == [0, 1]


def test_selects_concentration_page():
    pages = [
        "Konsentrasi risiko: pelanggan yang melebihi 10% dari pendapatan adalah PT Buyer Satu.",
        "Halaman biasa",
    ]
    assert select_note_pages(pages) == [0]


def test_empty_and_no_matches():
    assert select_note_pages([]) == []
    assert select_note_pages(["nothing here", "still nothing"]) == []


def test_fallback_keeps_related_party_pages_when_no_rows_detected():
    pages = ["Pengungkapan pihak berelasi tanpa tabel terstruktur di halaman ini."]
    assert select_note_pages(pages) == [0]
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_extract_filing.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_extract_filing'`

- [ ] **Step 3: Implement `vc_extract_filing.py`**

```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_extract_filing.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Smoke-test the PDF path on one real file**

Run:
```bash
python3 -c "
import vc_extract_filing as x
b = x.extract_bundle('SMGR')
print('snippets:', len(b['snippets']))
print('any name row:', any('Wijaya Karya Beton' in s['text'] for s in b['snippets']))"
```
Expected: `snippets:` ≥ 1 and `any name row: True` (SMGR's related-party table names WTON). If `False`, the row regex needs widening before proceeding — report it.

- [ ] **Step 6: Commit**

```bash
git add vc_extract_filing.py tests/test_vc_extract_filing.py
git commit -m "feat(valuechain): extract related-party note pages from local FS PDFs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: reciprocity in `vc_assemble.py`

**Files:**
- Modify: `vc_assemble.py`
- Test: `tests/test_vc_assemble.py`

**Interfaces:**
- Consumes: `vc_names.normalize_name` (already imported).
- Produces:
  - `vc_assemble.ticker_names(anak_path: str = 'dashboard/public/anak_perusahaan.json') -> dict[str, str]` — ticker → company name.
  - `vc_assemble.add_reciprocity(out: dict, names: dict) -> dict` — mutates and returns `out`, adding `derived` reverse edges (per the Global Constraints rule).
  - `main()` calls `add_reciprocity(result, ticker_names())` before writing.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_vc_assemble.py`:

```python
from vc_assemble import add_reciprocity


def _cust_edge(cp, cp_ticker):
    return {'counterparty': cp, 'counterparty_ticker': cp_ticker, 'direction': 'customer',
            'flow': 'cement sales', 'confidence': 'high', 'evidence_quote': 'sells to them',
            'source_url': 'u', 'source_type': 'filing', 'source_date': '2026-03-31',
            'retrieved_date': '2026-07-14'}


def test_reciprocity_adds_reverse_edge_for_tracked_counterparty():
    out = {'SMGR': {'company': 'Semen Indonesia (Persero) Tbk',
                    'edges': [_cust_edge('PT Wijaya Karya Beton Tbk', 'WTON')]}}
    add_reciprocity(out, {'WTON': 'Wijaya Karya Beton Tbk'})
    derived = [e for e in out['WTON']['edges'] if e.get('derived')]
    assert len(derived) == 1
    assert derived[0]['direction'] == 'supplier'          # customer -> supplier
    assert derived[0]['counterparty_ticker'] == 'SMGR'
    assert derived[0]['via'] == 'SMGR'
    assert derived[0]['confidence'] == 'high'


def test_reciprocity_real_edge_wins_over_derived():
    out = {
        'SMGR': {'company': 'Semen Indonesia', 'edges': [_cust_edge('PT Wijaya Karya Beton Tbk', 'WTON')]},
        'WTON': {'company': 'Wijaya Karya Beton Tbk', 'edges': [
            {'counterparty': 'Semen Indonesia', 'counterparty_ticker': 'SMGR', 'direction': 'supplier',
             'flow': 'buys cement', 'confidence': 'high', 'evidence_quote': 'buys from SMGR',
             'source_url': 'u', 'source_type': 'filing', 'source_date': '2026-03-31', 'retrieved_date': '2026-07-14'}]},
    }
    add_reciprocity(out, {'WTON': 'Wijaya Karya Beton Tbk', 'SMGR': 'Semen Indonesia'})
    assert [e for e in out['WTON']['edges'] if e.get('derived')] == []   # real covers it


def test_no_reciprocity_for_unlisted_counterparty():
    out = {'ADRO': {'company': 'Alamtri', 'edges': [_cust_edge('TNB Fuel Services', None)]}}
    add_reciprocity(out, {})
    assert list(out.keys()) == ['ADRO']
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_assemble.py -k reciprocity -v`
Expected: FAIL — `cannot import name 'add_reciprocity'`

- [ ] **Step 3: Implement in `vc_assemble.py`**

Add these functions (after `resolve_counterparty_ticker`):

```python
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
```

Then in `main()`, change:

```python
    result = assemble(files, run_date, index)
```
to:

```python
    result = assemble(files, run_date, index)
    add_reciprocity(result, ticker_names())
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_assemble.py -v`
Expected: PASS (existing assemble tests + 3 new reciprocity tests)

- [ ] **Step 5: Full suite green**

Run: `python3 -m pytest -q`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add vc_assemble.py tests/test_vc_assemble.py
git commit -m "feat(valuechain): reciprocity pass — derived reverse edges for tracked counterparties

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Runbook — extract 738, synthesize 25, assemble, compare

Produces the milestone deliverable. Not TDD — it drives the CLIs + subagents and records results. Preserve the M1 edges for comparison before overwriting.

**Files:**
- Produce: `valuechain/evidence/*.json` (738), `valuechain/edges/*.json` (25 re-synthesized), `valuechain/edges_m1/` (archived M1 edges), `dashboard/public/value_chain_edges.json`, `valuechain/RESULTS-localfs.md`

- [ ] **Step 1: Archive the M1 edges for comparison**

Run:
```bash
mkdir -p valuechain/edges_m1 && cp valuechain/edges/*.json valuechain/edges_m1/ && ls valuechain/edges_m1 | wc -l
```
Expected: 10 (the M1 edge files preserved).

- [ ] **Step 2: Extract all 738 local FS → evidence bundles**

Run: `python3 vc_extract_filing.py`
Expected: `tickers=738  written=<N>  empty(no note pages)=<M>  missing_pdf=<K>`. Record N/M/K. A high `empty` count would mean the selector misses tables — spot-check one empty ticker's PDF before proceeding.

- [ ] **Step 3: Sanity-check the 25 sample bundles are non-empty & valid**

Run:
```bash
python3 -c "
import json, vc_schema as s
S='ADRO UNTR ASII SMGR INTP TLKM TAPG PGAS WIKA JPFA PTBA ITMG ANTM ADHI PTPP WSKT WTON WSBP SMAR AALI INDF ICBP CPIN MEDC UNVR'.split()
for tk in S:
    try:
        b=json.load(open(f'valuechain/evidence/{tk}.json'))
        errs=s.validate_bundle(b)
        print(f'{tk:5s} snippets={len(b[\"snippets\"]):2d} {\"OK\" if not errs else errs}')
    except FileNotFoundError:
        print(f'{tk:5s} NO BUNDLE (empty or missing pdf)')"
```
Expected: each of the 25 shows snippets ≥ 1 and OK. Note any with NO BUNDLE.

- [ ] **Step 4: Synthesize the 25 via subagents (superpowers:dispatching-parallel-agents)**

For each of the 25 tickers that has a bundle, dispatch one subagent whose task is the contents of `valuechain/prompts/synthesize.md`, reading `valuechain/evidence/<TICKER>.json` and writing `valuechain/edges/<TICKER>.json`. The evidence snippets are now full note-page text (larger than M1's hand-picked quotes) — the contract's "emit an edge only if a verbatim quote supports it" still governs; the subagent extracts the naming sentence as the quote.

- [ ] **Step 5: Validate the 25 edge files**

Run:
```bash
python3 -c "
import json, glob, vc_schema as s
issues={}
for f in glob.glob('valuechain/edges/*.json'):
    d=json.load(open(f)); errs=[e for x in d['edges'] for e in [s.validate_edge(x)] if e]
    if errs: issues[f]=errs
print('INVALID:', issues if issues else 'none')"
```
Expected: `INVALID: none`.

- [ ] **Step 6: Assemble with reciprocity**

Run: `python3 vc_assemble.py`
Expected: `wrote dashboard/public/value_chain_edges.json (P parents, E edges)`. P may exceed 25 (reciprocity can add derived-only parents).

- [ ] **Step 7: Report reciprocity + coverage**

Run:
```bash
python3 -c "
import json
d=json.load(open('dashboard/public/value_chain_edges.json'))
real=der=0; derived_parents=0
for tk,rec in d.items():
    es=rec['edges']; r=sum(1 for e in es if not e.get('derived')); dd=sum(1 for e in es if e.get('derived'))
    real+=r; der+=dd
    if r==0 and dd>0: derived_parents+=1
print(f'parents={len(d)}  real_edges={real}  derived_edges={der}  derived-only parents={derived_parents}')"
```
Record these numbers.

- [ ] **Step 8: Gate + label**

Run: `python3 vc_eval.py` (emits label template if `valuechain/labels.json` absent). Label the sample (human, or AI-verified with the provisional caveat as in M1), then re-run `python3 vc_eval.py` for the gate. Reciprocity/derived edges inherit their source edge's correctness — label the underlying real edges; note derived ones are not independently judged.

- [ ] **Step 9: Compare local-FS vs M1 for the overlapping 10**

Run:
```bash
python3 -c "
import json, glob, os
def load(d):
    o={}
    for f in glob.glob(d+'/*.json'):
        tk=os.path.basename(f)[:-5]; o[tk]=json.load(open(f))['edges']
    return o
m1=load('valuechain/edges_m1'); new=load('valuechain/edges')
for tk in sorted(m1):
    a={e['counterparty'] for e in m1[tk]}; b={e['counterparty'] for e in new.get(tk,[])}
    print(f'{tk:5s} M1={len(a):2d} local={len(b):2d} common~{len(a&b):2d} new_only={len(b-a)}')"
```
Note where local FS matches, beats, or under-covers M1 (interim notes may miss some annual-only names).

- [ ] **Step 10: Write `valuechain/RESULTS-localfs.md`**

Record: extraction stats (Step 2), the 25 synthesized counts, reciprocity numbers (Step 7), the gate result, the M1-vs-local comparison table (Step 9), and a decision paragraph — does local FS match/beat M1 well enough to scale to all 738? Note the batch-synthesis-engine question as the next gate, and any tickers where interim FS under-covered vs the annual (candidates for the annual-FS upgrade).

- [ ] **Step 11: Commit the run**

```bash
git add valuechain/evidence valuechain/edges valuechain/edges_m1 valuechain/labels.json valuechain/RESULTS-localfs.md dashboard/public/value_chain_edges.json
git commit -m "feat(valuechain): local-FS run (738 extracted, 25 synthesized) + reciprocity + comparison

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Deterministic local extraction of related-party (+ concentration) note pages → Task 1, tested on the selection heuristic; PDF path smoke-tested. ✓
- Reciprocity (derived reverse edges, real-wins, unlisted-skipped) → Task 2, tested. ✓
- `derived`/`via` need no schema change (validate_edge is permissive) → noted in constraints; not a task. ✓
- Extract all 738, synthesize 25 sample, assemble, gate, compare vs M1 → Task 3 runbook. ✓
- Reuse of vc_schema/vc_freshness/vc_eval/synthesize contract unchanged → constraints + runbook. ✓

**Placeholder scan:** No TBD/TODO; deterministic tasks carry full code + expected output; the runbook uses concrete commands with recorded outputs and an explicit human/AI labeling step.

**Type/name consistency:** `select_note_pages(list[str]) -> list[int]` consumed by `extract_bundle`; bundle shape matches `vc_schema.validate_bundle` (`ticker`, `snippets:[{source_url,source_type,source_date,text}]`); `add_reciprocity(out, names)` operates on the exact `{parent:{company,edges}}` shape `assemble` returns and `vc_eval` consumes; derived edges carry every field `validate_edge` requires plus optional `derived`/`via`.

**Risk note:** the extraction selector is a heuristic over messy PDF text — Task 1 Step 5 smoke-tests it on a real file (SMGR must surface WTON), and Task 3 Step 2/3 surface any high `empty` count or missing sample bundles before the (costly) synthesis fan-out.
