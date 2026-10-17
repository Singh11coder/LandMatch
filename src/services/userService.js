import { call } from './api.js'
import { staticData } from './mockStore.js'

export const userService = {
  listInspectors: () => call((a) => a.get('/api/users?role=inspector'), () => staticData.users.filter((u) => u.role === 'inspector')),
}

