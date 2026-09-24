import { useState } from 'react'
import {
  FaBoxOpen,
  FaBoxesStacked,
  FaChartLine,
  FaChevronDown,
  FaClipboardList,
  FaComments,
  FaFileContract,
  FaGaugeHigh,
  FaStar,
  FaTriangleExclamation,
  FaUserGear,
} from 'react-icons/fa6'
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
      { label: 'Products', path: '/products', icon: FaBoxOpen },
      { label: 'Inventory', path: '/inventory', icon: FaBoxesStacked },
      { label: 'Low-stock alerts', path: '/low-stock-alerts', icon: FaTriangleExclamation },
      { label: 'Finance', path: '/finance', icon: FaChartLine },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    items: [
      { label: 'Monitoring', path: '/orders/monitoring', icon: FaClipboardList },
      { label: 'Approval', path: '/orders/approval', icon: FaClipboardList },
      { label: 'Pickup', path: '/orders/pickup', icon: FaClipboardList },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { label: 'Product Q&A', path: '/product-questions', icon: FaComments },
      { label: 'Product reviews', path: '/reviews', icon: FaStar },
      { label: 'Messages', path: '/messages', icon: FaComments },
      { label: 'Logistics messages', path: '/logistics-messages', icon: FaComments },
      { label: 'Support tickets', path: '/support-tickets', icon: FaComments },
    ],
  },
  {
    id: 'personal',
    label: 'My account',
    items: [
      { label: 'Account settings', path: '/account', icon: FaUserGear },
      { label: 'Policy consent', path: '/policy-consent', icon: FaFileContract },
    ],
  },
]

const linkClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
    isActive
      ? 'bg-purple-50 text-[#4C1268] dark:bg-white/10 dark:text-white'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
  }`

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

export function SellerSidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation()
  const [selection, setSelection] = useState<{ pathname: string; id: string | null } | null>(null)
  const currentGroup = groups.find((group) => group.items.some((item) => isCurrentItem(pathname, item.path)))?.id ?? null
  const expandedGroup = selection?.pathname === pathname ? selection.id : currentGroup

  return (
    <nav aria-label="Seller navigation" className="mt-8 space-y-1">
      <Link
        aria-current={pathname === '/dashboard' ? 'page' : undefined}
        className={linkClass(pathname === '/dashboard')}
        onClick={onNavigate}
        to="/dashboard"
      >
        <FaGaugeHigh aria-hidden="true" className="shrink-0" />
        Dashboard
      </Link>

      {groups.map((group) => {
        const isExpanded = expandedGroup === group.id
        const hasCurrentPage = currentGroup === group.id

        return (
          <div key={group.id}>
            <button
              aria-controls={`seller-nav-${group.id}`}
              aria-expanded={isExpanded}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${
                hasCurrentPage ? 'text-[#4C1268] dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
              }`}
              id={`seller-nav-trigger-${group.id}`}
              onClick={() => setSelection({ pathname, id: isExpanded ? null : group.id })}
              type="button"
            >
              {group.label}
              <FaChevronDown aria-hidden="true" className={`size-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div
              aria-labelledby={`seller-nav-trigger-${group.id}`}
              className={isExpanded ? 'space-y-1 pl-3' : 'hidden'}
              id={`seller-nav-${group.id}`}
              role="group"
            >
              {group.items.map(({ icon: Icon, label, path }) => {
                const isActive = isCurrentItem(pathname, path)

                return (
                  <Link
                    aria-current={isActive ? 'page' : undefined}
                    className={linkClass(isActive)}
                    key={path}
                    onClick={onNavigate}
                    to={path}
                  >
                    <Icon aria-hidden="true" className="shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
