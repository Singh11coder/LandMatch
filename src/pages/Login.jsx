import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Radar } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { Button } from '../components/common/index.jsx'

const DEMO = { officer: 'officer@landwatch.gov.in', inspector: 'inspector@landwatch.gov.in', admin: 'admin@landwatch.gov.in' }
const DOTS = [['18%', '30%'], ['55%', '62%'], ['72%', '22%'], ['34%', '78%']]

export default function Login() {
  const { user, login } = useAuth(), nav = useNavigate()
  const [role, setRole] = useState('officer'), [email, setEmail] = useState(DEMO.officer), [password, setPassword] = useState('demo123')
  const [errs, setErrs] = useState({}), [loading, setLoading] = useState(false)
  if (user) return <Navigate to="/" replace />
  const pick = (r) => { setRole(r); setEmail(DEMO[r]); setPassword('demo123') }
  const submit = async (ev) => {
    ev.preventDefault()
    const x = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) x.email = 'Enter a valid email address'
    if (password.length < 6) x.password = 'Password must be at least 6 characters'
    setErrs(x); if (Object.keys(x).length) return
    setLoading(true)
    try { await login(email, password, role); nav('/', { replace: true }) } catch (err) { setErrs({ form: err.message }) } finally { setLoading(false) }
  }
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <section className="grid-bg relative hidden animate-drift overflow-hidden border-r border-line bg-surface lg:block" aria-hidden>
        {DOTS.map(([l, t], i) => <span key={i} className="absolute h-3 w-3" style={{ left: l, top: t }}><span className="absolute inset-0 animate-ping2 rounded-full bg-critical" /><span className="absolute inset-0 rounded-full bg-critical" /></span>)}
        <div className="absolute bottom-16 left-12"><div className="flex items-center gap-3"><Radar size={36} className="text-accent" /><span className="text-3xl font-semibold">LandWatch</span></div><p className="mt-3 text-lg text-muted">See Change Before It Becomes Damage.</p></div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <Link to="/landing" className="text-xs text-accent hover:underline">
              ← Product Overview
            </Link>
          </div>
          <fieldset><legend className="mb-1 text-xs text-muted">Demo role</legend>
            <div className="flex gap-2">{Object.keys(DEMO).map((r) => <button key={r} type="button" aria-pressed={role === r} onClick={() => pick(r)} className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${role === r ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'}`}>{r}</button>)}</div>
          </fieldset>
          {[['Email', 'email', email, setEmail, 'email'], ['Password', 'password', password, setPassword, 'password']].map(([l, k, v, set, t]) => (
            <label key={k} className="block text-xs text-muted">{l}
              <input type={t} value={v} onChange={(e) => set(e.target.value)} aria-invalid={!!errs[k]} className="mt-1 block w-full rounded-xl border border-line bg-base px-3 py-2 text-sm text-ink" />
              {errs[k] && <span role="alert" className="mt-1 block text-critical">{errs[k]}</span>}
            </label>
          ))}
          {errs.form && <p role="alert" className="text-sm text-critical">{errs.form}</p>}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
          <p className="text-center text-xs text-muted">Demo password: <span className="font-mono">demo123</span></p>
        </form>
      </section>
    </div>
  )
}
