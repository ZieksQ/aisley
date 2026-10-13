import { useState } from 'react'
import { PortalShell } from '@aisley/ui/portal'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ChatNotifications } from '../components/ChatNotifications'
import { NotificationBell } from '../components/NotificationBell'
import { LogisticsAvatar } from '../components/LogisticsAvatar'
import { LogisticsSidebarNav } from '../components/LogisticsSidebarNav'
import { SettingsSidebarNav } from '../components/SettingsSidebarNav'
import type { LogisticsUser } from '../types/auth'

function displayName(logistics: LogisticsUser | null): string {
  const name = [logistics?.profile?.first_name, logistics?.profile?.last_name].filter(Boolean).join(' ').trim()
  return name || logistics?.organization?.business_name || 'Logistics account'
}

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'L'
}

export function LogisticsLayout() {
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)
  const settings = location.pathname.startsWith('/settings')
  const name = displayName(logistics)

  async function signOut() {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
      setSigningOut(false)
    }
  }

  const title = settings
    ? 'Settings'
    : location.pathname.startsWith('/finance')
    ? 'Finance'
    : location.pathname.startsWith('/support-tickets')
    ? 'Support tickets'
    : location.pathname.startsWith('/messages')
    ? 'Operational messages'
    : location.pathname.startsWith('/receive-at-hub')
    ? 'Receive at hub'
    : location.pathname.startsWith('/sort-plan')
      ? 'Sort plan'
    : location.pathname.startsWith('/linehaul-dispatch')
      ? 'Linehaul dispatch'
    : location.pathname.startsWith('/linehaul')
      ? 'Linehaul'
    : location.pathname.startsWith('/inbound-linehaul')
      ? 'Inbound linehaul'
    : location.pathname.startsWith('/sorting')
      ? 'Sorting'
    : location.pathname.startsWith('/dispatch')
      ? 'Last-mile dispatch'
    : location.pathname.startsWith('/delivery-confirmations')
      ? 'Delivery confirmations'
    : location.pathname.startsWith('/couriers/') && location.pathname.endsWith('/vehicle')
      ? 'Courier vehicle'
    : location.pathname.startsWith('/vehicles')
      ? 'Vehicles'
    : location.pathname.startsWith('/fleet')
      ? 'Company fleet'
    : location.pathname.startsWith('/operations')
      ? 'Parcel search'
      : location.pathname.startsWith('/pickups')
      ? 'Pickups'
      : location.pathname.startsWith('/courier-applications')
        ? 'Courier applications'
        : location.pathname.startsWith('/notifications')
          ? 'Notifications'
          : location.pathname.startsWith('/account')
            ? 'Account settings'
          : location.pathname.startsWith('/shipping-rates')
              ? 'Shipping rates'
              : location.pathname.startsWith('/policy-consent')
              ? 'Terms & condition'
              : location.pathname === '/dashboard'
                ? 'Dashboard'
                : 'Page not found'

  return <PortalShell role="logistics" title={title} routeKey={location.pathname}
    navigation={settings ? <SettingsSidebarNav /> : <LogisticsSidebarNav />}
    account={{ name, email: logistics?.email, avatar: <LogisticsAvatar initials={initialsFor(name)} photoUrl={null} /> }}
    actions={<><ChatNotifications /><NotificationBell /></>}
    onLogout={() => void signOut()} signingOut={signingOut}>
    <Outlet />
  </PortalShell>
}
