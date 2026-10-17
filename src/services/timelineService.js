import { call } from './api.js'
import { staticData } from './mockStore.js'
export const timelineService = { get: (areaId) => call((a) => a.get(`/api/timeline/${areaId}`), () => staticData.timeline[areaId] || []) }
