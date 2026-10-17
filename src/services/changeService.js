// Phase 2 implements compare/job/result; shape is fixed here so the UI never changes.
import { call, fail } from './api.js'
import { allDetections } from './mockStore.js'
const jobs = new Map()
export const changeService = {
  compare: (body) => call((a) => a.post('/api/changes/compare', body), () => { const jobId = `job-${Date.now()}`; jobs.set(jobId, { start: Date.now(), body }); return { jobId } }),
  cancel: (jobId) => call((a) => a.post(`/api/changes/jobs/${jobId}/cancel`), () => {
    const j = jobs.get(jobId)
    if (j) j.cancelled = true
    return { status: 'cancelled' }
  }),
  job: (jobId) => call((a) => a.get(`/api/changes/jobs/${jobId}`), () => {
    const j = jobs.get(jobId); if (!j) fail('Job not found', 404)
    if (j.cancelled) return { status: 'cancelled', stage: 'Cancelled', progress: 0 }
    const p = Math.min(1, (Date.now() - j.start) / 3000), stages = ['Fetching images', 'Aligning', 'Computing change mask', 'Classifying changes']
    if (new URLSearchParams(location.search).get('fail') === '1' && p > .5) return { status: 'failed', stage: stages[2], progress: 50, error: 'Simulated imagery fetch failure' }
    return p >= 1 ? { status: 'done', stage: 'Done', progress: 100, resultId: jobId } : { status: 'processing', stage: stages[Math.floor(p * 4)], progress: Math.round(p * 100) }
  }),
  result: (id) => call((a) => a.get(`/api/changes/${id}`), () => {
    const j = jobs.get(id), b = j?.body || {}
    const all = allDetections().filter((f) => {
      if (b.areaId && b.areaId !== 'custom' && f.properties.areaId !== b.areaId) return false
      if (b.beforeDate && b.afterDate) {
        return f.properties.beforeDate >= b.beforeDate && f.properties.afterDate <= b.afterDate
      }
      return true
    })
    const filtered = all.filter((f) => f.properties.flaggedAs)
    const reasonBreakdown = { cloud: 0, seasonal: 0, misalignment: 0 }
    filtered.forEach((f) => {
      const r = f.properties.flaggedAs
      if (reasonBreakdown[r] !== undefined) reasonBreakdown[r]++
      else reasonBreakdown[r] = 1
    })
    return {
      id,
      areaId: b.areaId,
      beforeDate: b.beforeDate,
      afterDate: b.afterDate,
      filteredCount: filtered.length,
      reasonBreakdown,
      detections: { type: 'FeatureCollection', features: all }
    }
  }),
}

