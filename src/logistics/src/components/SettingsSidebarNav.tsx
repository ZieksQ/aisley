import { PortalNavigation } from '@aisley/ui/portal'
import { LuArrowLeft, LuBell, LuCreditCard, LuFileText, LuPalette, LuUserRoundCog } from 'react-icons/lu'
import { Link, useLocation } from 'react-router-dom'

const links = [
  { path: '/settings/account', label: 'Account', icon: LuUserRoundCog },
  { path: '/settings/terms', label: 'Terms and conditions', icon: LuFileText },
  { path: '/settings/billing', label: 'Billing', icon: LuCreditCard },
  { path: '/settings/appearance', label: 'Appearance', icon: LuPalette },
]

export function SettingsSidebarNav() {
  const { pathname } = useLocation()
  return <PortalNavigation label="Settings" renderLink={(props) => <Link {...props} />} groups={[
    { id: 'back', items: [{ path: '/dashboard', label: 'Back to workspace', icon: <LuArrowLeft aria-hidden="true" /> }] },
    { id: 'settings', label: 'Settings', items: links.map(({ icon: Icon, ...item }) => ({ ...item, icon: <Icon aria-hidden="true" />, active: pathname.startsWith(item.path) })) },
    { id: 'notifications', items: [{ path: '/notifications', label: 'Notifications', icon: <LuBell aria-hidden="true" /> }] },
  ]} />
}
