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
