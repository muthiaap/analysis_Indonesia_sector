import { useEffect, useMemo, useRef, useState } from 'react'
import GraphLink from './GraphLink'
import { loadEdges, buildGraph } from './lib/valueChain'
import { seedPositions, stepSimulation } from './lib/forceGraph'

const W = 1000, H = 680              // logical viewBox size
const RADIUS = { parent: 26, listed: 18, external: 12 }
const FILL = { parent: '#6366f1', listed: '#10b981', external: '#cbd5e1' }
const linkKey = (l) => `${l.source}|${l.target}|${l.flow}`
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function ValueChainTab() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [confOn, setConfOn] = useState({ high: true, medium: true, low: true })
  const [selected, setSelected] = useState(null)   // stable key (linkKey) of the selected edge
  const [, setTick] = useState(0)
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })   // pan/zoom transform
  const nodesRef = useRef([])
  const rafRef = useRef(0)
  const dragRef = useRef(null)
  const userMovedRef = useRef(false)   // stop auto-fit once the user pans/zooms

  useEffect(() => {
    let alive = true
    loadEdges().then(d => { if (alive) setDoc(d) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [])

  const graph = useMemo(() => doc ? buildGraph(doc) : { nodes: [], links: [] }, [doc])

  // Centre + scale the settled node bounds into the viewport.
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
      if (!userMovedRef.current) fitView()   // keep the whole graph framed until the user takes over
      if (frames < 600 && alpha > 0.01) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [graph])

  // ----- pan / zoom -----
  const svgPoint = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }
  }
  const zoomAround = (mx, my, factor) => {
    userMovedRef.current = true
    setView(v => {
      const k = clamp(v.k * factor, 0.15, 5)
      const wx = (mx - v.tx) / v.k, wy = (my - v.ty) / v.k
      return { k, tx: mx - wx * k, ty: my - wy * k }
    })
  }
  const onDown = (e) => { const p = svgPoint(e); dragRef.current = { sx: p.x, sy: p.y, tx: view.tx, ty: view.ty } }
  const onMove = (e) => {
    if (!dragRef.current) return
    userMovedRef.current = true
    const p = svgPoint(e)
    setView(v => ({ ...v, tx: dragRef.current.tx + (p.x - dragRef.current.sx), ty: dragRef.current.ty + (p.y - dragRef.current.sy) }))
  }
  const onUp = () => { dragRef.current = null }

  if (error) return <div className="p-8 text-rose-600">Gagal memuat rantai nilai: {error}</div>
  if (!doc) return <div className="p-8 text-slate-400">Memuat rantai nilai…</div>

  const nodes = nodesRef.current
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const links = graph.links.filter(l => confOn[l.confidence])
  const sel = selected != null ? (links.find(l => linkKey(l) === selected) || null) : null
  const btn = 'w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 flex items-center justify-center'

  return (
    <div className="animate-fade-in flex gap-4 items-start">
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 p-3">
        <div className="flex items-center gap-4 mb-2 text-xs">
          {['high', 'medium', 'low'].map(t => (
            <label key={t} className="flex items-center gap-1 cursor-pointer capitalize">
              <input type="checkbox" checked={confOn[t]} onChange={() => setConfOn(s => ({ ...s, [t]: !s[t] }))} />{t}
            </label>
          ))}
          <span className="ml-auto text-slate-400">{links.length} edge · {nodes.length} node · seret untuk geser</span>
        </div>
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <button className={btn} title="Perbesar" onClick={() => zoomAround(W / 2, H / 2, 1.25)}><span className="text-lg leading-none">+</span></button>
            <button className={btn} title="Perkecil" onClick={() => zoomAround(W / 2, H / 2, 0.8)}><span className="text-lg leading-none">−</span></button>
            <button className={btn + ' text-[10px]'} title="Pas ke layar" onClick={() => { userMovedRef.current = true; fitView() }}>Fit</button>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[72vh] bg-slate-50/40 rounded-xl cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
              {links.map((l) => {
                const s = byId[typeof l.source === 'object' ? l.source.id : l.source]
                const t = byId[typeof l.target === 'object' ? l.target.id : l.target]
                if (!s || !t) return null
                const k = linkKey(l)
                return (
                  <GraphLink key={k} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    targetRadius={RADIUS[t.kind]} relType={l.flow}
                    highlighted={selected === k}
                    onEnter={() => setSelected(k)} onLeave={() => {}} />
                )
              })}
              {nodes.map(n => (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={RADIUS[n.kind]} fill={FILL[n.kind]} stroke="#fff" strokeWidth="2" />
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
          <div className="text-slate-400">Arahkan kursor ke sebuah edge untuk melihat kutipan bukti &amp; sumbernya.</div>
        )}
      </div>
    </div>
  )
}
