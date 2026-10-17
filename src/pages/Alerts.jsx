import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Search,
  LayoutGrid,
  List,
  ExternalLink,
  PlusCircle,
  Trash2,
  Edit2,
  MapPin,
  ArrowUpDown,
  X,
  Maximize2,
  Building2,
  Trees,
  Droplets,
  Pickaxe,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsync } from '../hooks/useAsync.js'
import { useToast } from '../context/ToastContext.jsx'
import { alertService } from '../services/alertService.js'
import { zoneService } from '../services/zoneService.js'
import { inspectionService } from '../services/inspectionService.js'
import { userService } from '../services/userService.js'
import {
  Button,
  Modal,
  Badge,
  SeverityBadge,
  StatusBadge,
  ConfidenceBadge,
  Skeleton,
  EmptyState,
  ErrorState,
  Pagination,
  cx,
} from '../components/common/index.jsx'
import { SatelliteMap } from '../components/map/SatelliteMap.jsx'
import { ProtectedZoneLayer } from '../components/map/ProtectedZoneLayer.jsx'
import { DrawControl } from '../components/map/DrawControl.jsx'
import { formatArea, toHectares, formatDate, timeAgo, TYPE_LABEL, ZONE_LABEL, polygonAreaSqm } from '../utils/index.js'

const PAGE_SIZE = 10

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

const ZONE_COLORS = {
  forest: '#10B981',
  lake: '#3B82F6',
  river_bank: '#06B6D4',
  reserved_land: '#A855F7',
}

export default function Alerts() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  // Tabs: 'alerts' | 'zones'
  const [activeTab, setActiveTab] = useState('alerts')

  // Load Alerts and Zones
  const {
    data: alertsData,
    loading: alertsLoading,
    error: alertsError,
    reload: reloadAlerts,
  } = useAsync(() => alertService.list({ includeFlagged: false }), [])

  const {
    data: zonesData,
    loading: zonesLoading,
    error: zonesError,
    reload: reloadZones,
  } = useAsync(() => zoneService.list(), [])

  const { data: inspectors } = useAsync(() => userService.listInspectors(), [])

  // --- ALERTS TAB STATE ---
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [protectedOnly, setProtectedOnly] = useState(false)
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [sortBy, setSortBy] = useState('default') // 'default' | 'date' | 'area' | 'location'
  const [sortDir, setSortDir] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)

  // Selection & Bulk Actions
  const [selectedAlertIds, setSelectedAlertIds] = useState(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkAssignee, setBulkAssignee] = useState('')
  const [bulkPriority, setBulkPriority] = useState('high')
  const [bulkDueDate, setBulkDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [bulkNotes, setBulkNotes] = useState('Site inspection created from alert feed.')
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false)

  // Single Inspection Modal
  const [singleInspectionAlert, setSingleInspectionAlert] = useState(null)
  const [singleAssignee, setSingleAssignee] = useState('')
  const [singlePriority, setSinglePriority] = useState('high')
  const [singleDueDate, setSingleDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [singleNotes, setSingleNotes] = useState('')
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false)

  // --- PROTECTED ZONES TAB STATE ---
  const [isDrawingZone, setIsDrawingZone] = useState(false)
  const [drawnZoneGeometry, setDrawnZoneGeometry] = useState(null)
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [deleteConfirmZone, setDeleteConfirmZone] = useState(null)
  const [zoneName, setZoneName] = useState('')
  const [zoneType, setZoneType] = useState('forest')
  const [zoneDescription, setZoneDescription] = useState('')
  const [zoneMapCenter] = useState([23.25, 77.37])
  const [zoneMapBounds, setZoneMapBounds] = useState(null)

  // Set default inspector for modals
  useEffect(() => {
    if (inspectors && inspectors.length > 0) {
      if (!bulkAssignee) setBulkAssignee(inspectors[0].id)
      if (!singleAssignee) setSingleAssignee(inspectors[0].id)
    }
  }, [inspectors, bulkAssignee, singleAssignee])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, typeFilter, severityFilter, statusFilter, protectedOnly, sortBy, sortDir])

  // Filtered & Sorted Alerts
  const filteredAlerts = useMemo(() => {
    let items = alertsData || []

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          (a.locationName && a.locationName.toLowerCase().includes(q)) ||
          a.type.toLowerCase().includes(q)
      )
    }

    if (typeFilter !== 'all') {
      items = items.filter((a) => a.type === typeFilter)
    }

    if (severityFilter !== 'all') {
      items = items.filter((a) => a.severity === severityFilter)
    }

    if (statusFilter !== 'all') {
      items = items.filter((a) => a.status === statusFilter)
    }

    if (protectedOnly) {
      items = items.filter((a) => a.inProtectedZone)
    }

    // Sort: protected zones always pinned first
    return [...items].sort((a, b) => {
      // Pinned protected zones first
      if (a.inProtectedZone !== b.inProtectedZone) {
        return Number(b.inProtectedZone) - Number(a.inProtectedZone)
      }

      if (sortBy === 'date') {
        const diff = new Date(b.detectedAt) - new Date(a.detectedAt)
        return sortDir === 'asc' ? -diff : diff
      }
      if (sortBy === 'area') {
        const diff = b.areaSqm - a.areaSqm
        return sortDir === 'asc' ? -diff : diff
      }
      if (sortBy === 'location') {
        const diff = (a.locationName || '').localeCompare(b.locationName || '')
        return sortDir === 'desc' ? -diff : diff
      }

      // Default severity order
      const order = { critical: 0, high: 1, medium: 2, resolved: 3 }
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
    })
  }, [alertsData, searchQuery, typeFilter, severityFilter, statusFilter, protectedOnly, sortBy, sortDir])

  // Pagination slice
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredAlerts.slice(start, start + PAGE_SIZE)
  }, [filteredAlerts, currentPage])

  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE) || 1

  // Selection handlers
  const handleToggleSelectAllPage = () => {
    const pageIds = paginatedAlerts.map((a) => a.id)
    const allSelected = pageIds.every((id) => selectedAlertIds.has(id))
    setSelectedAlertIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id))
      } else {
        pageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleToggleSelectAlert = (id) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setSeverityFilter('all')
    setStatusFilter('all')
    setProtectedOnly(false)
    setSortBy('default')
    setSortDir('desc')
  }

  // Open single inspection modal
  const handleOpenSingleInspection = (alertItem) => {
    setSingleInspectionAlert(alertItem)
    setSinglePriority(alertItem.severity === 'critical' ? 'critical' : alertItem.severity === 'high' ? 'high' : 'medium')
    setSingleNotes(`Inspection scheduled for ${TYPE_LABEL[alertItem.type] || alertItem.type} alert.`)
  }

  // Submit single inspection
  const handleSubmitSingleInspection = async (e) => {
    e.preventDefault()
    if (!singleInspectionAlert || !singleAssignee) return

    setIsSubmittingSingle(true)
    try {
      const created = await inspectionService.create({
        detectionId: singleInspectionAlert.id,
        areaId: singleInspectionAlert.areaId,
        locationName: singleInspectionAlert.locationName,
        type: singleInspectionAlert.type,
        priority: singlePriority,
        assigneeId: singleAssignee,
        dueDate: singleDueDate,
        notes: singleNotes,
      })

      toast.push(`Inspection created for ${singleInspectionAlert.id}`, 'success', {
        to: `/inspections?id=${created.id}`,
        label: 'View inspection',
      })
      setSingleInspectionAlert(null)
      reloadAlerts()
    } catch (err) {
      toast.push(err.message || 'Failed to create inspection', 'error')
    } finally {
      setIsSubmittingSingle(false)
    }
  }

  // Submit bulk inspection creation
  const handleSubmitBulkInspections = async (e) => {
    e.preventDefault()
    const ids = Array.from(selectedAlertIds)
    if (ids.length === 0 || !bulkAssignee) return

    setIsSubmittingBulk(true)
    try {
      await inspectionService.bulkCreate({
        detectionIds: ids,
        assigneeId: bulkAssignee,
        priority: bulkPriority,
        dueDate: bulkDueDate,
        notes: bulkNotes,
      })

      toast.push(`Created ${ids.length} inspections assigned to field officer`, 'success')
      setSelectedAlertIds(new Set())
      setBulkModalOpen(false)
      reloadAlerts()
    } catch (err) {
      toast.push(err.message || 'Bulk creation failed', 'error')
    } finally {
      setIsSubmittingBulk(false)
    }
  }

  // --- PROTECTED ZONES HANDLERS ---
  const handleOpenCreateZone = (drawnArea) => {
    setEditingZone(null)
    setDrawnZoneGeometry(drawnArea)
    setZoneName('')
    setZoneType('forest')
    setZoneDescription('')
    setZoneModalOpen(true)
  }

  const handleOpenEditZone = (zone) => {
    setEditingZone(zone)
    setDrawnZoneGeometry({
      ring: zone.geometry.coordinates[0],
      areaKm2: zone.properties.areaKm2,
    })
    setZoneName(zone.properties.name)
    setZoneType(zone.properties.type)
    setZoneDescription(zone.properties.description || '')
    setZoneModalOpen(true)
  }

  const handleSaveZone = async (e) => {
    e.preventDefault()
    if (!zoneName.trim()) {
      toast.push('Zone name is required', 'error')
      return
    }

    const ring = drawnZoneGeometry?.ring
    if (!ring || ring.length < 4) {
      toast.push('Zone requires a valid polygon with at least 3 vertices', 'error')
      return
    }

    try {
      const areaKm2 = +(polygonAreaSqm(ring) / 1000000).toFixed(2)
      const zonePayload = {
        type: 'Feature',
        properties: {
          id: editingZone ? editingZone.properties.id : `zone-${Date.now()}`,
          name: zoneName.trim(),
          type: zoneType,
          areaKm2,
          description: zoneDescription.trim(),
          createdBy: user.id,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      }

      if (editingZone) {
        await zoneService.update(editingZone.properties.id, zonePayload)
        toast.push(`Protected zone "${zoneName}" updated`, 'success')
      } else {
        await zoneService.create(zonePayload)
        toast.push(`Protected zone "${zoneName}" created successfully`, 'success')
      }

      setZoneModalOpen(false)
      setIsDrawingZone(false)
      setDrawnZoneGeometry(null)
      reloadZones()
      reloadAlerts()
    } catch (err) {
      toast.push(err.message || 'Failed to save protected zone', 'error')
    }
  }

  const handleDeleteZone = async () => {
    if (!deleteConfirmZone) return
    try {
      await zoneService.remove(deleteConfirmZone.properties.id)
      toast.push(`Protected zone "${deleteConfirmZone.properties.name}" deleted`, 'success')
      setDeleteConfirmZone(null)
      reloadZones()
      reloadAlerts()
    } catch (err) {
      toast.push(err.message || 'Failed to delete zone', 'error')
    }
  }

  const handleZoomToZone = (zone) => {
    const ring = zone.geometry?.coordinates?.[0]
    if (!ring) return
    const lats = ring.map((p) => p[1])
    const lngs = ring.map((p) => p[0])
    setZoneMapBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ])
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="space-y-4">
      {/* Page Header & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-ink">
            <ShieldAlert className="text-accent" size={22} />
            <span>Alerts & Protected Zones</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Monitor surface breaches, protected environmental buffers, and schedule field inspections.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl border border-line bg-surface p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={cx(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-medium transition-colors',
              activeTab === 'alerts'
                ? 'bg-accent text-base font-semibold'
                : 'text-muted hover:text-ink'
            )}
          >
            <span>Alerts Feed</span>
            <span className="font-mono text-[10px] bg-base/60 px-1.5 py-0.5 rounded">
              {filteredAlerts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zones')}
            className={cx(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-medium transition-colors',
              activeTab === 'zones'
                ? 'bg-accent text-base font-semibold'
                : 'text-muted hover:text-ink'
            )}
          >
            <span>Protected Zones</span>
            <span className="font-mono text-[10px] bg-base/60 px-1.5 py-0.5 rounded">
              {zonesData?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ALERTS FEED */}
      {/* ======================================================== */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Controls: Search, Filters, View Mode Toggle */}
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[220px] flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search by location, ID, or change type…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-line bg-base py-1.5 pl-9 pr-3 text-xs text-ink placeholder:text-muted"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-line bg-base px-3 py-1.5 text-xs text-ink"
              >
                <option value="all">All Categories</option>
                <option value="new_construction">New construction</option>
                <option value="vegetation_loss">Vegetation loss</option>
                <option value="water_shrinkage">Water shrinkage</option>
                <option value="sand_mining">Sand mining</option>
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="rounded-xl border border-line bg-base px-3 py-1.5 text-xs text-ink"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-line bg-base px-3 py-1.5 text-xs text-ink"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="under_inspection">Under inspection</option>
                <option value="resolved">Resolved</option>
                <option value="false_alarm">False alarm</option>
              </select>

              {/* Protected Zone Toggle */}
              <button
                type="button"
                onClick={() => setProtectedOnly(!protectedOnly)}
                className={cx(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                  protectedOnly
                    ? 'border-critical bg-critical/20 text-critical font-semibold'
                    : 'border-line bg-base text-muted hover:text-ink'
                )}
              >
                <ShieldAlert size={14} />
                <span>Protected Zone Breaches</span>
              </button>

              {/* View Toggle: Table vs Cards */}
              <div className="flex rounded-xl border border-line bg-base p-0.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                  className={cx(
                    'p-1.5 rounded-lg transition-colors',
                    viewMode === 'table' ? 'bg-line text-ink' : 'text-muted hover:text-ink'
                  )}
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  aria-label="Card grid view"
                  className={cx(
                    'p-1.5 rounded-lg transition-colors',
                    viewMode === 'cards' ? 'bg-line text-ink' : 'text-muted hover:text-ink'
                  )}
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Bulk Action Bar */}
          {selectedAlertIds.size > 0 && (
            <div className="sticky top-2 z-40 flex items-center justify-between rounded-xl border border-accent bg-surface/95 px-4 py-2.5 shadow-2xl backdrop-blur animate-slide">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-base">
                  {selectedAlertIds.size}
                </span>
                <span>alerts selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="py-1 px-3 text-xs"
                  onClick={() => setSelectedAlertIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="primary"
                  className="py-1 px-3 text-xs"
                  onClick={() => setBulkModalOpen(true)}
                >
                  <PlusCircle size={14} />
                  <span>Create Inspections ({selectedAlertIds.size})</span>
                </Button>
              </div>
            </div>
          )}

          {/* Alerts Content */}
          {alertsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : alertsError ? (
            <ErrorState error={alertsError} onRetry={reloadAlerts} />
          ) : filteredAlerts.length === 0 ? (
            <EmptyState
              title="No matching alerts found"
              message="No surface change alerts match your current filter criteria."
              action={
                <Button variant="secondary" onClick={handleResetFilters} className="mt-2">
                  Reset Filters
                </Button>
              }
            />
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-base/50 text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          paginatedAlerts.length > 0 &&
                          paginatedAlerts.every((a) => selectedAlertIds.has(a.id))
                        }
                        onChange={handleToggleSelectAllPage}
                        className="rounded border-line bg-base text-accent focus:ring-accent"
                      />
                    </th>
                    <th className="px-3 py-3 font-semibold text-ink">Alert ID & Location</th>
                    <th className="px-3 py-3 font-semibold text-ink">Type</th>
                    <th
                      className="px-3 py-3 font-semibold text-ink cursor-pointer select-none"
                      onClick={() => {
                        setSortBy('area')
                        setSortDir(sortBy === 'area' && sortDir === 'asc' ? 'desc' : 'asc')
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Area</span>
                        <ArrowUpDown size={12} className="text-muted" />
                      </div>
                    </th>
                    <th className="px-3 py-3 font-semibold text-ink">Confidence</th>
                    <th className="px-3 py-3 font-semibold text-ink">Severity</th>
                    <th className="px-3 py-3 font-semibold text-ink">Status</th>
                    <th
                      className="px-3 py-3 font-semibold text-ink cursor-pointer select-none"
                      onClick={() => {
                        setSortBy('date')
                        setSortDir(sortBy === 'date' && sortDir === 'asc' ? 'desc' : 'asc')
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Detected</span>
                        <ArrowUpDown size={12} className="text-muted" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-ink">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedAlerts.map((alert) => {
                    const isProtected = alert.inProtectedZone
                    const isSelected = selectedAlertIds.has(alert.id)
                    const Icon = TYPE_ICONS[alert.type] || Building2
                    const typeColor = TYPE_COLORS[alert.type] || '#22D3EE'

                    return (
                      <tr
                        key={alert.id}
                        className={cx(
                          'transition-colors',
                          isSelected && 'bg-accent/5',
                          isProtected
                            ? 'bg-critical/5 hover:bg-critical/10 border-l-4 border-l-critical'
                            : 'hover:bg-line/30'
                        )}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectAlert(alert.id)}
                            className="rounded border-line bg-base text-accent focus:ring-accent"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink">{alert.locationName}</span>
                                {isProtected && (
                                  <span className="rounded bg-critical/20 px-1.5 py-0.5 text-[10px] font-bold text-critical tracking-wider border border-critical/30">
                                    PROTECTED ZONE
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-[11px] text-muted mt-0.5">
                                {alert.id} · {alert.areaId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded"
                              style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
                            >
                              <Icon size={12} />
                            </span>
                            <span>{TYPE_LABEL[alert.type] || alert.type}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono">
                          <div>{formatArea(alert.areaSqm)}</div>
                          <div className="text-[10px] text-muted">{toHectares(alert.areaSqm)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <ConfidenceBadge value={alert.confidence} />
                        </td>
                        <td className="px-3 py-3">
                          <SeverityBadge severity={alert.severity} />
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={alert.status} />
                        </td>
                        <td className="px-3 py-3 text-muted">
                          <div>{timeAgo(alert.detectedAt)}</div>
                          <div className="text-[10px]">{formatDate(alert.detectedAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/detect?detectionId=${alert.id}&areaId=${alert.areaId}`)}
                              title="Open in Change Detection"
                              className="rounded-lg border border-line bg-base p-1.5 text-muted hover:text-accent hover:border-accent transition-colors"
                            >
                              <ExternalLink size={14} />
                            </button>
                            {alert.status === 'new' && (
                              <button
                                type="button"
                                onClick={() => handleOpenSingleInspection(alert)}
                                title="Schedule inspection"
                                className="rounded-lg border border-line bg-base p-1.5 text-muted hover:text-ink hover:bg-line transition-colors"
                              >
                                <PlusCircle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARD LIST VIEW */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedAlerts.map((alert) => {
                const isProtected = alert.inProtectedZone
                const isSelected = selectedAlertIds.has(alert.id)
                const Icon = TYPE_ICONS[alert.type] || Building2
                const typeColor = TYPE_COLORS[alert.type] || '#22D3EE'

                return (
                  <div
                    key={alert.id}
                    className={cx(
                      'relative flex flex-col justify-between rounded-xl border p-4 text-xs transition-colors',
                      isSelected ? 'border-accent bg-accent/5' : 'border-line bg-surface',
                      isProtected && 'border-critical/40 bg-critical/5'
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectAlert(alert.id)}
                            className="rounded border-line bg-base text-accent focus:ring-accent"
                          />
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
                          >
                            <Icon size={14} />
                          </span>
                          <span className="font-semibold text-ink">{alert.locationName}</span>
                        </div>
                        <SeverityBadge severity={alert.severity} />
                      </div>

                      {isProtected && (
                        <div className="mb-2">
                          <span className="rounded bg-critical/20 px-2 py-0.5 text-[10px] font-bold text-critical tracking-wider border border-critical/30">
                            PROTECTED: {alert.zoneName}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1 text-muted">
                        <div className="flex items-center justify-between">
                          <span>Category:</span>
                          <span className="text-ink font-medium">{TYPE_LABEL[alert.type] || alert.type}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Area:</span>
                          <span className="font-mono text-ink">{formatArea(alert.areaSqm)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Confidence:</span>
                          <ConfidenceBadge value={alert.confidence} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Status:</span>
                          <StatusBadge status={alert.status} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Detected:</span>
                          <span className="text-muted">{timeAgo(alert.detectedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                      <span className="font-mono text-[10px] text-muted">{alert.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/detect?detectionId=${alert.id}&areaId=${alert.areaId}`)}
                          className="flex items-center gap-1 rounded-lg border border-line bg-base px-2.5 py-1 text-xs text-muted hover:text-accent transition-colors"
                        >
                          <ExternalLink size={12} />
                          <span>Detect</span>
                        </button>
                        {alert.status === 'new' && (
                          <button
                            type="button"
                            onClick={() => handleOpenSingleInspection(alert)}
                            className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-base hover:brightness-110 transition-colors"
                          >
                            <PlusCircle size={12} />
                            <span>Inspect</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredAlerts.length}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setCurrentPage}
            className="pt-2"
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PROTECTED ZONES MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'zones' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Map Column (2 cols) */}
          <div className="relative h-[560px] overflow-hidden rounded-xl border border-line bg-surface lg:col-span-2">
            <SatelliteMap center={zoneMapCenter} bounds={zoneMapBounds}>
              <ProtectedZoneLayer zones={zonesData || []} />
              {isAdmin && (
                <DrawControl
                  active={isDrawingZone}
                  onAreaDrawn={(drawn) => handleOpenCreateZone(drawn)}
                  onCancel={() => setIsDrawingZone(false)}
                />
              )}
            </SatelliteMap>

            {/* Admin Map Toolbar */}
            {isAdmin && (
              <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
                <Button
                  variant={isDrawingZone ? 'primary' : 'secondary'}
                  onClick={() => setIsDrawingZone(!isDrawingZone)}
                  className="shadow-xl"
                >
                  <MapPin size={15} />
                  <span>{isDrawingZone ? 'Drawing Zone…' : 'Draw New Zone'}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Zone List Sidebar (1 col) */}
          <div className="flex flex-col h-[560px] rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Protected Zone Registry</h2>
                <p className="text-xs text-muted">
                  {zonesData?.length || 0} legally restricted ecological zones
                </p>
              </div>
              {!isAdmin && (
                <Badge color="#8A949C" className="text-[10px]">
                  Read-only
                </Badge>
              )}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto py-3 pr-1">
              {zonesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : zonesError ? (
                <ErrorState error={zonesError} onRetry={reloadZones} />
              ) : (zonesData || []).map((zone) => {
                const p = zone.properties
                const color = ZONE_COLORS[p.type] || '#10B981'
                const linkedAlertsCount = (alertsData || []).filter(
                  (a) => a.inProtectedZone && a.zoneId === p.id
                ).length

                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-xl border border-line bg-base p-3 hover:border-line/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <p className="font-semibold text-xs text-ink">{p.name}</p>
                        </div>
                        <span className="text-[11px] text-muted">
                          {ZONE_LABEL[p.type] || p.type} · {p.areaKm2} km²
                        </span>
                      </div>
                      <Badge color={color} className="text-[10px]">
                        {ZONE_LABEL[p.type] || p.type}
                      </Badge>
                    </div>

                    {p.description && (
                      <p className="text-[11px] text-muted line-clamp-2">{p.description}</p>
                    )}

                    <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
                      <span className="text-muted">
                        Alerts linked:{' '}
                        <strong className="font-mono text-ink">{linkedAlertsCount}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleZoomToZone(zone)}
                          title="Zoom to zone bounds"
                          className="rounded-lg border border-line bg-surface p-1 text-muted hover:text-ink hover:bg-line transition-colors"
                        >
                          <Maximize2 size={13} />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditZone(zone)}
                              title="Edit zone"
                              className="rounded-lg border border-line bg-surface p-1 text-muted hover:text-ink hover:bg-line transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmZone(zone)}
                              title="Delete zone"
                              className="rounded-lg border border-line bg-surface p-1 text-muted hover:text-critical hover:border-critical/40 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS: SINGLE INSPECTION, BULK INSPECTIONS, ZONE EDIT */}
      {/* ======================================================== */}

      {/* Single Inspection Creation Modal */}
      <Modal
        open={!!singleInspectionAlert}
        onClose={() => setSingleInspectionAlert(null)}
        title="Schedule Site Inspection"
      >
        {singleInspectionAlert && (
          <form onSubmit={handleSubmitSingleInspection} className="space-y-4 text-xs">
            <div>
              <label className="mb-1 block font-medium text-muted">Target Alert & Location</label>
              <div className="rounded-xl border border-line bg-base p-3 text-ink">
                <div className="flex items-center justify-between font-semibold">
                  <span>{singleInspectionAlert.locationName}</span>
                  <SeverityBadge severity={singleInspectionAlert.severity} />
                </div>
                <p className="text-muted mt-1 font-mono text-[11px]">
                  Alert ID: {singleInspectionAlert.id} · {formatArea(singleInspectionAlert.areaSqm)}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-muted">Assign Inspector</label>
              <select
                value={singleAssignee}
                onChange={(e) => setSingleAssignee(e.target.value)}
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
                  value={singlePriority}
                  onChange={(e) => setSinglePriority(e.target.value)}
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
                  value={singleDueDate}
                  onChange={(e) => setSingleDueDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-muted">Inspection Notes</label>
              <textarea
                rows={3}
                value={singleNotes}
                onChange={(e) => setSingleNotes(e.target.value)}
                className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
                placeholder="Instructions for field team…"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button type="button" variant="secondary" onClick={() => setSingleInspectionAlert(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmittingSingle}>
                Create Inspection
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Inspection Creation Modal */}
      <Modal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Bulk Create Inspections (${selectedAlertIds.size})`}
      >
        <form onSubmit={handleSubmitBulkInspections} className="space-y-4 text-xs">
          <p className="text-muted">
            You are creating inspections for <strong className="text-ink">{selectedAlertIds.size}</strong> selected surface change alerts simultaneously.
          </p>

          <div>
            <label className="mb-1 block font-medium text-muted">Assign All To Inspector</label>
            <select
              value={bulkAssignee}
              onChange={(e) => setBulkAssignee(e.target.value)}
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
                value={bulkPriority}
                onChange={(e) => setBulkPriority(e.target.value)}
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
                value={bulkDueDate}
                onChange={(e) => setBulkDueDate(e.target.value)}
                required
                className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-muted">Bulk Notes</label>
            <textarea
              rows={3}
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="secondary" onClick={() => setBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmittingBulk}>
              Create {selectedAlertIds.size} Inspections
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin: Create / Edit Protected Zone Modal */}
      <Modal
        open={zoneModalOpen}
        onClose={() => setZoneModalOpen(false)}
        title={editingZone ? 'Edit Protected Zone' : 'Register New Protected Zone'}
      >
        <form onSubmit={handleSaveZone} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-muted">Zone Name</label>
            <input
              type="text"
              required
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. Upper Lake Full Tank Level"
              className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-muted">Zone Type</label>
              <select
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value)}
                className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
              >
                <option value="forest">Forest</option>
                <option value="lake">Lake</option>
                <option value="river_bank">River Bank</option>
                <option value="reserved_land">Reserved Land</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-muted">Area Coverage</label>
              <div className="rounded-xl border border-line bg-base p-2 font-mono text-sm text-ink">
                {drawnZoneGeometry?.areaKm2 || 0} km²
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-muted">Description & Statutory Reference</label>
            <textarea
              rows={3}
              value={zoneDescription}
              onChange={(e) => setZoneDescription(e.target.value)}
              placeholder="Details on legal restrictions and notifications…"
              className="w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="secondary" onClick={() => setZoneModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingZone ? 'Save Changes' : 'Register Zone'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirmZone}
        onClose={() => setDeleteConfirmZone(null)}
        title="Confirm Zone Deletion"
      >
        {deleteConfirmZone && (
          <div className="space-y-4 text-xs">
            <p className="text-ink">
              Are you sure you want to delete <strong className="text-critical">{deleteConfirmZone.properties.name}</strong>?
            </p>
            <p className="text-muted">
              Deleting this protected zone will recalculate all existing alerts. Any breaches inside this buffer will lose their protected status.
            </p>
            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => setDeleteConfirmZone(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteZone}>
                Delete Protected Zone
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

