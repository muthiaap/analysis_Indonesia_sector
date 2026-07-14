# External Value-Chain Edge Discovery — Design

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan
**Sibling of:** `enrich_subsidiaries.py`

## Problem

Today the project infers a company's **internal** value chain — which stages it
occupies — by keyword-classifying its own subsidiary list (`enrich_subsidiaries.py`).
It says nothing about **external** relationships: who *supplies* a listed company and
who *buys* from it.

We want to automatically discover those external supplier/buyer edges across the
listed universe (738 tickers in `anak_perusahaan.json`) and feed them into the
existing relationship graph (Hubungan / RantaiPasok tabs).

### Honest constraints (accepted going in)

- External supplier/customer links are **only fragmentarily disclosed** by Indonesian
  issuers — mainly related-party transactions, major-customer (>10% revenue) notes,
  and occasional offtake/material-contract disclosures. The rest must come from news,
  IDX disclosures, and company sites, with inference.
- Coverage will therefore be **partial and uneven** — strong for contract-heavy
  large caps (mining offtakes, cement, telco, plantation CPO), thin for the long tail.
  **Partial + cited + honest beats complete + fabricated.**
- The LLM must never assert a relationship it cannot cite. It only summarizes evidence
  the collector actually retrieved.

## Approach

**Layered hybrid, proven on 10 companies before any batch.**

Deterministic Python collects **evidence**; Claude turns evidence into **cited,
confidence-scored edges**; deterministic Python assembles and scores. Output is a
static `dashboard/public/value_chain_edges.json` the dashboard reads — the same
static-artifact pattern as `enrich_subsidiaries.py`.

Milestone 1 exists to **measure precision before spending on a 738 batch.** If the
proof run clears the gate, scale; otherwise iterate prompts/sources.

## Architecture

```
vc_targets.py ─▶ target list (10 for M1, 738 later)
                    │
                    ▼
vc_collect  ─▶ per-company evidence bundle   (deterministic sources +
   (subagents in M1)   {snippet, source_url, source_type, source_date}
                    │
                    ▼
vc_synthesize (Claude) ─▶ cited edges  (quote-backed only)
                    │
                    ▼
vc_assemble.py ─▶ merge, dedupe, resolve counterparty→ticker
                    │                       ─▶ value_chain_edges.json
                    ▼
vc_eval.py    ─▶ hand-labeled precision report + go/no-go gate
```

### Modules (each independently testable)

**1. `vc_targets.py`** — selects targets from `anak_perusahaan.json` joined to sector
from `all_lk.csv`; emits `{ticker, legal_name, aliases, sector}`. `aliases` includes
the `PT …` legal form and common short names so the collector and counterparty
resolver can match mentions.

Milestone-1 seed (contract-heavy, well-disclosed, across sectors — test where signal
exists): **ADRO, UNTR, ASII, SMGR, INTP, TLKM, TAPG, PGAS, WIKA, JPFA**
(coal, heavy-equipment, auto/conglomerate, cement×2, telco, palm, gas, construction,
poultry).

**2. `vc_collect`** — three evidence sources, each snippet tagged with `source_url`,
`source_type`, and `source_date`:

- *filing* (`source_type: filing`) — the **latest available** annual-report PDF
  (IDX / company IR). Isolate the note sections that actually name counterparties:
  related-party transactions (transaksi pihak berelasi), revenue/customer
  concentration, material contracts. Exempt from the freshness window but must be the
  newest report.
- *web* (`source_type: news` / `search`) — queries in Indonesian + English
  ("PT X pemasok / pelanggan utama / offtake / supplier / kontrak pasok / customer"),
  fetch and clean top-N result pages. **Date-restricted** (see Recency below).
- *site* (`source_type: company_site`) — the company's own
  "clients / partners / customers / suppliers" page if one exists.

**Milestone 1 runs `vc_collect` via Claude Code subagents** (WebSearch / WebFetch),
one subagent per company, each writing an evidence-bundle JSON to disk. No search-API
or LLM API key is wired up yet — that decision waits for the gate.

**3. `vc_synthesize`** (the Claude contract) — input: one company's evidence bundle;
output: edges. **Hard rule: emit an edge only if a verbatim quote in the evidence
supports it.** No quote → no edge. Each edge selects the single best quote, its source,
direction, `source_date`, and a confidence tier. The prompt forbids using outside
knowledge to assert edges (outside knowledge may only *normalize a name*, never create
an edge).

**4. `vc_assemble.py`** — merges per-company edges, dedupes counterparties (name
normalization), and **resolves counterparties back to the 738-ticker universe** where
the counterparty is itself listed (`counterparty_ticker`), turning isolated edges into
an inter-company graph. Writes `value_chain_edges.json`.

**5. `vc_eval.py`** — loads a hand-labeled file of the emitted edges and computes
**precision** (fraction true AND correctly-directed) split by confidence tier, plus a
qualitative recall note (obvious known edges missed). Prints a go/no-go **gate report**.

## Edge schema

```json
{
  "counterparty": "PT PLN (Persero)",
  "counterparty_ticker": null,
  "direction": "customer",
  "flow": "thermal coal offtake",
  "confidence": "high",
  "evidence_quote": "…perusahaan memasok batubara ke PLN…",
  "source_url": "https://…",
  "source_type": "filing",
  "source_date": "2025-03-31",
  "retrieved_date": "2026-07-14"
}
```

- `direction`: `supplier` (flows *into* the company) | `customer` (flows *out*).
- `confidence`: **high** = explicit disclosure/contract; **medium** = credible named
  news; **low** = single weak/inferred source, or web evidence with no determinable date.
- The dashboard renders `confidence` as edge weight/opacity, reusing the Neo4j-style
  edge styling already built (`GraphLink.jsx`).

## Recency (freshness) rules

A supplier/buyer edge must not rest on stale evidence.

- **Freshness window:** configurable, **default 24 months**. For a run dated
  2026-07-14, web/news evidence published before ~2024-07 is out of window.
- **Web/news evidence** must carry a `source_date`. Queries are date-restricted where
  the search tool allows it; retrieved pages are checked for a publication date.
- **Undated web evidence** is not silently trusted — an edge supported only by undated
  web evidence is capped at **low** confidence.
- **Filings** are exempt from the window (a contract named in the latest annual report
  is valid signal) but must be the newest available report; `source_date` = the
  report's period-end date.
- **Edge disposition:**
  - only-stale support → **drop the edge**.
  - fresh + stale support → keep the fresh quote; the stale one is discarded.
  - filing + web support → prefer the filing quote; confidence may rise to high.

## Testing

- **TDD** on deterministic parts: name normalization, note-section extraction, edge
  dedup, counterparty→ticker resolution, confidence-tier rules, and the freshness
  window filter (dates in/out of window, undated → capped low, only-stale → dropped).
- The **LLM synthesis** step is judged by `vc_eval.py` precision, not unit tests.
- **Go/no-go gate:** proceed to the 738 batch only if high-confidence precision
  **≥ 85%** on the 10-company proof (threshold tunable after seeing M1 numbers).

## Milestone 1 deliverable

`value_chain_edges.json` for the 10 seed companies + a hand-scored `vc_eval.py`
precision report, split by confidence tier, with the batch decision recorded.

## Out of scope (YAGNI for now)

- The 738-company batch itself and any paid search-API / batch-LLM wiring — gated on
  M1 precision.
- Customs/import-export trade-data ingestion.
- Whole-market (sector-level) sweeps not tied to the ticker universe.
- Real-time / scheduled refresh.
```
