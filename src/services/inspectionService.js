import { call, fail } from './api.js'
import { store, persist, staticData } from './mockStore.js'
import { jwtUser } from './jwtUser.js'

const log = (i, by, action, note) => i.activity.push({ at: new Date().toISOString(), by, action, note })

export const inspectionService = {
  // Inspectors are filtered by user id here (service layer), not only in the UI.
  list: () => call((a) => a.get('/api/inspections'), () => {
    const u = jwtUser()
    return u?.role === 'inspector' ? store.inspections.filter((i) => i.assigneeId === u.id) : store.inspections
  }),

  get: (id) => call((a) => a.get(`/api/inspections/${id}`), () => {
    const u = jwtUser()
    const i = store.inspections.find((x) => x.id === id)
    if (!i) fail('Inspection not found', 404)
    if (u?.role === 'inspector' && i.assigneeId !== u.id) fail('Forbidden', 403, 'FORBIDDEN')
    return i
  }),

  create: (body) => call((a) => a.post('/api/inspections', body), () => {
    const u = jwtUser()
    if (u?.role === 'inspector') fail('Forbidden: Inspectors cannot create inspections', 403, 'FORBIDDEN')
    const i = {
      id: `ins-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'assigned',
      remarks: '',
      visitDate: null,
      photos: [],
      activity: [],
      ...body,
    }
    log(i, u?.id, 'created', 'Inspection created')
    log(i, u?.id, 'assigned', `Assigned to ${body.assigneeId}`)
    store.inspections.unshift(i)
    store.statuses[body.detectionId] = 'under_inspection'
    persist()
    return i
  }),

  bulkCreate: ({ detectionIds, assigneeId, priority = 'high', dueDate, notes = '' }) => call(
    (a) => a.post('/api/inspections/bulk', { detectionIds, assigneeId, priority, dueDate, notes }),
    () => {
      const u = jwtUser()
      if (u?.role === 'inspector') fail('Forbidden: Inspectors cannot create inspections', 403, 'FORBIDDEN')
      const created = []
      for (const detId of detectionIds) {
        const det = staticData.detections.find((d) => d.properties.id === detId)
        const p = det?.properties || {}
        const i = {
          id: `ins-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          detectionId: detId,
          areaId: p.areaId || 'area-upper-lake',
          locationName: p.locationName || 'Unknown Site',
          type: p.type || 'new_construction',
          priority,
          status: 'assigned',
          assigneeId,
          dueDate: dueDate || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
          notes,
          remarks: '',
          visitDate: null,
          photos: [],
          activity: [],
        }
        log(i, u?.id, 'created', 'Bulk inspection created')
        log(i, u?.id, 'assigned', `Assigned to ${assigneeId}`)
        store.inspections.unshift(i)
        store.statuses[detId] = 'under_inspection'
        created.push(i)
      }
      persist()
      return created
    }
  ),

  update: (id, patch) => call((a) => a.patch(`/api/inspections/${id}`, patch), () => {
    const u = jwtUser()
    const i = store.inspections.find((x) => x.id === id)
    if (!i) fail('Inspection not found', 404)

    // Authorization checks
    if (u?.role === 'inspector') {
      if (i.assigneeId !== u.id) fail('Forbidden: Cannot mutate inspection assigned to another inspector', 403, 'FORBIDDEN')
      if (patch.assigneeId && patch.assigneeId !== i.assigneeId) fail('Forbidden: Inspectors cannot reassign tasks', 403, 'FORBIDDEN')
    }

    // Require remarks when confirming violation or marking false alarm
    const isFinalizing = ['confirmed', 'confirmed_violation', 'false_alarm'].includes(patch.status)
    if (isFinalizing && !patch.remarks && !i.remarks) {
      fail('Remarks are required before finalizing an inspection decision', 422, 'VALIDATION')
    }

    // Prevent duplicate resolution
    const alreadyFinal = ['confirmed', 'confirmed_violation', 'false_alarm'].includes(i.status)
    if (alreadyFinal && isFinalizing && i.status === patch.status) {
      fail('This inspection has already been resolved', 400, 'ALREADY_RESOLVED')
    }

    // Track reassignment
    if (patch.assigneeId && patch.assigneeId !== i.assigneeId) {
      log(i, u?.id, 'assigned', `Reassigned to ${patch.assigneeId}`)
    }

    // Track visit date
    if (patch.status === 'visited' && !i.visitDate) {
      i.visitDate = patch.visitDate || new Date().toISOString().slice(0, 10)
    }

    // Track photo upload
    if (patch.photos && patch.photos.length > i.photos.length) {
      const added = patch.photos.length - i.photos.length
      log(i, u?.id, 'photo_uploaded', `${added} evidence photo${added > 1 ? 's' : ''} uploaded`)
    }

    Object.assign(i, patch)

    if (patch.status) {
      const actionName = patch.status === 'visited' ? 'visited' : isFinalizing ? 'resolved' : patch.status
      log(i, u?.id, actionName, patch.status)

      if (['confirmed', 'confirmed_violation'].includes(patch.status)) {
        store.statuses[i.detectionId] = 'resolved'
      } else if (patch.status === 'false_alarm') {
        store.statuses[i.detectionId] = 'false_alarm'
      }
    }

    persist()
    return i
  }),
}

