import axios from 'axios'

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '' })

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('lw_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use((r) => r, (err) => {
  const status = err.response?.status ?? 0
  const e = { message: err.response?.data?.message || err.message || 'Network error', status, code: err.response?.data?.code || err.code || 'UNKNOWN' }
  if (status === 401) {
    localStorage.removeItem('lw_token')
    if (location.pathname !== '/login') location.assign('/login')
  } else window.dispatchEvent(new CustomEvent('lw:error', { detail: e }))
  return Promise.reject(e)
})

// Every service uses this: mock when VITE_USE_MOCKS=true, else the real request.
export const delay = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 500))
export async function call(real, mock) {
  if (USE_MOCKS) { await delay(); return mock() }
  return (await real(api)).data
}
export const fail = (message, status = 400, code = 'BAD_REQUEST') => { throw { message, status, code } }
export default api
