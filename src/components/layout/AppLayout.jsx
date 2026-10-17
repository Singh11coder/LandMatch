import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronsLeft, ChevronsRight, GitCompare, LayoutDashboard, LogOut, Radar, Search, ShieldAlert, ClipboardCheck, History, Globe } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { useAsync } from '../../hooks/useAsync.js'
import { areaService } from '../../services/areaService.js'
import { alertService } from '../../services/alertService.js'
import { cx } from '../common/index.jsx'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, roles: ['officer', 'inspector', 'admin'], title: 'Overview' },
  { to: '/detect', label: 'Change Detection', icon: GitCompare, roles: ['officer', 'admin'], title: 'Change Detection' },
  { to: '/alerts', label: 'Alerts & Zones', icon: ShieldAlert, roles: ['officer', 'admin'], title: 'Alerts & Protected Zones' },
  { to: '/inspections', label: 'Inspections', icon: ClipboardCheck, roles: ['officer', 'inspector', 'admin'], title: 'Inspections' },
  { to: '/timeline', label: 'Timeline', icon: History, roles: ['officer', 'admin'], title: 'Historical Timeline' },
]
const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2)

function Sidebar({ collapsed, setCollapsed, user }) {
  return (
    <aside className={cx('flex shrink-0 flex-col border-r border-line bg-surface', collapsed ? 'w-16' : 'w-60')}>
      <div className="flex h-14 items-center gap-2 border-b border-line px-4"><Radar className="shrink-0 text-accent" /><span className={cx('font-semibold', collapsed && 'hidden')}>LandWatch</span></div>
      <nav className="flex-1 space-y-1 p-2" aria-label="Main">
        {NAV.filter((n) => n.roles.includes(user.role)).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} title={label} aria-label={label}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-line hover:text-ink')}>
            <Icon size={18} className="shrink-0" /><span className={cx(collapsed && 'hidden')}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center rounded-xl p-2 text-muted hover:bg-line">
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
      <div className="flex items-center gap-3 border-t border-line p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent" aria-hidden>{initials(user.name)}</div>
        <div className={cx('min-w-0 text-xs', collapsed && 'hidden')}><p className="truncate font-medium">{user.name}</p><p className="capitalize text-muted">{user.role}</p></div>
      </div>
    </aside>
  )
}

function Topbar({ title, user, logout }) {
  const nav = useNavigate(), [q, setQ] = useState(''), [menu, setMenu] = useState(false)
  const { data: areas } = useAsync(() => areaService.list(), [])
  const { data: alerts } = useAsync(() => (user.role === 'inspector' ? Promise.resolve([]) : alertService.list({ status: 'new' })), [user.role])
  const count = (alerts || []).filter((a) => a.inProtectedZone).length
  const hits = q ? (areas || []).filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : []
  const ref = useRef(null)
  useEffect(() => { const h = (e) => { if (!ref.current?.contains(e.target)) setMenu(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const canDetect = user.role !== 'inspector'
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <h1 className="text-base font-semibold">{title}</h1>
      {canDetect && (
        <div className="relative ml-auto w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-muted" />
          <input aria-label="Search areas" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search areas…" className="w-full rounded-xl border border-line bg-base py-2 pl-9 pr-3 text-sm" />
          {q && <ul className="absolute mt-1 w-full rounded-xl border border-line bg-surface p-1 text-sm">
            {hits.length ? hits.map((a) => <li key={a.id}><button className="w-full rounded-lg px-3 py-2 text-left hover:bg-line" onClick={() => { setQ(''); nav(`/detect?areaId=${a.id}`) }}>{a.name}</button></li>) : <li className="px-3 py-2 text-muted">No matching areas</li>}
          </ul>}
        </div>
      )}
      {user.role !== 'inspector' && (
        <button aria-label={`Notifications: ${count} new protected-zone alerts`} onClick={() => nav('/alerts')} className={cx('relative rounded-xl p-2 hover:bg-line', !canDetect && 'ml-auto')}>
          <Bell size={18} />{count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-critical px-1.5 font-mono text-[10px]">{count}</span>}
        </button>
      )}
      <div className={cx('relative', user.role === 'inspector' && 'ml-auto')} ref={ref}>
        <button aria-label="User menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">{initials(user.name)}</button>
        {menu && <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-line bg-surface p-1 text-sm shadow-xl">
          <p className="px-3 py-2 text-xs text-muted border-b border-line">{user.name} · {user.role}</p>
          <button onClick={() => { setMenu(false); nav('/landing') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink hover:bg-line"><Globe size={14} className="text-accent" />Product Landing Page</button>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-line text-critical"><LogOut size={14} />Log out</button>
        </div>}
      </div>
    </header>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth(), loc = useLocation()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024)
  useEffect(() => { const h = () => window.innerWidth < 1024 && setCollapsed(true); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  const title = NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)))?.title || 'LandWatch'
  return (
    <div className="flex h-full bg-base">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} user={user} />
      <div className="flex min-w-0 flex-1 flex-col"><Topbar title={title} user={user} logout={logout} /><main className="min-h-0 flex-1 overflow-auto p-6"><Outlet /></main></div>
    </div>
  )
}
