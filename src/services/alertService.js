import { call } from './api.js'
import { allDetections, store, persist } from './mockStore.js'
import { SEVERITY_ORDER } from '../utils/index.js'

export const alertService = {
  // Protected-zone breaches are pinned first, then sorted by severity or user preference.
  list: (f = {}) => call((a) => a.get('/api/alerts', { params: f }), () => {
    let items = allDetections().map((x) => x.properties)
    if (!f.includeFlagged) {
      items = items.filter((p) => !p.flaggedAs)
    }

    // Filter by search query
    if (f.search) {
      const q = f.search.toLowerCase()
      items = items.filter((p) =>
        p.id.toLowerCase().includes(q) ||
        (p.locationName && p.locationName.toLowerCase().includes(q)) ||
        p.type.toLowerCase().includes(q)
      )
    }

    // Category / Type filter
    if (f.type && f.type !== 'all') {
      items = items.filter((p) => p.type === f.type)
    }

    // Severity filter
    if (f.severity && f.severity !== 'all') {
      items = items.filter((p) => p.severity === f.severity)
    }

    // Status filter
    if (f.status && f.status !== 'all') {
      items = items.filter((p) => p.status === f.status)
    }

    // Protected zone filter
    if (f.inProtectedZone != null) {
      const boolVal = f.inProtectedZone === true || f.inProtectedZone === 'true'
      items = items.filter((p) => Boolean(p.inProtectedZone) === boolVal)
    }

    // Zone ID filter
    if (f.zoneId && f.zoneId !== 'all') {
      items = items.filter((p) => p.zoneId === f.zoneId)
    }

    // Date range filter
    if (f.startDate) {
      items = items.filter((p) => p.detectedAt >= f.startDate)
    }
    if (f.endDate) {
      items = items.filter((p) => p.detectedAt <= f.endDate)
    }

    // Default sorting: Pin protected zone alerts first, then severity
    return items.sort((x, y) => {
      if (f.sortBy === 'date') {
        const diff = new Date(y.detectedAt) - new Date(x.detectedAt)
        return Number(y.inProtectedZone) - Number(x.inProtectedZone) || (f.sortDir === 'asc' ? -diff : diff)
      }
      if (f.sortBy === 'area') {
        const diff = y.areaSqm - x.areaSqm
        return Number(y.inProtectedZone) - Number(x.inProtectedZone) || (f.sortDir === 'asc' ? -diff : diff)
      }
      if (f.sortBy === 'location') {
        const diff = (x.locationName || '').localeCompare(y.locationName || '')
        return Number(y.inProtectedZone) - Number(x.inProtectedZone) || (f.sortDir === 'desc' ? -diff : diff)
      }
      return Number(y.inProtectedZone) - Number(x.inProtectedZone) || SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity]
    })
  }),

  updateStatus: (id, status) => call((a) => a.patch(`/api/alerts/${id}`, { status }), () => {
    store.statuses[id] = status
    persist()
    return { id, status }
  }),

  bulkUpdateStatus: (ids, status) => call((a) => a.patch('/api/alerts/bulk', { ids, status }), () => {
    ids.forEach((id) => {
      store.statuses[id] = status
    })
    persist()
    return { count: ids.length, status }
  }),
}

