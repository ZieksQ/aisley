import { useState } from 'react'
import { PortalShell } from '@aisley/ui/portal'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { AdminAvatar } from '../components/AdminAvatar'
import { AdminNotificationBell } from '../components/AdminNotificationBell'
import { AdminSidebarNav } from '../components/AdminSidebarNav'

const storefrontUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function AdminLayout() {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const firstName = admin?.profile?.first_name ?? 'Administrator'
  const initials = `${admin?.profile?.first_name?.[0] ?? 'A'}${admin?.profile?.last_name?.[0] ?? ''}`
  const canViewNotifications = admin?.permissions.includes('notifications.view') ?? false
  const isUserDetail = /^\/users\/[^/]+$/.test(location.pathname)
  const isRegistrationDetail = /^\/registrations\/[^/]+$/.test(location.pathname)
  const isAuditDetail = /^\/audit-logs\/[^/]+$/.test(location.pathname)
  const isHomepageAdEditor = location.pathname.startsWith('/platform-settings/homepage-ads/')
  const pageTitle = location.pathname.startsWith('/vouchers') ? 'Vouchers' : location.pathname.startsWith('/support-tickets') ? 'Support tickets' : location.pathname.startsWith('/notification-campaigns') ? 'Notification campaigns' : location.pathname.startsWith('/registrations')
    ? isRegistrationDetail ? 'Registration review' : 'Manage account registrations'
    : location.pathname.startsWith('/audit-logs')
      ? isAuditDetail ? 'Audit event' : 'System audit logs'
      : location.pathname.startsWith('/finance-holds') ? location.pathname === '/finance-holds' ? 'Finance holds' : 'Finance hold review' : location.pathname.startsWith('/pricing-and-fees') ? 'Pricing & fees' : location.pathname.startsWith('/finance') ? 'Finance' : location.pathname.startsWith('/users') ? isUserDetail ? 'User account' : 'Manage user accounts' : location.pathname.startsWith('/seller-compliance') ? location.pathname.includes('/cases/') ? 'Compliance case' : 'Seller compliance' : location.pathname.startsWith('/notifications') ? 'Notifications' : location.pathname.startsWith('/account') ? 'Account settings' : location.pathname.startsWith('/policy-consent') ? 'Policy consent' : location.pathname.startsWith('/feature-controls') ? 'Feature controls' : location.pathname.startsWith('/platform-settings') ? isHomepageAdEditor ? 'Homepage advertisement' : 'Platform settings' : 'Dashboard'
  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  return <PortalShell role="admin" title={pageTitle} routeKey={location.pathname}
    navigation={<AdminSidebarNav permissions={admin?.permissions ?? []} />}
    account={{ name: firstName, email: admin?.email, avatar: <AdminAvatar initials={initials} photoUrl={admin?.profile?.profile_photo_url} /> }}
    actions={<>{canViewNotifications && <AdminNotificationBell />}<ThemeToggle /></>}
    onLogout={() => void handleLogout()} signingOut={isSigningOut} policyBaseUrl={storefrontUrl}>
    <Outlet />
  </PortalShell>
}
