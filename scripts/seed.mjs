// Deterministic mock data generator -> src/mocks/*.json|geojson
import fs from 'node:fs'
const out = (f, d) => fs.writeFileSync(`src/mocks/${f}`, JSON.stringify(d, null, 1))
let s = 42; const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const r = (a, b) => a + rnd() * (b - a)
const areas = [
  { id: 'area-upper-lake', name: 'Upper Lake periphery', type: 'lake', center: [77.37, 23.25], bounds: [[23.23, 77.34], [23.27, 77.40]], areaKm2: 24.8, imageryDates: ['2022-03-10', '2022-11-05', '2023-03-12', '2023-10-20', '2024-02-18', '2024-09-14', '2025-02-02'] },
  { id: 'area-kerwa', name: 'Kerwa forest patch', type: 'forest', center: [77.36, 23.18], bounds: [[23.16, 77.34], [23.20, 77.38]], areaKm2: 19.6, imageryDates: ['2022-02-21', '2022-10-14', '2023-04-02', '2023-11-18', '2024-03-09', '2024-12-01', '2025-03-15'] },
  { id: 'area-betwa', name: 'Betwa river stretch', type: 'river', center: [77.81, 23.52], bounds: [[23.50, 77.78], [23.54, 77.84]], areaKm2: 27.1, imageryDates: ['2022-04-01', '2022-12-09', '2023-05-17', '2023-12-22', '2024-04-28', '2024-11-06', '2025-04-10'] },
]
const bb = (a, b, c, d) => [[b, a], [d, a], [d, c], [b, c], [b, a]] // lng/lat ring from lat a..c, lng b..d
const zones = [
  { id: 'zone-1', name: 'Upper Lake Full Tank Level', type: 'lake', box: [23.235, 77.345, 23.262, 77.385] },
  { id: 'zone-2', name: 'Kerwa Reserve Forest', type: 'forest', box: [23.162, 77.342, 23.19, 77.372] },
  { id: 'zone-3', name: 'Betwa Bank Buffer', type: 'river_bank', box: [23.51, 77.79, 23.53, 77.83] },
  { id: 'zone-4', name: 'Shyamla Hills Reserved Land', type: 'reserved_land', box: [23.255, 77.385, 23.268, 77.398] },
  { id: 'zone-5', name: 'Kerwa Catchment Strip', type: 'river_bank', box: [23.19, 77.35, 23.198, 77.375] },
]
const zoneFC = { type: 'FeatureCollection', features: zones.map(z => ({ type: 'Feature', properties: { id: z.id, name: z.name, type: z.type, areaKm2: +(((z.box[2] - z.box[0]) * 111) * ((z.box[3] - z.box[1]) * 102)).toFixed(2), createdBy: 'u-admin', createdAt: '2024-01-15T09:00:00Z' }, geometry: { type: 'Polygon', coordinates: [bb(...z.box)] } })) }
const typeFor = { lake: ['new_construction', 'water_shrinkage'], forest: ['vegetation_loss', 'new_construction'], river: ['sand_mining'] }
const places = { lake: ['Bairagarh shore', 'Kamla Park edge', 'Van Vihar road', 'Boat Club ridge', 'Lalghati bund', 'Bhoj Wetland east'], forest: ['Kerwa gate 2', 'Chandanpura slope', 'Kolar ridge', 'Mendora clearing', 'Samarda block'], river: ['Betwa ghat 4', 'Sironj bend', 'Vidisha sandbar', 'Kurwai bank', 'Udaipur crossing', 'Ganj Basoda reach', 'Lateri stretch'] }
const feats = []; let n = 1
const sev = (t, a, z) => (z || a > 20000 ? (a > 20000 && z ? 'critical' : 'high') : a > 6000 ? 'medium' : 'medium')
for (const a of areas) {
  const count = a.type === 'lake' ? 9 : a.type === 'forest' ? 9 : 10
  for (let i = 0; i < count; i++) {
    const type = typeFor[a.type][i % typeFor[a.type].length]
    const di = 1 + Math.floor(rnd() * (a.imageryDates.length - 1))
    const areaSqm = Math.round(r(400, a.type === 'river' ? 30000 : 48000))
    const lat0 = r(a.bounds[0][0] + .004, a.bounds[1][0] - .004), lng0 = r(a.bounds[0][1] + .004, a.bounds[1][1] - .004)
    const side = Math.sqrt(areaSqm) / 111000, asp = type === 'sand_mining' ? r(3, 5) : r(.7, 1.6)
    const hw = side * Math.sqrt(asp) / 2 * 1.1, hh = side / Math.sqrt(asp) / 2
    const ring = []; const k = type === 'vegetation_loss' ? 8 : 5
    for (let j = 0; j < k; j++) { const th = (j / k) * 6.283; ring.push([+(lng0 + Math.cos(th) * hw * r(.7, 1.3)).toFixed(6), +(lat0 + Math.sin(th) * hh * r(.7, 1.3)).toFixed(6)]) }
    ring.push(ring[0])
    const zone = zones.find(z => lat0 >= z.box[0] && lat0 <= z.box[2] && lng0 >= z.box[1] && lng0 <= z.box[3])
    const flagged = rnd() < .2; const confidence = flagged ? Math.round(r(45, 62)) : Math.round(r(65, 97))
    const flaggedAs = flagged ? ['cloud', 'seasonal', 'misalignment'][i % 3] : null
    const status = flagged ? 'false_alarm' : ['new', 'new', 'under_inspection', 'resolved'][Math.floor(rnd() * 4)]
    feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {
      id: `det-${String(n++).padStart(3, '0')}`, areaId: a.id, locationName: places[a.type][i % places[a.type].length], type, areaSqm, confidence,
      beforeDate: a.imageryDates[di - 1], afterDate: a.imageryDates[di], severity: sev(type, areaSqm, !!zone), status: flagged && rnd() < .5 ? 'new' : status,
      flaggedAs, inProtectedZone: !!zone, zoneId: zone?.id ?? null, zoneName: zone?.name ?? null, centroid: [+lng0.toFixed(6), +lat0.toFixed(6)],
      detectedAt: new Date(Date.parse(a.imageryDates[di]) + 864e5 * 2).toISOString() } })
  }
}
const protectedCount = feats.filter(f => f.properties.inProtectedZone).length
console.log(`detections: ${feats.length}, protected: ${protectedCount}`)
const users = [
  { id: 'u-admin', name: 'Anita Verma', email: 'admin@landwatch.gov.in', password: 'demo123', role: 'admin' },
  { id: 'u-off1', name: 'Rohit Sharma', email: 'officer@landwatch.gov.in', password: 'demo123', role: 'officer' },
  { id: 'u-off2', name: 'Meera Joshi', email: 'officer2@landwatch.gov.in', password: 'demo123', role: 'officer' },
  { id: 'u-ins1', name: 'Karan Patel', email: 'inspector@landwatch.gov.in', password: 'demo123', role: 'inspector' },
  { id: 'u-ins2', name: 'Sunita Rawat', email: 'inspector2@landwatch.gov.in', password: 'demo123', role: 'inspector' },
  { id: 'u-ins3', name: 'Deepak Yadav', email: 'inspector3@landwatch.gov.in', password: 'demo123', role: 'inspector' },
]
const stat = ['assigned', 'assigned', 'assigned', 'visited', 'visited', 'confirmed', 'confirmed', 'false_alarm', 'assigned']
const cand = feats.filter(f => !f.properties.flaggedAs).slice(0, 9)
const inspections = cand.map((f, i) => {
  const p = f.properties, ins = users[3 + (i % 3)], t0 = Date.parse(p.detectedAt) + 864e5
  const log = [{ at: new Date(t0).toISOString(), by: 'u-off1', action: 'created', note: 'Inspection created from alert' }, { at: new Date(t0 + 36e5).toISOString(), by: 'u-off1', action: 'assigned', note: `Assigned to ${ins.name}` }]
  if (stat[i] !== 'assigned') log.push({ at: new Date(t0 + 864e5).toISOString(), by: ins.id, action: 'visited', note: 'Site visited' })
  if (['confirmed', 'false_alarm'].includes(stat[i])) log.push({ at: new Date(t0 + 2 * 864e5).toISOString(), by: ins.id, action: 'resolved', note: stat[i] })
  return { id: `ins-${String(i + 1).padStart(3, '0')}`, detectionId: p.id, areaId: p.areaId, locationName: p.locationName, type: p.type, priority: ['high', 'medium', 'critical'][i % 3], status: stat[i], assigneeId: ins.id,
    dueDate: new Date(Date.now() + (i % 3 === 0 ? -3 : 5 + i) * 864e5).toISOString().slice(0, 10), notes: 'Verify extent of change and check permits.',
    remarks: ['confirmed', 'false_alarm'].includes(stat[i]) ? (stat[i] === 'confirmed' ? 'Unauthorised structure found; notice issued.' : 'Seasonal water line, no construction.') : '',
    visitDate: stat[i] === 'assigned' ? null : new Date(t0 + 864e5).toISOString().slice(0, 10), photos: stat[i] === 'assigned' ? [] : [`https://placehold.co/400x300?text=${p.id}`], activity: log }
})
const timeline = {}
for (const a of areas) { let cum = 0; timeline[a.id] = a.imageryDates.map(d => { const add = feats.filter(f => f.properties.areaId === a.id && f.properties.afterDate === d && !f.properties.flaggedAs).reduce((x, f) => x + f.properties.areaSqm, 0); cum += add; return { date: d, newAreaSqm: add, cumulativeAreaSqm: cum, detectionIds: feats.filter(f => f.properties.areaId === a.id && f.properties.afterDate === d).map(f => f.properties.id) } }) }
out('areas.json', areas); out('imageryDates.json', Object.fromEntries(areas.map(a => [a.id, a.imageryDates])))
out('detections.geojson', { type: 'FeatureCollection', features: feats }); out('zones.geojson', zoneFC); out('users.json', users); out('inspections.json', inspections); out('timeline.json', timeline)
