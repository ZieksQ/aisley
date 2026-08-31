import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './layouts/AdminLayout'
import { AuditLogDetailPage } from './pages/AuditLogDetailPage'
import { AccountPage } from './pages/AccountPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { RegistrationDetailPage } from './pages/RegistrationDetailPage'
import { PlatformSettingsPage } from './pages/PlatformSettingsPage'
import { RegistrationsPage } from './pages/RegistrationsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { UsersPage } from './pages/UsersPage'
import { UserDetailPage } from './pages/UserDetailPage'

function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/dashboard" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route element={<AccountPage />} path="/account" />
          <Route element={<PlatformSettingsPage />} path="/platform-settings" />
          <Route element={<RegistrationsPage />} path="/registrations" />
          <Route element={<RegistrationDetailPage />} path="/registrations/:registrationId" />
          <Route element={<AuditLogsPage />} path="/audit-logs" />
          <Route element={<AuditLogDetailPage />} path="/audit-logs/:auditLogId" />
          <Route element={<NotificationsPage />} path="/notifications" />
          <Route element={<UsersPage />} path="/users" />
          <Route element={<UserDetailPage />} path="/users/:userId" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="*" />
    </Routes>
  )
}

export default App
