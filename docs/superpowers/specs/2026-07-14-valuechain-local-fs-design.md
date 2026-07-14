# Local-FS Value-Chain Pipeline + Reciprocity — Design

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan
**Builds on:** the M1 external value-chain pipeline (`vc_*.py`, edge schema, gate)

## Problem

The M1 pipeline sourced filing evidence by having subagents web-fetch each company's
report — slow, non-deterministic, incomplete, and one report per company. Meanwhile
the user has **local financial statements for all 738 tickers** at
`/Users/67620/scrap_sector/scrap_idx/laporan_keuangan/FinancialStatement-2026-I-<TICKER>.pdf`
— digitally text-extractable (pdfplumber), XBRL-tagged, containing the related-party
notes that produced M1's best edges.

Two upgrades follow:
1. Replace web collection of filings with **deterministic local extraction** — free,
   complete (738/738), reproducible.
2. Exploit **edge reciprocity**: an "A → customer B" edge is also "B ← supplier A".
   Deriving the reverse fills the suppliers-only / customers-only asymmetry using
   *other* companies' disclosures.

## Scope (this build)

- **Extract all 738** local FS → evidence bundles (deterministic, free).
- **Synthesize ~25** companies via Claude Code subagents (the original M1 ten +
  fifteen chosen to create inter-company links): ADRO, UNTR, ASII, SMGR, INTP, TLKM,
  TAPG, PGAS, WIKA, JPFA, **PTBA, ITMG, ANTM, ADHI, PTPP, WSKT, WTON, WSBP, SMAR, AALI,
  INDF, ICBP, CPIN, MEDC, UNVR**.
- **Assemble with reciprocity** + gate + compare the overlapping 10 vs M1.
- The remaining 713 bundles wait for a later batch-synthesis-engine decision.

Interim-FS notes are thinner than annual — this validates the *local-FS approach*,
not final coverage. Annual FS + prospektus are later layers.

## Reuse (unchanged)

`vc_schema` (edge/bundle validators), `vc_freshness` (filings exempt from the
window; `source_date` = period end), `vc_eval` (precision gate), and the
`valuechain/prompts/synthesize.md` contract. The edge schema and 0.85 gate are
identical.

## New / changed modules

### `vc_extract_filing.py` (new, deterministic)

- Input: a ticker (+ the FS directory path, configurable).
- Opens `FinancialStatement-2026-I-<TICKER>.pdf` with **pdfplumber**.
- Locates the counterparty-bearing note sections:
  - **related-party** — pages matching `berelasi` / `related part` (transaksi pihak
    berelasi); this is the primary source.
  - **revenue/customer concentration** — pages matching `konsentrasi` + `pelanggan` /
    `customer` / `10%`.
- Emits an evidence bundle to `valuechain/evidence/<TICKER>.json`:
  - `snippets`: the extracted note-section text, one snippet per detected
    page/sub-section, each `{ source_url, source_type: 'filing', source_date:
    '2026-03-31', text }`.
  - `source_url`: the IDX filing reference for the ticker (constructed, stable).
- Testable seam: the section-selection + snippet-building logic is pure over
  already-extracted page text (a `select_note_pages(pages_text) -> [snippet]`
  function), tested with synthetic bilingual page text. The pdfplumber open/read is a
  thin I/O wrapper around it.
- CLI: `python3 vc_extract_filing.py [TICKER ...]` (default: all 738) → writes bundles,
  prints per-ticker page-hit counts and a summary (how many tickers yielded a
  related-party section, how many empty).

### `vc_assemble.py` (extend with reciprocity)

After the existing freshness → dedupe → resolve pipeline, add a **reciprocity pass**:

- For every kept edge `A --(dir)--> B` whose counterparty resolves to a tracked ticker
  `B`, add to `B` a **derived** reverse edge:
  - a `customer` edge from A (A sells to B) → B gains a `supplier` edge naming A;
  - a `supplier` edge into A (A buys from B... i.e. B supplies A) → B gains a
    `customer` edge naming A.
  - The derived edge copies A's `evidence_quote`, `source_url`, `source_type`,
    `source_date`, `confidence`, and adds `derived: true, via: "<A ticker>"`.
- Derived edges are **deduped against real edges** (a relationship both parties
  disclose keeps the real one, not the derived duplicate) and against each other.
- `derived` defaults to absent/false on normally-synthesized edges — additive,
  backward-compatible with the existing schema and dashboard consumers.

### `vc_schema.py` (tiny addition)

`validate_edge` accepts the optional `derived` (bool) and `via` (string) fields; they
are not required and their absence is valid. No other change.

## Flow

```
vc_extract_filing.py  (738 local PDFs → 738 evidence bundles, deterministic)
        │
        ▼  (subagents, 25 tickers)
vc_synthesize (Claude Code)  → valuechain/edges/<TICKER>.json
        │
        ▼
vc_assemble.py  (freshness → dedupe → resolve → RECIPROCITY)  → value_chain_edges.json
        │
        ▼
vc_eval.py  gate  +  compare the 10 overlapping tickers vs M1 RESULTS.md
```

## Testing

- **TDD (pytest):**
  - `vc_extract_filing.select_note_pages`: picks related-party + concentration pages
    from synthetic page text; ignores unrelated pages; empty input → empty.
  - `vc_assemble` reciprocity: an A→customer→B (B tracked) yields a derived
    B→supplier→A tagged `derived/via`; real edge wins over a derived duplicate;
    derived edge not created when B is unlisted.
  - `vc_schema`: an edge with `derived/via` validates; without them still valid.
- **Runbook (not TDD):** extract 738, synthesize the 25 via subagents, assemble, run
  the gate, and hand-compare the overlapping 10 against `valuechain/RESULTS.md`.
- The pdfplumber PDF read itself is exercised by the runbook (real files), not unit
  tests.

## Milestone deliverable

- `vc_extract_filing.py` + 738 evidence bundles.
- `value_chain_edges.json` regenerated for the 25 sample (with reciprocity).
- `valuechain/RESULTS-localfs.md`: gate result, reciprocity edge counts, and a
  side-by-side of the 10 overlapping tickers (local-FS vs M1 web) — does local FS
  match or beat the web-sourced edges? Decision on scaling to the full 738.

## Out of scope (YAGNI)

- Batch synthesis engine / paid API for the other 713 (gated on this sample).
- Annual (Tahunan) FS and prospektus sourcing (later layers).
- Dashboard changes — the new `derived`/`via` fields are additive; a later dashboard
  pass can badge "diungkap oleh mitra" (disclosed by partner). Not this build.
- OCR (these interim FS are digital text).
