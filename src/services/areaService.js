import { call } from './api.js'
import { staticData } from './mockStore.js'
export const areaService = { list: () => call((a) => a.get('/api/areas'), () => staticData.areas) }
