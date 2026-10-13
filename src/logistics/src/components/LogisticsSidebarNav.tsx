import { PortalNavigation } from '@aisley/ui/portal'
import { LuCar, LuChartNoAxesCombined, LuClipboardCheck, LuLayoutDashboard, LuListFilter, LuMessageSquare, LuPackageCheck, LuPackageOpen, LuRoute, LuSearch, LuTags, LuTruck, LuUserRoundCheck, LuBell, LuSettings } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { Link, useLocation } from 'react-router-dom'

type NavItem = {
  label: string
  path: string
  icon: IconType
  beta?: boolean
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    id: 'hub',
    label: 'Hub operations',
    items: [
      { label: 'Parcel search', path: '/operations', icon: LuSearch },
      { label: 'Pickups', path: '/pickups', icon: LuPackageCheck },
      { label: 'Receive at hub', path: '/receive-at-hub', icon: LuPackageOpen },
      { label: 'Sorting', path: '/sorting', icon: LuListFilter },
      { label: 'Sort plan', path: '/sort-plan', icon: LuRoute, beta: true },
    ],
  },
  {
    id: 'transport',
    label: 'Transport & delivery',
    items: [
      { label: 'Linehaul', path: '/linehaul', icon: LuRoute, beta: true },
      { label: 'Linehaul dispatch', path: '/linehaul-dispatch', icon: LuTruck, beta: true },
      { label: 'Inbound linehaul', path: '/inbound-linehaul', icon: LuTruck, beta: true },
      { label: 'Last-mile dispatch', path: '/dispatch', icon: LuTruck },
      { label: 'Delivery confirmations', path: '/delivery-confirmations', icon: LuClipboardCheck },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing & rates',
    items: [
      { label: 'Shipping rates', path: '/shipping-rates', icon: LuTags },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    items: [
      { label: 'Courier applications', path: '/courier-applications', icon: LuUserRoundCheck },
      { label: 'Vehicles', path: '/vehicles', icon: LuCar },
      { label: 'Company fleet', path: '/fleet', icon: LuTruck },
      { label: 'Finance', path: '/finance', icon: LuChartNoAxesCombined },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { label: 'Operational messages', path: '/messages', icon: LuMessageSquare },
      { label: 'Support tickets', path: '/support-tickets', icon: LuMessageSquare },
    ],
  },
]

function isCurrentItem(pathname: string, itemPath: string): boolean {
  if (/^\/couriers\/[^/]+\/vehicle$/.test(pathname)) {
    return itemPath === '/vehicles'
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}


export function LogisticsSidebarNav() {
  const { pathname } = useLocation()
  const navigationGroups = groups.map((group) => ({
    ...group,
    items: group.items.map(({ icon: Icon, ...item }) => ({ ...item, icon: <Icon aria-hidden="true" />, active: isCurrentItem(pathname, item.path) })),
  }))
  return <PortalNavigation label="Logistics navigation" renderLink={(props) => <Link {...props} />} groups={[
    { id: 'dashboard', items: [{ label: 'Dashboard', path: '/dashboard', icon: <LuLayoutDashboard aria-hidden="true" />, active: pathname === '/dashboard' }] },
    ...navigationGroups,
    { id: 'personal', label: 'My account', items: [
      { label: 'Settings', path: '/settings', icon: <LuSettings aria-hidden="true" />, active: pathname.startsWith('/settings') },
      { label: 'Notifications', path: '/notifications', icon: <LuBell aria-hidden="true" />, active: pathname.startsWith('/notifications') },
    ] },
  ]} />
}
