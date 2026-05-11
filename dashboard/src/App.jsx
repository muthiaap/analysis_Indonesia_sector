import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieIcon, Activity, ArrowUpRight, X } from 'lucide-react'

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  '#14b8a6'
]

const SECTOR_COLORS = {
  'Barang Baku': '#3b82f6',
  'Barang Konsumen Non-Primer': '#ef4444',
  'Barang Konsumen Primer': '#10b981',
  'Energi': '#f59e0b',
  'Infrastruktur': '#8b5cf6',
  'Kesehatan': '#ec4899',
  'Keuangan': '#06b6d4',
  'Perindustrian': '#f97316',
  'Properti & Real Estat': '#84cc16',
  'Teknologi': '#6366f1',
  'Transportasi & Logistik': '#14b8a6',
}

function formatMoney(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const absVal = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (absVal >= 1e12) return sign + 'Rp ' + (absVal / 1e12).toFixed(2) + ' T'
  if (absVal >= 1e9) return sign + 'Rp ' + (absVal / 1e9).toFixed(2) + ' B'
  if (absVal >= 1e6) return sign + 'Rp ' + (absVal / 1e6).toFixed(2) + ' M'
  return sign + 'Rp ' + absVal.toLocaleString()
}

function formatMoneyShort(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const absVal = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (absVal >= 1e12) return sign + (absVal / 1e12).toFixed(1) + 'T'
  if (absVal >= 1e9) return sign + (absVal / 1e9).toFixed(1) + 'B'
  if (absVal >= 1e6) return sign + (absVal / 1e6).toFixed(1) + 'M'
  return sign + absVal.toLocaleString()
}

function formatPercent(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  return (val * 100).toFixed(1) + '%'
}

function parseMoneyInput(val) {
  if (!val) return null
  const s = val.toLowerCase().replace(/[^0-9.tbm-]/g, '')
  if (!s) return null
  const multiplier = s.endsWith('t') ? 1e12 : s.endsWith('b') ? 1e9 : s.endsWith('m') ? 1e6 : 1
  const num = parseFloat(s.replace(/[tbm]/g, ''))
  if (isNaN(num)) return null
  return num * multiplier
}

function parsePercentInput(val) {
  if (!val) return null
  const num = parseFloat(val.replace('%', ''))
  if (isNaN(num)) return null
  return num / 100
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-semibold mb-2 text-slate-700">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600 flex-1">{entry.name}:</span>
          <span className="font-medium text-slate-800">{formatMoney(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

const PercentTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-semibold mb-2 text-slate-700">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600 flex-1">{entry.name}:</span>
          <span className="font-medium text-slate-800">{formatPercent(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [selectedSector, setSelectedSector] = useState(null)
  const [selectedSubindustry, setSelectedSubindustry] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [subSearchTerm, setSubSearchTerm] = useState('')
  const [subSectorFilter, setSubSectorFilter] = useState('All')

  // Table sort & filters
  const [sectorSort, setSectorSort] = useState({ column: 'NetIncome', direction: 'desc' })
  const [subSort, setSubSort] = useState({ column: 'NetIncome', direction: 'desc' })
  const [sectorFilters, setSectorFilters] = useState({ minProfit: '', maxProfit: '', minGrowth: '', maxGrowth: '' })
  const [subFilters, setSubFilters] = useState({ minProfit: '', maxProfit: '', minGrowth: '', maxGrowth: '' })

  useEffect(() => {
    fetch('./data.json')
      .then(r => r.json())
      .then(setData)
  }, [])

  const {
    improvementChartData,
    profitChartData,
    sectorGrowthSorted,
    topCompanies,
    sectorLatestSorted,
    subindustryChartData,
    subindustryLatestSorted,
    latestYear,
    totalLatestProfit,
    totalPreviousProfit,
    overallGrowth,
    bestSector,
    worstSector
  } = useMemo(() => {
    if (!data) return {}

    const sectors = data.sectors || []
    const years = (data.years || []).sort((a, b) => a - b)
    const latest = data.latestYear || years[years.length - 1]

    // Improvement stacked bar data: each entry is a year, each key is a sector
    const improvementMap = {}
    data.sectorImprovement.forEach(d => {
      if (!improvementMap[d.Year]) improvementMap[d.Year] = {}
      improvementMap[d.Year][d.Sektor] = d.Improvement
    })
    const improvementChartData = years.slice(1).map(year => {
      const entry = { year: String(year) }
      sectors.forEach(s => {
        entry[s] = improvementMap[year]?.[s] ?? 0
      })
      return entry
    }).filter(d => Object.keys(d).some(k => k !== 'year' && d[k] !== 0))

    // Total profit stacked bar data
    const profitMap = {}
    data.sectorProfitPivot.forEach(d => {
      if (!profitMap[d.Year]) profitMap[d.Year] = {}
      profitMap[d.Year][d.Sektor] = d.NetIncome
    })
    const profitChartData = years.map(year => {
      const entry = { year: String(year) }
      sectors.forEach(s => {
        entry[s] = profitMap[year]?.[s] ?? 0
      })
      return entry
    }).filter(d => Object.keys(d).some(k => k !== 'year' && d[k] !== 0))

    // Sector growth sorted
    const sectorGrowthSorted = (data.sectorGrowth || [])
      .sort((a, b) => b.GrowthRate - a.GrowthRate)

    // Top companies
    const topCompanies = (data.topCompanies || [])
      .sort((a, b) => b.NetIncome - a.NetIncome)
      .slice(0, 15)

    // Sector latest sorted
    const sectorLatestSorted = (data.sectorLatest || [])
      .sort((a, b) => b.NetIncome - a.NetIncome)

    // Subindustry growth: top 15 best + bottom 5 worst
    const allSub = (data.subindustryGrowth || []).sort((a, b) => b.GrowthRate - a.GrowthRate)
    const topSub = allSub.slice(0, 15)
    const bottomSub = allSub.slice(-5).reverse()
    const subindustryChartData = [...topSub, ...bottomSub]

    const subindustryLatestSorted = (data.subindustryLatest || [])
      .sort((a, b) => b.NetIncome - a.NetIncome)

    const totalLatestProfit = sectorLatestSorted.reduce((sum, s) => sum + (s.NetIncome || 0), 0)
    const prevYear = latest - 1
    const prevMap = {}
    data.sectorProfitPivot.forEach(d => {
      if (d.Year === prevYear) prevMap[d.Sektor] = d.NetIncome
    })
    const totalPreviousProfit = sectors.reduce((sum, s) => sum + (prevMap[s] || 0), 0)
    const overallGrowth = totalPreviousProfit !== 0
      ? (totalLatestProfit - totalPreviousProfit) / Math.abs(totalPreviousProfit)
      : 0

    const bestSector = sectorGrowthSorted[0] || null
    const worstSector = sectorGrowthSorted[sectorGrowthSorted.length - 1] || null

    return {
      improvementChartData,
      profitChartData,
      sectorGrowthSorted,
      topCompanies,
      sectorLatestSorted,
      subindustryChartData,
      subindustryLatestSorted,
      latestYear: latest,
      totalLatestProfit,
      totalPreviousProfit,
      overallGrowth,
      bestSector,
      worstSector
    }
  }, [data])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <div className="flex items-center gap-2">
          <Activity className="animate-spin" size={20} />
          Loading dashboard data...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Laporan Keuangan Dashboard</h1>
              <p className="text-sm text-slate-500">Analisis Profitabilitas per Sektor</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Data Tahun</div>
            <div className="font-semibold text-slate-800">{latestYear}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">Total Profit {latestYear}</div>
            <div className="text-2xl font-bold text-slate-800">{formatMoneyShort(totalLatestProfit)}</div>
            <div className={`text-sm mt-1 flex items-center gap-1 ${overallGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {overallGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatPercent(overallGrowth)} vs {latestYear - 1}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">Sektor Terbaik (Growth)</div>
            <div className="text-lg font-bold text-slate-800 truncate">{bestSector?.Sektor || '-'}</div>
            <div className="text-sm text-emerald-600 mt-1 font-medium">
              {formatPercent(bestSector?.GrowthRate)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">Sektor Terburuk (Growth)</div>
            <div className="text-lg font-bold text-slate-800 truncate">{worstSector?.Sektor || '-'}</div>
            <div className="text-sm text-red-500 mt-1 font-medium">
              {formatPercent(worstSector?.GrowthRate)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">Jumlah Sektor</div>
            <div className="text-2xl font-bold text-slate-800">{data.sectors.length}</div>
            <div className="text-sm text-slate-400 mt-1">{data.sectors.length} sektor tersedia</div>
          </div>
        </div>

        {/* Row 1: Stacked Improvement Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Improvement Profit per Sektor (YoY)</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Perubahan profit bersih tahunan per sektor. Segmen positif menunjukkan peningkatan profit, segmen negatif menunjukkan penurunan.
          </p>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={improvementChartData} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => formatMoneyShort(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              {data.sectors.map((sector, i) => (
                <Bar
                  key={sector}
                  dataKey={sector}
                  stackId="a"
                  fill={SECTOR_COLORS[sector] || COLORS[i % COLORS.length]}
                  radius={i === data.sectors.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Row 2: Total Profit + Sector Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-800">Total Profit per Sektor</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Profit bersih total (annualised) per sektor setiap tahun.
            </p>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={profitChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => formatMoneyShort(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                {data.sectors.map((sector, i) => (
                  <Bar
                    key={sector}
                    dataKey={sector}
                    stackId="b"
                    fill={SECTOR_COLORS[sector] || COLORS[i % COLORS.length]}
                    radius={i === data.sectors.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-fuchsia-600" />
              <h2 className="text-lg font-bold text-slate-800">Growth Rate per Sektor ({latestYear} vs {latestYear - 1})</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Persentase perubahan profit tahunan per sektor.
            </p>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={sectorGrowthSorted} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => formatPercent(v)} />
                <YAxis type="category" dataKey="Sektor" tick={{ fontSize: 11, fill: '#475569' }} width={140} />
                <Tooltip content={<PercentTooltip />} />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <Bar
                  dataKey="GrowthRate"
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => setSelectedSector(data.Sektor)}
                  cursor="pointer"
                >
                  {sectorGrowthSorted.map((entry, i) => (
                    <Cell
                      key={entry.Sektor}
                      fill={entry.GrowthRate >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 3: Subindustry Growth */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold text-slate-800">Growth Rate per Subindustri ({latestYear} vs {latestYear - 1})</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Top 15 sektor dengan pertumbuhan terbaik & 5 terburuk. Klik bar untuk melihat detail.
          </p>
          <ResponsiveContainer width="100%" height={520}>
            <BarChart data={subindustryChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => formatPercent(v)} />
              <YAxis
                type="category"
                dataKey="Subindustri"
                tick={{ fontSize: 10, fill: '#475569' }}
                width={180}
              />
              <Tooltip content={<PercentTooltip />} />
              <ReferenceLine x={0} stroke="#94a3b8" />
              <Bar dataKey="GrowthRate" radius={[0, 4, 4, 0]}>
                {subindustryChartData.map((entry, i) => (
                  <Cell
                    key={entry.Subindustri}
                    fill={entry.GrowthRate >= 0 ? '#8b5cf6' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Row 4: Pie Chart + Top Companies */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon size={20} className="text-amber-600" />
              <h2 className="text-lg font-bold text-slate-800">Komposisi Profit {latestYear}</h2>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={sectorLatestSorted}
                  dataKey="NetIncome"
                  nameKey="Sektor"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {sectorLatestSorted.map((entry, i) => (
                    <Cell
                      key={entry.Sektor}
                      fill={SECTOR_COLORS[entry.Sektor] || COLORS[i % COLORS.length]}
                      onClick={() => setSelectedSector(entry.Sektor)}
                      cursor="pointer"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={20} className="text-cyan-600" />
              <h2 className="text-lg font-bold text-slate-800">Top 15 Perusahaan (Profit {latestYear})</h2>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topCompanies} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => formatMoneyShort(v)} />
                <YAxis type="category" dataKey="Ticker" tick={{ fontSize: 12, fill: '#475569' }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="NetIncome" radius={[0, 4, 4, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 4: Sector Detail Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">Detail per Sektor ({latestYear} vs {latestYear - 1})</h2>
          </div>
          <div className="mb-4 flex gap-3 flex-wrap items-end">
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-500">Profit:</label>
              <input
                type="text"
                placeholder="Min"
                value={sectorFilters.minProfit}
                onChange={(e) => setSectorFilters({...sectorFilters, minProfit: e.target.value})}
                className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="text"
                placeholder="Max"
                value={sectorFilters.maxProfit}
                onChange={(e) => setSectorFilters({...sectorFilters, maxProfit: e.target.value})}
                className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-500">Growth:</label>
              <input
                type="text"
                placeholder="Min %"
                value={sectorFilters.minGrowth}
                onChange={(e) => setSectorFilters({...sectorFilters, minGrowth: e.target.value})}
                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="text"
                placeholder="Max %"
                value={sectorFilters.maxGrowth}
                onChange={(e) => setSectorFilters({...sectorFilters, maxGrowth: e.target.value})}
                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => setSectorFilters({ minProfit: '', maxProfit: '', minGrowth: '', maxGrowth: '' })}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              Reset filters
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium cursor-pointer hover:text-indigo-600" onClick={() => setSectorSort({ column: 'Sektor', direction: sectorSort.column === 'Sektor' && sectorSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Sektor {sectorSort.column === 'Sektor' && (sectorSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-indigo-600" onClick={() => setSectorSort({ column: 'Current', direction: sectorSort.column === 'Current' && sectorSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Profit {latestYear} {sectorSort.column === 'Current' && (sectorSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-indigo-600" onClick={() => setSectorSort({ column: 'Previous', direction: sectorSort.column === 'Previous' && sectorSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Profit {latestYear - 1} {sectorSort.column === 'Previous' && (sectorSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-indigo-600" onClick={() => setSectorSort({ column: 'Improvement', direction: sectorSort.column === 'Improvement' && sectorSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Improvement {sectorSort.column === 'Improvement' && (sectorSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-indigo-600" onClick={() => setSectorSort({ column: 'GrowthRate', direction: sectorSort.column === 'GrowthRate' && sectorSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Growth Rate {sectorSort.column === 'GrowthRate' && (sectorSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 font-medium text-right cursor-pointer hover:text-indigo-600" onClick={() => setSectorSort({ column: 'Share', direction: sectorSort.column === 'Share' && sectorSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Share {sectorSort.column === 'Share' && (sectorSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sectorGrowthSorted
                  .filter(s => {
                    const minProfit = parseMoneyInput(sectorFilters.minProfit)
                    const maxProfit = parseMoneyInput(sectorFilters.maxProfit)
                    const minGrowth = parsePercentInput(sectorFilters.minGrowth)
                    const maxGrowth = parsePercentInput(sectorFilters.maxGrowth)
                    if (minProfit !== null && s.Current < minProfit) return false
                    if (maxProfit !== null && s.Current > maxProfit) return false
                    if (minGrowth !== null && s.GrowthRate < minGrowth) return false
                    if (maxGrowth !== null && s.GrowthRate > maxGrowth) return false
                    return true
                  })
                  .sort((a, b) => {
                    let cmp = 0
                    if (sectorSort.column === 'Sektor') {
                      cmp = a.Sektor.localeCompare(b.Sektor)
                    } else if (sectorSort.column === 'Share') {
                      const shareA = totalLatestProfit ? (sectorLatestSorted.find(x => x.Sektor === a.Sektor)?.NetIncome || 0) / totalLatestProfit : 0
                      const shareB = totalLatestProfit ? (sectorLatestSorted.find(x => x.Sektor === b.Sektor)?.NetIncome || 0) / totalLatestProfit : 0
                      cmp = shareA - shareB
                    } else {
                      cmp = a[sectorSort.column] - b[sectorSort.column]
                    }
                    return sectorSort.direction === 'asc' ? cmp : -cmp
                  })
                  .map((s) => {
                    const latestEntry = sectorLatestSorted.find(x => x.Sektor === s.Sektor)
                    const share = totalLatestProfit ? (latestEntry?.NetIncome || 0) / totalLatestProfit : 0
                    return (
                      <tr
                        key={s.Sektor}
                        className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedSector(s.Sektor)}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: SECTOR_COLORS[s.Sektor] || '#cbd5e1' }}
                            />
                            <span className="font-medium text-slate-700">{s.Sektor}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium text-slate-800">{formatMoneyShort(s.Current)}</td>
                        <td className="py-2.5 pr-4 text-right text-slate-500">{formatMoneyShort(s.Previous)}</td>
                        <td className={`py-2.5 pr-4 text-right font-medium ${s.Improvement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {s.Improvement >= 0 ? '+' : ''}{formatMoneyShort(s.Improvement)}
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-medium ${s.GrowthRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatPercent(s.GrowthRate)}
                        </td>
                        <td className="py-2.5 text-right text-slate-500">{formatPercent(share)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 5: Subindustry Detail Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold text-slate-800">Detail per Subindustri ({latestYear} vs {latestYear - 1})</h2>
          </div>
          <div className="mb-3 flex gap-3 flex-wrap items-end">
            <input
              type="text"
              placeholder="Cari subindustri..."
              value={subSearchTerm}
              onChange={(e) => setSubSearchTerm(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              style={{ minWidth: 200, flex: 1, maxWidth: 300 }}
            />
            <select
              value={subSectorFilter}
              onChange={(e) => setSubSectorFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
            >
              <option value="All">Semua Sektor</option>
              {data.sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-500">Profit:</label>
              <input
                type="text"
                placeholder="Min"
                value={subFilters.minProfit}
                onChange={(e) => setSubFilters({...subFilters, minProfit: e.target.value})}
                className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="text"
                placeholder="Max"
                value={subFilters.maxProfit}
                onChange={(e) => setSubFilters({...subFilters, maxProfit: e.target.value})}
                className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-500">Growth:</label>
              <input
                type="text"
                placeholder="Min %"
                value={subFilters.minGrowth}
                onChange={(e) => setSubFilters({...subFilters, minGrowth: e.target.value})}
                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="text"
                placeholder="Max %"
                value={subFilters.maxGrowth}
                onChange={(e) => setSubFilters({...subFilters, maxGrowth: e.target.value})}
                className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <button
              onClick={() => setSubFilters({ minProfit: '', maxProfit: '', minGrowth: '', maxGrowth: '' })}
              className="text-xs text-violet-600 hover:text-violet-800 underline"
            >
              Reset filters
            </button>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'Subindustri', direction: subSort.column === 'Subindustri' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Subindustri {subSort.column === 'Subindustri' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'Sektor', direction: subSort.column === 'Sektor' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Sektor {subSort.column === 'Sektor' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'NetIncome', direction: subSort.column === 'NetIncome' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Profit {latestYear} {subSort.column === 'NetIncome' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'PrevNetIncome', direction: subSort.column === 'PrevNetIncome' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Profit {latestYear - 1} {subSort.column === 'PrevNetIncome' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'Improvement', direction: subSort.column === 'Improvement' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Improvement {subSort.column === 'Improvement' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 pr-4 font-medium text-right cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'GrowthRate', direction: subSort.column === 'GrowthRate' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Growth Rate {subSort.column === 'GrowthRate' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 font-medium text-right cursor-pointer hover:text-violet-600" onClick={() => setSubSort({ column: 'Share', direction: subSort.column === 'Share' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                    Share {subSort.column === 'Share' && (subSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {subindustryLatestSorted
                  .filter(s => {
                    const matchesSearch = !subSearchTerm || s.Subindustri.toLowerCase().includes(subSearchTerm.toLowerCase()) || s.Sektor.toLowerCase().includes(subSearchTerm.toLowerCase())
                    const matchesSector = subSectorFilter === 'All' || s.Sektor === subSectorFilter
                    const minProfit = parseMoneyInput(subFilters.minProfit)
                    const maxProfit = parseMoneyInput(subFilters.maxProfit)
                    const minGrowth = parsePercentInput(subFilters.minGrowth)
                    const maxGrowth = parsePercentInput(subFilters.maxGrowth)
                    if (minProfit !== null && s.NetIncome < minProfit) return false
                    if (maxProfit !== null && s.NetIncome > maxProfit) return false
                    if (minGrowth !== null && (s.GrowthRate || 0) < minGrowth) return false
                    if (maxGrowth !== null && (s.GrowthRate || 0) > maxGrowth) return false
                    return matchesSearch && matchesSector
                  })
                  .sort((a, b) => {
                    let cmp = 0
                    if (subSort.column === 'Subindustri') {
                      cmp = a.Subindustri.localeCompare(b.Subindustri)
                    } else if (subSort.column === 'Sektor') {
                      cmp = a.Sektor.localeCompare(b.Sektor)
                    } else if (subSort.column === 'Share') {
                      const shareA = totalLatestProfit ? (a.NetIncome || 0) / totalLatestProfit : 0
                      const shareB = totalLatestProfit ? (b.NetIncome || 0) / totalLatestProfit : 0
                      cmp = shareA - shareB
                    } else {
                      cmp = (a[subSort.column] || 0) - (b[subSort.column] || 0)
                    }
                    return subSort.direction === 'asc' ? cmp : -cmp
                  })
                  .map((s, i) => {
                    const share = totalLatestProfit ? (s.NetIncome || 0) / totalLatestProfit : 0
                    return (
                      <tr
                        key={s.Subindustri}
                        className="border-b border-slate-100 hover:bg-violet-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedSubindustry(s.Subindustri)}
                      >
                        <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                        <td className="py-2 pr-4 font-medium text-slate-700">{s.Subindustri}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: SECTOR_COLORS[s.Sektor] || '#cbd5e1' }}
                            />
                            <span className="text-slate-600">{s.Sektor}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right font-medium text-slate-800">{formatMoneyShort(s.NetIncome)}</td>
                        <td className="py-2 pr-4 text-right text-slate-500">{formatMoneyShort(s.PrevNetIncome)}</td>
                        <td className={`py-2 pr-4 text-right font-medium ${(s.Improvement || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {s.Improvement >= 0 ? '+' : ''}{formatMoneyShort(s.Improvement)}
                        </td>
                        <td className={`py-2 pr-4 text-right font-medium ${(s.GrowthRate || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatPercent(s.GrowthRate)}
                        </td>
                        <td className="py-2 text-right text-slate-500">{formatPercent(share)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sector Detail Modal */}
        {selectedSector && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) { setSelectedSector(null); setSearchTerm('') }
            }}
          >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: SECTOR_COLORS[selectedSector] || '#cbd5e1' }}
                  />
                  <h3 className="text-lg font-bold text-slate-800">{selectedSector}</h3>
                  <span className="text-sm text-slate-500">— Annualised Profit {latestYear}</span>
                </div>
                <button
                  onClick={() => { setSelectedSector(null); setSearchTerm('') }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Cari ticker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="overflow-auto flex-1 px-5 py-2">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-4 font-medium">Ticker</th>
                      <th className="py-2 pr-4 font-medium">Subsektor</th>
                      <th className="py-2 pr-4 font-medium">Industri</th>
                      <th className="py-2 pr-4 font-medium text-right">Profit {latestYear}</th>
                      <th className="py-2 pr-4 font-medium text-right">Profit {latestYear - 1}</th>
                      <th className="py-2 font-medium text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.companiesBySector[selectedSector] || [])
                      .filter(c => !searchTerm || c.Ticker.toLowerCase().includes(searchTerm.toLowerCase()) || (c.Subsektor || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((c, i) => (
                        <tr key={c.Ticker} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-4 font-semibold text-slate-700">{c.Ticker}</td>
                          <td className="py-2 pr-4 text-slate-600">{c.Subsektor || '-'}</td>
                          <td className="py-2 pr-4 text-slate-600">{c.Industri || '-'}</td>
                          <td className="py-2 pr-4 text-right font-medium text-slate-800">{formatMoneyShort(c.NetIncome)}</td>
                          <td className="py-2 pr-4 text-right text-slate-500">{formatMoneyShort(c.PrevNetIncome)}</td>
                          <td className={`py-2 text-right font-medium ${(c.GrowthRate || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatPercent(c.GrowthRate)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(data.companiesBySector[selectedSector] || []).length === 0 && (
                  <div className="text-center text-slate-400 py-8">Tidak ada data perusahaan</div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-400 flex justify-between">
                <span>{(data.companiesBySector[selectedSector] || []).length} perusahaan</span>
                <span>Klik di luar untuk tutup</span>
              </div>
            </div>
          </div>
        )}

        {/* Subindustry Detail Modal */}
        {selectedSubindustry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) { setSelectedSubindustry(null); setSearchTerm('') }
            }}
          >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: SECTOR_COLORS[(data.companiesBySubindustry[selectedSubindustry]?.[0]?.Sektor)] || '#8b5cf6' }}
                  />
                  <h3 className="text-lg font-bold text-slate-800">{selectedSubindustry}</h3>
                  <span className="text-sm text-slate-500">— Annualised Profit {latestYear}</span>
                </div>
                <button
                  onClick={() => { setSelectedSubindustry(null); setSearchTerm('') }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Cari ticker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="overflow-auto flex-1 px-5 py-2">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-4 font-medium">Ticker</th>
                      <th className="py-2 pr-4 font-medium">Subsektor</th>
                      <th className="py-2 pr-4 font-medium">Industri</th>
                      <th className="py-2 pr-4 font-medium text-right">Profit {latestYear}</th>
                      <th className="py-2 pr-4 font-medium text-right">Profit {latestYear - 1}</th>
                      <th className="py-2 font-medium text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.companiesBySubindustry[selectedSubindustry] || [])
                      .filter(c => !searchTerm || c.Ticker.toLowerCase().includes(searchTerm.toLowerCase()) || (c.Subsektor || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((c, i) => (
                        <tr key={c.Ticker} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-4 font-semibold text-slate-700">{c.Ticker}</td>
                          <td className="py-2 pr-4 text-slate-600">{c.Subsektor || '-'}</td>
                          <td className="py-2 pr-4 text-slate-600">{c.Industri || '-'}</td>
                          <td className="py-2 pr-4 text-right font-medium text-slate-800">{formatMoneyShort(c.NetIncome)}</td>
                          <td className="py-2 pr-4 text-right text-slate-500">{formatMoneyShort(c.PrevNetIncome)}</td>
                          <td className={`py-2 text-right font-medium ${(c.GrowthRate || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatPercent(c.GrowthRate)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(data.companiesBySubindustry[selectedSubindustry] || []).length === 0 && (
                  <div className="text-center text-slate-400 py-8">Tidak ada data perusahaan</div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-400 flex justify-between">
                <span>{(data.companiesBySubindustry[selectedSubindustry] || []).length} perusahaan</span>
                <span>Klik di luar untuk tutup</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 py-4">
          Dashboard dibuat dari data all_lk.csv &middot; {data.sectors.length} sektor &middot; {data.years.length} tahun data
        </footer>
      </main>
    </div>
  )
}
