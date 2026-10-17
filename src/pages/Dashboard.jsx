import { useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Polygon, Tooltip as MapTooltip } from 'react-leaflet'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Building2,
  Trees,
  Droplets,
  Pickaxe,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsync } from '../hooks/useAsync.js'
import { areaService } from '../services/areaService.js'
import { zoneService } from '../services/zoneService.js'
import { inspectionService } from '../services/inspectionService.js'
import { allDetections } from '../services/mockStore.js'
import {
  StatCard,
  SeverityBadge,
  Badge,
  PageState,
  MapLegend,
} from '../components/common/index.jsx'
import { SatelliteMap } from '../components/map/SatelliteMap.jsx'
import { ProtectedZoneLayer } from '../components/map/ProtectedZoneLayer.jsx'
import { DetectionMarkers } from '../components/map/DetectionMarkers.jsx'
import { formatArea, timeAgo, formatDate, TYPE_LABEL } from '../utils/index.js'

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

function InspectorDashboard({ user, inspections = [] }) {
  const myInspections = useMemo(() => {
    return inspections.filter((i) => i.assigneeId === user.id)
  }, [inspections, user.id])

  const stats = useMemo(() => {
    const assigned = myInspections.filter((i) => i.status === 'assigned').length
    const visited = myInspections.filter((i) => i.status === 'visited').length
    const confirmed = myInspections.filter((i) => i.status === 'confirmed').length
    const falseAlarm = myInspections.filter((i) => i.status === 'false_alarm').length
    return { assigned, visited, confirmed, falseAlarm }
  }, [myInspections])

  const upcoming = useMemo(() => {
    return [...myInspections]
      .filter((i) => i.status === 'assigned' || i.status === 'visited')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [myInspections])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Inspector Workspace</h2>
        <p className="text-sm text-muted">Welcome back, {user.name}. Overview of your assigned field inspections.</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">To Visit</p>
          <p className="mt-1 font-mono text-2xl text-accent">{stats.assigned}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Visited (Pending Review)</p>
          <p className="mt-1 font-mono text-2xl text-medium">{stats.visited}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Confirmed Violations</p>
          <p className="mt-1 font-mono text-2xl text-critical">{stats.confirmed}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">False Alarms</p>
          <p className="mt-1 font-mono text-2xl text-muted">{stats.falseAlarm}</p>
        </div>
      </div>

      {/* Upcoming Tasks */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2 font-semibold">
            <ClipboardList className="text-accent" size={18} />
            <span>Upcoming Due Inspections</span>
          </div>
          <Link to="/inspections" className="text-xs text-accent hover:underline flex items-center gap-1">
            View all ({myInspections.length}) <ArrowRight size={12} />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No pending inspections on your schedule!</div>
        ) : (
          <div className="divide-y divide-line">
            {upcoming.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{task.locationName}</span>
                    <Badge color={task.priority === 'critical' ? '#EF4444' : task.priority === 'high' ? '#F97316' : '#F59E0B'}>
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {TYPE_LABEL[task.type] || task.type} · Task ID: {task.id}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar size={13} />
                    <span>Due {formatDate(task.dueDate)}</span>
                  </div>
                  <Link
                    to={`/inspections?id=${task.id}`}
                    className="rounded-lg border border-line bg-line/60 px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent hover:text-base transition-colors"
                  >
                    Open Inspection
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const {
    data: areasData,
    loading: areasLoading,
    error: areasError,
    reload: reloadAreas,
  } = useAsync(() => areaService.list(), [])

  const {
    data: zonesData,
    loading: zonesLoading,
    error: zonesError,
  } = useAsync(() => zoneService.list(), [])

  const {
    data: inspectionsData,
    loading: inspectionsLoading,
    error: inspectionsError,
    reload: reloadInspections,
  } = useAsync(() => inspectionService.list(), [])

  const detections = useMemo(() => {
    return allDetections()
  }, [])

  const activeDetections = useMemo(() => {
    return detections.filter((d) => !d.properties.flaggedAs)
  }, [detections])

  // Computed StatCards metrics
  const stats = useMemo(() => {
    const totalArea = (areasData || []).reduce((acc, a) => acc + (a.areaKm2 || 0), 0)

    // New changes
    const newChangesCount = activeDetections.filter((d) => d.properties.status === 'new').length

    // High priority / critical alerts or in protected zones
    const highAlertsCount = activeDetections.filter(
      (d) => d.properties.severity === 'critical' || d.properties.severity === 'high' || d.properties.inProtectedZone
    ).length

    // Pending inspections
    const pendingInspections = (inspectionsData || []).filter(
      (i) => i.status === 'assigned' || i.status === 'visited'
    ).length

    return {
      totalArea: +totalArea.toFixed(1),
      newChanges: newChangesCount,
      highAlerts: highAlertsCount,
      pendingInspections,
    }
  }, [areasData, activeDetections, inspectionsData])

  // Chart data: stacked area by week & type
  const areaChartData = useMemo(() => {
    const dates = ['2023-10-20', '2024-02-18', '2024-04-28', '2024-09-14', '2024-11-06', '2025-02-02']
    return dates.map((d) => {
      const dets = activeDetections.filter((f) => f.properties.afterDate <= d)
      return {
        date: formatDate(d),
        new_construction: dets.filter((f) => f.properties.type === 'new_construction').length,
        vegetation_loss: dets.filter((f) => f.properties.type === 'vegetation_loss').length,
        water_shrinkage: dets.filter((f) => f.properties.type === 'water_shrinkage').length,
        sand_mining: dets.filter((f) => f.properties.type === 'sand_mining').length,
      }
    })
  }, [activeDetections])

  // Chart data: donut by type
  const donutData = useMemo(() => {
    const counts = {
      new_construction: 0,
      vegetation_loss: 0,
      water_shrinkage: 0,
      sand_mining: 0,
    }
    activeDetections.forEach((d) => {
      if (counts[d.properties.type] !== undefined) {
        counts[d.properties.type]++
      }
    })
    return Object.entries(counts).map(([type, count]) => ({
      name: TYPE_LABEL[type] || type,
      type,
      value: count,
      color: TYPE_COLORS[type],
    }))
  }, [activeDetections])

  // Recent activity feed sorted by detectedAt
  const recentFeed = useMemo(() => {
    return [...activeDetections]
      .sort((a, b) => new Date(b.properties.detectedAt) - new Date(a.properties.detectedAt))
      .slice(0, 8)
  }, [activeDetections])

  const initialBounds = useMemo(() => {
    return [
      [23.14, 77.30],
      [23.56, 77.86],
    ]
  }, [])

  const loading = areasLoading || inspectionsLoading || zonesLoading
  const error = areasError || inspectionsError || zonesError

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </div>
        <div className="skeleton h-96 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <PageState error={error} onRetry={() => { reloadAreas(); reloadInspections(); }} />
  }

  // Inspector specific dashboard view
  if (user?.role === 'inspector') {
    return <InspectorDashboard user={user} inspections={inspectionsData || []} onRetry={reloadInspections} />
  }

  return (
    <div className="space-y-6">
      {/* 4 Computed StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Area Monitored"
          value={stats.totalArea}
          unit="km²"
          trend={4.2}
          spark={[20, 22, 23, 24.8, 25.5, 27.1, stats.totalArea]}
        />
        <StatCard
          label="New Changes (30d)"
          value={stats.newChanges}
          unit="alerts"
          trend={-8.5}
          spark={[12, 15, 14, 18, 11, 9, stats.newChanges]}
        />
        <StatCard
          label="High-Priority Alerts"
          value={stats.highAlerts}
          unit="active"
          trend={12.0}
          spark={[5, 7, 6, 9, 10, 11, stats.highAlerts]}
        />
        <StatCard
          label="Pending Inspections"
          value={stats.pendingInspections}
          unit="tasks"
          trend={-2.1}
          spark={[8, 7, 9, 6, 8, 7, stats.pendingInspections]}
        />
      </div>

      {/* Main Grid: Map & Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Large Map (2 cols) */}
        <div className="relative h-[480px] overflow-hidden rounded-xl border border-line bg-surface lg:col-span-2">
          <SatelliteMap bounds={initialBounds}>
            {/* Monitored Area Outlines */}
            {(areasData || []).map((area) => {
              const [[s, w], [n, e]] = area.bounds
              const coords = [
                [s, w],
                [s, e],
                [n, e],
                [n, w],
              ]
              return (
                <Polygon
                  key={area.id}
                  positions={coords}
                  pathOptions={{
                    color: '#22D3EE',
                    weight: 1.5,
                    dashArray: '4 4',
                    fillColor: '#22D3EE',
                    fillOpacity: 0.04,
                  }}
                >
                  <MapTooltip sticky>
                    <div className="text-xs">
                      <span className="font-semibold text-ink">{area.name}</span>
                      <span className="block text-muted">{area.areaKm2} km² · {area.type}</span>
                    </div>
                  </MapTooltip>
                </Polygon>
              )
            })}

            {/* Protected Zone Layer */}
            <ProtectedZoneLayer zones={zonesData || []} />

            {/* Clustered Detection Markers */}
            <DetectionMarkers detections={activeDetections} />
          </SatelliteMap>

          {/* Map Legend */}
          <div className="absolute bottom-3 left-3 z-[900]">
            <MapLegend />
          </div>
        </div>

        {/* Recent Detection Activity Feed (1 col) */}
        <div className="flex flex-col h-[480px] rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-semibold text-sm text-ink flex items-center gap-2">
              <Clock size={16} className="text-accent" />
              <span>Recent Detection Activity</span>
            </h2>
            <span className="text-xs text-muted">{recentFeed.length} recent</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line pr-1">
            {recentFeed.map((det) => {
              const p = det.properties
              const Icon = TYPE_ICONS[p.type] || AlertCircle
              const color = TYPE_COLORS[p.type] || '#22D3EE'

              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/detect?detectionId=${p.id}&areaId=${p.areaId}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/detect?detectionId=${p.id}&areaId=${p.areaId}`)
                    }
                  }}
                  className="group flex cursor-pointer items-start gap-3 py-3 hover:bg-line/40 rounded-lg px-2 transition-colors focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
                    style={{ backgroundColor: `${color}1A`, color }}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-ink group-hover:text-accent transition-colors">
                        {p.locationName}
                      </p>
                      <SeverityBadge severity={p.severity} />
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      {TYPE_LABEL[p.type] || p.type} · {formatArea(p.areaSqm)}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted mt-1">
                      <span>{timeAgo(p.detectedAt)}</span>
                      {p.inProtectedZone && (
                        <span className="text-critical font-medium text-[10px]">[Protected Zone]</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recharts Visualizations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stacked Area Chart (2 cols) */}
        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-ink">Change Accumulation Over Time</h2>
            <p className="text-xs text-muted">Cumulative detections by category across observation dates</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#8A949C" fontSize={11} tickLine={false} />
                <YAxis stroke="#8A949C" fontSize={11} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#171B1F',
                    borderColor: '#232A30',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#E6EAED',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="new_construction"
                  name="New construction"
                  stackId="1"
                  stroke={TYPE_COLORS.new_construction}
                  fill={TYPE_COLORS.new_construction}
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="vegetation_loss"
                  name="Vegetation loss"
                  stackId="1"
                  stroke={TYPE_COLORS.vegetation_loss}
                  fill={TYPE_COLORS.vegetation_loss}
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="water_shrinkage"
                  name="Water shrinkage"
                  stackId="1"
                  stroke={TYPE_COLORS.water_shrinkage}
                  fill={TYPE_COLORS.water_shrinkage}
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="sand_mining"
                  name="Sand mining"
                  stackId="1"
                  stroke={TYPE_COLORS.sand_mining}
                  fill={TYPE_COLORS.sand_mining}
                  fillOpacity={0.4}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart (1 col) */}
        <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-ink">Changes by Category</h2>
            <p className="text-xs text-muted">Distribution of active detected events</p>
          </div>

          <div className="relative flex-1 flex items-center justify-center min-h-[200px]">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.type} fill={entry.color} stroke="#171B1F" strokeWidth={2} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#171B1F',
                    borderColor: '#232A30',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#E6EAED',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total in center */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-bold text-ink">{activeDetections.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted">Total Changes</span>
            </div>
          </div>

          {/* Legend dots */}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {donutData.map((d) => (
              <div key={d.type} className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto font-mono text-ink">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
