# External Value-Chain Edge Discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Milestone-1 pipeline that discovers external supplier/buyer edges for 10 seed companies, emitting cited, confidence-scored edges gated on hand-measured precision before any 738 batch.

**Architecture:** Deterministic Python collects *evidence* and assembles/scores *edges*; Claude Code subagents perform the evidence collection and the evidence→edge synthesis (no API keys wired in M1). The LLM may only emit an edge backed by a verbatim quote it was given. Output is a static `dashboard/public/value_chain_edges.json` the existing graph tabs read — the same static-artifact pattern as `enrich_subsidiaries.py`.

**Tech Stack:** Python 3.12 (stdlib only — `json`, `csv`, `re`, `datetime`, `pathlib`), `pytest` for tests, Claude Code subagents (WebSearch/WebFetch) as the M1 collection+synthesis engine.

## Global Constraints

- Python 3.12, **standard library only** for runtime modules (no new pip deps except `pytest` for tests). Copied verbatim from spec's "TDD on deterministic parts."
- Runtime modules live at repo root as flat `vc_*.py` files, mirroring `enrich_subsidiaries.py`; all file paths are relative to repo root.
- Freshness window: **24 months**, configurable via a `window_months` parameter defaulting to `24`.
- Confidence tiers are exactly `high` | `medium` | `low`. Directions are exactly `supplier` | `customer`. Source types are exactly `filing` | `news` | `search` | `company_site`.
- **Hard rule (synthesis):** emit an edge only if a verbatim quote in the evidence supports it. No quote → no edge.
- **Go/no-go gate:** proceed to the 738 batch only if `high`-confidence precision ≥ **0.85** on the 10-company proof.
- Seed tickers (exact, ordered): `ADRO, UNTR, ASII, SMGR, INTP, TLKM, TAPG, PGAS, WIKA, JPFA`.
- Edge schema fields (exact): `counterparty, counterparty_ticker, direction, flow, confidence, evidence_quote, source_url, source_type, source_date, retrieved_date`.

---

## File Structure

**Runtime modules (repo root):**
- `vc_names.py` — name normalization shared by targets + assembly.
- `vc_targets.py` — seed list, alias building, target loading.
- `vc_schema.py` — validators for evidence bundles and edges.
- `vc_freshness.py` — recency window + confidence capping/disposition.
- `vc_assemble.py` — merge, dedupe, counterparty→ticker resolution; writes `value_chain_edges.json`.
- `vc_eval.py` — precision-by-tier, gate, label-template emission.

**Test + config:**
- `conftest.py` (repo root, empty) — puts repo root on `sys.path` so tests can `import vc_*`.
- `tests/test_vc_names.py`, `tests/test_vc_targets.py`, `tests/test_vc_schema.py`, `tests/test_vc_freshness.py`, `tests/test_vc_assemble.py`, `tests/test_vc_eval.py`

**Contracts + data (created/produced under `valuechain/`):**
- `valuechain/prompts/collect.md` — subagent evidence-collection contract.
- `valuechain/prompts/synthesize.md` — subagent evidence→edge synthesis contract.
- `valuechain/evidence/<TICKER>.json` — produced per company by collection subagents.
- `valuechain/edges/<TICKER>.json` — produced per company by synthesis subagents.
- `valuechain/labels.json` — human-filled edge correctness labels (M1 eval).
- `dashboard/public/value_chain_edges.json` — final assembled artifact.
- `valuechain/RESULTS.md` — M1 precision report + gate decision.

---

## Task 1: Test scaffolding + name normalization + targets

**Files:**
- Create: `conftest.py` (empty), `vc_names.py`, `vc_targets.py`
- Test: `tests/test_vc_names.py`, `tests/test_vc_targets.py`

**Interfaces:**
- Consumes: `dashboard/public/anak_perusahaan.json` (`{ticker: {"Company Name": str, ...}}`), `all_lk.csv` (columns `Ticker,Sektor,...`).
- Produces:
  - `vc_names.normalize_name(name: str) -> str`
  - `vc_targets.SEED_TICKERS: list[str]`
  - `vc_targets.build_aliases(legal_name: str, ticker: str) -> list[str]`
  - `vc_targets.load_targets(tickers: list[str] | None = None, anak_path: str = 'dashboard/public/anak_perusahaan.json', lk_path: str = 'all_lk.csv') -> list[dict]` where each dict is `{ticker, legal_name, aliases, sector}`.

- [ ] **Step 1: Install pytest and create the path conftest**

Run: `python3 -m pip install pytest`
Then create empty `conftest.py` at repo root:

```python
# Empty on purpose: presence of this file at repo root puts the root on
# sys.path so tests can `import vc_*` modules that live at repo root.
```

- [ ] **Step 2: Write the failing test for `normalize_name`**

Create `tests/test_vc_names.py`:

```python
from vc_names import normalize_name


def test_strips_pt_tbk_and_punctuation():
    assert normalize_name('PT Adaro Energy Indonesia Tbk.') == 'adaro energy indonesia'


def test_strips_persero_parenthetical():
    assert normalize_name('PT PLN (Persero)') == 'pln'


def test_collapses_whitespace_and_lowercases():
    assert normalize_name('  Mulia   Industrindo  Tbk ') == 'mulia industrindo'


def test_empty_stays_empty():
    assert normalize_name('') == ''
```

- [ ] **Step 3: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_names.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_names'`

- [ ] **Step 4: Implement `vc_names.py`**

```python
"""Canonical company-name form for dedup and counterparty resolution."""
import re

# Legal-form and status words that carry no identity.
_STOP = re.compile(r'\b(pt|tbk|persero|perseroan|terbuka)\b')


def normalize_name(name: str) -> str:
    """Lowercase, drop punctuation and legal-form words, collapse whitespace.
    'PT Adaro Energy Indonesia Tbk.' -> 'adaro energy indonesia'."""
    s = name.lower()
    s = re.sub(r'[^a-z0-9\s]', ' ', s)   # punctuation -> space
    s = _STOP.sub(' ', s)
    return re.sub(r'\s+', ' ', s).strip()
```

- [ ] **Step 5: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_names.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Write the failing test for targets**

Create `tests/test_vc_targets.py`:

```python
from vc_targets import SEED_TICKERS, build_aliases, load_targets


def test_seed_has_ten_expected_tickers():
    assert SEED_TICKERS == ['ADRO', 'UNTR', 'ASII', 'SMGR', 'INTP',
                            'TLKM', 'TAPG', 'PGAS', 'WIKA', 'JPFA']


def test_build_aliases_includes_legal_titlecase_and_ticker():
    aliases = build_aliases('PT Adaro Energy Indonesia Tbk.', 'ADRO')
    assert 'PT Adaro Energy Indonesia Tbk.' in aliases
    assert 'Adaro Energy Indonesia' in aliases
    assert 'ADRO' in aliases


def test_build_aliases_dedupes_and_drops_empty():
    aliases = build_aliases('ADRO', 'ADRO')
    assert aliases.count('ADRO') == 1
    assert '' not in aliases


def test_load_targets_defaults_to_seed_and_carries_sector():
    targets = load_targets()
    assert [t['ticker'] for t in targets] == SEED_TICKERS
    adro = next(t for t in targets if t['ticker'] == 'ADRO')
    assert adro['legal_name']            # non-empty from anak_perusahaan.json
    assert adro['sector']                # non-empty from all_lk.csv
    assert 'ADRO' in adro['aliases']
```

- [ ] **Step 7: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_targets.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_targets'`

- [ ] **Step 8: Implement `vc_targets.py`**

```python
"""Select and describe the companies to research."""
import csv
import json
from pathlib import Path

from vc_names import normalize_name

SEED_TICKERS = ['ADRO', 'UNTR', 'ASII', 'SMGR', 'INTP',
                'TLKM', 'TAPG', 'PGAS', 'WIKA', 'JPFA']


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
        legal = anak.get(tk, {}).get('Company Name', tk)
        out.append({
            'ticker': tk,
            'legal_name': legal,
            'aliases': build_aliases(legal, tk),
            'sector': sectors.get(tk, ''),
        })
    return out
```

- [ ] **Step 9: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_targets.py -v`
Expected: PASS (4 passed)

- [ ] **Step 10: Commit**

```bash
git add conftest.py vc_names.py vc_targets.py tests/test_vc_names.py tests/test_vc_targets.py
git commit -m "feat(valuechain): name normalization + seed target loading

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Evidence + edge schema validators

**Files:**
- Create: `vc_schema.py`
- Test: `tests/test_vc_schema.py`

**Interfaces:**
- Produces:
  - `vc_schema.DIRECTIONS`, `CONFIDENCES`, `SOURCE_TYPES` (sets), `EDGE_FIELDS` (list)
  - `vc_schema.validate_edge(edge: dict) -> list[str]` — list of error strings; empty means valid.
  - `vc_schema.validate_bundle(bundle: dict) -> list[str]` — same convention.

- [ ] **Step 1: Write the failing test**

Create `tests/test_vc_schema.py`:

```python
from vc_schema import validate_edge, validate_bundle


def _good_edge():
    return {
        'counterparty': 'PT PLN (Persero)',
        'counterparty_ticker': None,
        'direction': 'customer',
        'flow': 'thermal coal offtake',
        'confidence': 'high',
        'evidence_quote': 'perusahaan memasok batubara ke PLN',
        'source_url': 'https://example.com/report',
        'source_type': 'filing',
        'source_date': '2025-03-31',
        'retrieved_date': '2026-07-14',
    }


def test_good_edge_has_no_errors():
    assert validate_edge(_good_edge()) == []


def test_bad_direction_is_flagged():
    e = _good_edge(); e['direction'] = 'sideways'
    assert any('direction' in x for x in validate_edge(e))


def test_missing_quote_is_flagged():
    e = _good_edge(); e['evidence_quote'] = ''
    assert any('evidence_quote' in x for x in validate_edge(e))


def test_trivial_quote_is_flagged():
    e = _good_edge(); e['evidence_quote'] = 'ok'
    assert any('quote' in x for x in validate_edge(e))


def _good_bundle():
    return {'ticker': 'ADRO', 'collected_date': '2026-07-14', 'snippets': [
        {'source_url': 'https://x', 'source_type': 'news',
         'source_date': '2025-01-01', 'text': 'some evidence text here'}]}


def test_good_bundle_has_no_errors():
    assert validate_bundle(_good_bundle()) == []


def test_bundle_without_snippets_is_flagged():
    b = _good_bundle(); b['snippets'] = []
    assert any('snippet' in x.lower() for x in validate_bundle(b))
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_schema'`

- [ ] **Step 3: Implement `vc_schema.py`**

```python
"""Shape checks for evidence bundles and synthesized edges."""

DIRECTIONS = {'supplier', 'customer'}
CONFIDENCES = {'high', 'medium', 'low'}
SOURCE_TYPES = {'filing', 'news', 'search', 'company_site'}
EDGE_FIELDS = ['counterparty', 'counterparty_ticker', 'direction', 'flow',
               'confidence', 'evidence_quote', 'source_url', 'source_type',
               'source_date', 'retrieved_date']

_REQUIRED_NONEMPTY = ['counterparty', 'direction', 'flow', 'confidence',
                      'evidence_quote', 'source_url', 'source_type']


def validate_edge(edge: dict) -> list[str]:
    errors = []
    for f in _REQUIRED_NONEMPTY:
        if not edge.get(f):
            errors.append(f'missing {f}')
    if edge.get('direction') not in DIRECTIONS:
        errors.append(f'bad direction: {edge.get("direction")!r}')
    if edge.get('confidence') not in CONFIDENCES:
        errors.append(f'bad confidence: {edge.get("confidence")!r}')
    if edge.get('source_type') not in SOURCE_TYPES:
        errors.append(f'bad source_type: {edge.get("source_type")!r}')
    q = edge.get('evidence_quote') or ''
    if q and len(q.strip()) < 10:
        errors.append(f'quote too short: {q!r}')
    return errors


def validate_bundle(bundle: dict) -> list[str]:
    errors = []
    if not bundle.get('ticker'):
        errors.append('missing ticker')
    snippets = bundle.get('snippets')
    if not isinstance(snippets, list) or not snippets:
        errors.append('no snippets')
        return errors
    for i, s in enumerate(snippets):
        if not s.get('source_url'):
            errors.append(f'snippet {i} missing source_url')
        if s.get('source_type') not in SOURCE_TYPES:
            errors.append(f'snippet {i} bad source_type')
        if not s.get('text'):
            errors.append(f'snippet {i} missing text')
    return errors
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_schema.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add vc_schema.py tests/test_vc_schema.py
git commit -m "feat(valuechain): evidence bundle + edge schema validators

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Recency (freshness) rules

**Files:**
- Create: `vc_freshness.py`
- Test: `tests/test_vc_freshness.py`

**Interfaces:**
- Produces:
  - `vc_freshness.WINDOW_MONTHS = 24`
  - `vc_freshness.in_window(source_date: str | None, run_date: str, window_months: int = 24) -> bool`
  - `vc_freshness.evidence_status(source_type: str, source_date: str | None, run_date: str, window_months: int = 24) -> str` — one of `'fresh' | 'stale' | 'undated'`.
  - `vc_freshness.cap_confidence(conf: str, ceiling: str) -> str`
  - `vc_freshness.apply_freshness(edge: dict, run_date: str, window_months: int = 24) -> dict | None` — returns the edge (possibly with capped confidence) or `None` to drop it.

**Disposition rules (from spec):** filings are exempt (always `fresh`); dated web inside the window is `fresh`; dated web outside is `stale` → **drop**; undated web is `undated` → **keep but cap confidence at `low`**.

- [ ] **Step 1: Write the failing test**

Create `tests/test_vc_freshness.py`:

```python
from vc_freshness import (in_window, evidence_status, cap_confidence,
                          apply_freshness)

RUN = '2026-07-14'   # window default 24 months -> cutoff 2024-07-01


def test_in_window_boundaries():
    assert in_window('2024-08-01', RUN) is True
    assert in_window('2024-06-01', RUN) is False   # before cutoff
    assert in_window(None, RUN) is False


def test_evidence_status_filing_always_fresh_even_if_old():
    assert evidence_status('filing', '2019-01-01', RUN) == 'fresh'


def test_evidence_status_web():
    assert evidence_status('news', '2025-01-01', RUN) == 'fresh'
    assert evidence_status('news', '2020-01-01', RUN) == 'stale'
    assert evidence_status('news', None, RUN) == 'undated'


def test_cap_confidence_lowers_only_when_above_ceiling():
    assert cap_confidence('high', 'low') == 'low'
    assert cap_confidence('low', 'medium') == 'low'


def _edge(**kw):
    base = {'counterparty': 'X', 'direction': 'customer', 'flow': 'f',
            'confidence': 'high', 'evidence_quote': 'a long enough quote',
            'source_url': 'u', 'source_type': 'news', 'source_date': '2025-01-01'}
    base.update(kw)
    return base


def test_fresh_web_edge_kept_unchanged():
    e = apply_freshness(_edge(), RUN)
    assert e is not None and e['confidence'] == 'high'


def test_stale_web_edge_dropped():
    assert apply_freshness(_edge(source_date='2020-01-01'), RUN) is None


def test_undated_web_edge_capped_to_low():
    e = apply_freshness(_edge(source_date=None), RUN)
    assert e is not None and e['confidence'] == 'low'


def test_old_filing_edge_kept_unchanged():
    e = apply_freshness(_edge(source_type='filing', source_date='2019-01-01',
                              confidence='high'), RUN)
    assert e is not None and e['confidence'] == 'high'
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_freshness.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_freshness'`

- [ ] **Step 3: Implement `vc_freshness.py`**

```python
"""Recency window and confidence disposition for evidence-backed edges."""
from datetime import date

WINDOW_MONTHS = 24
_FILING_TYPES = {'filing'}
_CONF = {'low': 0, 'medium': 1, 'high': 2}
_CONF_INV = {0: 'low', 1: 'medium', 2: 'high'}


def _parse(d: str) -> date:
    """Accept 'YYYY', 'YYYY-MM', or 'YYYY-MM-DD'."""
    p = d.split('-')
    y = int(p[0])
    m = int(p[1]) if len(p) > 1 else 1
    day = int(p[2]) if len(p) > 2 else 1
    return date(y, m, day)


def _minus_months(d: date, months: int) -> date:
    y = d.year - months // 12
    m = d.month - months % 12
    if m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


def in_window(source_date, run_date: str, window_months: int = WINDOW_MONTHS) -> bool:
    if not source_date:
        return False
    cutoff = _minus_months(_parse(run_date), window_months)
    return _parse(source_date) >= cutoff


def evidence_status(source_type, source_date, run_date,
                    window_months: int = WINDOW_MONTHS) -> str:
    if source_type in _FILING_TYPES:
        return 'fresh'
    if not source_date:
        return 'undated'
    return 'fresh' if in_window(source_date, run_date, window_months) else 'stale'


def cap_confidence(conf: str, ceiling: str) -> str:
    return _CONF_INV[min(_CONF[conf], _CONF[ceiling])]


def apply_freshness(edge: dict, run_date: str,
                    window_months: int = WINDOW_MONTHS):
    """Drop stale-only edges; cap undated-web edges at 'low'; keep the rest."""
    status = evidence_status(edge['source_type'], edge.get('source_date'),
                             run_date, window_months)
    if status == 'stale':
        return None
    out = dict(edge)
    if status == 'undated':
        out['confidence'] = cap_confidence(out['confidence'], 'low')
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_freshness.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add vc_freshness.py tests/test_vc_freshness.py
git commit -m "feat(valuechain): 24-month freshness window + confidence disposition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Assembly — merge, dedupe, resolve counterparty→ticker

**Files:**
- Create: `vc_assemble.py`
- Test: `tests/test_vc_assemble.py`

**Interfaces:**
- Consumes: `vc_names.normalize_name`, `vc_freshness.apply_freshness`.
- Produces:
  - `vc_assemble.build_universe_index(anak_path: str = 'dashboard/public/anak_perusahaan.json') -> dict[str, str]` — normalized company name → ticker, over all 738.
  - `vc_assemble.resolve_counterparty_ticker(name: str, index: dict) -> str | None`
  - `vc_assemble.assemble(edge_files: list, run_date: str, universe_index: dict) -> dict` — `{parent_ticker: {"company": str, "edges": [edge, ...]}}`.
  - `vc_assemble.main()` — CLI entry: reads `valuechain/edges/*.json`, writes `dashboard/public/value_chain_edges.json`.

Each per-company edge file has the shape `{"ticker": str, "company": str, "edges": [edge, ...]}`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_vc_assemble.py`:

```python
import json

from vc_assemble import (build_universe_index, resolve_counterparty_ticker,
                         assemble)

RUN = '2026-07-14'


def _edge(cp, direction='customer', conf='high',
          stype='filing', sdate='2025-03-31'):
    return {'counterparty': cp, 'counterparty_ticker': None,
            'direction': direction, 'flow': 'x', 'confidence': conf,
            'evidence_quote': 'a sufficiently long quote', 'source_url': 'u',
            'source_type': stype, 'source_date': sdate,
            'retrieved_date': RUN}


def test_resolve_counterparty_matches_by_normalized_name():
    index = {'united tractors': 'UNTR'}
    assert resolve_counterparty_ticker('PT United Tractors Tbk.', index) == 'UNTR'
    assert resolve_counterparty_ticker('Nonlisted Vendor', index) is None


def test_assemble_dedupes_same_counterparty_direction(tmp_path):
    f = tmp_path / 'ADRO.json'
    f.write_text(json.dumps({'ticker': 'ADRO', 'company': 'Adaro', 'edges': [
        _edge('PT PLN (Persero)'),
        _edge('PLN'),                    # same counterparty, same direction
    ]}))
    out = assemble([f], RUN, {})
    assert len(out['ADRO']['edges']) == 1


def test_assemble_drops_stale_and_resolves_ticker(tmp_path):
    f = tmp_path / 'ADRO.json'
    f.write_text(json.dumps({'ticker': 'ADRO', 'company': 'Adaro', 'edges': [
        _edge('PT United Tractors Tbk.', stype='news', sdate='2020-01-01'),  # stale -> drop
        _edge('PT United Tractors Tbk.', direction='supplier'),              # filing -> keep
    ]}))
    out = assemble([f], RUN, {'united tractors': 'UNTR'})
    edges = out['ADRO']['edges']
    assert len(edges) == 1
    assert edges[0]['direction'] == 'supplier'
    assert edges[0]['counterparty_ticker'] == 'UNTR'


def test_build_universe_index_is_nonempty_and_maps_names():
    index = build_universe_index()
    assert len(index) > 100
    # every value is a ticker string
    assert all(isinstance(v, str) and v for v in index.values())
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_assemble.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_assemble'`

- [ ] **Step 3: Implement `vc_assemble.py`**

```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_assemble.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add vc_assemble.py tests/test_vc_assemble.py
git commit -m "feat(valuechain): assemble edges with freshness, dedupe, ticker resolution

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Precision evaluation + gate

**Files:**
- Create: `vc_eval.py`
- Test: `tests/test_vc_eval.py`

**Interfaces:**
- Consumes: `vc_names.normalize_name`.
- Produces:
  - `vc_eval.edge_id(parent: str, counterparty: str, direction: str) -> str`
  - `vc_eval.precision_by_tier(labeled_edges: list[dict]) -> dict` — input rows `{confidence, correct: bool}`; output `{tier: {n, correct, precision}}`.
  - `vc_eval.gate(tiers: dict, threshold: float = 0.85) -> bool` — True iff the `high` tier has ≥1 edge and precision ≥ threshold.
  - `vc_eval.main()` — CLI: loads `value_chain_edges.json`; if `valuechain/labels.json` is absent, writes a template (`{edge_id: null}`) and exits; else prints the report and gate result.

- [ ] **Step 1: Write the failing test**

Create `tests/test_vc_eval.py`:

```python
from vc_eval import edge_id, precision_by_tier, gate


def test_edge_id_is_stable_across_name_variants():
    a = edge_id('ADRO', 'PT PLN (Persero)', 'customer')
    b = edge_id('ADRO', 'PLN', 'customer')
    assert a == b


def test_precision_by_tier_counts_and_ratios():
    rows = [
        {'confidence': 'high', 'correct': True},
        {'confidence': 'high', 'correct': True},
        {'confidence': 'high', 'correct': False},
        {'confidence': 'low', 'correct': False},
    ]
    tiers = precision_by_tier(rows)
    assert tiers['high']['n'] == 3
    assert tiers['high']['correct'] == 2
    assert abs(tiers['high']['precision'] - 2 / 3) < 1e-9
    assert tiers['low']['precision'] == 0.0


def test_gate_requires_high_tier_at_or_above_threshold():
    assert gate({'high': {'n': 10, 'precision': 0.9}}) is True
    assert gate({'high': {'n': 10, 'precision': 0.8}}) is False
    assert gate({'high': {'n': 0, 'precision': 0.0}}) is False   # no evidence
    assert gate({}) is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest tests/test_vc_eval.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'vc_eval'`

- [ ] **Step 3: Implement `vc_eval.py`**

```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest tests/test_vc_eval.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `python3 -m pytest -q`
Expected: PASS (all tests green)

- [ ] **Step 6: Commit**

```bash
git add vc_eval.py tests/test_vc_eval.py
git commit -m "feat(valuechain): precision-by-tier eval + 0.85 gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Subagent contracts — collection + synthesis prompts

These two files ARE the deliverable of this task: the exact instructions the M1 subagents follow. No code/tests — verification is that both files exist and encode the schema and the hard rules from earlier tasks. Fold the directory creation into the writes.

**Files:**
- Create: `valuechain/prompts/collect.md`, `valuechain/prompts/synthesize.md`

- [ ] **Step 1: Write the collection contract**

Create `valuechain/prompts/collect.md`:

```markdown
# Evidence Collection Contract (one company per subagent)

You research ONE Indonesian listed company and write an evidence bundle.
You do NOT decide relationships — you only gather sourced text.

## Input
`{ticker, legal_name, aliases, sector}` (from `vc_targets.load_targets`).

## What to collect (most authoritative first)
1. **filing** — the company's latest annual report / financial statements.
   Find the note sections that NAME counterparties: related-party transactions
   (transaksi pihak berelasi), revenue/customer concentration (pelanggan >10%),
   material contracts / offtake agreements. `source_date` = report period-end.
2. **company_site** — the company's own clients / partners / customers / suppliers
   page, if one exists.
3. **news / search** — queries in Indonesian AND English:
   "<legal_name> pemasok", "<legal_name> pelanggan utama", "<legal_name> offtake",
   "<legal_name> supplier", "<legal_name> kontrak pasok", "<legal_name> customer".
   Prefer results published within the last 24 months. Record each result's
   publication date as `source_date` (null only if genuinely undeterminable).

## Rules
- Copy the VERBATIM sentence(s) that mention a supplier/customer into `text`.
  Do not paraphrase — the synthesis step needs a real quote.
- Every snippet MUST have a real `source_url`.
- `source_type` is one of: filing | company_site | news | search.
- Aim for 5–20 snippets. Empty is acceptable if nothing is found — do not invent.

## Output — write to `valuechain/evidence/<TICKER>.json`
{
  "ticker": "<TICKER>",
  "collected_date": "<YYYY-MM-DD>",
  "snippets": [
    {"source_url": "...", "source_type": "filing",
     "source_date": "2025-03-31", "text": "<verbatim sentence>"}
  ]
}

Validate your file with:
`python3 -c "import json,vc_schema as s; print(s.validate_bundle(json.load(open('valuechain/evidence/<TICKER>.json'))))"`
An empty list `[]` means valid.
```

- [ ] **Step 2: Write the synthesis contract**

Create `valuechain/prompts/synthesize.md`:

```markdown
# Edge Synthesis Contract (one company per subagent)

You convert ONE company's evidence bundle into value-chain edges.

## Input
`valuechain/evidence/<TICKER>.json` (produced by the collection contract).

## The one hard rule
Emit an edge ONLY if a VERBATIM quote in the evidence supports it.
No quote → no edge. You may use outside knowledge only to normalize a
counterparty's name, NEVER to assert a relationship.

## Per edge
- `counterparty` — the other company's name as written.
- `direction` — `supplier` (flows INTO this company) or `customer` (flows OUT).
- `flow` — short phrase for what moves (e.g. "thermal coal offtake").
- `evidence_quote` — the verbatim supporting sentence from a snippet.
- `source_url`, `source_type`, `source_date` — copied from that snippet.
- `confidence`:
  - `high` = explicit disclosure/contract (filing) or an unambiguous named contract.
  - `medium` = credible named news within the window.
  - `low` = single weak/inferred source, OR web evidence with no `source_date`.
- If multiple snippets support one edge, pick the SINGLE best: prefer filing >
  fresh news > undated. (Stale-only edges are dropped downstream — don't rely on them.)
- `counterparty_ticker`: leave `null` (assembly resolves it).
- `retrieved_date`: the bundle's `collected_date`.

## Output — write a list under `valuechain/edges/<TICKER>.json`
{
  "ticker": "<TICKER>",
  "company": "<legal_name>",
  "edges": [ { ...edge fields... } ]
}

Validate every edge with:
`python3 -c "import json,vc_schema as s; d=json.load(open('valuechain/edges/<TICKER>.json'));
print([e for x in d['edges'] for e in [s.validate_edge(x)] if e])"`
An empty list means all edges are valid.
```

- [ ] **Step 3: Verify both files exist**

Run: `ls valuechain/prompts/`
Expected: `collect.md  synthesize.md`

- [ ] **Step 4: Commit**

```bash
git add valuechain/prompts/collect.md valuechain/prompts/synthesize.md
git commit -m "docs(valuechain): subagent collection + synthesis contracts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Milestone-1 run — 10 companies, assemble, evaluate, record gate

This task produces the M1 deliverable. It is a runbook, not TDD: it drives the subagents and the CLIs built above, then records the result. Do NOT skip the human labeling step — the gate is meaningless without it.

**Files:**
- Produce: `valuechain/evidence/*.json`, `valuechain/edges/*.json`, `dashboard/public/value_chain_edges.json`, `valuechain/labels.json`, `valuechain/RESULTS.md`

**Interfaces:**
- Consumes everything above: `vc_targets`, the two prompt contracts, `vc_assemble.main`, `vc_eval.main`.

- [ ] **Step 1: Print the target list the run will use**

Run: `python3 -c "import json,vc_targets as t; print(json.dumps(t.load_targets(), ensure_ascii=False, indent=1))"`
Expected: 10 objects, tickers `ADRO … JPFA`, each with non-empty `legal_name`, `aliases`, `sector`.

- [ ] **Step 2: Dispatch collection subagents (use superpowers:dispatching-parallel-agents)**

For each of the 10 targets, dispatch one subagent whose task is the contents of
`valuechain/prompts/collect.md` with `<TICKER>` and the target dict substituted in.
Each subagent has WebSearch/WebFetch, researches its one company, and writes
`valuechain/evidence/<TICKER>.json`.

- [ ] **Step 3: Validate all evidence bundles**

Run:
```bash
python3 -c "
import json, glob, vc_schema as s
bad = {f: s.validate_bundle(json.load(open(f))) for f in glob.glob('valuechain/evidence/*.json')}
bad = {f: e for f, e in bad.items() if e}
print('INVALID:', bad if bad else 'none')"
```
Expected: `INVALID: none`. Fix any flagged bundle before proceeding.

- [ ] **Step 4: Dispatch synthesis subagents**

For each ticker with an evidence bundle, dispatch one subagent whose task is the
contents of `valuechain/prompts/synthesize.md`. Each reads its bundle and writes
`valuechain/edges/<TICKER>.json`.

- [ ] **Step 5: Validate all edge files**

Run:
```bash
python3 -c "
import json, glob, vc_schema as s
issues = {}
for f in glob.glob('valuechain/edges/*.json'):
    d = json.load(open(f))
    errs = [s.validate_edge(e) for e in d['edges']]
    errs = [e for e in errs if e]
    if errs: issues[f] = errs
print('INVALID:', issues if issues else 'none')"
```
Expected: `INVALID: none`.

- [ ] **Step 6: Assemble the artifact**

Run: `python3 vc_assemble.py`
Expected: `wrote dashboard/public/value_chain_edges.json  (N parents, M edges)` with N up to 10.

- [ ] **Step 7: Emit the label template**

Run: `python3 vc_eval.py`
Expected: `wrote label template with M edges to valuechain/labels.json`.

- [ ] **Step 8: Human labels each edge**

Open `valuechain/labels.json`. For each edge id, cross-check the edge's
`evidence_quote` and `source_url` in `value_chain_edges.json` and set the value to
`true` (relationship real AND direction correct) or `false`. This is the human
judgment the gate depends on — do not auto-fill.

- [ ] **Step 9: Compute precision + gate**

Run: `python3 vc_eval.py`
Expected: a per-tier precision table and a `GATE (high precision >= 85%): PASS/FAIL` line.

- [ ] **Step 10: Record results and decision**

Create `valuechain/RESULTS.md` with: the date, the 10 tickers, edge counts per tier,
the precision table from Step 9, the gate outcome, and a one-paragraph decision —
either "proceed to 738 batch" or the specific prompt/source changes to try before a
re-run. Note any company that produced zero edges and why (genuinely undisclosed vs.
collection gap).

- [ ] **Step 11: Commit the M1 run**

```bash
git add valuechain/evidence valuechain/edges valuechain/labels.json valuechain/RESULTS.md dashboard/public/value_chain_edges.json
git commit -m "feat(valuechain): milestone-1 run over 10 seed companies + precision gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Five modules (vc_targets, vc_collect contract, vc_synthesize contract, vc_assemble, vc_eval) → Tasks 1, 6, 6, 4, 5. ✓
- Edge schema → Task 2 + used throughout. ✓
- Recency rules (24-month window, filings exempt, undated→low, stale→drop) → Task 3, tested. ✓
- Counterparty→ticker resolution → Task 4. ✓
- Precision gate ≥ 0.85 on high tier → Task 5 + Task 7 Step 9. ✓
- M1 = 10 companies via subagents, no API keys → Tasks 6–7. ✓
- Static artifact the dashboard reads → Task 4 writes `dashboard/public/value_chain_edges.json`. ✓
- Dashboard rendering by confidence tier is **out of scope for this plan** (M1 deliverable is the dataset + gate; the spec's "renders as edge weight" is a downstream integration, correctly deferred).

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output. ✓

**Type consistency:** `normalize_name` (vc_names) reused by vc_targets/vc_assemble/vc_eval; `apply_freshness` signature identical between Task 3 definition and Task 4 use; edge field names identical between Task 2 `EDGE_FIELDS`, the freshness tests, assemble, and the contracts. ✓
```
