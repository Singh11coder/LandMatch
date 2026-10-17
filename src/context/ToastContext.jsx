import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback((message, kind = 'success', link) => {
    const id = crypto.randomUUID()
    setItems((l) => [...l, { id, message, kind, link }])
    setTimeout(() => dismiss(id), 5000)
  }, [dismiss])
  // api.js dispatches this for non-401 errors
  useEffect(() => {
    const h = (e) => push(e.detail.message, 'error')
    window.addEventListener('lw:error', h)
    return () => window.removeEventListener('lw:error', h)
  }, [push])
  const value = useMemo(() => ({ push }), [push])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[3000] flex flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            {t.kind === 'error' ? <AlertTriangle size={16} className="text-critical" /> : <CheckCircle2 size={16} className="text-resolved" />}
            <span>{t.message}</span>
            {t.link && <a href={t.link.to} className="text-accent underline">{t.link.label}</a>}
            <button aria-label="Dismiss notification" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
