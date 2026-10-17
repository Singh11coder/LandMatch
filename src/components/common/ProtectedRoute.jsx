import { Navigate, useLocation } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { EmptyState } from './index.jsx'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user } = useAuth(), loc = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <div className="p-8"><EmptyState title="Access restricted" message={`Your role (${user.role}) cannot open this page.`} action={<ShieldOff className="text-muted" />} /></div>
  return children
}
