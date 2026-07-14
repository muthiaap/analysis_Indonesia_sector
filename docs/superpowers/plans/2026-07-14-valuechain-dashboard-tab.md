# Value-Chain Dashboard Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface `value_chain_edges.json` in the dashboard: a new whole-network "Rantai Nilai" tab, and rewire the existing Supply Chain tab to render real pipeline data (curated demos as fallback).

**Architecture:** A shared, unit-tested data layer (`src/lib/valueChain.js`) transforms the static JSON into both a graph (`buildGraph`) and per-company ego views (`buildEgoView`). A pure force-sim helper (`src/lib/forceGraph.js`) positions the network graph. The new `ValueChainTab.jsx` reuses the existing `GraphLink.jsx` + `graphEdges.js`. `RantaiPasokTab.jsx` gets a minimal rewire to prefer real data over its hardcoded `SUPPLY_CHAIN_DATA`. `HubunganTab.jsx` is NOT touched.

**Tech Stack:** React 18, Vite, Tailwind, Vitest. No new dependencies (custom force sim; no d3).

## Global Constraints

- Work in `dashboard/`. Run tests with `npm test` (vitest), build with `npm run build`.
- No new npm dependencies.
- Static JSON only: data comes from `fetch('./value_chain_edges.json')`. All file-shape knowledge lives in `src/lib/valueChain.js` — the DB-swap seam.
- Reuse `src/GraphLink.jsx` and `src/lib/graphEdges.js`; do NOT modify `HubunganTab.jsx` or its physics.
- `GraphLink` props are exactly `{ x1, y1, x2, y2, targetRadius, relType, highlighted, onEnter, onLeave }`.
- Edge orientation = physical flow: `supplier` → arrow into the parent; `customer` → arrow out of the parent.
- Confidence tiers exactly `high | medium | low`. Real focus badge label "Dari Laporan"; curated fallback badge "Contoh".
- `buildEgoView` output MUST include `suppliers`, `internal` (may be `[]`), and `customers` arrays plus the top-level metadata keys the renderer reads, so `RantaiPasokTab` never dereferences `undefined`.

## File Structure

- Create: `dashboard/src/lib/valueChain.js` — data layer (`loadEdges`, `buildGraph`, `buildEgoView`, `focusOptions`, `confidenceColor`, `confidenceLabel`, `normId`).
- Create: `dashboard/src/lib/valueChain.test.js` — vitest.
- Create: `dashboard/src/lib/forceGraph.js` — pure sim (`seedPositions`, `stepSimulation`).
- Create: `dashboard/src/lib/forceGraph.test.js` — vitest.
- Create: `dashboard/src/ValueChainTab.jsx` — new tab component.
- Modify: `dashboard/src/App.jsx` — register the `nilai` tab (import, sidebar button, header title, render).
- Modify: `dashboard/src/RantaiPasokTab.jsx` — fetch the doc, prefer real ego view, populate the focus selector, show source link + badge.

---

## Task 1: Data layer — `lib/valueChain.js`

**Files:**
- Create: `dashboard/src/lib/valueChain.js`
- Test: `dashboard/src/lib/valueChain.test.js`

**Interfaces:**
- Produces:
  - `normId(name: string) -> string`
  - `confidenceColor(tier) -> string` (tailwind gradient classes), `confidenceLabel(tier) -> string`
  - `buildGraph(doc) -> { nodes: [{id,label,ticker,kind}], links: [{source,target,direction,confidence,flow,evidence_quote,source_url,source_type,source_date}] }`, `kind ∈ {parent,listed,external}`
  - `buildEgoView(doc, ticker) -> { name,ticker,sector,subSector,overview,revenue,netIncome,employeeCount,headquarters,lastEnriched,source,suppliers,internal,customers } | null`
  - `focusOptions(doc, demoKeys) -> [{ticker,label,source:'filings'|'curated'}]`
  - `loadEdges(url?) -> Promise<doc>`
- Consumes: `value_chain_edges.json` doc `{ ticker: { company, edges:[{counterparty,counterparty_ticker,direction,flow,confidence,evidence_quote,source_url,source_type,source_date}] } }`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/lib/valueChain.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { normId, buildGraph, buildEgoView, focusOptions, confidenceLabel } from './valueChain'

const DOC = {
  SMGR: { company: 'Semen Indonesia (Persero) Tbk', edges: [
    { counterparty: 'PT Wijaya Karya Beton Tbk', counterparty_ticker: 'WTON', direction: 'customer',
      flow: 'cement sales', confidence: 'high', evidence_quote: 'Sales of goods to WIKA Beton',
      source_url: 'http://x', source_type: 'filing', source_date: '2025-12-31' },
    { counterparty: 'PT Bukit Asam Tbk', counterparty_ticker: 'PTBA', direction: 'supplier',
      flow: 'coal supply', confidence: 'high', evidence_quote: 'coal from Bukit Asam',
      source_url: 'http://y', source_type: 'filing', source_date: '2025-12-31' },
  ] },
  WTON: { company: 'Wijaya Karya Beton Tbk', edges: [
    { counterparty: 'Some Vendor', counterparty_ticker: null, direction: 'supplier',
      flow: 'steel', confidence: 'low', evidence_quote: 'buys steel from vendor',
      source_url: 'http://z', source_type: 'company_site', source_date: null },
  ] },
}

describe('normId', () => {
  it('strips legal forms and punctuation', () => {
    expect(normId('PT Bukit Asam Tbk')).toBe('bukit asam')
  })
})

describe('buildGraph', () => {
  const g = buildGraph(DOC)
  it('dedupes a listed counterparty that is also a parent into one parent node', () => {
    const wton = g.nodes.filter(n => n.ticker === 'WTON')
    expect(wton).toHaveLength(1)
    expect(wton[0].kind).toBe('parent')     // WTON is a parent in the doc, parent wins
  })
  it('marks unlisted counterparties external', () => {
    expect(g.nodes.find(n => n.label === 'Some Vendor').kind).toBe('external')
  })
  it('orients supplier edge INTO the parent and customer edge OUT', () => {
    const sup = g.links.find(l => l.flow === 'coal supply')
    expect(sup.source).toBe('t:PTBA'); expect(sup.target).toBe('t:SMGR')
    const cus = g.links.find(l => l.flow === 'cement sales')
    expect(cus.source).toBe('t:SMGR'); expect(cus.target).toBe('t:WTON')
  })
  it('links carry citation fields', () => {
    expect(g.links[0].evidence_quote).toBeTruthy()
    expect(g.links[0].source_url).toBeTruthy()
  })
})

describe('buildEgoView', () => {
  it('partitions suppliers/customers and maps quote+confidence', () => {
    const v = buildEgoView(DOC, 'SMGR')
    expect(v.customers.map(c => c.name)).toContain('PT Wijaya Karya Beton Tbk')
    expect(v.suppliers.map(s => s.name)).toContain('PT Bukit Asam Tbk')
    expect(v.customers[0].desc).toBe('Sales of goods to WIKA Beton')
    expect(v.internal).toEqual([])
    expect(v.suppliers[0].relevance).toBe(confidenceLabel('high'))
    expect(v.suppliers[0].sourceUrl).toBe('http://y')
  })
  it('returns null for an unknown ticker', () => {
    expect(buildEgoView(DOC, 'ZZZZ')).toBeNull()
  })
})

describe('focusOptions', () => {
  it('unions real (filings) with demo-only (curated), real wins on overlap', () => {
    const opts = focusOptions(DOC, ['SMGR', 'INDF'])   // SMGR overlaps, INDF demo-only
    const smgr = opts.filter(o => o.ticker === 'SMGR')
    expect(smgr).toHaveLength(1)
    expect(smgr[0].source).toBe('filings')
    expect(opts.find(o => o.ticker === 'INDF').source).toBe('curated')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd dashboard && npm test -- valueChain`
Expected: FAIL — cannot resolve `./valueChain`.

- [ ] **Step 3: Implement `dashboard/src/lib/valueChain.js`**

```js
const CONF_COLOR = {
  high: 'from-emerald-500 to-teal-600',
  medium: 'from-amber-500 to-yellow-600',
  low: 'from-slate-400 to-slate-500',
}
const CONF_LABEL = {
  high: 'Tinggi (Laporan Keuangan)',
  medium: 'Medium (Berita)',
  low: 'Rendah (Situs/Tak bertanggal)',
}

export function confidenceColor(t) { return CONF_COLOR[t] || CONF_COLOR.low }
export function confidenceLabel(t) { return CONF_LABEL[t] || t }

export function normId(name) {
  return (name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pt|tbk|persero|perseroan|terbuka)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export async function loadEdges(url = './value_chain_edges.json') {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`value_chain_edges.json: HTTP ${r.status}`)
  return r.json()
}

export function buildGraph(doc) {
  const nodes = new Map()
  const add = (id, label, ticker, kind) => {
    const cur = nodes.get(id)
    if (!cur) nodes.set(id, { id, label, ticker: ticker || null, kind })
    else if (kind === 'parent') cur.kind = 'parent'   // parent always wins
  }
  // pass 1: every parent
  for (const [ticker, rec] of Object.entries(doc)) {
    add('t:' + ticker, rec.company || ticker, ticker, 'parent')
  }
  // pass 2: counterparties + links
  const links = []
  for (const [ticker, rec] of Object.entries(doc)) {
    const pid = 't:' + ticker
    for (const e of rec.edges) {
      const cid = e.counterparty_ticker ? 't:' + e.counterparty_ticker : 'n:' + normId(e.counterparty)
      add(cid, e.counterparty, e.counterparty_ticker || null, e.counterparty_ticker ? 'listed' : 'external')
      const [source, target] = e.direction === 'supplier' ? [cid, pid] : [pid, cid]
      links.push({
        source, target, direction: e.direction, confidence: e.confidence, flow: e.flow,
        evidence_quote: e.evidence_quote, source_url: e.source_url,
        source_type: e.source_type, source_date: e.source_date,
      })
    }
  }
  return { nodes: [...nodes.values()], links }
}

export function buildEgoView(doc, ticker) {
  const rec = doc[ticker]
  if (!rec) return null
  const suppliers = [], customers = []
  rec.edges.forEach((e, i) => {
    const base = {
      id: (e.counterparty_ticker || ('cp' + i)).toLowerCase(),
      name: e.counterparty,
      desc: e.evidence_quote,
      logo: (e.counterparty.replace(/^PT\s+/i, '').trim()[0] || '?').toUpperCase(),
      color: confidenceColor(e.confidence),
      keyProducts: [e.flow],
      confidence: e.confidence,
      sourceUrl: e.source_url,
      sourceType: e.source_type,
      sourceDate: e.source_date,
    }
    if (e.direction === 'supplier') {
      suppliers.push({ ...base, country: '', type: e.flow, relevance: confidenceLabel(e.confidence) })
    } else {
      customers.push({ ...base, sector: e.flow, parent: '', share: null, volume: '', relationType: confidenceLabel(e.confidence) })
    }
  })
  return {
    name: rec.company || ticker, ticker, sector: '', subSector: '',
    overview: 'Rantai nilai eksternal diekstraksi dari laporan keuangan & sumber publik.',
    revenue: '', netIncome: '', employeeCount: '', headquarters: '', lastEnriched: '',
    source: 'filings', suppliers, internal: [], customers,
  }
}

export function focusOptions(doc, demoKeys) {
  const real = Object.keys(doc)
  const realSet = new Set(real)
  const opts = real.map(t => ({ ticker: t, label: doc[t].company || t, source: 'filings' }))
  for (const k of demoKeys) if (!realSet.has(k)) opts.push({ ticker: k, label: k, source: 'curated' })
  return opts
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd dashboard && npm test -- valueChain`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add src/lib/valueChain.js src/lib/valueChain.test.js
git commit -m "feat(dashboard): value-chain data layer (buildGraph/buildEgoView/focusOptions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Force simulation — `lib/forceGraph.js`

**Files:**
- Create: `dashboard/src/lib/forceGraph.js`
- Test: `dashboard/src/lib/forceGraph.test.js`

**Interfaces:**
- Produces:
  - `seedPositions(nodes, width, height) -> nodes` — deterministically lays nodes on a circle by index; sets `x,y,vx,vy`.
  - `stepSimulation(nodes, links, opts?) -> nodes` — one Coulomb-repulsion + spring-attraction tick; mutates and returns `nodes`. `opts = { repulsion=500, springLength=90, springK=0.04, damping=0.85, alpha=1 }`. `links` reference nodes by `source`/`target` id (string) or object with `.id`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/lib/forceGraph.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { seedPositions, stepSimulation } from './forceGraph'

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

describe('seedPositions', () => {
  it('is deterministic and sets coordinates + velocity', () => {
    const a = seedPositions([{ id: 'a' }, { id: 'b' }], 100, 100)
    const b = seedPositions([{ id: 'a' }, { id: 'b' }], 100, 100)
    expect(a[0].x).toBe(b[0].x); expect(a[0].y).toBe(b[0].y)
    expect(a[0].vx).toBe(0); expect(a[0].vy).toBe(0)
  })
})

describe('stepSimulation', () => {
  it('pulls a connected pair toward the spring length', () => {
    const nodes = [{ id: 'a', x: 0, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 400, y: 0, vx: 0, vy: 0 }]
    const links = [{ source: 'a', target: 'b' }]
    const before = dist(nodes[0], nodes[1])
    for (let i = 0; i < 300; i++) stepSimulation(nodes, links, { springLength: 90 })
    const after = dist(nodes[0], nodes[1])
    expect(after).toBeLessThan(before)          // spring contracted the long edge
    expect(after).toBeGreaterThan(20)           // repulsion prevents collapse
  })
  it('pushes an unconnected pair apart', () => {
    const nodes = [{ id: 'a', x: 50, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 55, y: 0, vx: 0, vy: 0 }]
    const before = dist(nodes[0], nodes[1])
    for (let i = 0; i < 50; i++) stepSimulation(nodes, [], {})
    expect(dist(nodes[0], nodes[1])).toBeGreaterThan(before)
  })
  it('accepts links whose source/target are node objects', () => {
    const nodes = [{ id: 'a', x: 0, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 300, y: 0, vx: 0, vy: 0 }]
    const links = [{ source: nodes[0], target: nodes[1] }]
    expect(() => stepSimulation(nodes, links, {})).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd dashboard && npm test -- forceGraph`
Expected: FAIL — cannot resolve `./forceGraph`.

- [ ] **Step 3: Implement `dashboard/src/lib/forceGraph.js`**

```js
export function seedPositions(nodes, width, height) {
  const cx = width / 2, cy = height / 2
  const R = Math.min(width, height) * 0.35
  const n = nodes.length || 1
  nodes.forEach((node, i) => {
    const a = (i / n) * 2 * Math.PI
    node.x = cx + R * Math.cos(a)
    node.y = cy + R * Math.sin(a)
    node.vx = 0
    node.vy = 0
  })
  return nodes
}

const idOf = (ref) => (ref && typeof ref === 'object') ? ref.id : ref

export function stepSimulation(nodes, links, opts = {}) {
  const { repulsion = 500, springLength = 90, springK = 0.04, damping = 0.85, alpha = 1 } = opts
  const idx = new Map(nodes.map((n, i) => [n.id, i]))

  // Coulomb repulsion between every pair
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = a.x - b.x, dy = a.y - b.y
      let d2 = dx * dx + dy * dy || 0.01
      const d = Math.sqrt(d2)
      const f = (repulsion / Math.max(20, d2)) * alpha
      const fx = (dx / d) * f, fy = (dy / d) * f
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }
  }
  // Spring attraction along links
  for (const l of links) {
    const a = nodes[idx.get(idOf(l.source))]
    const b = nodes[idx.get(idOf(l.target))]
    if (!a || !b) continue
    let dx = b.x - a.x, dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01
    const disp = (d - springLength) * springK * alpha
    const fx = (dx / d) * disp, fy = (dy / d) * disp
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  }
  // Integrate with damping
  for (const n of nodes) {
    n.vx *= damping; n.vy *= damping
    n.x += n.vx; n.y += n.vy
  }
  return nodes
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd dashboard && npm test -- forceGraph`
Expected: PASS.

- [ ] **Step 5: Run the full front-end suite (no regressions)**

Run: `cd dashboard && npm test`
Expected: PASS (existing companyPois + graphEdges tests + the two new files).

- [ ] **Step 6: Commit**

```bash
cd dashboard && git add src/lib/forceGraph.js src/lib/forceGraph.test.js
git commit -m "feat(dashboard): pure force-sim helper (seed + Coulomb/spring step)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: New "Rantai Nilai" tab + App wiring

**Files:**
- Create: `dashboard/src/ValueChainTab.jsx`
- Modify: `dashboard/src/App.jsx` (import; sidebar button; header title; render block)

**Interfaces:**
- Consumes: `loadEdges`, `buildGraph` (Task 1); `seedPositions`, `stepSimulation` (Task 2); `GraphLink` (existing).
- Produces: default-exported `ValueChainTab` component; new `activeTab === 'nilai'`.

No unit test (UI). Verified by `npm run build` + manual smoke.

- [ ] **Step 1: Create `dashboard/src/ValueChainTab.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import GraphLink from './GraphLink'
import { loadEdges, buildGraph } from './lib/valueChain'
import { seedPositions, stepSimulation } from './lib/forceGraph'

const W = 900, H = 620
const RADIUS = { parent: 26, listed: 18, external: 12 }
const FILL = { parent: '#6366f1', listed: '#10b981', external: '#cbd5e1' }

export default function ValueChainTab() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [confOn, setConfOn] = useState({ high: true, medium: true, low: true })
  const [selected, setSelected] = useState(null)   // index into filtered links
  const [, setTick] = useState(0)
  const nodesRef = useRef([])
  const rafRef = useRef(0)

  useEffect(() => { loadEdges().then(setDoc).catch(e => setError(e.message)) }, [])

  const graph = useMemo(() => doc ? buildGraph(doc) : { nodes: [], links: [] }, [doc])

  useEffect(() => {
    if (!graph.nodes.length) return
    const nodes = graph.nodes.map(n => ({ ...n }))
    seedPositions(nodes, W, H)
    nodesRef.current = nodes
    let alpha = 1, frames = 0
    const loop = () => {
      stepSimulation(nodes, graph.links, { alpha })
      alpha *= 0.985; frames++
      setTick(t => t + 1)
      if (frames < 600 && alpha > 0.01) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [graph])

  if (error) return <div className="p-8 text-rose-600">Gagal memuat rantai nilai: {error}</div>
  if (!doc) return <div className="p-8 text-slate-400">Memuat rantai nilai…</div>

  const nodes = nodesRef.current
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const links = graph.links.filter(l => confOn[l.confidence])
  const sel = selected != null ? links[selected] : null

  return (
    <div className="animate-fade-in flex gap-4">
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-3">
        <div className="flex items-center gap-4 mb-2 text-xs">
          {['high', 'medium', 'low'].map(t => (
            <label key={t} className="flex items-center gap-1 cursor-pointer capitalize">
              <input type="checkbox" checked={confOn[t]}
                onChange={() => setConfOn(s => ({ ...s, [t]: !s[t] }))} />{t}
            </label>
          ))}
          <span className="ml-auto text-slate-400">{links.length} edge · {nodes.length} node</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[620px]">
          {links.map((l, i) => {
            const s = byId[typeof l.source === 'object' ? l.source.id : l.source]
            const t = byId[typeof l.target === 'object' ? l.target.id : l.target]
            if (!s || !t) return null
            return (
              <GraphLink key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                targetRadius={RADIUS[t.kind]} relType={l.flow}
                highlighted={selected === i}
                onEnter={() => setSelected(i)} onLeave={() => {}} />
            )
          })}
          {nodes.map(n => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={RADIUS[n.kind]} fill={FILL[n.kind]} stroke="#fff" strokeWidth="2" />
              <text x={n.x} y={n.y + RADIUS[n.kind] + 10} textAnchor="middle" fontSize="9" className="fill-slate-600">
                {n.ticker || (n.label || '').slice(0, 14)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="w-80 bg-white rounded-2xl border border-slate-200 p-4 text-sm">
        {sel ? (
          <div>
            <div className="font-bold text-slate-800 mb-1">{sel.flow}</div>
            <div className="text-xs text-slate-500 mb-2">
              {sel.direction} · {sel.confidence} · {sel.source_type} · {sel.source_date || 'n/a'}
            </div>
            <blockquote className="text-xs italic text-slate-600 border-l-2 border-slate-300 pl-2 mb-2">
              “{sel.evidence_quote}”
            </blockquote>
            <a href={sel.source_url} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-600 underline break-all">Sumber ↗</a>
          </div>
        ) : (
          <div className="text-slate-400">Klik sebuah edge untuk melihat kutipan bukti &amp; sumbernya.</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the tab into `App.jsx` — import**

At the top of `dashboard/src/App.jsx`, after the existing tab imports (line ~11, after `import DeepDiveTab from './DeepDiveTab'`), add:

```jsx
import ValueChainTab from './ValueChainTab'
```

And add `Network` to the existing `lucide-react` import list (the line beginning `import { TrendingUp, ...`).

- [ ] **Step 3: Add the sidebar button**

In `dashboard/src/App.jsx`, immediately AFTER the `rantai-pasok` sidebar button (the `<button …onClick={() => setActiveTab('rantai-pasok')}…>` block ending around line 357), add a sibling button. Copy the exact class string from the `rantai-pasok` button and change only the `activeTab` comparison, the `onClick`, the icon, and the label:

```jsx
            <button
              type="button"
              onClick={() => setActiveTab('nilai')}
              className={`w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 transition-all duration-300 relative cursor-pointer overflow-hidden ${activeTab === 'nilai'
                ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}
            >
              <Network size={20} className="shrink-0" />
              <span className="ml-3 font-semibold text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity">Rantai Nilai</span>
            </button>
```

(If the sibling buttons use a different inner markup for icon/label, match that structure instead — keep this tab visually consistent with its neighbours.)

- [ ] **Step 4: Add the header title**

In the header title block (around lines 399-404, the run of `{activeTab === '…' && '…'}`), add:

```jsx
                  {activeTab === 'nilai' && 'Rantai Nilai - External Value Chain (from filings)'}
```

- [ ] **Step 5: Add the render block**

Next to the other render lines (around line 450, near `{activeTab === 'hubungan' && <HubunganTab />}`), add:

```jsx
          {activeTab === 'nilai' && <ValueChainTab />}
```

- [ ] **Step 6: Build**

Run: `cd dashboard && npm run build`
Expected: `✓ built` with no errors (the pre-existing chunk-size warning is fine).

- [ ] **Step 7: Manual smoke**

Run: `cd dashboard && npm run dev` (background). Open http://localhost:5173/, click the **Rantai Nilai** tab. Confirm: the graph renders and settles (nodes spread, don't fly off), toggling the confidence checkboxes changes the edge count, and clicking an edge shows its quote + a working "Sumber ↗" link. Note anything off. Stop the dev server after.

- [ ] **Step 8: Commit**

```bash
cd dashboard && git add src/ValueChainTab.jsx src/App.jsx
git commit -m "feat(dashboard): Rantai Nilai tab — whole-network value-chain graph

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Rewire Supply Chain tab to real data (demo fallback)

**Files:**
- Modify: `dashboard/src/RantaiPasokTab.jsx`

**Interfaces:**
- Consumes: `loadEdges`, `buildEgoView`, `focusOptions` (Task 1); the existing `SUPPLY_CHAIN_DATA` (as curated fallback).
- The component signature stays `RantaiPasokTab({ selectedFocus, setSelectedFocus })`. The `focusData` it renders must keep the same shape it does today (must include `.internal`).

No unit test (UI). Verified by `npm run build` + manual smoke. Read the file's current `focusData` resolver (around lines 947-949) and the focus `<select>` (around lines 1328-1408) before editing.

- [ ] **Step 1: Load the value-chain doc into state**

Near the top of the component body (after the existing `useState`/`useMemo` hooks, alongside the other state), add the import at the top of the file:

```jsx
import { loadEdges, buildEgoView, focusOptions } from './lib/valueChain'
```

and inside the component:

```jsx
  const [vcDoc, setVcDoc] = useState(null)
  useEffect(() => { loadEdges().then(setVcDoc).catch(() => setVcDoc({})) }, [])
```

(Ensure `useState`/`useEffect` are in the file's React import — add them if missing.)

- [ ] **Step 2: Prefer the real ego view, fall back to the curated demo**

Replace the existing `focusData` resolver (currently:)

```jsx
    const key = selectedFocus === 'ADARO' ? 'ADRO' : selectedFocus
    return SUPPLY_CHAIN_DATA[key]
```

with a real-first resolver:

```jsx
    const key = selectedFocus === 'ADARO' ? 'ADRO' : selectedFocus
    const real = vcDoc ? buildEgoView(vcDoc, key) : null
    return real || SUPPLY_CHAIN_DATA[key] || SUPPLY_CHAIN_DATA[Object.keys(SUPPLY_CHAIN_DATA)[0]]
```

The final fallback guarantees `focusData` is never `undefined` (the renderer dereferences `focusData.internal`). Add `vcDoc` to that `useMemo`'s dependency array.

- [ ] **Step 3: Populate the focus selector from real + demo**

Locate the focus `<select value={selectedFocus} onChange=…>`. Replace its hardcoded `<option>` list with options derived from `focusOptions`, grouped by provenance. Compute above the `return`:

```jsx
  const DEMO_KEYS = ['INDF', 'UNVR', 'ANTM']   // curated companies not in the pipeline yet
  const options = focusOptions(vcDoc || {}, DEMO_KEYS)
```

and render:

```jsx
                <optgroup label="Dari Laporan">
                  {options.filter(o => o.source === 'filings').map(o => (
                    <option key={o.ticker} value={o.ticker}>{o.ticker} — {o.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Contoh (kurasi)">
                  {options.filter(o => o.source === 'curated').map(o => (
                    <option key={o.ticker} value={o.ticker}>{o.ticker}</option>
                  ))}
                </optgroup>
```

Keep the existing `onChange` handler that calls `setSelectedFocus(val)`. Remove (or leave unused) the old scenario-key remapping lines only if they are inside this `<select>`; do not delete unrelated scenario `<select>`s elsewhere in the file.

- [ ] **Step 4: Show the source link + provenance badge on real cards**

Wherever a supplier/customer card renders its `desc`, add — guarded so demo cards (no `sourceUrl`) are unaffected:

```jsx
{node.sourceUrl && (
  <a href={node.sourceUrl} target="_blank" rel="noreferrer"
     className="mt-1 inline-block text-[10px] text-indigo-600 underline">Sumber ↗</a>
)}
```

And near the focal-company header, show the provenance badge:

```jsx
{focusData.source === 'filings'
  ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Dari Laporan</span>
  : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Contoh</span>}
```

(`node` = the supplier/customer object in that card's map; use whatever local variable the existing card JSX already binds.)

- [ ] **Step 5: Build**

Run: `cd dashboard && npm run build`
Expected: `✓ built`, no errors.

- [ ] **Step 6: Manual smoke**

Run: `cd dashboard && npm run dev` (background). Open http://localhost:5173/ → Rantai Pasok tab. Confirm:
- The selector shows a "Dari Laporan" group (SMGR, INTP, TLKM, PGAS, TAPG, JPFA, ADRO, UNTR, ASII, WIKA) and a "Contoh" group (INDF…).
- Selecting **SMGR** (real, previously not demoed) renders suppliers/customers from the filing data with "Sumber ↗" links and a "Dari Laporan" badge, no console errors.
- Selecting **INDF** (demo-only) still renders the curated cards with a "Contoh" badge.
- Selecting **UNTR** (overlap) now shows the real data, not the old demo.
Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
cd dashboard && git add src/RantaiPasokTab.jsx
git commit -m "feat(dashboard): Supply Chain tab reads real value-chain data (demo fallback)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Static-JSON decision + DB seam → `lib/valueChain.js` (`loadEdges` the only fetch). ✓
- `buildGraph`/`buildEgoView`/`focusOptions` → Task 1, tested. ✓
- New whole-network tab, GraphLink + graphEdges reuse, flow-direction arrows, confidence styling + filter, citation panel → Task 3. ✓
- Force sim without modifying Hubungan → Task 2 (`lib/forceGraph.js`), reused in Task 3. ✓
- Supply Chain tab: real-wins-with-demo-fallback, two badges, source links, `internal:[]` shape guard → Task 4. ✓
- Vitest on the data layer + sim; UI verified by build + smoke. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands show expected output. The two UI tasks intentionally use build+smoke (no component-test harness exists in the repo) with explicit smoke checklists.

**Type/name consistency:** `buildGraph` node shape `{id,label,ticker,kind}` and link citation fields are consumed identically in `ValueChainTab`; `buildEgoView` returns `suppliers/internal/customers` + metadata matching what `RantaiPasokTab` reads (`.internal` guaranteed); `seedPositions`/`stepSimulation` signatures match between Task 2 and Task 3; `GraphLink` props match the existing component exactly.

**Risk note (for the executor):** Task 4 edits a 2200-line file. The two anchor points (the `focusData` resolver ~L947 and the focus `<select>` ~L1328) and the card `desc` render site must be located by reading the current file; the plan changes only those, leaving the layout/physics of that tab intact. The final `focusData` fallback prevents any `undefined.internal` crash.
