import { PortalNavigation } from '@aisley/ui/portal'
import { LuArrowLeftRight, LuChartNoAxesCombined, LuClipboardCheck, LuFileText, LuHistory, LuInbox, LuLayoutDashboard, LuMegaphone, LuScale, LuSlidersHorizontal, LuTags, LuToggleRight, LuUserRoundCog, LuUsers } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { Link, useLocation } from 'react-router-dom'

type NavItem = {
  label: string
  path: string
  icon: IconType
  permission?: string
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    id: 'accounts',
    label: 'Accounts',
    items: [
      { label: 'Account registrations', path: '/registrations', icon: LuClipboardCheck, permission: 'registrations.view' },
      { label: 'User accounts', path: '/users', icon: LuUsers, permission: 'users.view' },
      { label: 'Seller compliance', path: '/seller-compliance', icon: LuScale, permission: 'seller_compliance.manage' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { label: 'Support tickets', path: '/support-tickets', icon: LuInbox, permission: 'support-tickets.view' },
      { label: 'Notifications', path: '/notifications', icon: LuInbox, permission: 'notifications.view' },
      { label: 'Campaigns', path: '/notification-campaigns', icon: LuMegaphone, permission: 'notification-campaigns.view' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Finance', path: '/finance', icon: LuChartNoAxesCombined, permission: 'finance.view' },
      { label: 'Vouchers', path: '/vouchers', icon: LuTags, permission: 'vouchers.view' },
      { label: 'Pricing & fees', path: '/pricing-and-fees', icon: LuTags, permission: 'finance.view' },
      { label: 'Finance holds', path: '/finance-holds', icon: LuArrowLeftRight, permission: 'finance.view' },
      { label: 'System audit logs', path: '/audit-logs', icon: LuHistory, permission: 'audit-logs.view' },
      { label: 'Platform settings', path: '/platform-settings', icon: LuSlidersHorizontal, permission: 'platform-settings.view' },
      { label: 'Feature controls', path: '/feature-controls', icon: LuToggleRight, permission: 'platform-settings.view' },
    ],
  },
  {
    id: 'personal',
    label: 'My account',
    items: [
      { label: 'Account settings', path: '/account', icon: LuUserRoundCog },
      { label: 'Policy consent', path: '/policy-consent', icon: LuFileText },
    ],
  },
]

const isCurrentPath = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`)

export function AdminSidebarNav({ permissions }: { permissions: string[] }) {
  const { pathname } = useLocation()
  const navigationGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)) })).map((group) => ({
    ...group,
    items: group.items.map(({ icon: Icon, ...item }) => ({ ...item, icon: <Icon aria-hidden="true" />, active: isCurrentPath(pathname, item.path) })),
  }))
  return <PortalNavigation label="Admin navigation" renderLink={(props) => <Link {...props} />} groups={[
    { id: 'dashboard', items: [{ label: 'Dashboard', path: '/dashboard', icon: <LuLayoutDashboard aria-hidden="true" />, active: pathname === '/dashboard' }] },
    ...navigationGroups,
  ]} />
}
