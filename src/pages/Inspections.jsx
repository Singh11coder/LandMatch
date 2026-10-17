import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Polygon } from 'react-leaflet'
import {
  ClipboardCheck,
  Search,
  Kanban,
  Table as TableIcon,
  Calendar,
  User,
  CheckCircle2,
  FileImage,
  Building2,
  Trees,
  Droplets,
  Pickaxe,
  X,
  History,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsync } from '../hooks/useAsync.js'
import { useToast } from '../context/ToastContext.jsx'
import { inspectionService } from '../services/inspectionService.js'
import { zoneService } from '../services/zoneService.js'
import { userService } from '../services/userService.js'
import { allDetections } from '../services/mockStore.js'
import {
  Button,
  Drawer,
  Modal,
  Badge,
  StatusBadge,
  Skeleton,
  EmptyState,
  ErrorState,
  Pagination,
  cx,
} from '../components/common/index.jsx'
import { ProtectedZoneLayer } from '../components/map/ProtectedZoneLayer.jsx'
import { PhotoUpload } from '../components/inspections/PhotoUpload.jsx'
import { formatDate, timeAgo, TYPE_LABEL } from '../utils/index.js'

const KANBAN_COLUMNS = [
  { id: 'assigned', label: 'Assigned', color: '#22D3EE' },
  { id: 'visited', label: 'Visited', color: '#F59E0B' },
  { id: 'confirmed', label: 'Confirmed Violation', color: '#EF4444' },
  { id: 'false_alarm', label: 'False Alarm', color: '#8A949C' },
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

function InspectionMiniMap({ detection, zones = [] }) {
  if (!detection?.geometry?.coordinates?.[0]) return null
  const ring = detection.geometry.coordinates[0]
  const coords = ring.map(([lng, lat]) => [lat, lng])
  const lats = coords.map((p) => p[0])
  const lngs = coords.map((p) => p[1])
  const bounds = [
    [Math.min(...lats) - 0.002, Math.min(...lngs) - 0.002],
    [Math.max(...lats) + 0.002, Math.max(...lngs) + 0.002],
  ]

  const color = TYPE_COLORS[detection.properties?.type] || '#22D3EE'

  return (
    <div className="h-44 w-full overflow-hidden rounded-xl border border-line bg-surface">
      <MapContainer
        bounds={bounds}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri"
        />
        <ProtectedZoneLayer zones={zones} />
        <Polygon
          positions={coords}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 3,
          }}
        />
      </MapContainer>
    </div>
  )
}

export default function Inspections() {
  const { user } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'table'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Drawer / Details State
  const [selectedInspection, setSelectedInspection] = useState(null)
  const [remarksInput, setRemarksInput] = useState('')
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [newAssigneeId, setNewAssigneeId] = useState('')

  // Confirmation Decision Dialog
  const [decisionModal, setDecisionModal] = useState(null) // { action: 'confirm' | 'false_alarm' }
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false)

  // Drag and Drop State
  const [draggedInspectionId, setDraggedInspectionId] = useState(null)

  // Load Inspections, Zones, and Inspectors
  const {
    data: inspectionsData,
    loading: inspectionsLoading,
    error: inspectionsError,
    reload: reloadInspections,
  } = useAsync(() => inspectionService.list(), [])

  const { data: zonesData } = useAsync(() => zoneService.list(), [])
  const { data: inspectors } = useAsync(() => userService.listInspectors(), [])

  // Handle deep link `?id=...`
  useEffect(() => {
    const deepId = searchParams.get('id')
    if (deepId && inspectionsData && inspectionsData.length > 0) {
      const target = inspectionsData.find((i) => i.id === deepId)
      if (target) {
        setSelectedInspection(target)
        setRemarksInput(target.remarks || '')
      }
    }
  }, [searchParams, inspectionsData])

  // Filtered Inspections
  const filteredInspections = useMemo(() => {
    let items = inspectionsData || []

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          (i.locationName && i.locationName.toLowerCase().includes(q)) ||
          i.type.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      items = items.filter((i) => {
        if (statusFilter === 'confirmed') return i.status === 'confirmed' || i.status === 'confirmed_violation'
        return i.status === statusFilter
      })
    }

    if (priorityFilter !== 'all') {
      items = items.filter((i) => i.priority === priorityFilter)
    }

    return items
  }, [inspectionsData, searchQuery, statusFilter, priorityFilter])

  // Pagination for table view
  const pageSize = 10
  const totalPages = Math.ceil(filteredInspections.length / pageSize) || 1
  const paginatedTableInspections = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInspections.slice(start, start + pageSize)
  }, [filteredInspections, currentPage])

  // Find linked detection for drawer
  const linkedDetection = useMemo(() => {
    if (!selectedInspection) return null
    return allDetections().find((d) => d.properties.id === selectedInspection.detectionId) || null
  }, [selectedInspection])

  // Quick helper to check if task is overdue
  const isOverdue = (dueDate, status) => {
    if (['confirmed', 'confirmed_violation', 'false_alarm'].includes(status)) return false
    return new Date(dueDate) < new Date()
  }

  // Handle Drag & Drop
  const handleDragStart = (e, inspectionId) => {
    e.dataTransfer.setData('text/plain', inspectionId)
    setDraggedInspectionId(inspectionId)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    const inspectionId = e.dataTransfer.getData('text/plain') || draggedInspectionId
    setDraggedInspectionId(null)
    if (!inspectionId) return

    const inspection = (inspectionsData || []).find((i) => i.id === inspectionId)
    if (!inspection) return

    // Role check: Only inspector/admin can change status
    if (user?.role === 'officer') {
      toast.push('Officers cannot resolve field inspections', 'error')
      return
    }

    if (targetStatus === 'visited') {
      await handleMarkVisited(inspection)
    } else if (targetStatus === 'confirmed' || targetStatus === 'false_alarm') {
      // Must require remarks via decision dialog
      setSelectedInspection(inspection)
      setRemarksInput(inspection.remarks || '')
      setDecisionModal({ action: targetStatus === 'confirmed' ? 'confirm' : 'false_alarm' })
    }
  }

  // Status Action: Mark as Visited
  const handleMarkVisited = async (inspection) => {
    try {
      const updated = await inspectionService.update(inspection.id, {
        status: 'visited',
        visitDate: new Date().toISOString().slice(0, 10),
      })
      toast.push(`Task ${inspection.id} marked as visited`, 'success')
      reloadInspections()
      if (selectedInspection?.id === inspection.id) {
        setSelectedInspection(updated)
      }
    } catch (err) {
      toast.push(err.message || 'Failed to update inspection', 'error')
    }
  }

  // Open Decision Confirmation Modal
  const handleOpenDecisionDialog = (action) => {
    if (!remarksInput.trim() && !selectedInspection?.remarks) {
      toast.push('Please enter site remarks before finalizing your decision', 'error')
      return
    }
    setDecisionModal({ action })
  }

  // Finalize Decision: Confirm Violation or False Alarm
  const handleSubmitDecision = async () => {
    if (!selectedInspection || !decisionModal) return

    const action = decisionModal.action
    const status = action === 'confirm' ? 'confirmed' : 'false_alarm'

    if (!remarksInput.trim()) {
      toast.push('Remarks are required before submitting decision', 'error')
      return
    }

    setIsSubmittingDecision(true)
    try {
      const updated = await inspectionService.update(selectedInspection.id, {
        status,
        remarks: remarksInput.trim(),
      })

      toast.push(
        action === 'confirm'
          ? `Violation confirmed! Linked alert marked resolved.`
          : `Inspection marked as false alarm. Linked alert updated.`,
        'success'
      )

      setSelectedInspection(updated)
      setDecisionModal(null)
      reloadInspections()
    } catch (err) {
      toast.push(err.message || 'Failed to submit decision', 'error')
    } finally {
      setIsSubmittingDecision(false)
    }
  }

  // Handle Photo Added
  const handlePhotoAdded = async (photoUrl) => {
    if (!selectedInspection) return
    const updatedPhotos = [...(selectedInspection.photos || []), photoUrl]
    try {
      const updated = await inspectionService.update(selectedInspection.id, {
        photos: updatedPhotos,
      })
      setSelectedInspection(updated)
      reloadInspections()
      toast.push('Evidence photo attached', 'success')
    } catch (err) {
      toast.push(err.message || 'Failed to upload photo', 'error')
    }
  }

  // Reassign Inspection (Officer / Admin)
  const handleReassign = async (e) => {
    e.preventDefault()
    if (!selectedInspection || !newAssigneeId) return
    try {
      const updated = await inspectionService.update(selectedInspection.id, {
        assigneeId: newAssigneeId,
      })
      setSelectedInspection(updated)
      setReassignModalOpen(false)
      reloadInspections()
      toast.push('Task successfully reassigned', 'success')
    } catch (err) {
      toast.push(err.message || 'Failed to reassign task', 'error')
    }
  }

  const canMutateField = user?.role === 'inspector' || user?.role === 'admin'
  const canReassign = user?.role === 'officer' || user?.role === 'admin'

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-ink">
            <ClipboardCheck className="text-accent" size={22} />
            <span>Field Inspections</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {user?.role === 'inspector'
              ? 'Your assigned field verification tasks and violation reporting queue.'
              : 'Command overview of all field investigations and site enforcement.'}
          </p>
        </div>

        {/* View Mode Toggle: Kanban vs Table */}
        <div className="flex rounded-xl border border-line bg-surface p-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={cx(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-colors',
              viewMode === 'kanban' ? 'bg-accent text-base font-semibold' : 'text-muted hover:text-ink'
            )}
          >
            <Kanban size={14} />
            <span>Kanban Board</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cx(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-colors',
              viewMode === 'table' ? 'bg-accent text-base font-semibold' : 'text-muted hover:text-ink'
            )}
          >
            <TableIcon size={14} />
            <span>Table View</span>
          </button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-xs">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search inspections by location, ID…"
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

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-line bg-base px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">All Statuses</option>
          <option value="assigned">Assigned</option>
          <option value="visited">Visited</option>
          <option value="confirmed">Confirmed Violation</option>
          <option value="false_alarm">False Alarm</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl border border-line bg-base px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <span className="text-muted ml-auto font-mono text-xs">
          {filteredInspections.length} tasks
        </span>
      </div>

      {/* Main Content */}
      {inspectionsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : inspectionsError ? (
        <ErrorState error={inspectionsError} onRetry={reloadInspections} />
      ) : filteredInspections.length === 0 ? (
        <EmptyState
          title="No inspections found"
          message={
            user?.role === 'inspector'
              ? 'You currently have no assigned field inspections.'
              : 'No inspections match your current search and filter settings.'
          }
        />
      ) : viewMode === 'kanban' ? (
        /* ======================================================== */
        /* KANBAN BOARD VIEW */
        /* ======================================================== */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = filteredInspections.filter((item) => {
              if (col.id === 'confirmed') return item.status === 'confirmed' || item.status === 'confirmed_violation'
              return item.status === col.id
            })

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col min-h-[500px] rounded-xl border border-line bg-surface/60 p-3"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-line pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="font-semibold text-xs text-ink">{col.label}</span>
                  </div>
                  <span className="font-mono text-xs text-muted bg-base px-2 py-0.5 rounded-md">
                    {colItems.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="flex-1 space-y-3">
                  {colItems.map((task) => {
                    const overdue = isOverdue(task.dueDate, task.status)
                    const assignee = (inspectors || []).find((u) => u.id === task.assigneeId)
                    const Icon = TYPE_ICONS[task.type] || Building2
                    const typeColor = TYPE_COLORS[task.type] || '#22D3EE'

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => {
                          setSelectedInspection(task)
                          setRemarksInput(task.remarks || '')
                        }}
                        className={cx(
                          'group cursor-grab active:cursor-grabbing rounded-xl border bg-surface p-3.5 shadow-sm hover:border-accent transition-all select-none',
                          overdue ? 'border-critical/60 bg-critical/5' : 'border-line'
                        )}
                      >
                        {/* Header: ID & Priority */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-mono text-[11px] text-muted">{task.id}</span>
                          <Badge
                            color={
                              task.priority === 'critical'
                                ? '#EF4444'
                                : task.priority === 'high'
                                ? '#F97316'
                                : '#F59E0B'
                            }
                            className="text-[10px]"
                          >
                            {task.priority}
                          </Badge>
                        </div>

                        {/* Location & Change Type */}
                        <div className="mb-2">
                          <p className="font-semibold text-xs text-ink group-hover:text-accent transition-colors">
                            {task.locationName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-1">
                            <span
                              className="flex h-4 w-4 items-center justify-center rounded"
                              style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
                            >
                              <Icon size={10} />
                            </span>
                            <span>{TYPE_LABEL[task.type] || task.type}</span>
                          </div>
                        </div>

                        {/* Evidence Photos Badge */}
                        {task.photos && task.photos.length > 0 && (
                          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted">
                            <FileImage size={12} className="text-accent" />
                            <span>{task.photos.length} evidence photo(s) attached</span>
                          </div>
                        )}

                        {/* Assignee & Due Date */}
                        <div className="flex items-center justify-between border-t border-line/60 pt-2.5 text-[11px]">
                          <div className="flex items-center gap-1.5 text-muted">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold text-accent">
                              {assignee ? assignee.name.slice(0, 2).toUpperCase() : 'IN'}
                            </div>
                            <span className="truncate max-w-[85px]">{assignee ? assignee.name : task.assigneeId}</span>
                          </div>

                          <div
                            className={cx(
                              'flex items-center gap-1 font-mono text-[11px]',
                              overdue ? 'font-bold text-critical' : 'text-muted'
                            )}
                          >
                            <Calendar size={11} />
                            <span>{formatDate(task.dueDate)}</span>
                          </div>
                        </div>

                        {/* Accessible Status Transition Controls */}
                        {canMutateField && (
                          <div className="mt-2.5 pt-2 border-t border-line/40 flex items-center justify-between">
                            {task.status === 'assigned' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkVisited(task)
                                }}
                                className="w-full rounded-lg bg-line/60 py-1 text-[11px] font-medium text-ink hover:bg-accent hover:text-base transition-colors"
                              >
                                Mark Visited →
                              </button>
                            )}

                            {task.status === 'visited' && (
                              <div className="flex w-full items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedInspection(task)
                                    setRemarksInput(task.remarks || '')
                                    setDecisionModal({ action: 'confirm' })
                                  }}
                                  className="flex-1 rounded-lg bg-critical/20 border border-critical/40 py-1 text-[11px] font-semibold text-critical hover:bg-critical hover:text-white transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedInspection(task)
                                    setRemarksInput(task.remarks || '')
                                    setDecisionModal({ action: 'false_alarm' })
                                  }}
                                  className="flex-1 rounded-lg bg-line/80 py-1 text-[11px] font-medium text-muted hover:text-ink transition-colors"
                                >
                                  False Alarm
                                </button>
                              </div>
                            )}

                            {['confirmed', 'confirmed_violation'].includes(task.status) && (
                              <span className="text-[10px] text-critical font-medium">
                                Violation Confirmed
                              </span>
                            )}

                            {task.status === 'false_alarm' && (
                              <span className="text-[10px] text-muted">Dismissed</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ======================================================== */
        /* TABLE VIEW */
        /* ======================================================== */
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-base/50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold text-ink">Inspection ID</th>
                  <th className="px-3 py-3 font-semibold text-ink">Location & Site</th>
                  <th className="px-3 py-3 font-semibold text-ink">Type</th>
                  <th className="px-3 py-3 font-semibold text-ink">Priority</th>
                  <th className="px-3 py-3 font-semibold text-ink">Assignee</th>
                  <th className="px-3 py-3 font-semibold text-ink">Due Date</th>
                  <th className="px-3 py-3 font-semibold text-ink">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-ink">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedTableInspections.map((task) => {
                  const overdue = isOverdue(task.dueDate, task.status)
                  const assignee = (inspectors || []).find((u) => u.id === task.assigneeId)
                  const Icon = TYPE_ICONS[task.type] || Building2
                  const typeColor = TYPE_COLORS[task.type] || '#22D3EE'

                  return (
                    <tr
                      key={task.id}
                      onClick={() => {
                        setSelectedInspection(task)
                        setRemarksInput(task.remarks || '')
                      }}
                      className="cursor-pointer hover:bg-line/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-ink">{task.id}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">{task.locationName}</div>
                        <div className="text-[11px] text-muted">Alert ID: {task.detectionId}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded"
                            style={{ backgroundColor: `${typeColor}22`, color: typeColor }}
                          >
                            <Icon size={12} />
                          </span>
                          <span>{TYPE_LABEL[task.type] || task.type}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          color={
                            task.priority === 'critical'
                              ? '#EF4444'
                              : task.priority === 'high'
                              ? '#F97316'
                              : '#F59E0B'
                          }
                        >
                          {task.priority}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-muted" />
                          <span>{assignee ? assignee.name : task.assigneeId}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono">
                        <span className={cx(overdue ? 'text-critical font-bold' : 'text-muted')}>
                          {formatDate(task.dueDate)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-line bg-base px-2.5 py-1 text-xs text-muted hover:text-ink hover:bg-line transition-colors"
                        >
                          Open Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredInspections.length}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* INSPECTION DETAILS DRAWER */}
      {/* ======================================================== */}
      <Drawer
        open={!!selectedInspection}
        onClose={() => setSelectedInspection(null)}
        title={selectedInspection?.locationName || 'Inspection Workspace'}
      >
        {selectedInspection && (
          <div className="space-y-5 text-xs text-ink">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="font-mono text-[11px] text-muted">{selectedInspection.id}</span>
                <p className="font-semibold text-sm text-ink">{selectedInspection.locationName}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedInspection.status} />
                <Badge
                  color={
                    selectedInspection.priority === 'critical'
                      ? '#EF4444'
                      : selectedInspection.priority === 'high'
                      ? '#F97316'
                      : '#F59E0B'
                  }
                >
                  {selectedInspection.priority}
                </Badge>
              </div>
            </div>

            {/* Mini Map */}
            {linkedDetection && (
              <div>
                <span className="mb-1.5 block font-medium text-muted">Geospatial Footprint</span>
                <InspectionMiniMap detection={linkedDetection} zones={zonesData || []} />
              </div>
            )}

            {/* Inspection Metadata */}
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-line bg-base p-3">
              <div>
                <span className="text-muted">Assigned Officer</span>
                <p className="font-medium text-ink mt-0.5">
                  {(inspectors || []).find((u) => u.id === selectedInspection.assigneeId)?.name ||
                    selectedInspection.assigneeId}
                </p>
              </div>
              <div>
                <span className="text-muted">Target Due Date</span>
                <p className="font-mono font-medium text-ink mt-0.5">
                  {formatDate(selectedInspection.dueDate)}
                </p>
              </div>
              <div>
                <span className="text-muted">Change Category</span>
                <p className="font-medium text-ink mt-0.5">
                  {TYPE_LABEL[selectedInspection.type] || selectedInspection.type}
                </p>
              </div>
              <div>
                <span className="text-muted">Site Visit Date</span>
                <p className="font-mono font-medium text-ink mt-0.5">
                  {selectedInspection.visitDate ? formatDate(selectedInspection.visitDate) : 'Pending visit'}
                </p>
              </div>
            </div>

            {/* Officer Reassign Action */}
            {canReassign && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setNewAssigneeId(selectedInspection.assigneeId)
                    setReassignModalOpen(true)
                  }}
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  <User size={13} />
                  <span>Reassign Inspection</span>
                </button>
              </div>
            )}

            {/* Evidence Photo Upload Section */}
            <div>
              <PhotoUpload
                existingPhotos={selectedInspection.photos || []}
                onPhotosChange={handlePhotoAdded}
                disabled={!canMutateField || ['confirmed', 'confirmed_violation', 'false_alarm'].includes(selectedInspection.status)}
              />
            </div>

            {/* Inspection Remarks */}
            <div>
              <label className="mb-1 block font-medium text-muted">Field Remarks & Notes</label>
              <textarea
                rows={3}
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                disabled={!canMutateField || ['confirmed', 'confirmed_violation', 'false_alarm'].includes(selectedInspection.status)}
                placeholder="Enter field observation findings, land encroachment details, or reasons for false alarm…"
                className="w-full rounded-xl border border-line bg-base p-2.5 text-xs text-ink placeholder:text-muted disabled:opacity-60"
              />
            </div>

            {/* Workflow Action Buttons */}
            {canMutateField && !['confirmed', 'confirmed_violation', 'false_alarm'].includes(selectedInspection.status) && (
              <div className="space-y-2 border-t border-line pt-3">
                {selectedInspection.status === 'assigned' && (
                  <Button
                    variant="primary"
                    className="w-full font-semibold"
                    onClick={() => handleMarkVisited(selectedInspection)}
                  >
                    <CheckCircle2 size={16} />
                    <span>Record Site Visit</span>
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="danger"
                    className="w-full font-semibold"
                    onClick={() => handleOpenDecisionDialog('confirm')}
                  >
                    Confirm Violation
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full font-semibold"
                    onClick={() => handleOpenDecisionDialog('false_alarm')}
                  >
                    Mark False Alarm
                  </Button>
                </div>
              </div>
            )}

            {/* Activity History Log */}
            <div className="border-t border-line pt-4">
              <span className="mb-2 flex items-center gap-1.5 font-semibold text-ink">
                <History size={14} className="text-accent" />
                <span>Audit Trail & Activity Log</span>
              </span>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {(selectedInspection.activity || []).map((act, idx) => (
                  <div key={idx} className="rounded-lg border border-line bg-base p-2 text-[11px]">
                    <div className="flex items-center justify-between text-muted mb-0.5">
                      <span className="font-semibold text-ink capitalize">{act.action}</span>
                      <span>{timeAgo(act.at)}</span>
                    </div>
                    <p className="text-muted">{act.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Decision Confirmation Modal */}
      <Modal
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.action === 'confirm' ? 'Confirm Unauthorised Violation' : 'Dismiss as False Alarm'}
      >
        <div className="space-y-4 text-xs">
          <p className="text-ink">
            {decisionModal?.action === 'confirm'
              ? 'Are you sure you want to confirm an illegal violation for this site? This will update the inspection status to Confirmed Violation and mark the linked alert as Resolved.'
              : 'Are you sure you want to mark this alert as a False Alarm? This decision will dismiss the violation status and record your findings in the audit trail.'}
          </p>

          <div>
            <label className="mb-1 block font-medium text-muted">Mandatory Justification Remarks</label>
            <textarea
              rows={3}
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
              placeholder="Provide explicit reasons for this decision (required)…"
              className="w-full rounded-xl border border-line bg-base p-2.5 text-xs text-ink"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button variant="secondary" onClick={() => setDecisionModal(null)}>
              Cancel
            </Button>
            <Button
              variant={decisionModal?.action === 'confirm' ? 'danger' : 'primary'}
              onClick={handleSubmitDecision}
              loading={isSubmittingDecision}
            >
              Confirm Decision
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal
        open={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Reassign Field Inspection"
      >
        <form onSubmit={handleReassign} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-muted">Select Field Inspector</label>
            <select
              value={newAssigneeId}
              onChange={(e) => setNewAssigneeId(e.target.value)}
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
          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button variant="secondary" type="button" onClick={() => setReassignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Reassignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

