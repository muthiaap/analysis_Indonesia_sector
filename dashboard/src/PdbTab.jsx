import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'
import {
  TrendingUp, TrendingDown, Award, Scale, Settings, Check, X, Percent,
  Layers, Sparkles, Activity, Shield, ArrowUpRight, DollarSign, RefreshCw, Info,
  Newspaper
} from 'lucide-react'

// Curated colors for premium visual design
const THEME_COLORS = {
  size: '#f27a1a',        // Orange for Sector Size
  growth: '#00c0a8',      // Tosca for Growth
  regulation: '#e2ba12',  // Yellow for Regulation
}

// Professional Indonesian definitions for the 15 PDB sectors
const SECTOR_DEFINITIONS = {
  "Industri Pengolahan": "Sektor yang mencakup transformasi fisik atau kimia dari bahan mentah, komponen, atau bagian menjadi produk baru. Sektor ini melingkupi manufaktur skala besar hingga industri pengolahan hilirisasi bernilai tambah tinggi.",
  "Penyediaan Akomodasi dan Makan Minum": "Sektor pariwisata dan hospitalitas yang mencakup penyediaan jasa pelayanan penginapan jangka pendek (seperti hotel, resort, dan losmen) serta penyediaan jasa makanan dan minuman siap saji untuk konsumsi langsung (seperti restoran, kafe, dan katering).",
  "Pertanian, Kehutanan, dan Perikanan": "Sektor primer yang mencakup kegiatan pemanfaatan sumber daya hayati untuk memproduksi komoditas pangan, perkebunan, serat kayu kehutanan, serta pembudidayaan dan penangkapan ikan guna menopang ketahanan pangan nasional.",
  "Transportasi dan Pergudangan": "Sektor vital yang melayani pemindahan barang atau penumpang melalui moda darat, laut, dan udara, serta kegiatan pendukung logistik seperti pergudangan, penyimpanan barang (cold storage), dan jasa kurir pengiriman barang.",
  "Informasi dan Komunikasi": "Sektor teknologi modern yang meliputi penerbitan konten, produksi media, penyiaran televisi/radio, telekomunikasi kabel dan nirkabel, serta jasa pemrograman komputer, konsultasi TI, dan pengelolaan infrastruktur teknologi informasi.",
  "Jasa Kesehatan dan Kegiatan Sosial": "Sektor pelayanan sosial yang menyediakan perawatan medis, penanganan kesehatan profesional di rumah sakit, klinik, dan laboratorium kesehatan, serta aktivitas pekerjaan sosial seperti panti asuhan dan layanan rehabilitasi.",
  "Real Estate": "Sektor properti yang mencakup kegiatan pengembangan (developer), kepemilikan, penjualan, pembelian, penyewaan, serta pengoperasian real estat baik untuk hunian pribadi maupun bangunan komersial.",
  "Pengadaan Air, Pengelolaan Sampah, Limbah dan Daur Ulang": "Sektor sanitasi lingkungan yang mencakup pengelolaan penyediaan air bersih untuk rumah tangga dan industri, pengumpulan serta pengolahan sampah/limbah padat dan cair, serta aktivitas daur ulang material ramah lingkungan.",
  "Pengadaan Listrik dan Gas": "Sektor energi utama yang mencakup aktivitas pembangkitan, transmisi, dan distribusi tenaga listrik, serta produksi dan penyaluran gas alam/buatan untuk memenuhi kebutuhan energi domestik, komersial, dan industri.",
  "Konstruksi": "Sektor pembangunan fisik yang mencakup konstruksi gedung (hunian dan komersial), pekerjaan teknik sipil seperti jalan raya, jembatan, bendungan, pelabuhan, serta instalasi kelistrikan, pipa air, dan pembongkaran infrastruktur fisik.",
  "Jasa Pendidikan": "Sektor peningkatan kapasitas sumber daya manusia yang menyelenggarakan pendidikan formal dari tingkat anak usia dini hingga perguruan tinggi, serta kursus keterampilan non-formal dan pelatihan profesional.",
  "Perdagangan Besar dan Eceran; Reparasi Mobil dan Sepeda Motor": "Sektor sirkulasi barang yang mencakup penjualan grosir dan eceran tanpa melakukan perubahan bentuk produk, serta jasa reparasi dan pemeliharaan kendaraan bermotor guna memperlancar rantai distribusi barang nasional.",
  "Administrasi Pemerintahan, Pertahanan dan Jaminan Sosial Wajib": "Sektor pelayanan publik yang dijalankan oleh instansi pemerintah, mencakup pembuatan kebijakan publik, layanan birokrasi, penegakan hukum, keamanan nasional/pertahanan, serta pengelolaan program jaminan sosial wajib bagi masyarakat.",
  "Jasa Keuangan dan Asuransi": "Sektor intermediasi keuangan yang mencakup perbankan konvensional dan syariah, asuransi jiwa dan umum, reasuransi, dana pensiun, pasar modal, serta jasa investasi keuangan dan pengelolaan aset modal.",
  "Pertambangan dan Penggalian": "Sektor ekstraktif yang mencakup pengambilan mineral padat (seperti batu bara, emas, nikel), cair (minyak bumi), atau gas (gas alam) dari alam untuk digunakan sebagai bahan baku industri energi dan manufaktur lanjutan."
}


function formatMoneyTrillion(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  // Data is in billions (miliar) of Rupiah. Let's convert to Triliun.
  // E.g., 4541519.6 B = 4541.52 T (since it is already in Rp Miliar or absolute? Let's check sheet values:
  // HB 2025 Tahunan for Industri Pengolahan is 4541519.6.
  // Wait, Indonesian PDB in 2025 is around 21,000 Triliun.
  // So 4,541,519.6 is in Rp Miliar (Billion), which equals 4,541.52 Triliun. Yes!
  // So the absolute value in sheet is in Rp Miliar. Let's divide by 1000 to get Rp Triliun.
  const valTrillion = val / 1000.0
  return 'Rp ' + valTrillion.toFixed(2) + ' T'
}

function formatMoneyShort(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const absVal = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (absVal >= 1e12) return sign + 'Rp ' + (absVal / 1e12).toFixed(2) + ' T'
  if (absVal >= 1e9) return sign + 'Rp ' + (absVal / 1e9).toFixed(2) + ' B'
  if (absVal >= 1e6) return sign + 'Rp ' + (absVal / 1e6).toFixed(2) + ' M'
  return sign + 'Rp ' + absVal.toLocaleString()
}

function formatPercent(val) {
  if (val === null || val === undefined || isNaN(val)) return '-'
  return (val * 100).toFixed(2) + '%'
}

export default function PdbTab({ idxData }) {
  const [rawPdbData, setRawPdbData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSectorName, setSelectedSectorName] = useState(null)

  // Custom sliders weight state (Default: Size 30%, Growth 40%, Regulation 30%)
  const [weights, setWeights] = useState({
    size: 30,
    growth: 40,
    regulation: 30
  })

  // Presets configuration
  const presets = [
    { name: 'Default BNI', size: 30, growth: 40, regulation: 30, desc: 'Kombinasi berimbang standar industri' },
    { name: 'Fokus Regulasi', size: 10, growth: 20, regulation: 70, desc: 'Prioritaskan sektor dengan kemudahan izin & insentif' },
    { name: 'Fokus Pertumbuhan', size: 10, growth: 80, regulation: 10, desc: 'Maksimalkan sektor dengan ekspansi fisik tercepat' },
    { name: 'Fokus Ukuran PDB', size: 70, growth: 15, regulation: 15, desc: 'Utamakan sektor raksasa penyumbang PDB terbesar' }
  ]

  useEffect(() => {
    fetch('./pdb_data.json')
      .then(r => r.json())
      .then(data => {
        setRawPdbData(data)
        // Default select top subsector by original total score
        if (data && data.length > 0) {
          setSelectedSectorName(data[0].subsector)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching PDB data:', err)
        setLoading(false)
      })
  }, [])

  // Proportional weight sliders logic (sum to 100%)
  const handleWeightChange = (type, value) => {
    const newVal = Math.max(0, Math.min(100, Number(value)))
    const otherTypes = ['size', 'growth', 'regulation'].filter(t => t !== type)
    const currentOthersSum = weights[otherTypes[0]] + weights[otherTypes[1]]

    let newOthers = {}
    if (currentOthersSum === 0) {
      newOthers[otherTypes[0]] = (100 - newVal) / 2
      newOthers[otherTypes[1]] = (100 - newVal) / 2
    } else {
      newOthers[otherTypes[0]] = ((100 - newVal) * weights[otherTypes[0]]) / currentOthersSum
      newOthers[otherTypes[1]] = ((100 - newVal) * weights[otherTypes[1]]) / currentOthersSum
    }

    // Smooth integer rounding to always total exactly 100
    const roundedVal1 = Math.round(newOthers[otherTypes[0]])
    const roundedVal2 = 100 - newVal - roundedVal1

    setWeights({
      [type]: newVal,
      [otherTypes[0]]: roundedVal1,
      [otherTypes[1]]: roundedVal2
    })
  }

  // Calculate dynamic custom scores for all sectors
  const scoredData = useMemo(() => {
    if (!rawPdbData || rawPdbData.length === 0) return []

    return rawPdbData.map(item => {
      // Calculate contributions
      // sizeWeight is weights.size. raw metrics: bobotUkuran
      const sizeContribution = item.bobotUkuran * (weights.size / 100.0)

      // growthWeight is weights.growth. raw metrics: yoyGrowth
      const growthContribution = item.yoyGrowth * (weights.growth / 100.0)

      // regulationWeight is weights.regulation. raw metrics: skorRegulasiMaks10 (out of 10)
      const regulasiContribution = (item.skorRegulasiMaks10 / 10.0) * (weights.regulation / 100.0)

      const customTotalSkor = sizeContribution + growthContribution + regulasiContribution

      return {
        ...item,
        sizeContribution,
        growthContribution,
        regulasiContribution,
        customTotalSkor
      }
    }).sort((a, b) => b.customTotalSkor - a.customTotalSkor)
  }, [rawPdbData, weights])

  // Sector detail mapping
  const selectedSector = useMemo(() => {
    if (!scoredData || !selectedSectorName) return null
    return scoredData.find(s => s.subsector === selectedSectorName) || scoredData[0]
  }, [scoredData, selectedSectorName])

  // Aggregate listed companies in IDX corresponding to the PDB subsector
  const idxCompanies = useMemo(() => {
    if (!idxData || !idxData.companiesBySubindustry || !selectedSector || !selectedSector.idxSubindustries) {
      return []
    }
    
    // Flat map all companies from the mapped IDX sub-industries
    const companies = selectedSector.idxSubindustries.flatMap(subInd => {
      const list = idxData.companiesBySubindustry[subInd] || []
      return list.map(c => ({
        ...c,
        mappedSubindustry: subInd
      }))
    })
    
    // Sort by NetIncome descending
    return companies.sort((a, b) => (b.NetIncome || 0) - (a.NetIncome || 0))
  }, [idxData, selectedSector])

  const idxAggregates = useMemo(() => {
    if (idxCompanies.length === 0) return null
    
    const totalProfitLatest = idxCompanies.reduce((sum, c) => sum + (c.NetIncome || 0), 0)
    const totalProfitPrev = idxCompanies.reduce((sum, c) => sum + (c.PrevNetIncome || 0), 0)
    
    const growth = totalProfitPrev !== 0 
      ? (totalProfitLatest - totalProfitPrev) / Math.abs(totalProfitPrev) 
      : 0
      
    return {
      totalProfitLatest,
      totalProfitPrev,
      growth,
      count: idxCompanies.length
    }
  }, [idxCompanies])

  // KPI calculations for cards
  const kpis = useMemo(() => {
    if (!scoredData || scoredData.length === 0) return {}

    const bestSector = scoredData[0]

    // Find fastest YoY growth (constant price physical volume)
    const fastestGrowthSector = [...scoredData].sort((a, b) => b.yoyGrowth - a.yoyGrowth)[0]

    // Find largest nominal PDB sector (current price hb2025Tahunan)
    const largestPdbSector = [...scoredData].sort((a, b) => b.hb2025Tahunan - a.hb2025Tahunan)[0]

    return {
      bestSector,
      fastestGrowth: fastestGrowthSector,
      largestPdb: largestPdbSector
    }
  }, [scoredData])

  // Recharts Triwulanan Trend data
  const trendChartData = useMemo(() => {
    if (!selectedSector) return []
    return [
      { quarter: '2025 Q1', 'Harga Konstan (HK)': selectedSector.hk2025Q1, 'Harga Berlaku (HB)': selectedSector.hb2025Q1 },
      { quarter: '2025 Q2', 'Harga Konstan (HK)': selectedSector.hk2025Q2, 'Harga Berlaku (HB)': selectedSector.hb2025Q2 },
      { quarter: '2025 Q3', 'Harga Konstan (HK)': selectedSector.hk2025Q3, 'Harga Berlaku (HB)': selectedSector.hb2025Q3 },
      { quarter: '2025 Q4', 'Harga Konstan (HK)': selectedSector.hk2025Q4, 'Harga Berlaku (HB)': selectedSector.hb2025Q4 },
      { quarter: '2026 Q1', 'Harga Konstan (HK)': selectedSector.hk2026Q1, 'Harga Berlaku (HB)': selectedSector.hb2026Q1 },
    ]
  }, [selectedSector])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500">
        <Activity className="animate-spin text-blue-600 mb-2" size={24} />
        Memuat analisis data PDB Nasional...
      </div>
    )
  }

  // Formatting for Recharts tooltips
  const CustomChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <div className="font-semibold mb-2 text-slate-700">{label}</div>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 flex-1">{entry.name}:</span>
            <span className="font-semibold text-slate-800">{formatMoneyTrillion(entry.value)}</span>
          </div>
        ))}
        <div className="text-[10px] text-slate-400 mt-1 border-t pt-1">
          *HK: Kuantitas Riil &middot; HB: Nilai Nominal
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* KPI 1: Sektor Terbaik */}
        <div className="bg-gradient-to-br from-orange-50/50 to-white rounded-xl border border-orange-200/60 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 top-2 text-orange-100">
            <Award size={64} className="opacity-40" />
          </div>
          <div className="text-xs font-semibold text-[#f27a1a] uppercase tracking-wider mb-1">Subsektor Terbaik (Skor)</div>
          <div className="text-base font-bold text-slate-800 truncate" title={kpis.bestSector?.subsector}>
            {kpis.bestSector?.subsector}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
            Sektor: {kpis.bestSector?.sector}
          </div>
          <div className="text-xs font-bold text-slate-600 mt-1">
            Skor: {kpis.bestSector?.customTotalSkor.toFixed(4)}
          </div>
          <div className="text-[9px] text-slate-400 mt-1.5 flex items-center gap-1">
            <Sparkles size={10} className="text-yellow-500" />
            Berdasarkan simulasi bobot aktif
          </div>
        </div>

        {/* KPI 2: Pertumbuhan Fisik Tertinggi (HK) */}
        <div className="bg-gradient-to-br from-teal-50/50 to-white rounded-xl border border-teal-200/60 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 top-2 text-teal-100">
            <TrendingUp size={64} className="opacity-40" />
          </div>
          <div className="text-xs font-semibold text-[#00c0a8] uppercase tracking-wider mb-1">Pertumbuhan Riil Tercepat (YoY)</div>
          <div className="text-base font-bold text-slate-800 truncate" title={kpis.fastestGrowth?.subsector}>
            {kpis.fastestGrowth?.subsector}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
            Sektor: {kpis.fastestGrowth?.sector}
          </div>
          <div className="text-xs font-bold text-[#00c0a8] mt-1">
            +{formatPercent(kpis.fastestGrowth?.yoyGrowth)}
          </div>
          <div className="text-[9px] text-slate-400 mt-1.5">
            Peningkatan volume fisik riil ekonomi (HK)
          </div>
        </div>

        {/* KPI 3: Kontribusi PDB Terbesar (HB) */}
        <div className="bg-gradient-to-br from-yellow-50/30 to-white rounded-xl border border-yellow-200/60 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 top-2 text-yellow-100">
            <Layers size={64} className="opacity-40" />
          </div>
          <div className="text-xs font-semibold text-[#e2ba12] uppercase tracking-wider mb-1">Kontributor PDB Terbesar</div>
          <div className="text-base font-bold text-slate-800 truncate" title={kpis.largestPdb?.subsector}>
            {kpis.largestPdb?.subsector}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
            Sektor: {kpis.largestPdb?.sector}
          </div>
          <div className="text-xs font-bold text-slate-600 mt-1">
            {formatMoneyTrillion(kpis.largestPdb?.hb2025Tahunan)} <span className="text-[10px] text-slate-400">(2025)</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-1.5">
            Nilai nominal pasar berlaku (HB)
          </div>
        </div>

        {/* KPI 4: Konfigurasi Bobot Skor */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Scale size={13} className="text-slate-400" />
            Setelan Bobot Aktif
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center mt-1">
            <div className="bg-slate-50 rounded p-1">
              <div className="text-[10px] text-slate-400 uppercase">Ukuran</div>
              <div className="text-xs font-bold text-[#f27a1a]">{weights.size}%</div>
            </div>
            <div className="bg-slate-50 rounded p-1">
              <div className="text-[10px] text-slate-400 uppercase">Growth</div>
              <div className="text-xs font-bold text-[#00c0a8]">{weights.growth}%</div>
            </div>
            <div className="bg-slate-50 rounded p-1">
              <div className="text-[10px] text-slate-400 uppercase">Regulasi</div>
              <div className="text-xs font-bold text-[#e2ba12]">{weights.regulation}%</div>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 mt-2 text-center">
            Total bobot wajib 100% (Terjaga otomatis)
          </div>
        </div>

      </div>

      {/* Main Analysis Section: Weights Customizer + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Side: Score Weights Customizer Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings size={20} className="text-blue-600" />
              <div>
                <h3 className="font-bold text-slate-800">Simulasi Bobot Skor</h3>
                <p className="text-[11px] text-slate-400">Sesuaikan kriteria penentuan sektor terbaik</p>
              </div>
            </div>

            {/* Slider 1: Ukuran Sektor */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-600 flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: THEME_COLORS.size }} />
                  Ukuran Sektor (Bobot PDB)
                </span>
                <span className="font-bold text-blue-600">{weights.size}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.size}
                onChange={(e) => handleWeightChange('size', e.target.value)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-[9px] text-slate-400">
                Kontribusi nominal PDB sektor tersebut terhadap total PDB nasional.
              </p>
            </div>

            {/* Slider 2: Pertumbuhan YoY */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-600 flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: THEME_COLORS.growth }} />
                  Pertumbuhan YoY (HK)
                </span>
                <span className="font-bold text-emerald-600">{weights.growth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.growth}
                onChange={(e) => handleWeightChange('growth', e.target.value)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <p className="text-[9px] text-slate-400">
                Persentase kenaikan volume fisik riil ekonomi tahunan (YoY).
              </p>
            </div>

            {/* Slider 3: Aspek Regulasi */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-600 flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: THEME_COLORS.regulation }} />
                  Kriteria Regulasi / Kebijakan
                </span>
                <span className="font-bold text-violet-600">{weights.regulation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.regulation}
                onChange={(e) => handleWeightChange('regulation', e.target.value)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
              <p className="text-[9px] text-slate-400">
                Kemudahan OSS, insentif fiskal, renstra prioritas, & plafon kredit.
              </p>
            </div>

            {/* Presets Grid */}
            <div className="border-t border-slate-100 pt-3 mt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700">Presets Cepat:</div>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => {
                  const isActive = weights.size === preset.size &&
                    weights.growth === preset.growth &&
                    weights.regulation === preset.regulation
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setWeights({
                        size: preset.size,
                        growth: preset.growth,
                        regulation: preset.regulation
                      })}
                      className={`text-left p-2 rounded-lg border text-xs transition-all ${isActive
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm font-semibold'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      title={preset.desc}
                    >
                      <div className={isActive ? 'text-blue-700' : 'text-slate-700'}>{preset.name}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {preset.size}/{preset.growth}/{preset.regulation}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => setWeights({ size: 30, growth: 40, regulation: 30 })}
              className="w-full py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw size={12} />
              Kembalikan ke Default
            </button>
          </div>

          {/* Quick Explanation */}
          <div className="bg-amber-50/60 border border-amber-200/50 text-slate-700 rounded-xl p-4 shadow-sm text-xs space-y-2.5">
            <h4 className="font-bold flex items-center gap-1 text-slate-800">
              <Shield size={14} className="text-[#e2ba12]" />
              Sektor Terbaik Nasional
            </h4>
            <p className="leading-relaxed text-slate-600">
              Sektor-sektor ini dinilai menggunakan multi-faktor ekonomi makro & regulasi. Industri Pengolahan secara konsisten menempati peringkat atas karena kontribusi nominalnya yang masif terhadap PDB (hampir 20%), meskipun pertumbuhannya kalah cepat dibanding sektor Pariwisata/Akomodasi (+13.14%).
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed border-t border-amber-200/40 pt-2">
              *Geser slider di atas untuk menyesuaikan formula penilaian instan. Leaderboard di kanan akan langsung berurut ulang.
            </p>
          </div>
        </div>

        {/* Right Side: Interactive Leaderboard Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Award size={18} className="text-yellow-500" />
                  Leaderboard Subsektor Terbaik PDB
                </h3>
                <p className="text-xs text-slate-400">Peringkat dinamis berdasarkan bobot kriteria aktif</p>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                {scoredData.length} Subsektor Terkalkulasi
              </span>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[680px] shadow-inner border border-slate-100 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold select-none z-10 shadow-[0_1px_0_0_rgba(226,232,240,0.8)]">
                  <tr>
                    <th className="py-2.5 px-4 text-center w-12 bg-slate-50">Rank</th>
                    <th className="py-2.5 px-3 bg-slate-50">Lapangan Usaha (Subsektor PDB)</th>
                    <th className="py-2.5 px-3 text-center w-24 bg-slate-50">Porsi PDB (Size)</th>
                    <th className="py-2.5 px-3 text-center w-28 bg-slate-50">Pertumbuhan YoY</th>
                    <th className="py-2.5 px-3 text-center w-36 bg-slate-50">Skor Kontribusi</th>
                    <th className="py-2.5 px-4 text-right w-24 bg-slate-50">Total Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scoredData.map((item, index) => {
                    const isSelected = item.subsector === selectedSectorName

                    // Top 3 badges style
                    let rankBadge = ''
                    if (index === 0) rankBadge = 'bg-yellow-100 text-yellow-800 font-bold border border-yellow-200'
                    else if (index === 1) rankBadge = 'bg-slate-200 text-slate-700 font-bold border border-slate-300'
                    else if (index === 2) rankBadge = 'bg-orange-100 text-orange-800 font-bold border border-orange-200'
                    else rankBadge = 'text-slate-400'

                    // Calculate breakdown percentage for progress bar (clipping negative growth to 0 for visual bar)
                    const sizePart = Math.max(0, item.sizeContribution)
                    const growthPart = Math.max(0, item.growthContribution)
                    const regulasiPart = Math.max(0, item.regulasiContribution)
                    const totalParts = sizePart + growthPart + regulasiPart
                    const sizePct = totalParts > 0 ? (sizePart / totalParts) * 100 : 0
                    const growthPct = totalParts > 0 ? (growthPart / totalParts) * 100 : 0
                    const regulasiPct = totalParts > 0 ? (regulasiPart / totalParts) * 100 : 0

                    return (
                      <tr
                        key={item.subsector}
                        onClick={() => setSelectedSectorName(item.subsector)}
                        className={`cursor-pointer transition-all hover:bg-slate-50/80 ${isSelected ? 'bg-orange-50/60 border-l-4 border-[#f27a1a] font-medium' : ''
                          }`}
                      >
                        {/* Rank */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] ${rankBadge}`}>
                            {index + 1}
                          </span>
                        </td>

                        {/* Subsector Name, Parent Badge & Nominal */}
                        <td className="py-3 px-3">
                          <div className={`text-slate-800 font-semibold ${isSelected ? 'text-[#f27a1a] font-bold' : ''}`}>
                            {item.subsector}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-semibold tracking-wide">
                              {item.sector}
                            </span>
                            <span>&middot;</span>
                            <span>Nominal: {formatMoneyTrillion(item.hb2025Tahunan)}</span>
                          </div>
                        </td>

                        {/* Sector Size % */}
                        <td className="py-3 px-3 text-center font-medium text-slate-700">
                          {formatPercent(item.bobotUkuran)}
                        </td>

                        {/* YoY Growth % Badge */}
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-block ${item.yoyGrowth >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/60' : 'bg-red-50 text-red-600 border border-red-100/60'
                            }`}>
                            {item.yoyGrowth >= 0 ? '+' : ''}{formatPercent(item.yoyGrowth)}
                          </span>
                        </td>

                        {/* Stacked Score Breakdown Progress Bar */}
                        <td className="py-3 px-3 align-middle">
                          <div className="flex flex-col gap-1.5 w-full">
                            <div className="w-full h-2 bg-slate-100 rounded-full flex overflow-hidden">
                              <div
                                style={{ width: `${sizePct}%`, backgroundColor: THEME_COLORS.size }}
                                title={`Ukuran Sektor: ${item.sizeContribution.toFixed(4)}`}
                              />
                              <div
                                style={{ width: `${growthPct}%`, backgroundColor: THEME_COLORS.growth }}
                                title={`Pertumbuhan: ${item.growthContribution.toFixed(4)}`}
                              />
                              <div
                                style={{ width: `${regulasiPct}%`, backgroundColor: THEME_COLORS.regulation }}
                                title={`Regulasi: ${item.regulasiContribution.toFixed(4)}`}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400 font-semibold uppercase">
                              <span style={{ color: THEME_COLORS.size }}>{sizePct.toFixed(0)}%</span>
                              <span style={{ color: THEME_COLORS.growth }}>{growthPct.toFixed(0)}%</span>
                              <span style={{ color: THEME_COLORS.regulation }}>{regulasiPct.toFixed(0)}%</span>
                            </div>
                          </div>
                        </td>

                        {/* Total calculated Score */}
                        <td className="py-3 px-4 text-right">
                          <span className={`font-mono text-sm ${isSelected ? 'text-blue-600 font-bold' : 'text-slate-700 font-semibold'}`}>
                            {item.customTotalSkor.toFixed(4)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-between">
              <span>*Klik pada baris subsektor untuk membuka visualisasi detail di bawah.</span>
              <div className="flex gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.size }} /> Ukuran
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.growth }} /> Growth
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.regulation }} /> Regulasi
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Selected Sector Drilldown Panel (Graph + Regulatory Checklist) */}
      {selectedSector && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 animate-fade-in">

          {/* Drilldown Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl">
                <Activity size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Analisis Mendalam: {selectedSector.subsector}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sektor Utama: <span className="font-semibold text-slate-600">{selectedSector.sector}</span> &middot; Rincian triwulan & kepatuhan regulasi makro
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium block">Nominal PDB Tahunan (2025)</span>
              <span className="text-lg font-bold text-slate-800">
                {formatMoneyTrillion(selectedSector.hb2025Tahunan)}
              </span>
            </div>
          </div>

          {/* Evaluasi Kebijakan & Analisis Sektoral Pembiayaan */}
          <div className="space-y-2 -mt-2">
            <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider block">Evaluasi Kebijakan & Analisis Sektoral Pembiayaan</span>
            <div className="bg-[#fbf9ff] border border-[#e8e4f5] rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute right-4 top-4 text-[#f27a1a]/5 pointer-events-none">
                <Scale size={72} />
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-normal relative z-10">
                {selectedSector.alasanEvaluasi || "Tidak ada rincian evaluasi."}
              </p>
            </div>
          </div>

          {/* Sektor Definition Banner */}
          <div className="bg-[#fcfcff] border border-[#e2def0] rounded-xl p-5 flex items-start gap-4 shadow-sm">
            <div className="p-2 bg-[#f27a1a]/10 text-[#f27a1a] rounded-lg flex-shrink-0 mt-0.5">
              <Sparkles size={16} className="text-[#f27a1a]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider block mb-1">Deskripsi Lapangan Usaha</span>
              <p className="text-[11px] text-slate-700 leading-relaxed font-normal">
                {SECTOR_DEFINITIONS[selectedSector.sector] || "Penjelasan lengkap mengenai cakupan operasional lapangan usaha sektor ini."}
              </p>

              {/* Dynamic Subsectors Badge Section */}
              {selectedSector.subsectors && selectedSector.subsectors.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider block mb-2">
                    Subsektor Lain di Sektor {selectedSector.sector} ({selectedSector.subsectors.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {selectedSector.subsectors.map((sub, sIdx) => {
                      const isCurrent = sub === selectedSector.subsector
                      return (
                        <span
                          key={sIdx}
                          className={`transition-all px-2.5 py-0.5 rounded text-[10px] inline-block cursor-default ${
                            isCurrent
                              ? 'bg-orange-100 text-[#f27a1a] border border-orange-200 font-bold shadow-sm'
                              : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          {sub}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Core Content: HK vs HB Graph + Regulation Checkbox Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 1. HK vs HB Triwulanan Chart (2/3 width) */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">Tren PDB Triwulanan (Q1 2025 - Q1 2026)</h4>
                  <p className="text-[10px] text-slate-400">Harga Konstan (Fisik Riil) vs Harga Berlaku (Nominal Pasar)</p>
                </div>
                <div className="bg-slate-50 px-2 py-1 rounded border border-slate-100 text-[10px] text-slate-500 font-medium">
                  YoY Growth: <span className="font-semibold text-emerald-600">+{formatPercent(selectedSector.yoyGrowth)}</span>
                </div>
              </div>

              {/* Area Chart Container */}
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHK" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="colorHB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => (v / 1000).toFixed(0) + 'T'} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', pt: 8 }} />
                    <Area
                      type="monotone"
                      dataKey="Harga Konstan (HK)"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorHK)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Harga Berlaku (HB)"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorHB)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* HK vs HB Explanation */}
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-700 block mb-0.5">Analisis Selisih HK & HB:</span>
                Kesenjangan vertikal antara garis **Harga Berlaku (HB - Biru)** dan **Harga Konstan (HK - Hijau)** mencerminkan besarnya deflator PDB atau akumulasi inflasi sektor sejak tahun dasar 2010. Semakin lebar kesenjangan ini, semakin tinggi kenaikan harga barang/jasa di sektor tersebut di pasar saat ini.
              </div>
            </div>

            {/* 2. Regulation Checklist Grid (1/3 width) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700">Regulasi & Kebijakan Subsektor</h4>
                <div className="text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded border border-violet-200 shadow-sm">
                  Skor: {selectedSector.skorRegulasiMaks10.toFixed(2)} / 10
                </div>
              </div>

              {/* 4 Regulation Cards */}
              <div className="grid grid-cols-1 gap-2.5">

                {/* 1. Insentif Fiskal */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${selectedSector.insentifFiskal ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' : 'border-slate-200 bg-slate-50/30'
                  }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${selectedSector.insentifFiskal ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                    {selectedSector.insentifFiskal ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-700 truncate">Insentif Fiskal</span>
                        <span className="text-[9px] text-slate-400 font-semibold">(30%)</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[8px] bg-slate-100/80 text-slate-600 px-1 py-0.2 rounded font-bold">
                          {selectedSector.insentifFiskalScore}/10
                        </span>
                        {/* Interactive Tooltip Icon */}
                        <div className="relative group inline-block">
                          <Info size={12} className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors" />
                          <div className="absolute bottom-full right-0 transform translate-x-2 mb-2 w-56 bg-slate-900 text-white text-[10px] rounded-lg p-2.5 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-[9999] leading-relaxed font-normal">
                            Mendapat pengurangan pajak/bea masuk, tax holiday, atau insentif investasi khusus dari pemerintah.
                            {/* Triangle Arrow */}
                            <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-relaxed font-normal">
                      {selectedSector.penjelasanInsentifFiskal || "Tidak ada rincian penjelasan."}
                    </p>
                  </div>
                </div>

                {/* 2. Rencana Strategis */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${selectedSector.renstraPrioritas ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' : 'border-slate-200 bg-slate-50/30'
                  }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${selectedSector.renstraPrioritas ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                    {selectedSector.renstraPrioritas ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-700 truncate">Renstra / Prioritas</span>
                        <span className="text-[9px] text-slate-400 font-semibold">(30%)</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[8px] bg-slate-100/80 text-slate-600 px-1 py-0.2 rounded font-bold">
                          {selectedSector.renstraPrioritasScore}/10
                        </span>
                        {/* Interactive Tooltip Icon */}
                        <div className="relative group inline-block">
                          <Info size={12} className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors" />
                          <div className="absolute bottom-full right-0 transform translate-x-2 mb-2 w-56 bg-slate-900 text-white text-[10px] rounded-lg p-2.5 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-[9999] leading-relaxed font-normal">
                            Tercantum dalam proyek prioritas pembangunan nasional atau Rencana Kerja Pemerintah (RKP).
                            {/* Triangle Arrow */}
                            <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-relaxed font-normal">
                      {selectedSector.penjelasanRenstraPrioritas || "Tidak ada rincian penjelasan."}
                    </p>
                  </div>
                </div>

                {/* 3. Kemudahan Izin OSS */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${selectedSector.ossIzin ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' : 'border-slate-200 bg-slate-50/30'
                  }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${selectedSector.ossIzin ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                    {selectedSector.ossIzin ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-700 truncate">Kemudahan Izin OSS</span>
                        <span className="text-[9px] text-slate-400 font-semibold">(20%)</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[8px] bg-slate-100/80 text-slate-600 px-1 py-0.2 rounded font-bold">
                          {selectedSector.ossIzinScore}/10
                        </span>
                        {/* Interactive Tooltip Icon */}
                        <div className="relative group inline-block">
                          <Info size={12} className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors" />
                          <div className="absolute bottom-full right-0 transform translate-x-2 mb-2 w-56 bg-slate-900 text-white text-[10px] rounded-lg p-2.5 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-[9999] leading-relaxed font-normal">
                            Prosedur perizinan berusaha melalui sistem Online Single Submission (OSS) relatif singkat & berisiko rendah.
                            {/* Triangle Arrow */}
                            <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-relaxed font-normal">
                      {selectedSector.penjelasanOssIzin || "Tidak ada rincian penjelasan."}
                    </p>
                  </div>
                </div>

                {/* 4. Plafon Kredit */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${selectedSector.plafonKredit ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' : 'border-slate-200 bg-slate-50/30'
                  }`}>
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${selectedSector.plafonKredit ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                    {selectedSector.plafonKredit ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-700 truncate">Plafon Kredit Prioritas</span>
                        <span className="text-[9px] text-slate-400 font-semibold">(20%)</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[8px] bg-slate-100/80 text-slate-600 px-1 py-0.2 rounded font-bold">
                          {selectedSector.plafonKreditScore}/10
                        </span>
                        {/* Interactive Tooltip Icon */}
                        <div className="relative group inline-block">
                          <Info size={12} className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors" />
                          <div className="absolute bottom-full right-0 transform translate-x-2 mb-2 w-56 bg-slate-900 text-white text-[10px] rounded-lg p-2.5 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-[9999] leading-relaxed font-normal">
                            Mendapat plafon alokasi penyaluran kredit perbankan berprioritas nasional atau dukungan likuiditas Bank Indonesia.
                            {/* Triangle Arrow */}
                            <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-900" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 leading-relaxed font-normal">
                      {selectedSector.penjelasanPlafonKredit || "Tidak ada rincian penjelasan."}
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Row 2.5: Emiten Publik Terkait (IDX) */}
          <div className="border-t border-slate-100 pt-6 mt-6 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Award size={14} className="text-blue-600 animate-pulse" />
                Emiten Publik Terkait (Bursa Efek Indonesia - IDX)
              </h4>
              {idxAggregates && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-100">
                  {idxAggregates.count} Emiten Terpetakan
                </span>
              )}
            </div>

            {idxAggregates ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Panel Aggregates */}
                <div className="lg:col-span-1 bg-gradient-to-br from-blue-50/50 via-indigo-50/20 to-transparent border border-blue-100/50 rounded-xl p-4 flex flex-col justify-between h-full space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Performa Pasar Modal</span>
                    <h5 className="text-sm font-bold text-slate-800 mt-1">Metrik Konsolidasi Emiten</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Agregat kinerja keuangan emiten publik berdasarkan Klasifikasi Subindustri IDX.</p>
                  </div>

                  <div className="space-y-3">
                    {/* Stat 1 */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] text-slate-500 font-medium">Total Laba Bersih</span>
                      <span className="text-[11px] font-bold text-slate-800">
                        {formatMoneyShort(idxAggregates.totalProfitLatest)}
                      </span>
                    </div>

                    {/* Stat 2 */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] text-slate-500 font-medium">Pertumbuhan Laba</span>
                      <span className={`text-[11px] font-bold flex items-center gap-0.5 ${idxAggregates.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {idxAggregates.growth >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {(idxAggregates.growth * 100).toFixed(2)}%
                      </span>
                    </div>

                    {/* Stat 3 (Comparison) */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-550 font-medium flex items-center gap-0.5">
                        Pertumbuhan Riil (PDB)
                      </span>
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-0.5">
                        <TrendingUp size={11} className="text-emerald-500" />
                        {(selectedSector.yoyGrowth * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Micro Insight Banner */}
                  <div className="p-2.5 bg-white/80 border border-indigo-50/50 rounded-lg">
                    <span className="text-[9px] font-bold text-indigo-700 block uppercase tracking-wide">Makro vs Mikro Insight</span>
                    <span className="text-[10px] text-slate-600 mt-0.5 block leading-normal font-normal">
                      {idxAggregates.growth > selectedSector.yoyGrowth ? (
                        <span>
                          Performa laba emiten di pasar saham tumbuh <strong>lebih cepat</strong> ({(idxAggregates.growth * 100).toFixed(1)}%) dibandingkan pertumbuhan volume fisik sektor riil ({(selectedSector.yoyGrowth * 100).toFixed(1)}%). Menunjukkan efisiensi modal emiten publik yang sangat kuat.
                        </span>
                      ) : (
                        <span>
                          Pertumbuhan fisik sektor riil ({(selectedSector.yoyGrowth * 100).toFixed(1)}%) tampil <strong>lebih solid/stabil</strong> dibandingkan laju pertumbuhan laba bersih emiten publik ({(idxAggregates.growth * 100).toFixed(1)}%).
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Leaderboard Table of Companies */}
                <div className="lg:col-span-2 border border-slate-100 rounded-xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold select-none z-10">
                        <tr>
                          <th className="py-2 px-3 bg-slate-50">Ticker</th>
                          <th className="py-2 px-3 bg-slate-50">Klasifikasi Subindustri IDX</th>
                          <th className="py-2 px-3 text-right bg-slate-50">Laba Bersih</th>
                          <th className="py-2 px-3 text-right bg-slate-50">Pertumbuhan Laba</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {idxCompanies.slice(0, 6).map((c) => (
                          <tr key={c.Ticker} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3">
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px] border border-blue-100 inline-block uppercase tracking-wide">
                                {c.Ticker}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-medium">
                              {c.mappedSubindustry}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-800">
                              {formatMoneyShort(c.NetIncome)}
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${c.GrowthRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              <span className="flex items-center justify-end gap-0.5">
                                {c.GrowthRate >= 0 ? '+' : ''}
                                {(c.GrowthRate * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {idxCompanies.length > 6 && (
                    <div className="bg-slate-50 border-t border-slate-100 px-3 py-1.5 text-right">
                      <span className="text-[10px] text-slate-400 font-medium">
                        Menampilkan 6 dari total {idxCompanies.length} emiten terkait.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-[11px] font-bold text-slate-700">Tidak Ada Emiten Publik Terpetakan</h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    Subsektor riil <strong>{selectedSector.subsector}</strong> didominasi oleh pelaku ekonomi non-publik, badan usaha milik negara non-terbuka, atau administrasi publik. Tidak ada emiten komersial di Bursa Efek Indonesia (IDX) yang terdaftar langsung beroperasi pada kategori lapangan usaha ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Market News Grid at bottom */}
          <div className="border-t border-slate-100 pt-6 mt-6 space-y-3.5">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Newspaper size={14} className="text-amber-500 animate-pulse" />
              Berita Terkait & Opini Pasar
            </h4>
            {selectedSector.beritaTerkait ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedSector.beritaTerkait.split(';').map((newsStr, nIdx) => {
                  const cleanNews = newsStr.trim();
                  if (!cleanNews) return null;
                  
                  // Split title and source
                  const parts = cleanNews.split(' - ');
                  const title = parts[0];
                  const source = parts.length > 1 ? parts[1] : null;

                  return (
                    <div 
                      key={nIdx} 
                      className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-blue-200 hover:shadow-md transition-all flex items-start gap-2.5 group cursor-default"
                    >
                      <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg mt-0.5 flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                        <ArrowUpRight size={11} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-700 font-semibold leading-normal group-hover:text-blue-700 transition-colors">
                          {title}
                        </div>
                        {source && (
                          <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-150 px-1.5 py-0.2 rounded font-semibold inline-block mt-2">
                            {source}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-xl">
                Belum ada berita terkait untuk subsektor ini.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
