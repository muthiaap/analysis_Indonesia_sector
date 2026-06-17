import { useEffect, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, Polygon, Tooltip, useMap } from 'react-leaflet'
import {
  Building2, Compass, HelpCircle, MapPin, TrendingUp,
  Briefcase, Link, Layers, DollarSign, Globe, Activity,
  ChevronDown, ChevronUp, ArrowLeft, Info, AlertTriangle,
  Wrench, GraduationCap, Cpu, Sparkles
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import * as h3 from 'h3-js'
import { createClient } from '@supabase/supabase-js'
import { SUPPLY_CHAIN_DATA } from './RantaiPasokTab'

const GEOJSON_URL = './38 Provinsi Indonesia - Provinsi.json'

const SUPABASE_URL = 'https://ghrzerzsrloveonqwxak.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ydi0Id8axZagFDL8WVrcmw_cI18T_dy'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function isPointInCoords(lat, lng, polygonCoords) {
  let inside = false;
  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const xi = polygonCoords[i][0]; // lng
    const yi = polygonCoords[i][1]; // lat
    const xj = polygonCoords[j][0]; // lng
    const yj = polygonCoords[j][1]; // lat

    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInFeature(lat, lng, feature) {
  if (!feature || !feature.geometry) return false;
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return isPointInCoords(lat, lng, geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some(polygon => isPointInCoords(lat, lng, polygon[0]));
  }
  return false;
}

function getFeatureBBox(feature) {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  const processCoords = (coords) => {
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  };

  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    processCoords(geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(polygon => processCoords(polygon[0]));
  }
  return { minLng, maxLng, minLat, maxLat };
}

function generateMockPOIs(feature, count, categories) {
  if (!feature || !categories || categories.length === 0) return [];
  const bbox = getFeatureBBox(feature);
  const pois = [];
  let attempts = 0;
  const maxAttempts = count * 35;

  while (pois.length < count && attempts < maxAttempts) {
    attempts++;
    const lat = bbox.minLat + Math.random() * (bbox.maxLat - bbox.minLat);
    const lng = bbox.minLng + Math.random() * (bbox.maxLng - bbox.minLng);

    if (isPointInFeature(lat, lng, feature)) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      pois.push({
        id: `mock-${pois.length}-${Math.random().toString(36).substr(2, 9)}`,
        name: `Mock ${category} ${pois.length + 1}`,
        category: category,
        coordinates: [lat, lng]
      });
    }
  }
  return pois;
}

function MapController({ selectedProvince, geoJson, onMapInstance }) {
  const map = useMap();

  useEffect(() => {
    if (map && onMapInstance) {
      onMapInstance(map);
    }
  }, [map, onMapInstance]);

  // Zoom to the selected province when it changes
  useEffect(() => {
    if (!map || !selectedProvince || !geoJson) return;

    const feature = geoJson.features.find(
      f => f.properties.PROVINSI === selectedProvince
    );

    if (feature) {
      try {
        const layer = L.geoJSON(feature);
        const bounds = layer.getBounds();
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
      } catch (err) {
        console.warn('Error fitting bounds:', err);
      }
    }
  }, [map, selectedProvince, geoJson]);

  // Reset map view to national view when selectedProvince is cleared
  useEffect(() => {
    if (!map || selectedProvince) return;
    map.setView([-2.5, 118], 5);
  }, [map, selectedProvince]);

  return null;
}

const SECTOR_COLORS = {
  'Barang Baku': '#f27a1a',
  'Barang Konsumen Non-Primer': '#ff7675',
  'Barang Konsumen Primer': '#c4e538',
  'Energi': '#e2ba12',
  'Infrastruktur': '#a55eea',
  'Kesehatan': '#ec4899',
  'Keuangan': '#00c0a8',
  'Perindustrian': '#f97316',
  'Properti & Real Estat': '#fd79a8',
  'Teknologi': '#0984e3',
  'Transportasi & Logistik': '#00b894'
}

const SECTOR_ICONS = {
  'Barang Baku': Briefcase,
  'Barang Konsumen Non-Primer': Layers,
  'Barang Konsumen Primer': Compass,
  'Energi': Activity,
  'Infrastruktur': Link,
  'Kesehatan': Activity,
  'Keuangan': DollarSign,
  'Perindustrian': Briefcase,
  'Properti & Real Estat': Globe,
  'Teknologi': Link,
  'Transportasi & Logistik': Globe
}

const CHOROPLETH_STOPS = [
  { t: 0, color: [241, 245, 249] },
  { t: 0.15, color: [191, 219, 254] },
  { t: 0.35, color: [96, 165, 250] },
  { t: 0.55, color: [37, 99, 235] },
  { t: 0.75, color: [29, 78, 216] },
  { t: 1, color: [15, 23, 42] },
]

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

function formatMoney(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const absVal = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (absVal >= 1e12) return sign + 'Rp ' + (absVal / 1e12).toFixed(2) + ' T'
  if (absVal >= 1e9) return sign + 'Rp ' + (absVal / 1e9).toFixed(2) + ' Miliar'
  if (absVal >= 1e6) return sign + 'Rp ' + (absVal / 1e6).toFixed(2) + ' Juta'
  return sign + 'Rp ' + absVal.toLocaleString()
}

function normalizeSectorName(name) {
  if (!name) return ""
  let s = String(name).trim().toLowerCase()
  s = s.replace(/;/g, ",").replace(/ dan /g, " & ")
  s = s.replace(/[,\s]+/g, " ")
  return s
}

function getChoroplethColor(count, maxCount) {
  if (!count || maxCount === 0) return '#f1f5f9'
  // Use square root scaling for visual spread and contrast
  let t = Math.sqrt(count) / Math.sqrt(maxCount)
  if (t > 1) t = 1

  let lower = CHOROPLETH_STOPS[0]
  let upper = CHOROPLETH_STOPS[CHOROPLETH_STOPS.length - 1]
  for (let i = 0; i < CHOROPLETH_STOPS.length - 1; i++) {
    if (t >= CHOROPLETH_STOPS[i].t && t <= CHOROPLETH_STOPS[i + 1].t) {
      lower = CHOROPLETH_STOPS[i]
      upper = CHOROPLETH_STOPS[i + 1]
      break
    }
  }
  const span = upper.t - lower.t || 1
  const localT = (t - lower.t) / span
  const r = Math.round(lower.color[0] + localT * (upper.color[0] - lower.color[0]))
  const g = Math.round(lower.color[1] + localT * (upper.color[1] - lower.color[1]))
  const b = Math.round(lower.color[2] + localT * (upper.color[2] - lower.color[2]))
  return `rgb(${r},${g},${b})`
}

const isSummaryRow = (bankName) => {
  if (!bankName) return true
  const name = bankName.toLowerCase()
  const excludeKeywords = ['jumlah', 'biaya penerbitan', 'liabilitas jangka', 'total', 'maturity', 'amortisasi']
  return excludeKeywords.some(kw => name.includes(kw))
}

function SectorSparkline({ data, strokeColor, sectorName }) {
  if (!data || data.length === 0) return null

  const width = 240
  const height = 45
  const margin = 2

  const values = data.map(d => d.NetIncome)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = margin + (i / (data.length - 1)) * (width - margin * 2)
    const y = height - margin - ((d.NetIncome - min) / range) * (height - margin * 2)
    return `${x},${y}`
  })

  const linePath = points.join(' ')
  const areaPath = `${margin},${height} ${linePath} ${width - margin},${height}`

  const gradientId = `grad-${sectorName.replace(/\s+/g, '-')}`

  return (
    <div className="mt-3 mb-4">
      <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1 font-semibold">
        <span>Tren Laba ({data[0]?.Year} - {data[data.length - 1]?.Year})</span>
        <span className={`${values[values.length - 1] >= values[0] ? 'text-emerald-600' : 'text-rose-600'} font-bold flex items-center gap-0.5`}>
          {values[values.length - 1] >= values[0] ? '▲' : '▼'} {((values[values.length - 1] - values[0]) / Math.abs(values[0] || 1) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="bg-slate-50/60 rounded-xl p-2 border border-slate-100 flex items-center justify-center relative overflow-hidden">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          {/* Fill Area */}
          <polygon
            points={areaPath}
            fill={`url(#${gradientId})`}
          />
          {/* Line */}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={linePath}
          />
        </svg>
      </div>
    </div>
  )
}

function CompanyNetworkFlow({ ticker, companyName, subs, debts, sectorColor }) {
  const [hoverNode, setHoverNode] = useState(null) // id: string

  const hasProfile = useMemo(() => {
    return !!(SUPPLY_CHAIN_DATA && SUPPLY_CHAIN_DATA[ticker])
  }, [ticker])

  const profileData = useMemo(() => {
    return hasProfile ? SUPPLY_CHAIN_DATA[ticker] : null
  }, [hasProfile, ticker])

  // Process left nodes (Suppliers or Banks)
  const leftNodes = useMemo(() => {
    if (hasProfile) {
      return (profileData.upstream || []).map(s => ({
        id: s.id,
        logo: s.logo || s.name[0],
        name: s.name,
        subLabel: s.country || s.type,
        isSummary: false,
        relevance: s.relevance
      }))
    } else {
      // Process actual loans
      const loans = (debts || [])
        .filter(l => !isSummaryRow(l.Bank))
        .sort((a, b) => (b["Current Amount"] || 0) - (a["Current Amount"] || 0))

      if (loans.length === 0) return []
      if (loans.length <= 4) {
        return loans.map(l => ({
          id: l.Bank,
          logo: l.Bank[0] || 'B',
          name: l.Bank,
          subLabel: formatMoney(l["Current Amount"]),
          isSummary: false
        }))
      } else {
        const top3 = loans.slice(0, 3).map(l => ({
          id: l.Bank,
          logo: l.Bank[0] || 'B',
          name: l.Bank,
          subLabel: formatMoney(l["Current Amount"]),
          isSummary: false
        }))
        const sumRemaining = loans.slice(3).reduce((sum, curr) => sum + (curr["Current Amount"] || 0), 0)
        top3.push({
          id: 'remaining-banks',
          logo: '+',
          name: `+ ${loans.length - 3} Kreditur Lainnya`,
          subLabel: formatMoney(sumRemaining),
          isSummary: true
        })
        return top3
      }
    }
  }, [hasProfile, profileData, debts])

  // Process right nodes (Clients or Subsidiaries)
  const rightNodes = useMemo(() => {
    if (hasProfile) {
      return (profileData.downstream || []).map(c => ({
        id: c.id,
        logo: c.logo || c.name[0],
        name: c.name,
        subLabel: `${c.share}% Kontribusi`,
        isSummary: false
      }))
    } else {
      // Process actual subsidiaries
      const sortedSubs = [...subs].sort((a, b) => {
        const valA = parseFloat(a["Ownership Percentage"]) || 0
        const valB = parseFloat(b["Ownership Percentage"]) || 0
        return valB - valA
      })

      if (sortedSubs.length === 0) return []
      if (sortedSubs.length <= 4) {
        return sortedSubs.map(s => ({
          id: s["Subsidiary Name"],
          logo: s["Subsidiary Name"][0] || 'A',
          name: s["Subsidiary Name"],
          subLabel: `${s["Ownership Percentage"]}% Kepemilikan`,
          isSummary: false
        }))
      } else {
        const top3 = sortedSubs.slice(0, 3).map(s => ({
          id: s["Subsidiary Name"],
          logo: s["Subsidiary Name"][0] || 'A',
          name: s["Subsidiary Name"],
          subLabel: `${s["Ownership Percentage"]}% Kepemilikan`,
          isSummary: false
        }))
        top3.push({
          id: 'remaining-subs',
          logo: '+',
          name: `+ ${sortedSubs.length - 3} Anak Perusahaan`,
          subLabel: 'Kepemilikan Efektif',
          isSummary: true
        })
        return top3
      }
    }
  }, [hasProfile, profileData, subs])

  // Process internal nodes
  const internalNodes = useMemo(() => {
    if (hasProfile && profileData.internal) {
      return profileData.internal
    }
    return []
  }, [hasProfile, profileData])

  // Dimensions
  const width = 1000
  const height = hasProfile ? 600 : 360

  const focusX = 500
  const focusY = hasProfile ? 150 : 180

  // Coordinates
  const leftCoords = useMemo(() => {
    const count = leftNodes.length
    if (count === 0) return []
    const x = 160
    if (count === 1) return [{ x, y: focusY }]
    const startY = hasProfile ? 60 : 50
    const endY = hasProfile ? 560 : height - 50
    const space = (endY - startY) / (count - 1)
    return Array.from({ length: count }, (_, i) => ({ x, y: startY + i * space }))
  }, [leftNodes, focusY, height, hasProfile])

  const rightCoords = useMemo(() => {
    const count = rightNodes.length
    if (count === 0) return []
    const x = 840
    if (count === 1) return [{ x, y: focusY }]
    const startY = hasProfile ? 60 : 50
    const endY = hasProfile ? 560 : height - 50
    const space = (endY - startY) / (count - 1)
    return Array.from({ length: count }, (_, i) => ({ x, y: startY + i * space }))
  }, [rightNodes, focusY, height, hasProfile])

  const internalCoords = useMemo(() => {
    const count = internalNodes.length
    if (count === 0) return []
    const x = 500
    if (count === 1) return [{ x, y: 430 }]
    const startY = 310
    const endY = 550
    const space = (endY - startY) / (count - 1)
    return Array.from({ length: count }, (_, i) => ({ x, y: startY + i * space }))
  }, [internalNodes])

  const renderInternalIcon = (icon) => {
    const props = { className: "text-emerald-600", size: 16 }
    if (icon === 'factory') return <Building2 {...props} />
    if (icon === 'wrench') return <Wrench {...props} />
    if (icon === 'graduation') return <GraduationCap {...props} />
    return <Cpu {...props} />
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
      {/* Inline styles for flows and glows matching RantaiPasokTab */}
      <style>{`
        @keyframes flowRight {
          to {
            stroke-dashoffset: -20;
          }
        }
        @keyframes flowLeft {
          to {
            stroke-dashoffset: 20;
          }
        }
        .animate-flow-right-slow {
          stroke-dasharray: 6, 6;
          animation: flowRight 1.5s linear infinite;
        }
        .animate-flow-right-fast {
          stroke-dasharray: 6, 4;
          animation: flowRight 0.6s linear infinite;
        }
        .animate-flow-left-slow {
          stroke-dasharray: 6, 6;
          animation: flowLeft 1.5s linear infinite;
        }
        .animate-flow-left-fast {
          stroke-dasharray: 6, 4;
          animation: flowLeft 0.6s linear infinite;
        }
        .glow-pulse {
          animation: pulseGlow 2s infinite ease-in-out;
        }
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1.0);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.15);
          }
        }
      `}</style>

      <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
        <div>
          <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
            <Activity size={14} className="text-[#f27a1a] animate-pulse" />
            Diagram Rantai Pasok & Kreditur
          </h5>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {hasProfile
              ? 'Menampilkan profil rantai pasok komparatif (hulu, internal, hilir)'
              : 'Menampilkan visualisasi aliran kreditur bank (funding) & anak perusahaan (operasi)'}
          </p>
        </div>
        <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded uppercase tracking-wider">
          {hasProfile ? 'Profil Khusus' : 'Peta Dinamis'}
        </span>
      </div>

      <div className="w-full overflow-x-auto select-none py-2 flex justify-center">
        <div className="min-w-[950px] relative" style={{ height: `${height}px` }}>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="gradient-untr" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <filter id="glow-untr" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Draw Left Curves */}
            {leftNodes.map((node, i) => {
              const start = leftCoords[i]
              if (!start) return null
              const x1 = start.x
              const y1 = start.y
              const x2 = focusX - 36
              const y2 = focusY

              const cp1x = x1 + (x2 - x1) * 0.45
              const cp1y = y1
              const cp2x = x1 + (x2 - x1) * 0.55
              const cp2y = y2

              const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
              const isActive = hoverNode === node.id
              const isDimmed = hoverNode && hoverNode !== node.id && hoverNode !== 'focus'

              return (
                <path
                  key={`l-curve-${node.id}`}
                  d={d}
                  fill="none"
                  stroke={isActive ? '#3b82f6' : '#cbd5e1'}
                  strokeWidth={isActive ? 3.5 : 1.5}
                  opacity={hoverNode ? (isActive ? 1.0 : 0.4) : 0.85}
                  className={isActive ? 'animate-flow-right-fast' : 'animate-flow-right-slow'}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }}
                />
              )
            })}

            {/* Draw Right Curves */}
            {rightNodes.map((node, i) => {
              const end = rightCoords[i]
              if (!end) return null
              const x1 = focusX + 36
              const y1 = focusY
              const x2 = end.x
              const y2 = end.y

              const cp1x = x1 + (x2 - x1) * 0.45
              const cp1y = y1
              const cp2x = x1 + (x2 - x1) * 0.55
              const cp2y = y2

              const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
              const isActive = hoverNode === node.id
              const isDimmed = hoverNode && hoverNode !== node.id && hoverNode !== 'focus'

              return (
                <path
                  key={`r-curve-${node.id}`}
                  d={d}
                  fill="none"
                  stroke={isActive ? '#8b5cf6' : '#cbd5e1'}
                  strokeWidth={isActive ? 3.5 : 1.5}
                  opacity={hoverNode ? (isActive ? 1.0 : 0.4) : 0.85}
                  className={isActive ? 'animate-flow-right-fast' : 'animate-flow-right-slow'}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }}
                />
              )
            })}

            {/* Draw Internal vertical dashed curves */}
            {hasProfile && internalNodes.map((node, i) => {
              const pos = internalCoords[i]
              if (!pos) return null

              const x1 = focusX
              const y1 = focusY + 36
              const x2 = pos.x
              const y2 = pos.y - 18 // Top of internal node box

              const cp1x = x1
              const cp1y = y1 + (y2 - y1) * 0.35
              const cp2x = x2
              const cp2y = y1 + (y2 - y1) * 0.65

              const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
              const isActive = hoverNode === node.id

              return (
                <path
                  key={`int-curve-${node.id}`}
                  d={d}
                  fill="none"
                  stroke={isActive ? '#10b981' : '#cbd5e1'}
                  strokeWidth={isActive ? 3.5 : 1.5}
                  opacity={hoverNode ? (isActive ? 1.0 : 0.4) : 0.85}
                  className={isActive ? 'animate-flow-right-fast' : 'animate-flow-right-slow'}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }}
                />
              )
            })}

            {/* Draw Left Nodes */}
            {leftNodes.map((node, i) => {
              const pos = leftCoords[i]
              if (!pos) return null
              const isHovered = hoverNode === node.id
              const isDimmed = hoverNode && !isHovered && hoverNode !== 'focus'

              // Name formatting to match supply chain
              const displayName = hasProfile
                ? node.name.split(' ')[0]
                : node.name.replace(' Tbk', '').replace(' Ltd.', '').replace(' (Persero)', '').replace('PT ', '')

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoverNode(node.id)}
                  onMouseLeave={() => setHoverNode(null)}
                  className="cursor-pointer transition-all duration-200"
                  style={{ opacity: isDimmed ? 0.4 : 1 }}
                >
                  {/* Circle (matching RantaiPasok style) */}
                  <circle cx="0" cy="0" r="24" className="fill-slate-100 stroke-blue-500 stroke-2" />
                  <circle cx="0" cy="0" r="21" className="fill-blue-600" />
                  <text x="0" y="5" textAnchor="middle" className="fill-white font-bold text-sm select-none">
                    {node.logo}
                  </text>

                  {/* Label on the left of circle */}
                  <text x="-32" y="0" textAnchor="end" className="fill-slate-700 font-semibold text-[11px] select-none">
                    {displayName}
                  </text>
                  <text x="-32" y="12" textAnchor="end" className={`${hasProfile ? 'fill-slate-400' : 'fill-emerald-600 font-bold'} text-[9px] select-none`}>
                    {node.subLabel}
                  </text>
                </g>
              )
            })}

            {/* Draw Internal Nodes (value-add divisions) */}
            {hasProfile && internalNodes.map((node, i) => {
              const pos = internalCoords[i]
              if (!pos) return null
              const isHovered = hoverNode === node.id
              const isDimmed = hoverNode && !isHovered && hoverNode !== 'focus'
              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoverNode(node.id)}
                  onMouseLeave={() => setHoverNode(null)}
                  className="cursor-pointer transition-all duration-200"
                  style={{ opacity: isDimmed ? 0.4 : 1 }}
                >
                  <rect x="-95" y="-18" width="190" height="36" rx="6" className="fill-white stroke-emerald-500 stroke-2 shadow-sm" />
                  <g transform="translate(-80, -10)">
                    {renderInternalIcon(node.icon)}
                  </g>
                  <text x="-60" y="-2" textAnchor="start" className="fill-slate-700 font-bold text-[10px] select-none">
                    {node.name.length > 22 ? node.name.slice(0, 22) + ".." : node.name}
                  </text>
                  <text x="-60" y="10" textAnchor="start" className="fill-slate-400 text-[9px] select-none">
                    {node.role}
                  </text>
                </g>
              )
            })}

            {/* Draw Focal Center Node */}
            <g
              transform={`translate(${focusX}, ${focusY})`}
              onMouseEnter={() => setHoverNode('focus')}
              onMouseLeave={() => setHoverNode(null)}
              className="cursor-pointer"
            >
              {/* Outer pulsing ring */}
              <circle cx="0" cy="0" r="50" className="fill-amber-500/10 stroke-amber-500/30 stroke-1 animate-pulse" />
              <circle cx="0" cy="0" r="42" className="fill-amber-500/20 glow-pulse" />

              <circle cx="0" cy="0" r="36" className="fill-amber-500 stroke-amber-600 stroke-2" filter="url(#glow-untr)" />
              <Building2 className="text-white" size={24} style={{ transform: 'translate(-12px, -12px)' }} />

              <text x="0" y="52" textAnchor="middle" className="fill-slate-800 font-extrabold text-[12px] select-none">
                {ticker}
              </text>
              <text x="0" y="64" textAnchor="middle" className="fill-slate-400 font-medium text-[9px] select-none">
                {companyName.replace('PT ', '').replace(' Tbk', '')}
              </text>
            </g>

            {/* Draw Right Nodes */}
            {rightNodes.map((node, i) => {
              const pos = rightCoords[i]
              if (!pos) return null
              const isHovered = hoverNode === node.id
              const isDimmed = hoverNode && !isHovered && hoverNode !== 'focus'

              // Right side name formatting to match RantaiPasokTab
              const displayRightName = hasProfile
                ? node.id.toUpperCase()
                : node.name.replace(' Tbk', '').replace(' Ltd.', '').replace(' (Persero)', '').replace('PT ', '')

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoverNode(node.id)}
                  onMouseLeave={() => setHoverNode(null)}
                  className="cursor-pointer transition-all duration-200"
                  style={{ opacity: isDimmed ? 0.4 : 1 }}
                >
                  {/* Circle (matching RantaiPasok style) */}
                  <circle cx="0" cy="0" r="22" className="fill-slate-100 stroke-violet-500 stroke-2" />
                  <circle cx="0" cy="0" r="19" className="fill-violet-600" />
                  <text x="0" y="4" textAnchor="middle" className="fill-white font-bold text-xs select-none">
                    {node.logo}
                  </text>

                  {/* Label on the right of circle */}
                  <text x="30" y="-1" textAnchor="start" className="fill-slate-700 font-semibold text-[10px] select-none">
                    {displayRightName}
                  </text>
                  <text x="30" y="10" textAnchor="start" className={`${hasProfile ? 'fill-slate-400' : 'fill-orange-600 font-bold'} text-[8.5px] select-none`}>
                    {node.subLabel}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Placeholders for empty states */}
          {leftNodes.length === 0 && (
            <div className="absolute left-[30px] top-[140px] w-[180px] text-center text-[10px] text-slate-400 font-medium italic leading-normal border border-dashed border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              Tidak ada rincian kreditur bank komersial terdaftar
            </div>
          )}

          {rightNodes.length === 0 && (
            <div className="absolute right-[30px] top-[140px] w-[180px] text-center text-[10px] text-slate-400 font-medium italic leading-normal border border-dashed border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              Tidak ada rincian anak perusahaan terdaftar
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DeepDiveTab() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Data states
  const [mapData, setMapData] = useState(null)
  const [geoJson, setGeoJson] = useState(null)
  const [debtsData, setDebtsData] = useState(null)
  const [subsData, setSubsData] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [categoryMapping, setCategoryMapping] = useState(null)

  // Selection states
  const [selectedIdxSector, setSelectedIdxSector] = useState(null)
  const [selectedProvince, setSelectedProvince] = useState(null)
  const [hoverProvince, setHoverProvince] = useState(null)
  const [expandedCompany, setExpandedCompany] = useState(null) // Ticker code

  // POI & Hexagon states
  const [pois, setPois] = useState([])
  const [isLoadingPois, setIsLoadingPois] = useState(false)
  const [selectedHexagon, setSelectedHexagon] = useState(null) // { hexagonId, pois }
  const [mapInstance, setMapInstance] = useState(null)

  // Load datasets on mount
  useEffect(() => {
    setLoading(true)
    setLoadError(null)

    Promise.all([
      fetch('./map_province_data.json').then(r => {
        if (!r.ok) throw new Error(`map_province_data.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch(encodeURI(GEOJSON_URL)).then(r => {
        if (!r.ok) throw new Error(`GeoJSON: HTTP ${r.status}`)
        return r.json()
      }),
      fetch('./utang_bank.json').then(r => {
        if (!r.ok) throw new Error(`utang_bank.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch('./anak_perusahaan.json').then(r => {
        if (!r.ok) throw new Error(`anak_perusahaan.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch('./data.json').then(r => {
        if (!r.ok) throw new Error(`data.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch('./gmaps_category_mapping.json').then(r => {
        if (!r.ok) throw new Error(`gmaps_category_mapping.json: HTTP ${r.status}`)
        return r.json()
      }),
    ])
      .then(([md, geo, debts, subs, dd, catMap]) => {
        setMapData(md)
        setGeoJson(geo)
        setDebtsData(debts)
        setSubsData(subs)
        setDashboardData(dd)
        setCategoryMapping(catMap)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoadError(err.message || 'Gagal memuat data penelusuran')
        setLoading(false)
      })
  }, [])

  // Flat map located and unlocated companies for stats calculations
  const allCompanies = useMemo(() => {
    if (!mapData) return []
    const located = Object.values(mapData.companiesByProvince).flat()
    const unlocated = mapData.unlocatedCompanies || []
    return [...located, ...unlocated]
  }, [mapData])

  // Get historical trend data for a sector
  const getSectorHistory = useCallback((sec) => {
    if (!dashboardData || !dashboardData.sectorProfitPivot) return []
    return dashboardData.sectorProfitPivot
      .filter(item => item.Sektor === sec)
      .sort((a, b) => a.Year - b.Year)
  }, [dashboardData])

  // Count total emitens & profits dynamically for each of the 11 IDX sectors
  const sectorSummaryStats = useMemo(() => {
    const stats = {}
    Object.keys(SECTOR_COLORS).forEach(sec => {
      stats[sec] = { count: 0, profit: 0 }
    })

    allCompanies.forEach(c => {
      if (c.Sektor && stats[c.Sektor] !== undefined) {
        stats[c.Sektor].count++
        stats[c.Sektor].profit += c.NetIncome || 0
      }
    })

    return stats
  }, [allCompanies])

  // Get corresponding PDB sectors dynamically based on emitens in selected IDX sector
  const correspondingPdbSectors = useMemo(() => {
    if (!selectedIdxSector || !allCompanies.length) return []
    const sectorsSet = new Set()
    allCompanies.forEach(c => {
      if (c.Sektor === selectedIdxSector && c.sektor_pdb) {
        sectorsSet.add(c.sektor_pdb)
      }
    })
    return Array.from(sectorsSet)
  }, [selectedIdxSector, allCompanies])

  // Sum up all national PDB values to get the total national economy size
  const totalNationalPdb = useMemo(() => {
    if (!mapData || !mapData.nationalPdbStats) return 0
    return Object.values(mapData.nationalPdbStats).reduce((sum, s) => sum + (s.value || 0), 0)
  }, [mapData])

  // Get PDB stats (size, growth, share) for a given IDX sector dynamically
  const getSectorPdbStats = useCallback((secName) => {
    if (!mapData || !mapData.nationalPdbStats || !allCompanies.length) return null
    const linkedPdbSectors = new Set()
    allCompanies.forEach(c => {
      if (c.Sektor === secName && c.sektor_pdb) {
        linkedPdbSectors.add(c.sektor_pdb)
      }
    })

    if (linkedPdbSectors.size === 0) return null

    let totalValue = 0
    let weightedGrowthSum = 0
    let matchCount = 0

    linkedPdbSectors.forEach(pdbSec => {
      const stat = mapData.nationalPdbStats[pdbSec]
      if (stat) {
        totalValue += stat.value
        weightedGrowthSum += stat.growth * stat.value
        matchCount++
      }
    })

    if (matchCount === 0) return null
    const avgGrowth = totalValue > 0 ? (weightedGrowthSum / totalValue) : 0

    return {
      value: totalValue,
      growth: avgGrowth,
      sectors: Array.from(linkedPdbSectors)
    }
  }, [mapData, allCompanies])

  // Helper to sum PDRB values for a province based on active PDB sectors
  const getProvincePdrbForActiveSectors = useCallback((provinceName) => {
    if (!mapData || !provinceName || correspondingPdbSectors.length === 0) return 0
    const provStat = mapData.provinceStats[provinceName]
    if (!provStat) return 0

    let sum = 0
    if (provStat.top5Sectors) {
      correspondingPdbSectors.forEach(secName => {
        const normSec = normalizeSectorName(secName)
        const matched = provStat.top5Sectors.find(s => normalizeSectorName(s.sector) === normSec)
        if (matched) {
          sum += matched.value
        }
      })
    }
    return sum
  }, [mapData, correspondingPdbSectors])

  // Calculate maximum PDRB value across all provinces for choropleth mapping
  const maxPdrbValue = useMemo(() => {
    if (!mapData || !geoJson || correspondingPdbSectors.length === 0) return 1
    let max = 0
    geoJson.features.forEach(f => {
      const name = f.properties.PROVINSI
      const val = getProvincePdrbForActiveSectors(name)
      if (val > max) max = val
    })
    return max || 1
  }, [mapData, geoJson, correspondingPdbSectors, getProvincePdrbForActiveSectors])

  // Load POIs when a province is selected
  useEffect(() => {
    if (!selectedProvince || !selectedIdxSector || !categoryMapping || !geoJson) {
      setPois([]);
      setSelectedHexagon(null);
      return;
    }

    const loadProvincePOIs = async () => {
      setIsLoadingPois(true);
      setSelectedHexagon(null);

      const feature = geoJson.features.find(
        f => f.properties.PROVINSI === selectedProvince
      );

      if (!feature) {
        setPois([]);
        setIsLoadingPois(false);
        return;
      }

      const bbox = getFeatureBBox(feature);

      try {
        console.log(`🔍 Fetching POIs for ${selectedProvince} from Supabase...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

        let allData = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('pois_data')
            .select('poi_id, poi_name, sector, category, latitude, longitude, h3_index, address, rating, rating_count, gmaps_url, merchant_bank_name')
            .gte('latitude', bbox.minLat)
            .lte('latitude', bbox.maxLat)
            .gte('longitude', bbox.minLng)
            .lte('longitude', bbox.maxLng)
            .range(offset, offset + limit - 1)
            .abortSignal(controller.signal);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            console.log(`📦 Loaded chunk: ${data.length} records (total loaded: ${allData.length})`);
            if (data.length < limit || allData.length >= 20000) {
              if (allData.length > 20000) {
                allData = allData.slice(0, 20000);
              }
              hasMore = false;
            } else {
              offset += limit;
            }
          } else {
            hasMore = false;
          }
        }

        clearTimeout(timeoutId);

        if (allData.length > 0) {
          console.log(`✅ Loaded total ${allData.length} POIs inside bounding box from Supabase.`);

          const mapped = allData
            .filter(poi => isPointInFeature(poi.latitude, poi.longitude, feature))
            .map(poi => {
              const catClean = String(poi.category).trim().toLowerCase();
              const pdbSector = categoryMapping[catClean] || null;
              return {
                id: String(poi.poi_id),
                name: poi.poi_name,
                category: poi.category,
                coordinates: [poi.latitude, poi.longitude],
                h3_index: poi.h3_index || h3.latLngToCell(poi.latitude, poi.longitude, 8),
                pdbSector,
                address: poi.address,
                rating: poi.rating,
                ratingCount: poi.rating_count,
                gmapsUrl: poi.gmaps_url,
                merchantBank: poi.merchant_bank_name
              };
            });

          const matched = mapped.filter(poi =>
            poi.pdbSector && correspondingPdbSectors.includes(poi.pdbSector)
          );

          console.log(`✅ Filtered to ${matched.length} POIs matching sector ${selectedIdxSector}`);
          setPois(matched);
          setIsLoadingPois(false);
          return;
        } else {
          console.log('⚠️ No data returned from Supabase for this region. Falling back to mock generator.');
        }
      } catch (err) {
        console.warn('❌ Supabase POI fetch failed or timed out:', err.message || err);
        console.log('💡 Falling back to mock POI generation...');
      }

      // FALLBACK: Generate realistic mock POIs matching the category mapping
      const validCategories = Object.keys(categoryMapping).filter(cat =>
        correspondingPdbSectors.includes(categoryMapping[cat])
      );

      const categoriesToUse = validCategories.length > 0 ? validCategories : ['Kantor', 'Pabrik', 'Toko'];

      const sectorPdrb = getProvincePdrbForActiveSectors(selectedProvince);
      const count = Math.min(150, Math.max(30, Math.round(sectorPdrb / 5e9))) || 60;

      console.log(`Generating ${count} mock POIs for ${selectedProvince} in PDB sectors:`, correspondingPdbSectors);

      const mockPois = generateMockPOIs(feature, count, categoriesToUse);

      const mockPoisWithH3 = mockPois.map(poi => {
        try {
          const h3Index = h3.latLngToCell(poi.coordinates[0], poi.coordinates[1], 8);
          const catClean = String(poi.category).trim().toLowerCase();
          return {
            ...poi,
            h3_index: h3Index,
            pdbSector: categoryMapping[catClean]
          };
        } catch (e) {
          console.warn('H3 generation failed for coordinates:', poi.coordinates, e);
          return null;
        }
      }).filter(Boolean);

      console.log(`✅ Generated ${mockPoisWithH3.length} mock POIs with H3 indices.`);
      setPois(mockPoisWithH3);
      setIsLoadingPois(false);
    };

    loadProvincePOIs();
  }, [selectedProvince, selectedIdxSector, categoryMapping, geoJson, correspondingPdbSectors]);

  // Compute H3 hexagons
  const h3Hexagons = useMemo(() => {
    if (!selectedProvince || pois.length === 0) return [];

    const groups = {};
    pois.forEach(poi => {
      if (poi.h3_index) {
        if (!groups[poi.h3_index]) groups[poi.h3_index] = [];
        groups[poi.h3_index].push(poi);
      }
    });

    return Object.entries(groups).map(([h3Index, poisInCell]) => {
      try {
        const boundary = h3.cellToBoundary(h3Index);
        return {
          h3Index,
          boundary,
          pois: poisInCell,
          count: poisInCell.length
        };
      } catch (err) {
        console.warn(`Failed to get boundary for H3 index ${h3Index}:`, err);
        return null;
      }
    }).filter(Boolean);
  }, [selectedProvince, pois]);

  const maxPoiCountInHexagon = useMemo(() => {
    if (h3Hexagons.length === 0) return 1;
    return Math.max(...h3Hexagons.map(h => h.count)) || 1;
  }, [h3Hexagons]);

  // Map Polygon Style builder
  const mapStyle = useCallback(
    (feature) => {
      const name = feature.properties.PROVINSI
      const value = getProvincePdrbForActiveSectors(name)
      const selected = selectedProvince === name

      if (selectedProvince && !selected) {
        return {
          fillColor: '#cbd5e1',
          weight: 0.5,
          opacity: 0.3,
          color: '#94a3b8',
          fillOpacity: 0.1,
        }
      }

      return {
        fillColor: getChoroplethColor(value, maxPdrbValue),
        weight: selected ? 0 : 1,
        opacity: selected ? 0 : 1,
        color: selected ? 'transparent' : '#64748b',
        fillOpacity: selected ? 0 : 0.78,
      }
    },
    [maxPdrbValue, selectedProvince, getProvincePdrbForActiveSectors]
  )

  // Map events builder
  const onEachFeature = useCallback(
    (feature, layer) => {
      const name = feature.properties.PROVINSI
      const pdrbVal = getProvincePdrbForActiveSectors(name)

      // Count companies in this province matching the selected IDX sector
      const provCompanies = mapData?.companiesByProvince?.[name] || []
      const sectorCompCount = provCompanies.filter(c => c.Sektor === selectedIdxSector).length

      const tooltipContent = `
        <div class="font-sans p-1 text-slate-800">
          <div class="font-bold border-b pb-0.5 mb-1 text-[11px]">${name}</div>
          <div class="text-[10px]">📊 PDRB Gabungan Sektor: <strong class="text-orange-600">${formatMoney(pdrbVal)}</strong></div>
          <div class="text-[10px]">🏢 Emiten Sektor ${selectedIdxSector}: <strong>${sectorCompCount} emiten</strong></div>
        </div>
      `
      layer.bindTooltip(tooltipContent, { sticky: true })

      layer.on({
        mouseover: () => setHoverProvince(name),
        mouseout: () => setHoverProvince(null),
        click: () => {
          setSelectedProvince(name)
          setExpandedCompany(null) // Collapse expanded company when switching provinces
        },
      })
    },
    [mapData, selectedIdxSector, getProvincePdrbForActiveSectors]
  )

  // Mapped companies in active sector (nationwide)
  const filteredProvinceCompanies = useMemo(() => {
    if (!mapData || !selectedProvince || !selectedIdxSector) return []
    
    const allCompanies = []
    
    // Gather located companies from all provinces
    Object.keys(mapData.companiesByProvince).forEach(prov => {
      const list = mapData.companiesByProvince[prov] || []
      list.forEach(c => {
        if (c.Sektor === selectedIdxSector) {
          allCompanies.push(c)
        }
      })
    })
    
    // Gather unlocated companies
    if (mapData.unlocatedCompanies) {
      mapData.unlocatedCompanies.forEach(c => {
        if (c.Sektor === selectedIdxSector) {
          allCompanies.push(c)
        }
      })
    }
    
    // Sort by NetIncome descending (with nulls at the end)
    allCompanies.sort((a, b) => {
      const aVal = a.NetIncome !== null ? a.NetIncome : -Infinity
      const bVal = b.NetIncome !== null ? b.NetIncome : -Infinity
      return bVal - aVal
    })
    
    return allCompanies
  }, [mapData, selectedProvince, selectedIdxSector])

  // Group province companies by PDB subsektor
  const groupedCompaniesBySubsektor = useMemo(() => {
    const groups = {}
    filteredProvinceCompanies.forEach(c => {
      const sub = c.subsektor_pdb || 'Subsektor Lainnya'
      if (!groups[sub]) groups[sub] = []
      groups[sub].push(c)
    })
    return groups
  }, [filteredProvinceCompanies])

  // Stats for selected province
  const selectedProvStats = useMemo(() => {
    if (!mapData || !selectedProvince) return null
    return mapData.provinceStats[selectedProvince] || null
  }, [mapData, selectedProvince])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 space-y-4">
        <Activity className="animate-spin text-[#f27a1a]" size={36} />
        <p className="text-sm font-semibold">Memuat data penelusuran sektor...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center max-w-xl mx-auto my-12">
        <AlertTriangle className="text-red-500 mx-auto mb-3" size={36} />
        <h3 className="font-bold text-red-800 text-sm mb-1">Gagal Memuat Data</h3>
        <p className="text-xs text-red-600 mb-4">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
        >
          Muat Ulang Halaman
        </button>
      </div>
    )
  }

  // --- RENDERING LANDING PAGE GRID ---
  if (!selectedIdxSector) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Intro Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-36 h-36 bg-[#f27a1a]/5 rounded-full blur-2xl"></div>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#f27a1a]/10 text-[#f27a1a] rounded-2xl shrink-0">
              <Compass size={24} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">
                Deep Dive Alur Sektor: IDX Sektor → PDRB Regional
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Fitur ini membantu Anda menganalisis keselarasan korelasi bisnis di sektor pasar modal dengan
                sebaran data ekonomi makro di tingkat daerah. Pilih sektor pasar modal (IDX) di bawah ini untuk
                memetakan penyebaran kontribusi PDRB regional, menelusuri subsektor riil di setiap provinsi,
                serta mengeksplorasi hubungan rantai pasok dan utang bank emiten terkait.
              </p>
            </div>
          </div>
        </div>

        {/* National Macro Indicators Row */}
        {totalNationalPdb > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Globe size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Total PDB Makro RI</span>
                <strong className="text-slate-800 text-sm font-extrabold">{formatMoney(totalNationalPdb)}</strong>
                <span className="block text-[9px] text-slate-400 mt-0.5">(HB Tahunan 2025)</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Rata-rata Pertumbuhan</span>
                <strong className="text-emerald-600 text-sm font-extrabold">▲ 5.1%</strong>
                <span className="block text-[9px] text-slate-400 mt-0.5">(Rata-rata YoY Tertimbang)</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Building2 size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Rasio Laba IHSG / PDB</span>
                <strong className="text-slate-800 text-sm font-extrabold">
                  {((allCompanies.reduce((sum, c) => sum + (c.NetIncome || 0), 0) / totalNationalPdb) * 100).toFixed(2)}%
                </strong>
                <span className="block text-[9px] text-slate-400 mt-0.5">Laba Emiten vs PDB Nasional</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Sparkles size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">Kontributor Terbesar</span>
                <strong className="text-slate-800 text-xs font-extrabold block truncate leading-tight">Industri Pengolahan</strong>
                <span className="block text-[9px] text-amber-600 font-bold mt-0.5">18.6% Kontribusi</span>
              </div>
            </div>
          </div>
        )}

        {/* Sectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.keys(SECTOR_COLORS).map(sec => {
            const color = SECTOR_COLORS[sec]
            const IconComponent = SECTOR_ICONS[sec] || Compass
            const stats = sectorSummaryStats[sec] || { count: 0, profit: 0 }

            return (
              <div
                key={sec}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg flex flex-col justify-between"
                style={{ borderTop: `5px solid ${color}` }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="p-2 rounded-lg text-white"
                      style={{ backgroundColor: color }}
                    >
                      <IconComponent size={14} />
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight tracking-tight line-clamp-1" title={sec}>
                      {sec}
                    </h3>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-500 mb-3 font-medium">
                    <div className="flex justify-between border-b border-slate-50 pb-1">
                      <span>Emiten Terdaftar:</span>
                      <strong className="text-slate-800">{stats.count} emiten</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1">
                      <span>Total Laba Sektor:</span>
                      <strong className="text-emerald-600">{formatMoney(stats.profit)}</strong>
                    </div>
                  </div>

                  {(() => {
                    const pdbStats = getSectorPdbStats(sec)
                    if (!pdbStats) return null
                    const share = totalNationalPdb > 0 ? (pdbStats.value / totalNationalPdb) * 100 : 0
                    return (
                      <div className="space-y-1.5 text-[10px] bg-slate-50/70 p-2 rounded-xl border border-slate-100 mb-3 font-medium">
                        <div className="font-bold text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Korelasi Makro PDB</div>
                        <div className="flex justify-between border-b border-slate-100/50 pb-0.5">
                          <span>Ukuran Ekonomi Riil:</span>
                          <strong className="text-slate-800" title={pdbStats.sectors.join(', ')}>{formatMoney(pdbStats.value)}</strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-100/50 pb-0.5">
                          <span>Porsi PDB Nasional:</span>
                          <strong className="text-blue-600">{share.toFixed(1)}%</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Pertumbuhan PDB:</span>
                          <span className={`font-bold ${pdbStats.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {pdbStats.growth >= 0 ? '▲' : '▼'} {(pdbStats.growth * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  <SectorSparkline
                    data={getSectorHistory(sec)}
                    strokeColor={color}
                    sectorName={sec}
                  />
                </div>

                <button
                  onClick={() => {
                    setSelectedIdxSector(sec)
                    setSelectedProvince(null)
                    setExpandedCompany(null)
                  }}
                  className="w-full py-2 px-3 rounded-xl text-center text-xs font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer mt-3"
                  style={{ 
                    backgroundColor: color, 
                    boxShadow: `0 4px 12px -2px ${color}40`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(0.9)';
                    e.currentTarget.style.boxShadow = `0 6px 16px -1px ${color}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'none';
                    e.currentTarget.style.boxShadow = `0 4px 12px -2px ${color}40`;
                  }}
                >
                  Pilih Sektor
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // --- RENDERING DEEP DIVE FLOW PAGE ---
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedProvince) {
                setSelectedProvince(null)
                setSelectedHexagon(null)
              } else {
                setSelectedIdxSector(null)
                setExpandedCompany(null)
              }
            }}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer bg-white"
            title={selectedProvince ? "Kembali ke Peta Nasional" : "Kembali ke Daftar Sektor"}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest leading-none">SEKTOR IDX DEEP DIVE</div>
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mt-0.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: SECTOR_COLORS[selectedIdxSector] }}></span>
              Sektor {selectedIdxSector}
            </h2>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold leading-tight">Total Emiten</span>
            <strong className="text-slate-800 text-sm font-extrabold">
              {sectorSummaryStats[selectedIdxSector]?.count} emiten
            </strong>
          </div>
          <div className="border-l border-slate-200 h-6"></div>
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold leading-tight">Akumulasi Profit</span>
            <strong className="text-emerald-600 text-sm font-extrabold">
              {formatMoney(sectorSummaryStats[selectedIdxSector]?.profit)}
            </strong>
          </div>
        </div>
      </div>

      {/* Main interactive grid (Map + Sidebar metadata) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Leaflet Map Column */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 relative z-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs tracking-tight">
                Sebaran Kontribusi PDRB Regional (ADHK 2026)
              </h3>
              <p className="text-[10px] text-slate-400">
                Arahkan kursor atau klik provinsi untuk meninjau kecocokan aktivitas PDRB regional.
              </p>
            </div>

            <div className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded bg-slate-50 border border-slate-150">
              ADHK Regional 2026
            </div>
          </div>

          <div className="h-[580px] rounded-xl overflow-hidden border border-slate-200 relative">
            <MapContainer center={[-2.5, 118]} zoom={5} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution={CARTO_ATTRIBUTION}
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
              />
              <MapController
                selectedProvince={selectedProvince}
                geoJson={geoJson}
                onMapInstance={setMapInstance}
              />
              {geoJson && (
                <GeoJSON
                  key={selectedIdxSector + (selectedProvince || '')}
                  data={geoJson}
                  style={mapStyle}
                  onEachFeature={onEachFeature}
                />
              )}
              {selectedProvince && h3Hexagons.map(hex => {
                const baseColor = SECTOR_COLORS[selectedIdxSector] || '#f27a1a';
                const opacity = 0.25 + 0.6 * (hex.count / maxPoiCountInHexagon);
                const isSelected = selectedHexagon && selectedHexagon.hexagonId === hex.h3Index;

                return (
                  <Polygon
                    key={hex.h3Index}
                    positions={hex.boundary}
                    pathOptions={{
                      fillColor: baseColor,
                      fillOpacity: opacity,
                      color: isSelected ? '#ffffff' : baseColor,
                      weight: isSelected ? 2.5 : 0.8,
                      opacity: 0.9
                    }}
                    eventHandlers={{
                      click: () => {
                        if (selectedHexagon && selectedHexagon.hexagonId === hex.h3Index) {
                          setSelectedHexagon(null);
                        } else {
                          setSelectedHexagon({
                            hexagonId: hex.h3Index,
                            pois: hex.pois
                          });
                        }
                      }
                    }}
                  >
                    <Tooltip sticky>
                      <div className="p-1 font-sans text-xs text-slate-800">
                        <div className="font-bold border-b pb-0.5 mb-1 text-[11px]">H3 Hexagon Cell</div>
                        <div className="text-[10px]">Index: <span className="font-mono">{hex.h3Index}</span></div>
                        <div className="text-[10px]">Merchant Count: <strong className="text-orange-600">{hex.count}</strong></div>
                      </div>
                    </Tooltip>
                  </Polygon>
                );
              })}
            </MapContainer>
          </div>

          {/* Map Legend */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">PDRB Sektor Gabungan:</span>
            <span>Rendah</span>
            <div
              className="flex-grow max-w-[150px] h-2 rounded-full border border-slate-200/50 shadow-inner"
              style={{
                background: `linear-gradient(to right, ${CHOROPLETH_STOPS.map(s => {
                  const [r, g, b] = s.color
                  return `rgb(${r},${g},${b}) ${s.t * 100}%`
                }).join(', ')})`,
              }}
            />
            <span className="font-bold text-slate-700">
              0 → {formatMoney(maxPdrbValue / 2)} → {formatMoney(maxPdrbValue)}
            </span>
          </div>
        </div>

        {/* Sidebar Info & Province Stats Column */}
        <div className="lg:col-span-4 space-y-4">
          {/* Corresponding PDB sectors info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Info size={16} className="text-blue-600" />
              <h4 className="font-extrabold text-slate-800 text-xs">
                Korelasi Sektor PDB Makro
              </h4>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Sektor pasar modal <strong>{selectedIdxSector}</strong> berkorelasi langsung dengan kelompok lapangan usaha PDRB riil berikut:
            </p>

            <div className="flex flex-wrap gap-1 mt-2">
              {correspondingPdbSectors.map(sec => (
                <span
                  key={sec}
                  className="text-[9px] px-2 py-0.5 font-semibold bg-blue-50 text-blue-800 rounded border border-blue-100"
                >
                  {sec}
                </span>
              ))}
            </div>
          </div>

          {/* Selected Province indicators */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <MapPin size={16} className="text-orange-500" />
              <h4 className="font-extrabold text-slate-800 text-xs">
                {selectedProvince ? `Provinsi: ${selectedProvince}` : 'Informasi Daerah Terpilih'}
              </h4>
            </div>

            {!selectedProvince ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <HelpCircle size={30} className="mx-auto text-slate-300" />
                <p className="text-[11px] leading-relaxed">
                  Silakan klik salah satu wilayah provinsi di peta untuk meninjau indikator makro dan mendaftar emiten.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedProvStats && (
                  <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/80 text-[11px] space-y-2">
                    <div className="font-bold text-slate-700 text-[10px] uppercase tracking-wider border-b border-slate-100 pb-0.5">
                      Indikator Makro
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400 block">PDRB Daerah:</span>
                        <strong className="text-slate-800 block text-xs">{formatMoney(selectedProvStats.pdrb)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">UMR Regional:</span>
                        <strong className="text-slate-800 block text-xs">{selectedProvStats.umr || '-'}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block">PDRB Gabungan Sektor ({selectedIdxSector}):</span>
                        <strong className="text-orange-600 block text-xs">
                          {formatMoney(getProvincePdrbForActiveSectors(selectedProvince))}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Kawasan Industri:</span>
                        <strong className="text-slate-700 block">{selectedProvStats.kawasanIndustri || '-'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Jumlah Penduduk:</span>
                        <strong className="text-slate-700 block whitespace-nowrap overflow-hidden text-ellipsis">{selectedProvStats.jumlahPenduduk || '-'}</strong>
                      </div>
                      <div className="col-span-2 border-t pt-1 border-slate-200/50">
                        <span className="text-slate-400 block">Peluang Investasi Daerah:</span>
                        <strong className="text-blue-600 block">{selectedProvStats.peluang || '-'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* H3 Hexagon Density Analysis Card */}
                <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/80 text-[11px] space-y-2">
                  <div className="font-bold text-slate-700 text-[10px] uppercase tracking-wider border-b border-slate-100 pb-0.5 flex justify-between items-center">
                    <span>Sebaran Merchant & POI</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded">H3 Resolusi 8</span>
                  </div>

                  {isLoadingPois ? (
                    <div className="flex items-center justify-center py-4 text-slate-400 gap-1.5">
                      <Activity className="animate-spin text-orange-500" size={14} />
                      <span>Memuat data sebaran...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">Total POI Sektor {selectedIdxSector}:</span>
                        <strong className="text-slate-800 text-xs font-bold">{pois.length} POI</strong>
                      </div>

                      {pois.length > 0 && (
                        <div className="bg-white rounded border border-slate-150 p-1.5 max-h-[110px] overflow-y-auto space-y-1">
                          <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Kategori Terbanyak:</div>
                          {Object.entries(
                            pois.reduce((acc, p) => {
                              acc[p.category] = (acc[p.category] || 0) + 1;
                              return acc;
                            }, {})
                          )
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([cat, count]) => (
                              <div key={cat} className="flex justify-between items-center text-[9.5px] text-slate-650">
                                <span className="truncate max-w-[140px]" title={cat}>• {cat}</span>
                                <span className="font-bold text-slate-800">{count}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Hexagon Details Card */}
                {selectedHexagon && (
                  <div className="bg-gradient-to-br from-slate-50 to-orange-50/20 p-3 rounded-2xl border border-slate-200 text-[11px] space-y-2.5 shadow-sm animate-fade-in">
                    <div className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider border-b border-slate-100 pb-1 flex justify-between items-center">
                      <span className="flex items-center gap-1">
                        <Building2 size={13} className="text-orange-500 animate-pulse" />
                        Daftar Merchant di Cell H3
                      </span>
                      <button
                        onClick={() => setSelectedHexagon(null)}
                        className="text-[9.5px] text-slate-500 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 border-none rounded-md px-2 py-0.5 cursor-pointer transition-all"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-500 flex justify-between items-center">
                      <span>Cell ID: <strong className="font-mono text-slate-700">{selectedHexagon.hexagonId.substring(0, 15)}</strong></span>
                      <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold">{selectedHexagon.pois.length} Tempat</span>
                    </div>

                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
                      {selectedHexagon.pois.map(poi => {
                        const hasRating = poi.rating && poi.rating !== 'NULL' && poi.rating !== '';
                        const hasAddress = poi.address && poi.address !== 'NULL' && poi.address !== '';
                        const hasBank = poi.merchantBank && poi.merchantBank !== 'NULL' && poi.merchantBank !== '';

                        return (
                          <div key={poi.id} className="bg-white p-2.5 rounded-xl border border-slate-150 text-[10px] shadow-sm hover:border-slate-300 transition-all space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <div className="font-extrabold text-slate-800 leading-snug" title={poi.name}>{poi.name}</div>
                              {hasRating && (
                                <div className="shrink-0 flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-800 px-1 py-0.5 rounded-md text-[8.5px] font-bold">
                                  <span>⭐</span>
                                  <span>{poi.rating}</span>
                                  {poi.ratingCount && poi.ratingCount !== '0' && poi.ratingCount !== 'NULL' && (
                                    <span className="text-slate-400 font-normal text-[8px]">({poi.ratingCount})</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                {poi.category}
                              </span>
                              {poi.pdbSector && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                  {poi.pdbSector}
                                </span>
                              )}
                              {hasBank && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  💳 {poi.merchantBank}
                                </span>
                              )}
                            </div>

                            {hasAddress && (
                              <div className="text-[9px] text-slate-400 leading-normal flex items-start gap-1 mt-1 pt-1 border-t border-slate-50">
                                <span className="shrink-0 mt-0.5">📍</span>
                                <span className="truncate max-w-[200px]" title={poi.address}>{poi.address}</span>
                              </div>
                            )}

                            {poi.gmapsUrl && poi.gmapsUrl !== 'NULL' && (
                              <div className="flex justify-end pt-1">
                                <a
                                  href={poi.gmapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline text-[9px] font-extrabold"
                                >
                                  Buka Google Maps ↗
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-orange-50/30 p-2.5 rounded-lg border border-orange-200/40 text-[10px] text-orange-800 leading-normal flex items-start gap-1.5">
                  <Info size={13} className="text-[#f27a1a] shrink-0 mt-0.5" />
                  <p>
                    Menampilkan daftar emiten skala nasional untuk sektor {selectedIdxSector} pada tabel penelusuran di bawah (Kantor Pusat ditandai).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom section: Subsektor lists & emiten data (accordions) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
            <Layers size={18} className="text-indigo-600 animate-pulse" />
            Penelusuran Subsektor PDRB & Emiten
          </h3>
        </div>

        {!selectedProvince ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2">
            <MapPin size={36} className="text-slate-300" />
            <p className="text-xs max-w-md">
              Silakan klik salah satu wilayah/provinsi di peta Indonesia di atas untuk memuat pembagian subsektor PDRB beserta daftar emiten.
            </p>
          </div>
        ) : filteredProvinceCompanies.length === 0 ? (
          <div className="text-center py-16 text-slate-450 space-y-2">
            <Building2 size={36} className="mx-auto text-slate-300" />
            <h4 className="font-bold text-slate-700 text-xs">Tidak Ada Emiten Terdaftar</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tidak ditemukan adanya emiten komersial terdaftar di {selectedProvince} untuk kategori Sektor {selectedIdxSector}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              Ditemukan {Object.keys(groupedCompaniesBySubsektor).length} subsektor PDRB yang dihuni oleh emiten komersial di {selectedProvince}:
            </div>

            {Object.entries(groupedCompaniesBySubsektor).map(([subsektorName, companiesList]) => (
              <div
                key={subsektorName}
                className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50/20"
              >
                {/* Subsektor header line */}
                <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-200/80">
                  <span className="font-bold text-slate-800 text-xs">
                    Subsektor PDRB: {subsektorName}
                  </span>
                  <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[9px]">
                    {companiesList.length} Emiten
                  </span>
                </div>

                {/* Company Table inside subsektor */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-wider select-none">
                      <tr>
                        <th className="py-2.5 px-4">Ticker</th>
                        <th className="py-2.5 px-4">Nama Perusahaan</th>
                        <th className="py-2.5 px-4">Subindustri IDX</th>
                        <th className="py-2.5 px-4 text-right">Laba Bersih Terbaru</th>
                        <th className="py-2.5 px-4 text-center">Rantai Pasok & Bank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {companiesList.map(c => {
                        const isExpanded = expandedCompany === c.Ticker
                        return (
                          <>
                            <tr
                              key={c.Ticker}
                              onClick={() => setExpandedCompany(isExpanded ? null : c.Ticker)}
                              className="hover:bg-slate-50/50 transition-colors cursor-pointer align-top"
                            >
                              <td className="py-3 px-4 font-bold text-slate-900 text-sm select-all">{c.Ticker}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-700 text-xs">{c.NamaPerusahaan}</div>
                                {(() => {
                                  const isLocal = c.province === selectedProvince;
                                  return (
                                    <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                      Kantor Pusat: <span className={isLocal ? 'text-orange-600 font-extrabold bg-orange-50 px-1 rounded border border-orange-100' : 'text-slate-600 font-bold'}>{c.province || 'Tidak Diketahui'}</span>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-600 text-xs">{c.Subindustri || c.Industri || '-'}</div>
                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">IDX: {c.Sektor}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-extrabold text-slate-800 text-xs">
                                {formatMoney(c.NetIncome)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  className={`p-1.5 rounded-lg border transition-all ${isExpanded
                                    ? 'bg-orange-50 border-orange-200 text-[#f27a1a]'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                    }`}
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              </td>
                            </tr>

                            {/* Nested expanded row (Supply Chain & Bank details) */}
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={5} className="p-4 border-t border-b border-slate-150">
                                  <div className="space-y-6">
                                    <CompanyNetworkFlow
                                      ticker={c.Ticker}
                                      companyName={c.NamaPerusahaan}
                                      subs={subsData?.[c.Ticker]?.Subsidiaries || []}
                                      debts={debtsData?.[c.Ticker]?.Loans || []}
                                      sectorColor={SECTOR_COLORS[selectedIdxSector] || '#f27a1a'}
                                    />

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                      {/* Left: Subsidiaries/Supply Chain */}
                                      <div className="space-y-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                          <Layers size={14} className="text-[#f27a1a]" />
                                          Struktur Rantai Pasok & Anak Perusahaan
                                        </h5>

                                        {(() => {
                                          const companySubs = subsData?.[c.Ticker]
                                          if (!companySubs || !companySubs.Subsidiaries || companySubs.Subsidiaries.length === 0) {
                                            return (
                                              <div className="text-center py-8 text-slate-400 text-[10px]">
                                                Tidak ada data rantai pasok atau anak perusahaan untuk emiten ini.
                                              </div>
                                            )
                                          }

                                          return (
                                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                Total Anak Perusahaan: {companySubs.SubsidiariesCount || companySubs.Subsidiaries.length}
                                              </div>
                                              <div className="grid grid-cols-1 gap-2">
                                                {companySubs.Subsidiaries.map((s, idx) => (
                                                  <div
                                                    key={idx}
                                                    className="p-2.5 rounded-lg border border-slate-150 bg-slate-50/30 text-[11px] flex justify-between items-start gap-3"
                                                  >
                                                    <div className="space-y-0.5">
                                                      <div className="font-bold text-slate-800">{s["Subsidiary Name"]}</div>
                                                      <div className="text-[10px] text-slate-500">Aktivitas: {s["Business Activity"] || '-'}</div>
                                                      <div className="text-[9px] text-slate-400">Lokasi: {s.Location || '-'}</div>
                                                    </div>
                                                    <span className="shrink-0 bg-orange-50 text-[#f27a1a] font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-orange-100">
                                                      {s["Ownership Percentage"]}%
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>

                                      {/* Right: Bank Debt/Creditors */}
                                      <div className="space-y-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                                          <DollarSign size={14} className="text-[#f27a1a]" />
                                          Hubungan Kreditur & Utang Bank Komersial
                                        </h5>

                                        {(() => {
                                          const companyDebts = debtsData?.[c.Ticker]
                                          if (!companyDebts || !companyDebts.Loans) {
                                            return (
                                              <div className="text-center py-8 text-slate-400 text-[10px]">
                                                Tidak ada rincian liabilitas utang bank komersial yang terdaftar.
                                              </div>
                                            )
                                          }

                                          const actualLoans = companyDebts.Loans.filter(l => !isSummaryRow(l.Bank))
                                          if (actualLoans.length === 0) {
                                            return (
                                              <div className="text-center py-8 text-slate-400 text-[10px]">
                                                Tidak ada rincian liabilitas utang bank komersial yang terdaftar.
                                              </div>
                                            )
                                          }

                                          // Calculate sum of actual loans
                                          const totalLoansVal = actualLoans.reduce((sum, item) => sum + (item["Current Amount"] || 0), 0)

                                          return (
                                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider mb-1">
                                                <span className="text-slate-400">Pemberi Pinjaman: {actualLoans.length} Bank</span>
                                                <span className="text-emerald-600">Total: {formatMoney(totalLoansVal)}</span>
                                              </div>
                                              <div className="space-y-1.5">
                                                {actualLoans.map((l, idx) => (
                                                  <div
                                                    key={idx}
                                                    className="p-2.5 rounded-lg border border-slate-150 bg-slate-50/30 text-[11px] flex justify-between items-center gap-3"
                                                  >
                                                    <strong className="text-slate-800 font-bold">{l.Bank}</strong>
                                                    <div className="text-right shrink-0">
                                                      <span className="font-extrabold text-slate-800 block">{formatMoney(l["Current Amount"])}</span>
                                                      {l["Prior Amount"] > 0 && (
                                                        <span className="text-[9px] text-slate-400 block font-medium">Prior: {formatMoney(l["Prior Amount"])}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>

                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
