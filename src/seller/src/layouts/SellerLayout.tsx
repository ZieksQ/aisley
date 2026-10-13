import { useState } from 'react'
import { PortalShell } from '@aisley/ui/portal'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { SellerAvatar } from '../components/SellerAvatar'
import { ChatNotifications } from '../components/ChatNotifications'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { SellerSidebarNav } from '../components/SellerSidebarNav'

const storefrontUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function SellerLayout() {
  const { seller, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const firstName = seller?.profile?.first_name ?? 'Seller'
  const initials = `${seller?.profile?.first_name?.[0] ?? 'S'}${seller?.profile?.last_name?.[0] ?? ''}`

  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await logout()
    } catch {
      // The local session is cleared by AuthProvider even if the API is unavailable.
    } finally {
      navigate('/login', { replace: true })
      setIsSigningOut(false)
    }
  }

  const pageTitle = location.pathname.startsWith('/vouchers') ? 'Vouchers' : location.pathname.startsWith('/support-tickets') ? 'Support tickets' : location.pathname.startsWith('/shipping-providers') ? 'Shipping providers' : location.pathname.startsWith('/finance') ? 'Finance' : location.pathname.startsWith('/courier-messages') ? 'Courier messages' : location.pathname.startsWith('/logistics-messages') ? 'Logistics messages' : location.pathname.startsWith('/messages') ? 'Messages' : location.pathname.startsWith('/orders') ? 'Orders' : location.pathname.startsWith('/notifications') ? 'Notifications' : location.pathname.startsWith('/product-questions') || location.pathname.includes('/questions/') ? 'Product Q&A' : location.pathname.startsWith('/reviews') ? 'Product reviews' : location.pathname.startsWith('/products') ? 'Products' : location.pathname.startsWith('/low-stock-alerts') ? 'Low-stock alerts' : location.pathname.startsWith('/inventory') ? 'Inventory' : location.pathname.startsWith('/account') ? 'Account settings' : location.pathname.startsWith('/policy-consent') ? 'Policy consent' : 'Dashboard'

  return <PortalShell role="seller" title={pageTitle} routeKey={location.pathname}
    navigation={<SellerSidebarNav />}
    account={{ name: firstName, email: seller?.email, avatar: <SellerAvatar initials={initials} photoUrl={seller?.profile?.profile_photo_url} /> }}
    actions={<><ChatNotifications /><NotificationBell /><ThemeToggle /></>}
    onLogout={() => void handleLogout()} signingOut={isSigningOut} policyBaseUrl={storefrontUrl}>
    <Outlet />
  </PortalShell>
}
