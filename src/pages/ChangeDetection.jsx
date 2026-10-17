import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImageOverlay } from 'react-leaflet'
import {
  GitCompare,
  Sliders,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Check,
  ShieldAlert,
  MapPin,
  PlusCircle,
  AlertTriangle,
  RotateCcw,
  Building2,
  Trees,
  Droplets,
  Pickaxe,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDebounce } from '../hooks/useDebounce.js'
import { useJobPolling } from '../hooks/useJobPolling.js'
import { areaService } from '../services/areaService.js'
import { zoneService } from '../services/zoneService.js'
import { changeService } from '../services/changeService.js'
import { inspectionService } from '../services/inspectionService.js'
import { userService } from '../services/userService.js'
import { allDetections } from '../services/mockStore.js'
import {
  Button,
  Drawer,
  Modal,
  SeverityBadge,
  StatusBadge,
  ConfidenceBadge,
  EmptyState,
  ErrorState,
  Skeleton,
  MapLegend,
  cx,
} from '../components/common/index.jsx'
import { SatelliteMap } from '../components/map/SatelliteMap.jsx'
import { ProtectedZoneLayer } from '../components/map/ProtectedZoneLayer.jsx'
import { ChangeOverlay } from '../components/map/ChangeOverlay.jsx'
import { BeforeAfterSlider } from '../components/map/BeforeAfterSlider.jsx'
import { SideBySideMaps } from '../components/map/SideBySideMaps.jsx'
import { DrawControl } from '../components/map/DrawControl.jsx'
import { formatArea, toHectares, formatDate, TYPE_LABEL } from '../utils/index.js'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'new_construction', label: 'New construction' },
  { id: 'vegetation_loss', label: 'Vegetation loss' },
  { id: 'water_shrinkage', label: 'Water shrinkage' },
  { id: 'sand_mining', label: 'Sand mining' },
]

const TYPE_ICONS = {
  new_construction: Building2,
  vegetation_loss: Trees,
  water_shrinkage: Droplets,
  sand_mining: Pickaxe,
}

const TYPE_COLORS = {
  new_construction: '#EF4444',
  vegetation_loss: '#F97316',
  water_shrinkage: '#3B82F6',
  sand_mining: '#F59E0B',
}

const STORAGE_KEY = 'lw_detect_settings'

// Canvas crop helper for drawer thumbnails with full tile fallback
function CanvasThumbnail({ imageUrl, areaBounds, coordinates, label }) {
  const canvasRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!imageUrl || !areaBounds || !coordinates || !coordinates.length) {
      setFailed(true)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const W = img.naturalWidth || 1024
        const H = img.naturalHeight || 768

        const [[s0, w0], [n0, e0]] = areaBounds
        const lngs = coordinates.map((p) => p[0])
        const lats = coordinates.map((p) => p[1])
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)

        const padLng = (maxLng - minLng) * 0.4 || 0.003
        const padLat = (maxLat - minLat) * 0.4 || 0.003

        const bMinLng = minLng - padLng
        const bMaxLng = maxLng + padLng
        const bMinLat = minLat - padLat
        const bMaxLat = maxLat + padLat

        const cropX = Math.max(0, Math.min(W, ((bMinLng - w0) / (e0 - w0)) * W))
        const cropY = Math.max(0, Math.min(H, ((n0 - bMaxLat) / (n0 - s0)) * H))
        const cropW = Math.max(10, Math.min(W - cropX, ((bMaxLng - bMinLng) / (e0 - w0)) * W))
        const cropH = Math.max(10, Math.min(H - cropY, ((bMaxLat - bMinLat) / (n0 - s0)) * H))

        canvas.width = 160
        canvas.height = 120
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 160, 120)
        setFailed(false)
      } catch {
        setFailed(true)
      }
    }
    img.onerror = () => setFailed(true)
    img.src = imageUrl
  }, [imageUrl, areaBounds, coordinates])

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-base">
      <div className="absolute top-1.5 left-2 z-10 text-[10px] font-semibold uppercase tracking-wider text-ink bg-base/85 px-1.5 py-0.5 rounded shadow">
        {label}
      </div>
      {failed ? (
        <img src={imageUrl} alt={label} className="h-28 w-full object-cover" />
      ) : (
        <canvas ref={canvasRef} className="h-28 w-full object-cover" />
      )}
    </div>
  )
}

export default function ChangeDetection() {
  const { user } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  // Retrieve saved settings from sessionStorage
  const savedSettings = useMemo(() => {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }, [])

  // Load Areas and Zones
  const { data: areas, loading: areasLoading, error: areasError, reload: reloadAreas } = useAsync(
    () => areaService.list(),
    []
  )
  const { data: zones } = useAsync(() => zoneService.list(), [])
  const { data: inspectors } = useAsync(() => userService.listInspectors(), [])

  // Panel state
  const [panelOpen, setPanelOpen] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [customArea, setCustomArea] = useState(null)

  // Settings State
  const [selectedAreaId, setSelectedAreaId] = useState(() => {
    return searchParams.get('areaId') || savedSettings?.areaId || 'area-upper-lake'
  })
  const [beforeDate, setBeforeDate] = useState(() => savedSettings?.beforeDate || '')
  const [afterDate, setAfterDate] = useState(() => savedSettings?.afterDate || '')
  const [category, setCategory] = useState(() => savedSettings?.category || 'all')
  const [minConfidence, setMinConfidence] = useState(() => savedSettings?.minConfidence ?? 60)
  const debouncedConfidence = useDebounce(minConfidence, 200)

  // Comparison & Display Modes
  const [mode, setMode] = useState('swipe') // 'swipe' | 'side-by-side' | 'overlay'
  const [overlayOpacity, setOverlayOpacity] = useState(70)
  const [showFiltered, setShowFiltered] = useState(false)
  const [qualityPopoverOpen, setQualityPopoverOpen] = useState(false)

  // Selected Detection for Details Drawer
  const [selectedDetection, setSelectedDetection] = useState(null)
  const [copiedCentroid, setCopiedCentroid] = useState(false)

  // Inspection Modal State
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false)
  const [inspectionPriority, setInspectionPriority] = useState('high')
  const [inspectionAssignee, setInspectionAssignee] = useState('')
  const [inspectionDueDate, setInspectionDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [inspectionNotes, setInspectionNotes] = useState('Verify extent of change and check permits.')
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false)

  // Job Polling
  const {
    status: jobStatus,
    stage: jobStage,
    progress: jobProgress,
    error: jobError,
    result: jobResult,
    startJob,
    cancel: cancelJob,
  } = useJobPolling()

  // Current active area definition
  const currentArea = useMemo(() => {
    if (selectedAreaId === 'custom' && customArea) {
      return {
        id: 'custom',
        name: 'Custom Drawn Area',
        areaKm2: customArea.areaKm2,
        bounds: customArea.bounds,
        imageryDates: areas?.[0]?.imageryDates || ['2023-03-12', '2023-10-20', '2024-02-18'],
      }
    }
    return areas?.find((a) => a.id === selectedAreaId) || areas?.[0]
  }, [areas, selectedAreaId, customArea])

  // Initialize and validate dates whenever area changes
  useEffect(() => {
    if (!currentArea) return
    const dates = currentArea.imageryDates || []
    if (dates.length >= 2) {
      // Check if current before/after dates exist in currentArea.imageryDates
      const validBefore = dates.includes(beforeDate) ? beforeDate : dates[Math.max(0, dates.length - 3)]
      const validAfter = dates.includes(afterDate) ? afterDate : dates[dates.length - 1]
      setBeforeDate(validBefore)
      setAfterDate(validAfter)
    }
  }, [currentArea, beforeDate, afterDate])

  // Persist settings in sessionStorage
  useEffect(() => {
    if (selectedAreaId && beforeDate && afterDate) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            areaId: selectedAreaId,
            beforeDate,
            afterDate,
            category,
            minConfidence,
          })
        )
      } catch {
        // Ignored
      }
    }
  }, [selectedAreaId, beforeDate, afterDate, category, minConfidence])

  // Validate dates: before < after
  const dateError = useMemo(() => {
    if (!beforeDate || !afterDate) return null
    if (beforeDate >= afterDate) {
      return 'Before date must be earlier than after date'
    }
    return null
  }, [beforeDate, afterDate])

  // Comparison handler
  const handleRunCompare = useCallback(
    async (overrideParams) => {
      if (dateError) return
      const area = overrideParams?.areaId || selectedAreaId
      const bDate = overrideParams?.beforeDate || beforeDate
      const aDate = overrideParams?.afterDate || afterDate

      try {
        const { jobId } = await changeService.compare({
          areaId: area,
          beforeDate: bDate,
          afterDate: aDate,
        })
        startJob(jobId)
      } catch (err) {
        toast.push(err.message || 'Failed to start comparison', 'error')
      }
    },
    [dateError, selectedAreaId, beforeDate, afterDate, startJob, toast]
  )

  // Handle Deep Link: /detect?detectionId=...&areaId=...
  useEffect(() => {
    const deepDetectionId = searchParams.get('detectionId')

    if (deepDetectionId && areas && areas.length > 0) {
      const all = allDetections()
      const target = all.find((f) => f.properties.id === deepDetectionId)
      if (target) {
        const p = target.properties
        setSelectedAreaId(p.areaId)
        setBeforeDate(p.beforeDate)
        setAfterDate(p.afterDate)
        setSelectedDetection(target)
        // Run comparison with deep link params
        handleRunCompare({
          areaId: p.areaId,
          beforeDate: p.beforeDate,
          afterDate: p.afterDate,
        })
      }
    } else if (!jobResult && !jobStatus.includes('processing') && areas && areas.length > 0) {
      // Auto-run first comparison on initial load
      handleRunCompare()
    }
  }, [areas, searchParams, handleRunCompare, jobResult, jobStatus])


  // Active detections from jobResult or fallback
  const allResultDetections = useMemo(() => {
    if (jobResult?.detections?.features) {
      return jobResult.detections.features
    }
    return []
  }, [jobResult])

  // Summary strip statistics
  const summary = useMemo(() => {
    const active = allResultDetections.filter((f) => {
      const p = f.properties
      if (p.flaggedAs && !showFiltered) return false
      if (category !== 'all' && p.type !== category) return false
      if (p.confidence < debouncedConfidence) return false
      return true
    })

    const totalCount = active.length
    const totalArea = active.reduce((acc, f) => acc + f.properties.areaSqm, 0)
    const inProtected = active.filter((f) => f.properties.inProtectedZone).length

    const typeCounts = {
      new_construction: 0,
      vegetation_loss: 0,
      water_shrinkage: 0,
      sand_mining: 0,
    }
    active.forEach((f) => {
      if (typeCounts[f.properties.type] !== undefined) {
        typeCounts[f.properties.type]++
      }
    })

    return {
      totalCount,
      totalArea,
      inProtected,
      typeCounts,
    }
  }, [allResultDetections, category, debouncedConfidence, showFiltered])

  // Copy centroid to clipboard
  const handleCopyCentroid = (coords) => {
    if (!coords) return
    const text = `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`
    navigator.clipboard.writeText(text)
    setCopiedCentroid(true)
    toast.push('Coordinates copied to clipboard', 'success')
    setTimeout(() => setCopiedCentroid(false), 2000)
  }

  // Create Inspection Submit
  const handleCreateInspection = async (e) => {
    e.preventDefault()
    if (!selectedDetection || !inspectionAssignee) {
      toast.push('Please select an inspector', 'error')
      return
    }

    setIsSubmittingInspection(true)
    try {
      const p = selectedDetection.properties
      const newIns = await inspectionService.create({
        detectionId: p.id,
        areaId: p.areaId,
        locationName: p.locationName,
        type: p.type,
        priority: inspectionPriority,
        assigneeId: inspectionAssignee,
        dueDate: inspectionDueDate,
        notes: inspectionNotes,
      })

      // Update detection status locally
      p.status = 'under_inspection'
      toast.push('Inspection created successfully', 'success', {
        to: `/inspections?id=${newIns.id}`,
        label: 'View inspection',
      })
      setInspectionModalOpen(false)
    } catch (err) {
      toast.push(err.message || 'Failed to create inspection', 'error')
    } finally {
      setIsSubmittingInspection(false)
    }
  }

  // Set default inspector when inspector modal opens
  useEffect(() => {
    if (inspectors && inspectors.length > 0 && !inspectionAssignee) {
      setInspectionAssignee(inspectors[0].id)
    }
  }, [inspectors, inspectionAssignee])

  if (areasLoading) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <div className="flex flex-1 gap-4">
          <Skeleton className="h-full w-80" />
          <Skeleton className="h-full flex-1" />
        </div>
      </div>
    )
  }

  if (areasError) {
    return <ErrorState error={areasError} onRetry={reloadAreas} />
  }

  const isProcessing = jobStatus === 'processing' || jobStatus === 'pending'
  const isFailed = jobStatus === 'failed'

  return (
    <div className="relative flex h-[calc(100vh-5.5rem)] flex-col gap-3 overflow-hidden">
      {/* Top Header / Mode Switcher Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink hover:bg-line transition-colors"
          >
            {panelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            <span>Controls</span>
          </button>
          <div className="h-4 w-[1px] bg-line" />
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <span className="text-muted">Area:</span>
            <span>{currentArea?.name}</span>
            <span className="font-mono text-muted">({currentArea?.areaKm2} km²)</span>
          </div>
        </div>

        {/* Comparison Modes Segmented Control */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-line bg-base p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('swipe')}
              className={cx(
                'rounded-lg px-3 py-1 font-medium transition-colors',
                mode === 'swipe' ? 'bg-accent text-base font-semibold' : 'text-muted hover:text-ink'
              )}
            >
              Swipe
            </button>
            <button
              type="button"
              onClick={() => setMode('side-by-side')}
              className={cx(
                'rounded-lg px-3 py-1 font-medium transition-colors',
                mode === 'side-by-side' ? 'bg-accent text-base font-semibold' : 'text-muted hover:text-ink'
              )}
            >
              Side-by-side
            </button>
            <button
              type="button"
              onClick={() => setMode('overlay')}
              className={cx(
                'rounded-lg px-3 py-1 font-medium transition-colors',
                mode === 'overlay' ? 'bg-accent text-base font-semibold' : 'text-muted hover:text-ink'
              )}
            >
              Overlay
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace: Left Controls + Right Map */}
      <div className="relative flex min-h-0 flex-1 gap-3">
        {/* C1. Control Panel (320px, collapsible, bottom-sheet on mobile) */}
        {panelOpen && (
          <aside className="absolute inset-y-0 left-0 z-30 flex w-full flex-col border border-line bg-surface p-4 shadow-2xl md:relative md:w-80 md:rounded-xl md:shadow-none animate-slide">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="flex items-center gap-2 font-semibold text-sm text-ink">
                <Sliders size={16} className="text-accent" />
                <span>Detection Parameters</span>
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-line md:hidden"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto py-3 pr-1 text-xs">
              {/* Area Selection & Draw Custom Area */}
              <div>
                <label className="mb-1 block font-medium text-muted">Monitored Area</label>
                <div className="space-y-1.5">
                  <select
                    value={selectedAreaId}
                    onChange={(e) => {
                      setSelectedAreaId(e.target.value)
                      if (e.target.value !== 'custom') {
                        setIsDrawing(false)
                      }
                    }}
                    className="w-full rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink"
                  >
                    {(areas || []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.areaKm2} km²)
                      </option>
                    ))}
                    {customArea && <option value="custom">Custom drawn ({customArea.areaKm2} km²)</option>}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawing(!isDrawing)
                      if (!isDrawing) {
                        setSelectedAreaId('custom')
                      }
                    }}
                    className={cx(
                      'flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                      isDrawing
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-line bg-base hover:bg-line text-muted hover:text-ink'
                    )}
                  >
                    <MapPin size={13} />
                    <span>{isDrawing ? 'Drawing active (Click map)' : 'Draw custom area'}</span>
                  </button>
                </div>
              </div>

              {/* Imagery Dates */}
              <div className="space-y-2">
                <label className="block font-medium text-muted">Comparison Dates</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="mb-1 block text-[11px] text-muted">Before Date</span>
                    <select
                      value={beforeDate}
                      onChange={(e) => setBeforeDate(e.target.value)}
                      className="w-full rounded-xl border border-line bg-base px-2.5 py-1.5 text-xs text-ink"
                    >
                      {(currentArea?.imageryDates || []).map((d) => (
                        <option key={d} value={d}>
                          {formatDate(d)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="mb-1 block text-[11px] text-muted">After Date</span>
                    <select
                      value={afterDate}
                      onChange={(e) => setAfterDate(e.target.value)}
                      className="w-full rounded-xl border border-line bg-base px-2.5 py-1.5 text-xs text-ink"
                    >
                      {(currentArea?.imageryDates || []).map((d) => (
                        <option key={d} value={d}>
                          {formatDate(d)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {dateError && (
                  <p className="flex items-center gap-1.5 rounded-lg border border-critical/30 bg-critical/10 p-2 text-[11px] text-critical">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{dateError}</span>
                  </p>
                )}
              </div>

              {/* Category Chips */}
              <div>
                <label className="mb-2 block font-medium text-muted">Change Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={cx(
                        'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                        category === cat.id
                          ? 'border-accent bg-accent/20 text-accent font-semibold'
                          : 'border-line bg-base text-muted hover:border-line/80 hover:text-ink'
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Confidence Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-muted">Min Confidence</label>
                  <span className="font-mono font-semibold text-accent">{minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Overlay Opacity Slider (Only in overlay mode) */}
              {mode === 'overlay' && (
                <div className="space-y-1.5 rounded-xl border border-line bg-base p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted">After Layer Opacity</span>
                    <span className="font-mono text-ink">{overlayOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Stepper / Progress / Compare Button */}
            <div className="border-t border-line pt-3">
              {isProcessing && (
                <div className="space-y-2 mb-3 rounded-xl border border-line bg-base p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-accent animate-pulse">{jobStage}…</span>
                    <span className="font-mono text-muted">{jobProgress}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${jobProgress}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={cancelJob}
                    className="mt-1 w-full rounded-lg border border-line bg-surface py-1 text-xs text-muted hover:text-critical hover:border-critical/40 transition-colors"
                  >
                    Cancel comparison
                  </button>
                </div>
              )}

              {isFailed && (
                <div className="mb-3 rounded-xl border border-critical/40 bg-critical/10 p-3 text-xs">
                  <div className="flex items-center gap-2 text-critical font-medium">
                    <AlertTriangle size={15} />
                    <span>{jobError || 'Job processing error'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRunCompare()}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-critical px-3 py-1.5 font-medium text-white hover:brightness-110"
                  >
                    <RotateCcw size={13} />
                    <span>Retry Comparison</span>
                  </button>
                </div>
              )}

              <Button
                variant="primary"
                onClick={() => handleRunCompare()}
                disabled={!!dateError || isProcessing}
                loading={isProcessing}
                className="w-full py-2.5 font-semibold shadow-lg shadow-accent/10"
              >
                <GitCompare size={16} />
                <span>Run Comparison</span>
              </Button>
            </div>
          </aside>
        )}

        {/* Map Container & Comparison Modes */}
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
          {/* C5. Results Summary Strip & C6. Data Quality Chip */}
          <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/90 px-4 py-2 backdrop-blur">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <span className="font-mono font-bold text-accent text-sm">{summary.totalCount}</span>
                <span className="text-muted">changes detected</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <span className="font-mono text-sm">{formatArea(summary.totalArea)}</span>
                <span className="text-muted">({toHectares(summary.totalArea)})</span>
              </div>
              {summary.inProtected > 0 && (
                <div className="flex items-center gap-1.5 rounded-md border border-critical/40 bg-critical/10 px-2 py-0.5 text-xs font-semibold text-critical">
                  <span>{summary.inProtected} inside protected zones</span>
                </div>
              )}

              {/* Category Counts with Colored Dots */}
              <div className="hidden sm:flex items-center gap-3 border-l border-line pl-3 text-[11px] text-muted">
                {Object.entries(summary.typeCounts).map(([type, count]) => (
                  <span key={type} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                    <span className="font-mono text-ink">{count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* C6. Data Quality Chip & Popover */}
            <div className="relative">
              {jobResult?.filteredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setQualityPopoverOpen(!qualityPopoverOpen)}
                  className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <ShieldAlert size={13} />
                  <span>Filtered {jobResult.filteredCount} possible false changes</span>
                  {qualityPopoverOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}

              {qualityPopoverOpen && jobResult?.filteredCount > 0 && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-line bg-surface p-3 shadow-2xl animate-slide">
                  <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                    <span className="text-xs font-semibold text-ink">Quality Filtering</span>
                    <button
                      type="button"
                      onClick={() => setQualityPopoverOpen(false)}
                      className="text-muted hover:text-ink"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mb-2.5">
                    Machine learning model filtered out suspicious non-actionable changes:
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Cloud / Shadow:</span>
                      <span className="font-mono text-ink">{jobResult.reasonBreakdown?.cloud || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Seasonal variation:</span>
                      <span className="font-mono text-ink">{jobResult.reasonBreakdown?.seasonal || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Sensor misalignment:</span>
                      <span className="font-mono text-ink">{jobResult.reasonBreakdown?.misalignment || 0}</span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-line pt-2.5">
                    <label className="flex cursor-pointer items-center justify-between text-xs text-ink">
                      <span>Show filtered changes</span>
                      <input
                        type="checkbox"
                        checked={showFiltered}
                        onChange={(e) => setShowFiltered(e.target.checked)}
                        className="rounded border-line bg-base text-accent focus:ring-accent"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Area */}
          <div className="relative flex-1">
            {allResultDetections.length === 0 && !isProcessing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-base/60 backdrop-blur-sm pointer-events-none">
                <EmptyState
                  title="No changes found"
                  message="No verified surface changes detected between these dates."
                  action={
                    <Button
                      variant="secondary"
                      className="pointer-events-auto mt-2"
                      onClick={() => handleRunCompare()}
                    >
                      Compare different dates
                    </Button>
                  }
                />
              </div>
            )}

            {/* Mode 1: SWIPE MODE */}
            {mode === 'swipe' && (
              <SatelliteMap bounds={currentArea?.bounds} className="h-full w-full">
                {currentArea?.bounds && beforeDate && afterDate && (
                  <BeforeAfterSlider
                    areaId={currentArea.id}
                    beforeDate={beforeDate}
                    afterDate={afterDate}
                    bounds={currentArea.bounds}
                  />
                )}
                <ProtectedZoneLayer zones={zones || []} />
                <ChangeOverlay
                  features={allResultDetections}
                  selectedId={selectedDetection?.properties?.id}
                  onSelect={(f) => setSelectedDetection(f)}
                  category={category}
                  minConfidence={debouncedConfidence}
                  showFiltered={showFiltered}
                />
                <DrawControl
                  active={isDrawing}
                  onAreaDrawn={(area) => {
                    setCustomArea(area)
                    setSelectedAreaId('custom')
                    setIsDrawing(false)
                    toast.push(`Custom area defined: ${area.areaKm2} km²`, 'success')
                  }}
                  onCancel={() => setIsDrawing(false)}
                />
              </SatelliteMap>
            )}

            {/* Mode 2: SIDE-BY-SIDE MODE */}
            {mode === 'side-by-side' && (
              <SideBySideMaps
                areaId={currentArea?.id}
                beforeDate={beforeDate}
                afterDate={afterDate}
                bounds={currentArea?.bounds}
                zones={zones || []}
                detections={allResultDetections}
                selectedId={selectedDetection?.properties?.id}
                onSelect={(f) => setSelectedDetection(f)}
                category={category}
                minConfidence={debouncedConfidence}
                showFiltered={showFiltered}
              />
            )}

            {/* Mode 3: OVERLAY MODE */}
            {mode === 'overlay' && (
              <SatelliteMap bounds={currentArea?.bounds} className="h-full w-full">
                {currentArea?.bounds && beforeDate && (
                  <ImageOverlay
                    url={`/tiles/${currentArea.id}/${beforeDate}.jpg`}
                    bounds={currentArea.bounds}
                    opacity={1}
                  />
                )}
                {currentArea?.bounds && afterDate && (
                  <ImageOverlay
                    url={`/tiles/${currentArea.id}/${afterDate}.jpg`}
                    bounds={currentArea.bounds}
                    opacity={overlayOpacity / 100}
                  />
                )}
                <ProtectedZoneLayer zones={zones || []} />
                <ChangeOverlay
                  features={allResultDetections}
                  selectedId={selectedDetection?.properties?.id}
                  onSelect={(f) => setSelectedDetection(f)}
                  category={category}
                  minConfidence={debouncedConfidence}
                  showFiltered={showFiltered}
                />
                <DrawControl
                  active={isDrawing}
                  onAreaDrawn={(area) => {
                    setCustomArea(area)
                    setSelectedAreaId('custom')
                    setIsDrawing(false)
                    toast.push(`Custom area defined: ${area.areaKm2} km²`, 'success')
                  }}
                  onCancel={() => setIsDrawing(false)}
                />
              </SatelliteMap>
            )}

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 z-[900]">
              <MapLegend />
            </div>
          </div>
        </div>
      </div>

      {/* C4. Details Drawer (Right side, focus trapped, Escape closes) */}
      <Drawer
        open={!!selectedDetection}
        onClose={() => setSelectedDetection(null)}
        title={selectedDetection?.properties?.locationName || 'Detection Details'}
      >
        {selectedDetection && (
          <div className="space-y-5 text-sm">
            {/* Header / Type / Badges */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${TYPE_COLORS[selectedDetection.properties.type]}22`,
                    color: TYPE_COLORS[selectedDetection.properties.type],
                  }}
                >
                  {(() => {
                    const Icon = TYPE_ICONS[selectedDetection.properties.type] || Building2
                    return <Icon size={16} />
                  })()}
                </span>
                <span className="font-semibold text-ink">
                  {TYPE_LABEL[selectedDetection.properties.type] || selectedDetection.properties.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selectedDetection.properties.severity} />
                <StatusBadge status={selectedDetection.properties.status} />
              </div>
            </div>

            {/* Area and Confidence Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-base p-3">
                <span className="text-xs text-muted">Surface Area</span>
                <p className="mt-1 font-mono text-base font-bold text-ink">
                  {formatArea(selectedDetection.properties.areaSqm)}
                </p>
                <span className="text-xs text-muted">({toHectares(selectedDetection.properties.areaSqm)})</span>
              </div>
              <div className="rounded-xl border border-line bg-base p-3">
                <span className="text-xs text-muted">Algorithm Confidence</span>
                <div className="mt-1">
                  <ConfidenceBadge value={selectedDetection.properties.confidence} />
                </div>
              </div>
            </div>

            {/* Protected Zone Overlap Banner */}
            <div
              className={cx(
                'rounded-xl border p-3 text-xs',
                selectedDetection.properties.inProtectedZone
                  ? 'border-critical/50 bg-critical/10 text-ink'
                  : 'border-line bg-base text-muted'
              )}
            >
              <div className="flex items-center justify-between font-semibold">
                <span>Protected Zone Overlap</span>
                {selectedDetection.properties.inProtectedZone ? (
                  <span className="rounded bg-critical px-2 py-0.5 text-[10px] font-bold text-white tracking-wider">
                    PROTECTED ZONE
                  </span>
                ) : (
                  <span>None</span>
                )}
              </div>
              {selectedDetection.properties.inProtectedZone && (
                <div className="mt-1.5 space-y-0.5 text-xs">
                  <p>
                    <span className="text-muted">Zone Name:</span>{' '}
                    <span className="font-medium text-ink">{selectedDetection.properties.zoneName}</span>
                  </p>
                  <p>
                    <span className="text-muted">Zone ID:</span>{' '}
                    <span className="font-mono text-ink">{selectedDetection.properties.zoneId}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Before / After Cropped Thumbnails */}
            <div>
              <span className="mb-2 block font-medium text-xs text-muted">Change Observation Window</span>
              <div className="grid grid-cols-2 gap-2">
                <CanvasThumbnail
                  imageUrl={`/tiles/${selectedDetection.properties.areaId}/${selectedDetection.properties.beforeDate}.jpg`}
                  areaBounds={currentArea?.bounds}
                  coordinates={selectedDetection.geometry?.coordinates?.[0]}
                  label={`BEFORE ${formatDate(selectedDetection.properties.beforeDate)}`}
                />
                <CanvasThumbnail
                  imageUrl={`/tiles/${selectedDetection.properties.areaId}/${selectedDetection.properties.afterDate}.jpg`}
                  areaBounds={currentArea?.bounds}
                  coordinates={selectedDetection.geometry?.coordinates?.[0]}
                  label={`AFTER ${formatDate(selectedDetection.properties.afterDate)}`}
                />
              </div>
            </div>

            {/* Centroid Coordinates with Copy */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-base p-3">
              <div>
                <span className="text-xs text-muted">Centroid Coordinates</span>
                <p className="font-mono text-xs text-ink mt-0.5">
                  {selectedDetection.properties.centroid
                    ? `${selectedDetection.properties.centroid[1].toFixed(6)}° N, ${selectedDetection.properties.centroid[0].toFixed(6)}° E`
                    : 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCentroid(selectedDetection.properties.centroid)}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-line transition-colors"
              >
                {copiedCentroid ? <Check size={14} className="text-resolved" /> : <Copy size={14} />}
                <span>{copiedCentroid ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Officer / Admin Action: Create Inspection */}
            {user?.role !== 'inspector' && (
              <div className="border-t border-line pt-4">
                <Button
                  variant="primary"
                  onClick={() => setInspectionModalOpen(true)}
                  className="w-full font-semibold"
                >
                  <PlusCircle size={16} />
                  <span>Create Inspection</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Inspection Modal */}
      <Modal
        open={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        title="Schedule Site Inspection"
      >
        <form onSubmit={handleCreateInspection} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-muted">Location & Target Detection</label>
            <p className="rounded-xl border border-line bg-base p-2.5 font-medium text-ink">
              {selectedDetection?.properties?.locationName} ({selectedDetection?.properties?.id}) ·{' '}
              {formatArea(selectedDetection?.properties?.areaSqm || 0)}
            </p>
          </div>

          <div>
            <label className="mb-1 block font-medium text-muted">Assign Inspector</label>
            <select
              value={inspectionAssignee}
              onChange={(e) => setInspectionAssignee(e.target.value)}
              required
              className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
            >
              {(inspectors || []).map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name} ({ins.email})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-muted">Priority</label>
              <select
                value={inspectionPriority}
                onChange={(e) => setInspectionPriority(e.target.value)}
                className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-muted">Due Date</label>
              <input
                type="date"
                value={inspectionDueDate}
                onChange={(e) => setInspectionDueDate(e.target.value)}
                required
                className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-muted">Inspection Notes</label>
            <textarea
              rows={3}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
              placeholder="Provide context or instructions for field officer..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setInspectionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmittingInspection}
            >
              Assign & Create Inspection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
