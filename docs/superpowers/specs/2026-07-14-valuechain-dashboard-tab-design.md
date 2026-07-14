# Value-Chain Dashboard Views — Design

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan
**Depends on:** `dashboard/public/value_chain_edges.json` (produced by the M1 pipeline)

## Problem

The M1 pipeline produced `value_chain_edges.json` (85 cited supplier/buyer edges for
10 companies), but no dashboard view reads it. The existing "Rantai Pasok" (Supply
Chain) tab renders only hardcoded demo data (`SUPPLY_CHAIN_DATA`), so the real,
source-cited value chains are invisible in the UI.

Build two views that consume the real data.

## Why static JSON, not a database (decision)

The dashboard is a static Netlify SPA that `fetch()`es JSON from `public/`. The
value-chain data is **batch-produced offline and read-only at runtime**, and even the
full 738-company batch is ~10-20k edges (a few MB) — well within what ships and loads
in-browser. A database (esp. a graph DB like Neo4j, already prototyped in
`HubunganTab`) earns its keep only when interactive multi-hop traversal across the
whole universe, 100k+ elements, or live writes are required. **Decision: static JSON
now**, behind a thin data-access module so a future Neo4j/Supabase swap is localized
to that one module.

## Architecture

### Shared data layer — `src/lib/valueChain.js` (new, unit-tested)

The single seam between the file format and both views. If the source later becomes a
database, only this module changes.

- `loadEdges()` → `fetch('./value_chain_edges.json').then(r => r.json())`. Returns the
  raw doc `{ ticker: { company, edges: [...] } }`.
- `buildGraph(doc)` → `{ nodes, links }` for the whole-network view.
  - **nodes:** one per parent ticker + one per distinct counterparty (deduped by
    `counterparty_ticker` when present, else by normalized counterparty name). Each
    node: `{ id, label, ticker|null, kind: 'parent'|'listed'|'external' }`.
    `kind='parent'` for the 10 seeds; `'listed'` when the counterparty resolves to a
    ticker; `'external'` otherwise.
  - **links:** one per edge, oriented as physical flow:
    - `direction='supplier'` → `{ source: counterpartyNodeId, target: parentNodeId }`
      (goods flow INTO the parent)
    - `direction='customer'` → `{ source: parentNodeId, target: counterpartyNodeId }`
    - each link carries `{ confidence, flow, evidence_quote, source_url, source_type,
      source_date }` for the citation panel.
- `buildEgoView(doc, ticker)` → `{ company, ticker, suppliers, customers }` in the
  shape the Supply Chain tab renders (see Deliverable 2). Returns `null` if the ticker
  is absent from the doc.
- `focusOptions(doc, demoKeys)` → ordered list of `{ ticker, label, source:
  'filings'|'curated' }` — the union of real tickers (source `'filings'`) and any
  demo-only companies (source `'curated'`), real winning on overlap.

### Deliverable 1 — new "Rantai Nilai" tab (`src/ValueChainTab.jsx`, matching the existing flat tab convention)

Whole-network force-directed graph.

- Registered in `App.jsx`: sidebar button + `activeTab === 'nilai'`, following the
  existing tab pattern (`MapTab`/`HubunganTab` wiring).
- Renders `buildGraph(doc)` with the **same force-simulation + pan/zoom approach as
  `HubunganTab`**, reusing `GraphLink.jsx` and the tested `lib/graphEdges.js` geometry
  helpers. `HubunganTab`/`RantaiPasokTab` themselves are NOT modified or refactored.
- **Node styling:** `parent` largest, `listed` medium (shows ticker), `external`
  small. Listed counterparties are the connectors that stitch parents together
  (e.g. SMGR→WTON, UNTR→ASII).
- **Edge styling by confidence:** `high` solid/opaque/thicker, `medium` lighter,
  `low` thin/dashed/faded — via `GraphLink`.
- **Confidence filter:** toggles for high/medium/low (default all on).
- **Citation panel (core feature):** clicking an edge opens a panel with the flow,
  confidence, the **verbatim `evidence_quote`**, and a clickable `source_url`.
  Clicking a node lists its inbound (supplier) and outbound (customer) edges.
- Loading / empty / error states.

### Deliverable 2 — Supply Chain tab, real-data-driven with demo fallback

`RantaiPasokTab.jsx` renders `buildEgoView` output; curated demos become fallback.

- The focus selector is populated by `focusOptions(doc, demoKeys)`:
  - the 10 real tickers (badge **"Dari Laporan"** / from filings), **plus**
  - any demo-only company still in `SUPPLY_CHAIN_DATA` (badge **"Contoh"** / curated),
    e.g. **INDF**, which we have not collected.
  - On overlap (UNTR/ADRO/WIKA/ASII) the **real data wins**.
- For a real focus, `buildEgoView(doc, ticker)` maps edges to the existing card shape:
  - `direction='supplier'` → a supplier card; `direction='customer'` → a customer card.
  - card **description** = the verbatim `evidence_quote`;
  - card **relevance/relationType** = the `confidence` tier;
  - a clickable **source link** (`source_url`) on each card.
  - **Fallback fields** the curated demos have but real data lacks: `logo` = first
    letter of counterparty; `color` = derived from confidence tier; `keyProducts` =
    `[flow]`; `share%` = omitted (no revenue split available). Rendering must not break
    when these are absent/derived.
- The existing company-centered layout/renderer is reused; the hardcoded
  `SUPPLY_CHAIN_DATA` is retained ONLY as the curated fallback source, not the primary.

## Testing

- **Vitest** on `lib/valueChain.js` (the project already uses vitest):
  - `buildGraph`: node dedup (same counterparty across parents = one node), correct
    `kind` assignment, correct link orientation per `direction`, links carry citation
    fields.
  - `buildEgoView`: supplier/customer partitioning, evidence_quote → description,
    confidence → relevance, `null` for an unknown ticker.
  - `focusOptions`: union ordering, real-wins-on-overlap, demo-only retained with
    correct `source` badge.
- Rendering reuses already-tested `graphEdges.js`; the tabs themselves are exercised
  by the existing production build + a manual smoke check.

## Scope / YAGNI

- **In:** the two views, the shared data layer, confidence styling + filter, citation
  panel, demo-fallback merge.
- **Out:** editing the graph, writing back to the file, a database backend, multi-hop
  traversal UI, collecting new companies (INDF etc. stay demo-only until pipelined),
  revenue-share numbers (not in the data).

## Consequences (accepted)

- For the 4 overlapping companies, the hand-written demo prose is replaced by
  source-cited (thinner) real cards; INDF and any other demo-only company keep their
  curated cards as fallback.
- The graph shows only the 10 collected companies today; it grows automatically as
  more companies are pipelined.
