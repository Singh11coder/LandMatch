import { call, fail } from './api.js'
import { store, persist, staticData } from './mockStore.js'
import { jwtUser } from './jwtUser.js'

function pointInPolygon([lng, lat], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function recalculateZoneAlerts() {
  const currentZones = store.zones
  for (const det of staticData.detections) {
    const centroid = det.properties.centroid
    if (!centroid) continue
    let matchedZone = null
    for (const zone of currentZones) {
      const ring = zone.geometry?.coordinates?.[0]
      if (ring && pointInPolygon(centroid, ring)) {
        matchedZone = zone
        break
      }
    }
    if (matchedZone) {
      det.properties.inProtectedZone = true
      det.properties.zoneId = matchedZone.properties.id
      det.properties.zoneName = matchedZone.properties.name
    } else {
      det.properties.inProtectedZone = false
      det.properties.zoneId = null
      det.properties.zoneName = null
    }
  }
}

const checkAdmin = () => {
  const u = jwtUser()
  if (u?.role !== 'admin') fail('Forbidden: Only administrators can modify protected zones', 403, 'FORBIDDEN')
}

export const zoneService = {
  list: () => call((a) => a.get('/api/zones'), () => store.zones),
  create: (zone) => call((a) => a.post('/api/zones', zone), () => {
    checkAdmin()
    const z = {
      ...zone,
      properties: {
        ...zone.properties,
        id: zone.properties.id || `zone-${Date.now()}`,
        createdAt: new Date().toISOString(),
      },
    }
    store.zones.push(z)
    recalculateZoneAlerts()
    persist()
    return z
  }),
  update: (id, zone) => call((a) => a.put(`/api/zones/${id}`, zone), () => {
    checkAdmin()
    const i = store.zones.findIndex((z) => z.properties.id === id)
    if (i < 0) fail('Zone not found', 404)
    store.zones[i] = zone
    recalculateZoneAlerts()
    persist()
    return zone
  }),
  remove: (id) => call((a) => a.delete(`/api/zones/${id}`), () => {
    checkAdmin()
    store.zones = store.zones.filter((z) => z.properties.id !== id)
    recalculateZoneAlerts()
    persist()
    return { ok: true }
  }),
}

