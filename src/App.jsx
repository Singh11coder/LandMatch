import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import ProtectedRoute from './components/common/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ChangeDetection from './pages/ChangeDetection.jsx'
import Alerts from './pages/Alerts.jsx'
import Inspections from './pages/Inspections.jsx'
import Timeline from './pages/Timeline.jsx'
import { NotFound } from './pages/stubs.jsx'

const staff = ['officer', 'admin']
export default function App() {
  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/welcome" element={<Navigate to="/landing" replace />} />
      <Route path="/about" element={<Navigate to="/landing" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="detect" element={<ProtectedRoute allowedRoles={staff}><ChangeDetection /></ProtectedRoute>} />
        <Route path="alerts" element={<ProtectedRoute allowedRoles={staff}><Alerts /></ProtectedRoute>} />
        <Route path="inspections" element={<Inspections />} />
        <Route path="timeline" element={<ProtectedRoute allowedRoles={staff}><Timeline /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
