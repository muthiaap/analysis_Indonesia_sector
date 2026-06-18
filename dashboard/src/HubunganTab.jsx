import { useEffect, useState, useMemo, useRef } from 'react'
import { Search, Info, Settings, ZoomIn, ZoomOut, RotateCcw, HelpCircle, Building2, MapPin, Briefcase, Calendar, ShieldCheck, DollarSign, Share2, ToggleLeft, ToggleRight, Pin, PinOff, Database } from 'lucide-react'
import neo4j from 'neo4j-driver'

// Curated HSL sector colors for subsidiaries
const SECTOR_COLORS = {
  'Pertanian & Perkebunan': '#10b981', // Emerald green
  'Pertambangan & Energi': '#f59e0b',  // Amber yellow
  'Holding & Investasi': '#3b82f6',    // Blue
  'Perdagangan & Retail': '#ec4899',   // Pink
  'Jasa & Konsultansi': '#8b5cf6',     // Purple
  'Logistik & Transportasi': '#06b6d4', // Cyan
  'Pariwisata & Perjalanan': '#f97316', // Orange
  'Pembangkit Listrik': '#14b8a6',     // Teal
  'Manufaktur & Konstruksi': '#ef4444', // Red
  'Lainnya': '#64748b'                 // Slate gray
}

// Map diverse text descriptors to major categories
const getActivityCategory = (activity) => {
  if (!activity) return 'Lainnya'
  const act = activity.toLowerCase()
  if (act.includes('sawit') || act.includes('perkebunan') || act.includes('plantation') || act.includes('tani') || act.includes('palm') || act.includes('cocoa') || act.includes('karet')) {
    return 'Pertanian & Perkebunan'
  }
  if (act.includes('tambang') || act.includes('batubara') || act.includes('coal') || act.includes('mining') || act.includes('mineral') || act.includes('nikel') || act.includes('oil') || act.includes('gas') || act.includes('baux')) {
    return 'Pertambangan & Energi'
  }
  if (act.includes('holding') || act.includes('investasi') || act.includes('investment') || act.includes('saham') || act.includes('keuangan') || act.includes('bank') || act.includes('modal')) {
    return 'Holding & Investasi'
  }
  if (act.includes('dagang') || act.includes('trading') || act.includes('ekspor') || act.includes('impor') || act.includes('jual') || act.includes('retail') || act.includes('eceran')) {
    return 'Perdagangan & Retail'
  }
  if (act.includes('jasa') || act.includes('layanan') || act.includes('service') || act.includes('konsultasi') || act.includes('manajemen') || act.includes('penasihat')) {
    return 'Jasa & Konsultansi'
  }
  if (act.includes('logistik') || act.includes('transport') || act.includes('laut') || act.includes('kapalan') || act.includes('shipping') || act.includes('pelayaran') || act.includes('darat') || act.includes('angkut') || act.includes('udara')) {
    return 'Logistik & Transportasi'
  }
  if (act.includes('wisata') || act.includes('travel') || act.includes('biro') || act.includes('hotel') || act.includes('rekreasi') || act.includes('pariwisata') || act.includes('penginapan')) {
    return 'Pariwisata & Perjalanan'
  }
  if (act.includes('listrik') || act.includes('energi terbarukan') || act.includes('renewable') || act.includes('power') || act.includes('pembangkit') || act.includes('turbin')) {
    return 'Pembangkit Listrik'
  }
  if (act.includes('manufaktur') || act.includes('industri') || act.includes('pabrik') || act.includes('kaca') || act.includes('semen') || act.includes('beton') || act.includes('kontraktor') || act.includes('konstruksi') || act.includes('bangun')) {
    return 'Manufaktur & Konstruksi'
  }
  return 'Lainnya'
}

// Convert all currencies to base IDR using official reporting values for sizing
const getLoanValueInIDR = (amount, currency) => {
  if (!amount) return 0
  const curr = (currency || 'IDR').toUpperCase()
  if (curr === 'USD') return amount * 16993 // reporting exchange rate
  if (curr === 'SGD') return amount * 12505
  if (curr === 'EUR') return amount * 18000
  return amount
}

// Convert Neo4j integers / objects / standard numbers safely
const getNeo4jNumber = (val) => {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  if (typeof val.toNumber === 'function') return val.toNumber()
  if (typeof val.low === 'number') return val.low
  return parseFloat(val)
}

// Filter bank summary rows
const isSummaryRow = (bankName) => {
  if (!bankName) return true
  const name = bankName.toLowerCase()
  const excludeKeywords = ['jumlah', 'biaya penerbitan', 'liabilitas jangka', 'total', 'maturity', 'amortisasi']
  return excludeKeywords.some(kw => name.includes(kw))
}

// Formatting large money amounts cleanly
const formatMoneyShort = (val, currency) => {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const absVal = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  const curr = currency || 'IDR'
  
  if (absVal >= 1e12) return sign + curr + ' ' + (absVal / 1e12).toFixed(2) + ' T'
  if (absVal >= 1e9) return sign + curr + ' ' + (absVal / 1e9).toFixed(2) + ' Miliar'
  if (absVal >= 1e6) return sign + curr + ' ' + (absVal / 1e6).toFixed(2) + ' Juta'
  return sign + curr + ' ' + absVal.toLocaleString()
}

export default function HubunganTab() {
  const [activeMode, setActiveMode] = useState('loans') // 'subsidiaries' or 'loans'
  
  // Data States
  const [subsData, setSubsData] = useState(null)
  const [debtsData, setDebtsData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Neo4j Database States (Persisted in localStorage for premium experience)
  const [useNeo4j, setUseNeo4j] = useState(() => {
    return localStorage.getItem('neo4j_use') === 'true'
  })
  const [neo4jUri, setNeo4jUri] = useState(() => {
    return localStorage.getItem('neo4j_uri') || 'bolt://localhost:7687'
  })
  const [neo4jUser, setNeo4jUser] = useState(() => {
    return localStorage.getItem('neo4j_user') || 'neo4j'
  })
  const [neo4jPassword, setNeo4jPassword] = useState(() => {
    return localStorage.getItem('neo4j_password') || ''
  })
  const [dbStatus, setDbStatus] = useState('disconnected') // 'disconnected', 'connecting', 'connected', 'error'
  const [dbErrorMsg, setDbErrorMsg] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [rawNeo4jGraph, setRawNeo4jGraph] = useState({ nodes: [], links: [] })

  // Sync state changes back to localStorage
  useEffect(() => {
    localStorage.setItem('neo4j_use', useNeo4j)
  }, [useNeo4j])
  useEffect(() => {
    localStorage.setItem('neo4j_uri', neo4jUri)
  }, [neo4jUri])
  useEffect(() => {
    localStorage.setItem('neo4j_user', neo4jUser)
  }, [neo4jUser])
  useEffect(() => {
    localStorage.setItem('neo4j_password', neo4jPassword)
  }, [neo4jPassword])
  
  // Selection Panel States
  const [selectedParents, setSelectedParents] = useState(['ABMM']) // Mode 1
  const [selectedBanks, setSelectedBanks] = useState([]) // Mode 2
  
  const [parentSearch, setParentSearch] = useState('')
  const [bankSearch, setBankSearch] = useState('')
  const [subSearch, setSubSearch] = useState('')
  
  // Controls
  const [minPercentage, setMinPercentage] = useState(0)
  const [sizeByPercent, setSizeByPercent] = useState(true)
  const sizeByPercentRef = useRef(sizeByPercent)
  useEffect(() => {
    sizeByPercentRef.current = sizeByPercent
    alphaRef.current = 0.5
  }, [sizeByPercent])
  const [colorMode, setColorMode] = useState('sector') // 'sector' or 'uniform'
  const [springLength, setSpringLength] = useState(100)
  const [repulsionStrength, setRepulsionStrength] = useState(500)
  
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  // Selected Node Details for Right Sidebar
  const [selectedNode, setSelectedNode] = useState(null)
  
  // Simulation nodes and links stored in ref for high-frequency physics
  const simNodesRef = useRef([])
  const simLinksRef = useRef([])
  const [tick, setTick] = useState(0) // Trigger redraws
  
  const svgRef = useRef(null)
  const animFrameRef = useRef(null)
  const draggingNodeRef = useRef(null)
  const hasMovedRef = useRef(false)
  const alphaRef = useRef(1.0)
  
  const width = 800
  const height = 550

  // 1. Fetch datasets
  useEffect(() => {
    Promise.all([
      fetch('./anak_perusahaan.json').then(r => r.json()),
      fetch('./utang_bank.json').then(r => r.json())
    ]).then(([subs, debts]) => {
      setSubsData(subs)
      setDebtsData(debts)
      
      // Auto-select top banks default
      const tempBanksSet = new Set()
      Object.values(debts).forEach(comp => {
        if (!comp.Loans) return
        comp.Loans.forEach(l => {
          if (!isSummaryRow(l.Bank)) {
            tempBanksSet.add(l.Bank)
          }
        })
      })
      const sortedBanksList = Array.from(tempBanksSet).sort()
      // Select BCA and Mandiri as default
      const defaultBanks = sortedBanksList.filter(b => b.includes('Mandiri') || b.includes('Central Asia'))
      setSelectedBanks(defaultBanks.length > 0 ? defaultBanks : sortedBanksList.slice(0, 2))
      
      setLoading(false)
    }).catch(err => {
      console.error('Error loading graph datasets:', err)
      setLoading(false)
    })
  }, [])

  // 2. Extract lists of parent companies & unique banks
  const parentCompanies = useMemo(() => {
    if (!subsData) return []
    return Object.values(subsData).map(p => ({
      code: p['Company Code'],
      name: p['Company Name'],
      count: p['Subsidiaries Count']
    })).sort((a, b) => b.count - a.count)
  }, [subsData])

  const bankCompanies = useMemo(() => {
    if (!debtsData) return []
    const bankCountMap = {}
    
    Object.values(debtsData).forEach(comp => {
      if (!comp.Loans) return
      comp.Loans.forEach(l => {
        const bankName = l.Bank
        if (isSummaryRow(bankName)) return
        bankCountMap[bankName] = (bankCountMap[bankName] || 0) + 1
      })
    })

    return Object.entries(bankCountMap).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count)
  }, [debtsData])

  // Filter lists for selection sidebar
  const filteredParentsList = useMemo(() => {
    return parentCompanies.filter(p => 
      p.code.toLowerCase().includes(parentSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(parentSearch.toLowerCase())
    )
  }, [parentCompanies, parentSearch])

  const filteredBanksList = useMemo(() => {
    return bankCompanies.filter(b => 
      b.name.toLowerCase().includes(bankSearch.toLowerCase())
    )
  }, [bankCompanies, bankSearch])

  // 3. Build Graph Model: Nodes and Links
  const sourceGraph = useMemo(() => {
    // LIVE MODE: Parsed from Neo4j active queries
    if (useNeo4j && dbStatus === 'connected') {
      const nodesMap = {}
      const links = []
      
      const rawNodes = rawNeo4jGraph.nodes || []
      const rawLinks = rawNeo4jGraph.links || []
      
      if (activeMode === 'subsidiaries') {
        rawNodes.forEach(node => {
          if (node.isParent) {
            nodesMap[node.id] = { ...node, subsidiariesCount: 0 }
          } else {
            const matchesSearch = !subSearch || node.fullName.toLowerCase().includes(subSearch.toLowerCase())
            const matchesPercent = node.percentage >= minPercentage
            if (matchesSearch && matchesPercent) {
              nodesMap[node.id] = { ...node }
            }
          }
        })
        
        rawLinks.forEach(link => {
          const u = nodesMap[link.source]
          const v = nodesMap[link.target]
          if (u && v) {
            links.push({ ...link })
          }
        })
        
        Object.values(nodesMap).forEach(node => {
          if (!node.isParent) {
            const parentNode = nodesMap[node.parentCode]
            if (parentNode) {
              parentNode.subsidiariesCount++
            }
          }
        })
      } else {
        // activeMode === 'loans'
        rawNodes.forEach(node => {
          if (node.isParent) {
            nodesMap[node.id] = { ...node, companiesCount: 0 }
          } else {
            const matchesSearch = !subSearch || 
              node.fullName.toLowerCase().includes(subSearch.toLowerCase()) || 
              node.id.toLowerCase().includes(subSearch.toLowerCase())
            if (matchesSearch) {
              nodesMap[node.id] = { ...node }
            }
          }
        })
        
        rawLinks.forEach(link => {
          const u = nodesMap[link.source]
          const v = nodesMap[link.target]
          if (u && v) {
            links.push({ ...link })
          }
        })
        
        Object.values(nodesMap).forEach(node => {
          if (node.isBank) {
            node.companiesCount = links.filter(l => l.source === node.id).length
          }
        })
      }
      
      const nodes = Object.values(nodesMap)
      return { nodes, links }
    }

    // OFFLINE FALLBACK MODE (Calculated from local static JSON):
    if (activeMode === 'subsidiaries') {
      // MODE 1: Subsidiaries Structure
      if (!subsData || selectedParents.length === 0) return { nodes: [], links: [] }

      const nodesMap = {}
      const links = []

      // Add parent nodes
      selectedParents.forEach(code => {
        const company = subsData[code.toUpperCase()]
        nodesMap[code] = {
          id: code,
          label: code,
          fullName: company ? company['Company Name'] : `${code} Group`,
          isParent: true,
          subsidiariesCount: company ? company['Subsidiaries Count'] : 0,
          radius: 24,
          radiusFixed: 24
        }
      })

      // Add direct subsidiaries
      selectedParents.forEach(parentCode => {
        const company = subsData[parentCode.toUpperCase()]
        if (!company || !company.Subsidiaries) return

        company.Subsidiaries.forEach(sub => {
          const pctStr = sub['Ownership Percentage'] || '0'
          const pctVal = parseFloat(pctStr.replace(/[^\d.]/g, '')) || 0
          
          if (pctVal < minPercentage) return
          
          const subName = sub['Subsidiary Name']
          if (subSearch && !subName.toLowerCase().includes(subSearch.toLowerCase())) return

          const category = getActivityCategory(sub['Business Activity'])
          const subId = `${parentCode}_${subName}`
          const varRadius = 7 + (pctVal / 100) * 11

          nodesMap[subId] = {
            id: subId,
            label: subName,
            fullName: subName,
            isParent: false,
            percentage: pctVal,
            percentageStr: pctStr,
            activity: sub['Business Activity'],
            category: category,
            location: sub['Location'],
            year: sub['Commercial Year'],
            status: sub['Operating Status'],
            assets: sub['Total Assets'],
            unit: sub['Unit'],
            currency: sub['Currency'],
            parentCode: parentCode,
            radius: varRadius,
            radiusFixed: 12
          }

          links.push({
            source: parentCode,
            target: subId,
            percentage: pctVal
          })
        })
      })

      const nodes = Object.values(nodesMap)
      const parentsCount = selectedParents.length
      
      nodes.forEach(node => {
        if (node.isParent) {
          const parentIdx = selectedParents.indexOf(node.id)
          const angle = (parentIdx / Math.max(1, parentsCount)) * Math.PI * 2
          const radius = parentsCount > 1 ? 150 : 0
          node.x = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 10
          node.y = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 10
        } else {
          const parentNode = nodesMap[node.parentCode]
          const px = parentNode ? parentNode.x : width / 2
          const py = parentNode ? parentNode.y : height / 2
          const angle = Math.random() * Math.PI * 2
          const radius = 65 + Math.random() * 75
          node.x = px + Math.cos(angle) * radius
          node.y = py + Math.sin(angle) * radius
        }
        node.vx = 0
        node.vy = 0
      })

      return { nodes, links }
    } else {
      // MODE 2: Corporate Bank Loans Structure
      if (!debtsData || selectedBanks.length === 0) return { nodes: [], links: [] }

      const nodesMap = {}
      const links = []

      // 1. Add Bank nodes
      selectedBanks.forEach(bankName => {
        // Create shortened clean label for visualization circles
        const cleanLabel = bankName
          .replace('PT ', '')
          .replace(' (Persero) Tbk', '')
          .replace(' Tbk', '')
          .replace('Bank ', '')
        
        nodesMap[bankName] = {
          id: bankName,
          label: cleanLabel,
          fullName: bankName,
          isParent: true,
          isBank: true,
          companiesCount: bankCompanies.find(b => b.name === bankName)?.count || 0,
          radius: 24,
          radiusFixed: 24
        }
      })

      // 2. Add Company nodes connected to selected banks
      Object.values(debtsData).forEach(comp => {
        const code = comp["Company Code"]
        const name = comp["Company Name"]
        if (!comp.Loans) return

        comp.Loans.forEach(loan => {
          if (isSummaryRow(loan.Bank)) return

          if (selectedBanks.includes(loan.Bank)) {
            const loanVal = getLoanValueInIDR(loan["Current Amount"], loan.Currency)
            
            // Search text filter
            if (subSearch && !name.toLowerCase().includes(subSearch.toLowerCase()) && !code.toLowerCase().includes(subSearch.toLowerCase())) {
              return
            }

            // Create Company Node if not already existing
            if (!nodesMap[code]) {
              nodesMap[code] = {
                id: code,
                label: code,
                fullName: name,
                isParent: false,
                isBank: false,
                totalLoanVal: 0,
                loansList: [],
                radius: 12,
                radiusFixed: 12
              }
            }

            nodesMap[code].totalLoanVal += loanVal
            nodesMap[code].loansList.push({
              bank: loan.Bank,
              amount: loan["Current Amount"],
              currency: loan.Currency,
              priorAmount: loan["Prior Amount"]
            })

            links.push({
              source: loan.Bank,
              target: code,
              value: loanVal
            })
          }
        })
      })

      const nodes = Object.values(nodesMap)
      const banksCount = selectedBanks.length

      nodes.forEach(node => {
        if (node.isBank) {
          const bankIdx = selectedBanks.indexOf(node.id)
          const angle = (bankIdx / Math.max(1, banksCount)) * Math.PI * 2
          const orbitRadius = banksCount > 1 ? 200 : 0 // Spaced out wider for larger viewport
          node.x = width / 2 + Math.cos(angle) * orbitRadius + (Math.random() - 0.5) * 10
          node.y = height / 2 + Math.sin(angle) * orbitRadius + (Math.random() - 0.5) * 10
        } else {
          // Calculate dynamic sizing radius based on accumulated loan value
          const val = node.totalLoanVal || 1
          const logVal = Math.log10(val)
          const varRadius = Math.max(8, Math.min(22, (logVal - 5) * 2.2))
          node.radius = varRadius
          node.radiusFixed = 12

          // Position company nodes in orbit of their first mapped bank
          const connectedLink = links.find(l => l.target === node.id)
          const parentNode = connectedLink ? nodesMap[connectedLink.source] : null
          const px = parentNode ? parentNode.x : width / 2
          const py = parentNode ? parentNode.y : height / 2
          const angle = Math.random() * Math.PI * 2
          const offsetRadius = 60 + Math.random() * 60
          node.x = px + Math.cos(angle) * offsetRadius
          node.y = py + Math.sin(angle) * offsetRadius
        }
        node.vx = 0
        node.vy = 0
      })

      return { nodes, links }
    }
  }, [activeMode, subsData, debtsData, selectedParents, selectedBanks, minPercentage, subSearch, useNeo4j, dbStatus, rawNeo4jGraph])

  // Sync simulation refs with memoized source Graph nodes/links
  useEffect(() => {
    simNodesRef.current = sourceGraph.nodes.map(n => ({ ...n }))
    simLinksRef.current = sourceGraph.links.map(l => ({ ...l }))
    setSelectedNode(null)
    alphaRef.current = 1.0
    setTick(t => t + 1) // Trigger initial redraw
  }, [sourceGraph])

  // Neo4j dynamic live database query and graph mapping
  const fetchNeo4jData = async () => {
    if (!useNeo4j) return
    
    setDbStatus('connecting')
    setDbErrorMsg('')
    
    let driver
    try {
      driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword))
      await driver.verifyConnectivity()
      
      const session = driver.session()
      try {
        if (activeMode === 'subsidiaries') {
          if (selectedParents.length === 0) {
            setRawNeo4jGraph({ nodes: [], links: [] })
            setDbStatus('connected')
            return
          }
          
          const result = await session.run(
            `MATCH (p:Company)-[r:HAS_SUBSIDIARY]->(s:Subsidiary)
             WHERE p.code IN $parents
             RETURN p, r, s`,
            { parents: selectedParents }
          )
          
          const nodesMap = {}
          const links = []
          
          result.records.forEach(record => {
            const pNode = record.get('p')
            const sNode = record.get('s')
            const rel = record.get('r')
            
            const parentCode = pNode.properties.code
            const parentName = pNode.properties.name || `${parentCode} Group`
            const subName = sNode.properties.name
            
            const pctVal = getNeo4jNumber(rel.properties.percentage)
            
            if (!nodesMap[parentCode]) {
              nodesMap[parentCode] = {
                id: parentCode,
                label: parentCode,
                fullName: parentName,
                isParent: true,
                subsidiariesCount: 0,
                radius: 24,
                radiusFixed: 24
              }
            }
            
            const subId = `${parentCode}_${subName}`
            const subActivity = sNode.properties.activity || ''
            const category = getActivityCategory(subActivity)
            const varRadius = 7 + (pctVal / 100) * 11
            
            nodesMap[subId] = {
              id: subId,
              label: subName,
              fullName: subName,
              isParent: false,
              percentage: pctVal,
              percentageStr: pctVal.toString(),
              activity: subActivity,
              category: category,
              location: sNode.properties.location || '-',
              parentCode: parentCode,
              radius: varRadius,
              radiusFixed: 12
            }
            
            links.push({
              source: parentCode,
              target: subId,
              percentage: pctVal
            })
          })
          
          const nodes = Object.values(nodesMap)
          const parentsCount = selectedParents.length
          
          nodes.forEach(node => {
            if (node.isParent) {
              const parentIdx = selectedParents.indexOf(node.id)
              const angle = (parentIdx / Math.max(1, parentsCount)) * Math.PI * 2
              const orbitRadius = parentsCount > 1 ? 150 : 0
              node.x = width / 2 + Math.cos(angle) * orbitRadius + (Math.random() - 0.5) * 10
              node.y = height / 2 + Math.sin(angle) * orbitRadius + (Math.random() - 0.5) * 10
            } else {
              const parentNode = nodesMap[node.parentCode]
              const px = parentNode ? parentNode.x : width / 2
              const py = parentNode ? parentNode.y : height / 2
              const angle = Math.random() * Math.PI * 2
              const orbitRadius = 65 + Math.random() * 75
              node.x = px + Math.cos(angle) * orbitRadius
              node.y = py + Math.sin(angle) * orbitRadius
            }
            node.vx = 0
            node.vy = 0
          })
          
          setRawNeo4jGraph({ nodes, links })
          setDbStatus('connected')
        } else {
          // loans mode
          if (selectedBanks.length === 0) {
            setRawNeo4jGraph({ nodes: [], links: [] })
            setDbStatus('connected')
            return
          }
          
          const result = await session.run(
            `MATCH (b:Bank)-[r:LOANED_TO]->(c:Company)
             WHERE b.name IN $banks
             RETURN b, r, c`,
            { banks: selectedBanks }
          )
          
          const nodesMap = {}
          const links = []
          
          result.records.forEach(record => {
            const bNode = record.get('b')
            const cNode = record.get('c')
            const rel = record.get('r')
            
            const bankName = bNode.properties.name
            const companyCode = cNode.properties.code
            const companyName = cNode.properties.name || `Perusahaan ${companyCode}`
            
            if (!nodesMap[bankName]) {
              const cleanLabel = bankName
                .replace('PT ', '')
                .replace(' (Persero) Tbk', '')
                .replace(' Tbk', '')
                .replace('Bank ', '')
              
              nodesMap[bankName] = {
                id: bankName,
                label: cleanLabel,
                fullName: bankName,
                isParent: true,
                isBank: true,
                companiesCount: 0,
                radius: 24,
                radiusFixed: 24
              }
            }
            
            const amount = getNeo4jNumber(rel.properties.amount)
            const currency = rel.properties.currency || 'IDR'
            const prior = getNeo4jNumber(rel.properties.prior)
            const loanVal = getLoanValueInIDR(amount, currency)
            
            if (!nodesMap[companyCode]) {
              nodesMap[companyCode] = {
                id: companyCode,
                label: companyCode,
                fullName: companyName,
                isParent: false,
                isBank: false,
                totalLoanVal: 0,
                loansList: [],
                radius: 12,
                radiusFixed: 12
              }
            }
            
            nodesMap[companyCode].totalLoanVal += loanVal
            nodesMap[companyCode].loansList.push({
              bank: bankName,
              amount: amount,
              currency: currency,
              priorAmount: prior
            })
            
            links.push({
              source: bankName,
              target: companyCode,
              value: loanVal
            })
          })
          
          const nodes = Object.values(nodesMap)
          const banksCount = selectedBanks.length
          
          nodes.forEach(node => {
            if (node.isBank) {
              const bankIdx = selectedBanks.indexOf(node.id)
              const angle = (bankIdx / Math.max(1, banksCount)) * Math.PI * 2
              const orbitRadius = banksCount > 1 ? 200 : 0
              node.x = width / 2 + Math.cos(angle) * orbitRadius + (Math.random() - 0.5) * 10
              node.y = height / 2 + Math.sin(angle) * orbitRadius + (Math.random() - 0.5) * 10
            } else {
              const val = node.totalLoanVal || 1
              const logVal = Math.log10(val)
              const varRadius = Math.max(8, Math.min(22, (logVal - 5) * 2.2))
              node.radius = varRadius
              node.radiusFixed = 12
              
              const connectedLink = links.find(l => l.target === node.id)
              const parentNode = connectedLink ? nodesMap[connectedLink.source] : null
              const px = parentNode ? parentNode.x : width / 2
              const py = parentNode ? parentNode.y : height / 2
              const angle = Math.random() * Math.PI * 2
              const offsetRadius = 60 + Math.random() * 60
              node.x = px + Math.cos(angle) * offsetRadius
              node.y = py + Math.sin(angle) * offsetRadius
            }
            node.vx = 0
            node.vy = 0
          })
          
          setRawNeo4jGraph({ nodes, links })
          setDbStatus('connected')
        }
      } finally {
        session.close()
      }
    } catch (err) {
      console.error('Neo4j dynamic connection failed:', err)
      setDbStatus('error')
      setDbErrorMsg(err.message || 'Gagal tersambung ke Neo4j. Silakan periksa kembali konfigurasi Anda.')
      setUseNeo4j(false)
    } finally {
      if (driver) {
        await driver.close()
      }
    }
  }

  // Trigger live updates on selection or configuration changes
  useEffect(() => {
    if (useNeo4j) {
      fetchNeo4jData()
    } else {
      setDbStatus('disconnected')
    }
  }, [useNeo4j, activeMode, selectedParents, selectedBanks, neo4jUri, neo4jUser, neo4jPassword])

  // 4. Force-directed Simulation physics loop (separate from state!)
  useEffect(() => {
    let active = true
    alphaRef.current = 0.8 // Warm up when parameters change

    const runPhysicsTick = () => {
      if (!active) return

      const nodes = simNodesRef.current
      const links = simLinksRef.current

      if (nodes.length === 0) {
        animFrameRef.current = requestAnimationFrame(runPhysicsTick)
        return
      }

      // If alpha is extremely small, skip calculations to freeze simulation
      if (alphaRef.current <= 0.005) {
        alphaRef.current = 0
        animFrameRef.current = requestAnimationFrame(runPhysicsTick)
        return
      }

      const nodesMap = {}
      nodes.forEach(n => {
        nodesMap[n.id] = n
      })

      // Repulsion (Coulomb repulsion force) - scaled by alphaRef.current
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const u = nodes[i]
          const v = nodes[j]
          let dx = v.x - u.x
          let dy = v.y - u.y
          if (dx === 0) dx = 0.1
          const distSq = dx * dx + dy * dy
          const dist = Math.sqrt(distSq)
          // Heavily repel parent nodes from each other to space out separate islands
          let strength = repulsionStrength
          if (u.isParent && v.isParent) {
            strength = repulsionStrength * 4.5
          }
          const force = (strength / Math.max(20, distSq)) * alphaRef.current
          
          const fx = (dx / (dist || 1)) * force
          const fy = (dy / (dist || 1)) * force

          if (!u.isDragging && !u.isPinned) {
            u.vx -= fx
            u.vy -= fy
          }
          if (!v.isDragging && !v.isPinned) {
            v.vx += fx
            v.vy += fy
          }
        }
      }

      // Spring attraction force along connections - scaled by alphaRef.current
      links.forEach(link => {
        const u = nodesMap[link.source]
        const v = nodesMap[link.target]
        if (!u || !v) return

        let dx = v.x - u.x
        let dy = v.y - u.y
        if (dx === 0) dx = 0.1
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        const desiredLength = springLength
        const k = 0.04 * alphaRef.current
        const force = k * (dist - desiredLength)

        const fx = (dx / (dist || 1)) * force
        const fy = (dy / (dist || 1)) * force

        if (!u.isDragging && !u.isPinned) {
          // Scale down drag on parents to make them heavy anchors
          const factor = u.isParent ? 0.20 : 1.0
          u.vx += fx * factor
          u.vy += fy * factor
        }
        if (!v.isDragging && !v.isPinned) {
          const factor = v.isParent ? 0.20 : 1.0
          v.vx -= fx * factor
          v.vy -= fy * factor
        }
      })

      // Gravitational center force & Friction update - scaled by alphaRef.current
      const centerX = width / 2
      const centerY = height / 2
      const gravity = 0.008

      nodes.forEach(node => {
        if (node.isDragging) return

        if (node.isPinned) {
          node.vx = 0
          node.vy = 0
          return
        }

        const isParentNode = node.isParent

        if (isParentNode) {
          // Parent node: NO global center gravity pull (allows complete separation!).
          // Instead, we just apply a soft boundary force at the edges to prevent drifting completely off-screen.
          const margin = 80
          const boundForce = 0.12 * alphaRef.current
          if (node.x < margin) node.vx += boundForce
          if (node.x > width - margin) node.vx -= boundForce
          if (node.y < margin) node.vy += boundForce
          if (node.y > height - margin) node.vy -= boundForce
        } else {
          // Child node: pull towards local cluster center
          let targetX = centerX
          let targetY = centerY
          let parentCount = 0
          let sumX = 0
          let sumY = 0
          
          if (node.parentCode) {
            const pNode = nodesMap[node.parentCode]
            if (pNode) {
              sumX = pNode.x
              sumY = pNode.y
              parentCount = 1
            }
          } else if (node.loansList) {
            node.loansList.forEach(l => {
              const bNode = nodesMap[l.bank]
              if (bNode) {
                sumX += bNode.x
                sumY += bNode.y
                parentCount++
              }
            })
          }
          
          if (parentCount > 0) {
            targetX = sumX / parentCount
            targetY = sumY / parentCount
          }

          // Strong local grouping pull to its bank/emiten constellation center
          const localGravity = 0.024 * alphaRef.current
          node.vx += (targetX - node.x) * localGravity
          node.vy += (targetY - node.y) * localGravity
        }

        // Apply velocities and damping
        node.x += node.vx
        node.y += node.vy
        
        // Damping/friction factor
        node.vx *= 0.75
        node.vy *= 0.75

        // Static friction threshold (freeze extremely slow movements to prevent perpetual orbital rotation)
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy)
        if (speed < 0.10) {
          node.vx = 0
          node.vy = 0
        }
      })

      // Geometric Collision Resolution (Avoid overlap)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const u = nodes[i]
          const v = nodes[j]
          
          const ru = sizeByPercentRef.current ? (u.radius || 12) : (u.radiusFixed || 12)
          const rv = sizeByPercentRef.current ? (v.radius || 12) : (v.radiusFixed || 12)
          const padding = 7 // elegant gap padding to avoid collision
          const minDist = ru + rv + padding
          
          let dx = v.x - u.x
          let dy = v.y - u.y
          if (dx === 0) dx = 0.1
          const distSq = dx * dx + dy * dy
          
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.1
            const overlap = minDist - dist
            const nx = dx / dist
            const ny = dy / dist
            
            // Push apart (scale collision push by alpha to make it smooth as it cools down)
            const pushFactor = Math.min(1.0, alphaRef.current * 2.0)
            const pushX = nx * overlap * 0.5 * pushFactor
            const pushY = ny * overlap * 0.5 * pushFactor
            
            if (!u.isDragging && !u.isPinned) {
              u.x -= pushX
              u.y -= pushY
            }
            if (!v.isDragging && !v.isPinned) {
              v.x += pushX
              v.y += pushY
            }
          }
        }
      }

      // Cooling alpha decay
      alphaRef.current *= 0.985

      // Redraw SVG elements
      setTick(t => t + 1)

      animFrameRef.current = requestAnimationFrame(runPhysicsTick)
    }

    animFrameRef.current = requestAnimationFrame(runPhysicsTick)

    return () => {
      active = false
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [springLength, repulsionStrength])

  // 5. Node Event Handlers (Click, Drag, Drop)
  const handleNodeMouseDown = (node, e) => {
    e.stopPropagation()
    draggingNodeRef.current = node
    node.isDragging = true
    hasMovedRef.current = false
    
    // Set clicked node details
    setSelectedNode(node)
  }

  const handleSVGMouseMove = (e) => {
    if (draggingNodeRef.current) {
      const svg = svgRef.current
      if (!svg) return
      
      const rect = svg.getBoundingClientRect()
      
      const mouseX = (e.clientX - rect.left - pan.x) / zoom
      const mouseY = (e.clientY - rect.top - pan.y) / zoom
      
      const node = draggingNodeRef.current
      node.x = mouseX
      node.y = mouseY
      node.vx = 0
      node.vy = 0
      hasMovedRef.current = true
      
      // Inject slight energy so connected nodes follow smoothly
      alphaRef.current = Math.max(alphaRef.current, 0.15)
      
      setTick(t => t + 1)
    } else if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setPan({ x: pan.x + dx, y: pan.y + dy })
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleSVGMouseUp = () => {
    if (draggingNodeRef.current) {
      draggingNodeRef.current.isDragging = false
      if (hasMovedRef.current) {
        draggingNodeRef.current.isPinned = true
      }
      draggingNodeRef.current = null
    }
    setIsPanning(false)
  }

  const handleNodeDoubleClick = (node, e) => {
    e.stopPropagation()
    node.isPinned = false
    node.vx = 0
    node.vy = 0
    alphaRef.current = 0.5
    setTick(t => t + 1)
  }

  const handleUnpinAll = () => {
    simNodesRef.current.forEach(n => {
      n.isPinned = false
    })
    alphaRef.current = 0.8
    setTick(t => t + 1)
  }

  const handleSVGMouseDown = (e) => {
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
  }

  const handleZoom = (factor) => {
    if (factor === 'in') setZoom(z => Math.min(3, z + 0.15))
    if (factor === 'out') setZoom(z => Math.max(0.4, z - 0.15))
    if (factor === 'reset') {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }

  const handleSelectAllParents = () => {
    const allParentCodes = parentCompanies.map(p => p.code)
    setSelectedParents(allParentCodes)
  }

  const handleClearAllParents = () => {
    setSelectedParents([])
  }

  const handleSelectAllBanks = () => {
    const allBankNames = bankCompanies.map(b => b.name)
    setSelectedBanks(allBankNames)
  }

  const handleClearAllBanks = () => {
    setSelectedBanks([])
  }

  // Toggle Parent Company selections
  const toggleParentSelection = (code) => {
    setSelectedParents(prev => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev
        return prev.filter(c => c !== code)
      } else {
        return [...prev, code]
      }
    })
  }

  const toggleBankSelection = (name) => {
    setSelectedBanks(prev => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev
        return prev.filter(b => b !== name)
      } else {
        return [...prev, name]
      }
    })
  }

  // Determine node size dynamically based on details
  const getNodeRadius = (node) => {
    if (node.isParent) return 24
    if (!sizeByPercent) return 12
    
    if (activeMode === 'subsidiaries') {
      const percentage = node.percentage || 100
      return 7 + (percentage / 100) * 11
    } else {
      // Sizing company node logarithmically based on their total IDR-equivalent debt with a steeper scaling to make differences clear
      const val = node.totalLoanVal || 1
      const logVal = Math.log10(val) // ranges from ~6 (millions) to ~12 (trillions)
      return Math.max(6, Math.min(26, (logVal - 7) * 3.8))
    }
  }

  return (
    <div className="bg-transparent min-h-screen -mx-4 -my-6 py-6 px-4">
      {loading ? (
        <div className="flex items-center justify-center h-[70vh] text-slate-500 gap-2">
          <RotateCcw className="animate-spin" size={20} />
          Memuat data hubungan dan finansial...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* 1. SELECTION & FILTER SIDEBAR */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col lg:h-[110vh] h-fit overflow-y-auto space-y-4">
            
            {/* Mode Switcher Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button
                onClick={() => {
                  setActiveMode('subsidiaries')
                  setSelectedNode(null)
                }}
                className={`flex-1 py-2 px-2 text-center font-bold text-xs rounded-lg transition-all ${activeMode === 'subsidiaries' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Anak Perusahaan
              </button>
              <button
                onClick={() => {
                  setActiveMode('loans')
                  setSelectedNode(null)
                }}
                className={`flex-1 py-2 px-2 text-center font-bold text-xs rounded-lg transition-all ${activeMode === 'loans' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pinjaman Bank
              </button>
            </div>

            <hr className="border-slate-100" />

            {/* Mode 1: Parent Company Checklist */}
            {activeMode === 'subsidiaries' ? (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                    <Building2 size={16} className="text-blue-600" />
                    Group and Credit Graph
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Pilih emiten dan visualisasikan peta grup perusahaannya.</p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari Kode / Nama..."
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 px-0.5">
                  <span>Centang emiten:</span>
                  <div className="flex gap-1.5 font-bold">
                    <button type="button" onClick={handleSelectAllParents} className="text-blue-600 hover:text-blue-800">Semua</button>
                    <span className="text-slate-300 font-normal">|</span>
                    <button type="button" onClick={handleClearAllParents} className="text-slate-500 hover:text-slate-700">Kosongkan</button>
                  </div>
                </div>

                {/* Checklist box */}
                <div className="border border-slate-150 rounded-lg overflow-y-auto flex-1 max-h-[220px] bg-slate-50 p-2 divide-y divide-slate-100">
                  {filteredParentsList.map(p => {
                    const isChecked = selectedParents.includes(p.code)
                    return (
                      <div 
                        key={p.code} 
                        onClick={() => toggleParentSelection(p.code)}
                        className={`flex items-center justify-between py-1.5 px-2 hover:bg-slate-100 cursor-pointer text-xs transition-colors rounded ${isChecked ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700'}`}
                      >
                        <div className="flex items-center gap-2 truncate pr-1">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {}} 
                            className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                          />
                          <span>{p.code}</span>
                          <span className="text-slate-400 truncate text-[10px] font-normal">{p.name}</span>
                        </div>
                        <span className="bg-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded-full text-[9px] shrink-0">
                          {p.count} anak
                        </span>
                      </div>
                    )
                  })}
                  {filteredParentsList.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-6">Tidak ada hasil cocok</div>
                  )}
                </div>
              </div>
            ) : (
              /* Mode 2: Bank Checklist */
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                    <Building2 size={16} className="text-blue-600" />
                    Pilih Bank Kreditur
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Visualisasikan kemana saja aliran pinjaman dari bank-bank pilihan.</p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari Bank Kreditur..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 px-0.5">
                  <span>Centang bank:</span>
                  <div className="flex gap-1.5 font-bold">
                    <button type="button" onClick={handleSelectAllBanks} className="text-blue-600 hover:text-blue-800">Semua</button>
                    <span className="text-slate-300 font-normal">|</span>
                    <button type="button" onClick={handleClearAllBanks} className="text-slate-500 hover:text-slate-700">Kosongkan</button>
                  </div>
                </div>

                {/* Checklist box */}
                <div className="border border-slate-150 rounded-lg overflow-y-auto flex-1 max-h-[220px] bg-slate-50 p-2 divide-y divide-slate-100">
                  {filteredBanksList.map(b => {
                    const isChecked = selectedBanks.includes(b.name)
                    return (
                      <div 
                        key={b.name} 
                        onClick={() => toggleBankSelection(b.name)}
                        className={`flex items-center justify-between py-1.5 px-2 hover:bg-slate-100 cursor-pointer text-xs transition-colors rounded ${isChecked ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700'}`}
                      >
                        <div className="flex items-center gap-2 truncate pr-1">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {}} 
                            className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                          />
                          <span className="truncate">{b.name}</span>
                        </div>
                        <span className="bg-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded-full text-[9px] shrink-0">
                          {b.count} emiten
                        </span>
                      </div>
                    )
                  })}
                  {filteredBanksList.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-6">Tidak ada hasil cocok</div>
                  )}
                </div>
              </div>
            )}

            <hr className="border-slate-100" />

            {/* Filters */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {activeMode === 'subsidiaries' ? 'Cari Anak Perusahaan' : 'Cari Emiten Penerima Pinjaman'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={activeMode === 'subsidiaries' ? "Nama anak..." : "Kode / nama emiten..."}
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                </div>
              </div>

              {/* Ownership slider (Only shown in subsidiaries mode) */}
              {activeMode === 'subsidiaries' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600">Kepemilikan Min.</span>
                    <span className="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px]">{minPercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minPercentage}
                    onChange={(e) => setMinPercentage(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* Visualization Settings */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Settings size={13} />
                Pengaturan Peta Graph
              </span>

              {/* Size toggling */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  {activeMode === 'subsidiaries' ? 'Ukuran Berdasarkan %' : 'Ukuran Berdasarkan Nominal'}
                </span>
                <button
                  onClick={() => setSizeByPercent(!sizeByPercent)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${sizeByPercent ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow" />
                </button>
              </div>

              {/* Node coloring options (Only relevant in subsidiaries mode) */}
              {activeMode === 'subsidiaries' && (
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">Warna Node Anak Perusahaan</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setColorMode('sector')}
                      className={`py-1 rounded text-center text-xs border font-semibold ${colorMode === 'sector' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Bidang Usaha
                    </button>
                    <button
                      onClick={() => setColorMode('uniform')}
                      className={`py-1 rounded text-center text-xs border font-semibold ${colorMode === 'uniform' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Merah Muda
                    </button>
                  </div>
                </div>
              )}

              {/* Forces sliders */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Jarak Pegas Penghubung</span>
                  <span>{springLength}px</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={springLength}
                  onChange={(e) => setSpringLength(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-slate-600"
                />

                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Daya Tolak Antar Bulatan</span>
                  <span>{repulsionStrength}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1000"
                  value={repulsionStrength}
                  onChange={(e) => setRepulsionStrength(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-slate-600"
                />
              </div>
            </div>

            <hr className="border-slate-100" />
            
            {/* Live Database Mode (Neo4j Connection Drawer) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Database size={14} className={useNeo4j ? "text-emerald-500 animate-pulse" : "text-slate-400"} />
                  Mode Live Database (Neo4j)
                </span>
                
                <button
                  onClick={() => setUseNeo4j(!useNeo4j)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${useNeo4j ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'}`}
                  title={useNeo4j ? "Matikan Live Mode" : "Aktifkan Live Mode"}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow transition-all" />
                </button>
              </div>

              {/* Status Indicator badge */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span>Status Koneksi:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[9px] ${
                  dbStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' :
                  dbStatus === 'connecting' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                  dbStatus === 'error' ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-slate-200 text-slate-700'
                }`}>
                  {dbStatus === 'connected' ? 'Live Neo4j' :
                   dbStatus === 'connecting' ? 'Menghubungkan...' :
                   dbStatus === 'error' ? 'Koneksi Gagal' : 'Data Lokal (Offline)'}
                </span>
              </div>

              {/* Collapsible config button */}
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <Settings size={11} className={showConfig ? "rotate-45 transition-transform" : "transition-transform"} />
                <span>{showConfig ? 'Sembunyikan Pengaturan DB' : 'Atur Kredensial Neo4j'}</span>
              </button>

              {/* Input details drawer */}
              {showConfig && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">URI Connection (Bolt)</label>
                    <input
                      type="text"
                      value={neo4jUri}
                      onChange={(e) => setNeo4jUri(e.target.value)}
                      placeholder="bolt://localhost:7687"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Username</label>
                    <input
                      type="text"
                      value={neo4jUser}
                      onChange={(e) => setUseNeo4j(false) || setNeo4jUser(e.target.value)}
                      placeholder="neo4j"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Password</label>
                    <input
                      type="password"
                      value={neo4jPassword}
                      onChange={(e) => setUseNeo4j(false) || setNeo4jPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => { setUseNeo4j(true); fetchNeo4jData(); }}
                    disabled={dbStatus === 'connecting'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs disabled:opacity-50 transition-colors cursor-pointer text-center"
                  >
                    {dbStatus === 'connecting' ? 'Menyambung...' : 'Tes & Hubungkan'}
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {dbStatus === 'error' && dbErrorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-[10px] text-rose-800 rounded-lg font-medium leading-relaxed">
                  <span className="font-bold text-rose-900 block mb-0.5">Kesalahan Koneksi:</span>
                  {dbErrorMsg}
                  <span className="block mt-1 font-semibold text-rose-700 bg-rose-100/50 py-0.5 px-1.5 rounded w-fit">
                    Fallback otomatis aktif
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* 2. MAIN CONTENT AREA (Graph + Details under it) */}
          <div className="lg:col-span-3 flex flex-col space-y-6">
            
            {/* Graph Viewport */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative h-[65vh]">
              
              {/* Top controls toolbar */}
              <div className="absolute top-3 left-3 z-10 flex gap-1 bg-white/90 backdrop-blur border border-slate-200 rounded-lg shadow-sm p-1">
                <button
                  onClick={() => handleZoom('in')}
                  title="Perbesar"
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={() => handleZoom('out')}
                  title="Perkecil"
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  onClick={() => handleZoom('reset')}
                  title="Reset Posisi & Zoom"
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  onClick={handleUnpinAll}
                  title="Lepas Semua Sematan Pin"
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                >
                  <PinOff size={15} />
                </button>
              </div>

              {/* Status info bar */}
              <div className="absolute top-3 right-3 z-10 bg-slate-800/90 text-white backdrop-blur text-[10px] px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Render: {simNodesRef.current.length} node | {simLinksRef.current.length} link</span>
              </div>
              {/* Help tip */}
              <div className="absolute bottom-3 left-3 z-10 text-[10px] text-slate-400 pointer-events-none flex items-center gap-1 bg-white/85 backdrop-blur px-2 py-1 rounded border border-slate-100 shadow-sm">
                <HelpCircle size={10} />
                <span>Geser bg untuk geser peta | Seret untuk menyematkan (pin) | Klik 2x node untuk lepas pin</span>
              </div>

              {/* Interactive SVG canvas */}
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${height}`}
                onMouseMove={handleSVGMouseMove}
                onMouseUp={handleSVGMouseUp}
                onMouseLeave={handleSVGMouseUp}
                onMouseDown={handleSVGMouseDown}
                className="bg-transparent cursor-grab active:cursor-grabbing flex-1 select-none"
              >
                {/* Arrow markers */}
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="26"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(15, 23, 42, 0.35)" />
                  </marker>
                </defs>

                {/* Transform group for Zoom & Panning */}
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  
                  {/* LINKS / EDGES */}
                  <g className="links">
                    {simLinksRef.current.map((link, idx) => {
                      const sourceNode = simNodesRef.current.find(n => n.id === link.source)
                      const targetNode = simNodesRef.current.find(n => n.id === link.target)
                      if (!sourceNode || !targetNode) return null

                      // Visual coloring based on mode
                      let glowColor = '#f27a1a'
                      if (activeMode === 'subsidiaries') {
                        glowColor = colorMode === 'sector' ? (SECTOR_COLORS[targetNode.category] || '#475569') : '#f27a1a'
                      } else {
                        glowColor = '#f27a1a' // Orange color for debt connections
                      }

                      return (
                        <g key={idx}>
                          {/* Glowing line backdrop */}
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={glowColor}
                            strokeOpacity={0.08}
                            strokeWidth={7}
                          />
                          {/* Main line connector */}
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke="rgba(71, 85, 105, 0.35)"
                            strokeWidth={activeMode === 'loans' ? Math.max(1, Math.min(5, Math.log10(link.value) - 5)) : 1.5}
                            markerEnd="url(#arrow)"
                          />
                        </g>
                      )
                    })}
                  </g>

                  {/* NODES / VERTICES */}
                  <g className="nodes">
                    {simNodesRef.current.map((node) => {
                      const radius = getNodeRadius(node)
                      const isSelected = selectedNode && selectedNode.id === node.id
                      
                      // Node colors
                      let fillCol = '#f27a1a'
                      if (node.isParent) {
                        fillCol = node.isBank ? '#00c0a8' : '#2563eb' // Teal for banks, Blue for companies
                      } else if (activeMode === 'subsidiaries' && colorMode === 'sector') {
                        fillCol = SECTOR_COLORS[node.category] || '#64748b'
                      } else if (activeMode === 'loans') {
                        fillCol = '#f27a1a' // Orange for debtor company nodes
                      }

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onMouseDown={(e) => handleNodeMouseDown(node, e)}
                          onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
                          className="cursor-pointer group"
                        >
                          {/* Hover highlight circle */}
                          <circle
                            r={radius + 6}
                            fill={fillCol}
                            fillOpacity={0.0}
                            className="group-hover:fill-opacity-15 transition-all duration-300"
                          />
                          
                          {/* Selected border ring */}
                          {isSelected && (
                            <circle
                              r={radius + 4}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          )}

                          {/* Pinned ring border */}
                          {node.isPinned && (
                            <circle
                              r={radius + 3}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth={1.5}
                              strokeDasharray="2 2"
                            />
                          )}

                          {/* Node circle */}
                          <circle
                            r={radius}
                            fill={fillCol}
                            stroke={node.isParent ? '#ffffff' : '#0f172a'}
                            strokeWidth={node.isParent ? 2.5 : 1.5}
                            className="transition-all duration-300"
                          />

                          {/* Text labels */}
                          {node.isParent ? (
                            <g>
                              {/* Backdrop label box */}
                              <rect
                                x={-35}
                                y={radius + 4}
                                width={70}
                                height={15}
                                rx={4}
                                fill="#0f172a"
                                fillOpacity={0.8}
                              />
                              <text
                                textAnchor="middle"
                                y={radius + 15}
                                fill="#ffffff"
                                fontSize={9}
                                fontWeight="bold"
                                className="pointer-events-none text-center"
                              >
                                {node.label}
                              </text>
                            </g>
                          ) : (
                            <text
                              textAnchor="middle"
                              y={radius + 12}
                              fill="#000000"
                              fontSize={zoom > 0.85 ? 7.5 : 0}
                              className="pointer-events-none group-hover:fill-[#f27a1a] font-bold drop-shadow"
                            >
                              {node.label.length > 15 ? `${node.label.substring(0, 13)}...` : node.label}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>

                </g>
              </svg>

              {/* No selections overlays */}
              {simNodesRef.current.length === 0 && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <Building2 size={48} className="text-slate-600 mb-3" />
                  <h4 className="font-bold text-slate-200">Tidak Ada Data Yang Dipilih</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    {activeMode === 'subsidiaries' 
                      ? 'Silakan centang satu atau beberapa emiten di panel kiri untuk mulai memvisualisasikan peta anak perusahaan.'
                      : 'Silakan centang satu atau beberapa bank kreditur di panel kiri untuk mulai memvisualisasikan peta penerima pinjaman.'
                    }
                  </p>
                </div>
              )}

              {/* Neo4j Live Database Connecting Overlay */}
              {dbStatus === 'connecting' && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-slate-400 p-8 text-center z-20">
                  <Database size={48} className="text-emerald-500 animate-bounce mb-3" />
                  <h4 className="font-bold text-slate-200">Menghubungkan ke Neo4j Live...</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Sedang membuka socket Bolt connection ke {neo4jUri} dan mengambil model grafik relasi terbaru secara langsung.
                  </p>
                </div>
              )}
            </div>

            {/* 3. DETAILS CARD DISPLAY (Horizontal Bottom Panel) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col space-y-4">
              
              {/* Header info */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm md:text-base">
                    <Info size={16} className="text-blue-600" />
                    Informasi Detail & Petunjuk
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">Detail profil emiten, bank, atau anak perusahaan yang Anda pilih di peta graf.</p>
                </div>
              </div>

              {/* Profile Detail Card adapts dynamically depending on selected node type */}
              {selectedNode ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  
                  {/* Column 1: Branding / Identitas */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center relative overflow-hidden flex flex-col justify-center min-h-[160px] self-stretch">
                    <div 
                      className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-10"
                      style={{ 
                        backgroundColor: selectedNode.isParent 
                          ? (selectedNode.isBank ? '#00c0a8' : '#2563eb')
                          : (activeMode === 'subsidiaries' ? (SECTOR_COLORS[selectedNode.category] || '#64748b') : '#f27a1a') 
                      }}
                    />

                    <div className="flex justify-center mb-2">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md p-1 text-center"
                        style={{ 
                          backgroundColor: selectedNode.isParent 
                            ? (selectedNode.isBank ? '#00c0a8' : '#2563eb')
                            : (activeMode === 'subsidiaries' ? (SECTOR_COLORS[selectedNode.category] || '#64748b') : '#f27a1a') 
                        }}
                      >
                        {selectedNode.isParent 
                          ? selectedNode.label 
                          : (activeMode === 'subsidiaries' ? `${selectedNode.percentage}%` : 'Emiten')
                        }
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-800 text-xs leading-tight">{selectedNode.fullName}</h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {selectedNode.isParent 
                        ? (selectedNode.isBank ? 'Institusi Perbankan Kreditur' : 'Perusahaan Emiten Tercatat')
                        : (activeMode === 'subsidiaries' ? `Anak Perusahaan dari ${selectedNode.parentCode}` : 'Penerima Pinjaman Kredit')
                      }
                    </p>
                    {selectedNode.isPinned && (
                      <div 
                        onClick={() => {
                          selectedNode.isPinned = false;
                          setTick(t => t + 1);
                        }}
                        className="mt-2 flex items-center justify-center gap-1.5 text-[9px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md py-1 px-2.5 font-bold w-fit mx-auto cursor-pointer hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-sm select-none"
                      >
                        <PinOff size={10} />
                        <span>Tersemat (Klik untuk lepas)</span>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Rincian Operasional & Finansial */}
                  <div className="space-y-3.5 text-xs self-stretch">
                    {/* TYPE 1: Bank Node details */}
                    {selectedNode.isBank ? (
                      <div className="space-y-3.5">
                        <div className="flex gap-2">
                          <Building2 className="text-indigo-400 shrink-0 mt-0.5" size={15} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Nama Bank</span>
                            <span className="font-bold text-slate-850">{selectedNode.fullName}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Briefcase className="text-slate-400 shrink-0 mt-0.5" size={15} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Debitur Terdaftar</span>
                            <span className="font-bold text-slate-700">{selectedNode.companiesCount} emiten berutang</span>
                          </div>
                        </div>
                      </div>
                    ) : 
                    
                    /* TYPE 2: Parent Company Node details */
                    selectedNode.isParent ? (
                      <div className="space-y-3.5">
                        <div className="flex gap-2">
                          <Building2 className="text-blue-500 shrink-0 mt-0.5" size={15} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Kode Saham Emiten</span>
                            <span className="font-bold text-slate-700 text-sm">{selectedNode.id}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Briefcase className="text-slate-400 shrink-0 mt-0.5" size={15} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Struktur Anak Perusahaan</span>
                            <span className="font-medium text-slate-700">{selectedNode.subsidiariesCount} entitas anak</span>
                          </div>
                        </div>
                      </div>
                    ) : 
                    
                    /* TYPE 3: Subsidiary Node details */
                    activeMode === 'subsidiaries' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 max-h-[160px] overflow-y-auto pr-1">
                        <div className="flex gap-2.5">
                          <ShieldCheck className="text-blue-500 shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Kepemilikan Saham</span>
                            <span className="font-bold text-slate-800 text-xs">{selectedNode.percentageStr || '0'}%</span>
                          </div>
                        </div>
                        <div className="flex gap-2.5">
                          <MapPin className="text-red-400 shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Lokasi Kedudukan</span>
                            <span className="font-medium text-slate-700">{selectedNode.location || '-'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2.5">
                          <Briefcase className="text-purple-400 shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Sektor Usaha</span>
                            <span className="font-bold" style={{ color: SECTOR_COLORS[selectedNode.category] }}>{selectedNode.category}</span>
                          </div>
                        </div>
                        {selectedNode.assets && (
                          <div className="flex gap-2.5">
                            <DollarSign className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                            <div>
                              <span className="text-[9px] text-slate-400 block font-semibold uppercase">Jumlah Aset Anak</span>
                              <span className="font-bold text-slate-700">
                                {formatMoneyShort(parseFloat(selectedNode.assets.replace(/[^\d.]/g, '')), selectedNode.currency)}
                                <span className="text-[9px] font-normal text-slate-400 ml-1">({selectedNode.unit})</span>
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2.5 md:col-span-2">
                          <Info className="text-slate-400 shrink-0 mt-0.5" size={16} />
                          <div>
                            <span className="text-[9px] text-slate-400 block font-semibold uppercase">Deskripsi Kegiatan Usaha</span>
                            <span className="text-slate-600 block italic leading-relaxed text-[10px]">{selectedNode.activity || '-'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      
                      /* TYPE 4: Corporate Debtor Node details (lists all their bank debts) */
                      <div className="space-y-3 px-0.5">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-semibold uppercase mb-1">Daftar Pinjaman Aktif</span>
                          <div className="space-y-1.5 border border-slate-100 rounded-lg p-2 max-h-[100px] overflow-y-auto bg-slate-50">
                            {selectedNode.loansList.map((loan, idx) => (
                              <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-1 last:border-b-0 last:pb-0 gap-2">
                                <span className="font-bold text-slate-700 text-[9px] truncate max-w-[120px]">{loan.bank}</span>
                                <div className="text-right">
                                  <span className="font-semibold text-emerald-600 text-[9px]">
                                    {formatMoneyShort(loan.amount, loan.currency)}
                                  </span>
                                  {loan.priorAmount > 0 && (
                                    <span className="text-slate-400 text-[8px] block">
                                      Sblm: {formatMoneyShort(loan.priorAmount, loan.currency)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 items-center">
                          <DollarSign className="text-indigo-500 shrink-0" size={14} />
                          <div>
                            <span className="text-[9px] text-slate-400 font-semibold uppercase mr-1.5">Total Nilai Pinjaman:</span>
                            <span className="font-bold text-slate-800 text-xs">
                              {formatMoneyShort(selectedNode.totalLoanVal, 'IDR')}
                              <span className="text-[8px] font-normal text-slate-450 ml-1">*(Konversi IDR)</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 3: Legend / Color details */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs self-stretch flex flex-col justify-center min-h-[160px]">
                    {activeMode === 'subsidiaries' ? (
                      <div>
                        <span className="font-bold text-slate-700 block mb-1 text-[10px]">Legenda Bidang Usaha</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-[110px] overflow-y-auto pr-1">
                          {Object.entries(SECTOR_COLORS).map(([name, color]) => (
                            <div key={name} className="flex items-center gap-1 text-[9px] min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-slate-600 truncate">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-700 block mb-1.5 text-[10px]">Petunjuk Warna Graf</span>
                        <div className="space-y-1.5 text-[9px]">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#00c0a8] shrink-0 border border-white shadow-sm" />
                            <span className="text-slate-700 font-bold">Bank Kreditur (Pemberi Pinjaman)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#f27a1a] shrink-0 border border-white shadow-sm" />
                            <span className="text-slate-700 font-bold">Emiten Debitur (Penerima Pinjaman)</span>
                          </div>
                          <p className="text-[8px] text-slate-400 leading-normal mt-1 border-t border-slate-200 pt-1">
                            *Ukuran lingkaran emiten sebanding dengan nominal utang bank mereka. Ketebalan garis menunjukkan ukuran utang.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  
                  {/* Column 1 & 2: Placeholder info */}
                  <div className="md:col-span-2 flex flex-col items-center justify-center py-6 text-slate-400 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 min-h-[160px]">
                    <Building2 size={36} className="text-slate-305 mb-2" />
                    <h5 className="font-semibold text-xs text-slate-600">Pilih Node di Graf</h5>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[320px]">
                      Klik pada lingkaran emiten, bank, atau anak perusahaan mana pun di peta graf untuk melihat profil rincian detailnya secara instan di sini.
                    </p>
                  </div>

                  {/* Column 3: Legend is always shown! */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs self-stretch flex flex-col justify-center min-h-[160px]">
                    {activeMode === 'subsidiaries' ? (
                      <div>
                        <span className="font-bold text-slate-700 block mb-1 text-[10px]">Legenda Bidang Usaha</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-[110px] overflow-y-auto pr-1">
                          {Object.entries(SECTOR_COLORS).map(([name, color]) => (
                            <div key={name} className="flex items-center gap-1 text-[9px] min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-slate-600 truncate">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-700 block mb-1.5 text-[10px]">Petunjuk Warna Graf</span>
                        <div className="space-y-1.5 text-[9px]">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#00c0a8] shrink-0 border border-white shadow-sm" />
                            <span className="text-slate-700 font-bold">Bank Kreditur (Pemberi Pinjaman)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#f27a1a] shrink-0 border border-white shadow-sm" />
                            <span className="text-slate-700 font-bold">Emiten Debitur (Penerima Pinjaman)</span>
                          </div>
                          <p className="text-[8px] text-slate-400 leading-normal mt-1 border-t border-slate-200 pt-1">
                            *Ukuran lingkaran emiten sebanding dengan nominal utang bank mereka. Ketebalan garis menunjukkan ukuran utang.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

          </div>

        </div>
      )}
    </div>
  )
}
