import { useEffect, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, Popup, Polygon, Tooltip, useMap } from 'react-leaflet'
import { MapPin, Building2, Filter, Info, Briefcase, HelpCircle, Activity } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import * as h3 from 'h3-js'
import { createClient } from '@supabase/supabase-js'
import { poisToSectorCounts, topCompaniesForSector, dedupeCompanies } from './lib/companyPois'

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

const BKPM_COLORS = {
  ENERGI: '#f59e0b',
  KEUANGAN: '#06b6d4',
  KONSTRUKSI: '#64748b',
  PARIWISATA: '#ec4899',
  PENGANGKUTAN: '#6366f1',
  PERDAGANGAN: '#10b981',
  PERIKANAN: '#0ea5e9',
  PERINDUSTRIAN: '#f97316',
  PERTAMBANGAN: '#78716c',
  PERTANIAN: '#84cc16',
}

// Smart BKPM to PDB Macro Sector Mapping
const BKPM_TO_PDB_MAPPING = {
  PERTANIAN: {
    pdbSector: "Pertanian, Kehutanan dan Perikanan",
    description: "Mencakup subsektor pertanian tanaman pangan, perkebunan, peternakan, perburuan, dan jasa penunjang pertanian."
  },
  PERTAMBANGAN: {
    pdbSector: "Pertambangan dan Penggalian",
    description: "Mencakup pertambangan batu bara, minyak & gas bumi, bijih logam, serta penggalian batu, pasir, dan tanah liat."
  },
  PERINDUSTRIAN: {
    pdbSector: "Industri Pengolahan",
    description: "Mencakup pengolahan makanan, minuman, tekstil, pakaian jadi, kimia, farmasi, logam, mesin, otomotif, dan manufaktur lainnya."
  },
  ENERGI: {
    pdbSector: "Pengadaan Listrik dan Gas",
    description: "Mencakup pengadaan tenaga listrik, produksi & penyaluran gas bumi, pengolahan air bersih, serta daur ulang limbah."
  },
  KONSTRUKSI: {
    pdbSector: "Konstruksi",
    description: "Mencakup kegiatan konstruksi gedung, pekerjaan sipil (jalan tol, jembatan, bandara), serta instalasi mekanikal/elektrikal."
  },
  PERDAGANGAN: {
    pdbSector: "Perdagangan Besar dan Eceran, Reparasi Mobil dan Sepeda Motor",
    description: "Mencakup perdagangan grosir domestik/ekspor, eceran/ritel supermarket, serta jasa reparasi kendaraan bermotor."
  },
  PENGANGKUTAN: {
    pdbSector: "Transportasi dan Pergudangan",
    description: "Mencakup angkutan darat (jalan tol/kereta api), angkutan laut & udara, pergudangan logistik, serta kurir/pos."
  },
  PARIWISATA: {
    pdbSector: "Penyediaan Akomodasi dan Makan Minum",
    description: "Mencakup hotel bintang & non-bintang, penginapan jangka pendek, restoran, kafe, warung makan, serta jasa katering."
  },
  KEUANGAN: {
    pdbSector: "Jasa Keuangan dan Asuransi",
    description: "Mencakup perantara keuangan (bank pemerintah & swasta), asuransi jiwa/umum, reasuransi, dana pensiun, dan sekuritas."
  },
  PERIKANAN: {
    pdbSector: "Pertanian, Kehutanan dan Perikanan",
    description: "Mencakup kegiatan penangkapan ikan di laut bebas & perairan darat, budidaya tambak udang/ikan, serta pembenihan biota air."
  }
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

function normalizeSectorName(name) {
  if (!name) return ""
  let s = String(name).trim().toLowerCase()
  s = s.replace(/;/g, ",").replace(/ dan /g, " & ")
  s = s.replace(/[,\s]+/g, " ")
  return s
}

function getSectorColorStyle(sectorName) {
  if (!sectorName) return { backgroundColor: 'transparent', color: '#0f172a', borderColor: '#cbd5e1', borderWidth: '1px', borderStyle: 'solid' }
  const str = String(sectorName).trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hues = [200, 220, 240, 260, 280, 300, 320, 340, 15, 35, 145, 170, 190]
  const hue = hues[Math.abs(hash) % hues.length]
  return {
    backgroundColor: 'transparent',
    color: `hsl(${hue}, 95%, 15%)`,
    borderColor: `hsl(${hue}, 80%, 45%)`,
    borderWidth: '1.5px',
    borderStyle: 'solid'
  }
}

function countForProvince(mapData, provinceName, selectedSectors) {
  if (!mapData?.companiesByProvince?.[provinceName]) return 0
  const companies = mapData.companiesByProvince[provinceName]
  if (selectedSectors && selectedSectors.length === 0) return 0
  if (!selectedSectors) return companies.length
  return companies.filter(c => c.sektor_pdb && selectedSectors.includes(c.sektor_pdb)).length
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

function getChoroplethColor(count, maxCount, mapMetric) {
  if (!count || maxCount === 0) return '#f1f5f9'
  
  let t = 0
  if (mapMetric === 'pdrb') {
    // For macroeconomic values (PDRB), square root scaling gives the absolute best visual spread and contrast!
    t = Math.sqrt(count) / Math.sqrt(maxCount)
  } else {
    // For highly skewed values (emiten count), log scale works beautifully
    t = Math.log1p(count) / Math.log1p(maxCount)
  }

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

function legendSampleCount(maxCount, fraction, mapMetric) {
  if (maxCount <= 1) return maxCount
  if (mapMetric === 'pdrb') {
    // Square root scale milestones
    const target = Math.sqrt(maxCount) * fraction
    return Math.max(1, Math.round(target * target))
  } else {
    // Log scale milestones
    const target = Math.log1p(maxCount) * fraction
    return Math.max(1, Math.round(Math.expm1(target)))
  }
}

function bubbleSize(count, min, max) {
  if (max <= min) return { padX: 14, padY: 8, fontSize: 12, countSize: 11 }
  const t = (count - min) / (max - min)
  return {
    padX: Math.round(10 + t * 10),
    padY: Math.round(6 + t * 6),
    fontSize: Math.round(10 + t * 3),
    countSize: Math.round(10 + t * 2),
  }
}

export default function MapTab() {
  const [mapData, setMapData] = useState(null)
  const [geoJson, setGeoJson] = useState(null)
  const [selectedProvince, setSelectedProvince] = useState(null)
  const [selectedSectors, setSelectedSectors] = useState([])
  const [companySearch, setCompanySearch] = useState('')
  const [provinceSectorFilter, setProvinceSectorFilter] = useState(null)
  const [hoverProvince, setHoverProvince] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [popupLatLng, setPopupLatLng] = useState(null)
  const [sortBy, setSortBy] = useState('laba') // 'laba', 'sektor', 'ticker'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc', 'desc'
  
  // Metric Coloring Mode: 'perusahaan' (Google Maps companies), 'emiten' (listed companies count) or 'pdrb' (nominal regional GDP)
  const [mapMetric, setMapMetric] = useState('perusahaan')
  
  // Specific PDB Sector Filter (selected from top 5 list)
  const [selectedPdbSectorFilter, setSelectedPdbSectorFilter] = useState(null)

  // Perusahaan (Google Maps) mode: selected sector for the company-name list panel
  const [selectedCompanySector, setSelectedCompanySector] = useState(null)
  const [showAllCompanies, setShowAllCompanies] = useState(false)
  const [showAllProvinceCompanies, setShowAllProvinceCompanies] = useState(false)

  // H3 Hexagon and POI states
  const [pois, setPois] = useState([])
  const [isLoadingPois, setIsLoadingPois] = useState(false)
  const [selectedHexagon, setSelectedHexagon] = useState(null)
  const [categoryMapping, setCategoryMapping] = useState(null)
  const [selectedHexSectorFilter, setSelectedHexSectorFilter] = useState('all')

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'laba' ? 'desc' : 'asc')
    }
  }

  useEffect(() => {
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
      fetch('./gmaps_category_mapping.json').then(r => {
        if (!r.ok) throw new Error(`gmaps_category_mapping.json: HTTP ${r.status}`)
        return r.json()
      }),
    ])
      .then(([md, geo, catMap]) => {
        setMapData(md)
        setGeoJson(geo)
        setSelectedSectors(md.pdbSectors || [])
        setCategoryMapping(catMap)
      })
      .catch(err => {
        console.error(err)
        setLoadError(err.message || 'Gagal memuat data peta')
      })
  }, [])

  const activeSingleSector = useMemo(() => {
    // 1. Prioritize selectedPdbSectorFilter (from Top 5 list)
    if (selectedPdbSectorFilter) return selectedPdbSectorFilter
    // 2. Then provinceSectorFilter (from popup bubble)
    if (provinceSectorFilter) return provinceSectorFilter
    // 3. Then if selectedSectors has exactly 1 element
    if (selectedSectors && selectedSectors.length === 1) return selectedSectors[0]
    return null
  }, [selectedPdbSectorFilter, provinceSectorFilter, selectedSectors])

  const getProvincePdrbValue = useCallback((provStat, activeSector) => {
    if (!provStat) return 0
    if (!activeSector) return provStat.pdrb || 0
    
    // Match by exact or normalized name
    if (provStat.sectors) {
      const normActive = normalizeSectorName(activeSector)
      for (const [secName, secVal] of Object.entries(provStat.sectors)) {
        if (normalizeSectorName(secName) === normActive) {
          return secVal
        }
      }
    }
    
    // Fallback to top5Sectors if sectors map is not fully loaded/available
    if (provStat.top5Sectors) {
      const normActive = normalizeSectorName(activeSector)
      const matched = provStat.top5Sectors.find(s => normalizeSectorName(s.sector) === normActive)
      if (matched) return matched.value
    }
    
    return 0
  }, [])

  // Automatically switch map metric to 'pdrb' when a single sector is selected.
  // Never override 'perusahaan' mode — the user's explicit choice must stay, and
  // perusahaan already colors the map by PDRB anyway.
  useEffect(() => {
    if (mapMetric === 'perusahaan') return
    if (selectedPdbSectorFilter || provinceSectorFilter || (selectedSectors && selectedSectors.length === 1)) {
      setMapMetric('pdrb')
    }
  }, [selectedPdbSectorFilter, provinceSectorFilter, selectedSectors, mapMetric])

  // Active sectors for hexagon displaying/filtering
  const activeHexagonSectors = useMemo(() => {
    if (activeSingleSector) return [activeSingleSector]
    return selectedSectors
  }, [activeSingleSector, selectedSectors])

  // Load POIs when selectedProvince or active sectors change
  useEffect(() => {
    const loadProvincePOIs = async () => {
      if (!selectedProvince || !categoryMapping || !geoJson || activeHexagonSectors.length === 0) {
        setPois([]);
        setSelectedHexagon(null);
        return;
      }

      setIsLoadingPois(true);
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
            poi.pdbSector && activeHexagonSectors.includes(poi.pdbSector)
          );

          console.log(`✅ Filtered to ${matched.length} POIs matching sectors:`, activeHexagonSectors);
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
        activeHexagonSectors.includes(categoryMapping[cat])
      );

      const categoriesToUse = validCategories.length > 0 ? validCategories : ['Kantor', 'Pabrik', 'Toko'];

      const provStat = mapData?.provinceStats?.[selectedProvince];
      let sectorPdrb = 0;
      if (provStat) {
        if (activeSingleSector) {
          sectorPdrb = getProvincePdrbValue(provStat, activeSingleSector);
        } else {
          if (selectedSectors && selectedSectors.length > 0 && provStat.top5Sectors) {
            selectedSectors.forEach(secName => {
              const normSec = normalizeSectorName(secName);
              const matched = provStat.top5Sectors.find(s => normalizeSectorName(s.sector) === normSec);
              if (matched) {
                sectorPdrb += matched.value;
              }
            });
          }
          if (sectorPdrb === 0) {
            sectorPdrb = provStat.pdrb || 0;
          }
        }
      }
      const count = Math.min(150, Math.max(30, Math.round(sectorPdrb / 5e9))) || 60;

      console.log(`Generating ${count} mock POIs for ${selectedProvince} in PDB sectors:`, activeHexagonSectors);

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
  }, [selectedProvince, activeSingleSector, selectedSectors, categoryMapping, geoJson]);

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

  const maxCount = useMemo(() => {
    if (!mapData || !geoJson) return 1
    let max = 0
    geoJson.features.forEach(f => {
      const name = f.properties.PROVINSI
      const c = countForProvince(mapData, name, selectedSectors)
      if (c > max) max = c
    })
    return max || 1
  }, [mapData, geoJson, selectedSectors])

  const maxPdrb = useMemo(() => {
    if (!mapData || !geoJson) return 1
    let max = 0
    geoJson.features.forEach(f => {
      const name = f.properties.PROVINSI
      const provStat = mapData.provinceStats[name]
      const pdrb = getProvincePdrbValue(provStat, activeSingleSector)
      if (pdrb > max) max = pdrb
    })
    return max || 1
  }, [mapData, geoJson, activeSingleSector, getProvincePdrbValue])

  const provinceCounts = useMemo(() => {
    if (!mapData || !geoJson) return {}
    const counts = {}
    geoJson.features.forEach(f => {
      const name = f.properties.PROVINSI
      counts[name] = countForProvince(mapData, name, selectedSectors)
    })
    return counts
  }, [mapData, geoJson, selectedSectors])

  const provinceCompanies = useMemo(() => {
    if (!mapData || !selectedProvince) return []
    return mapData.companiesByProvince[selectedProvince] || []
  }, [mapData, selectedProvince])

  const allCompanies = useMemo(() => {
    if (!mapData) return []
    const list = []
    Object.entries(mapData.companiesByProvince).forEach(([prov, companies]) => {
      companies.forEach(c => {
        list.push({
          ...c,
          provinsi_kantor: prov
        })
      })
    })
    const unlocated = mapData.unlocatedCompanies || []
    unlocated.forEach(c => {
      list.push({
        ...c,
        provinsi_kantor: 'Luar Koordinat/Lainnya'
      })
    })
    return list
  }, [mapData])

  const selectedProvStats = useMemo(() => {
    if (!mapData || !selectedProvince) return null
    return mapData.provinceStats[selectedProvince] || null
  }, [mapData, selectedProvince])

  // Get Top 5 normalized sector names for the active province
  const normalizedTop5Sectors = useMemo(() => {
    if (!selectedProvStats || !selectedProvStats.top5Sectors) return []
    return selectedProvStats.top5Sectors.map(s => normalizeSectorName(s.sector))
  }, [selectedProvStats])

  const provinceSectorBubbles = useMemo(() => {
    if (!selectedProvStats || !selectedProvStats.top5Sectors) return []
    const top5Names = selectedProvStats.top5Sectors.map(s => s.sector)
    const top5Normalized = top5Names.map(s => normalizeSectorName(s))
    const counts = {}
    top5Names.forEach(name => {
      counts[name] = 0
    })
    provinceCompanies.forEach(c => {
      if (c.sektor_pdb) {
        const norm = normalizeSectorName(c.sektor_pdb)
        const matchIdx = top5Normalized.indexOf(norm)
        if (matchIdx !== -1) {
          const matchedName = top5Names[matchIdx]
          counts[matchedName] = (counts[matchedName] || 0) + 1
        }
      }
    })
    return Object.entries(counts)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)
  }, [provinceCompanies, selectedProvStats])

  // --- Perusahaan (Google Maps) mode: derive company data from fetched POIs ---
  const top5SectorNames = useMemo(() => {
    if (!selectedProvStats?.top5Sectors) return []
    return selectedProvStats.top5Sectors.map(s => s.sector)
  }, [selectedProvStats])

  const companySectorBubbles = useMemo(
    () => poisToSectorCounts(pois, top5SectorNames),
    [pois, top5SectorNames]
  )

  const dedupedCompanyCount = useMemo(
    () => dedupeCompanies((pois || []).filter(p => top5SectorNames.includes(p.pdbSector))).length,
    [pois, top5SectorNames]
  )

  const companyListForSector = useMemo(() => {
    if (!selectedCompanySector) return []
    return topCompaniesForSector(pois, selectedCompanySector, showAllCompanies ? 1000 : 20)
  }, [pois, selectedCompanySector, showAllCompanies])

  // Full province business list for the bottom "Daftar Perusahaan" table (perusahaan mode).
  // Honors the selected sector bubble (if any) and the search box.
  const provinceCompanyList = useMemo(() => {
    const base = (pois || []).filter(p => top5SectorNames.includes(p.pdbSector))
    const scoped = selectedCompanySector ? base.filter(p => p.pdbSector === selectedCompanySector) : base
    let list = dedupeCompanies(scoped).sort((a, b) => b.ratingCount - a.ratingCount)
    if (companySearch) {
      const q = companySearch.toLowerCase()
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.pdbSector || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [pois, top5SectorNames, selectedCompanySector, companySearch])

  const filteredCompanies = useMemo(() => {
    if (!selectedProvince) return []
    let list = [...allCompanies]
    
    // Identify if the user is actively filtering sectors
    const isSidebarFiltered = selectedSectors && mapData?.pdbSectors && selectedSectors.length < mapData.pdbSectors.length
    const hasActiveFilter = selectedPdbSectorFilter || provinceSectorFilter || isSidebarFiltered

    // Only restrict to Top 5 PDRB sectors by default if the user is NOT actively filtering
    if (!hasActiveFilter && normalizedTop5Sectors.length > 0) {
      list = list.filter(c => {
        if (!c.sektor_pdb) return false
        const normCompanySec = normalizeSectorName(c.sektor_pdb)
        return normalizedTop5Sectors.includes(normCompanySec)
      })
    }

    // Filter by single selected PDB sector (from Top 5 list) if active
    if (selectedPdbSectorFilter) {
      const normFilter = normalizeSectorName(selectedPdbSectorFilter)
      list = list.filter(c => c.sektor_pdb && normalizeSectorName(c.sektor_pdb) === normFilter)
    }

    // Filter by map popup bubble sector filter if active
    if (provinceSectorFilter) {
      const normFilter = normalizeSectorName(provinceSectorFilter)
      list = list.filter(c => c.sektor_pdb && normalizeSectorName(c.sektor_pdb) === normFilter)
    }

    // Apply main PDB sector filters (from map checkboxes/pills)
    if (selectedSectors && selectedSectors.length > 0) {
      list = list.filter(c => c.sektor_pdb && selectedSectors.includes(c.sektor_pdb))
    }
    
    if (companySearch) {
      const q = companySearch.toLowerCase()
      list = list.filter(
        c =>
          c.Ticker.toLowerCase().includes(q) ||
          (c.NamaPerusahaan || '').toLowerCase().includes(q) ||
          (c.Subindustri || '').toLowerCase().includes(q) ||
          (c.sektor_pdb || '').toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      if (sortBy === 'laba') {
        const valA = a.NetIncome
        const valB = b.NetIncome
        if (valA === null || valA === undefined) return 1
        if (valB === null || valB === undefined) return -1
        return sortOrder === 'asc' ? valA - valB : valB - valA
      } else if (sortBy === 'sektor') {
        const valA = a.sektor_pdb || ''
        const valB = b.sektor_pdb || ''
        if (valA === '') return 1
        if (valB === '') return -1
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        const valA = a.Ticker || ''
        const valB = b.Ticker || ''
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
    })

    return list
  }, [allCompanies, selectedProvince, selectedSectors, provinceSectorFilter, companySearch, sortBy, sortOrder, normalizedTop5Sectors, selectedPdbSectorFilter])

  const style = useCallback(
    feature => {
      const name = feature.properties.PROVINSI
      const provStat = mapData?.provinceStats?.[name]
      // 'perusahaan' mode colors by PDRB (we only have POI company data per province on click).
      const colorByCount = mapMetric === 'emiten'
      const count = colorByCount
        ? (provinceCounts[name] || 0)
        : getProvincePdrbValue(provStat, activeSingleSector)
      const maxVal = colorByCount ? maxCount : maxPdrb
      const scaleMode = colorByCount ? 'emiten' : 'pdrb'
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
        fillColor: getChoroplethColor(count, maxVal, scaleMode),
        weight: selected ? 0 : 1,
        opacity: selected ? 0 : 1,
        color: selected ? 'transparent' : '#64748b',
        fillOpacity: selected ? 0 : 0.82,
      }
    },
    [provinceCounts, maxCount, maxPdrb, mapMetric, mapData, selectedProvince, activeSingleSector, getProvincePdrbValue]
  )

  const onEachFeature = useCallback(
    (feature, layer) => {
      const name = feature.properties.PROVINSI
      const count = provinceCounts[name] || 0
      const provStat = mapData?.provinceStats?.[name]
      const pdrbYear = provStat?.pdrbYear || '2026'

      let tooltipContent = ''
      if (mapMetric === 'emiten') {
        tooltipContent = `<strong>${name}</strong><br/>🏢 ${count} emiten publik`
      } else if (mapMetric === 'perusahaan') {
        const pdrbVal = provStat?.pdrb
        const pdrbText = pdrbVal ? `${formatMoney(pdrbVal)} (${pdrbYear})` : '-'
        tooltipContent = `<strong>${name}</strong><br/>📈 PDRB: <strong>${pdrbText}</strong><br/>🏢 Klik untuk lihat perusahaan (Google Maps)`
      } else {
        if (activeSingleSector) {
          const pdrbVal = getProvincePdrbValue(provStat, activeSingleSector)
          tooltipContent = `<strong>${name}</strong><br/>📈 PDRB ${activeSingleSector}: <strong>${formatMoney(pdrbVal)}</strong>`
        } else {
          const pdrbVal = provStat?.pdrb
          const pdrbText = pdrbVal ? `${formatMoney(pdrbVal)} (${pdrbYear})` : '-'
          tooltipContent = `<strong>${name}</strong><br/>📈 PDRB Total: <strong>${pdrbText}</strong>`
        }
      }

      layer.bindTooltip(
        tooltipContent,
        { sticky: true }
      )
      layer.on({
        mouseover: () => setHoverProvince(name),
        mouseout: () => setHoverProvince(null),
        click: (e) => {
          setSelectedProvince(name)
          setCompanySearch('')
          setProvinceSectorFilter(null)
          setSelectedPdbSectorFilter(null)
          setPopupLatLng(e.latlng)
          setSelectedHexagon(null)
          setSelectedHexSectorFilter('all')
          setSelectedCompanySector(null)
          setShowAllCompanies(false)
          setShowAllProvinceCompanies(false)
        },
      })
    },
    [provinceCounts, mapData, mapMetric, activeSingleSector, getProvincePdrbValue, setPopupLatLng, setSelectedProvince, setCompanySearch, setProvinceSectorFilter, setSelectedPdbSectorFilter, setSelectedHexagon, setSelectedHexSectorFilter, setSelectedCompanySector, setShowAllCompanies]
  )

  const toggleSector = sector => {
    setSelectedSectors(prev => {
      if (prev.includes(sector)) {
        return prev.filter(s => s !== sector)
      }
      return [...prev, sector]
    })
  }

  const selectAllSectors = () => setSelectedSectors(mapData?.pdbSectors || [])
  const selectNoneSectors = () => setSelectedSectors([])

  // Unique sectors present in the current H3 hexagon
  const uniqueSectorsInHexagon = useMemo(() => {
    if (!selectedHexagon) return []
    const sectors = new Set()
    selectedHexagon.pois.forEach(p => {
      if (p.pdbSector) sectors.add(p.pdbSector)
    })
    return Array.from(sectors).sort()
  }, [selectedHexagon])

  // Unique subsectors/categories present in the current H3 hexagon
  const uniqueCategoriesInHexagon = useMemo(() => {
    if (!selectedHexagon) return []
    const categories = new Set()
    selectedHexagon.pois.forEach(p => {
      if (p.category) categories.add(p.category)
    })
    return Array.from(categories).sort()
  }, [selectedHexagon])

  // Filtered POIs inside the current H3 hexagon
  const filteredHexagonPois = useMemo(() => {
    if (!selectedHexagon) return []
    if (selectedHexSectorFilter === 'all') return selectedHexagon.pois
    return selectedHexagon.pois.filter(
      p => p.pdbSector === selectedHexSectorFilter || p.category === selectedHexSectorFilter
    )
  }, [selectedHexagon, selectedHexSectorFilter])

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <p className="text-red-600 font-medium mb-2">Gagal memuat data peta</p>
        <p className="text-sm text-slate-500 max-w-md mb-4">{loadError}</p>
        <p className="text-xs text-slate-400">
          Jika error menyebut NaN, jalankan ulang:{' '}
          <code className="bg-slate-100 px-1 rounded">.venv/bin/python build_map_data.py</code>
        </p>
      </div>
    )
  }

  if (!mapData || !geoJson) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-500">
        Memuat peta…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Educational Mapping Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start shadow-sm">
        <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
        <div>
          <h3 className="font-semibold text-blue-900 text-sm">💡 Analisis Pemetaan Sektor 2026 & Sebaran Emiten</h3>
          <p className="text-xs text-blue-700 mt-1 leading-normal">
            Peta regional kini ditenagai secara penuh oleh data resmi <strong>PDRB Sektoral 2026</strong>. Ketika Anda memilih provinsi di peta, sistem akan otomatis melakukan penyaringan emiten publik untuk **hanya menampilkan emiten yang terdaftar di Top 5 Sektor PDRB tertinggi** di daerah bersangkutan. Anda dapat memfilter emiten secara spesifik dengan mengklik nama sektor unggulan di panel indikator ekonomi makro sebelah kanan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4 flex flex-col">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          {/* Header Map with Metric Toggle */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-blue-600 animate-bounce" />
              <div>
                <h2 className="font-semibold text-slate-800 text-sm sm:text-base leading-tight max-w-[340px] truncate" title={activeSingleSector ? `Peta Distribusi PDRB: Sektor ${activeSingleSector}` : 'Peta Distribusi Ekonomi Regional (PDRB Total 2026)'}>
                  {activeSingleSector
                    ? `Peta Distribusi PDRB: ${activeSingleSector}`
                    : 'Peta Distribusi Ekonomi Regional (PDRB Total 2026)'
                  }
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  {hoverProvince
                    ? `${hoverProvince}: ${provinceCounts[hoverProvince] || 0} emiten terdaftar`
                    : 'Arahkan kursor atau klik wilayah untuk menjelajah'}
                </p>
              </div>
            </div>

            {/* Sliding Pill Metric Toggle */}
            <div className="flex items-center gap-0.5 bg-slate-150 p-0.5 rounded-lg border border-slate-200/80 shadow-inner">
              <button
                type="button"
                onClick={() => setMapMetric('perusahaan')}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  mapMetric === 'perusahaan'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏢 Perusahaan (Google Maps)
              </button>
              <button
                type="button"
                onClick={() => setMapMetric('emiten')}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  mapMetric === 'emiten'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏢 Emiten Publik ({mapData.meta?.locatedCompanies || 0})
              </button>
              <button
                type="button"
                onClick={() => setMapMetric('pdrb')}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  mapMetric === 'pdrb'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {activeSingleSector ? '📈 Nilai PDRB Sektor' : '📈 Nilai PDRB Total 2026'}
              </button>
            </div>
          </div>

          <div className="h-[520px] relative z-0">
            <MapContainer center={[-2.5, 118]} zoom={5} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution={CARTO_ATTRIBUTION}
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
              />
              <MapController selectedProvince={selectedProvince} geoJson={geoJson} />
              <GeoJSON
                key={selectedSectors.join(',') + (selectedProvince || '') + mapMetric}
                data={geoJson}
                style={style}
                onEachFeature={onEachFeature}
              />
              {selectedProvince && h3Hexagons.map(hex => {
                const baseColor = '#f27a1a';
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
                      click: (e) => {
                        e.originalEvent?.stopPropagation();
                        if (selectedHexagon && selectedHexagon.hexagonId === hex.h3Index) {
                          setSelectedHexagon(null);
                        } else {
                          setSelectedHexagon({
                            hexagonId: hex.h3Index,
                            pois: hex.pois
                          });
                          setSelectedHexSectorFilter('all');
                        }
                      }
                    }}
                  >
                    <Tooltip sticky>
                      <div className="p-1 font-sans text-xs text-slate-800">
                        <div className="font-bold border-b pb-0.5 mb-1 text-[11px]">H3 Hexagon Cell</div>
                        <div className="text-[10px]">Index: <span className="font-mono">{hex.h3Index}</span></div>
                        <div className="text-[10px]">Lokasi/POI Sektor: <strong className="text-orange-600">{hex.count}</strong></div>
                      </div>
                    </Tooltip>
                  </Polygon>
                );
              })}
              {selectedProvince && popupLatLng && (
                <Popup
                  position={popupLatLng}
                  onClose={() => {
                    setSelectedProvince(null)
                    setPopupLatLng(null)
                    setProvinceSectorFilter(null)
                    setSelectedPdbSectorFilter(null)
                  }}
                >
                  <div className="p-1 min-w-[240px] max-w-[320px] text-slate-800">
                    <div className="flex items-center gap-1.5 mb-1 border-b border-slate-100 pb-1">
                      <Building2 size={14} className="text-blue-600 animate-pulse" />
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">
                        {selectedProvince}
                      </h3>
                    </div>
                    
                    {/* PopUp Summary */}
                    {selectedProvStats && (
                      <div className="mb-2 bg-slate-50 p-1.5 rounded border border-slate-100 text-[10px] space-y-0.5 text-slate-600">
                        {selectedProvStats.pdrb && (
                          <div>📈 PDRB 2026: <strong className="text-slate-800">{formatMoney(selectedProvStats.pdrb)}</strong></div>
                        )}
                        {selectedProvStats.umr && (
                          <div>💰 UMR BKPM: <strong className="text-slate-800">{selectedProvStats.umr} ({selectedProvStats.umrYear})</strong></div>
                        )}
                        {mapMetric === 'perusahaan' ? (
                          <div>🏢 Perusahaan (Google Maps): <strong className="text-slate-800">{dedupedCompanyCount}</strong></div>
                        ) : (
                          <div>🏢 Emiten Terdaftar: <strong className="text-slate-800">{provinceCompanies.length} emiten</strong></div>
                        )}
                      </div>
                    )}

                    <p className="text-[9px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">
                      {mapMetric === 'perusahaan' ? 'PERUSAHAAN PER SEKTOR (TOP 5 PDRB):' : 'PILAH EMITEN DI SEKTOR PDB / PDRB:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-start max-h-[160px] overflow-y-auto pr-1">
                      {(mapMetric === 'perusahaan' ? companySectorBubbles : provinceSectorBubbles).map(({ sector, count }) => {
                        const active = mapMetric === 'perusahaan'
                          ? selectedCompanySector === sector
                          : provinceSectorFilter === sector
                        const style = getSectorColorStyle(sector)
                        return (
                          <button
                            key={sector}
                            type="button"
                            title={`${sector}: ${count}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (mapMetric === 'perusahaan') {
                                setShowAllCompanies(false)
                                setSelectedCompanySector(prev => (prev === sector ? null : sector))
                              } else {
                                setProvinceSectorFilter(prev => (prev === sector ? null : sector))
                              }
                            }}
                            className={`rounded-full font-semibold text-[9px] px-2.5 py-1 shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer border bg-transparent ${
                              active
                                ? 'ring-2 ring-offset-1 ring-slate-800 scale-105 font-bold'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                            style={style}
                          >
                            {sector} ({count})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </Popup>
              )}
            </MapContainer>
          </div>
          
          {/* Map Legend */}
          <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="text-slate-400 font-medium">Gradasi ({mapMetric === 'emiten' ? 'Volume Emiten' : 'Volume PDRB'}):</span>
            <span>Rendah</span>
            <div
              className="flex-1 min-w-[120px] h-2.5 rounded-full border border-slate-200/50 shadow-inner"
              style={{
                background: `linear-gradient(to right, ${CHOROPLETH_STOPS.map(s => {
                  const [r, g, b] = s.color
                  return `rgb(${r},${g},${b}) ${s.t * 100}%`
                }).join(', ')})`,
              }}
            />
            <span className="font-semibold text-slate-700">
              {mapMetric === 'emiten'
                ? `${legendSampleCount(maxCount, 0.35, 'emiten')} → ${legendSampleCount(maxCount, 0.7, 'emiten')} → ${maxCount} emiten`
                : `${formatMoney(legendSampleCount(maxPdrb, 0.35, 'pdrb'))} → ${formatMoney(legendSampleCount(maxPdrb, 0.7, 'pdrb'))} → ${formatMoney(maxPdrb)}`
              }
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-medium text-slate-600 truncate max-w-[200px]" title={activeSingleSector ? `Sektor: ${activeSingleSector}` : 'Sumber: PDRB 2026 Excel'}>
              {mapMetric === 'emiten' 
                ? `Laba ${mapData.latestYear}`
                : activeSingleSector 
                  ? `Sektor: ${activeSingleSector}` 
                  : 'Sumber: PDRB 2026 Excel'
              }
            </span>
          </div>
        </div>

        {/* Selected Hexagon Details Card */}
        {selectedProvince && selectedHexagon && (
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/20 p-4 rounded-xl border border-slate-200 text-xs space-y-3 shadow-sm animate-fade-in">
            <div className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Building2 size={13} className="text-blue-500 animate-pulse" />
                Daftar Lokasi di Cell H3
              </span>
              <button
                type="button"
                onClick={() => setSelectedHexagon(null)}
                className="text-[9.5px] text-slate-500 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 border-none rounded-md px-2 py-0.5 cursor-pointer transition-all animate-fade-in"
              >
                Tutup
              </button>
            </div>

            <div className="text-[10px] text-slate-550 flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Cell ID: <strong className="font-mono text-slate-700">{selectedHexagon.hexagonId.substring(0, 15)}</strong></span>
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">{filteredHexagonPois.length} Terfilter / {selectedHexagon.pois.length} Tempat</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Saring Sektor/Kategori:</span>
                <select
                  value={selectedHexSectorFilter}
                  onChange={(e) => setSelectedHexSectorFilter(e.target.value)}
                  className="text-[9.5px] bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="all">Semua Sektor & Kategori</option>
                  
                  {uniqueSectorsInHexagon.length > 0 && (
                    <optgroup label="Sektor PDB">
                      {uniqueSectorsInHexagon.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </optgroup>
                  )}

                  {uniqueCategoriesInHexagon.length > 0 && (
                    <optgroup label="Kategori Bisnis">
                      {uniqueCategoriesInHexagon.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredHexagonPois.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-slate-400 italic">
                  Tidak ada lokasi yang cocok dengan saringan filter ini.
                </div>
              ) : (
                filteredHexagonPois.map(poi => {
                  const hasRating = poi.rating && poi.rating !== 'NULL' && poi.rating !== '';
                  const hasAddress = poi.address && poi.address !== 'NULL' && poi.address !== '';
                  const hasBank = poi.merchantBank && poi.merchantBank !== 'NULL' && poi.merchantBank !== '';

                  return (
                    <div key={poi.id} className="bg-white p-2.5 rounded-lg border border-slate-150 text-[10px] shadow-sm hover:border-slate-350 transition-all space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-extrabold text-slate-800 leading-snug" title={poi.name}>{poi.name}</div>
                        {hasRating && (
                          <div className="shrink-0 flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-800 px-1 py-0.5 rounded text-[8.5px] font-bold">
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
                })
              )}
            </div>
          </div>
        )}

        {/* Perusahaan (Google Maps) company list for the selected sector */}
        {selectedProvince && mapMetric === 'perusahaan' && selectedCompanySector && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-3 shadow-sm">
            <div className="font-extrabold text-slate-800 text-[10.5px] uppercase tracking-wider border-b border-slate-100 pb-1.5 flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Building2 size={13} className="text-blue-500" />
                Perusahaan (Google Maps) — {selectedCompanySector}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCompanySector(null)}
                className="text-[9.5px] text-slate-500 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 border-none rounded-md px-2 py-0.5 cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <div className="text-[9px] text-slate-400">
              Menampilkan {companyListForSector.length} perusahaan paling menonjol (diurutkan berdasarkan jumlah ulasan). Data titik Google Maps, bukan entitas hukum.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
              {companyListForSector.map((c, i) => (
                <div key={`${c.name}-${i}`} className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 space-y-1">
                  <div className="font-extrabold text-slate-800 leading-snug" title={c.name}>{c.name}</div>
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{c.category}</span>
                    {c.ratingCount > 0 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⭐ {c.rating} ({c.ratingCount})</span>
                    )}
                    {c.locationCount > 1 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 border border-blue-100">{c.locationCount} lokasi</span>
                    )}
                  </div>
                  {c.gmapsUrl && c.gmapsUrl !== 'NULL' && (
                    <a href={c.gmapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-blue-600 hover:text-blue-800 hover:underline text-[9px] font-extrabold">Buka Google Maps ↗</a>
                  )}
                </div>
              ))}
            </div>
            {!showAllCompanies && companyListForSector.length >= 20 && (
              <button
                type="button"
                onClick={() => setShowAllCompanies(true)}
                className="w-full text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-md py-1.5 cursor-pointer"
              >
                Tampilkan semua perusahaan
              </button>
            )}
          </div>
        )}
      </div>

        {/* Sidebar Controls & Premium Metrics Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-violet-600" />
              <h3 className="font-semibold text-slate-800 text-sm">Filter Sektor PDB / PDRB (Peta)</h3>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSectors}
                  className="text-xs text-blue-600 hover:underline focus:outline-none cursor-pointer"
                >
                  Semua
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={selectNoneSectors}
                  className="text-xs text-slate-500 hover:underline focus:outline-none cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              {mapData.pdbSectors.map(sector => {
                const active = selectedSectors.includes(sector)
                const style = getSectorColorStyle(sector)
                return (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer bg-transparent ${
                      active
                        ? 'font-bold shadow-md scale-105'
                        : 'opacity-40 hover:opacity-80 saturate-[0.6] hover:saturate-100'
                    }`}
                    style={style}
                  >
                    {sector}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Premium Stats sidebar & list */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building2 size={16} className="text-blue-600 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-sm">
                {selectedProvince || 'Detail Wilayah Terpilih'}
              </h3>
            </div>

            {!selectedProvince ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2">
                <HelpCircle className="text-slate-350" size={36} />
                <p className="text-xs leading-normal">
                  Silakan klik wilayah di peta untuk melihat profil makroekonomi & emiten terkait 5 Sektor Unggulan.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Premium Macro-economic Stats Panel */}
                {selectedProvStats && (
                  <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-200/80 shadow-sm space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-1">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Indikator Ekonomi Makro</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">BPS & BKPM</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2.5 text-[10px]">
                      <div>
                        <span className="text-slate-400 block leading-tight">PDRB Total 2026:</span>
                        <span className="font-bold text-slate-800 block text-xs">
                          {selectedProvStats.pdrb ? formatMoney(selectedProvStats.pdrb) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block leading-tight">UMR Regional:</span>
                        <span className="font-bold text-slate-800 block text-xs">
                          {selectedProvStats.umr || '-'}
                          {selectedProvStats.umrYear && ` (${selectedProvStats.umrYear})`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block leading-tight">Kawasan Industri:</span>
                        <span className="font-bold text-slate-800 block text-xs">
                          {selectedProvStats.kawasanIndustri || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block leading-tight">Jumlah Penduduk:</span>
                        <span className="font-bold text-slate-800 block text-xs text-ellipsis overflow-hidden whitespace-nowrap">
                          {selectedProvStats.jumlahPenduduk || '-'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block leading-tight">Peluang Proyek Investasi BKPM:</span>
                        <span className="font-bold text-blue-600 block text-xs">
                          {selectedProvStats.peluang || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 5 PDRB Sectors visual list with progress bars */}
                {selectedProvStats && selectedProvStats.top5Sectors && selectedProvStats.top5Sectors.length > 0 && (
                  <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-200/80 shadow-sm space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-150 pb-1.5">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Top 5 Sektor PDRB 2026</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold border border-violet-100">BPS ADHK</span>
                    </div>
                    
                    <div className="space-y-2">
                      {selectedProvStats.top5Sectors.map((s, idx) => {
                        const isSelected = selectedPdbSectorFilter === s.sector
                        const percentage = (s.share * 100).toFixed(1)
                        
                        return (
                          <button
                            key={s.sector}
                            type="button"
                            onClick={() => {
                              setSelectedPdbSectorFilter(prev => prev === s.sector ? null : s.sector)
                            }}
                            className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer block ${
                              isSelected
                                ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-400 scale-[1.01]'
                                : 'bg-white border-slate-250 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between text-[10px] font-bold text-slate-800 leading-normal mb-1">
                              <span className="truncate pr-2 max-w-[170px]">
                                {idx + 1}. {s.sector}
                              </span>
                              <span className="text-blue-600 flex-shrink-0">
                                {formatMoney(s.value)} ({percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isSelected ? 'bg-blue-600' : 'bg-slate-400'
                                }`}
                                style={{ width: `${Math.min(100, s.share * 100)}%` }}
                              />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[8px] text-slate-400 leading-tight italic">
                      *Klik sektor di atas untuk menyaring daftar emiten terkait di bawah secara dinamis.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* H3 Hexagon Density Analysis Card */}
          {selectedProvince && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="font-bold text-slate-700 text-[10px] uppercase tracking-wider border-b border-slate-100 pb-1 flex justify-between items-center">
                <span>Sebaran Lokasi & POI</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded">H3 Resolusi 8</span>
              </div>

              {isLoadingPois ? (
                <div className="flex items-center justify-center py-4 text-slate-400 gap-1.5 text-xs">
                  <Activity className="animate-spin text-blue-500" size={14} />
                  <span>Memuat sebaran lokasi...</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-555">Total POI Sektor Aktif:</span>
                    <strong className="text-slate-800 text-xs font-bold">{pois.length} POI</strong>
                  </div>

                  {pois.length > 0 && categoryMapping && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 max-h-[110px] overflow-y-auto space-y-1">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Kategori Terbanyak:</div>
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
          )}


        </div>
      </div>

      {/* Row 2a: Full-Width Perusahaan (Google Maps) Table Card — perusahaan mode */}
      {selectedProvince && mapMetric === 'perusahaan' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                <Building2 size={16} className="text-blue-600" />
                Daftar Perusahaan (Google Maps) — {selectedProvince}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Bisnis paling menonjol dari Google Maps di Top 5 sektor unggulan daerah, diurutkan berdasarkan jumlah ulasan.
                {selectedCompanySector && (
                  <span className="ml-1 font-semibold text-blue-600">Sektor: {selectedCompanySector}</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Cari perusahaan (nama, kategori, sektor)..."
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="text-xs border border-slate-250 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {selectedCompanySector && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-blue-600 text-white font-semibold flex items-center gap-1 shadow-sm">
                  {selectedCompanySector}
                  <button
                    type="button"
                    onClick={() => setSelectedCompanySector(null)}
                    className="hover:text-slate-200 font-bold ml-1 text-xs cursor-pointer focus:outline-none"
                    title="Hapus filter sektor"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>

          {provinceCompanyList.length === 0 ? (
            <p className="text-xs text-slate-400 p-8 text-center italic">
              {isLoadingPois ? 'Memuat perusahaan dari Google Maps…' : 'Tidak ada perusahaan yang cocok.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto pr-1">
                {(showAllProvinceCompanies ? provinceCompanyList : provinceCompanyList.slice(0, 30)).map((c, i) => (
                  <div key={`${c.name}-${i}`} className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 space-y-1 text-[11px]">
                    <div className="font-extrabold text-slate-800 leading-snug" title={c.name}>{c.name}</div>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{c.category}</span>
                      {c.pdbSector && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100" title={c.pdbSector}>{c.pdbSector.length > 22 ? c.pdbSector.slice(0, 22) + '…' : c.pdbSector}</span>
                      )}
                      {c.ratingCount > 0 && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⭐ {c.rating} ({c.ratingCount})</span>
                      )}
                      {c.locationCount > 1 && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-blue-50 text-blue-700 border border-blue-100">{c.locationCount} lokasi</span>
                      )}
                    </div>
                    {c.gmapsUrl && c.gmapsUrl !== 'NULL' && (
                      <a href={c.gmapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-blue-600 hover:text-blue-800 hover:underline text-[9px] font-extrabold">Buka Google Maps ↗</a>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-2">
                <span>🟢 Menampilkan {showAllProvinceCompanies ? provinceCompanyList.length : Math.min(30, provinceCompanyList.length)} dari {provinceCompanyList.length} perusahaan (sampel)</span>
                {!showAllProvinceCompanies && provinceCompanyList.length > 30 && (
                  <button
                    type="button"
                    onClick={() => setShowAllProvinceCompanies(true)}
                    className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    Tampilkan semua ↓
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Row 2: Full-Width Premium Emiten Table Card — emiten/pdrb mode */}
      {selectedProvince && mapMetric !== 'perusahaan' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                Daftar Emiten Terkait Sektor Unggulan — {selectedProvince}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Menampilkan emiten publik dengan kontribusi makro ekonomi tertinggi di daerah ini.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Cari emiten (Ticker, Nama, Subindustri, Sektor)..."
                value={companySearch}
                onChange={e => setCompanySearch(e.target.value)}
                className="text-xs border border-slate-250 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {selectedPdbSectorFilter && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Sektor PDB:</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-blue-600 text-white font-semibold flex items-center gap-1 shadow-sm">
                    {selectedPdbSectorFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedPdbSectorFilter(null)}
                      className="hover:text-slate-200 font-bold ml-1 text-xs cursor-pointer focus:outline-none"
                      title="Hapus filter"
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[480px] border border-slate-200 rounded-lg shadow-sm">
            {filteredCompanies.length === 0 ? (
              <p className="text-xs text-slate-400 p-8 text-center italic">Tidak ada perusahaan yang cocok.</p>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider select-none border-b border-slate-200/80 z-10">
                  <tr>
                    <th
                      onClick={() => handleSort('ticker')}
                      className="py-2.5 px-4 font-semibold cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      Ticker {sortBy === 'ticker' && (sortOrder === 'asc' ? ' ▴' : ' ▾')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">Nama Perusahaan</th>
                    <th className="py-2.5 px-4 font-semibold">Subindustri / Sektor IDX</th>
                    <th
                      onClick={() => handleSort('sektor')}
                      className="py-2.5 px-4 font-semibold cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      Sektor PDB / PDRB {sortBy === 'sektor' && (sortOrder === 'asc' ? ' ▴' : ' ▾')}
                    </th>
                    <th
                      onClick={() => handleSort('laba')}
                      className="text-right py-2.5 px-4 font-semibold cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      Laba Bersih Terbaru {sortBy === 'laba' && (sortOrder === 'asc' ? ' ▴' : ' ▾')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCompanies.map(c => (
                    <tr
                      key={c.Ticker}
                      className="hover:bg-slate-50/50 transition-colors align-top"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">{c.Ticker}</td>
                      <td className="py-3 px-4 space-y-1">
                        <div className="font-semibold text-slate-700 text-xs">{c.NamaPerusahaan || '-'}</div>
                        {c.provinsi_kantor && (
                          <div className="text-[10px] text-slate-400 font-medium">Kantor: {c.provinsi_kantor}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <div className="font-semibold text-slate-700 text-xs">{c.Subindustri || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Sektor: {c.Sektor || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {c.sektor_pdb ? (
                          <span
                            className="text-[9px] px-2.5 py-1 rounded-full font-bold shadow-sm inline-block tracking-wide uppercase bg-transparent border"
                            style={getSectorColorStyle(c.sektor_pdb)}
                          >
                            {c.sektor_pdb}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800 text-xs">
                        {formatMoney(c.NetIncome)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold px-2">
            <span>🟢 Menampilkan {filteredCompanies.length} emiten terkait Top 5 Sektor daerah</span>
            {mapData.meta?.unlocatedCount > 0 && (
              <span>⚠️ {mapData.meta.unlocatedCount} emiten berlokasi diluar koordinat peta</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
