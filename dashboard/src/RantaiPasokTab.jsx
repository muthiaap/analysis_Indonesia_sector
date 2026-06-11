import { useState, useMemo } from 'react'
import {
  Building2, Search, Filter, Info, Globe, MapPin, DollarSign, Sparkles,
  ArrowRight, ArrowLeft, Cpu, Truck, Wrench, GraduationCap, HardHat,
  Trees, Layers, Activity, HelpCircle, CheckSquare, Square
} from 'lucide-react'

// Supply Chain Data
const SUPPLY_CHAIN_DATA = {
  UNTR: {
    name: "PT United Tractors Tbk",
    ticker: "UNTR",
    sector: "Perindustrian",
    subSector: "Peralatan Berat",
    overview: "Distributor alat berat terbesar dan terkemuka di Indonesia yang menyediakan solusi terintegrasi di bidang pertambangan, konstruksi, kehutanan, dan pertanian.",
    revenue: "Rp 128.6 T (FY2025)",
    netIncome: "Rp 20.6 T (FY2025)",
    employeeCount: "~29,000 karyawan",
    headquarters: "Jakarta Timur, DKI Jakarta",
    upstream: [
      { id: "komatsu", name: "Komatsu Ltd.", country: "Jepang", type: "Alat Berat Utama", desc: "Principal utama untuk alat berat konstruksi dan pertambangan. Menyuplai hydraulic excavators, bulldozers, dump trucks, dan wheel loaders. Kemitraan eksklusif terjalin sejak tahun 1973.", logo: "K", color: "from-amber-500 to-yellow-600", keyProducts: ["Excavator", "Bulldozer", "Dump Truck"], relevance: "Sangat Tinggi (Pemasok Inti)" },
      { id: "scania", name: "Scania CV AB", country: "Swedia", type: "Kendaraan Niaga", desc: "Penyedia truk kategori berat (heavy-duty trucks) untuk angkutan tambang/logistik dan bus premium untuk transportasi antarkota.", logo: "S", color: "from-blue-600 to-indigo-700", keyProducts: ["Heavy Truck", "Premium Bus", "Chassis"], relevance: "Tinggi" },
      { id: "udtrucks", name: "UD Trucks", country: "Jepang", type: "Kendaraan Niaga", desc: "Pemasok armada truk kategori medium dan berat untuk kebutuhan logistik perkotaan, distribusi, dan konstruksi ringan.", logo: "U", color: "from-red-500 to-rose-600", keyProducts: ["Quester Truck", "Croner Truck"], relevance: "Medium" },
      { id: "bomag", name: "Bomag GmbH", country: "Jerman", type: "Alat Konstruksi", desc: "Produsen global peralatan pemadat tanah (soil compactors), asphalt pavers, dan cold planers untuk pembangunan jalan tol dan infrastruktur sipil.", logo: "B", color: "from-orange-500 to-red-600", keyProducts: ["Soil Compactor", "Asphalt Roller"], relevance: "Medium" },
      { id: "tadano", name: "Tadano Ltd.", country: "Jepang", type: "Alat Konstruksi", desc: "Pemasok alat angkat berat seperti telescopic cranes, crawler cranes, dan all-terrain cranes untuk konstruksi sipil dan migas.", logo: "T", color: "from-cyan-500 to-blue-600", keyProducts: ["Mobile Crane", "Cargo Crane"], relevance: "Medium" },
      { id: "pertamina", name: "PT Pertamina (Persero)", country: "Indonesia", type: "Lubricants & Fuel", desc: "Mitra penyedia bahan bakar minyak (BBM) industri dan pelumas (lubricants) berkualitas untuk mendukung operasional alat berat di berbagai site penambangan.", logo: "P", color: "from-emerald-500 to-teal-600", keyProducts: ["BBM Industri", "Mediteran Lube"], relevance: "Tinggi (Operasional)" },
      { id: "shell", name: "Shell plc", country: "Global", type: "Lubricants & Fuel", desc: "Pemasok cairan hidrolik (hydraulic fluids) dan pelumas mesin performa tinggi khusus untuk alat berat yang beroperasi di kondisi ekstrem.", logo: "S", color: "from-yellow-400 to-orange-500", keyProducts: ["Rimula Engine Oil", "Tellus Hyd Fluid"], relevance: "Medium" }
    ],
    internal: [
      { id: "komatsu_indonesia", name: "PT Komatsu Indonesia", role: "Perakitan & Manufaktur", desc: "Entitas terafiliasi yang merakit hydraulic excavator kelas 20 ton (PC200) secara lokal di Cakung untuk menekan biaya impor dan mempercepat pengiriman.", icon: "factory" },
      { id: "purna_jual", name: "Layanan Purna Jual UT", role: "Service & Spareparts", desc: "Layanan purna jual 24 jam dengan program UT Guarantees (OTOB - On Time Or Free) untuk suku cadang dan mekanik siaga di site proyek.", icon: "wrench" },
      { id: "ut_school", name: "UT School", role: "Pendidikan & SDM", desc: "Institusi pendidikan internal yang melatih mekanik dan operator alat berat bersertifikasi internasional demi menjamin kualitas layanan purna jual.", icon: "graduation" }
    ],
    downstream: [
      { id: "pama", name: "PT Pamapersada Nusantara (PAMA)", sector: "Kontraktor Tambang", parent: "Anak Usaha UNTR", desc: "Anak usaha inti UNTR yang merupakan kontraktor penambangan batubara terbesar di Indonesia. PAMA menjadi pembeli utama alat berat Komatsu dari induknya.", logo: "P", share: 45, volume: "Tinggi", relationType: "Subsidiary & Captive Customer" },
      { id: "adro", name: "PT Adaro Energy Indonesia Tbk", sector: "Tambang Batu Bara & Mineral", parent: "Grup Adaro (termasuk AADI)", desc: "Membeli unit alat berat Komatsu dan memanfaatkan jasa kontraktor PAMA untuk operasional tambang batubara di Tabalong serta smelter aluminium baru.", logo: "A", share: 12, volume: "Tinggi", relationType: "B2B Client" },
      { id: "ptba", name: "PT Bukit Asam Tbk (PTBA)", sector: "Tambang Batu Bara & Mineral", parent: "BUMN Mind ID", desc: "BUMN pertambangan batu bara yang menggunakan armada dump truck besar (HD) dan shovel Komatsu dari UNTR untuk operasional di Tanjung Enim.", logo: "P", share: 8, volume: "Medium", relationType: "B2B Client (BUMN)" },
      { id: "bumi", name: "PT Bumi Resources Tbk (BUMI)", sector: "Tambang Batu Bara & Mineral", parent: "Grup Bakrie/Salim", desc: "Produsen batubara terbesar melalui Kaltim Prima Coal (KPC) dan Arutmin yang menggunakan alat berat UNTR untuk pengupasan lapisan tanah penutup (overburden removal).", logo: "B", share: 10, volume: "Tinggi", relationType: "B2B Client" },
      { id: "wika", name: "PT Wijaya Karya Tbk (WIKA)", sector: "Konstruksi & Infrastruktur", parent: "BUMN Karya", desc: "Menggunakan pemadat Bomag, crane Tadano, dan excavator Komatsu dari UNTR untuk pembangunan jalan tol, bendungan, dan proyek IKN.", logo: "W", share: 5, volume: "Medium", relationType: "B2B Client (BUMN)" },
      { id: "ptpp", name: "PT Pembangunan Perumahan Tbk", sector: "Konstruksi & Infrastruktur", parent: "BUMN Karya", desc: "BUMN konstruksi sipil yang memesan alat pemadat jalan dan excavator dari UNTR untuk pembangunan bandara, pelabuhan, dan gedung tinggi.", logo: "P", share: 4, volume: "Medium", relationType: "B2B Client (BUMN)" },
      { id: "sinarmas", name: "Grup Sinarmas Forestry", sector: "Kehutanan & Agribisnis", parent: "Sinarmas Group", desc: "Menggunakan excavator Komatsu tipe kehutanan khusus (forestry spec) untuk penebangan, angkutan kayu, dan penyiapan lahan hutan tanaman industri.", logo: "S", share: 3, volume: "Medium", relationType: "B2B Client" },
      { id: "aali", name: "PT Astra Agro Lestari Tbk", sector: "Kehutanan & Agribisnis", parent: "Grup Astra (Afiliasi)", desc: "Perusahaan kelapa sawit terafiliasi yang memesan alat berat pertanian (traktor) dan wheel loader Komatsu untuk pengolahan tandan buah segar di pabrik kelapa sawit.", logo: "A", share: 2, volume: "Rendah", relationType: "Affiliated B2B Client" }
    ]
  },
  ADRO: {
    name: "PT Adaro Energy Indonesia Tbk",
    ticker: "ADRO",
    sector: "Energi & Sumber Daya",
    subSector: "Batubara & Mineral",
    overview: "Grup energi terintegrasi Indonesia yang memiliki bisnis di bidang pertambangan batu bara, energi terbarukan, smelter mineral, logistik, dan infrastruktur air.",
    revenue: "Rp 102.4 T (FY2025)",
    netIncome: "Rp 24.8 T (FY2025)",
    employeeCount: "~14,000 karyawan",
    headquarters: "Jakarta Selatan, DKI Jakarta",
    upstream: [
      { id: "untr", name: "PT United Tractors Tbk", country: "Indonesia", type: "Alat Berat", desc: "Menyuplai armada pertambangan Komatsu (dump truck, excavator) dan suku cadang untuk kelancaran operasional di site tambang Adaro.", logo: "U", color: "from-blue-500 to-indigo-600", keyProducts: ["Excavator Komatsu", "Heavy Dump Truck"], relevance: "Sangat Tinggi" },
      { id: "sis", name: "PT Saptaindra Sejati (SIS)", country: "Indonesia", type: "Jasa Penambangan", desc: "Anak usaha kontraktor internal yang menyuplai jasa operasional pertambangan, pengeboran, dan pemindahan tanah batubara.", logo: "S", color: "from-emerald-500 to-green-600", keyProducts: ["Overburden Removal", "Coal Hauling"], relevance: "Sangat Tinggi" },
      { id: "pertamina_ad", name: "PT Pertamina (Persero)", country: "Indonesia", type: "Lubricants & Fuel", desc: "Pemasok utama solar industri (HSD) untuk bahan bakar armada dump truck raksasa dan tongkang logistik batu bara.", logo: "P", color: "from-emerald-500 to-teal-600", keyProducts: ["Solar Industri", "Pelumas"], relevance: "Tinggi" }
    ],
    internal: [
      { id: "coal_washing", name: "Fasilitas Coal Washing", role: "Peningkatan Mutu", desc: "Fasilitas pencucian batubara di Kalimantan Selatan untuk memisahkan batubara dari kotoran batu dan menaikkan nilai kalori.", icon: "factory" },
      { id: "adaro_power", name: "Adaro Power", role: "Utilitas & Energi", desc: "Membangun dan mengoperasikan PLTU penyedia listrik mandiri untuk menunjang kegiatan penambangan dan smelter mineral.", icon: "bolt" },
      { id: "adaro_logistics", name: "Adaro Logistics", role: "Pelayaran & Logistik", desc: "Mengelola logistik sungai Barito, pemuatan tongkang (barging), hingga transshipment di laut lepas menggunakan kapal crane.", icon: "anchor" }
    ],
    downstream: [
      { id: "pln", name: "PT PLN (Persero)", sector: "Utilitas Domestik", parent: "BUMN Indonesia", desc: "Pembeli batubara domestik terbesar untuk menyuplai PLTU sistem interkoneksi Jawa-Bali-Sumatera melalui kebijakan DMO.", logo: "P", share: 25, volume: "Tinggi", relationType: "DMO Contract" },
      { id: "jpower", name: "Electric Power Development (J-Power)", sector: "Pembangkit Internasional", parent: "Jepang", desc: "Mitra pembeli batu bara kalori menengah-tinggi asal Jepang untuk PLTU ramah lingkungan di wilayah Asia Timur.", logo: "J", share: 15, volume: "Tinggi", relationType: "Long-term Export Client" },
      { id: "smelter_nikel", name: "Smelter Nikel Morowali", sector: "Metalurgi & Industri", parent: "Konsorsium China/Indo", desc: "Menyerap pasokan batu bara Adaro sebagai bahan bakar pembangkit listrik captive (mandiri) di kawasan industri nikel.", logo: "S", share: 18, volume: "Tinggi", relationType: "B2B Client" },
      { id: "china_energy", name: "China Energy Investment", sector: "Energi Global", parent: "BUMN China", desc: "Perusahaan pembangkit listrik terbesar di China yang mengimpor batubara Adaro dalam volume besar untuk mengamankan stok energi nasional.", logo: "C", share: 20, volume: "Tinggi", relationType: "Spot & Term Client" }
    ]
  },
  WIKA: {
    name: "PT Wijaya Karya (Persero) Tbk",
    ticker: "WIKA",
    sector: "Infrastruktur",
    subSector: "Konstruksi Sipil & Gedung",
    overview: "Salah satu BUMN konstruksi terbesar di Indonesia yang berfokus pada pembangunan jalan tol, bendungan, bandara, pelabuhan, kelistrikan, dan industri beton pracetak.",
    revenue: "Rp 22.5 T (FY2025)",
    netIncome: "Rp -1.2 T (FY2025)",
    employeeCount: "~11,000 karyawan",
    headquarters: "Jakarta Timur, DKI Jakarta",
    upstream: [
      { id: "smgr", name: "PT Semen Indonesia (Persero) Tbk", country: "Indonesia", type: "Bahan Baku Utama", desc: "Pemasok semen curah dan bahan pengikat beton berkualitas tinggi untuk seluruh proyek konstruksi sipil dan gedung WIKA.", logo: "S", color: "from-blue-500 to-indigo-600", keyProducts: ["Semen Curah", "Beton Ready-mix"], relevance: "Sangat Tinggi" },
      { id: "kras", name: "PT Krakatau Steel (Persero) Tbk", country: "Indonesia", type: "Bahan Baku Utama", desc: "Penyedia baja tulangan, baja profil, dan lembaran plat besi untuk struktur jembatan dan kerangka beton bertulang proyek infrastruktur.", logo: "K", color: "from-red-500 to-rose-600", keyProducts: ["Baja Tulangan", "Wire Rod"], relevance: "Tinggi" },
      { id: "untr", name: "PT United Tractors Tbk (UNTR)", country: "Indonesia", type: "Alat Berat", desc: "Menyediakan sewa dan pembelian armada excavator Komatsu, crane Tadano, dan pemadat tanah Bomag untuk pengerjaan tanah proyek sipil.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Excavator", "Mobile Crane", "Compactor"], relevance: "Tinggi" }
    ],
    internal: [
      { id: "wika_beton", name: "PT Wijaya Karya Beton Tbk (WTON)", role: "Beton Pracetak", desc: "Anak usaha publik yang memproduksi tiang pancang (pile), balok jembatan (girder), dan bantalan rel kereta api untuk konsumsi proyek WIKA.", icon: "factory" },
      { id: "wika_gedung", name: "PT Wijaya Karya Bangunan Gedung Tbk (WEGE)", role: "Konstruksi Gedung", desc: "Spesialis konstruksi gedung bertingkat, rumah sakit, apartemen, dan fasilitas publik di seluruh Indonesia.", icon: "building" },
      { id: "divisi_sipil", name: "Divisi Sipil & Infrastruktur", role: "Konstruksi Utama", desc: "Divisi inti WIKA yang mengerjakan mega-proyek seperti jalan tol Trans Jawa/Sumatera, bendungan nasional, dan jembatan bentang panjang.", icon: "wrench" }
    ],
    downstream: [
      { id: "pupr", name: "Kementerian PUPR", sector: "Pemerintah / Sipil", parent: "Republik Indonesia", desc: "Klien utama pemberi kontrak proyek bendungan, irigasi, jalan nasional, dan pengembangan infrastruktur dasar di Ibu Kota Nusantara (IKN).", logo: "P", share: 35, volume: "Tinggi", relationType: "Government Contract" },
      { id: "jasa_marga", name: "PT Jasa Marga (Persero) Tbk", sector: "Operator Jalan Tol", parent: "BUMN Indonesia", desc: "Pemilik proyek jalan tol konsesi di mana WIKA bertindak sebagai kontraktor utama pembangunan fisik badan jalan tol.", logo: "J", share: 20, volume: "Tinggi", relationType: "B2B Client" },
      { id: "kai", name: "PT Kereta Api Indonesia (Persero)", sector: "Transportasi Rel", parent: "BUMN Indonesia", desc: "Klien pemberi kerja untuk proyek perkeretaapian seperti LRT Jabodebek, High Speed Railway Jakarta-Bandung, dan stasiun modern.", logo: "K", share: 15, volume: "Medium", relationType: "B2B Client" },
      { id: "angkasa_pura", name: "PT Angkasa Pura Indonesia", sector: "Operator Bandara", parent: "BUMN Indonesia", desc: "Pemberi kerja untuk proyek perluasan terminal bandara, perpanjangan runway, dan fasilitas hanggar pesawat udara.", logo: "A", share: 10, volume: "Medium", relationType: "B2B Client" }
    ]
  },
  ASII: {
    name: "PT Astra International Tbk",
    ticker: "ASII",
    sector: "Konglomerat",
    subSector: "Multisektoral (Otomotif)",
    overview: "Konglomerat terbesar di Indonesia yang merajai industri otomotif nasional melalui integrasi vertikal lengkap mulai dari prinsipal global, perakitan lokal, komponen, logistik, main dealer, hingga jasa pembiayaan.",
    revenue: "Rp 316.5 T (FY2025)",
    netIncome: "Rp 33.8 T (FY2025)",
    employeeCount: "~200,000 karyawan",
    headquarters: "Jakarta Utara, DKI Jakarta",
    upstream: [
      { id: "toyota", name: "Toyota Motor Corp.", country: "Jepang", type: "Prinsipal Global", desc: "Pemilik lisensi merk Toyota. Menyuplai teknologi, mesin, dan komponen CKD (Completely Knocked Down) untuk dirakit secara lokal oleh TMMIN.", logo: "T", color: "from-red-600 to-rose-700", keyProducts: ["Desain & Lisensi", "Mesin Toyota", "Komponen CKD"], relevance: "Sangat Tinggi" },
      { id: "honda", name: "Honda Motor Co. Ltd.", country: "Jepang", type: "Prinsipal Global", desc: "Pemegang lisensi sepeda motor Honda. Menyuplai mesin, desain, dan komponen inti untuk sepeda motor terlaris di pasar massal Indonesia.", logo: "H", color: "from-red-500 to-red-650", keyProducts: ["Lisensi Motor", "Komponen Inti"], relevance: "Sangat Tinggi" },
      { id: "daihatsu_isuzu", name: "Daihatsu & Isuzu", country: "Jepang", type: "Prinsipal Global", desc: "Prinsipal global untuk mobil penumpang kompak (Daihatsu) dan kendaraan niaga/truk angkut tambang (Isuzu).", logo: "D", color: "from-blue-600 to-cyan-600", keyProducts: ["Lisensi Daihatsu", "Truk Niaga Isuzu"], relevance: "Tinggi" },
      { id: "auto_up", name: "PT Astra Otoparts Tbk (AUTO)", country: "Indonesia", type: "Pemasok Komponen", desc: "Pabrikan komponen otomotif terbesar di Indonesia (anak usaha Astra) yang didukung oleh rantai pasok lokal (Tier 2/3) ratusan UMKM cetakan besi/karet.", logo: "A", color: "from-indigo-500 to-blue-600", keyProducts: ["Baterai GS Astra", "Ban Aspira", "Part Transmisi"], relevance: "Sangat Tinggi" }
    ],
    internal: [
      { id: "pabrik_manufaktur", name: "Manufaktur (AHM / ADM / TMMIN)", role: "Perakitan Utama", desc: "Pabrik perakitan raksasa di Karawang/Sunter yang merakit motor Honda (AHM) dan mobil Toyota/Daihatsu (ADM & TMMIN) untuk pasar lokal dan ekspor.", icon: "factory" },
      { id: "distributor_dealer", name: "Main Dealer (Auto2000 & HSO)", role: "Distribusi & Sales", desc: "Jaringan pemasaran utama Auto2000 (untuk mobil Toyota) dan Honda Sales Operation (untuk motor Honda) dengan ratusan cabang ritel.", icon: "building" },
      { id: "logistik_selog", name: "Logistik (SELOG & MODA)", role: "Logistik & Delivery", desc: "Jasa pengiriman kendaraan terintegrasi dari pabrik ke pelabuhan/dealer via darat (car carrier) dan laut oleh Serasi Logistics & MODA.", icon: "truck" }
    ],
    downstream: [
      { id: "retail_consumers", name: "Konsumen Retail Indonesia", sector: "Pasar Massal Otomotif", parent: "Masyarakat Umum", desc: "Konsumen individu di Indonesia yang membeli sepeda motor Honda dan mobil penumpang Toyota/Daihatsu untuk kebutuhan transportasi pribadi.", logo: "K", share: 35, volume: "Sangat Tinggi", relationType: "Mass Market (B2C)" },
      { id: "finance_acc_fif", name: "Pembiayaan (ACC & FIFGROUP)", sector: "Jasa Pembiayaan", parent: "Anak Usaha ASII", desc: "Bertindak sebagai fasilitator pembayaran. Menalangi dana pembelian unit ke dealer sehingga konsumen B2C/B2B dapat mengangsur secara kredit.", logo: "F", share: 30, volume: "Tinggi", relationType: "Internal Financial Enabler" },
      { id: "trac_rental", name: "PT Serasi Autoraya (TRAC)", sector: "Rental & Fleet Korporat", parent: "Anak Usaha ASII", desc: "Pembeli B2B dalam skala besar dari main dealer Astra untuk disewakan kembali sebagai kendaraan operasional kantor atau B2B fleet.", logo: "T", share: 20, volume: "Tinggi", relationType: "Subsidiary & Captive Client" },
      { id: "fleet_mining_log", name: "Sektor Tambang & Logistik", sector: "Armada Niaga Korporat", parent: "Lintas Sektor B2B", desc: "Perusahaan tambang dan ekspedisi (termasuk UNTR & Adaro) yang membeli unit truk Isuzu untuk armada logistik jarak jauh.", logo: "S", share: 15, volume: "Medium", relationType: "B2B Client" }
    ]
  },
  "BBRI": {
    "name": "PT Bank Rakyat Indonesia (Persero) Tbk",
    "ticker": "BBRI",
    "sector": "Keuangan",
    "subSector": "Perbankan Mikro",
    "overview": "BBRI is Indonesia's largest state-owned commercial bank, specializing in micro, small, and medium enterprise (MSME) financing, and acting as the parent company of the Ultra Micro (UMi) Holding.",
    "revenue": "Rp 195.1 T (FY2023)",
    "netIncome": "Rp 60.4 T (FY2023)",
    "employeeCount": "~110,000 karyawan",
    "headquarters": "Jakarta Pusat, DKI Jakarta",
    "upstream": [
      {
        "id": "google_cloud",
        "name": "Google Cloud Indonesia",
        "country": "Amerika Serikat",
        "type": "Infrastruktur Cloud",
        "desc": "Provides cloud computing, advanced analytics, and machine learning infrastructure to power BBRI's digital banking services (BRImo) and credit scoring models.",
        "logo": "G",
        "color": "from-red-500 to-yellow-500",
        "keyProducts": [
          "Google Cloud Platform",
          "Apigee API Management"
        ],
        "relevance": "Sangat Tinggi"
      },
      {
        "id": "telkom_indonesia",
        "name": "PT Telekomunikasi Indonesia Tbk",
        "country": "Indonesia",
        "type": "Jasa Telekomunikasi & Satelit",
        "desc": "Provides critical telecommunications network infrastructure, leased lines, and VSAT satellite connectivity to link thousands of rural BBRI branches and ATMs.",
        "logo": "T",
        "color": "from-red-600 to-red-800",
        "keyProducts": [
          "Transponder Satelit",
          "Virtual Private Network (VPN)",
          "Metro Ethernet"
        ],
        "relevance": "Sangat Tinggi"
      },
      {
        "id": "oracle_indonesia",
        "name": "Oracle Indonesia",
        "country": "Amerika Serikat",
        "type": "Sistem Core Banking & Database",
        "desc": "Supplies the database software licenses, middleware, and enterprise resource planning systems that manage millions of customer ledger accounts securely.",
        "logo": "O",
        "color": "from-red-700 to-gray-900",
        "keyProducts": [
          "Oracle Database Enterprise",
          "Exadata Database Machine"
        ],
        "relevance": "Tinggi"
      },
      {
        "id": "jamkrindo_askrindo",
        "name": "PT Jamkrindo & PT Askrindo",
        "country": "Indonesia",
        "type": "Penjaminan Kredit",
        "desc": "State-owned credit guarantee corporations that cover risk defaults for BBRI's massive government-backed Micro Credit (Kredit Usaha Rakyat - KUR) program.",
        "logo": "J",
        "color": "from-blue-600 to-cyan-500",
        "keyProducts": [
          "Asuransi Penjaminan KUR",
          "Credit Guarantee Insurance"
        ],
        "relevance": "Sangat Tinggi"
      }
    ],
    "internal": [
      {
        "id": "pegadaian",
        "name": "PT Pegadaian",
        "role": "Pembiayaan Berbasis Gadai",
        "desc": "Subsidiary focusing on gold-backed and pawn-based micro-loans, integrated under the Ultra Micro (UMi) co-location network (SenyuM).",
        "icon": "building"
      },
      {
        "id": "pnm",
        "name": "PT Permodalan Nasional Madani (PNM)",
        "role": "Pembiayaan Kelompok Ultra Mikro",
        "desc": "Subsidiary specializing in group-based lending (Mekaar scheme) targeted at unbanked female entrepreneurs to foster financial inclusion.",
        "icon": "users"
      },
      {
        "id": "agen_brilink",
        "name": "AgenBRILink Network",
        "role": "Laku Pandai / Agen Branchless Banking",
        "desc": "Internal/hybrid network of over 740,000 active community agents nationwide providing over-the-counter financial services to rural areas.",
        "icon": "store"
      },
      {
        "id": "bank_raya",
        "name": "PT Bank Raya Indonesia Tbk",
        "role": "Perbankan Digital",
        "desc": "Publicly traded digital banking subsidiary focused on gig economy workers, tech-driven micro-credits, and agile savings apps.",
        "icon": "tablet"
      }
    ],
    "downstream": [
      {
        "id": "micro_msme_clients",
        "name": "Micro & Ultra-Micro MSME Segment",
        "sector": "Peralatan Ritel, Pertanian, & Jasa Dagang",
        "parent": "Independen",
        "desc": "Millions of small merchants, farmers, and home-based businesses utilizing BBRI's micro-loans (Kupedes, KUR) and transaction accounts to run local operations.",
        "logo": "U",
        "share": 48,
        "volume": "Tinggi",
        "relationType": "B2B Client"
      },
      {
        "id": "corporate_bumn_clients",
        "name": "State-Owned Enterprises & Large Corporates",
        "sector": "Energi, Infrastruktur, & Perkebunan",
        "parent": "BUMN",
        "desc": "Large corporate entities (e.g., PLN, Pertamina, Bulog) utilizing BBRI's wholesale corporate loans, syndications, and cash management solutions.",
        "logo": "C",
        "share": 20,
        "volume": "Tinggi",
        "relationType": "Government Contract"
      },
      {
        "id": "sme_commercial_clients",
        "name": "Small & Medium Enterprises (SME)",
        "sector": "Perdagangan Grosir & Manufaktur Lokal",
        "parent": "Independen",
        "desc": "Mid-market businesses requiring commercial working capital, investment loans, trade finance, and payroll distribution services.",
        "logo": "S",
        "share": 17,
        "volume": "Medium",
        "relationType": "B2B Client"
      },
      {
        "id": "retail_consumer_clients",
        "name": "Retail & Consumer Business Segment",
        "sector": "Individu & Pegawai Negeri/Swasta",
        "parent": "Individu",
        "desc": "Individual retail banking clients utilizing home ownership loans (KPR), consumer loans (Briguna), credit cards, and digital assets via BRImo.",
        "logo": "R",
        "share": 15,
        "volume": "Tinggi",
        "relationType": "B2B Client"
      }
    ]
  },
  PAMA: {
    name: "PT Pamapersada Nusantara (PAMA)",
    ticker: "PAMA",
    sector: "Energi & Sumber Daya",
    subSector: "Kontraktor Tambang",
    overview: "Kontraktor penambangan batubara terbesar di Indonesia, menyediakan jasa pertambangan terpadu dari desain, eksplorasi, ekstraksi, hingga logistik batubara.",
    revenue: "Rp 65.2 T (Estimasi FY2025)",
    netIncome: "Rp 7.8 T (Estimasi FY2025)",
    employeeCount: "~22,000 karyawan",
    headquarters: "Jakarta Timur, DKI Jakarta",
    upstream: [
      { id: "untr", name: "PT United Tractors Tbk", country: "Indonesia", type: "Alat Berat Utama", desc: "Perusahaan induk yang menyuplai seluruh armada alat berat Komatsu, truk Scania, serta suku cadang dan mekanik purna jual.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Excavator Komatsu", "Heavy Dump Truck", "Spareparts"], relevance: "Sangat Tinggi (Captive Parent)" },
      { id: "pertamina", name: "PT Pertamina (Persero)", country: "Indonesia", type: "Lubricants & Fuel", desc: "Pemasok BBM solar industri (HSD) berskala besar untuk konsumsi alat-alat berat di lokasi tambang (mining site).", logo: "P", color: "from-emerald-500 to-teal-600", keyProducts: ["Solar Industri", "Oli Industri"], relevance: "Sangat Tinggi" },
      { id: "pandu_eng", name: "PT UT Pandu Engineering", country: "Indonesia", type: "Fabrikasi & Attachment", desc: "Menyuplai attachments alat berat seperti coal bucket, dump vessel, dan trailer pengangkut batubara.", logo: "P", color: "from-slate-500 to-slate-700", keyProducts: ["Coal Bucket", "Vessel Dump Truck"], relevance: "Medium" }
    ],
    internal: [
      { id: "pama_academy", name: "PAMA Academy", role: "Pelatihan Operator", desc: "Fasilitas training internal dengan simulator alat berat canggih untuk mencetak operator tambang yang produktif dan mengutamakan safety.", icon: "graduation" },
      { id: "she_division", name: "Divisi Safety & SHE", role: "Keselamatan Kerja", desc: "Divisi pengawas keselamatan kerja (Safety, Health & Environment) untuk memitigasi risiko kerja fatal di tambang terbuka.", icon: "wrench" }
    ],
    downstream: [
      { id: "adro", name: "PT Adaro Energy Indonesia Tbk", sector: "Tambang Batu Bara & Mineral", parent: "Grup Adaro", desc: "Klien utama PAMA untuk pemindahan tanah penutup (overburden removal) dan pengangkutan batubara di Kalimantan Selatan.", logo: "A", share: 30, volume: "Tinggi", relationType: "B2B Contractor Contract" },
      { id: "bumi", name: "PT Bumi Resources Tbk (BUMI)", sector: "Tambang Batu Bara & Mineral", parent: "Grup Bakrie/Salim", desc: "Menggunakan jasa kontraktor PAMA di lokasi tambang Kaltim Prima Coal (KPC) Sangatta untuk pemindahan lapisan tanah penutup skala raksasa.", logo: "B", share: 35, volume: "Tinggi", relationType: "B2B Contractor Contract" },
      { id: "ptba", name: "PT Bukit Asam Tbk (PTBA)", sector: "Tambang Batu Bara & Mineral", parent: "BUMN Mind ID", desc: "Kontrak jasa pertambangan di site Tanjung Enim, Sumatera Selatan untuk pengerjaan overburden removal dan penambangan batu bara.", logo: "P", share: 15, volume: "Medium", relationType: "B2B Client (BUMN)" },
      { id: "indy", name: "PT Indika Energy Tbk", sector: "Tambang Batu Bara & Mineral", parent: "Grup Indika", desc: "Kontrak penambangan batubara dengan anak usaha Kideco Jaya Agung di Kalimantan Timur.", logo: "I", share: 12, volume: "Medium", relationType: "B2B Contractor Contract" },
      { id: "harum", name: "PT Harum Energy Tbk", sector: "Tambang Batu Bara & Mineral", parent: "Grup Harum", desc: "Kontrak jasa penambangan batubara jangka menengah di site tambang Mahakam Sumber Jaya, Kaltim.", logo: "H", share: 8, volume: "Rendah", relationType: "B2B Contractor Contract" }
    ]
  },
  BUMI: {
    name: "PT Bumi Resources Tbk",
    ticker: "BUMI",
    sector: "Energi & Sumber Daya",
    subSector: "Batubara & Mineral",
    overview: "Produsen batubara terbesar di Indonesia yang mengelola tambang Kaltim Prima Coal (KPC) dan Arutmin Indonesia dengan volume produksi mencapai puluhan juta ton per tahun.",
    revenue: "Rp 112.8 T (FY2025)",
    netIncome: "Rp 4.2 T (FY2025)",
    employeeCount: "~18,000 karyawan",
    headquarters: "Jakarta Selatan, DKI Jakarta",
    upstream: [
      { id: "pama", name: "PT Pamapersada Nusantara", country: "Indonesia", type: "Jasa Penambangan", desc: "Kontraktor utama pengupasan tanah penutup (overburden) dan penggalian batubara di tambang KPC.", logo: "P", color: "from-violet-600 to-indigo-700", keyProducts: ["Jasa Kontraktor Tambang", "Overburden Removal"], relevance: "Sangat Tinggi" },
      { id: "untr", name: "PT United Tractors Tbk", country: "Indonesia", type: "Alat Berat", desc: "Pemasok armada alat berat dump truck raksasa Komatsu dan excavator pendukung untuk operasi tambang mandiri.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Excavator", "Heavy Dump Truck"], relevance: "Tinggi" },
      { id: "pertamina", name: "PT Pertamina (Persero)", country: "Indonesia", type: "Lubricants & Fuel", desc: "Menyuplai solar industri dalam volume sangat besar untuk kebutuhan logistik alat berat dan pembangkit listrik internal.", logo: "P", color: "from-emerald-500 to-teal-600", keyProducts: ["Solar Industri", "Pelumas"], relevance: "Tinggi" }
    ],
    internal: [
      { id: "kpc_mine", name: "PT Kaltim Prima Coal (KPC)", role: "Operasi Utama Tambang", desc: "Anak usaha utama yang mengelola konsesi tambang batubara prima di Sangatta, Kalimantan Timur.", icon: "factory" },
      { id: "arutmin_mine", name: "PT Arutmin Indonesia", role: "Operasi Tambang", desc: "Anak usaha yang mengelola area pertambangan batubara kalori menengah dan rendah di Kalimantan Selatan.", icon: "factory" },
      { id: "lutung_terminal", name: "Tanjung Bara Coal Terminal", role: "Pelabuhan & Logistik", desc: "Pelabuhan khusus batubara milik KPC untuk kapal curah raksasa kelas Cape Size menuju pasar ekspor.", icon: "factory" }
    ],
    downstream: [
      { id: "pln", name: "PT PLN (Persero)", sector: "Utilitas Domestik", parent: "BUMN Indonesia", desc: "Penyerap batubara utama di dalam negeri untuk pemenuhan kewajiban Domestic Market Obligation (DMO) pembangkit listrik nasional.", logo: "P", share: 30, volume: "Tinggi", relationType: "DMO Contract" },
      { id: "china_energy", name: "China Energy Investment", sector: "Energi Global", parent: "BUMN China", desc: "Perusahaan pembangkit listrik milik pemerintah China yang mengimpor batubara kalori rendah-menengah untuk kelistrikan nasional mereka.", logo: "C", share: 25, volume: "Tinggi", relationType: "Term Export Client" },
      { id: "ntpc", name: "NTPC Limited (India)", sector: "Energi Global", parent: "Pemerintah India", desc: "BUMN kelistrikan India yang mengimpor batubara dari KPC/Arutmin untuk mengamankan bahan baku pembangkit listrik di India.", logo: "N", share: 20, volume: "Tinggi", relationType: "Term Export Client" },
      { id: "jpower", name: "J-Power (Jepang)", sector: "Pembangkit Internasional", parent: "Swasta Jepang", desc: "Membeli batubara kalori tinggi prima untuk pembangkit listrik hemat energi dan rendah emisi di Jepang.", logo: "J", share: 10, volume: "Medium", relationType: "Long-term Client" }
    ]
  },
  PTBA: {
    name: "PT Bukit Asam Tbk (PTBA)",
    ticker: "PTBA",
    sector: "Energi & Sumber Daya",
    subSector: "Batubara & Mineral",
    overview: "BUMN pertambangan batu bara terkemuka di Indonesia yang mengelola konsesi tambang batubara besar di Tanjung Enim, Sumatera Selatan, serta mengoperasikan PLTU mulut tambang.",
    revenue: "Rp 38.5 T (FY2025)",
    netIncome: "Rp 6.1 T (FY2025)",
    employeeCount: "~7,500 karyawan",
    headquarters: "Muara Enim, Sumatera Selatan",
    upstream: [
      { id: "untr", name: "PT United Tractors Tbk", country: "Indonesia", type: "Alat Berat", desc: "Menyuplai dump truck besar (HD785) dan excavator PC2000 Komatsu beserta layanan servis lapangan.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Heavy Dump Truck", "Excavator Komatsu"], relevance: "Tinggi" },
      { id: "pama", name: "PT Pamapersada Nusantara", country: "Indonesia", type: "Jasa Penambangan", desc: "Mitra kontraktor utama untuk pekerjaan pengupasan tanah penutup (overburden removal) di site Air Laya.", logo: "P", color: "from-violet-600 to-indigo-700", keyProducts: ["Jasa Kontraktor Tambang"], relevance: "Sangat Tinggi" },
      { id: "pertamina", name: "PT Pertamina (Persero)", country: "Indonesia", type: "Lubricants & Fuel", desc: "Pemasok BBM solar industri (HSD) berskala besar untuk mendukung operasional armada alat berat.", logo: "P", color: "from-emerald-500 to-teal-600", keyProducts: ["Solar Industri"], relevance: "Tinggi" },
      { id: "kai", name: "PT Kereta Api Indonesia (Persero)", country: "Indonesia", type: "Logistik KA", desc: "Mitra strategis pengangkutan batubara menggunakan kereta barang menuju pelabuhan bongkar muat.", logo: "K", color: "from-orange-500 to-red-650", keyProducts: ["Jasa Angkutan Kereta"], relevance: "Sangat Tinggi" }
    ],
    internal: [
      { id: "tambang_enim", name: "Unit Penambangan Tanjung Enim", role: "Operasi Utama Tambang", desc: "Tambang batubara terbuka utama di Sumatera Selatan dengan cadangan batubara kalori sedang-tinggi.", icon: "factory" },
      { id: "pelabuhan_tarahan", name: "Pelabuhan Tarahan Lampung", role: "Fasilitas Logistik Laut", desc: "Pelabuhan khusus batubara berkapasitas muat besar untuk pengapalan domestik dan ekspor.", icon: "factory" },
      { id: "pltu_sumsel8", name: "PLTU Sumsel-8 (Mulut Tambang)", role: "Pembangkitan Listrik", desc: "Pembangkit listrik tenaga uap mulut tambang berkapasitas 2x620 MW hasil kolaborasi dengan China Huadian.", icon: "factory" }
    ],
    downstream: [
      { id: "pln", name: "PT PLN (Persero)", sector: "Utilitas Domestik", parent: "BUMN Indonesia", desc: "Pembeli batubara domestik terbesar untuk menyuplai PLTU sistem interkoneksi Jawa-Bali-Sumatera melalui kebijakan DMO.", logo: "P", share: 40, volume: "Tinggi", relationType: "DMO Contract" },
      { id: "indocement", name: "PT Indocement Tunggal Prakarsa Tbk", sector: "Industri Semen", parent: "Grup Heidelberg", desc: "Membeli batubara kalori menengah-rendah sebagai bahan bakar kiln pembuat klinker semen.", logo: "I", share: 10, volume: "Medium", relationType: "B2B Client" },
      { id: "semen_indonesia", name: "PT Semen Indonesia (Persero) Tbk", sector: "Industri Semen", parent: "BUMN Mind ID", desc: "Menyuplai energi batu bara untuk operasi pembakaran pabrik semen di Semen Padang dan Semen Tonasa.", logo: "S", share: 12, volume: "Medium", relationType: "Affiliated B2B Client" },
      { id: "export_india", name: "NTPC & Tata Power India", sector: "Pembangkit Internasional", parent: "India", desc: "Membeli batubara ekspor kalori menengah untuk menyuplai pembangkit listrik tenaga uap di wilayah pesisir India.", logo: "N", share: 20, volume: "Tinggi", relationType: "Term Export Client" }
    ]
  },
  PTPP: {
    name: "PT Pembangunan Perumahan (Persero) Tbk",
    ticker: "PTPP",
    sector: "Infrastruktur",
    subSector: "Konstruksi Sipil & Gedung",
    overview: "BUMN konstruksi terkemuka di Indonesia yang bergerak di bidang pembangunan infrastruktur transportasi, pelabuhan, bendungan, gedung bertingkat, dan investasi properti.",
    revenue: "Rp 18.9 T (FY2025)",
    netIncome: "Rp 1.1 T (FY2025)",
    employeeCount: "~8,000 karyawan",
    headquarters: "Jakarta Timur, DKI Jakarta",
    upstream: [
      { id: "semen_indonesia", name: "PT Semen Indonesia (Persero) Tbk", country: "Indonesia", type: "Bahan Baku Utama", desc: "Penyedia semen curah, semen kantong, dan beton siap pakai (ready-mix) untuk konstruksi jembatan dan struktur bangunan.", logo: "S", color: "from-blue-600 to-indigo-700", keyProducts: ["Semen Curah", "Beton Ready-mix"], relevance: "Sangat Tinggi" },
      { id: "krakatau_steel", name: "PT Krakatau Steel (Persero) Tbk", country: "Indonesia", type: "Bahan Baku Utama", desc: "Pemasok baja tulangan beton, wire mesh, dan baja profil untuk kerangka beton bertulang struktur jembatan/gedung.", logo: "K", color: "from-red-500 to-rose-600", keyProducts: ["Baja Tulangan", "Pelat Baja"], relevance: "Tinggi" },
      { id: "untr", name: "PT United Tractors Tbk (UNTR)", country: "Indonesia", type: "Alat Berat", desc: "Menyediakan sewa dan pembelian armada excavator Komatsu, crane Tadano, dan compactor Bomag untuk pekerjaan tanah proyek infrastruktur.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Excavator Komatsu", "Mobile Crane Tadano", "Compactor Bomag"], relevance: "Tinggi" },
      { id: "adaro_water", name: "PT Adaro Tirta Mandiri", country: "Indonesia", type: "Infrastruktur Air", desc: "Rekanan penyedia sistem penyaringan air bersih dan pengelolaan limbah pada proyek kawasan industri.", logo: "A", color: "from-emerald-500 to-teal-600", keyProducts: ["Water Treatment System"], relevance: "Medium" }
    ],
    internal: [
      { id: "pp_presisi", name: "PT PP Presisi Tbk", role: "Pekerjaan Sipil & Earthwork", desc: "Anak usaha konstruksi spesialis pekerjaan pemindahan tanah (earthwork), struktur beton pracetak, dan sewa alat berat ringan.", icon: "factory" },
      { id: "pp_properti", name: "PT PP Properti Tbk", role: "Pengembangan Properti", desc: "Mengembangkan kawasan hunian vertikal (apartemen mahasiswa), perumahan tapak, dan pengelolaan gedung komersial.", icon: "factory" },
      { id: "divisi_infra", name: "Divisi Konstruksi Infrastruktur", role: "Konstruksi Mega Proyek", desc: "Divisi internal utama yang membangun jalan tol Trans Sumatera, pelabuhan Patimban, bendungan nasional, dan gedung IKN.", icon: "wrench" }
    ],
    downstream: [
      { id: "pupr", name: "Kementerian PUPR", sector: "Pemerintah / Sipil", parent: "Republik Indonesia", desc: "Klien pemerintah terbesar yang memberikan kontrak proyek bendungan, irigasi, jalan tol, dan gedung perkantoran IKN.", logo: "P", share: 38, volume: "Tinggi", relationType: "Government Contract" },
      { id: "jasa_marga", name: "PT Jasa Marga (Persero) Tbk", sector: "Operator Jalan Tol", parent: "BUMN Indonesia", desc: "Pemilik proyek konsesi tol jalan raya nasional tempat PTPP bertindak sebagai kontraktor fisik utama pembangun jalan tol.", logo: "J", share: 22, volume: "Tinggi", relationType: "B2B Client" },
      { id: "angkasa_pura", name: "PT Angkasa Pura Indonesia", sector: "Operator Bandara", parent: "BUMN Indonesia", desc: "Menugaskan pembangunan fisik dan perluasan terminal, taxiway, serta perpanjangan runway bandara internasional.", logo: "A", share: 15, volume: "Medium", relationType: "B2B Client" },
      { id: "pelindo", name: "PT Pelabuhan Indonesia", sector: "Operator Pelabuhan", parent: "BUMN Indonesia", desc: "Memesan jasa konstruksi perluasan dermaga bongkar muat petikemas dan reklamasi area pelabuhan komersial.", logo: "P", share: 15, volume: "Medium", relationType: "B2B Client" }
    ]
  },
  AALI: {
    name: "PT Astra Agro Lestari Tbk",
    ticker: "AALI",
    sector: "Kehutanan & Agribisnis",
    subSector: "Kelapa Sawit",
    overview: "Produsen kelapa sawit terkemuka di Indonesia yang mengelola perkebunan sawit terintegrasi dan menghasilkan minyak sawit mentah (CPO) berkualitas untuk pasar domestik dan ekspor.",
    revenue: "Rp 21.8 T (FY2025)",
    netIncome: "Rp 1.2 T (FY2025)",
    employeeCount: "~28,000 karyawan",
    headquarters: "Jakarta Timur, DKI Jakarta",
    upstream: [
      { id: "untr", name: "PT United Tractors Tbk", country: "Indonesia", type: "Alat Pertanian", desc: "Menyuplai traktor pertanian dan wheel loader Komatsu untuk pekerjaan angkutan TBS di area kebun dan pabrik.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Agricultural Tractor", "Wheel Loader Komatsu"], relevance: "Tinggi" },
      { id: "pupuk_indo", name: "PT Pupuk Indonesia (Persero)", country: "Indonesia", type: "Bahan Kimia / Pupuk", desc: "Menyuplai pupuk urea, NPK, dan TSP komersial untuk kebutuhan pemupukan berkala perkebunan sawit AALI.", logo: "P", color: "from-blue-600 to-cyan-500", keyProducts: ["Pupuk NPK", "Pupuk Urea"], relevance: "Sangat Tinggi" },
      { id: "koperasi_plasma", name: "Koperasi Kemitraan Plasma", country: "Indonesia", type: "Tandan Buah Segar", desc: "Pemasok TBS (Tandan Buah Segar) dari petani swadaya mitra sekitar konsesi perkebunan.", logo: "K", color: "from-emerald-500 to-green-600", keyProducts: ["Tandan Buah Segar (TBS)"], relevance: "Tinggi" }
    ],
    internal: [
      { id: "kebun_sawit", name: "Kebun Kelapa Sawit Inti", role: "Budidaya & Panen", desc: "Menggeluti area perkebunan kelapa sawit produktif ratusan ribu hektar di Sumatera, Kalimantan, dan Sulawesi.", icon: "factory" },
      { id: "pabrik_pks", name: "Pabrik Kelapa Sawit (PKS)", role: "Ekstraksi & Pengolahan", desc: "Fasilitas penggilingan TBS untuk mengekstraksi minyak sawit mentah (CPO) dan minyak inti sawit (Kernel Oil).", icon: "factory" },
      { id: "refinery_palm", name: "Fasilitas Refinery Minyak", role: "Refinery / Penyulingan", desc: "Pabrik pengolahan lanjutan CPO menjadi minyak goreng industri berkualitas tinggi.", icon: "factory" }
    ],
    downstream: [
      { id: "wilmar", name: "Wilmar International Group", sector: "Industri Pangan & Oleokimia", parent: "Singapura / Global", desc: "Membeli CPO skala besar untuk diolah menjadi minyak goreng bermerek (Sania, Fortune) dan produk turunan oleokimia.", logo: "W", share: 35, volume: "Tinggi", relationType: "B2B Client" },
      { id: "indofood", name: "PT Indofood CBP Sukses Makmur Tbk", sector: "Industri Makanan & Minuman", parent: "Grup Salim", desc: "Membeli minyak sawit refinery sebagai bahan baku minyak goreng Bimoli dan minyak goreng proses produksi mie instan Indomie.", logo: "I", share: 20, volume: "Tinggi", relationType: "B2B Client" },
      { id: "pertamina_patra", name: "PT Pertamina Patra Niaga", sector: "Energi & Bahan Bakar", parent: "BUMN Pertamina", desc: "Menyerap pasokan CPO AALI sebagai bahan campuran dalam program mandatory biodiesel nasional (B35/B40).", logo: "P", share: 25, volume: "Tinggi", relationType: "Government Mandate Client" },
      { id: "asii_otomotif", name: "Grup Astra Otomotif (Afiliasi)", sector: "Metalurgi & Manufaktur", parent: "Grup Astra", desc: "Membeli minyak kelapa sawit refinery untuk bahan baku pelumas hayati (*bio-lubricants*) dan zat pembantu manufaktur.", logo: "A", share: 5, volume: "Rendah", relationType: "Affiliated B2B Client" }
    ]
  },
  SINARMAS: {
    name: "Grup Pulp & Kertas Sinarmas",
    ticker: "INKP",
    sector: "Industri Pengolahan",
    subSector: "Kehutanan, Pulp & Kertas",
    overview: "Ekosistem pulp dan kertas terbesar di Asia Tenggara di bawah pilar Sinarmas (diwakili PT Indah Kiat Pulp & Paper Tbk) yang memproduksi pulp, kertas budaya, tisu, dan kemasan karton.",
    revenue: "Rp 54.3 T (FY2025)",
    netIncome: "Rp 7.2 T (FY2025)",
    employeeCount: "~25,000 karyawan",
    headquarters: "Jakarta Pusat, DKI Jakarta",
    upstream: [
      { id: "sinarmas_forestry", name: "Grup Sinarmas Forestry", country: "Indonesia", type: "Bahan Baku Serat Kayu", desc: "Mengelola konsesi Hutan Tanaman Industri (HTI) yang memproduksi serat kayu Acacia dan Eucalyptus sebagai bahan utama kertas.", logo: "S", color: "from-green-600 to-emerald-700", keyProducts: ["Kayu Acacia", "Kayu Eucalyptus"], relevance: "Sangat Tinggi (Internal Supply)" },
      { id: "untr", name: "PT United Tractors Tbk (UNTR)", country: "Indonesia", type: "Alat Berat Kehutanan", desc: "Menyuplai excavator Komatsu dengan attachment khusus kehutanan (harvester head) untuk tebang, pembersihan, dan penumpukan kayu.", logo: "U", color: "from-amber-500 to-yellow-600", keyProducts: ["Excavator Forestry", "Harvester Head"], relevance: "Tinggi" },
      { id: "pertamina", name: "PT Pertamina (Persero)", country: "Indonesia", type: "Lubricants & Fuel", desc: "Menyuplai solar industri dan pelumas mesin untuk kelancaran operasional generator dan boiler pabrik kertas.", logo: "P", color: "from-emerald-500 to-teal-600", keyProducts: ["Solar Industri"], relevance: "Tinggi" },
      { id: "kimia_pemasok", name: "Pemasok Kimia Industri", country: "Indonesia", type: "Bahan Kimia Proses", desc: "Menyuplai bahan kimia pemutih kertas (chlorine dioxide, caustic soda) untuk pemutihan serat pulp kayu.", logo: "K", color: "from-slate-500 to-slate-700", keyProducts: ["Caustic Soda", "Bleaching Agents"], relevance: "Medium" }
    ],
    internal: [
      { id: "mill_perawang", name: "Pabrik Indah Kiat Perawang", role: "Pabrik Pulp & Kertas Utama", desc: "Kompleks pabrik kertas terintegrasi raksasa di Riau yang memproduksi pulp kayu, kertas cetak, dan kertas tisu Paseo.", icon: "factory" },
      { id: "mill_tangerang", name: "Pabrik Indah Kiat Tangerang & Serang", role: "Pabrik Kemasan & Karton", desc: "Fasilitas manufaktur karton gelombang (corrugated box) dan kertas kemasan karton berkekuatan tinggi.", icon: "factory" },
      { id: "pembangkit_biomassa", name: "PLTU Biomassa Internal", role: "Pembangkit Listrik Captive", desc: "Fasilitas PLTU captive memanfaatkan limbah kulit kayu (bark boiler) untuk menyuplai energi mandiri ramah lingkungan.", icon: "factory" }
    ],
    downstream: [
      { id: "unilever", name: "PT Unilever Indonesia Tbk", sector: "Industri Konsumen / Ritel", parent: "Unilever", desc: "Membeli kemasan karton box dan pembungkus kertas bersertifikat FSC untuk kemasan sabun, pasta gigi, dan produk home care.", logo: "U", share: 15, volume: "Medium", relationType: "B2B Client" },
      { id: "tisu_retail", name: "Konsumen Retail Tisu (Paseo/Livi)", sector: "Pasar Ritel Konsumen", parent: "Masyarakat Umum", desc: "Penyerapan tisu Paseo, Livi, dan Nice di pasar massal Indonesia serta ekspor ke pusat perbelanjaan global.", logo: "T", share: 35, volume: "Tinggi", relationType: "B2C / Mass Market" },
      { id: "grosir_ekspor", name: "Distributor Kertas Ekspor", sector: "Perdagangan Global", parent: "Global", desc: "Mengekspor kertas cetak (Paperline, Kokuyo) dan kertas fotokopi ke lebih dari 120 negara di dunia.", logo: "G", share: 30, volume: "Tinggi", relationType: "B2B Export" },
      { id: "media_cetak", name: "Grup Penerbitan & Percetakan", sector: "Informasi & Komunikasi", parent: "Masyarakat Umum", desc: "Menyuplai kertas koran, kertas majalah, dan kertas HVS buku tulis untuk penerbit nasional.", logo: "M", share: 10, volume: "Medium", relationType: "B2B Client" }
    ]
  }
}

const LONG_CHAIN_NODES = [
  // Col 1 (Prinsipal / Supplier Utama)
  { id: "komatsu", name: "Komatsu Ltd.", logo: "K", tier: 1, x: 100, y: 70, desc: "Principal utama untuk penyediaan armada berat (excavator, bulldozer) konstruksi dan tambang.", country: "Jepang" },
  { id: "scania", name: "Scania CV AB", logo: "S", tier: 1, x: 100, y: 155, desc: "Produsen otomotif Swedia yang menyuplai dump truck raksasa dan bus premium.", country: "Swedia" },
  { id: "pertamina", name: "PT Pertamina (Persero)", logo: "P", tier: 1, x: 100, y: 240, desc: "Pemasok BBM solar industri (HSD) berskala besar untuk konsumsi alat berat di site tambang.", country: "Indonesia" },
  { id: "semen_indonesia", name: "Semen Indonesia (SMGR)", logo: "S", tier: 1, x: 100, y: 325, desc: "Produsen semen curah terbesar di Indonesia, pemasok utama proyek konstruksi.", country: "Indonesia" },
  { id: "krakatau_steel", name: "Krakatau Steel (KRAS)", logo: "K", tier: 1, x: 100, y: 410, desc: "Pabrikan baja nasional yang memasok besi beton tulangan untuk proyek infrastruktur.", country: "Indonesia" },
  { id: "kai", name: "PT KAI (Persero)", logo: "K", tier: 1, x: 100, y: 495, desc: "BUMN logistik perkeretaapian yang menyediakan jasa angkutan batubara dari mulut tambang.", country: "Indonesia" },
  { id: "pupuk_indonesia", name: "Pupuk Indonesia", logo: "P", tier: 1, x: 100, y: 580, desc: "Holding produsen pupuk nasional yang menyuplai pupuk NPK dan Urea untuk agribisnis.", country: "Indonesia" },
  
  // Col 2 (Distributor Utama)
  { id: "untr", name: "PT United Tractors Tbk (UNTR)", logo: "U", tier: 2, x: 300, y: 300, desc: "Distributor alat berat terbesar di Indonesia, bertindak sebagai jangkar distribusi dan purna jual.", country: "Indonesia" },
  
  // Col 3 (Kontraktor & Sektor Operasi)
  { id: "pama", name: "PT Pamapersada Nusantara (PAMA)", logo: "P", tier: 3, x: 500, y: 80, desc: "Kontraktor penambangan batubara terbesar di Indonesia, anak usaha inti UNTR.", country: "Indonesia" },
  { id: "wika", name: "PT Wijaya Karya Tbk (WIKA)", logo: "W", tier: 3, x: 500, y: 190, desc: "BUMN konstruksi sipil utama penyedia jasa kontraktor jalan tol dan IKN.", country: "Indonesia" },
  { id: "ptpp", name: "PT Pembangunan Perumahan Tbk (PTPP)", logo: "P", tier: 3, x: 500, y: 300, desc: "BUMN konstruksi gedung dan sipil pemegang kontrak infrastruktur nasional.", country: "Indonesia" },
  { id: "aali", name: "PT Astra Agro Lestari Tbk (AALI)", logo: "A", tier: 3, x: 500, y: 410, desc: "Perusahaan agribisnis pengelola perkebunan sawit terintegrasi produsen CPO.", country: "Indonesia" },
  { id: "sinarmas", name: "Grup Pulp & Kertas Sinarmas", logo: "S", tier: 3, x: 500, y: 520, desc: "Produsen pulp, kertas budaya, tisu Paseo, dan kemasan karton terintegrasi.", country: "Indonesia" },
  
  // Col 4 (Konsesi Tambang / Klien B2B)
  { id: "bumi", name: "PT Bumi Resources Tbk (BUMI)", logo: "B", tier: 4, x: 700, y: 70, desc: "Produsen batubara terbesar di Indonesia, mengelola tambang KPC & Arutmin.", country: "Indonesia" },
  { id: "adro", name: "PT Adaro Energy Indonesia Tbk (ADRO)", logo: "A", tier: 4, x: 700, y: 155, desc: "Grup energi terintegrasi yang memiliki konsesi tambang batubara kalori tinggi-menengah.", country: "Indonesia" },
  { id: "ptba", name: "PT Bukit Asam Tbk (PTBA)", logo: "P", tier: 4, x: 700, y: 240, desc: "BUMN pertambangan batu bara yang mengoperasikan tambang Tanjung Enim.", country: "Indonesia" },
  { id: "pupr", name: "Klien Konstruksi (PUPR/BUMN)", logo: "P", tier: 4, x: 700, y: 325, desc: "Kementerian PUPR dan BUMN operator jalan tol (Jasa Marga) pemberi kontrak infrastruktur.", country: "Indonesia" },
  { id: "wilmar", name: "Wilmar & Indofood (Sawit Ritel)", logo: "W", tier: 4, x: 700, y: 410, desc: "Pembeli CPO utama yang mengolahnya menjadi minyak goreng ritel dan mie instan.", country: "Indonesia" },
  { id: "unilever", name: "Unilever & Tisu Retail", logo: "U", tier: 4, x: 700, y: 495, desc: "Pembeli kemasan karton box FSC dan produsen hilir barang konsumen.", country: "Indonesia" },
  
  // Col 5 (Pembangkit & Pasar Akhir)
  { id: "pln", name: "PT PLN (Persero)", logo: "P", tier: 5, x: 900, y: 120, desc: "BUMN penyedia listrik nasional yang menyerap batubara domestik untuk PLTU (skema DMO).", country: "Indonesia" },
  { id: "china_energy", name: "China Energy Investment", logo: "C", tier: 5, x: 900, y: 210, desc: "BUMN energi China yang mengimpor batubara dalam volume besar untuk pembangkit listrik asing.", country: "China" },
  { id: "jpower", name: "J-Power", logo: "J", tier: 5, x: 900, y: 300, desc: "Pembangkit listrik Jepang yang membeli batubara kalori tinggi rendah emisi.", country: "Jepang" },
  { id: "ikn", name: "Proyek Infrastruktur & IKN", logo: "I", tier: 5, x: 900, y: 390, desc: "Pembangunan fisik ibu kota baru Nusantara dan jalan tol strategis nasional.", country: "Indonesia" },
  { id: "mass_market", name: "Konsumen Ritel & Ekspor", logo: "M", tier: 5, x: 900, y: 480, desc: "Masyarakat umum pengguna akhir minyak goreng, produk sanitasi, dan tisu Paseo.", country: "Global" }
];

const LONG_CHAIN_LINKS = [
  // Tier 1 -> Tier 2 & 3
  { from: "komatsu", to: "untr" },
  { from: "scania", to: "untr" },
  { from: "pertamina", to: "untr" },
  { from: "pertamina", to: "pama" },
  { from: "pertamina", to: "bumi" },
  { from: "pertamina", to: "adro" },
  { from: "pertamina", to: "ptba" },
  { from: "semen_indonesia", to: "wika" },
  { from: "semen_indonesia", to: "ptpp" },
  { from: "krakatau_steel", to: "wika" },
  { from: "krakatau_steel", to: "ptpp" },
  { from: "kai", to: "ptba" },
  { from: "pupuk_indonesia", to: "aali" },

  // Tier 2 -> Tier 3
  { from: "untr", to: "pama" },
  { from: "untr", to: "wika" },
  { from: "untr", to: "ptpp" },
  { from: "untr", to: "aali" },
  { from: "untr", to: "sinarmas" },

  // Tier 3 -> Tier 4
  { from: "pama", to: "bumi" },
  { from: "pama", to: "adro" },
  { from: "pama", to: "ptba" },
  { from: "wika", to: "pupr" },
  { from: "ptpp", to: "pupr" },
  { from: "aali", to: "wilmar" },
  { from: "sinarmas", to: "unilever" },

  // Tier 4 -> Tier 5
  { from: "bumi", to: "pln" },
  { from: "bumi", to: "china_energy" },
  { from: "bumi", to: "jpower" },
  { from: "adro", to: "pln" },
  { from: "adro", to: "china_energy" },
  { from: "adro", to: "jpower" },
  { from: "ptba", to: "pln" },
  { from: "ptba", to: "china_energy" },
  { from: "pupr", to: "ikn" },
  { from: "wilmar", to: "mass_market" },
  { from: "unilever", to: "mass_market" }
];

export default function RantaiPasokTab() {
  const [selectedFocus, setSelectedFocus] = useState('UNTR')
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [flowDirection, setFlowDirection] = useState('materials') // 'materials' (left-to-right) or 'capital' (right-to-left)
  const [filterSectors, setFilterSectors] = useState([])
  const [viewMode, setViewMode] = useState('focus') // 'focus' or 'longChain'

  const focusData = useMemo(() => {
    const key = selectedFocus === 'ADARO' ? 'ADRO' : selectedFocus
    return SUPPLY_CHAIN_DATA[key]
  }, [selectedFocus])

  // Get unique sectors in downstream for filtering
  const downstreamSectors = useMemo(() => {
    const sectors = new Set()
    focusData.downstream.forEach(b => sectors.add(b.sector))
    return Array.from(sectors)
  }, [focusData])

  // Toggle sector filter
  const handleSectorFilterToggle = (sector) => {
    if (filterSectors.includes(sector)) {
      setFilterSectors(filterSectors.filter(s => s !== sector))
    } else {
      setFilterSectors([...filterSectors, sector])
    }
  }

  // Filtered lists
  const filteredUpstream = useMemo(() => {
    return focusData.upstream.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.country.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [focusData, searchTerm])

  const filteredDownstream = useMemo(() => {
    return focusData.downstream.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.parent && item.parent.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesSector = filterSectors.length === 0 || filterSectors.includes(item.sector)
      return matchesSearch && matchesSector
    })
  }, [focusData, searchTerm, filterSectors])

  // Node Positions (scaled viewport x: 1000, y: 620)
  const positions = useMemo(() => {
    const upCount = filteredUpstream.length
    const downCount = filteredDownstream.length
    const internalCount = focusData.internal.length

    const layout = {
      focus: { x: 500, y: 150 },
      upstream: [],
      internal: [],
      downstream: []
    }

    // Upstream positioning (left side: x = 150)
    // Dynamic spacing to look good even when filtered
    const upStartY = 60
    const upEndY = 560
    const upSpacing = upCount > 1 ? (upEndY - upStartY) / (upCount - 1) : 0
    filteredUpstream.forEach((node, i) => {
      layout.upstream.push({
        id: node.id,
        x: 160,
        y: upCount > 1 ? upStartY + (i * upSpacing) : 310
      })
    })

    // Internal value-add positioning (center-bottom: x = 500)
    const intStartY = 310
    const intEndY = 550
    const intSpacing = internalCount > 1 ? (intEndY - intStartY) / (internalCount - 1) : 0
    focusData.internal.forEach((node, i) => {
      layout.internal.push({
        id: node.id,
        x: 500,
        y: internalCount > 1 ? intStartY + (i * intSpacing) : 430
      })
    })

    // Downstream positioning (right side: x = 840)
    const downStartY = 60
    const downEndY = 560
    const downSpacing = downCount > 1 ? (downEndY - downStartY) / (downCount - 1) : 0
    filteredDownstream.forEach((node, i) => {
      layout.downstream.push({
        id: node.id,
        x: 840,
        y: downCount > 1 ? downStartY + (i * downSpacing) : 310
      })
    })

    return layout
  }, [filteredUpstream, filteredDownstream, focusData])

  // Find node details when hovered or clicked
  const rawActiveDetailNode = selectedNode || hoveredNode
  const activeDetailNode = rawActiveDetailNode === 'adaro' ? 'adro' : rawActiveDetailNode

  const activeNodeDetails = useMemo(() => {
    if (!activeDetailNode) return null

    if (viewMode === 'longChain') {
      const lcNode = LONG_CHAIN_NODES.find(n => n.id === activeDetailNode)
      if (lcNode) {
        const key = lcNode.id.toUpperCase()
        if (SUPPLY_CHAIN_DATA[key]) {
          const scData = SUPPLY_CHAIN_DATA[key]
          return {
            id: lcNode.id,
            name: scData.name,
            ticker: scData.ticker,
            sector: scData.sector,
            subSector: scData.subSector,
            overview: scData.overview,
            revenue: scData.revenue,
            netIncome: scData.netIncome,
            employees: scData.employeeCount,
            hq: scData.headquarters,
            group: 'focus'
          }
        }
        
        let group = 'upstream'
        let type = 'Kemitraan'
        let keyProducts = []
        let relevance = 'Medium'
        let share = null
        let relationType = 'B2B Client'
        let volume = 'Medium'

        if (lcNode.tier === 1) {
          group = 'upstream'
          type = lcNode.id === 'pertamina' ? 'Lubricants & Fuel' : 'Alat Berat / Komponen'
          keyProducts = lcNode.id === 'komatsu' ? ['Excavator', 'Bulldozer'] : lcNode.id === 'scania' ? ['Heavy Truck', 'Chassis'] : ['Solar Industri', 'Oli']
          relevance = 'Sangat Tinggi'
        } else if (lcNode.tier === 5) {
          group = 'downstream'
          share = lcNode.id === 'pln' ? 30 : lcNode.id === 'china_energy' ? 25 : 10
          relationType = lcNode.id === 'pln' ? 'DMO Contract' : 'Export Term Client'
          volume = 'Tinggi'
        }

        return {
          id: lcNode.id,
          name: lcNode.name,
          country: lcNode.country,
          desc: lcNode.desc,
          group,
          type,
          keyProducts,
          relevance,
          share,
          relationType,
          volume
        }
      }
    }

    // Check upstream
    const upMatch = focusData.upstream.find(n => n.id === activeDetailNode)
    if (upMatch) return { ...upMatch, group: 'upstream' }

    // Check internal
    const intMatch = focusData.internal.find(n => n.id === activeDetailNode)
    if (intMatch) return { ...intMatch, group: 'internal' }

    // Check downstream
    const downMatch = focusData.downstream.find(n => n.id === activeDetailNode)
    if (downMatch) return { ...downMatch, group: 'downstream' }

    // Check focus node itself
    if (activeDetailNode === 'focus') {
      return {
        id: 'focus',
        name: focusData.name,
        ticker: focusData.ticker,
        sector: focusData.sector,
        subSector: focusData.subSector,
        overview: focusData.overview,
        revenue: focusData.revenue,
        netIncome: focusData.netIncome,
        employees: focusData.employeeCount,
        hq: focusData.headquarters,
        group: 'focus'
      }
    }

    return null
  }, [activeDetailNode, focusData, viewMode])

  // Determine path style
  const getPathProps = (nodeId, type) => {
    const isHovered = hoveredNode === nodeId
    const isSelected = selectedNode === nodeId
    const isActive = isHovered || isSelected

    let strokeColor = '#94a3b8'
    if (isActive) {
      if (type === 'upstream') strokeColor = '#3b82f6' // Blue upstream
      if (type === 'downstream') strokeColor = '#8b5cf6' // Violet downstream
    }

    return {
      stroke: strokeColor,
      strokeWidth: isActive ? 3.5 : 1.5,
      opacity: (hoveredNode || selectedNode) ? (isActive ? 1.0 : 0.4) : 0.85,
      className: isActive
        ? (flowDirection === 'materials' ? 'animate-flow-right-fast' : 'animate-flow-left-fast')
        : (flowDirection === 'materials' ? 'animate-flow-right-slow' : 'animate-flow-left-slow')
    }
  }

  const getLongChainPathProps = (link) => {
    const focalId = selectedFocus.toLowerCase()
    const isFocalPath = link.from === focalId || link.to === focalId

    const isHovered = hoveredNode === link.from || hoveredNode === link.to
    const isSelected = selectedNode === link.from || selectedNode === link.to
    const isActive = isHovered || isSelected || (!hoveredNode && !selectedNode && isFocalPath)

    const isAnyActive = hoveredNode || selectedNode || focalId

    let strokeColor = '#94a3b8'
    if (isActive) {
      strokeColor = flowDirection === 'materials' ? '#a78bfa' : '#60a5fa' // Violet for materials, blue for capital
    }

    const hasInteraction = hoveredNode || selectedNode
    let opacity = 0.75
    let strokeWidth = 1.5

    if (hasInteraction) {
      opacity = isActive ? 1.0 : 0.4
      strokeWidth = isActive ? 3.5 : 1.5
    } else {
      opacity = isFocalPath ? 0.95 : 0.5
      strokeWidth = isFocalPath ? 2.5 : 1.5
    }

    return {
      stroke: strokeColor,
      strokeWidth,
      opacity,
      className: isActive
        ? (flowDirection === 'materials' ? 'animate-flow-right-fast' : 'animate-flow-left-fast')
        : (flowDirection === 'materials' ? 'animate-flow-right-slow' : 'animate-flow-left-slow')
    }
  }

  // Determine node style classes
  const getNodeClass = (nodeId, group) => {
    const isHovered = hoveredNode === nodeId
    const isSelected = selectedNode === nodeId
    const isAnyActive = hoveredNode || selectedNode
    const isActive = isHovered || isSelected

    let baseClass = "cursor-pointer transition-all duration-300 transform "

    if (isAnyActive && !isActive) {
      baseClass += "opacity-35 scale-95"
    } else if (isActive) {
      baseClass += "scale-110 shadow-lg ring-4 "
      if (group === 'upstream') baseClass += "ring-blue-400/50"
      if (group === 'internal') baseClass += "ring-emerald-400/50"
      if (group === 'downstream') baseClass += "ring-violet-400/50"
      if (group === 'focus') baseClass += "ring-amber-400/50"
    } else {
      baseClass += "hover:scale-105"
    }

    return baseClass
  }

  // Custom icon map for internal nodes
  const renderInternalIcon = (icon) => {
    const props = { className: "text-emerald-600", size: 20 }
    if (icon === 'factory') return <Building2 {...props} />
    if (icon === 'wrench') return <Wrench {...props} />
    if (icon === 'graduation') return <GraduationCap {...props} />
    return <Cpu {...props} />
  }

  const isAnyActive = hoveredNode || selectedNode

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-140px)] flex flex-col space-y-4">
      {/* Dynamic style tag for line flowing animations */}
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

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-yellow-600 text-white p-2 rounded-lg">
            <Layers size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Visualisasi Rantai Pasok B2B (Value Chain)</h2>
            <p className="text-xs text-slate-500">Pemetaan alur supplier, operasi internal, dan pelanggan B2B secara detail</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Company Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Perusahaan Fokus:</span>
            <select
              value={selectedFocus}
              onChange={(e) => {
                const val = e.target.value
                setSelectedFocus(val)
                setSelectedNode(null)
                setHoveredNode(null)
                setFilterSectors([])
                // Check if company exists in the 5-column nodes, if not, switch to focus mode
                const existsInLongChain = LONG_CHAIN_NODES.some(n => n.id === val.toLowerCase())
                if (!existsInLongChain) {
                  setViewMode('focus')
                }
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700"
            >
              <option value="UNTR">PT United Tractors Tbk (UNTR)</option>
              <option value="PAMA">PT Pamapersada Nusantara (PAMA)</option>
              <option value="BUMI">PT Bumi Resources Tbk (BUMI)</option>
              <option value="ADRO">PT Adaro Energy Indonesia Tbk (ADRO)</option>
              <option value="PTBA">PT Bukit Asam Tbk (PTBA)</option>
              <option value="PTPP">PT Pembangunan Perumahan Tbk (PTPP)</option>
              <option value="AALI">PT Astra Agro Lestari Tbk (AALI)</option>
              <option value="SINARMAS">Grup Pulp & Kertas Sinarmas (INKP)</option>
              <option value="WIKA">PT Wijaya Karya (Persero) Tbk (WIKA)</option>
              <option value="ASII">PT Astra International Tbk (ASII)</option>
              <option value="BBRI">PT Bank Rakyat Indonesia Tbk (BBRI)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex">
            <button
              onClick={() => {
                setViewMode('focus')
                setSelectedNode(null)
                setHoveredNode(null)
              }}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${viewMode === 'focus'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Building2 size={13} />
              Mode Fokus (3-Kolom)
            </button>
            <button
              onClick={() => {
                setViewMode('longChain')
                setSelectedNode(null)
                setHoveredNode(null)
              }}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${viewMode === 'longChain'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Layers size={13} />
              Mode Rantai Panjang (5-Kolom)
            </button>
          </div>

          {/* Flow Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex">
            <button
              onClick={() => setFlowDirection('materials')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${flowDirection === 'materials'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <ArrowRight size={13} />
              Aliran Produk & Jasa
            </button>
            <button
              onClick={() => setFlowDirection('capital')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${flowDirection === 'capital'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <ArrowLeft size={13} />
              Aliran Uang / Kapital
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side (3/12): Focal Info & Filters */}
        <div className="lg:col-span-3 space-y-4">
          {/* Focal Company details Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {focusData.ticker}
              </span>
              <span className="text-xs text-slate-400">{focusData.sector}</span>
            </div>
            <div>
              <h3 className="text-md font-bold text-slate-800">{focusData.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{focusData.subSector}</p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
              {focusData.overview}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-slate-100">
              <div className="bg-slate-50 p-2 rounded-lg">
                <div className="text-slate-400 font-medium text-[10px]">REVENUE</div>
                <div className="font-bold text-slate-700 mt-0.5">{focusData.revenue}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <div className="text-slate-400 font-medium text-[10px]">LABA BERSIH</div>
                <div className="font-bold text-slate-700 mt-0.5">{focusData.netIncome}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <div className="text-slate-400 font-medium text-[10px]">KANTOR PUSAT</div>
                <div className="font-bold text-slate-700 mt-0.5 truncate" title={focusData.headquarters}>{focusData.headquarters.split(',')[0]}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <div className="text-slate-400 font-medium text-[10px]">PEKERJA</div>
                <div className="font-bold text-slate-700 mt-0.5">{focusData.employeeCount.split(' ')[0]} Karyawan</div>
              </div>
            </div>
          </div>

          {/* Interactive Filters Panel or Long Chain Info Panel */}
          {viewMode === 'longChain' ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-slate-400">
                <Info size={15} />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Info Rantai Panjang</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mode ini memvisualisasikan ekosistem **PT United Tractors Tbk (UNTR)** secara *end-to-end* yang membentang dari prinsipal manufaktur hulu hingga penyedia energi hilir.
              </p>
              <div className="text-[11px] text-slate-500 space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  <span>Tier 1: Prinsipal / Supplier Utama</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>Tier 2: Distributor / Penyedia Solusi</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Tier 3: Kontraktor Penambangan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  <span>Tier 4: Konsesi Tambang / Klien B2B</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
                  <span>Tier 5: Pembangkit / Pengguna Akhir</span>
                </div>
              </div>
              <div className="bg-amber-50/50 border border-amber-200/50 p-3 rounded-lg flex gap-2">
                <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  <strong>Interaksi:</strong> Klik salah satu lingkaran di diagram untuk mengunci profil detail hubungan korporat tersebut di panel kanan.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Search size={15} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari emiten/suplier/kategori..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs focus:outline-none text-slate-700 bg-transparent"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <span>Filter Sektor Pembeli</span>
                  {filterSectors.length > 0 && (
                    <button
                      onClick={() => setFilterSectors([])}
                      className="text-[10px] text-amber-600 hover:text-amber-800 capitalize"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {downstreamSectors.map(sector => (
                    <button
                      key={sector}
                      onClick={() => handleSectorFilterToggle(sector)}
                      className="flex items-center justify-between w-full text-left text-xs py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                    >
                      <div className="flex items-center gap-2">
                        {filterSectors.includes(sector) ? (
                          <CheckSquare size={13} className="text-amber-600" />
                        ) : (
                          <Square size={13} className="text-slate-300" />
                        )}
                        <span className="truncate">{sector}</span>
                      </div>
                      <span className="bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                        {focusData.downstream.filter(d => d.sector === sector).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-200/50 p-3 rounded-lg flex gap-2">
                <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  <strong>Tips:</strong> Tarik kursor di atas node atau klik untuk mengunci panel detail di sebelah kanan dan melihat keterkaitan hubungan B2B.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Center Side (6/12): SVG Connection Visualization */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm relative p-4 flex flex-col justify-between min-h-[480px]">
          {/* Column Indicators */}
          {viewMode === 'longChain' ? (
            <div className="flex justify-between text-[9px] font-bold text-slate-400 px-2 select-none tracking-wider uppercase">
              <span className="flex items-center gap-0.5"><Globe size={10} /> Tier 1: Prinsipal</span>
              <span className="flex items-center gap-0.5"><Cpu size={10} /> Tier 2: Distributor</span>
              <span className="flex items-center gap-0.5"><Activity size={10} /> Tier 3: Kontraktor</span>
              <span className="flex items-center gap-0.5"><Building2 size={10} /> Tier 4: Tambang</span>
              <span className="flex items-center gap-0.5"><Trees size={10} /> Tier 5: Energi</span>
            </div>
          ) : (
            <div className="flex justify-between text-[11px] font-bold text-slate-400 px-4 select-none">
              <span className="flex items-center gap-1"><Globe size={11} /> HULU (SUPPLIERS)</span>
              <span className="flex items-center gap-1"><Activity size={11} /> INTERNAL VALUE-ADD</span>
              <span className="flex items-center gap-1"><Building2 size={11} /> HILIR (BUYERS)</span>
            </div>
          )}

          {/* Interactive SVG Diagram */}
          <div className="flex-1 w-full relative">
            <svg
              viewBox="0 0 1000 600"
              className="w-full h-full select-none"
              style={{ overflow: 'visible' }}
            >
              {/* SVG Definitions for Gradients, Markers, and Filters */}
              <defs>
                <linearGradient id="gradient-untr" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="gradient-upstream" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <linearGradient id="gradient-downstream" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>

                <filter id="glow-untr" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {viewMode === 'longChain' ? (
                <>
                  {/* RENDER PATHS for Long Chain */}
                  {LONG_CHAIN_LINKS.map((link, idx) => {
                    const fromNode = LONG_CHAIN_NODES.find(n => n.id === link.from);
                    const toNode = LONG_CHAIN_NODES.find(n => n.id === link.to);
                    if (!fromNode || !toNode) return null;

                    const x1 = fromNode.x;
                    const y1 = fromNode.y;
                    const x2 = toNode.x;
                    const y2 = toNode.y;

                    const cp1x = x1 + (x2 - x1) * 0.45;
                    const cp1y = y1;
                    const cp2x = x1 + (x2 - x1) * 0.55;
                    const cp2y = y2;

                    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
                    const props = getLongChainPathProps(link);

                    return (
                      <path
                        key={`link-${idx}`}
                        d={pathData}
                        fill="none"
                        {...props}
                      />
                    );
                  })}

                  {/* RENDER NODES for Long Chain */}
                  {LONG_CHAIN_NODES.map((node) => {
                    const focalId = selectedFocus.toLowerCase();
                    const isFocal = node.id === focalId;
                    
                    const isActive = hoveredNode === node.id || selectedNode === node.id || (!hoveredNode && !selectedNode && isFocal);
                    const isAnyActive = hoveredNode || selectedNode;
                    
                    let strokeColor = "#cbd5e1";
                    let fillColor = "bg-slate-600";
                    if (node.tier === 1) { strokeColor = "#3b82f6"; fillColor = "fill-blue-600"; }
                    else if (node.tier === 2) { strokeColor = "#f59e0b"; fillColor = "fill-amber-600"; }
                    else if (node.tier === 3) { strokeColor = "#10b981"; fillColor = "fill-emerald-600"; }
                    else if (node.tier === 4) { strokeColor = "#6366f1"; fillColor = "fill-indigo-600"; }
                    else if (node.tier === 5) { strokeColor = "#8b5cf6"; fillColor = "fill-violet-600"; }

                    // Larger radius for focal node or active node
                    const r = (isFocal || node.id === hoveredNode || node.id === selectedNode) ? 26 : 20;

                    return (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        <g
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                          className={`cursor-pointer transition-all duration-300 ${
                            isAnyActive && !isActive ? "opacity-35 scale-95" : isActive ? "scale-110" : "hover:scale-105"
                          }`}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        >
                          {isFocal && (
                            <circle cx="0" cy="0" r={r + 8} className="fill-amber-500/10 stroke-amber-500/20 stroke-1 animate-pulse" />
                          )}
                          <circle cx="0" cy="0" r={r} className="fill-slate-100 stroke-2" style={{ stroke: strokeColor }} />
                          <circle cx="0" cy="0" r={r - 3} className={fillColor} />
                          <text x="0" y={r === 26 ? 5 : 4} textAnchor="middle" className="fill-white font-bold text-xs select-none">
                            {node.logo}
                          </text>

                          <text x="0" y={r + 14} textAnchor="middle" className="fill-slate-700 font-bold text-[9px] select-none">
                            {node.name.replace(' Tbk', '').replace(' Ltd.', '').replace(' (Persero)', '')}
                          </text>
                          <text x="0" y={r + 23} textAnchor="middle" className="fill-slate-400 text-[8px] select-none">
                            {node.country}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* RENDER PATHS (Upstream to Focus) */}
                  {layoutUpstreamPaths(filteredUpstream, positions, getPathProps)}

                  {/* RENDER PATHS (Focus to Downstream) */}
                  {layoutDownstreamPaths(filteredDownstream, positions, getPathProps)}

                  {/* RENDER PATHS (Focus to Internal) */}
                  {layoutInternalPaths(positions, getPathProps, focusData)}

                  {/* RENDER NODES (Upstream Suppliers) */}
                  {filteredUpstream.map((node, idx) => {
                    const pos = positions.upstream[idx]
                    if (!pos) return null
                    const isActive = hoveredNode === node.id || selectedNode === node.id
                    const isAnyActive = hoveredNode || selectedNode
                    return (
                      <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                        <g
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                          className={`cursor-pointer transition-all duration-300 ${isAnyActive && !isActive ? "opacity-35 scale-95" : isActive ? "scale-110" : "hover:scale-105"
                            }`}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        >
                          <circle cx="0" cy="0" r="24" className="fill-slate-100 stroke-blue-500 stroke-2" />
                          <circle cx="0" cy="0" r="21" className="fill-blue-600" />
                          <text x="0" y="5" textAnchor="middle" className="fill-white font-bold text-sm select-none">
                            {node.logo}
                          </text>
                          <text x="-32" y="0" textAnchor="end" className="fill-slate-700 font-semibold text-[11px] select-none">
                            {node.name.split(' ')[0]}
                          </text>
                          <text x="-32" y="12" textAnchor="end" className="fill-slate-400 text-[9px] select-none">
                            {node.country}
                          </text>
                        </g>
                      </g>
                    )
                  })}

                  {/* RENDER NODES (Internal value-adds) */}
                  {focusData.internal.map((node, idx) => {
                    const pos = positions.internal[idx]
                    if (!pos) return null
                    const isActive = hoveredNode === node.id || selectedNode === node.id
                    const isAnyActive = hoveredNode || selectedNode
                    return (
                      <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                        <g
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                          className={`cursor-pointer transition-all duration-300 ${isAnyActive && !isActive ? "opacity-35 scale-95" : isActive ? "scale-105" : "hover:scale-103"
                            }`}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
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
                      </g>
                    )
                  })}

                  {/* RENDER NODES (Downstream Buyers) */}
                  {filteredDownstream.map((node, idx) => {
                    const pos = positions.downstream[idx]
                    if (!pos) return null
                    const isActive = hoveredNode === node.id || selectedNode === node.id
                    const isAnyActive = hoveredNode || selectedNode
                    return (
                      <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                        <g
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                          className={`cursor-pointer transition-all duration-300 ${isAnyActive && !isActive ? "opacity-35 scale-95" : isActive ? "scale-110" : "hover:scale-105"
                            }`}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        >
                          <circle cx="0" cy="0" r="22" className="fill-slate-100 stroke-violet-500 stroke-2" />
                          <circle cx="0" cy="0" r="19" className="fill-violet-600" />
                          <text x="0" y="4" textAnchor="middle" className="fill-white font-bold text-xs select-none">
                            {node.logo}
                          </text>

                          <text x="30" y="-1" textAnchor="start" className="fill-slate-700 font-semibold text-[10px] select-none">
                            {node.id.toUpperCase()}
                          </text>
                          <text x="30" y="10" textAnchor="start" className="fill-slate-400 text-[8.5px] select-none">
                            {node.share}% Kontribusi
                          </text>
                        </g>
                      </g>
                    )
                  })}

                  {/* RENDER FOCUS COMPANY NODE (Center Focus Node) */}
                  <g transform={`translate(${positions.focus.x}, ${positions.focus.y})`}>
                    <g
                      onMouseEnter={() => setHoveredNode('focus')}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => setSelectedNode(selectedNode === 'focus' ? null : 'focus')}
                      className={`cursor-pointer transition-all duration-300 ${isAnyActive && hoveredNode !== 'focus' && selectedNode !== 'focus'
                        ? "opacity-35 scale-95"
                        : "scale-100 hover:scale-105"
                        }`}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    >
                      <circle cx="0" cy="0" r="50" className="fill-amber-500/10 stroke-amber-500/30 stroke-1 animate-pulse" />
                      <circle cx="0" cy="0" r="42" className="fill-amber-500/20 glow-pulse" />

                      <circle cx="0" cy="0" r="36" className="fill-amber-500 stroke-amber-600 stroke-2" filter="url(#glow-untr)" />
                      <Building2 className="text-white" size={24} style={{ transform: 'translate(-12px, -12px)' }} />

                      <text x="0" y="52" textAnchor="middle" className="fill-slate-800 font-extrabold text-[12px] select-none">
                        {focusData.ticker}
                      </text>
                      <text x="0" y="64" textAnchor="middle" className="fill-slate-400 text-[9px] select-none">
                        {focusData.name.split(' ').slice(1).join(' ')}
                      </text>
                    </g>
                  </g>
                </>
              )}
            </svg>
          </div>

          {/* Quick Stats bar inside diagram */}
          {viewMode === 'longChain' ? (
            <div className="border-t border-slate-100 pt-3 flex justify-around text-center text-xs">
              <div>
                <div className="text-slate-400 font-medium">Aliran Hulu-ke-Hilir</div>
                <div className="font-bold text-amber-600 text-sm mt-0.5">5 Tier Terintegrasi</div>
              </div>
              <div className="border-l border-slate-100" />
              <div>
                <div className="text-slate-400 font-medium">Total Perusahaan</div>
                <div className="font-bold text-emerald-600 text-sm mt-0.5">10 Korporasi</div>
              </div>
              <div className="border-l border-slate-100" />
              <div>
                <div className="text-slate-400 font-medium">Total Hubungan B2B</div>
                <div className="font-bold text-violet-600 text-sm mt-0.5">16 Koneksi Utama</div>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-3 flex justify-around text-center text-xs">
              <div>
                <div className="text-slate-400 font-medium">Pemasok Hulu</div>
                <div className="font-bold text-blue-600 text-sm mt-0.5">{filteredUpstream.length} Mitra</div>
              </div>
              <div className="border-l border-slate-100" />
              <div>
                <div className="text-slate-400 font-medium">Perakitan & Operasional</div>
                <div className="font-bold text-emerald-600 text-sm mt-0.5">{focusData.internal.length} Divisi</div>
              </div>
              <div className="border-l border-slate-100" />
              <div>
                <div className="text-slate-400 font-medium">B2B Pembeli</div>
                <div className="font-bold text-violet-600 text-sm mt-0.5">{filteredDownstream.length} Korporat</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side (3/12): Relationship Details Drawer */}
        <div className="lg:col-span-3">
          {activeNodeDetails ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Drawer Header with appropriate group styles */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${activeNodeDetails.group === 'upstream' ? 'bg-blue-100 text-blue-800' :
                      activeNodeDetails.group === 'internal' ? 'bg-emerald-100 text-emerald-800' :
                        activeNodeDetails.group === 'downstream' ? 'bg-violet-100 text-violet-800' :
                          'bg-amber-100 text-amber-800'
                      }`}>
                      {activeNodeDetails.group === 'upstream' ? 'Hulu (Supplier)' :
                        activeNodeDetails.group === 'internal' ? 'Operasi Internal' :
                          activeNodeDetails.group === 'downstream' ? 'Hilir (Buyer)' :
                            'Fokus Eminten'}
                    </span>
                    <h3 className="text-md font-bold text-slate-800 mt-2">{activeNodeDetails.name}</h3>
                  </div>
                  {activeNodeDetails.country && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold bg-slate-50 px-2 py-1 rounded">
                      <Globe size={11} /> {activeNodeDetails.country}
                    </span>
                  )}
                  {activeNodeDetails.role && (
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded">
                      {activeNodeDetails.role}
                    </span>
                  )}
                </div>

                {/* Main description */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi Hubungan</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1">
                      {activeNodeDetails.desc || activeNodeDetails.overview}
                    </p>
                  </div>

                  {/* Upstream/Supplier Specific details */}
                  {activeNodeDetails.group === 'upstream' && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori Suplai</h4>
                        <span className="inline-block text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md mt-1">
                          {activeNodeDetails.type}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Produk Utama</h4>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {activeNodeDetails.keyProducts.map(prod => (
                            <span key={prod} className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-100">
                              {prod}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg text-xs flex justify-between">
                        <span className="text-slate-500">Ketergantungan:</span>
                        <span className="font-bold text-slate-700">{activeNodeDetails.relevance}</span>
                      </div>
                    </div>
                  )}

                  {/* Downstream/Buyer Specific details */}
                  {activeNodeDetails.group === 'downstream' && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sektor Industri</h4>
                        <span className="inline-block text-[10px] font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded border border-violet-100 mt-1" title={activeNodeDetails.sector}>
                          {activeNodeDetails.sector}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kontribusi Pendapatan</h4>
                        <span className="inline-block text-xs font-bold text-slate-700 mt-1">
                          {activeNodeDetails.share}% dari Total Penjualan
                        </span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sifat Hubungan</h4>
                        <span className="inline-block text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-150 mt-1">
                          {activeNodeDetails.relationType}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volume Transaksi</h4>
                        <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded mt-1.5 ${activeNodeDetails.volume === 'Tinggi' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' :
                          activeNodeDetails.volume === 'Medium' ? 'text-blue-700 bg-blue-50 border border-blue-100' :
                            'text-slate-600 bg-slate-50 border border-slate-150'
                          }`}>
                          {activeNodeDetails.volume}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Focus Node Specific details */}
                  {activeNodeDetails.group === 'focus' && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Total Revenue:</span>
                        <span className="font-bold text-slate-700">{activeNodeDetails.revenue}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-slate-50">
                        <span className="text-slate-400">Laba Bersih:</span>
                        <span className="font-bold text-slate-700">{activeNodeDetails.netIncome}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-slate-50">
                        <span className="text-slate-400">Jumlah Pekerja:</span>
                        <span className="font-bold text-slate-700">{activeNodeDetails.employees}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-slate-50">
                        <span className="text-slate-400">Kantor Pusat:</span>
                        <span className="font-bold text-slate-700 truncate" title={activeNodeDetails.hq}>{activeNodeDetails.hq}</span>
                      </div>
                    </div>
                  )}
                </div>

                {SUPPLY_CHAIN_DATA[activeNodeDetails.id.toUpperCase()] && activeNodeDetails.id.toUpperCase() !== selectedFocus && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedFocus(activeNodeDetails.id.toUpperCase())
                        setViewMode('focus') // Switch to Focus Mode (3-Kolom) to explore!
                        setSelectedNode(null)
                        setHoveredNode(null)
                        setFilterSectors([])
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm transform hover:-translate-y-0.5"
                    >
                      <span>Telusuri Rantai Pasok {activeNodeDetails.id.toUpperCase()}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Drawer footer instructions */}
              <div className="text-[10px] text-slate-400 text-center border-t border-slate-100 pt-3">
                {selectedNode ? (
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-amber-600 hover:text-amber-800 font-bold"
                  >
                    Tutup Kunci Detail
                  </button>
                ) : (
                  <span>Arahkan kursor ke node lain untuk melihat info cepat.</span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col items-center justify-center text-center space-y-3 min-h-[300px]">
              <div className="bg-slate-50 text-slate-400 p-4 rounded-full">
                <HelpCircle size={32} />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Detail Rantai Pasok</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                Arahkan kursor (hover) atau klik salah satu lingkaran/kotak di diagram untuk melihat penjelasan hubungan bisnis secara lengkap.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// LAYOUT PATH HELPER FUNCTIONS

function layoutUpstreamPaths(filteredUpstream, positions, getPathProps) {
  return filteredUpstream.map((node, i) => {
    const pos = positions.upstream[i]
    if (!pos) return null

    // Draw nice Bezier curves from upstream to focal node (x: 160 -> x: 500)
    // Left endpoint: pos.x, pos.y
    // Right endpoint: positions.focus.x - 36 (radius of focus node), positions.focus.y
    const x1 = pos.x
    const y1 = pos.y
    const x2 = positions.focus.x - 36
    const y2 = positions.focus.y

    // Control points for curvy path
    const cp1x = x1 + (x2 - x1) * 0.45
    const cp1y = y1
    const cp2x = x1 + (x2 - x1) * 0.55
    const cp2y = y2

    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
    const props = getPathProps(node.id, 'upstream')

    return (
      <path
        key={`up-${node.id}`}
        d={pathData}
        fill="none"
        {...props}
      />
    )
  })
}

function layoutDownstreamPaths(filteredDownstream, positions, getPathProps) {
  return filteredDownstream.map((node, i) => {
    const pos = positions.downstream[i]
    if (!pos) return null

    // Draw nice Bezier curves from focal node to downstream (x: 500 -> x: 840)
    // Left endpoint: positions.focus.x + 36 (radius of focus node), positions.focus.y
    // Right endpoint: pos.x, pos.y
    const x1 = positions.focus.x + 36
    const y1 = positions.focus.y
    const x2 = pos.x
    const y2 = pos.y

    // Control points for curvy path
    const cp1x = x1 + (x2 - x1) * 0.45
    const cp1y = y1
    const cp2x = x1 + (x2 - x1) * 0.55
    const cp2y = y2

    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
    const props = getPathProps(node.id, 'downstream')

    return (
      <path
        key={`down-${node.id}`}
        d={pathData}
        fill="none"
        {...props}
      />
    )
  })
}

function layoutInternalPaths(positions, getPathProps, focusData) {
  return focusData.internal.map((node, i) => {
    const pos = positions.internal[i]
    if (!pos) return null

    // Draw vertical/curved paths down from focus node
    // Focus node bottom center: positions.focus.x, positions.focus.y + 36
    // Internal node: pos.x, pos.y (height changes)
    const x1 = positions.focus.x
    const y1 = positions.focus.y + 36
    const x2 = pos.x
    const y2 = pos.y - 18 // Top of internal node box

    // Simple curved path downwards
    const cp1x = x1
    const cp1y = y1 + (y2 - y1) * 0.35
    const cp2x = x2
    const cp2y = y1 + (y2 - y1) * 0.65

    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
    const props = getPathProps(node.id, 'internal')

    // Since these paths flow downwards, override flow directions to always flow top-to-bottom
    // We can change class slightly to look good
    const isNodeActive = props.stroke !== '#cbd5e1'
    const animClass = isNodeActive ? 'animate-flow-right-fast' : 'animate-flow-right-slow'

    return (
      <path
        key={`int-${node.id}`}
        d={pathData}
        fill="none"
        {...props}
        className={animClass} // Keep standard top-to-bottom flow
      />
    )
  })
}
