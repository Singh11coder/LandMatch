import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Radar,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Layers,
  Sparkles,
  Building2,
  Trees,
  Droplets,
  Pickaxe,
  MapPin,
  ChevronRight,
  Sliders,
  Check,
  Clock,
  Globe,
  FileText,
  UserCheck,
  ShieldCheck,
  Activity,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { Button, cx } from '../components/common/index.jsx'

// Available satellite imagery sets for the interactive simulator
const SIMULATOR_AREAS = [
  {
    id: 'area-upper-lake',
    name: 'Upper Lake Bhopal (Wetland & Buffer)',
    category: 'water_shrinkage',
    categoryLabel: 'Water Shrinkage & Encroachment',
    beforeDate: 'March 2022',
    afterDate: 'February 2025',
    beforeImg: '/tiles/area-upper-lake/2022-03-10.jpg',
    afterImg: '/tiles/area-upper-lake/2025-02-02.jpg',
    coords: '23.2500° N, 77.3500° E',
    zone: 'Upper Lake Wetland Eco-Buffer (500m)',
    inZone: true,
    detections: [
      {
        id: 'det-lake-1',
        type: 'new_construction',
        label: 'Illegal Concrete Batching Plant',
        area: '14,250 m²',
        coords: '23.254° N, 77.362° E',
        color: '#EF4444',
        top: '38%',
        left: '58%',
      },
      {
        id: 'det-lake-2',
        type: 'water_shrinkage',
        label: 'Wetland Landfill & Siltation',
        area: '32,100 m²',
        coords: '23.248° N, 77.345° E',
        color: '#3B82F6',
        top: '64%',
        left: '32%',
      },
    ],
    telemetry: {
      ndviChange: '-0.38',
      ndbiChange: '+0.71',
      threatLevel: 'CRITICAL',
    },
  },
  {
    id: 'area-kerwa',
    name: 'Kerwa Forest Reserve (Ecological Corridor)',
    category: 'vegetation_loss',
    categoryLabel: 'Forest Canopy Loss',
    beforeDate: 'February 2022',
    afterDate: 'March 2025',
    beforeImg: '/tiles/area-kerwa/2022-02-21.jpg',
    afterImg: '/tiles/area-kerwa/2025-03-15.jpg',
    coords: '23.1600° N, 77.3800° E',
    zone: 'Kerwa Reserve Forest Buffer',
    inZone: true,
    detections: [
      {
        id: 'det-kerwa-1',
        type: 'vegetation_loss',
        label: 'Illegal Timber Clear-Cut',
        area: '24,800 m²',
        coords: '23.164° N, 77.388° E',
        color: '#F97316',
        top: '42%',
        left: '46%',
      },
    ],
    telemetry: {
      ndviChange: '-0.54',
      ndbiChange: '+0.12',
      threatLevel: 'HIGH',
    },
  },
  {
    id: 'area-betwa',
    name: 'Betwa River Basin (Riparian Zone)',
    category: 'sand_mining',
    categoryLabel: 'Illegal Sand Mining',
    beforeDate: 'April 2022',
    afterDate: 'April 2025',
    beforeImg: '/tiles/area-betwa/2022-04-01.jpg',
    afterImg: '/tiles/area-betwa/2025-04-10.jpg',
    coords: '23.5200° N, 77.8100° E',
    zone: 'Betwa Riparian Protection Zone',
    inZone: true,
    detections: [
      {
        id: 'det-betwa-1',
        type: 'sand_mining',
        label: 'Unauthorized Riverbed Excavation',
        area: '41,500 m²',
        coords: '23.525° N, 77.815° E',
        color: '#F59E0B',
        top: '52%',
        left: '54%',
      },
    ],
    telemetry: {
      ndviChange: '-0.15',
      ndbiChange: '+0.45',
      threatLevel: 'HIGH',
    },
  },
]

// The 4 Core Detection Pillars
const DETECTION_PILLARS = [
  {
    id: 'construction',
    type: 'new_construction',
    title: 'Illegal Construction & Urban Encroachment',
    subtitle: 'Concrete Structures, Road Cuts & Warehouses',
    color: '#EF4444',
    bgGlow: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    icon: Building2,
    spectralIndex: 'NDBI (Built-up Index) + Structural Edge Mask',
    description:
      'Autonomous detection of unlicensed concrete foundations, unauthorized road construction, and warehouse expansion inside reserved agricultural or flood-prone green belts.',
    impact: 'Halts illegal real-estate layout developments before structures become populated and litigated.',
  },
  {
    id: 'vegetation',
    type: 'vegetation_loss',
    title: 'Vegetation Loss & Deforestation',
    subtitle: 'Canopy Clearing & Forest Corridor Severance',
    color: '#F97316',
    bgGlow: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.3)',
    icon: Trees,
    spectralIndex: 'Multi-temporal NDVI (Normalized Difference Vegetation Index)',
    description:
      'Pinpoints rapid canopy clearing, illegal timber harvesting, and agricultural encroachment into government forest reserves and eco-sensitive wildlife corridors.',
    impact: 'Protects critical tiger corridors and catchment tree density with automated 5-day orbital sweeps.',
  },
  {
    id: 'water',
    type: 'water_shrinkage',
    title: 'Water Shrinkage & Wetland Reclamation',
    subtitle: 'Lakebed Landfilling & Shoreline Encroachment',
    color: '#3B82F6',
    bgGlow: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    icon: Droplets,
    spectralIndex: 'MNDWI (Modified Water Index) Boundary Edge Tracking',
    description:
      'Tracks seasonal shoreline shrinkage versus illegal dumping and artificial backfilling of lakebeds, wetlands, and municipal storm retention basins.',
    impact: 'Prevents urban flooding and protects natural potable water reservoirs from permanent shrinkage.',
  },
  {
    id: 'sand',
    type: 'sand_mining',
    title: 'Sand Mining & Riverbed Dredging',
    subtitle: 'Heavy Machinery Extraction & Pit Deepening',
    color: '#F59E0B',
    bgGlow: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    icon: Pickaxe,
    spectralIndex: 'Spectral Reflectance Anomaly & Hydrological Bed Alteration',
    description:
      'Detects unauthorized mechanized dredging, heavy vehicle access ramps, and gravel extraction pits operating outside legally leased mining coordinates.',
    impact: 'Stops riverbank collapse and groundwater depletion caused by unlicensed sand mining syndicates.',
  },
]

// 4-Stage Operational Pipeline
const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Automated Satellite Ingestion',
    tag: '5-Day Orbital Cadence',
    desc: 'Continuously pulls Sentinel-2 L2A bottom-of-atmosphere optical imagery across all 13 multispectral bands from the ESA Copernicus constellation.',
    badge: '10m Resolution',
  },
  {
    step: '02',
    title: 'AI Radiometric Coregistration',
    tag: 'Sub-Pixel Precision',
    desc: 'Automated cloud/shadow masking and sub-pixel orthorectification align multi-temporal scenes to eliminate false positives from lighting shifts.',
    badge: 'Atmospheric Correction',
  },
  {
    step: '03',
    title: 'Protected Zone Ray-Casting',
    tag: 'Instant Collision Check',
    desc: 'Identified raster differences are polygonized and tested against legal GIS buffer zones via mathematical point-in-polygon ray casting.',
    badge: 'Zero-Delay Escalation',
  },
  {
    step: '04',
    title: 'Ground Truthing & Verification',
    tag: 'Tamper-Proof Audit',
    desc: 'Field inspectors receive geo-fenced tasks on mobile Kanban, capture GPS-stamped photo evidence, and log immutable violation determinations.',
    badge: 'Legally Admissible',
  },
]

// Demo Personas for One-Click Quick Launch
const PERSONAS = [
  {
    role: 'officer',
    name: 'Land Officer',
    email: 'officer@landwatch.gov.in',
    tagline: 'Review alerts, run change detection, and assign ground inspections.',
    route: '/',
    badgeColor: '#22D3EE',
    features: ['Macro Command Dashboard', 'Interactive Swipe Detection', 'Single & Bulk Field Assignment', 'Historical Timeline Analysis'],
  },
  {
    role: 'inspector',
    name: 'Field Inspector',
    email: 'inspector@landwatch.gov.in',
    tagline: 'Focused field operations with photo upload and decision sign-off.',
    route: '/inspections',
    badgeColor: '#F59E0B',
    features: ['Strictly Scoped Assigned Tasks', 'Mobile Drag-and-Drop Kanban', 'Geotagged Photo Evidence', 'Irrevocable Audit Logging'],
  },
  {
    role: 'admin',
    name: 'System Admin',
    email: 'admin@landwatch.gov.in',
    tagline: 'Full authority including interactive protected zone GIS boundary creation.',
    route: '/alerts',
    badgeColor: '#EF4444',
    features: ['Draw New Protected Zones on Map', 'Instant Ray-Casting Recalculation', 'System-wide User Access', 'Audit Trail Oversight'],
  },
]

export default function Landing() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  // Interactive Simulator State
  const [selectedAreaIndex, setSelectedAreaIndex] = useState(0)
  const [sliderPosition, setSliderPosition] = useState(50) // percentage
  const [showOverlays, setShowOverlays] = useState(true)
  const [showRadarScan, setShowRadarScan] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [launchingRole, setLaunchingRole] = useState(null)

  const containerRef = useRef(null)
  const currentArea = SIMULATOR_AREAS[selectedAreaIndex]

  // Slider Mouse & Touch Handlers
  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percent)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (isDragging && e.touches[0]) {
      handleMove(e.touches[0].clientX)
    }
  }, [isDragging, handleMove])

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      handleMove(e.clientX)
    }
  }, [isDragging, handleMove])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove)
      window.addEventListener('touchend', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove])

  // One-Click Login Launcher
  const handleQuickLaunch = async (persona) => {
    setLaunchingRole(persona.role)
    try {
      await login(persona.email, 'demo123', persona.role)
      navigate(persona.route)
    } catch {
      // fallback navigate to login
      navigate('/login')
    } finally {
      setLaunchingRole(null)
    }
  }

  return (
    <div className="min-h-screen bg-base text-ink selection:bg-accent/30 selection:text-white font-sans">
      {/* ======================================================== */}
      {/* 1. TOP NAVIGATION BAR */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Status */}
          <div className="flex items-center gap-3">
            <Link to="/landing" className="flex items-center gap-2.5 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/40 text-accent group-hover:scale-105 transition-transform">
                <Radar size={22} className="animate-spin-slow" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-ink flex items-center gap-1.5">
                  LandWatch
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30">
                    Sentinel-2 AI
                  </span>
                </span>
                <span className="block text-[10px] text-muted -mt-0.5 font-medium">
                  Autonomous Earth Observation
                </span>
              </div>
            </Link>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted">
            <a href="#simulator" className="hover:text-accent transition-colors">
              Interactive Simulator
            </a>
            <a href="#pillars" className="hover:text-accent transition-colors">
              Detection Pillars
            </a>
            <a href="#pipeline" className="hover:text-accent transition-colors">
              How It Works
            </a>
            <a href="#demo-access" className="hover:text-accent transition-colors">
              Demo Personas
            </a>
            <a href="#architecture" className="hover:text-accent transition-colors">
              Enterprise Specs
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <Button
                variant="primary"
                onClick={() => navigate('/')}
                className="gap-2 shadow-lg shadow-accent/20"
              >
                <span>Enter Command Center</span>
                <ArrowRight size={14} />
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent transition-all"
                >
                  Sign In
                </Link>
                <a
                  href="#demo-access"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-base shadow-lg shadow-accent/25 hover:bg-cyan-300 transition-all"
                >
                  <span>Launch Live Demo</span>
                  <ArrowRight size={13} />
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. HERO SECTION */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-line bg-gradient-to-b from-surface/40 via-base to-base">
        {/* Subtle Constellation Grid Background */}
        <div className="grid-bg absolute inset-0 opacity-25 pointer-events-none" />

        {/* Ambient Radial Cyber Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-[600px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-10 h-72 w-72 rounded-full bg-critical/10 blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-mono text-accent mb-6 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span>SENTINEL-2 MULTISPECTRAL CONSTELLATION • L2A BOTTOM-OF-ATMOSPHERE</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink max-w-4xl mx-auto leading-[1.15]">
            See Change Before It Becomes{' '}
            <span className="bg-gradient-to-r from-critical via-high to-accent bg-clip-text text-transparent">
              Damage.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Autonomous geospatial intelligence for state environmental authorities, town planners, and forest departments.
            Detect illegal construction, forest clearing, lake encroachment, and sand mining from orbit in real time.
          </p>

          {/* Primary Call to Actions */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#simulator"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-base shadow-xl shadow-accent/25 hover:bg-cyan-300 transition-all hover:scale-[1.02]"
            >
              <Sliders size={16} />
              <span>Try Interactive Swipe Simulator</span>
            </a>

            <a
              href="#demo-access"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent transition-all"
            >
              <Sparkles size={16} className="text-accent" />
              <span>Quick 1-Click Role Access</span>
            </a>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-accent">94.8%</div>
              <div className="text-xs text-muted mt-1 font-medium">Model Classification Precision</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-ink">10m</div>
              <div className="text-xs text-muted mt-1 font-medium">Sentinel-2 Spatial Resolution</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-resolved">&lt; 30s</div>
              <div className="text-xs text-muted mt-1 font-medium">Automated Pipeline Run Time</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-critical">100%</div>
              <div className="text-xs text-muted mt-1 font-medium">Protected Zone Buffer Collision</div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. INTERACTIVE BEFORE / AFTER SATELLITE SIMULATOR */}
      {/* ======================================================== */}
      <section id="simulator" className="py-20 border-b border-line bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-accent uppercase tracking-wider mb-2">
              <Globe size={14} />
              <span>Live Demonstration Console</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-ink">
              Interactive Sentinel-2 Swipe Comparison
            </h2>
            <p className="mt-3 text-sm text-muted">
              Drag the central divider handle to inspect real multi-temporal Sentinel-2 imagery.
              Notice how LandWatch algorithmically flags surface modifications inside legally registered eco-buffers.
            </p>
          </div>

          {/* Area Selector Tabs & Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 bg-surface p-3 rounded-2xl border border-line">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted mr-1 hidden sm:inline">Scenario:</span>
              {SIMULATOR_AREAS.map((area, idx) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaIndex(idx)}
                  className={cx(
                    'rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all',
                    selectedAreaIndex === idx
                      ? 'bg-accent text-base font-semibold shadow-md shadow-accent/20'
                      : 'border border-line bg-base text-muted hover:text-ink hover:border-line'
                  )}
                >
                  {area.name.split(' (')[0]}
                </button>
              ))}
            </div>

            {/* Toggle Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowOverlays(!showOverlays)}
                className={cx(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                  showOverlays ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'
                )}
              >
                <Layers size={13} />
                <span>AI Mask {showOverlays ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRadarScan(!showRadarScan)}
                className={cx(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                  showRadarScan ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'
                )}
              >
                <Activity size={13} />
                <span>Scanner {showRadarScan ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* The Swipe Canvas Widget */}
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-line bg-base shadow-2xl">
            {/* Top HUD Telemetry Bar */}
            <div className="flex flex-wrap items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 text-xs font-mono">
              <div className="flex items-center gap-4">
                <span className="text-accent flex items-center gap-1.5">
                  <MapPin size={13} />
                  <span>{currentArea.coords}</span>
                </span>
                <span className="text-muted hidden md:inline">
                  Buffer: <strong className="text-ink font-semibold">{currentArea.zone}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  NDVI Δ: <strong className="text-critical">{currentArea.telemetry.ndviChange}</strong>
                </span>
                <span className="text-xs text-muted">
                  NDBI Δ: <strong className="text-accent">{currentArea.telemetry.ndbiChange}</strong>
                </span>
                <span className="rounded bg-critical/20 px-2 py-0.5 text-[10px] font-bold text-critical border border-critical/40">
                  {currentArea.telemetry.threatLevel}
                </span>
              </div>
            </div>

            {/* Viewport for Before & After */}
            <div
              ref={containerRef}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              className="relative h-[380px] sm:h-[480px] w-full select-none overflow-hidden cursor-ew-resize bg-black"
            >
              {/* BEFORE IMAGE (Full Background) */}
              <img
                src={currentArea.beforeImg}
                alt="Baseline satellite imagery"
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
              />

              {/* AFTER IMAGE (Clipped by slider position) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{
                  clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
                }}
              >
                <img
                  src={currentArea.afterImg}
                  alt="Recent satellite imagery"
                  className="absolute inset-0 h-full w-full object-cover"
                />

                {/* AI Change Overlay & Bounding Boxes (Only visible on the After side) */}
                {showOverlays && (
                  <div className="absolute inset-0 pointer-events-none">
                    {currentArea.detections.map((det) => (
                      <div
                        key={det.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-pulse"
                        style={{ top: det.top, left: det.left }}
                      >
                        {/* Red Pulsing Ring */}
                        <div
                          className="h-20 w-28 rounded-xl border-2 border-critical bg-critical/20 shadow-lg shadow-critical/30 relative flex items-center justify-center"
                          style={{ borderColor: det.color, backgroundColor: `${det.color}33` }}
                        >
                          <span
                            className="absolute -top-3.5 left-2 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-base shadow"
                            style={{ backgroundColor: det.color }}
                          >
                            {det.label}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                            {det.area}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Animated Laser Scanning Sweep */}
              {showRadarScan && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-70 animate-[drift_4s_linear_infinite] pointer-events-none shadow-[0_0_15px_#22D3EE]" />
              )}

              {/* Slider Handle Divider */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-[0_0_12px_#22D3EE] z-20 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-base font-bold shadow-xl border-2 border-base">
                  <Sliders size={18} />
                </div>
              </div>

              {/* Persistent Corner Date Badges */}
              <div className="absolute bottom-4 left-4 z-10 rounded-xl bg-surface/85 backdrop-blur-md px-3 py-1.5 border border-line text-xs font-mono text-muted">
                Baseline: <strong className="text-ink">{currentArea.beforeDate}</strong>
              </div>
              <div className="absolute bottom-4 right-4 z-10 rounded-xl bg-surface/85 backdrop-blur-md px-3 py-1.5 border border-line text-xs font-mono text-muted">
                Recent: <strong className="text-ink">{currentArea.afterDate}</strong>
              </div>
            </div>

            {/* Bottom Instructions Footer */}
            <div className="flex items-center justify-between border-t border-line bg-surface/90 px-4 py-2.5 text-xs text-muted">
              <span>◄ Drag slider handle left or right to reveal surface modification</span>
              <span className="font-mono text-accent">Status: 2 Verified Breaches</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. THE 4 DETECTION PILLARS */}
      {/* ======================================================== */}
      <section id="pillars" className="py-20 border-b border-line bg-base">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-critical uppercase tracking-wider mb-2">
              <ShieldAlert size={14} />
              <span>Comprehensive Threat Matrix</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-ink">
              Four Critical Environmental Breaches
            </h2>
            <p className="mt-3 text-sm text-muted">
              Engineered specifically for government land enforcement mandates, environmental court litigation, and rapid field intervention.
            </p>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DETECTION_PILLARS.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div
                  key={pillar.id}
                  className="group relative rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:border-accent/50 hover:shadow-2xl overflow-hidden"
                >
                  {/* Subtle Corner Glow */}
                  <div
                    className="absolute -top-12 -right-12 h-36 w-36 rounded-full blur-2xl transition-opacity group-hover:opacity-100 opacity-40 pointer-events-none"
                    style={{ backgroundColor: pillar.bgGlow }}
                  />

                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: pillar.bgGlow,
                        borderColor: pillar.borderColor,
                        color: pillar.color,
                      }}
                    >
                      <Icon size={24} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-ink group-hover:text-accent transition-colors">
                          {pillar.title}
                        </h3>
                      </div>
                      <p className="text-xs font-mono text-muted mt-0.5">{pillar.subtitle}</p>

                      <p className="mt-3 text-sm text-muted leading-relaxed">
                        {pillar.description}
                      </p>

                      {/* Technical Spectral Indicator */}
                      <div className="mt-4 rounded-xl border border-line bg-base/80 p-3 text-xs font-mono">
                        <div className="text-muted text-[10px] uppercase font-semibold">
                          Spectral Engine:
                        </div>
                        <div className="text-ink font-medium mt-0.5">{pillar.spectralIndex}</div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs text-resolved">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>{pillar.impact}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. HOW IT WORKS / 4-STEP ORBITAL PIPELINE */}
      {/* ======================================================== */}
      <section id="pipeline" className="py-20 border-b border-line bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-accent uppercase tracking-wider mb-2">
              <Clock size={14} />
              <span>Autonomous Workflow</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-ink">
              From Orbital Pass to Field Ground-Truthing
            </h2>
            <p className="mt-3 text-sm text-muted">
              Zero manual file exporting. LandWatch bridges high-resolution satellite imagery directly to mobile field enforcement teams.
            </p>
          </div>

          {/* 4 Pipeline Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PIPELINE_STEPS.map((p, idx) => (
              <div
                key={p.step}
                className="relative rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-extrabold text-accent/80">
                      {p.step}
                    </span>
                    <span className="rounded-full border border-line bg-base px-2.5 py-0.5 text-[10px] font-mono text-muted">
                      {p.badge}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-ink">{p.title}</h3>
                  <div className="text-xs font-mono text-accent mt-0.5">{p.tag}</div>

                  <p className="mt-3 text-xs text-muted leading-relaxed">{p.desc}</p>
                </div>

                {idx < 3 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted">
                    <ChevronRight size={18} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. COMPARISON TABLE: TRADITIONAL VS LANDWATCH */}
      {/* ======================================================== */}
      <section className="py-20 border-b border-line bg-base">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-ink">
              Why State Authorities Switch to LandWatch
            </h2>
            <p className="mt-2 text-sm text-muted">
              Eliminate patrol blind-spots, months of litigation delay, and unprovable encroachment claims.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-line bg-base text-muted font-mono text-xs uppercase">
                  <th className="p-4 sm:p-5">Capability / Metric</th>
                  <th className="p-4 sm:p-5 text-critical">Traditional Manual Patrols</th>
                  <th className="p-4 sm:p-5 text-accent bg-accent/5">LandWatch Command Center</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-ink">Detection Latency</td>
                  <td className="p-4 sm:p-5 text-muted">3 to 6 months (often post-construction)</td>
                  <td className="p-4 sm:p-5 text-accent font-semibold bg-accent/5">&lt; 30 seconds after satellite orbital pass</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-ink">Inspection Verifiability</td>
                  <td className="p-4 sm:p-5 text-muted">Paper logbooks easily lost or contested</td>
                  <td className="p-4 sm:p-5 text-accent font-semibold bg-accent/5">GPS-stamped photo evidence & immutable audit logs</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-ink">Protected Zone Awareness</td>
                  <td className="p-4 sm:p-5 text-muted">Ambiguous village revenue maps</td>
                  <td className="p-4 sm:p-5 text-accent font-semibold bg-accent/5">Ray-casting point-in-polygon automatic alerting</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-ink">Territorial Coverage</td>
                  <td className="p-4 sm:p-5 text-muted">Limited to accessible roads and foot trails</td>
                  <td className="p-4 sm:p-5 text-accent font-semibold bg-accent/5">100% continuous multi-temporal satellite scan</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-ink">Court Evidentiary Value</td>
                  <td className="p-4 sm:p-5 text-muted">Subjective witness testimonies</td>
                  <td className="p-4 sm:p-5 text-accent font-semibold bg-accent/5">Multi-year ESA Sentinel-2 time series proof</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. ONE-CLICK ROLE ACCESS / PERSONA LAUNCHER */}
      {/* ======================================================== */}
      <section id="demo-access" className="py-20 border-b border-line bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-accent uppercase tracking-wider mb-2">
              <UserCheck size={14} />
              <span>Interactive Role-Based Access</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-ink">
              Experience the Live Platform in Seconds
            </h2>
            <p className="mt-3 text-sm text-muted">
              Select your persona below to instantly authenticate and test-drive the dedicated workflow without typing credentials.
            </p>
          </div>

          {/* 3 Persona Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {PERSONAS.map((p) => {
              const isLaunching = launchingRole === p.role
              return (
                <div
                  key={p.role}
                  className="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between hover:border-accent transition-all shadow-xl"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-mono font-bold capitalize"
                        style={{
                          backgroundColor: `${p.badgeColor}20`,
                          color: p.badgeColor,
                        }}
                      >
                        {p.role}
                      </span>
                      <span className="text-[11px] font-mono text-muted">{p.email}</span>
                    </div>

                    <h3 className="mt-4 text-xl font-bold text-ink">{p.name}</h3>
                    <p className="mt-2 text-xs text-muted leading-relaxed">{p.tagline}</p>

                    <div className="mt-5 border-t border-line pt-4 space-y-2">
                      <div className="text-[11px] font-mono text-muted uppercase font-semibold">
                        Role Capabilities:
                      </div>
                      {p.features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-ink/90">
                          <Check size={13} className="text-accent shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-line">
                    <Button
                      variant="primary"
                      onClick={() => handleQuickLaunch(p)}
                      disabled={isLaunching}
                      className="w-full justify-center gap-2 font-semibold shadow-lg"
                    >
                      <span>{isLaunching ? 'Signing In…' : `Launch as ${p.name}`}</span>
                      <ArrowRight size={14} />
                    </Button>
                    <p className="text-center text-[10px] text-muted mt-2 font-mono">
                      Password: demo123 (Auto-Filled)
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 8. ENTERPRISE ARCHITECTURE & API TRANSPARENCY */}
      {/* ======================================================== */}
      <section id="architecture" className="py-20 border-b border-line bg-base">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-accent uppercase tracking-wider mb-2">
                <ShieldCheck size={14} />
                <span>Enterprise Grade Reliability</span>
              </div>
              <h2 className="text-3xl font-bold text-ink leading-tight">
                Dual-Driver Architecture: From Offline Demo to Sovereign Cloud
              </h2>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                LandWatch features a robust dual-driver service pattern. It runs completely offline with simulated Sentinel-2 imagery for instant hackathon demonstrations, and effortlessly switches to live government APIs with a single configuration flag.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <strong className="text-ink">Zero-Dependency Mock Engine:</strong> Runs offline in browser localStorage with realistic sub-second network simulation.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <strong className="text-ink">Strict Service-Level RBAC:</strong> Ownership validations and permission enforcement operate in both UI route guards and backend service wrappers.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent text-xs">
                    ✓
                  </div>
                  <div className="text-xs">
                    <strong className="text-ink">Client-Side Ray Casting:</strong> Real-time Turf-like point-in-polygon math recalculates protected alerts immediately when boundary polygons are drawn.
                  </div>
                </div>
              </div>
            </div>

            {/* Code / API Snippet Preview Card */}
            <div className="rounded-2xl border border-line bg-surface p-5 font-mono text-xs overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-line pb-3 text-muted">
                <span className="text-accent flex items-center gap-2">
                  <FileText size={14} />
                  <span>.env • Dual-Driver Configuration</span>
                </span>
                <span className="text-[10px] bg-base px-2 py-0.5 rounded border border-line">
                  REST API v1
                </span>
              </div>
              <pre className="mt-4 text-ink/80 text-[11px] leading-relaxed overflow-x-auto">
{`# Toggle live satellite backend or offline simulation
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://api.landwatch.gov.in/v1

# REST Endpoints matching the LandWatch Contract
POST /api/v1/changes/compare
GET  /api/v1/changes/jobs/:id
GET  /api/v1/alerts?type=new_construction&status=new
POST /api/v1/inspections/bulk
POST /api/v1/inspections/:id/finalize`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 9. BOTTOM CALL TO ACTION */}
      {/* ======================================================== */}
      <section className="py-20 bg-gradient-to-t from-surface to-base text-center relative overflow-hidden">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 border border-accent/40 text-accent mb-6 shadow-xl">
            <Radar size={32} className="animate-spin-slow" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink">
            Ready to Protect Public Land and Water Resources?
          </h2>
          <p className="mt-3 text-sm text-muted max-w-xl mx-auto">
            Test the live hackathon prototype right now. Explore the real-time dashboard, swipe through multi-temporal Sentinel-2 imagery, and see how field inspections are dispatched in seconds.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              onClick={() => handleQuickLaunch(PERSONAS[0])}
              className="gap-2 px-6 py-3.5 text-sm font-semibold shadow-xl shadow-accent/25 hover:scale-105"
            >
              <span>Enter Command Center as Officer</span>
              <ArrowRight size={16} />
            </Button>
            <Link
              to="/login"
              className="rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-medium text-ink hover:border-accent hover:text-accent transition-all"
            >
              Custom Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 10. FOOTER */}
      {/* ======================================================== */}
      <footer className="border-t border-line bg-surface py-12 text-xs text-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Radar size={18} className="text-accent" />
            <span className="font-semibold text-ink">LandWatch</span>
            <span className="text-[10px] text-muted">| &ldquo;See Change Before It Becomes Damage.&rdquo;</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#simulator" className="hover:text-ink transition-colors">
              Interactive Simulator
            </a>
            <a href="#pillars" className="hover:text-ink transition-colors">
              Threat Matrix
            </a>
            <a href="#demo-access" className="hover:text-ink transition-colors">
              Demo Accounts
            </a>
            <Link to="/login" className="hover:text-ink transition-colors">
              Login
            </Link>
          </div>

          <div className="text-center sm:text-right font-mono text-[11px]">
            ESA Sentinel-2 Constellation • Open Geospatial Consortium
          </div>
        </div>
      </footer>
    </div>
  )
}
