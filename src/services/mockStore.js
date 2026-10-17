// In-memory mock DB. Zones + inspections + detection statuses persist to localStorage.
import areas from '../mocks/areas.json'
import detections from '../mocks/detections.geojson?raw'
import zones from '../mocks/zones.geojson?raw'
import inspections from '../mocks/inspections.json'
import timeline from '../mocks/timeline.json'
import users from '../mocks/users.json'

const KEY = 'lw_store_v1'
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } })()
export const store = saved || {
  zones: JSON.parse(zones).features,
  inspections,
  statuses: {}, // detectionId -> status override
}
export const persist = () => localStorage.setItem(KEY, JSON.stringify(store))
export const staticData = { areas, timeline, users, detections: JSON.parse(detections).features }
export const allDetections = () => staticData.detections.map((f) => ({ ...f, properties: { ...f.properties, status: store.statuses[f.properties.id] || f.properties.status } }))
