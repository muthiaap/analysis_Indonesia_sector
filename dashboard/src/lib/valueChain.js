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

// Short, readable node label: the ticker if the counterparty is listed, else the
// company name with legal-form noise stripped and truncated. (Raw names all start
// with "PT …", which is why the renderer's name.split(' ')[0] showed "PT" for every
// supplier — this gives it something meaningful to display instead.)
export function shortLabel(name, ticker) {
  if (ticker) return ticker
  const c = (name || '')
    .replace(/^PT\s+/i, '')
    .replace(/\s+Tbk\.?$/i, '')
    .replace(/\s*\(Persero\)\s*/i, ' ')
    .replace(/\s+(Ltd|Sdn\.?\s*Bhd|GmbH|Pte\.?\s*Ltd|Limited|Corporation|Corp)\.?$/i, '')
    .replace(/\s+/g, ' ').trim()
  return c.length > 16 ? c.slice(0, 16).trim() + '…' : c
}

export function buildEgoView(doc, ticker) {
  const rec = doc[ticker]
  if (!rec) return null
  const suppliers = [], customers = []
  rec.edges.forEach((e, i) => {
    const base = {
      id: (e.counterparty_ticker || ('cp' + i)).toLowerCase(),
      name: e.counterparty,
      label: shortLabel(e.counterparty, e.counterparty_ticker),
      ticker: e.counterparty_ticker || null,
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
