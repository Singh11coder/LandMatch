import { call, fail } from './api.js'
import { staticData } from './mockStore.js'

// Fake JWT: base64 header.payload.signature
const b64 = (o) => btoa(JSON.stringify(o))
export const authService = {
  login: (email, password, role) => call(
    (a) => a.post('/api/auth/login', { email, password }),
    () => {
      const u = staticData.users.find((x) => x.email === email && x.password === password && x.role === role)
      if (!u) fail('Invalid email, password or role', 401, 'INVALID_CREDENTIALS')
      const payload = { sub: u.id, id: u.id, name: u.name, role: u.role, exp: Math.floor(Date.now() / 1000) + 8 * 3600 }
      return { token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock-signature` }
    }),
}
