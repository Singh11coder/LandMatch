import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { authService } from '../services/authService.js'

const AuthCtx = createContext(null)
export const useAuthContext = () => useContext(AuthCtx)

function decode(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1]))
    return p.exp * 1000 > Date.now() ? p : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('lw_token'))
  const user = useMemo(() => (token ? decode(token) : null), [token])
  const login = useCallback(async (email, password, role) => {
    const { token: t } = await authService.login(email, password, role)
    localStorage.setItem('lw_token', t); setToken(t)
  }, [])
  const logout = useCallback(() => { localStorage.removeItem('lw_token'); setToken(null) }, [])
  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
