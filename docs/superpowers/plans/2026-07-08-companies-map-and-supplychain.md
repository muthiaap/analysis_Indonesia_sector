# Real-Companies Map + Supply-Chain Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both dashboard maps show real Google-Maps company counts and names per province/sector (Bali, top-5 sectors) using existing Supabase POI data, and enrich 5 curated supply-chain companies.

**Architecture:** Extract pure POI→company logic into a shared, unit-tested helper module. Wire both `MapTab.jsx` and `DeepDiveTab.jsx` to a new `perusahaan` metric mode that keeps PDRB-based choropleth coloring but surfaces real company counts (in tooltips/popup/bubbles) and a click-through company list. Enrich supply-chain content in place. No scraper, no scheduler, no new Supabase tables in this iteration.

**Tech Stack:** React 18, Vite 5, react-leaflet, Supabase JS (existing anon read), Vitest (new, for helper tests).

## Global Constraints

- Work inside `dashboard/` (the Vite app). All app paths below are relative to repo root.
- Do NOT remove the `emiten` metric — it becomes a secondary toggle.
- Choropleth coloring in `perusahaan` mode MUST use PDRB values (not company count).
- Company lists MUST dedupe by normalized name and rank by review count, default-capped to top 20 with a "show all" toggle.
- Restrict map company sectors to each province's **top-5 PDRB sectors** (`provStat.top5Sectors`).
- POI field names as mapped in the tabs today: `poi.name`, `poi.category`, `poi.pdbSector`, `poi.rating`, `poi.ratingCount`, `poi.gmapsUrl`.
- Supply-chain schema is unchanged; enriched entries stay `verified`/curated and gain `lastEnriched: "2026-07-08"`.
- Commit after every task.

---

### Task 1: Shared POI→company helper module (with tests)

**Files:**
- Create: `dashboard/src/lib/companyPois.js`
- Create: `dashboard/src/lib/companyPois.test.js`
- Modify: `dashboard/package.json` (add `vitest` devDependency + `test` script)
- Modify: `dashboard/vite.config.js` (add Vitest `test` config)

**Interfaces:**
- Produces:
  - `normalizeCompanyName(name: string) => string`
  - `dedupeCompanies(pois: POI[]) => Company[]` where `POI` has `{name, category, pdbSector, rating, ratingCount, gmapsUrl}` and `Company` = `{name, category, pdbSector, rating, ratingCount, gmapsUrl, locationCount}` (one per normalized name, keeping the highest-`ratingCount` representative; `locationCount` = number of merged POIs).
  - `poisToSectorCounts(pois: POI[], allowedSectors: string[]) => {sector, count}[]` (deduped company count per sector, restricted to `allowedSectors`, sorted count desc).
  - `topCompaniesForSector(pois: POI[], sector: string, limit = 20) => Company[]` (deduped companies in one sector, ranked by `ratingCount` desc, sliced to `limit`).

- [ ] **Step 1: Add Vitest to package.json**

In `dashboard/package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```
Add to `devDependencies`:
```json
"vitest": "^1.6.0"
```

- [ ] **Step 2: Configure Vitest in vite.config.js**

Replace `dashboard/vite.config.js` contents with:
```js
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
```
(If the existing file has extra options like `server` or `build`, keep them and only add the `test` block and the reference comment.)

- [ ] **Step 3: Install the new dep**

Run: `cd dashboard && npm install`
Expected: installs `vitest`, exits 0.

- [ ] **Step 4: Write the failing test**

Create `dashboard/src/lib/companyPois.test.js`:
```js
import { describe, it, expect } from 'vitest'
import {
  normalizeCompanyName,
  dedupeCompanies,
  poisToSectorCounts,
  topCompaniesForSector,
} from './companyPois'

const P = (over) => ({
  name: 'X', category: 'Hotel', pdbSector: 'Penyediaan Akomodasi dan Makan Minum',
  rating: '4.5', ratingCount: '100', gmapsUrl: 'http://g', ...over,
})

describe('normalizeCompanyName', () => {
  it('lowercases, trims, collapses whitespace', () => {
    expect(normalizeCompanyName('  Bank  BCA   ')).toBe('bank bca')
  })
  it('handles nullish', () => {
    expect(normalizeCompanyName(null)).toBe('')
  })
})

describe('dedupeCompanies', () => {
  it('merges same-name POIs keeping highest review count and counts locations', () => {
    const out = dedupeCompanies([
      P({ name: 'Bank BCA', ratingCount: '10' }),
      P({ name: 'bank bca', ratingCount: '250' }),
      P({ name: 'Warung A', ratingCount: '5' }),
    ])
    expect(out).toHaveLength(2)
    const bca = out.find((c) => c.name === 'bank bca' || c.name === 'Bank BCA')
    expect(bca.ratingCount).toBe(250)
    expect(bca.locationCount).toBe(2)
  })
  it('coerces missing/NULL ratingCount to 0', () => {
    const out = dedupeCompanies([P({ name: 'Z', ratingCount: 'NULL' })])
    expect(out[0].ratingCount).toBe(0)
  })
})

describe('poisToSectorCounts', () => {
  it('counts deduped companies per allowed sector, sorted desc', () => {
    const pois = [
      P({ name: 'Hotel 1', pdbSector: 'Penyediaan Akomodasi dan Makan Minum' }),
      P({ name: 'Hotel 1', pdbSector: 'Penyediaan Akomodasi dan Makan Minum' }),
      P({ name: 'Toko 1', pdbSector: 'Perdagangan Besar dan Eceran, Reparasi Mobil dan Sepeda Motor' }),
      P({ name: 'Sawah 1', pdbSector: 'Pertanian, Kehutanan dan Perikanan' }),
    ]
    const allowed = [
      'Penyediaan Akomodasi dan Makan Minum',
      'Perdagangan Besar dan Eceran, Reparasi Mobil dan Sepeda Motor',
    ]
    const out = poisToSectorCounts(pois, allowed)
    expect(out).toEqual([
      { sector: 'Penyediaan Akomodasi dan Makan Minum', count: 1 },
      { sector: 'Perdagangan Besar dan Eceran, Reparasi Mobil dan Sepeda Motor', count: 1 },
    ])
  })
})

describe('topCompaniesForSector', () => {
  it('returns deduped companies in sector ranked by reviews, capped', () => {
    const pois = [
      P({ name: 'A', ratingCount: '10' }),
      P({ name: 'B', ratingCount: '99' }),
      P({ name: 'C', ratingCount: '50' }),
    ]
    const out = topCompaniesForSector(pois, 'Penyediaan Akomodasi dan Makan Minum', 2)
    expect(out.map((c) => c.name)).toEqual(['B', 'C'])
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/lib/companyPois.test.js`
Expected: FAIL — cannot resolve `./companyPois`.

- [ ] **Step 6: Implement the helper**

Create `dashboard/src/lib/companyPois.js`:
```js
// Pure helpers turning Google-Maps POIs (from Supabase pois_data, already
// mapped to a PDB sector in MapTab/DeepDiveTab) into per-sector company counts
// and ranked company lists. POIs are business locations, not legal entities;
// we approximate "companies" by deduping same-named locations and ranking by
// review count.

export function normalizeCompanyName(name) {
  if (!name) return ''
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ')
}

function toCount(val) {
  if (val === null || val === undefined) return 0
  const s = String(val).trim()
  if (s === '' || s.toUpperCase() === 'NULL') return 0
  const n = parseInt(s.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export function dedupeCompanies(pois) {
  const byName = new Map()
  for (const poi of pois || []) {
    const key = normalizeCompanyName(poi.name)
    if (!key) continue
    const rc = toCount(poi.ratingCount)
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, {
        name: poi.name,
        category: poi.category,
        pdbSector: poi.pdbSector,
        rating: poi.rating,
        ratingCount: rc,
        gmapsUrl: poi.gmapsUrl,
        locationCount: 1,
      })
    } else {
      existing.locationCount += 1
      if (rc > existing.ratingCount) {
        existing.name = poi.name
        existing.category = poi.category
        existing.pdbSector = poi.pdbSector
        existing.rating = poi.rating
        existing.ratingCount = rc
        existing.gmapsUrl = poi.gmapsUrl
      }
    }
  }
  return Array.from(byName.values())
}

export function poisToSectorCounts(pois, allowedSectors) {
  const allow = new Set(allowedSectors || [])
  const companies = dedupeCompanies((pois || []).filter((p) => allow.has(p.pdbSector)))
  const counts = new Map()
  for (const c of companies) {
    counts.set(c.pdbSector, (counts.get(c.pdbSector) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
}

export function topCompaniesForSector(pois, sector, limit = 20) {
  const inSector = (pois || []).filter((p) => p.pdbSector === sector)
  return dedupeCompanies(inSector)
    .sort((a, b) => b.ratingCount - a.ratingCount)
    .slice(0, limit)
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/companyPois.test.js`
Expected: PASS (4 files/blocks, all green).

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/companyPois.js dashboard/src/lib/companyPois.test.js dashboard/package.json dashboard/vite.config.js dashboard/package-lock.json
git commit -m "feat(map): add tested POI->company helper module + vitest"
```

---

### Task 2: MapTab — add `perusahaan` metric mode (toggle + PDRB coloring)

**Files:**
- Modify: `dashboard/src/MapTab.jsx`

**Interfaces:**
- Consumes: none (self-contained state change).
- Produces: `mapMetric` can now be `'perusahaan' | 'emiten' | 'pdrb'`; `'perusahaan'` colors by PDRB.

- [ ] **Step 1: Default the metric to `perusahaan`**

In `dashboard/src/MapTab.jsx`, change the metric state initializer (currently `useState('emiten')` near line 304):
```js
const [mapMetric, setMapMetric] = useState('perusahaan')
```

- [ ] **Step 2: Make coloring treat `perusahaan` like `pdrb`**

In the `style` callback (near lines 752-781), replace the `count`/`maxVal` computation:
```js
      const name = feature.properties.PROVINSI
      const provStat = mapData?.provinceStats?.[name]
      const colorByCount = mapMetric === 'emiten'
      const count = colorByCount
        ? (provinceCounts[name] || 0)
        : getProvincePdrbValue(provStat, activeSingleSector)
      const maxVal = colorByCount ? maxCount : maxPdrb
      const scaleMode = colorByCount ? 'emiten' : 'pdrb'
```
Then in the returned style object, change the `fillColor` line to use `scaleMode`:
```js
        fillColor: getChoroplethColor(count, maxVal, scaleMode),
```

- [ ] **Step 3: Add the toggle button for `perusahaan` (first, primary)**

In the metric toggle group (the `<div className="flex items-center gap-0.5 bg-slate-150 ...">` near line 923), add this button as the FIRST child, before the existing `emiten` button:
```jsx
              <button
                type="button"
                onClick={() => setMapMetric('perusahaan')}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  mapMetric === 'perusahaan'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏢 Perusahaan (Google Maps)
              </button>
```

- [ ] **Step 4: Adjust the tooltip for `perusahaan` mode**

In `onEachFeature` (near lines 790-802), replace the `if (mapMetric === 'emiten') { ... } else { ... }` block with:
```js
      if (mapMetric === 'emiten') {
        tooltipContent = `<strong>${name}</strong><br/>🏢 ${count} emiten publik`
      } else if (mapMetric === 'perusahaan') {
        const pdrbVal = provStat?.pdrb
        const pdrbText = pdrbVal ? `${formatMoney(pdrbVal)} (${pdrbYear})` : '-'
        tooltipContent = `<strong>${name}</strong><br/>📈 PDRB: <strong>${pdrbText}</strong><br/>🏢 Klik untuk lihat perusahaan (Google Maps)`
      } else {
        if (activeSingleSector) {
          const pdrbVal = getProvincePdrbValue(provStat, activeSingleSector)
          tooltipContent = `<strong>${name}</strong><br/>📈 PDRB ${activeSingleSector}: <strong>${formatMoney(pdrbVal)}</strong>`
        } else {
          const pdrbVal = provStat?.pdrb
          const pdrbText = pdrbVal ? `${formatMoney(pdrbVal)} (${pdrbYear})` : '-'
          tooltipContent = `<strong>${name}</strong><br/>📈 PDRB Total: <strong>${pdrbText}</strong>`
        }
      }
```

- [ ] **Step 5: Verify in the browser**

Run: `cd dashboard && npm run dev`
Open the printed localhost URL → click the **Peta** tab. Expected:
- Three toggles now show: `🏢 Perusahaan (Google Maps)` (active by default), `🏢 Emiten Publik`, `📈 Nilai PDRB Total 2026`.
- In Perusahaan mode the provinces are colored by PDRB (same shading as the PDRB toggle), and hovering a province shows the PDRB + "Klik untuk lihat perusahaan" tooltip.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/MapTab.jsx
git commit -m "feat(map): add Perusahaan (Google Maps) metric mode, PDRB coloring"
```

---

### Task 3: MapTab — real company counts in popup + sector bubbles

**Files:**
- Modify: `dashboard/src/MapTab.jsx`

**Interfaces:**
- Consumes: `poisToSectorCounts`, `dedupeCompanies` from `./lib/companyPois`; existing `pois` state (already fetched + sector-mapped); `selectedProvStats.top5Sectors`.
- Produces: `companySectorBubbles` memo `{sector, count}[]`; `dedupedCompanyCount` number; new state `selectedCompanySector` (used by Task 4).

- [ ] **Step 1: Import the helpers**

At the top of `dashboard/src/MapTab.jsx`, after the existing imports, add:
```js
import { poisToSectorCounts, topCompaniesForSector, dedupeCompanies } from './lib/companyPois'
```

- [ ] **Step 2: Add state for the selected company sector**

Near the other `useState` hooks (around line 307), add:
```js
const [selectedCompanySector, setSelectedCompanySector] = useState(null)
```

- [ ] **Step 3: Compute the top-5 sector list and company bubbles/counts from POIs**

After the `provinceSectorBubbles` memo (ends ~line 682), add:
```js
  const top5SectorNames = useMemo(() => {
    if (!selectedProvStats?.top5Sectors) return []
    return selectedProvStats.top5Sectors.map(s => s.sector)
  }, [selectedProvStats])

  const companySectorBubbles = useMemo(
    () => poisToSectorCounts(pois, top5SectorNames),
    [pois, top5SectorNames]
  )

  const dedupedCompanyCount = useMemo(
    () => dedupeCompanies((pois || []).filter(p => top5SectorNames.includes(p.pdbSector))).length,
    [pois, top5SectorNames]
  )
```

- [ ] **Step 4: Reset the selected company sector when the province changes**

In the province `click` handler inside `onEachFeature` (near lines 811-819, where it calls `setProvinceSectorFilter(null)` etc.), add:
```js
          setSelectedCompanySector(null)
```

- [ ] **Step 5: Show the real company count in the popup summary**

In the popup summary block (near line 1032, the line rendering `🏢 Emiten Terdaftar`), replace that single `<div>` with a conditional so Perusahaan mode shows the Google-Maps count:
```jsx
                        {mapMetric === 'perusahaan' ? (
                          <div>🏢 Perusahaan (Google Maps): <strong className="text-slate-800">{dedupedCompanyCount}</strong></div>
                        ) : (
                          <div>🏢 Emiten Terdaftar: <strong className="text-slate-800">{provinceCompanies.length} emiten</strong></div>
                        )}
```

- [ ] **Step 6: Render company sector bubbles in Perusahaan mode**

In the popup, the bubbles container maps `provinceSectorBubbles` (near line 1040). Wrap the choice of data source so Perusahaan mode uses `companySectorBubbles` and clicking sets `selectedCompanySector`. Replace the label line (near line 1037, `PILAH EMITEN DI SEKTOR...`) and the `.map` source:

Change the label:
```jsx
                    <p className="text-[9px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">
                      {mapMetric === 'perusahaan' ? 'PERUSAHAAN PER SEKTOR (TOP 5 PDRB):' : 'PILAH EMITEN DI SEKTOR PDB / PDRB:'}
                    </p>
```
Change the map source and click behavior — replace `{provinceSectorBubbles.map(({ sector, count }) => {` and the `active`/`onClick` lines inside it with:
```jsx
                      {(mapMetric === 'perusahaan' ? companySectorBubbles : provinceSectorBubbles).map(({ sector, count }) => {
                        const active = mapMetric === 'perusahaan'
                          ? selectedCompanySector === sector
                          : provinceSectorFilter === sector
                        const style = getSectorColorStyle(sector)
                        return (
                          <button
                            key={sector}
                            type="button"
                            title={`${sector}: ${count}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (mapMetric === 'perusahaan') {
                                setSelectedCompanySector(prev => (prev === sector ? null : sector))
                              } else {
                                setProvinceSectorFilter(prev => (prev === sector ? null : sector))
                              }
                            }}
                            className={`rounded-full font-semibold text-[9px] px-2.5 py-1 shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer border bg-transparent ${
                              active
                                ? 'ring-2 ring-offset-1 ring-slate-800 scale-105 font-bold'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                            style={style}
                          >
                            {sector} ({count})
                          </button>
                        )
                      })}
```
(Delete the old `provinceSectorBubbles.map(...)` block that this replaces.)

- [ ] **Step 7: Verify in the browser**

With `npm run dev` running, on the Peta tab in Perusahaan mode, click **Bali**. Expected:
- Popup shows "🏢 Perusahaan (Google Maps): N" with N > 0.
- Sector bubbles show Bali's top-5 PDRB sectors with real company counts (e.g. Penyediaan Akomodasi dan Makan Minum (…)).
- Clicking a bubble highlights it (ring). Console shows the Supabase POI fetch logs, no errors.
- If Bali shows 0 companies, check the browser console for the POI fetch count — confirms whether Bali POIs exist in Supabase (see Task 5 verification note).

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/MapTab.jsx
git commit -m "feat(map): real company counts + sector bubbles from POIs in popup"
```

---

### Task 4: MapTab — company-name list panel on sector click

**Files:**
- Modify: `dashboard/src/MapTab.jsx`

**Interfaces:**
- Consumes: `topCompaniesForSector`, `pois`, `selectedCompanySector`, `selectedProvince`.
- Produces: a new side panel card listing companies; local `showAllCompanies` state.

- [ ] **Step 1: Add show-all state**

Near the other `useState` hooks, add:
```js
const [showAllCompanies, setShowAllCompanies] = useState(false)
```

- [ ] **Step 2: Compute the company list**

After the `dedupedCompanyCount` memo (Task 3 Step 3), add:
```js
  const companyListForSector = useMemo(() => {
    if (!selectedCompanySector) return []
    return topCompaniesForSector(pois, selectedCompanySector, showAllCompanies ? 1000 : 20)
  }, [pois, selectedCompanySector, showAllCompanies])
```
Also reset `showAllCompanies` whenever the selected sector changes — add to the province click handler (same spot as Task 3 Step 4):
```js
          setShowAllCompanies(false)
```

- [ ] **Step 3: Render the company list card**

In the left column, immediately AFTER the "Selected Hexagon Details Card" block (the `{selectedProvince && selectedHexagon && (...)}` block ending near line 1219), add a new sibling card:
```jsx
        {selectedProvince && mapMetric === 'perusahaan' && selectedCompanySector && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-3 shadow-sm">
            <div className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Building2 size={13} className="text-blue-500" />
                Perusahaan (Google Maps) — {selectedCompanySector}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCompanySector(null)}
                className="text-[9.5px] text-slate-500 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 border-none rounded-md px-2 py-0.5 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="text-[9px] text-slate-400">
              Menampilkan {companyListForSector.length} perusahaan paling menonjol (diurutkan berdasarkan jumlah ulasan). Data titik Google Maps, bukan entitas hukum.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
              {companyListForSector.map((c, i) => (
                <div key={`${c.name}-${i}`} className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 space-y-1">
                  <div className="font-extrabold text-slate-800 leading-snug" title={c.name}>{c.name}</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{c.category}</span>
                    {c.ratingCount > 0 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⭐ {c.rating} ({c.ratingCount})</span>
                    )}
                    {c.locationCount > 1 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 border border-blue-100">{c.locationCount} lokasi</span>
                    )}
                  </div>
                  {c.gmapsUrl && c.gmapsUrl !== 'NULL' && (
                    <a href={c.gmapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-blue-600 hover:text-blue-800 hover:underline text-[9px] font-extrabold">Buka Google Maps ↗</a>
                  )}
                </div>
              ))}
            </div>
            {!showAllCompanies && companyListForSector.length >= 20 && (
              <button
                type="button"
                onClick={() => setShowAllCompanies(true)}
                className="w-full text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-md py-1.5 cursor-pointer"
              >
                Tampilkan semua perusahaan
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 4: Verify in the browser**

With `npm run dev` running, Peta tab → Perusahaan mode → click Bali → click a sector bubble (e.g. Penyediaan Akomodasi dan Makan Minum). Expected:
- A "Perusahaan (Google Maps) — <sector>" card appears with up to 20 company cards (name, category, rating, "N lokasi" for chains, Google Maps link).
- If ≥20, a "Tampilkan semua perusahaan" button reveals the rest.
- Clicking "Tutup" closes the card. No console errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/MapTab.jsx
git commit -m "feat(map): company-name list panel on sector click (top 20 + show all)"
```

---

### Task 5: DeepDiveTab — mirror the map company features

**Files:**
- Modify: `dashboard/src/DeepDiveTab.jsx`

**Interfaces:**
- Consumes: same helpers from `./lib/companyPois`; DeepDiveTab's existing `pois` state and province selection.
- Produces: same company-count/list behavior on the Deep Dive map.

- [ ] **Step 1: Locate DeepDiveTab's map structures**

Run: `grep -nE "mapMetric|pois|top5Sectors|Popup|onEachFeature|provinceSectorBubbles|setMapMetric|useState" dashboard/src/DeepDiveTab.jsx`
Read the reported regions. DeepDiveTab uses the same react-leaflet + Supabase POI pattern as MapTab (confirmed: it fetches `pois_data`, maps to `pdbSector`, renders hexagons).

- [ ] **Step 2: Import the helpers**

At the top of `dashboard/src/DeepDiveTab.jsx`, add:
```js
import { poisToSectorCounts, topCompaniesForSector, dedupeCompanies } from './lib/companyPois'
```

- [ ] **Step 3: Apply the Task 2–4 changes to DeepDiveTab**

Replicate, using DeepDiveTab's own variable names for POIs and selected province:
- Add `perusahaan` to its metric toggle if it has one; if DeepDiveTab has NO metric toggle (its map may be PDRB-only), skip the toggle and instead ALWAYS surface the company list when a province + sector is selected (the map already colors by PDRB there).
- Add `selectedCompanySector`, `showAllCompanies` state.
- Compute `top5SectorNames`, `companySectorBubbles`, `dedupedCompanyCount`, `companyListForSector` exactly as in Task 3 Step 3 / Task 4 Step 2, using DeepDiveTab's `pois` variable.
- Render the same sector bubbles (in its province popup) and the same company-list card (Task 4 Step 3), reusing the identical JSX.

Note: keep the JSX/classes identical to MapTab's so the two tabs look consistent. Only the surrounding variable names differ.

- [ ] **Step 4: Verify in the browser**

With `npm run dev` running, open the **Deep Dive** tab → click Bali (or select via its province control) → confirm the company sector counts and the company-name list appear, matching the Map tab. No console errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/DeepDiveTab.jsx
git commit -m "feat(deepdive): mirror real-company counts + list on the Deep Dive map"
```

---

### Task 6: Enrich 5 curated supply-chain companies

**Files:**
- Modify: `dashboard/src/RantaiPasokTab.jsx`

**Interfaces:**
- Consumes: none.
- Produces: enriched `SUPPLY_CHAIN_DATA` entries for UNTR, ASII, BBRI, ADRO, WIKA, each gaining `lastEnriched: "2026-07-08"` and one added upstream and one added downstream node.

**Note:** These entries already contain FY2025 figures and rich prose, so enrichment = (a) add a `lastEnriched` field, (b) add one materially-relevant upstream node and one downstream node each. Do NOT alter existing nodes.

- [ ] **Step 1: UNTR — add `lastEnriched` + nodes**

In the `UNTR` object (starts ~line 10), add `lastEnriched: "2026-07-08",` right after the `headquarters:` line. Append to its `upstream` array:
```js
      { id: "bridgestone", name: "Bridgestone Corporation", country: "Jepang", type: "Komponen (Ban OTR)", desc: "Pemasok ban raksasa off-the-road (OTR) untuk dump truck dan wheel loader Komatsu yang beroperasi di medan tambang berat.", logo: "B", color: "from-slate-600 to-slate-800", keyProducts: ["Ban OTR Radial", "Ban Rigid Truck"], relevance: "Medium" }
```
Append to its `downstream` array:
```js
      { id: "mind_id", name: "MIND ID (Holding Tambang BUMN)", sector: "Tambang & Mineral", parent: "BUMN Holding", desc: "Grup holding pertambangan BUMN yang mengonsolidasikan pembelian alat berat untuk anggota seperti ANTM, PTBA, dan Inalum.", logo: "M", share: 3, volume: "Medium", relationType: "B2B Client (BUMN)" }
```

- [ ] **Step 2: ASII — add `lastEnriched` + nodes**

In the `ASII` object (~line 99), add `lastEnriched: "2026-07-08",` after `headquarters:`. Append to `upstream`:
```js
      { id: "denso", name: "DENSO Corporation", country: "Jepang", type: "Komponen Elektronik", desc: "Pemasok komponen sistem kelistrikan, AC, dan engine management (ECU) untuk perakitan mobil Toyota dan Daihatsu di Indonesia.", logo: "D", color: "from-red-500 to-rose-600", keyProducts: ["ECU", "Sistem AC", "Spark Plug"], relevance: "Tinggi" }
```
Append to `downstream`:
```js
      { id: "astra_daihatsu_export", name: "Pasar Ekspor CBU (Timur Tengah & ASEAN)", sector: "Ekspor Otomotif", parent: "Lintas Negara", desc: "Tujuan ekspor kendaraan utuh (CBU) rakitan lokal seperti Toyota Rush/Avanza ke lebih dari 80 negara.", logo: "E", share: 10, volume: "Tinggi", relationType: "B2B Export" }
```

- [ ] **Step 3: BBRI — add `lastEnriched` + nodes**

In the `"BBRI"` object (~line 127, note quoted keys), add `"lastEnriched": "2026-07-08",` after the `"headquarters"` line. Append to `"upstream"`:
```js
      { "id": "visa_mastercard", "name": "Visa & Mastercard", "country": "Amerika Serikat", "type": "Jaringan Pembayaran", "desc": "Penyedia jaringan pemrosesan transaksi kartu debit/kredit lintas negara untuk kartu terbitan BBRI.", "logo": "V", "color": "from-blue-600 to-yellow-500", "keyProducts": ["Payment Gateway", "Card Network"], "relevance": "Tinggi" }
```
Append to `"downstream"`:
```js
      { "id": "petani_kur", "name": "Segmen Petani & Nelayan KUR", "sector": "Pertanian & Perikanan Rakyat", "parent": "Independen", "desc": "Jutaan petani dan nelayan penerima Kredit Usaha Rakyat (KUR) sektor pertanian untuk modal tanam dan alat tangkap.", "logo": "P", "share": 12, "volume": "Tinggi", "relationType": "B2B Client" }
```

- [ ] **Step 4: ADRO — add `lastEnriched` + nodes**

In the `ADRO` object (~line 45), add `lastEnriched: "2026-07-08",` after `headquarters:`. Append to `upstream`:
```js
      { id: "trakindo", name: "PT Trakindo Utama", country: "Indonesia", type: "Alat Berat (Caterpillar)", desc: "Dealer tunggal alat berat Caterpillar yang menyuplai dump truck dan dozer sebagai armada alternatif di site tambang Adaro.", logo: "T", color: "from-yellow-500 to-amber-600", keyProducts: ["Caterpillar Dozer", "Off-Highway Truck"], relevance: "Tinggi" }
```
Append to `downstream`:
```js
      { id: "adaro_minerals", name: "PT Adaro Minerals Indonesia Tbk (ADMR)", sector: "Metalurgi & Kokas", parent: "Grup Adaro", desc: "Anak usaha yang menyerap batu bara metalurgi (coking coal) untuk hilirisasi menjadi kokas dan aluminium.", logo: "A", share: 8, volume: "Tinggi", relationType: "Affiliated B2B Client" }
```

- [ ] **Step 5: WIKA — add `lastEnriched` + nodes**

In the `WIKA` object (~line 72), add `lastEnriched: "2026-07-08",` after `headquarters:`. Append to `upstream`:
```js
      { id: "pupuk_kaltim_chem", name: "Pemasok Bahan Kimia Konstruksi (Sika/BASF)", country: "Global", type: "Bahan Kimia Konstruksi", desc: "Pemasok admixture beton, waterproofing, dan grouting untuk meningkatkan mutu dan durabilitas struktur beton proyek.", logo: "S", color: "from-yellow-500 to-red-600", keyProducts: ["Concrete Admixture", "Waterproofing"], relevance: "Medium" }
```
Append to `downstream`:
```js
      { id: "ikn_otorita", name: "Otorita Ibu Kota Nusantara (IKN)", sector: "Pemerintah / Sipil", parent: "Republik Indonesia", desc: "Pemberi kontrak pembangunan gedung pemerintahan, jalan, dan infrastruktur dasar di ibu kota baru Nusantara.", logo: "I", share: 12, volume: "Tinggi", relationType: "Government Contract" }
```

- [ ] **Step 6: Verify in the browser**

With `npm run dev` running, open the **Rantai Pasok** (Supply Chain) tab. For each of UNTR, ASII, BBRI, ADRO, WIKA:
- Select the company; confirm the newly added upstream and downstream nodes render in the value chain with no layout break.
- Also open the **Deep Dive** and **PDB** tabs for one of them (e.g. UNTR) to confirm the shared `SUPPLY_CHAIN_DATA` import still works.
- No console errors (watch for a trailing-comma / JSON typo in the BBRI quoted-key object).

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/RantaiPasokTab.jsx
git commit -m "feat(supplychain): enrich UNTR/ASII/BBRI/ADRO/WIKA with added nodes"
```

---

## Self-Review

**Spec coverage:**
- Perusahaan metric + emiten secondary + PDRB coloring → Task 2. ✓
- Real company counts per top-5 sector in popup → Task 3. ✓
- Click sector → company-name list, deduped, ranked by reviews, top-20 + show all → Task 4. ✓
- Applies to both MapTab and DeepDiveTab → Tasks 2–4 + Task 5. ✓
- Shared helper module, unit-tested → Task 1. ✓
- Enrich 5 curated companies, keep verified, `lastEnriched` marker → Task 6. ✓
- Scraper / Gemini / new tables / cron → explicitly deferred (not in plan). ✓

**Placeholder scan:** No TBD/TODO. Task 5 Step 3 references reusing identical JSX from Task 4 by intent (same-file consistency), and Task 5 Step 1 instructs a grep to find DeepDiveTab's exact variable names because they were not fully read during planning — this is a discovery step, not a placeholder for missing logic.

**Type consistency:** Helper names (`normalizeCompanyName`, `dedupeCompanies`, `poisToSectorCounts`, `topCompaniesForSector`) are identical across Tasks 1, 3, 4, 5. `Company` shape (`name, category, pdbSector, rating, ratingCount, gmapsUrl, locationCount`) is consistent between the helper and the render cards. `mapMetric` values (`perusahaan`/`emiten`/`pdrb`) consistent across Tasks 2–4.

## Open verification risk

The whole map feature assumes **Bali POIs actually exist in `pois_data`**. The user stated they do. Task 3 Step 7 and Task 5 verification explicitly check the browser-console POI fetch count. If Bali returns 0 POIs, stop and revisit: either the data isn't there yet (then phase-2 scraping is needed sooner) or the bbox/point-in-polygon filter needs adjusting.
