// Fake satellite tiles: public/tiles/{areaId}/{YYYY-MM-DD}.jpg (needs `npm run seed` first)
import fs from 'node:fs'; import sharp from 'sharp'
const areas = JSON.parse(fs.readFileSync('src/mocks/areas.json')), dets = JSON.parse(fs.readFileSync('src/mocks/detections.geojson')).features
const W = 1024, H = 768, COL = { new_construction: [170, 165, 155], vegetation_loss: [140, 105, 70], water_shrinkage: [150, 130, 95], sand_mining: [214, 196, 140] }
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const noise = (x, y, s) => { const f = 48, xi = Math.floor(x / f), yi = Math.floor(y / f), u = x / f - xi, v = y / f - yi, m = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t)); return m(m(hash(xi, yi, s), hash(xi + 1, yi, s), u), m(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v) }
for (const a of areas) {
  fs.mkdirSync(`public/tiles/${a.id}`, { recursive: true })
  const [[s0, w0], [n0, e0]] = a.bounds, px = ([lng, lat]) => [((lng - w0) / (e0 - w0)) * W, ((n0 - lat) / (n0 - s0)) * H]
  a.imageryDates.forEach((date, di) => {
    const buf = Buffer.alloc(W * H * 3)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = noise(x, y, 1) * .6 + noise(x, y, 2) * .4, g = hash(x, y, 9) * 18
      const water = a.type === 'lake' ? ((x - W * .35) ** 2 / (W * .3) ** 2 + (y - H * .5) ** 2 / (H * .3) ** 2 < 1 + (n - .5) * .3 - (di > 3 ? .04 : 0))
        : a.type === 'river' ? Math.abs(y - (H * .5 + Math.sin(x / 140) * 90)) < 38 + n * 10 : false
      let c = water ? [30 + n * 20, 70 + n * 30, 120 + n * 30] : a.type === 'forest' ? [30 + n * 40, 80 + n * 60, 35 + n * 25] : [90 + n * 70, 110 + n * 50, 60 + n * 30]
      const i = (y * W + x) * 3; buf[i] = c[0] + g; buf[i + 1] = c[1] + g; buf[i + 2] = c[2] + g
    }
    for (const f of dets.filter(d => d.properties.areaId === a.id && d.properties.afterDate <= date)) {
      const pts = f.geometry.coordinates[0].map(px), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), col = COL[f.properties.type]
      for (let y = Math.max(0, ~~Math.min(...ys)); y < Math.min(H, Math.max(...ys)); y++) for (let x = Math.max(0, ~~Math.min(...xs)); x < Math.min(W, Math.max(...xs)); x++) { const i = (y * W + x) * 3; col.forEach((v, k) => { buf[i + k] = v + hash(x, y, 5) * 14 }) }
    }
    if (di === 3) for (let b = 0; b < 4; b++) { const cx = hash(b, 1, a.id.length) * W, cy = hash(b, 2, 7) * H, rad = 70 + hash(b, 3, 3) * 60
      for (let y = Math.max(0, ~~(cy - rad)); y < Math.min(H, cy + rad); y++) for (let x = Math.max(0, ~~(cx - rad)); x < Math.min(W, cx + rad); x++) { const d = Math.hypot(x - cx, y - cy) / rad; if (d < 1) { const al = (1 - d) * .95 * (.7 + noise(x, y, 4) * .3), i = (y * W + x) * 3; for (let k = 0; k < 3; k++) buf[i + k] = buf[i + k] * (1 - al) + 250 * al } } }
    sharp(buf, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 82 }).toFile(`public/tiles/${a.id}/${date}.jpg`)
  })
}
console.log('tiles written to public/tiles')
