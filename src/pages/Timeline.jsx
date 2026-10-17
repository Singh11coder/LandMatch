import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOverlay, useMap } from 'react-leaflet'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceDot,
} from 'recharts'
import {
  History,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  GitCompare,
  Layers,
  MapPin,
  ExternalLink,
  Calendar,
  Sparkles,
  Building2,
  Trees,
  Droplets,
  Pickaxe,
} from 'lucide-react'
import { useAsync } from '../hooks/useAsync.js'
import { areaService } from '../services/areaService.js'
import { zoneService } from '../services/zoneService.js'
import { timelineService } from '../services/timelineService.js'
import { allDetections } from '../services/mockStore.js'
import {
  Button,
  Badge,
  SeverityBadge,
  ConfidenceBadge,
  Skeleton,
  EmptyState,
  ErrorState,
  cx,
} from '../components/common/index.jsx'
import { SatelliteMap } from '../components/map/SatelliteMap.jsx'
import { ProtectedZoneLayer } from '../components/map/ProtectedZoneLayer.jsx'
import { ChangeOverlay } from '../components/map/ChangeOverlay.jsx'
import { BeforeAfterSlider } from '../components/map/BeforeAfterSlider.jsx'
import { formatArea, toHectares, formatDate, TYPE_LABEL } from '../utils/index.js'

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

function MapFlyTo({ targetCentroid }) {
  const map = useMap()
  useEffect(() => {
    if (targetCentroid && Array.isArray(targetCentroid) && targetCentroid.length >= 2) {
      map.flyTo([targetCentroid[1], targetCentroid[0]], 15, { duration: 1.2 })
    }
  }, [map, targetCentroid])
  return null
}

export default function Timeline() {
  const navigate = useNavigate()

  // Load Areas and Zones
  const { data: areas, loading: areasLoading, error: areasError, reload: reloadAreas } = useAsync(
    () => areaService.list(),
    []
  )
  const { data: zones } = useAsync(() => zoneService.list(), [])

  // Area Selection
  const [selectedAreaId, setSelectedAreaId] = useState('area-upper-lake')
  const currentArea = useMemo(() => {
    return (areas || []).find((a) => a.id === selectedAreaId) || areas?.[0]
  }, [areas, selectedAreaId])

  // Load Timeline Data for selected area
  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
    reload: reloadTimeline,
  } = useAsync(() => timelineService.get(selectedAreaId), [selectedAreaId])

  const imageryDates = useMemo(() => {
    return currentArea?.imageryDates || []
  }, [currentArea])

  // Active Date Index (0 to imageryDates.length - 1)
  const [dateIndex, setDateIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1) // 1x = 1500ms, 2x = 750ms
  const [comparePrevious, setComparePrevious] = useState(false)
  const [selectedDetectionId, setSelectedDetectionId] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)

  const timerRef = useRef(null)

  // Reset index when area changes
  useEffect(() => {
    setIsPlaying(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setDateIndex(imageryDates.length ? imageryDates.length - 1 : 0)
    setSelectedDetectionId(null)
    setFlyTarget(null)
  }, [selectedAreaId, imageryDates.length])

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !imageryDates.length) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const intervalMs = playbackSpeed === 2 ? 750 : 1500

    timerRef.current = setInterval(() => {
      setDateIndex((prev) => {
        if (prev >= imageryDates.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, intervalMs)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPlaying, playbackSpeed, imageryDates.length])

  const selectedDate = imageryDates[dateIndex] || ''
  const previousDate = dateIndex > 0 ? imageryDates[dateIndex - 1] : imageryDates[0]

  // Detections for current area
  const areaDetections = useMemo(() => {
    return allDetections().filter(
      (d) => d.properties.areaId === selectedAreaId && !d.properties.flaggedAs
    )
  }, [selectedAreaId])

  // Detections active up to the selected date
  const activeDetections = useMemo(() => {
    if (!selectedDate) return []
    return areaDetections.filter((d) => d.properties.afterDate <= selectedDate)
  }, [areaDetections, selectedDate])

  // Newly appearing detections at this exact observation step
  const newDetections = useMemo(() => {
    if (!selectedDate) return []
    return areaDetections.filter((d) => d.properties.afterDate === selectedDate)
  }, [areaDetections, selectedDate])

  // Chart data: Cumulative changed area
  const chartData = useMemo(() => {
    return (timelineData || []).map((step) => ({
      date: formatDate(step.date),
      rawDate: step.date,
      sqm: step.cumulativeAreaSqm,
      ha: +(step.cumulativeAreaSqm / 10000).toFixed(2),
    }))
  }, [timelineData])

  const activeChartPoint = useMemo(() => {
    return chartData.find((pt) => pt.rawDate === selectedDate)
  }, [chartData, selectedDate])

  const handleFlyToDetection = (det) => {
    setSelectedDetectionId(det.properties.id)
    if (det.properties.centroid) {
      setFlyTarget(det.properties.centroid)
    }
  }

  if (areasLoading || timelineLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-[520px] lg:col-span-2" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    )
  }

  if (areasError || timelineError) {
    return <ErrorState error={areasError || timelineError} onRetry={() => { reloadAreas(); reloadTimeline(); }} />
  }

  if (!imageryDates.length) {
    return (
      <EmptyState
        title="No historical imagery found"
        message="Insufficient temporal observation dates available for this area."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls Strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-line bg-surface p-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-ink">
            <History className="text-accent" size={22} />
            <span>Historical Land Timeline</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Temporal change progression, cumulative impact curves, and chronological evidence tracking.
          </p>
        </div>

        {/* Area Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted">Monitored Area:</label>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="rounded-xl border border-line bg-base px-3 py-1.5 text-xs text-ink font-semibold"
          >
            {(areas || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.areaKm2} km²)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Timeline Sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left Map Column (2 cols) */}
        <div className="relative flex flex-col h-[600px] overflow-hidden rounded-xl border border-line bg-surface lg:col-span-2">
          {/* Top Status Banner */}
          <div className="z-10 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur text-xs">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Calendar size={14} className="text-accent" />
              <span>Observation Date:</span>
              <span className="font-mono text-accent text-sm">{formatDate(selectedDate)}</span>
            </div>

            {/* Compare with previous toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComparePrevious(!comparePrevious)}
                disabled={dateIndex === 0}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                  comparePrevious
                    ? 'border-accent bg-accent/20 text-accent font-semibold'
                    : 'border-line bg-base text-muted hover:text-ink'
                )}
              >
                <GitCompare size={13} />
                <span>Swipe vs Previous</span>
              </button>
            </div>
          </div>

          {/* Map Surface */}
          <div className="relative flex-1">
            <SatelliteMap bounds={currentArea?.bounds} className="h-full w-full">
              {flyTarget && <MapFlyTo targetCentroid={flyTarget} />}

              {/* Compare Mode vs Single Date Overlay */}
              {comparePrevious && dateIndex > 0 ? (
                <BeforeAfterSlider
                  areaId={selectedAreaId}
                  beforeDate={previousDate}
                  afterDate={selectedDate}
                  bounds={currentArea?.bounds}
                />
              ) : (
                currentArea?.bounds && selectedDate && (
                  <ImageOverlay
                    url={`/tiles/${selectedAreaId}/${selectedDate}.jpg`}
                    bounds={currentArea.bounds}
                    opacity={1}
                  />
                )
              )}

              {/* Protected Zones */}
              <ProtectedZoneLayer zones={zones || []} />

              {/* Detections up to current date */}
              <ChangeOverlay
                features={activeDetections}
                selectedId={selectedDetectionId}
                onSelect={(f) => setSelectedDetectionId(f.properties.id)}
                category="all"
                minConfidence={0}
                showFiltered={false}
              />
            </SatelliteMap>

            {/* Newly appeared detections indicator */}
            {newDetections.length > 0 && (
              <div className="pointer-events-none absolute top-3 left-3 z-[900] flex items-center gap-2 rounded-xl border border-accent bg-surface/90 px-3 py-1.5 text-xs text-ink shadow-lg backdrop-blur animate-slide">
                <Sparkles size={14} className="text-accent animate-pulse" />
                <span>
                  <strong className="font-mono text-accent">{newDetections.length}</strong> new change
                  {newDetections.length > 1 ? 's' : ''} detected on this date
                </span>
              </div>
            )}
          </div>

          {/* Bottom Timeline Slider & Playback Controls */}
          <div className="border-t border-line bg-surface p-4 text-xs">
            {/* Slider with Ticks */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>{formatDate(imageryDates[0])}</span>
                <span className="font-mono text-ink font-semibold">
                  Step {dateIndex + 1} of {imageryDates.length}
                </span>
                <span>{formatDate(imageryDates[imageryDates.length - 1])}</span>
              </div>

              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={imageryDates.length - 1}
                  step={1}
                  value={dateIndex}
                  onChange={(e) => {
                    setIsPlaying(false)
                    setDateIndex(Number(e.target.value))
                  }}
                  className="w-full accent-accent cursor-pointer"
                />

                {/* Visible tick marks */}
                <div className="mt-1 flex justify-between px-1">
                  {imageryDates.map((date, idx) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setIsPlaying(false)
                        setDateIndex(idx)
                      }}
                      className={cx(
                        'text-[10px] font-mono transition-colors hover:text-ink',
                        idx === dateIndex ? 'font-bold text-accent' : 'text-muted'
                      )}
                    >
                      {new Date(date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Playback Controls Strip */}
            <div className="flex items-center justify-between pt-2 border-t border-line/60">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="py-1 px-3 text-xs"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
                </Button>

                <button
                  type="button"
                  onClick={() => setDateIndex(0)}
                  title="Rewind to start"
                  className="rounded-lg border border-line bg-base p-1.5 text-muted hover:text-ink hover:bg-line transition-colors"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
                  className={cx(
                    'rounded-lg border px-2.5 py-1 text-xs font-mono font-medium transition-colors',
                    playbackSpeed === 2
                      ? 'border-accent bg-accent/20 text-accent font-bold'
                      : 'border-line bg-base text-muted hover:text-ink'
                  )}
                >
                  {playbackSpeed}x Speed
                </button>
              </div>

              <div className="text-muted text-[11px] font-mono">
                Active alerts: <strong className="text-ink">{activeDetections.length}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Cumulative Impact Chart & Event Feed (1 col) */}
        <div className="flex flex-col h-[600px] gap-4">
          {/* Cumulative Changed Area Chart */}
          <div className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <div className="mb-2">
              <h2 className="text-xs font-semibold text-ink">Cumulative Land Footprint</h2>
              <p className="text-[11px] text-muted">Total disturbed surface area over time</p>
            </div>

            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#8A949C" fontSize={10} tickLine={false} />
                  <YAxis stroke="#8A949C" fontSize={10} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#171B1F',
                      borderColor: '#232A30',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#E6EAED',
                    }}
                    formatter={(val) => [`${val} ha (${formatArea(val * 10000)})`, 'Changed Area']}
                  />
                  <Line
                    type="monotone"
                    dataKey="ha"
                    stroke="#22D3EE"
                    strokeWidth={2}
                    dot={{ fill: '#22D3EE', r: 3 }}
                    activeDot={{ r: 5, fill: '#FFFFFF' }}
                  />
                  {activeChartPoint && (
                    <ReferenceDot
                      x={activeChartPoint.date}
                      y={activeChartPoint.ha}
                      r={6}
                      fill="#EF4444"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chronological Changes Feed */}
          <div className="flex flex-1 flex-col rounded-xl border border-line bg-surface p-4 min-h-0">
            <div className="flex items-center justify-between border-b border-line pb-2.5 mb-2">
              <div>
                <h2 className="text-xs font-semibold text-ink">Change Catalog</h2>
                <p className="text-[10px] text-muted">
                  {activeDetections.length} events logged through {formatDate(selectedDate)}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {activeDetections.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted">
                  No changes detected prior to this date.
                </div>
              ) : (
                activeDetections.map((det) => {
                  const p = det.properties
                  const isNew = p.afterDate === selectedDate
                  const isSelected = selectedDetectionId === p.id
                  const Icon = TYPE_ICONS[p.type] || Building2
                  const typeColor = TYPE_COLORS[p.type] || '#22D3EE'

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleFlyToDetection(det)}
                      className={cx(
                        'cursor-pointer rounded-xl border p-2.5 transition-colors text-xs',
                        isSelected ? 'border-accent bg-accent/10' : 'border-line bg-base hover:bg-surface',
                        isNew && 'border-accent/70'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 font-medium text-ink">
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded"
                            style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
                          >
                            <Icon size={12} />
                          </span>
                          <span className="truncate">{p.locationName}</span>
                        </div>
                        <SeverityBadge severity={p.severity} />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>{TYPE_LABEL[p.type] || p.type}</span>
                        <span className="font-mono text-ink">{formatArea(p.areaSqm)}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-1.5 text-[10px]">
                        <span className="text-muted">Detected {formatDate(p.afterDate)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/detect?detectionId=${p.id}&areaId=${p.areaId}`)
                          }}
                          className="flex items-center gap-1 text-accent hover:underline font-medium"
                        >
                          <span>Open in Detect</span>
                          <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

