import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { AuditLogDetailPage } from './pages/AuditLogDetailPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { RegistrationDetailPage } from './pages/RegistrationDetailPage'
import { RegistrationsPage } from './pages/RegistrationsPage'

function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/dashboard" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route element={<RegistrationsPage />} path="/registrations" />
          <Route element={<RegistrationDetailPage />} path="/registrations/:registrationId" />
          <Route element={<AuditLogsPage />} path="/audit-logs" />
          <Route element={<AuditLogDetailPage />} path="/audit-logs/:auditLogId" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  )
}

export default App
