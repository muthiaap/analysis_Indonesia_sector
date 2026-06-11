import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, LineChart, Line
} from 'recharts'
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieIcon, Activity, ArrowUpRight, X, Map, Share2, Layers, LogOut, Bell, Info, Search, ChevronDown } from 'lucide-react'
import MapTab from './MapTab'
import PdbTab from './PdbTab'
import HubunganTab from './HubunganTab'
import RantaiPasokTab from './RantaiPasokTab'


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
    <div className="bg-[#121124]/90 border border-white/10 rounded-xl shadow-2xl p-3 text-xs backdrop-blur-md">
      <div className="font-bold mb-2 text-white border-b border-white/5 pb-1">{label}</div>
      <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400 flex-1">{entry.name}:</span>
            <span className="font-bold text-white">{formatMoney(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PercentTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-[#121124]/90 border border-white/10 rounded-xl shadow-2xl p-3 text-xs backdrop-blur-md">
      <div className="font-bold mb-2 text-white border-b border-white/5 pb-1">{label}</div>
      <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400 flex-1">{entry.name}:</span>
            <span className="font-bold text-white">{formatPercent(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('laporan')
  const [data, setData] = useState(null)
  const [selectedSector, setSelectedSector] = useState(null)
  const [selectedSubindustry, setSelectedSubindustry] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [subSearchTerm, setSubSearchTerm] = useState('')
  const [subSectorFilter, setSubSectorFilter] = useState('All')
  const [activeLineSector, setActiveLineSector] = useState(null)

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
    worstSector,
    bestSubindustry,
    worstSubindustry
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
      .slice(0, 10)

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
    const bestSubindustry = allSub[0] || null
    const worstSubindustry = allSub[allSub.length - 1] || null

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
      worstSector,
      bestSubindustry,
      worstSubindustry
    }
  }, [data])

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-transparent text-slate-400 gap-3">
        <Activity className="animate-spin text-violet-500" size={32} />
        <span className="text-xs font-bold tracking-wider uppercase animate-pulse">Memuat FinSight Premium Dashboard...</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen max-h-screen bg-transparent p-4 gap-4 overflow-hidden">
      {/* Sleek Floating Left Sidebar */}
      <aside className="group/sidebar w-20 hover:w-60 bg-[#121124]/95 border border-white/5 rounded-3xl flex flex-col items-center hover:items-start py-6 flex-shrink-0 shadow-2xl backdrop-blur-md justify-between transition-all duration-300 ease-in-out z-30">
        <div className="flex flex-col items-center group-hover/sidebar:items-start gap-8 w-full group-hover/sidebar:px-4">
          {/* Logo Icon at Top */}
          <div
            onClick={() => setActiveTab('laporan')}
            className="w-10 group-hover/sidebar:w-52 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-650 flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-3 shadow-lg shadow-violet-500/30 cursor-pointer hover:scale-105 transition-all overflow-hidden"
          >
            <Activity size={20} className="text-white animate-pulse flex-shrink-0" />
            <span className="ml-3 text-xs font-bold text-white tracking-wider uppercase opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap hidden group-hover/sidebar:inline">
              FinSight
            </span>
          </div>

          {/* Navigation Icon List */}
          <div className="flex flex-col gap-4 w-full items-center group-hover/sidebar:items-start">
            <button
              type="button"
              onClick={() => setActiveTab('laporan')}
              className={`w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 transition-all duration-300 relative cursor-pointer overflow-hidden ${activeTab === 'laporan'
                  ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              <BarChart3 size={20} className="flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 hidden group-hover/sidebar:inline">Laporan Keuangan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('peta')}
              className={`w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 transition-all duration-300 relative cursor-pointer overflow-hidden ${activeTab === 'peta'
                  ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              <Map size={20} className="flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 hidden group-hover/sidebar:inline">Peta Provinsi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pdb')}
              className={`w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 transition-all duration-300 relative cursor-pointer overflow-hidden ${activeTab === 'pdb'
                  ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              <TrendingUp size={20} className="flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 hidden group-hover/sidebar:inline">Analisis PDB</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hubungan')}
              className={`w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 transition-all duration-300 relative cursor-pointer overflow-hidden ${activeTab === 'hubungan'
                  ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              <Share2 size={20} className="flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 hidden group-hover/sidebar:inline">Struktur Grup</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rantai-pasok')}
              className={`w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 transition-all duration-300 relative cursor-pointer overflow-hidden ${activeTab === 'rantai-pasok'
                  ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
            >
              <Layers size={20} className="flex-shrink-0" />
              <span className="ml-3 text-xs font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 hidden group-hover/sidebar:inline">Rantai Pasok</span>
            </button>
          </div>
        </div>

        {/* Bottom logout / exit button */}
        <div className="w-full flex justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4">
          <button
            type="button"
            onClick={() => setActiveTab('laporan')}
            className="w-12 group-hover/sidebar:w-52 h-12 rounded-2xl flex items-center justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-4 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer border-none bg-transparent overflow-hidden"
          >
            <LogOut size={20} className="flex-shrink-0" />
            <span className="ml-3 text-xs font-semibold whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 hidden group-hover/sidebar:inline">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pr-1">
        {/* Top Header */}
        <header className="bg-transparent border-none sticky top-0 z-20 pb-4">
          <div className="bg-[#121124]/75 border border-white/5 rounded-3xl p-4 flex items-center justify-between gap-4 flex-wrap shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-violet-500/10">
                <BarChart3 size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight flex items-center gap-1.5">
                  FinSight
                  <span className="text-[9px] bg-violet-500/25 border border-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">Premium</span>
                </h1>
                <p className="text-[11px] text-slate-400">
                  {activeTab === 'laporan' && 'Analisis Profitabilitas per Sektor'}
                  {activeTab === 'peta' && 'Peta Provinsi & Sebaran Emiten'}
                  {activeTab === 'pdb' && 'Analisis PDB Makro & Sektor Terbaik'}
                  {activeTab === 'hubungan' && 'Struktur Afiliasi Grup & Kreditur'}
                  {activeTab === 'rantai-pasok' && 'Analisis Rantai Pasok B2B'}
                </p>
              </div>
            </div>

            {/* Pill navigation removed, sidebar hover-expand active */}

            {/* Right controls */}
            <div className="flex items-center gap-3">
              <button className="p-2 text-slate-400 hover:text-slate-200 rounded-full bg-slate-800/20 border border-white/5 transition-all cursor-pointer">
                <Search size={15} />
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-200 rounded-full bg-slate-800/20 border border-white/5 relative transition-all cursor-pointer">
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shadow shadow-violet-500/50"></span>
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-200 rounded-full bg-slate-800/20 border border-white/5 transition-all cursor-pointer">
                <Info size={15} />
              </button>

              {/* User profile dropdown */}
              <div className="flex items-center gap-2 bg-[#222044] border border-white/5 rounded-full pl-2 pr-3 py-1 shadow-md select-none">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow shadow-violet-500/40">
                  DR
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-[10px] font-bold text-white leading-tight">Muthia Aisyah Putri</div>
                  <div className="text-[8px] text-slate-400 leading-none">muthiaaisyahputri26@gmail.com</div>
                </div>
                <ChevronDown size={11} className="text-slate-400 ml-1 font-bold" />
              </div>
            </div>
          </div>
        </header>

        {/* Tab Components Rendering */}
        <div className="flex-1 space-y-6">
          {activeTab === 'peta' && <MapTab />}
          {activeTab === 'pdb' && <PdbTab idxData={data} />}
          {activeTab === 'hubungan' && <HubunganTab />}
          {activeTab === 'rantai-pasok' && <RantaiPasokTab />}

          {activeTab === 'laporan' && (
            <div className="space-y-6 animate-fade-in">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-violet-500/10 rounded-full blur-xl group-hover:bg-violet-500/20 transition-all"></div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Profit {latestYear}</div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">{formatMoneyShort(totalLatestProfit)}</div>
                  <div className={`text-xs mt-3 flex items-center gap-1 font-bold ${overallGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {overallGrowth >= 0 ? <TrendingUp size={14} className="animate-pulse" /> : <TrendingDown size={14} className="animate-pulse" />}
                    <span>{formatPercent(overallGrowth)}</span>
                    <span className="text-slate-500 font-medium ml-0.5">vs {latestYear - 1}</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subindustri Terbaik (Growth)</div>
                  <div className="text-lg font-bold text-white truncate" title={bestSubindustry?.Subindustri}>{bestSubindustry?.Subindustri || '-'}</div>
                  <div className="text-sm text-emerald-400 mt-2 font-bold flex items-center gap-1">
                    <TrendingUp size={14} />
                    {formatPercent(bestSubindustry?.GrowthRate)}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all"></div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subindustri Terburuk (Growth)</div>
                  <div className="text-lg font-bold text-white truncate" title={worstSubindustry?.Subindustri}>{worstSubindustry?.Subindustri || '-'}</div>
                  <div className="text-sm text-rose-455 mt-2 font-bold flex items-center gap-1">
                    <TrendingDown size={14} />
                    {formatPercent(worstSubindustry?.GrowthRate)}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-all duration-300">
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Jumlah Subindustri</div>
                  <div className="text-3xl font-extrabold text-white tracking-tight">{subindustryLatestSorted.length}</div>
                  <div className="text-xs text-slate-500 mt-3 font-semibold">{subindustryLatestSorted.length} subindustri tersedia</div>
                </div>
              </div>

              {/* Row 1: Stacked Improvement Chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight size={20} className="text-violet-500 animate-pulse" />
                    <h2 className="text-base font-bold text-white">Improvement Profit per Sektor (YoY)</h2>
                  </div>
                  {activeLineSector && (
                    <button
                      onClick={() => setActiveLineSector(null)}
                      className="text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/35 transition-colors cursor-pointer"
                    >
                      Reset Filter: <strong>{activeLineSector}</strong> ✕
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Perubahan profit bersih tahunan per sektor. Klik garis atau legenda untuk fokus pada satu sektor saja.
                </p>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={improvementChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatMoneyShort(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '12px', cursor: 'pointer' }}
                      onClick={(legendData) => setActiveLineSector(prev => prev === (legendData.dataKey || legendData.value) ? null : (legendData.dataKey || legendData.value))}
                    />
                    <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" />
                    {data.sectors.map((sector, i) => {
                      const isHighlighted = activeLineSector === null || activeLineSector === sector;
                      return (
                        <Line
                          key={sector}
                          type="monotone"
                          dataKey={sector}
                          stroke={SECTOR_COLORS[sector] || COLORS[i % COLORS.length]}
                          strokeWidth={isHighlighted ? 3 : 1}
                          opacity={isHighlighted ? 1 : 0.15}
                          activeDot={{ r: isHighlighted ? 6 : 2 }}
                          onClick={() => setActiveLineSector(prev => prev === sector ? null : sector)}
                          className="cursor-pointer transition-all duration-200"
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Row 2: Total Profit + Sector Growth */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={20} className="text-emerald-400" />
                    <h2 className="text-base font-bold text-white">Total Profit per Sektor</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">
                    Profit bersih total (annualised) per sektor setiap tahun.
                  </p>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={profitChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatMoneyShort(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
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

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={20} className="text-fuchsia-400" />
                    <h2 className="text-base font-bold text-white">Growth Rate per Sektor ({latestYear} vs {latestYear - 1})</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">
                    Persentase perubahan profit tahunan per sektor. Klik bar untuk melihat detail.
                  </p>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={sectorGrowthSorted} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatPercent(v)} />
                      <YAxis type="category" dataKey="Sektor" tick={{ fontSize: 10, fill: '#cbd5e1' }} width={130} />
                      <Tooltip content={<PercentTooltip />} />
                      <ReferenceLine x={0} stroke="rgba(255, 255, 255, 0.2)" />
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
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={20} className="text-[#a78bfa]" />
                  <h2 className="text-base font-bold text-white">Growth Rate per Subindustri ({latestYear} vs {latestYear - 1})</h2>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Top 15 sektor dengan pertumbuhan terbaik & 5 terburuk. Klik bar untuk melihat detail.
                </p>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={subindustryChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatPercent(v)} />
                    <YAxis
                      type="category"
                      dataKey="Subindustri"
                      tick={{ fontSize: 10, fill: '#cbd5e1' }}
                      width={180}
                    />
                    <Tooltip content={<PercentTooltip />} />
                    <ReferenceLine x={0} stroke="rgba(255, 255, 255, 0.2)" />
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
                {/* Donut Chart (FinSight Style) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm lg:col-span-1 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-4">
                    <PieIcon size={20} className="text-amber-500" />
                    <h2 className="text-base font-bold text-white">Komposisi Profit {latestYear}</h2>
                  </div>
                  <div className="relative flex items-center justify-center h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sectorLatestSorted}
                          dataKey="NetIncome"
                          nameKey="Sektor"
                          cx="50%"
                          cy="50%"
                          innerRadius={72}
                          outerRadius={96}
                          paddingAngle={2.5}
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
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider leading-none">Total Profit</span>
                      <span className="text-xl font-extrabold text-white mt-1">{formatMoneyShort(totalLatestProfit)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[10px] mt-2 border-t border-white/5 pt-3">
                    {sectorLatestSorted.slice(0, 5).map((entry, i) => (
                      <div key={entry.Sektor} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SECTOR_COLORS[entry.Sektor] || COLORS[i % COLORS.length] }} />
                        <span className="text-slate-400 truncate max-w-[80px]" title={entry.Sektor}>{entry.Sektor}</span>
                      </div>
                    ))}
                    <span className="text-slate-500">...</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={20} className="text-cyan-400" />
                    <h2 className="text-base font-bold text-white">Top 10 Perusahaan (Profit {latestYear})</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">
                    Berdasarkan nilai nominal profit bersih.
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={topCompanies} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => formatMoneyShort(v)} />
                      <YAxis type="category" dataKey="Ticker" tick={{ fontSize: 11, fill: '#cbd5e1' }} width={60} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="NetIncome" radius={[0, 4, 4, 0]} fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Row 5: Subindustry Detail Table */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={20} className="text-[#a78bfa] animate-pulse" />
                  <h2 className="text-base font-bold text-white">Detail per Subindustri & Industri ({latestYear} vs {latestYear - 1})</h2>
                </div>
                <div className="mb-4 flex gap-3 flex-wrap items-end mt-4">
                  <input
                    type="text"
                    placeholder="Cari subindustri atau industri..."
                    value={subSearchTerm}
                    onChange={(e) => setSubSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    style={{ minWidth: 200, flex: 1, maxWidth: 300 }}
                  />
                  <select
                    value={subSectorFilter}
                    onChange={(e) => setSubSectorFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-[#141328]/70"
                  >
                    <option value="All">Semua Sektor</option>
                    {data.sectors.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Profit:</label>
                    <input
                      type="text"
                      placeholder="Min"
                      value={subFilters.minProfit}
                      onChange={(e) => setSubFilters({ ...subFilters, minProfit: e.target.value })}
                      className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="text"
                      placeholder="Max"
                      value={subFilters.maxProfit}
                      onChange={(e) => setSubFilters({ ...subFilters, maxProfit: e.target.value })}
                      className="w-24 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Growth:</label>
                    <input
                      type="text"
                      placeholder="Min %"
                      value={subFilters.minGrowth}
                      onChange={(e) => setSubFilters({ ...subFilters, minGrowth: e.target.value })}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="text"
                      placeholder="Max %"
                      value={subFilters.maxGrowth}
                      onChange={(e) => setSubFilters({ ...subFilters, maxGrowth: e.target.value })}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <button
                    onClick={() => setSubFilters({ minProfit: '', maxProfit: '', minGrowth: '', maxGrowth: '' })}
                    className="text-xs text-violet-400 hover:text-violet-300 underline font-semibold bg-transparent border-none cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-white/5 rounded-xl shadow-inner">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-[#121124] border-b border-white/5 z-10">
                      <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider text-[9px] select-none">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4 cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'Subindustri', direction: subSort.column === 'Subindustri' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Subindustri {subSort.column === 'Subindustri' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'Industri', direction: subSort.column === 'Industri' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Industri {subSort.column === 'Industri' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'Sektor', direction: subSort.column === 'Sektor' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Sektor {subSort.column === 'Sektor' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 text-right cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'NetIncome', direction: subSort.column === 'NetIncome' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Profit {latestYear} {subSort.column === 'NetIncome' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 text-right cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'PrevNetIncome', direction: subSort.column === 'PrevNetIncome' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Profit {latestYear - 1} {subSort.column === 'PrevNetIncome' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 text-right cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'Improvement', direction: subSort.column === 'Improvement' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Improvement {subSort.column === 'Improvement' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 text-right cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'GrowthRate', direction: subSort.column === 'GrowthRate' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Growth Rate {subSort.column === 'GrowthRate' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-3 px-4 text-right cursor-pointer hover:text-violet-400 transition-colors" onClick={() => setSubSort({ column: 'Share', direction: subSort.column === 'Share' && subSort.direction === 'asc' ? 'desc' : 'asc' })}>
                          Share {subSort.column === 'Share' && (subSort.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {subindustryLatestSorted
                        .filter(s => {
                          const matchesSearch = !subSearchTerm || s.Subindustri.toLowerCase().includes(subSearchTerm.toLowerCase()) || (s.Industri || '').toLowerCase().includes(subSearchTerm.toLowerCase()) || s.Sektor.toLowerCase().includes(subSearchTerm.toLowerCase())
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
                          } else if (subSort.column === 'Industri') {
                            cmp = (a.Industri || '').localeCompare(b.Industri || '')
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
                              className="hover:bg-violet-500/10 cursor-pointer transition-colors align-top"
                              onClick={() => setSelectedSubindustry(s.Subindustri)}
                            >
                              <td className="py-3 px-4 text-slate-500">{i + 1}</td>
                              <td className="py-3 px-4 font-bold text-white">{s.Subindustri}</td>
                              <td className="py-3 px-4 text-slate-300">{s.Industri || '-'}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full shadow"
                                    style={{ backgroundColor: SECTOR_COLORS[s.Sektor] || '#cbd5e1' }}
                                  />
                                  <span className="text-slate-350">{s.Sektor}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-white">{formatMoneyShort(s.NetIncome)}</td>
                              <td className="py-3 px-4 text-right text-slate-400">{formatMoneyShort(s.PrevNetIncome)}</td>
                              <td className={`py-3 px-4 text-right font-bold ${(s.Improvement || 0) >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                                {s.Improvement >= 0 ? '+' : ''}{formatMoneyShort(s.Improvement)}
                              </td>
                              <td className={`py-3 px-4 text-right font-bold ${(s.GrowthRate || 0) >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                                {formatPercent(s.GrowthRate)}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-400">{formatPercent(share)}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sector Detail Modal */}
        {selectedSector && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) { setSelectedSector(null); setSearchTerm('') }
            }}
          >
            <div className="bg-[#121124] rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow"
                    style={{ backgroundColor: SECTOR_COLORS[selectedSector] || '#cbd5e1' }}
                  />
                  <h3 className="text-base font-bold text-white">{selectedSector}</h3>
                  <span className="text-xs text-slate-400">— Annualised Profit {latestYear}</span>
                </div>
                <button
                  onClick={() => { setSelectedSector(null); setSearchTerm('') }}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} className="text-slate-400 hover:text-white" />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-white/5">
                <input
                  type="text"
                  placeholder="Cari ticker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="overflow-auto flex-1 px-5 py-2">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#121124] border-b border-white/5">
                    <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5">#</th>
                      <th className="py-2.5">Ticker</th>
                      <th className="py-2.5">Subsektor</th>
                      <th className="py-2.5">Industri</th>
                      <th className="py-2.5 text-right">Profit {latestYear}</th>
                      <th className="py-2.5 text-right">Profit {latestYear - 1}</th>
                      <th className="py-2.5 text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(data.companiesBySector[selectedSector] || [])
                      .filter(c => !searchTerm || c.Ticker.toLowerCase().includes(searchTerm.toLowerCase()) || (c.Subsektor || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((c, i) => (
                        <tr key={c.Ticker} className="hover:bg-violet-500/10 transition-colors">
                          <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                          <td className="py-2 pr-4 font-bold text-white">{c.Ticker}</td>
                          <td className="py-2 pr-4 text-slate-300">{c.Subsektor || '-'}</td>
                          <td className="py-2 pr-4 text-slate-350">{c.Industri || '-'}</td>
                          <td className="py-2 pr-4 text-right font-bold text-white">{formatMoneyShort(c.NetIncome)}</td>
                          <td className="py-2 pr-4 text-right text-slate-400">{formatMoneyShort(c.PrevNetIncome)}</td>
                          <td className={`py-2 text-right font-bold ${(c.GrowthRate || 0) >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                            {formatPercent(c.GrowthRate)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(data.companiesBySector[selectedSector] || []).length === 0 && (
                  <div className="text-center text-slate-500 py-8 italic text-xs">Tidak ada data perusahaan</div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-white/5 text-[10px] text-slate-500 flex justify-between font-semibold">
                <span>{(data.companiesBySector[selectedSector] || []).length} perusahaan</span>
                <span>Klik di luar untuk tutup</span>
              </div>
            </div>
          </div>
        )}

        {/* Subindustry Detail Modal */}
        {selectedSubindustry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) { setSelectedSubindustry(null); setSearchTerm('') }
            }}
          >
            <div className="bg-[#121124] rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow"
                    style={{ backgroundColor: SECTOR_COLORS[(data.companiesBySubindustry[selectedSubindustry]?.[0]?.Sektor)] || '#8b5cf6' }}
                  />
                  <h3 className="text-base font-bold text-white">{selectedSubindustry}</h3>
                  <span className="text-xs text-slate-400">— Annualised Profit {latestYear}</span>
                </div>
                <button
                  onClick={() => { setSelectedSubindustry(null); setSearchTerm('') }}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={18} className="text-slate-400 hover:text-white" />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-white/5">
                <input
                  type="text"
                  placeholder="Cari ticker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="overflow-auto flex-1 px-5 py-2">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#121124] border-b border-white/5">
                    <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5">#</th>
                      <th className="py-2.5">Ticker</th>
                      <th className="py-2.5">Subsektor</th>
                      <th className="py-2.5">Industri</th>
                      <th className="py-2.5 text-right">Profit {latestYear}</th>
                      <th className="py-2.5 text-right">Profit {latestYear - 1}</th>
                      <th className="py-2.5 text-right">Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(data.companiesBySubindustry[selectedSubindustry] || [])
                      .filter(c => !searchTerm || c.Ticker.toLowerCase().includes(searchTerm.toLowerCase()) || (c.Subsektor || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((c, i) => (
                        <tr key={c.Ticker} className="hover:bg-violet-500/10 transition-colors">
                          <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                          <td className="py-2 pr-4 font-bold text-white">{c.Ticker}</td>
                          <td className="py-2 pr-4 text-slate-300">{c.Subsektor || '-'}</td>
                          <td className="py-2 pr-4 text-slate-350">{c.Industri || '-'}</td>
                          <td className="py-2 pr-4 text-right font-bold text-white">{formatMoneyShort(c.NetIncome)}</td>
                          <td className="py-2 pr-4 text-right text-slate-400">{formatMoneyShort(c.PrevNetIncome)}</td>
                          <td className={`py-2 text-right font-bold ${(c.GrowthRate || 0) >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                            {formatPercent(c.GrowthRate)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(data.companiesBySubindustry[selectedSubindustry] || []).length === 0 && (
                  <div className="text-center text-slate-500 py-8 italic text-xs">Tidak ada data perusahaan</div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-white/5 text-[10px] text-slate-500 flex justify-between font-semibold">
                <span>{(data.companiesBySubindustry[selectedSubindustry] || []).length} perusahaan</span>
                <span>Klik di luar untuk tutup</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-500 py-6 border-t border-white/5 mt-8">
          Dashboard dibuat dari data all_lk.csv &middot; {data.sectors.length} sektor &middot; {data.years.length} tahun data
        </footer>
      </div>
    </div>
  )
}
