import { useState } from 'react'
import {
  FaArrowDownShortWide,
  FaBoxOpen,
  FaBoxesPacking,
  FaCarSide,
  FaChartLine,
  FaChevronDown,
  FaClipboardCheck,
  FaCommentDots,
  FaGaugeHigh,
  FaMagnifyingGlass,
  FaRoute,
  FaTruckFast,
  FaUserCheck,
} from 'react-icons/fa6'
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
      { label: 'Parcel search', path: '/operations', icon: FaMagnifyingGlass },
      { label: 'Pickups', path: '/pickups', icon: FaBoxesPacking },
      { label: 'Receive at hub', path: '/receive-at-hub', icon: FaBoxOpen },
      { label: 'Sorting', path: '/sorting', icon: FaArrowDownShortWide },
      { label: 'Sort plan', path: '/sort-plan', icon: FaRoute, beta: true },
    ],
  },
  {
    id: 'transport',
    label: 'Transport & delivery',
    items: [
      { label: 'Linehaul', path: '/linehaul', icon: FaRoute, beta: true },
      { label: 'Linehaul dispatch', path: '/linehaul-dispatch', icon: FaTruckFast, beta: true },
      { label: 'Inbound linehaul', path: '/inbound-linehaul', icon: FaTruckFast, beta: true },
      { label: 'Last-mile dispatch', path: '/dispatch', icon: FaTruckFast },
      { label: 'Delivery confirmations', path: '/delivery-confirmations', icon: FaClipboardCheck },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    items: [
      { label: 'Courier applications', path: '/courier-applications', icon: FaUserCheck },
      { label: 'Vehicles', path: '/vehicles', icon: FaCarSide },
      { label: 'Company fleet', path: '/fleet', icon: FaTruckFast },
      { label: 'Finance', path: '/finance', icon: FaChartLine },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { label: 'Operational messages', path: '/messages', icon: FaCommentDots },
      { label: 'Support tickets', path: '/support-tickets', icon: FaCommentDots },
    ],
  },
]

const linkClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${
    isActive
      ? 'bg-purple-50 text-[#4C1268] dark:bg-white/10 dark:text-white'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
  }`

function isCurrentItem(pathname: string, itemPath: string): boolean {
  if (/^\/couriers\/[^/]+\/vehicle$/.test(pathname)) {
    return itemPath === '/vehicles'
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

export function LogisticsSidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation()
  const [selection, setSelection] = useState<{ pathname: string; id: string | null } | null>(null)
  const currentGroup = groups.find((group) => group.items.some((item) => isCurrentItem(pathname, item.path)))?.id ?? null
  const expandedGroup = selection?.pathname === pathname ? selection.id : currentGroup

  return (
    <nav aria-label="Logistics navigation" className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto">
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
              aria-controls={`logistics-nav-${group.id}`}
              aria-expanded={isExpanded}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${
                hasCurrentPage ? 'text-[#4C1268] dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
              }`}
              id={`logistics-nav-trigger-${group.id}`}
              onClick={() => setSelection({ pathname, id: isExpanded ? null : group.id })}
              type="button"
            >
              {group.label}
              <FaChevronDown aria-hidden="true" className={`size-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div
              aria-labelledby={`logistics-nav-trigger-${group.id}`}
              className={isExpanded ? 'space-y-1 pl-3' : 'hidden'}
              id={`logistics-nav-${group.id}`}
              role="group"
            >
              {group.items.map(({ beta, icon: Icon, label, path }) => {
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
                    <span className="min-w-0">{label}</span>
                    {beta && <span className="ml-auto shrink-0 border border-current/20 px-1.5 py-0.5 text-[10px] font-medium leading-none">Beta</span>}
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
