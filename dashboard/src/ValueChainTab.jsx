import { useEffect, useMemo, useRef, useState } from 'react'
import GraphLink from './GraphLink'
import { loadEdges, buildGraph } from './lib/valueChain'
import { seedPositions, stepSimulation } from './lib/forceGraph'

const W = 900, H = 620
const RADIUS = { parent: 26, listed: 18, external: 12 }
const FILL = { parent: '#6366f1', listed: '#10b981', external: '#cbd5e1' }
const linkKey = (l) => `${l.source}|${l.target}|${l.flow}`

export default function ValueChainTab() {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [confOn, setConfOn] = useState({ high: true, medium: true, low: true })
  const [selected, setSelected] = useState(null)   // stable key (linkKey) of the hovered/selected edge
  const [, setTick] = useState(0)
  const nodesRef = useRef([])
  const rafRef = useRef(0)

  useEffect(() => {
    let alive = true
    loadEdges().then(d => { if (alive) setDoc(d) }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [])

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
  const sel = selected != null ? (links.find(l => linkKey(l) === selected) || null) : null

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
