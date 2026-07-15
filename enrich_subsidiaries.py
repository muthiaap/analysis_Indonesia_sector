"""Enrich anak_perusahaan.json with chain stage, operating status, province and assets.

Input : dashboard/public/anak_perusahaan.json
Output: dashboard/public/anak_perusahaan_enriched.json

Text in the source is extracted from PDF filings, so words are split by stray
spaces ("telekomunikas i", "Pengembanga n"). Rather than repair the split -- which
false-positives on real short Indonesian words ("modal ke dalam") -- all matching
is done against a despaced copy of the string.
"""
import json, re, collections, sys
from pathlib import Path

SRC = Path('dashboard/public/anak_perusahaan.json')
DST = Path('dashboard/public/anak_perusahaan_enriched.json')

# Reporting FX, mirrors getLoanValueInIDR() in dashboard/src/HubunganTab.jsx
FX_TO_IDR = {'IDR': 1.0, 'USD': 16993.0, 'SGD': 12505.0, 'EUR': 18000.0, 'MYR': 3800.0}
UNIT_MULT = {'RIBUAN': 1e3, 'JUTAAN': 1e6, 'MILYARAN': 1e9, 'MILIARAN': 1e9,
             'TRILIUNAN': 1e12, 'PENUH': 1.0, 'SATUAN': 1.0}


def despace(s: str) -> str:
    """Lowercase, keep the Indonesian half of 'Indo/English' strings, strip all
    non-letters. Collapses the PDF line-wrap corruption for free."""
    return re.sub(r'[^a-z]', '', s.split('/')[0].lower())


def despace_loc(s: str) -> str:
    """As despace() but keeps everything after '/' -- street addresses contain
    slashes ("Jl. Semampir II/1, Kediri") and the city sits on the far side."""
    return re.sub(r'[^a-z]', '', s.lower())


# ---------------------------------------------------------------- chain stage

# Matched as substrings against despace(activity). `holding` is evaluated LAST so
# that "Perdagangan dan investasi" resolves to distribution, not holding.
STAGE_KEYWORDS = {
    'upstream': [
        'tambang', 'penambangan', 'batubara', 'coal', 'mining', 'nikel', 'nickel',
        'bauksit', 'emas', 'timah', 'galian', 'eksplorasi', 'batukapur',
        'pasirkuarsa', 'tanahliat', 'minyakbumi', 'gasbumi', 'hulu',
        'perkebunan', 'kelapasawit', 'sawit', 'palm', 'plantation', 'karet',
        'kakao', 'cocoa', 'tebu', 'pertanian', 'agrikultur', 'agrobisnis',
        'agribisnis', 'kehutanan', 'hutan', 'kayu', 'logging',
        'perikanan', 'ikantangkap', 'budidaya', 'tambak', 'rumputlaut',
        'arowana', 'penangkaran', 'peternakan', 'ternak', 'ekstraksiherbal',
    ],
    'processing': [
        'manufaktur', 'manufacturing', 'manufactur', 'maufacturing', 'pabrik',
        'industri', 'industi', 'perakitan', 'assembly', 'pengolahan',
        'pengelolahan', 'refinery', 'kilang', 'smelter', 'karoseri', 'produksi',
        'produsen', 'pembuatan', 'maklon', 'petrokimia', 'penyulingan',
        'melamin', 'resin', 'keramik', 'garment', 'pakaianjadi', 'benang',
        'glukosa', 'krimer', 'sabun', 'kosmetik', 'biodiesel', 'concrete',
        'metalstamping', 'pengepisanlogam', 'khlordanalkali', 'perekat',
        'tiangpancang', 'precast', 'prestressed', 'semen', 'beton', 'baja',
        'kaca', 'pengalengan', 'penggilingan', 'cpo', 'pemulihanbarang',
        'polyethylen', 'polyvinyl',
    ],
    'utilities': [
        'pembangkittenagalistrik', 'pembangkitlistrik', 'pembangkitdaya',
        'ketenagalistrikan', 'tenagalistrik', 'listrik', 'power',
        'energiterbarukan', 'energibersih', 'jasaenergi', 'pengadaanenergi',
        'renewable', 'panasbumi', 'geothermal', 'airbersih', 'watertreatment',
        'pengelolaanair', 'limbah', 'transmisigas', 'kompresigas', 'lng',
        'instalasiminyakdangas',
    ],
    'infrastructure': [
        'jalantol', 'ruasjalan', 'tollroad', 'pengusahaanruas', 'pembtol',
        'kebandarudaraan', 'bandarudara', 'airportservice',
    ],
    'construction': [
        'konstruksi', 'kontraktor', 'pembangunan', 'bangunan', 'contractor',
        'infrastruktur', 'pemancangan',
    ],
    'logistics': [
        'logistik', 'pelayaran', 'shipping', 'pelabuhan', 'dermaga', 'angkutan',
        'pengangkutan', 'transportasi', 'transport', 'pergudangan', 'gudang',
        'warehouse', 'ekspedisi', 'ekspedissi', 'kargo', 'cargo', 'ekspres',
        'penyimpanan', 'terminal', 'kapal', 'penerbangan', 'bongkarmuat',
        'stevedor', 'stevadoring', 'pengirimanbarang', 'pengirimanpaket',
        'jasapengiriman', 'poskomersial', 'posuniversal', 'kurir', 'taksi',
        'pengemudi', 'specialport',
    ],
    'distribution': [
        'dealer', 'penyalur', 'distributor', 'distribusi', 'perdagangan',
        'dagang', 'trading', 'retail', 'ritel', 'eceran', 'grosir', 'penjualan',
        'showroom', 'ekspor', 'impor', 'niaga', 'ecommerce', 'toko',
        'supermarket', 'minimarket', 'waralaba', 'departmentstores', 'spbu',
        'bahanbakar', 'dispenserbahanbakar', 'elpiji', 'lpg', 'mobilbekas',
        'otomotif', 'automotive', 'mobilitas', 'pengadaanpasir',
    ],
    'property': [
        'realestat', 'realestate', 'properti', 'properi', 'property',
        'pengembanganperumahan', 'perumahan', 'kawasanindustri', 'apartemen',
        'perkantoran', 'pusatperbelanjaan', 'developer', 'pengembang',
        'landedhouse', 'kondominium', 'hunian', 'mixeduse',
        'pengelolaangedung', 'pengelolaankota', 'pengembangantanah',
    ],
    'services': [
        # finance
        'bank', 'perbankan', 'pembiayaan', 'multifinance', 'asuransi',
        'insurance', 'sekuritas', 'manajerinvestasi', 'keuangan', 'finance',
        'financing', 'leasing', 'modalventura', 'permodalanventura', 'ventura',
        'pegadaian', 'gadai', 'reksadana', 'penjaminemisiefek', 'emoney',
        'uangelektronik', 'pembayaran', 'pinjammeminjam', 'urundana',
        'finansialteknologi', 'remittance', 'valutaasing', 'valutauangasing',
        'bursaberjangka', 'kripto', 'kustodian', 'manajemenaset',
        # health
        'rumahsakit', 'perumahsakitan', 'klinik', 'kesehatan', 'farmasi',
        'laboratorium', 'laboraturium', 'medis', 'ambulans', 'poliklinik',
        # education
        'pendidikan', 'edukasi', 'elearning', 'sekolah', 'universitas',
        'pelatihan', 'iteducation',
        # ICT / telco
        'telekomunikasi', 'teknologiinformasi', 'jasakomputer', 'pemrograman',
        'pemograman', 'pirantilunak', 'software', 'internet', 'datacenter',
        'pusatdata', 'digital', 'platform', 'aplikasi', 'portalweb',
        'marketplace', 'fiberoptik', 'seratoptik', 'kabelseratoptik',
        'integrasisistem', 'sisteminformasi', 'technicalsupport', 'broadband',
        'iptv', 'komunikasidata', 'jaringan', 'reservasi',
        # media & entertainment
        'siarantelevisi', 'televisi', 'media', 'penyiaran', 'periklanan',
        'penerbitan', 'radio', 'konten', 'bioskop', 'svod', 'videoondemand',
        'perfilman', 'talent', 'artis', 'sportagency', 'klubolahraga',
        'iklandanpromosi', 'perekamanvideo',
        # hospitality & leisure
        'hotel', 'restoran', 'restaurant', 'retoran', 'pariwisata', 'wisata',
        'travel', 'birowisata', 'biroperjalanan', 'perhotelan', 'rekreasi',
        'hiburan', 'akomodasi', 'rumahmakan', 'kebugaran', 'wahanaair',
        'lapangangolf', 'katering', 'boga', 'makanandanminuman',
        # professional & business services
        'konsultasi', 'konsultan', 'consulting', 'jasamanajemen', 'alihdaya',
        'outsourcing', 'servis', 'service', 'reparasi', 'perawatan', 'bengkel',
        'sewa', 'rental', 'penyewaan', 'keamanan', 'kebersihan', 'parkir',
        'tenagakerja', 'ketenagakerjaan', 'sumberdayamanusia', 'riset',
        'surveyor', 'penilai', 'arsitektur', 'keinsinyuran', 'lelang',
        'percetakan', 'penjilidan', 'keagenan', 'eventorganizer',
        'penyelenggaraacara', 'penyelenggaraevent', 'konvensi', 'pameran',
        'eksibisi', 'administrasikantor', 'pendukungbisnis', 'penunjang',
        'inspeksikendaraan', 'bodypaint', 'rekondisi', 'pesawatterbang',
        'profesionalilmiah', 'rekayasamesin', 'pemeliharaan', 'jasapengelolaan',
        'jasait', 'itservice', 'telecommunication', 'film', 'finansial',
        'agenperjalanan', 'designkhusus',
    ],
    'holding': [   # evaluated last
        'holding', 'perusahaaninduk', 'induk', 'investasi', 'invetasi',
        'investment', 'investmen', 'penyertaanmodal', 'penyertaansaham',
        'entitasbertujuankhusus', 'kantorpusat',
    ],
}
STAGE_ORDER = ['upstream', 'processing', 'utilities', 'infrastructure',
               'construction', 'logistics', 'distribution', 'property',
               'services', 'holding']

# Opaque strings that no keyword can reach: brand names, bare nouns, jargon.
EXACT_MAP = {
    # MAPI operates these as retail F&B outlets
    'starbucks': ['services'], 'subway': ['services'], 'paulbakery': ['services'],
    'genkisushi': ['services'], 'pizzamarzano': ['services'],
    'krispykremetoastbox': ['services'], 'coldstonecreamerygodiva': ['services'],
    'foodandrefinedcuisine': ['services'],
    'bis': ['logistics'], 'garment': ['processing'], 'teknologi': ['services'],
    'energi': ['utilities'], 'lem': ['processing'], 'batukapur': ['upstream'],
    'mixeduse': ['property'], 'landedhouse': ['property'],
    'graha': ['property'],
}

# Bare or catch-all descriptors: assign a stage but never trust it.
VAGUE = {'jasa', 'umum', 'lainnya', 'lainlain', 'macammacamjasa', 'pemberianjasa',
         'pengembanganproduk', 'teknologi', 'energi', 'otomotif', 'jasainformasi',
         'manajemenasetkhusus', 'bisnisjasapenunjang', 'jasapendukungbisnis'}

# Activity text that says the entity is inactive.
SHELL_ACTIVITY = {'dormant', 'tidakaktif', 'tidakaktifdormant'}

BLANK = {'', '-', 'na', 'tidakada', 'n', 'lainnya', 'lainlain'}


def chain_stages(activity: str):
    """-> (stages: list[str], confidence: 'high'|'low', source: str)"""
    d = despace(activity)
    if d in BLANK:
        return [], 'low', 'blank'
    if d in SHELL_ACTIVITY:
        return [], 'low', 'shell'
    if d in EXACT_MAP:
        return EXACT_MAP[d], 'high', 'exact'

    hits = [st for st in STAGE_ORDER
            if any(k in d for k in STAGE_KEYWORDS[st])]
    if not hits:
        # Bare "Jasa" / "Macam-macam jasa" / "Pemberian Jasa": it is a service
        # company and nothing more can be said.
        if 'jasa' in d:
            return ['services'], 'low', 'vague'
        return [], 'low', 'unmapped'

    # Articles-of-association boilerplate: "Perdagangan, pengangkutan,
    # pembangunan, perindustrian, jasa, percetakan, pertanian dan kehutanan".
    # Lists every permitted activity; says nothing about what the entity does.
    if len(hits) >= 4:
        return hits, 'low', 'boilerplate'
    if d in VAGUE:
        return hits, 'low', 'vague'
    return hits, 'high', 'keyword'


# ------------------------------------------------------------ operating status

STATUS_CEASED = ['tidakberoperasi', 'sudahtidak', 'tidaklagi', 'dilikuidasi',
                 'likuidasi', 'bubar', 'pailit', 'dormant', 'ditutup',
                 'berhenti', 'nonaktif', 'tidakaktif', 'dijual', 'divestasi']
STATUS_NOT_YET = ['belum', 'tahappengembangan', 'tahapkonstruksi', 'praoperasi',
                  'dalampengembangan', 'persiapan', 'tahappersiapan']
STATUS_ACTIVE = ['beroperasi', 'beroprasi', 'beroprasional', 'aktif', 'operasi',
                 'opeasional', 'operasional', 'operating', 'active', 'berjalan',
                 'komersial', 'komersiil', 'ya', 'sudah', 'full']
YEARISH = re.compile(r'^(19|20)\d{2}$')


def operating_status(raw: str) -> str:
    d = despace(raw)
    if not d or YEARISH.match(raw.strip()):
        return 'unknown'
    for k in STATUS_CEASED:
        if k in d:
            return 'ceased'
    for k in STATUS_NOT_YET:
        if k in d:
            return 'not_yet'
    for k in STATUS_ACTIVE:
        if k in d:
            return 'operating'
    return 'unknown'


# ----------------------------------------------------------------- gazetteer

FOREIGN = {
    'singapur': 'Singapore', 'singapore': 'Singapore', 'malaysia': 'Malaysia',
    # 'labuan' alone would swallow Labuan Bajo (NTT); require the country suffix
    'kualalumpur': 'Malaysia', 'johorbahru': 'Malaysia', 'labuanmalaysia': 'Malaysia',
    'vietnam': 'Vietnam', 'hanoi': 'Vietnam', 'hongkong': 'Hong Kong',
    'australia': 'Australia', 'belanda': 'Netherlands',
    'thenetherlands': 'Netherlands', 'netherland': 'Netherlands',
    'kamboja': 'Cambodia', 'cambodia': 'Cambodia', 'laos': 'Laos',
    'thailand': 'Thailand', 'bangkok': 'Thailand', 'ayutthaya': 'Thailand',
    'filipina': 'Philippines', 'manila': 'Philippines', 'india': 'India',
    'britishvirgin': 'British Virgin Islands', 'virginislands': 'British Virgin Islands',
    'tortola': 'British Virgin Islands', 'marshallislands': 'Marshall Islands',
    'caymanislands': 'Cayman Islands', 'kepulauancayman': 'Cayman Islands',
    'kepulauanvirgin': 'British Virgin Islands', 'panama': 'Panama',
    'mauritius': 'Mauritius', 'bermuda': 'Bermuda', 'seychelles': 'Seychelles',
    'bahamas': 'Bahamas', 'dubai': 'United Arab Emirates',
    'uniemiratarab': 'United Arab Emirates', 'selandiabaru': 'New Zealand',
    'nigeria': 'Nigeria', 'lagos': 'Nigeria', 'brunei': 'Brunei',
    'tianjin': 'China', 'shanghai': 'China', 'rrt': 'China', 'cina': 'China',
    'jepang': 'Japan', 'koreaselatan': 'South Korea', 'turki': 'Turkey',
    'uzbekistan': 'Uzbekistan', 'arabsaudi': 'Saudi Arabia', 'oman': 'Oman',
    'denmark': 'Denmark', 'madagaskar': 'Madagascar', 'malta': 'Malta',
    'paris': 'France', 'london': 'United Kingdom',
    'unitedkingdom': 'United Kingdom', 'delawareusa': 'United States',
    'papuanewguinea': 'Papua New Guinea',
}

PROVINCES = [
    'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
    'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
    'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
    'Banten', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
    'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan',
    'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara',
    'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo',
    'Sulawesi Barat', 'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat',
]

# despaced token -> province. Longest match wins, so 'kalimantantimur' beats
# 'kalimantan'. Cities/kabupaten resolve to their province.
PLACE_TO_PROVINCE = {}
for p in PROVINCES:
    PLACE_TO_PROVINCE[despace(p)] = p
PLACE_TO_PROVINCE.update({
    # province aliases & typos
    'dkijakarta': 'DKI Jakarta', 'provinsidkijakarta': 'DKI Jakarta',
    'jakarta': 'DKI Jakarta', 'jakartaselatan': 'DKI Jakarta',
    'jakartapusat': 'DKI Jakarta', 'jakartabarat': 'DKI Jakarta',
    'jakartatimur': 'DKI Jakarta', 'jakartautara': 'DKI Jakarta',
    'southjakarta': 'DKI Jakarta', 'westjakarta': 'DKI Jakarta',
    'tanahabang': 'DKI Jakarta', 'lebakbulus': 'DKI Jakarta',
    'pasarminggu': 'DKI Jakarta', 'cilincing': 'DKI Jakarta',
    'kebonjeruk': 'DKI Jakarta', 'jatinegara': 'DKI Jakarta',
    'tebet': 'DKI Jakarta', 'pancoran': 'DKI Jakarta', 'senen': 'DKI Jakarta',
    'cempakaputih': 'DKI Jakarta', 'pademangan': 'DKI Jakarta',
    'mampangprapatan': 'DKI Jakarta', 'scbd': 'DKI Jakarta',
    'yogyakarta': 'DI Yogyakarta', 'yogjakarta': 'DI Yogyakarta',
    'jogjakarta': 'DI Yogyakarta', 'diy': 'DI Yogyakarta',
    'sleman': 'DI Yogyakarta',
    'kalteng': 'Kalimantan Tengah', 'klaimantantengah': 'Kalimantan Tengah',
    'kalimatantimur': 'Kalimantan Timur', 'ntb': 'Nusa Tenggara Barat',
    'ntt': 'Nusa Tenggara Timur', 'bangkatengah': 'Bangka Belitung',
    'pangkalpinang': 'Bangka Belitung',
    # Jawa Barat
    'bandung': 'Jawa Barat', 'kotabandung': 'Jawa Barat',
    'bandungbarat': 'Jawa Barat', 'kabupatenbandung': 'Jawa Barat',
    'bekasi': 'Jawa Barat', 'kotabekasi': 'Jawa Barat',
    'kabupatenbekasi': 'Jawa Barat', 'cikarang': 'Jawa Barat',
    'cikarangbarat': 'Jawa Barat', 'cibitung': 'Jawa Barat',
    'tambun': 'Jawa Barat', 'bogor': 'Jawa Barat', 'kabupatenbogor': 'Jawa Barat',
    'cileungsi': 'Jawa Barat', 'jonggol': 'Jawa Barat', 'cibinong': 'Jawa Barat',
    'citeureup': 'Jawa Barat', 'sentul': 'Jawa Barat', 'ciawi': 'Jawa Barat',
    'depok': 'Jawa Barat', 'karawang': 'Jawa Barat', 'purwakarta': 'Jawa Barat',
    'subang': 'Jawa Barat', 'cirebon': 'Jawa Barat', 'sukabumi': 'Jawa Barat',
    'lengkongsukabumi': 'Jawa Barat', 'majalengka': 'Jawa Barat',
    'kuningan': 'Jawa Barat', 'indramayu': 'Jawa Barat', 'cimahi': 'Jawa Barat',
    'sumedang': 'Jawa Barat', 'garut': 'Jawa Barat', 'kotagarut': 'Jawa Barat',
    'tasikmalaya': 'Jawa Barat', 'tasik': 'Jawa Barat', 'cianjur': 'Jawa Barat',
    'cibaduyut': 'Jawa Barat', 'pakuan': 'Jawa Barat',
    # Banten
    'tangerang': 'Banten', 'tanggerang': 'Banten', 'kotatangerang': 'Banten',
    'tangerangselatan': 'Banten', 'southtangerang': 'Banten',
    'kabupatentangerang': 'Banten', 'bintaro': 'Banten', 'bsdcity': 'Banten',
    'gadingserpong': 'Banten', 'serang': 'Banten', 'cilegon': 'Banten',
    'pandeglang': 'Banten', 'lebak': 'Banten', 'cimarga': 'Banten',
    'cileles': 'Banten', 'bayah': 'Banten', 'cikande': 'Banten',
    'cikupa': 'Banten', 'sukadamai': 'Banten',
    # Jawa Tengah
    'semarang': 'Jawa Tengah', 'kendal': 'Jawa Tengah', 'kudus': 'Jawa Tengah',
    'sukoharjo': 'Jawa Tengah', 'solo': 'Jawa Tengah', 'boyolali': 'Jawa Tengah',
    'salatiga': 'Jawa Tengah', 'magelang': 'Jawa Tengah', 'klaten': 'Jawa Tengah',
    'tegal': 'Jawa Tengah', 'demak': 'Jawa Tengah', 'kabupatendemak': 'Jawa Tengah',
    'pati': 'Jawa Tengah', 'cilacap': 'Jawa Tengah', 'jeruklegi': 'Jawa Tengah',
    'cipari': 'Jawa Tengah', 'banyumas': 'Jawa Tengah', 'purwokerto': 'Jawa Tengah',
    'wonogiri': 'Jawa Tengah', 'temanggung': 'Jawa Tengah',
    'pekalongan': 'Jawa Tengah', 'randugunting': 'Jawa Tengah',
    'tembalang': 'Jawa Tengah', 'grogol': 'Jawa Tengah',
    # Jawa Timur
    'surabaya': 'Jawa Timur', 'sidoarjo': 'Jawa Timur', 'gresik': 'Jawa Timur',
    'malang': 'Jawa Timur', 'kabmalang': 'Jawa Timur', 'batu': 'Jawa Timur',
    'probolinggo': 'Jawa Timur', 'kotaprobolinggo': 'Jawa Timur',
    'pasuruan': 'Jawa Timur', 'jember': 'Jawa Timur', 'sukorambi': 'Jawa Timur',
    'silo': 'Jawa Timur', 'panti': 'Jawa Timur', 'mojokerto': 'Jawa Timur',
    'jombang': 'Jawa Timur', 'kediri': 'Jawa Timur', 'madiun': 'Jawa Timur',
    'magetan': 'Jawa Timur', 'lamongan': 'Jawa Timur', 'tuban': 'Jawa Timur',
    'bojonegoro': 'Jawa Timur', 'madura': 'Jawa Timur', 'cepu': 'Jawa Timur',
    'bondowoso': 'Jawa Timur', 'lawang': 'Jawa Timur', 'driyorejo': 'Jawa Timur',
    'karangpilang': 'Jawa Timur', 'kertosono': 'Jawa Timur',
    # Bali & Nusa Tenggara
    'bali': 'Bali', 'denpasar': 'Bali', 'badung': 'Bali', 'gianyar': 'Bali',
    'singaraja': 'Bali', 'kutautara': 'Bali', 'kerobokan': 'Bali',
    'lombok': 'Nusa Tenggara Barat', 'lombokbarat': 'Nusa Tenggara Barat',
    'lomboktimur': 'Nusa Tenggara Barat', 'mataram': 'Nusa Tenggara Barat',
    'kupang': 'Nusa Tenggara Timur', 'manggaraibarat': 'Nusa Tenggara Timur',
    'timortengahselatan': 'Nusa Tenggara Timur',
    # Sumatera
    'medan': 'Sumatera Utara', 'binjai': 'Sumatera Utara',
    'deliserdang': 'Sumatera Utara', 'pematangsiantar': 'Sumatera Utara',
    'kabupatenkaro': 'Sumatera Utara', 'padang': 'Sumatera Barat',
    'indarung': 'Sumatera Barat', 'pekanbaru': 'Riau', 'dumai': 'Riau',
    'batam': 'Kepulauan Riau', 'pulaubatam': 'Kepulauan Riau',
    'kotabatam': 'Kepulauan Riau', 'bintan': 'Kepulauan Riau',
    'tanjunguncang': 'Kepulauan Riau', 'palembang': 'Sumatera Selatan',
    'tanjungenim': 'Sumatera Selatan', 'muaraenim': 'Sumatera Selatan',
    'baturaja': 'Sumatera Selatan', 'oganilir': 'Sumatera Selatan',
    'ogankomeringilir': 'Sumatera Selatan', 'lubuklinggau': 'Sumatera Selatan',
    'tanjungagung': 'Sumatera Selatan', 'kotajambi': 'Jambi',
    'bandarlampung': 'Lampung', 'provinsilampung': 'Lampung',
    'kotabengkulu': 'Bengkulu', 'acehbesar': 'Aceh',
    # Kalimantan
    'balikpapan': 'Kalimantan Timur', 'samarinda': 'Kalimantan Timur',
    'kutai': 'Kalimantan Timur', 'kutaitimur': 'Kalimantan Timur',
    'kutaikertanegara': 'Kalimantan Timur', 'bulungan': 'Kalimantan Timur',
    'pontianak': 'Kalimantan Barat', 'singkawang': 'Kalimantan Barat',
    'sekadau': 'Kalimantan Barat', 'sintang': 'Kalimantan Barat',
    'landak': 'Kalimantan Barat', 'bengkayang': 'Kalimantan Barat',
    'ketapang': 'Kalimantan Barat',
    'palangkaraya': 'Kalimantan Tengah', 'sampit': 'Kalimantan Tengah',
    'kotawaringin': 'Kalimantan Tengah', 'kotawaringinbarat': 'Kalimantan Tengah',
    'kotawaringintimur': 'Kalimantan Tengah', 'pangkalanbun': 'Kalimantan Tengah',
    'kapuas': 'Kalimantan Tengah', 'lamandau': 'Kalimantan Tengah',
    'gunungmas': 'Kalimantan Tengah', 'kalaf': 'Kalimantan Tengah',
    'banjarmasin': 'Kalimantan Selatan', 'tanahlaut': 'Kalimantan Selatan',
    'pulaulaut': 'Kalimantan Selatan', 'batulicin': 'Kalimantan Selatan',
    'kotabaru': 'Kalimantan Selatan',
    'tapin': 'Kalimantan Selatan', 'baritokuala': 'Kalimantan Selatan',
    'mandiangin': 'Kalimantan Selatan', 'anjirpasar': 'Kalimantan Selatan',
    # Sulawesi, Maluku, Papua
    'makassar': 'Sulawesi Selatan', 'makasar': 'Sulawesi Selatan',
    'pangkep': 'Sulawesi Selatan', 'manado': 'Sulawesi Utara',
    'palu': 'Sulawesi Tengah', 'kendari': 'Sulawesi Tenggara',
    'baubau': 'Sulawesi Tenggara', 'ternate': 'Maluku Utara',
    'ambon': 'Maluku', 'jayapura': 'Papua', 'mimika': 'Papua',
    'sorong': 'Papua Barat', 'manokwari': 'Papua Barat',
})
# longest first so 'kalimantantimur' is tested before 'kalimantan'
PLACE_KEYS = sorted(PLACE_TO_PROVINCE, key=len, reverse=True)
FOREIGN_KEYS = sorted(FOREIGN, key=len, reverse=True)

# Island / country names carrying no province information.
NO_PROVINCE = {'indonesia', 'jawa', 'sumatera', 'kalimantan', 'sulawesi',
               'jawasumatera', 'jawasumaterakalimantan', '', 'grahamobisel'}


def resolve_location(raw: str):
    """-> (country, province|None). Longest place name wins, so
    'kalimantantimur' is tested before 'kalimantan' and 'kotabatam' before 'batu'."""
    d = despace_loc(raw)
    if not d or d == '-':
        return None, None
    for k in FOREIGN_KEYS:
        if k in d:
            return FOREIGN[k], None
    if d in NO_PROVINCE:
        return 'Indonesia', None
    for k in PLACE_KEYS:
        if k in d:
            return 'Indonesia', PLACE_TO_PROVINCE[k]
    return 'Indonesia', None


# ------------------------------------------------------------------- numerics

# No Indonesian subsidiary holds assets above this. BBRI, the largest listed
# entity in the country, has total assets of roughly Rp 2,000 T.
ASSET_SANITY_CEILING = 1e15   # Rp 1,000 T


def parse_assets(raw: str, unit: str, currency: str):
    """-> IDR float, or None. Indonesian format: '.' thousands, ',' decimal."""
    raw = (raw or '').strip()
    if not raw or raw in ('-', '0'):
        return 0.0
    try:
        v = float(raw.replace('.', '').replace(',', '.'))
    except ValueError:
        return None
    mult = UNIT_MULT.get((unit or '').strip().upper())
    fx = FX_TO_IDR.get((currency or 'IDR').strip().upper())
    if mult is None or fx is None:
        return None
    return v * mult * fx


def assets_with_sanity(raw: str, unit: str, currency: str):
    """-> (value_idr|None, suspect: bool, alt_idr|None)

    Some filings state a full-rupiah figure while still declaring Unit=JUTAAN
    (e.g. SIMP's '2.615.324.000.000' JUTAAN), which the declared multiplier
    inflates a million-fold. Those rows get value=None so that aggregations skip
    them, and both readings are preserved for a human to adjudicate.
    """
    declared = parse_assets(raw, unit, currency)
    if declared is None or declared <= ASSET_SANITY_CEILING:
        return declared, False, None
    alt = parse_assets(raw, 'PENUH', currency)
    return None, True, alt


def parse_pct(raw: str):
    try:
        p = float((raw or '').replace(',', '.'))
    except ValueError:
        return None
    return p if 0 < p <= 100 else None


# ----------------------------------------------------------------------- main

def main():
    if not SRC.exists():
        sys.exit(f'missing {SRC} (run from repo root)')
    data = json.loads(SRC.read_text())

    out = {}
    stats = collections.Counter()
    stage_ct = collections.Counter()
    conf_ct = collections.Counter()
    src_ct = collections.Counter()
    unmapped = collections.Counter()
    unresolved_loc = collections.Counter()
    n = 0

    for ticker, rec in data.items():
        subs_out = []
        for s in rec['Subsidiaries']:
            n += 1
            act = s['Business Activity']
            stages, conf, source = chain_stages(act)
            status = operating_status(s['Operating Status'])
            if source == 'shell':
                status = 'ceased'
            country, province = resolve_location(s['Location'])
            assets, assets_suspect, assets_alt = assets_with_sanity(
                s['Total Assets'], s['Unit'], s['Currency'])
            pct = parse_pct(s['Ownership Percentage'])
            indirect = 'melalui' in s['Subsidiary Name'].lower()

            stage_ct.update(stages or ['<none>'])
            conf_ct[conf] += 1
            src_ct[source] += 1
            if source == 'unmapped':
                unmapped[act.strip()] += 1
            if country == 'Indonesia' and province is None:
                unresolved_loc[s['Location'].strip()] += 1
            if status == 'operating':
                stats['operating'] += 1
            if assets is not None:
                stats['assets_ok'] += 1
            if assets_suspect:
                stats['assets_suspect'] += 1
            if province:
                stats['province_ok'] += 1

            subs_out.append({
                **s,
                'chain_stages': stages,
                'chain_stage_primary': stages[0] if stages else None,
                'chain_confidence': conf,
                'chain_source': source,
                'status_norm': status,
                'country': country,
                'province': province,
                'total_assets_idr': assets,
                'total_assets_suspect': assets_suspect,
                'total_assets_idr_alt': assets_alt,
                'ownership_pct': pct,
                'is_indirect': indirect,
            })
        out[ticker] = {**rec, 'Subsidiaries': subs_out}

    DST.write_text(json.dumps(out, ensure_ascii=False, indent=1))

    hi = conf_ct['high']
    print(f'wrote {DST}  ({len(out)} parents, {n} subsidiaries)\n')
    print('=== chain_confidence ===')
    for k, v in conf_ct.most_common():
        print(f'  {k:6s} {v:5d}  {v/n*100:5.1f}%')
    print(f'\n  high-confidence stage: {hi}/{n} = {hi/n*100:.1f}%')

    print('\n=== chain_source ===')
    for k, v in src_ct.most_common():
        print(f'  {k:12s} {v:5d}  {v/n*100:5.1f}%')

    print('\n=== stage frequency (multi-label, sums > n) ===')
    for k, v in stage_ct.most_common():
        print(f'  {k:15s} {v:5d}')

    print('\n=== coverage ===')
    print(f'  operating          {stats["operating"]:5d}  {stats["operating"]/n*100:5.1f}%')
    print(f'  province resolved  {stats["province_ok"]:5d}  {stats["province_ok"]/n*100:5.1f}%')
    print(f'  assets in IDR      {stats["assets_ok"]:5d}  {stats["assets_ok"]/n*100:5.1f}%')
    print(f'  assets suspect     {stats["assets_suspect"]:5d}  {stats["assets_suspect"]/n*100:5.1f}%'
          '   (Unit column contradicts the figure; value nulled)')

    usable = sum(1 for r in out.values() for s in r['Subsidiaries']
                 if s['status_norm'] == 'operating' and s['chain_confidence'] == 'high')
    print(f'\n  USABLE (operating AND high-confidence stage): {usable}  ({usable/n*100:.1f}%)')

    if unmapped:
        print(f'\n=== still unmapped ({len(unmapped)} distinct, {sum(unmapped.values())} rows) ===')
        for k, v in unmapped.most_common(12):
            print(f'  {v:3d}  {k[:60]!r}')
    if unresolved_loc:
        print(f'\n=== province unresolved ({len(unresolved_loc)} distinct, {sum(unresolved_loc.values())} rows) ===')
        for k, v in unresolved_loc.most_common(10):
            print(f'  {v:3d}  {k[:60]!r}')


if __name__ == '__main__':
    main()
