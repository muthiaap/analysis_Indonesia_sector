import { useEffect, useMemo, useRef, useState } from 'react'
import GraphLink from './GraphLink'
import { loadEdges, buildGraph } from './lib/valueChain'
import { seedPositions, stepSimulation } from './lib/forceGraph'

const W = 1000, H = 680              // logical viewBox size
const RADIUS = { parent: 26, listed: 18, external: 12 }
const FILL = { parent: '#6366f1', listed: '#10b981', external: '#cbd5e1' }
const KIND_LABEL = { parent: 'Perusahaan (dilacak)', listed: 'Mitra (terdaftar di bursa)', external: 'Mitra eksternal' }
const linkKey = (l) => `${l.source}|${l.target}|${l.flow}`
const endId = (ref) => (typeof ref === 'object' ? ref.id : ref)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function ValueChainTab() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [confOn, setConfOn] = useState({ high: true, medium: true, low: true })
  const [selNode, setSelNode] = useState(null)   // pinned company (node id)
  const [selEdge, setSelEdge] = useState(null)   // pinned edge (linkKey) -> citation
  const [hoverKey, setHoverKey] = useState(null) // edge hover, highlight only
  const [, setTick] = useState(0)
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })
  const nodesRef = useRef([])
  const svgRef = useRef(null)
  const rafRef = useRef(0)
  const dragRef = useRef(null)
  const movedRef = useRef(false)
  const userMovedRef = useRef(false)
  const nodeDragRef = useRef(null)     // node being dragged: { id, dx, dy }
  const nodeMovedRef = useRef(false)   // distinguishes a node drag from a node click

  useEffect(() => {
    let alive = true
    loadEdges().then(d => { if (alive) setDoc(d) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [])

  const graph = useMemo(() => doc ? buildGraph(doc) : { nodes: [], links: [] }, [doc])

  const fitView = () => {
    const nodes = nodesRef.current
    if (!nodes.length) return
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const gw = Math.max(maxX - minX, 1), gh = Math.max(maxY - minY, 1)
    const k = clamp(Math.min(W / (gw + 140), H / (gh + 140)), 0.15, 2)
    setView({ k, tx: (W - (minX + maxX) * k) / 2, ty: (H - (minY + maxY) * k) / 2 })
  }

  useEffect(() => {
    if (!graph.nodes.length) return
    userMovedRef.current = false
    const nodes = graph.nodes.map(n => ({ ...n }))
    seedPositions(nodes, W, H)
    nodesRef.current = nodes
    let alpha = 1, frames = 0
    const loop = () => {
      stepSimulation(nodes, graph.links, { alpha })
      alpha *= 0.985; frames++
      setTick(t => t + 1)
      if (!userMovedRef.current) fitView()
      if (frames < 600 && alpha > 0.01) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [graph])

  // ----- pan / zoom -----
  // measure against the SVG itself, not e.currentTarget (which is the node <g> during a node drag)
  const svgPoint = (e) => {
    const r = (svgRef.current || e.currentTarget).getBoundingClientRect()
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }
  }
  // screen → world (undo the pan/zoom transform) so a dragged node tracks the cursor
  const worldPoint = (e) => {
    const p = svgPoint(e)
    return { x: (p.x - view.tx) / view.k, y: (p.y - view.ty) / view.k }
  }
  const onNodeDown = (e, n) => {
    e.stopPropagation()                       // don't start a background pan
    cancelAnimationFrame(rafRef.current)      // freeze auto-layout so peers stay put
    userMovedRef.current = true
    nodeMovedRef.current = false
    const w = worldPoint(e)
    // directly-connected neighbours travel rigidly — but only ones SMALLER than the dragged node,
    // so grabbing a hub pulls its little satellites without yanking other hubs around
    const nmap = new Map(nodesRef.current.map(m => [m.id, m]))
    const smaller = (m) => RADIUS[m.kind] < RADIUS[n.kind]
    const seen = new Set()                    // dedupe: a partner joined by >1 edge must move once, not N times
    const neighbors = []
    const consider = (id) => {
      if (id === n.id || seen.has(id) || !nmap.has(id)) return
      const m = nmap.get(id)
      if (smaller(m)) { seen.add(id); neighbors.push(m) }
    }
    for (const l of graph.links) {
      const s = endId(l.source), t = endId(l.target)
      if (s === n.id) consider(t)
      else if (t === n.id) consider(s)
    }
    nodeDragRef.current = { id: n.id, dx: n.x - w.x, dy: n.y - w.y, neighbors }
  }
  const zoomAround = (mx, my, factor) => {
    userMovedRef.current = true
    setView(v => {
      const k = clamp(v.k * factor, 0.15, 5)
      const wx = (mx - v.tx) / v.k, wy = (my - v.ty) / v.k
      return { k, tx: mx - wx * k, ty: my - wy * k }
    })
  }
  const onDown = (e) => { const p = svgPoint(e); movedRef.current = false; dragRef.current = { sx: p.x, sy: p.y, tx: view.tx, ty: view.ty } }
  const onMove = (e) => {
    const nd = nodeDragRef.current
    if (nd) {                                 // dragging a node — it plus its neighbours move together
      const w = worldPoint(e)
      const n = nodesRef.current.find(m => m.id === nd.id)
      if (n) {
        const nx = w.x + nd.dx, ny = w.y + nd.dy
        const ddx = nx - n.x, ddy = ny - n.y  // this frame's movement, applied to neighbours too
        n.x = nx; n.y = ny
        for (const m of nd.neighbors) { m.x += ddx; m.y += ddy }
        nodeMovedRef.current = true; setTick(t => t + 1)
      }
      return
    }
    if (!dragRef.current) return
    userMovedRef.current = true; movedRef.current = true
    const p = svgPoint(e)
    setView(v => ({ ...v, tx: dragRef.current.tx + (p.x - dragRef.current.sx), ty: dragRef.current.ty + (p.y - dragRef.current.sy) }))
  }
  const onUp = () => { dragRef.current = null; nodeDragRef.current = null }
  const onBgClick = () => { if (movedRef.current) { movedRef.current = false; return } setSelNode(null); setSelEdge(null) }

  if (error) return <div className="p-8 text-rose-600">Gagal memuat rantai nilai: {error}</div>
  if (!doc) return <div className="p-8 text-slate-400">Memuat rantai nilai…</div>

  const nodes = nodesRef.current
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const links = graph.links.filter(l => confOn[l.confidence])
  const sel = selEdge != null ? (links.find(l => linkKey(l) === selEdge) || null) : null
  const node = selNode != null ? byId[selNode] : null
  const suppliers = node ? links.filter(l => endId(l.target) === node.id) : []   // flow into node
  const customers = node ? links.filter(l => endId(l.source) === node.id) : []   // flow out of node
  const btn = 'w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center'

  const PartnerRow = ({ l, partnerId }) => {
    const p = byId[partnerId]
    const active = selEdge === linkKey(l)
    return (
      <button onClick={() => setSelEdge(linkKey(l))}
        className={`w-full text-left px-2 py-1 rounded ${active ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}>
        <div className="text-xs font-medium text-slate-700 truncate">{p?.label || partnerId}{p?.ticker ? ` (${p.ticker})` : ''}</div>
        <div className="text-[10px] text-slate-400 truncate">{l.flow} · {l.confidence}</div>
      </button>
    )
  }

  return (
    <div className="animate-fade-in flex gap-4 items-start">
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 p-3">
        <div className="flex items-center gap-4 mb-2 text-xs">
          {['high', 'medium', 'low'].map(t => (
            <label key={t} className="flex items-center gap-1 cursor-pointer capitalize">
              <input type="checkbox" checked={confOn[t]} onChange={() => setConfOn(s => ({ ...s, [t]: !s[t] }))} />{t}
            </label>
          ))}
          <span className="ml-auto text-slate-400">{links.length} edge · {nodes.length} node · seret untuk geser · klik node/edge</span>
        </div>
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <button className={btn} title="Perbesar" onClick={() => zoomAround(W / 2, H / 2, 1.25)}><span className="text-lg leading-none">+</span></button>
            <button className={btn} title="Perkecil" onClick={() => zoomAround(W / 2, H / 2, 0.8)}><span className="text-lg leading-none">−</span></button>
            <button className={btn + ' text-[10px]'} title="Pas ke layar" onClick={() => { userMovedRef.current = true; fitView() }}>Fit</button>
          </div>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[72vh] bg-slate-50/40 rounded-xl cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={onBgClick}>
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
              {links.map((l) => {
                const s = byId[endId(l.source)]
                const t = byId[endId(l.target)]
                if (!s || !t) return null
                const k = linkKey(l)
                const touchesNode = selNode && (endId(l.source) === selNode || endId(l.target) === selNode)
                return (
                  <GraphLink key={k} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    targetRadius={RADIUS[t.kind]} relType={l.flow}
                    highlighted={hoverKey === k || selEdge === k || touchesNode}
                    onEnter={() => setHoverKey(k)} onLeave={() => setHoverKey(null)}
                    onClick={(e) => { e.stopPropagation(); setSelEdge(k) }} />
                )
              })}
              {nodes.map(n => (
                <g key={n.id} style={{ cursor: 'grab' }}
                  onMouseDown={(e) => onNodeDown(e, n)}
                  onClick={(e) => { e.stopPropagation(); if (nodeMovedRef.current) { nodeMovedRef.current = false; return } setSelNode(n.id); setSelEdge(null) }}>
                  {selNode === n.id && (
                    <circle cx={n.x} cy={n.y} r={RADIUS[n.kind] + 5} fill="none" stroke="#6366f1" strokeWidth="2.5" />
                  )}
                  <circle cx={n.x} cy={n.y} r={RADIUS[n.kind]} fill={FILL[n.kind]} stroke="#fff" strokeWidth="2">
                    <title>{n.label}</title>
                  </circle>
                  <text x={n.x} y={n.y + RADIUS[n.kind] + 10} textAnchor="middle" fontSize="9" className="fill-slate-600 pointer-events-none">
                    {n.ticker || (n.label || '').slice(0, 14)}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </div>

      <div className="w-80 shrink-0 self-start bg-white rounded-2xl border border-slate-200 p-4 text-sm max-h-[72vh] overflow-auto">
        {!node && !sel && (
          <div className="text-slate-400">Klik sebuah <b>node</b> untuk melihat perusahaan &amp; mitranya, atau klik sebuah <b>edge</b> untuk kutipan sumbernya.</div>
        )}

        {node && (
          <div className="mb-3">
            <div className="font-bold text-slate-800 leading-tight">{node.label}</div>
            <div className="text-[11px] text-slate-500 mb-2">
              {node.ticker ? <span className="font-semibold text-slate-600">{node.ticker}</span> : null}
              {node.ticker ? ' · ' : ''}{KIND_LABEL[node.kind]}
            </div>

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-2 mb-1">Pemasok ({suppliers.length})</div>
            {suppliers.length ? suppliers.map(l => <PartnerRow key={linkKey(l)} l={l} partnerId={endId(l.source)} />)
              : <div className="text-[11px] text-slate-400 px-2">— tidak ada dalam data —</div>}

            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-3 mb-1">Pelanggan ({customers.length})</div>
            {customers.length ? customers.map(l => <PartnerRow key={linkKey(l)} l={l} partnerId={endId(l.target)} />)
              : <div className="text-[11px] text-slate-400 px-2">— tidak ada dalam data —</div>}
          </div>
        )}

        {sel && (
          <div className={node ? 'border-t border-slate-200 pt-3' : ''}>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Bukti</div>
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
        )}
      </div>
    </div>
  )
}
