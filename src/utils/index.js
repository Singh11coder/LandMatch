export const formatArea = (sqm) => `${Math.round(sqm).toLocaleString('en-IN')} m²`
export const toHectares = (sqm) => `${(sqm / 10000).toFixed(2)} ha`
export const formatAreaFull = (sqm) => `${formatArea(sqm)} (${toHectares(sqm)})`
export const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export function timeAgo(d) {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}
export const confidenceLevel = (c) => (c >= 80 ? 'High' : c >= 60 ? 'Medium' : 'Low')
export const TYPE_LABEL = { new_construction: 'New construction', vegetation_loss: 'Vegetation loss', water_shrinkage: 'Water shrinkage', sand_mining: 'Sand mining' }
export const ZONE_LABEL = { forest: 'Forest', lake: 'Lake', river_bank: 'River bank', reserved_land: 'Reserved land' }
export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, resolved: 3 }
export function centroid(ring) {
  const pts = ring.slice(0, -1)
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
}
// Shoelace area on an equirectangular projection (good enough at city scale)
export function polygonAreaSqm(ring) {
  const [lng0, lat0] = ring[0], kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [(ring[i][0] - lng0) * kx, (ring[i][1] - lat0) * ky], [x2, y2] = [(ring[i + 1][0] - lng0) * kx, (ring[i + 1][1] - lat0) * ky]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a / 2)
}
