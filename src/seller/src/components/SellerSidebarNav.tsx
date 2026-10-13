import { PortalNavigation } from '@aisley/ui/portal'
import { LuBoxes, LuChartNoAxesCombined, LuClipboardList, LuFileText, LuLayoutDashboard, LuMessagesSquare, LuPackageOpen, LuStar, LuTags, LuTriangleAlert, LuTruck, LuUserRoundCog } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { Link, useLocation } from 'react-router-dom'

type NavItem = {
  label: string
  path: string
  icon: IconType
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    id: 'shop',
    label: 'Shop',
    items: [
      { label: 'Products', path: '/products', icon: LuPackageOpen },
      { label: 'Vouchers', path: '/vouchers', icon: LuTags },
      { label: 'Shipping providers', path: '/shipping-providers', icon: LuTruck },
      { label: 'Inventory', path: '/inventory', icon: LuBoxes },
      { label: 'Low-stock alerts', path: '/low-stock-alerts', icon: LuTriangleAlert },
      { label: 'Finance', path: '/finance', icon: LuChartNoAxesCombined },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    items: [
      { label: 'Monitoring', path: '/orders/monitoring', icon: LuClipboardList },
      { label: 'Approval', path: '/orders/approval', icon: LuClipboardList },
      { label: 'Pickup', path: '/orders/pickup', icon: LuClipboardList },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { label: 'Product Q&A', path: '/product-questions', icon: LuMessagesSquare },
      { label: 'Product reviews', path: '/reviews', icon: LuStar },
      { label: 'Messages', path: '/messages', icon: LuMessagesSquare },
      { label: 'Logistics messages', path: '/logistics-messages', icon: LuMessagesSquare },
      { label: 'Courier messages', path: '/courier-messages', icon: LuMessagesSquare },
      { label: 'Support tickets', path: '/support-tickets', icon: LuMessagesSquare },
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

function isCurrentItem(pathname: string, itemPath: string): boolean {
  // Product question detail lives under /products, but belongs to the Q&A queue.
  if (/^\/products\/[^/]+\/questions\/[^/]+$/.test(pathname)) {
    return itemPath === '/product-questions'
  }

  if (/^\/orders\/[^/]+\/prepare$/.test(pathname)) {
    return itemPath === '/orders/pickup'
  }

  if (/^\/orders\/[^/]+$/.test(pathname) && !['/orders/monitoring', '/orders/approval', '/orders/pickup'].includes(pathname)) {
    return itemPath === '/orders/monitoring'
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}


export function SellerSidebarNav() {
  const { pathname } = useLocation()
  const navigationGroups = groups.map((group) => ({
    ...group,
    items: group.items.map(({ icon: Icon, ...item }) => ({ ...item, icon: <Icon aria-hidden="true" />, active: isCurrentItem(pathname, item.path) })),
  }))
  return <PortalNavigation label="Seller navigation" renderLink={(props) => <Link {...props} />} groups={[
    { id: 'dashboard', items: [{ label: 'Dashboard', path: '/dashboard', icon: <LuLayoutDashboard aria-hidden="true" />, active: pathname === '/dashboard' }] },
    ...navigationGroups,
  ]} />
}
