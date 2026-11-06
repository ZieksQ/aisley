'use client'

import type { ComponentProps } from 'react'
import { LuArrowLeft, LuBell, LuCreditCard, LuFileText, LuPalette, LuUserRoundCog } from 'react-icons/lu'
import { PortalNavigation } from './PortalNavigation'

const links = [
  { path: '/settings/account', label: 'Account', icon: LuUserRoundCog },
  { path: '/settings/terms', label: 'Terms and conditions', icon: LuFileText },
  { path: '/settings/billing', label: 'Billing', icon: LuCreditCard },
  { path: '/settings/appearance', label: 'Appearance', icon: LuPalette },
]

export function SettingsNavigation({ pathname, renderLink, showBilling = true, showNotifications = true }: {
  pathname: string
  renderLink: ComponentProps<typeof PortalNavigation>['renderLink']
  showBilling?: boolean
  showNotifications?: boolean
}) {
  return <PortalNavigation label="Settings" renderLink={renderLink} groups={[
    { id: 'back', items: [{ path: '/dashboard', label: 'Back to workspace', icon: <LuArrowLeft aria-hidden="true" /> }] },
    { id: 'settings', label: 'Settings', items: links
      .filter(item => showBilling || item.path !== '/settings/billing')
      .map(({ icon: Icon, ...item }) => ({ ...item, icon: <Icon aria-hidden="true" />, active: pathname === item.path || pathname.startsWith(`${item.path}/`) })) },
    { id: 'notifications', items: showNotifications ? [{ path: '/notifications', label: 'Notifications', icon: <LuBell aria-hidden="true" /> }] : [] },
  ]} />
}
