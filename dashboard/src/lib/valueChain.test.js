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
  it('gives each card a short label: ticker if listed, else cleaned name', () => {
    const v = buildEgoView(DOC, 'SMGR')
    expect(v.customers.find(c => c.name.includes('Wijaya Karya Beton')).label).toBe('WTON')
    expect(v.suppliers.find(s => s.name.includes('Bukit Asam')).label).toBe('PTBA')
    const w = buildEgoView(DOC, 'WTON')   // 'Some Vendor' has no ticker
    expect(w.suppliers[0].label).toBe('Some Vendor')
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
