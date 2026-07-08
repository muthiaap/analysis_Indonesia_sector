# Design: Real companies on the map + enriched supply chain

**Date:** 2026-07-08
**Status:** Approved for planning
**Author:** muthiaap + Claude

## Summary

Two improvements to the Indonesia sector dashboard:

1. **Regional map (MapTab + DeepDiveTab):** Surface *real companies from Google
   Maps* per province/sector — not just the ~958 IDX-listed emiten. Using the
   Bali POI data already present in Supabase, clicking a province shows real
   company counts per sector and, when a sector is clicked, the list of company
   names for that sector.
2. **Supply chain (RantaiPasokTab):** Enrich the existing curated companies
   (deeper upstream/downstream nodes, refreshed figures), starting with a first
   batch of 5, authored during implementation.

Scrapers and schedulers are **intentionally deferred** to a documented "phase 2"
that we build only when the user needs broader coverage.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Map data source | Google Maps businesses (existing Supabase `pois_data`) |
| Build scraper now? | **No** — use existing Bali POI data; scraper is phase 2 |
| Map scope to start | **Bali, top-5 PDRB sectors only** |
| Emiten metric | **Keep as secondary toggle**, add "Perusahaan (Google Maps)" as primary |
| Supply chain approach | **Enrich existing curated companies**, batch of 5 first |
| Who generates supply chain | **Claude, during implementation** (no API key) |
| Build Gemini pipeline now? | **No** — phase 2 |
| Storage | Reuse existing Supabase (reads only for now); no new tables required for MVP |
| Scheduler | Local cron — **phase 2 only** |

## Current architecture (as-is)

- **Dashboard:** React + Vite + Leaflet + Recharts, deployed to Netlify.
- **MapTab.jsx** and **DeepDiveTab.jsx** each render a Leaflet choropleth of 38
  provinces. Metric toggle today: `emiten` (958 listed companies) vs `pdrb`.
  On province click they fetch `pois_data` from Supabase (bbox + point-in-polygon
  filter), map each POI to a PDB sector via `gmaps_category_mapping.json`, and
  render H3 hexagons + a POI drill-down list.
- **RantaiPasokTab.jsx** exports a hardcoded `SUPPLY_CHAIN_DATA` object (~15
  companies, rich Indonesian prose). It is imported by **PdbTab.jsx** and
  **DeepDiveTab.jsx** as well.
- Supabase table `pois_data` columns used: `poi_id, poi_name, sector, category,
  latitude, longitude, h3_index, address, rating, rating_count, gmaps_url,
  merchant_bank_name`. **Bali data already present.**

## Feature 1 — Real companies on the map

### Data source
Use the existing `pois_data` for Bali. No scraping in this phase. POIs are
Google Maps *establishments* (branches/locations), not legal entities — so a
"company" here means a prominent establishment. Chain branches are deduped by
normalized name so e.g. "Bank BCA" appears once.

### Behavior
- **Metric toggle** gains a primary option **`🏢 Perusahaan (Google Maps)`**.
  `🏢 Emiten Publik` becomes the **secondary** toggle (retained, not removed).
  `📈 PDRB` unchanged.
- On selecting **Bali** (any province with cached POIs), the popup's sector
  bubbles and counts are computed **live from the already-fetched POIs**:
  group POIs by PDB sector (via `gmaps_category_mapping.json`), restrict to the
  province's **top-5 PDRB sectors**, and count deduped-by-name companies per
  sector.
- **Clicking a sector bubble** shows, in the side panel, the **list of company
  names** for that province+sector: deduped by normalized name, ranked by
  `rating_count` (review count) descending, each showing name, category, rating,
  review count, and Google Maps link.
- Applies identically to **MapTab.jsx** and **DeepDiveTab.jsx** (shared logic
  extracted into a small helper module to avoid duplicating it in both files).

### Choropleth coloring
- In `emiten` and `pdrb` modes: unchanged.
- In `perusahaan` mode: color provinces by cached real-company count **where we
  have it** (Bali). Counts for coloring are obtained via lightweight Supabase
  `count` (head) queries per province bbox+sector, cached in component state.
  Provinces with no cached POI data render as "no data" (neutral gray) with a
  tooltip explaining they are not yet scraped. This keeps the national map honest
  until phase-2 scraping fills it in.

### Shared helper (new)
`dashboard/src/lib/companyPois.js`:
- `poisToSectorCounts(pois, categoryMapping, allowedSectors)` → `[{sector, count}]`
- `topCompaniesForSector(pois, categoryMapping, sector)` → deduped, ranked list
- `normalizeCompanyName(name)` for dedup
These are pure functions, unit-testable, consumed by both map tabs.

## Feature 2 — Supply chain enrichment

### Scope
Enrich the existing curated entries in `SUPPLY_CHAIN_DATA`, **first batch of 5**
(most prominent: UNTR, ASII, BBRI, ADRO, WIKA). Enrichment means, per company:
- Refresh headline figures (revenue / net income / employees) to the latest
  known fiscal year.
- Add 1–2 additional upstream and/or downstream nodes where materially relevant.
- Deepen node descriptions and fill any missing schema fields.
- Keep entries **verified/curated** (no "unverified" badge — these are reviewed
  by the user). Add a `lastEnriched: "2026-07-08"` marker per enriched entry.

The remaining 10 curated companies can be enriched in later batches using the
same pattern.

### Structure
New enriched content is authored directly into `SUPPLY_CHAIN_DATA` (or a merged
companion object) preserving the exact existing schema
(`name, ticker, sector, subSector, overview, revenue, netIncome, employeeCount,
headquarters, upstream[], internal[], downstream[]`), so PdbTab, DeepDiveTab, and
RantaiPasokTab keep working with no consumer changes.

### UI
No structural UI change required for enrichment. If a `lastEnriched` marker is
present, RantaiPasokTab may show a subtle "diperbarui 2026-07-08" chip (optional,
low priority).

## Phase 2 — deferred, documented only (NOT built in this iteration)

Recorded so we can turn it on later without re-deciding:

1. **Google Maps scraper** (`scraper/scrape_maps.py`, Python + Playwright, free
   self-scraping — accepted ToS risk; rate-limited, backoff, resumable). Writes
   detailed rows to `pois_data` (adding a `province` column) and a precomputed
   `company_sector_summary(province, sector, company_count, top_companies jsonb)`
   table for a fast national choropleth. Job queue in `scrape_jobs`, Bali first,
   then province-by-province.
2. **Gemini supply-chain generator** (`scraper/generate_supplychain.py`, Python +
   Gemini free tier with Search grounding). Generates all ~900 listed companies
   into a new Supabase `supply_chain(ticker, data jsonb, verified, generated_at)`
   table, largest-first, published with an "AI-generated · unverified" badge, and
   a shared `dashboard/src/supplyChainData.js` loader replacing the hardcoded
   import across the 4 consumers.
3. **Local cron scheduling** with `scraper/run_*.sh` wrappers logging to
   `scraper/logs/*.log`, viewable via `tail -f`.

Prerequisites to activate phase 2: a Gemini API key (free, aistudio.google.com)
and a Supabase service-role key (for writes) + creating the new tables.

## Testing

- Unit tests for `companyPois.js` pure helpers (counts, dedup, ranking) with
  synthetic POI fixtures.
- Manual verification: run the dashboard locally, open the Map tab, confirm Bali
  shows real company counts per top-5 sector and clicking a sector lists company
  names. Repeat on the Deep Dive map.
- Supply chain: confirm the 5 enriched companies render correctly in
  RantaiPasokTab, PdbTab, and DeepDiveTab with no console errors.

## Out of scope

- Scraping any province other than Bali (phase 2).
- National real-company choropleth for all 38 provinces (phase 2).
- Auto-generating supply chain for non-curated companies (phase 2).
- Changing the PDRB / emiten data pipelines.
