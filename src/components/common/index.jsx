import { useEffect, useRef } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Inbox, Loader2, X } from 'lucide-react'
import { confidenceLevel } from '../../utils/index.js'

export const cx = (...c) => c.filter(Boolean).join(' ')

export function Badge({ color = '#8A949C', icon, children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', className)}
      style={{ color, borderColor: `${color}55`, background: `${color}1A` }}>{icon}{children}</span>
  )
}
const SEV = { critical: '#EF4444', high: '#F97316', medium: '#F59E0B', resolved: '#22C55E' }
export const SeverityBadge = ({ severity }) => <Badge color={SEV[severity]} icon={<span aria-hidden>●</span>}>{severity}</Badge>
const STATUS = { new: ['#22D3EE', 'New'], under_inspection: ['#F59E0B', 'Under inspection'], resolved: ['#22C55E', 'Resolved'], false_alarm: ['#8A949C', 'False alarm'],
  assigned: ['#22D3EE', 'Assigned'], visited: ['#F59E0B', 'Visited'], confirmed: ['#EF4444', 'Confirmed violation'] }
export const StatusBadge = ({ status }) => <Badge color={STATUS[status]?.[0]}>{STATUS[status]?.[1] || status}</Badge>
export function ConfidenceBadge({ value }) {
  const lvl = confidenceLevel(value), color = lvl === 'High' ? '#22C55E' : lvl === 'Medium' ? '#F59E0B' : '#EF4444'
  return <Badge color={color}><span className="font-mono">{value}%</span> {lvl}</Badge>
}

export function Button({ variant = 'primary', loading, className, children, ...p }) {
  const v = { primary: 'bg-accent text-base hover:brightness-110', secondary: 'border border-line bg-surface hover:bg-line', danger: 'bg-critical text-white hover:brightness-110', ghost: 'hover:bg-line' }[variant]
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50', v, className)}>
      {loading && <Loader2 size={14} className="animate-spin" />}{children}
    </button>
  )
}

export function Sparkline({ data, color = '#22D3EE' }) {
  const max = Math.max(...data), min = Math.min(...data), pts = data.map((d, i) => `${(i / (data.length - 1)) * 60},${20 - ((d - min) / (max - min || 1)) * 18}`).join(' ')
  return <svg width="60" height="22" aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /></svg>
}
export function StatCard({ label, value, unit, trend, spark }) {
  const up = trend >= 0
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <p className="font-mono text-2xl">{value}<span className="ml-1 text-sm text-muted">{unit}</span></p>
        {spark && <Sparkline data={spark} />}
      </div>
      {trend != null && <p className={cx('mt-1 flex items-center gap-1 text-xs', up ? 'text-high' : 'text-resolved')}>{up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}<span className="font-mono">{Math.abs(trend)}%</span> vs previous period</p>}
    </div>
  )
}

export const Skeleton = ({ className }) => <div className={cx('skeleton rounded-xl', className)} aria-hidden />
export function EmptyState({ title, message, action }) {
  return <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line p-10 text-center"><Inbox className="text-muted" /><p className="font-medium">{title}</p><p className="max-w-sm text-sm text-muted">{message}</p>{action}</div>
}
export function ErrorState({ error, onRetry }) {
  return <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-critical/40 bg-critical/5 p-10 text-center"><AlertTriangle className="text-critical" /><p className="font-medium">Something went wrong</p><p className="text-sm text-muted">{error?.message || 'Unable to load data.'}</p><Button variant="secondary" onClick={onRetry}>Retry</Button></div>
}
// Wraps any data-driven panel with loading / error / empty handling
export function PageState({ loading, error, empty, onRetry, emptyProps, children }) {
  if (loading) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (empty) return <EmptyState {...emptyProps} />
  return children
}

// Shared dialog shell: focus trap, Escape to close, restores focus
function useDialog(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement, el = ref.current
    const sel = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
    el?.querySelector(sel)?.focus()
    const key = (e) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      const f = [...el.querySelectorAll(sel)]; if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); prev?.focus?.() }
  }, [open, onClose])
  return ref
}
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const ref = useDialog(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className={cx('max-h-[90vh] w-full overflow-auto rounded-xl border border-line bg-surface p-6', width)}>
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button aria-label="Close dialog" onClick={onClose}><X size={16} /></button></div>
        {children}
      </div>
    </div>
  )
}
export function Drawer({ open, onClose, title, children }) {
  const ref = useDialog(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[2000] bg-black/40" onMouseDown={onClose}>
      <aside ref={ref} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md animate-slide overflow-auto border-l border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button aria-label="Close drawer" onClick={onClose}><X size={16} /></button></div>
        {children}
      </aside>
    </div>
  )
}
export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('border-b-2 px-4 py-2 text-sm', value === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>{t.label}</button>)}
    </div>
  )
}
export function Select({ label, value, onChange, options, className }) {
  return (
    <label className={cx('block text-xs text-muted', className)}>{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function MapLegend({ className }) {
  const items = [
    { label: 'New construction', color: '#EF4444' },
    { label: 'Vegetation loss', color: '#F97316' },
    { label: 'Water shrinkage', color: '#3B82F6' },
    { label: 'Sand mining', color: '#F59E0B' },
    { label: 'Protected zone', color: '#10B981', dashed: true },
  ]
  return (
    <div className={cx('rounded-xl border border-line bg-surface/90 p-3 text-xs shadow-lg backdrop-blur pointer-events-auto', className)}>
      <p className="mb-2 font-semibold text-ink">Map Legend</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-muted">
            {it.dashed ? (
              <span className="inline-block h-0.5 w-3.5 border-b-2 border-dashed" style={{ borderColor: it.color }} />
            ) : (
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
            )}
            <span className="text-ink">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage = 10, className }) {
  if (totalPages <= 1) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || currentPage * itemsPerPage)

  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3 text-xs text-muted', className)}>
      <div>
        {totalItems ? (
          <span>
            Showing <strong className="font-mono text-ink">{startItem}</strong>–<strong className="font-mono text-ink">{endItem}</strong> of{' '}
            <strong className="font-mono text-ink">{totalItems}</strong>
          </span>
        ) : (
          <span>
            Page <strong className="font-mono text-ink">{currentPage}</strong> of{' '}
            <strong className="font-mono text-ink">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-ink disabled:opacity-40 hover:bg-line transition-colors"
        >
          Previous
        </button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1]
              const showEllipsis = prev && p - prev > 1
              return (
                <div key={p} className="flex items-center">
                  {showEllipsis && <span className="px-1 text-muted">…</span>}
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    aria-label={`Page ${p}`}
                    aria-current={currentPage === p ? 'page' : undefined}
                    className={cx(
                      'h-7 w-7 rounded-lg text-xs font-mono font-medium transition-colors',
                      currentPage === p
                        ? 'bg-accent text-base font-bold'
                        : 'border border-line bg-surface text-ink hover:bg-line'
                    )}
                  >
                    {p}
                  </button>
                </div>
              )
            })}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-ink disabled:opacity-40 hover:bg-line transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}


