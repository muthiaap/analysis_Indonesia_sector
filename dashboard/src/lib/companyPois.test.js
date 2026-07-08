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
