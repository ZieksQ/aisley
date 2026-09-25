import { useState } from 'react'
import {
  FaBullhorn,
  FaChartLine,
  FaChevronDown,
  FaClipboardCheck,
  FaClockRotateLeft,
  FaFileContract,
  FaGaugeHigh,
  FaInbox,
  FaScaleBalanced,
  FaSliders,
  FaToggleOn,
  FaUserGear,
  FaUsers,
} from 'react-icons/fa6'
import type { IconType } from 'react-icons'
import { NavLink, useLocation } from 'react-router-dom'

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
      { label: 'Account registrations', path: '/registrations', icon: FaClipboardCheck, permission: 'registrations.view' },
      { label: 'User accounts', path: '/users', icon: FaUsers, permission: 'users.view' },
      { label: 'Seller compliance', path: '/seller-compliance', icon: FaScaleBalanced, permission: 'seller_compliance.manage' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { label: 'Support tickets', path: '/support-tickets', icon: FaInbox, permission: 'support-tickets.view' },
      { label: 'Notifications', path: '/notifications', icon: FaInbox, permission: 'notifications.view' },
      { label: 'Campaigns', path: '/notification-campaigns', icon: FaBullhorn, permission: 'notification-campaigns.view' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Finance', path: '/finance', icon: FaChartLine, permission: 'finance.view' },
      { label: 'System audit logs', path: '/audit-logs', icon: FaClockRotateLeft, permission: 'audit-logs.view' },
      { label: 'Platform settings', path: '/platform-settings', icon: FaSliders, permission: 'platform-settings.view' },
      { label: 'Feature controls', path: '/feature-controls', icon: FaToggleOn, permission: 'platform-settings.view' },
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

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
    isActive
      ? 'bg-purple-50 text-[#4C1268] dark:bg-white/10 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-purple-100/70 dark:hover:bg-white/[0.07] dark:hover:text-white'
  }`

const isCurrentPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`)

export function AdminSidebarNav({ permissions, onNavigate }: { permissions: string[]; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const [selection, setSelection] = useState<{ pathname: string; id: string | null } | null>(null)
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)) }))
    .filter((group) => group.items.length > 0)
  const currentGroup = visibleGroups.find((group) => group.items.some((item) => isCurrentPath(pathname, item.path)))?.id ?? null
  const expandedGroup = selection?.pathname === pathname ? selection.id : currentGroup

  return (
    <nav aria-label="Admin navigation" className="mt-8 space-y-1">
      <NavLink className={linkClass} onClick={onNavigate} to="/dashboard">
        <FaGaugeHigh aria-hidden="true" className="shrink-0" />
        Dashboard
      </NavLink>

      {visibleGroups.map((group) => {
        const isExpanded = expandedGroup === group.id
        const hasCurrentPage = group.id === currentGroup

        return (
          <div key={group.id}>
            <button
              aria-controls={`admin-nav-${group.id}`}
              aria-expanded={isExpanded}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/[0.07] ${
                hasCurrentPage ? 'text-[#4C1268] dark:text-white' : 'text-slate-600 dark:text-purple-100/70'
              }`}
              id={`admin-nav-trigger-${group.id}`}
              onClick={() => setSelection({ pathname, id: isExpanded ? null : group.id })}
              type="button"
            >
              {group.label}
              <FaChevronDown aria-hidden="true" className={`size-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div
              aria-labelledby={`admin-nav-trigger-${group.id}`}
              className={isExpanded ? 'space-y-1 pl-3' : 'hidden'}
              id={`admin-nav-${group.id}`}
              role="group"
            >
              {group.items.map(({ icon: Icon, label, path }) => (
                <NavLink className={linkClass} key={path} onClick={onNavigate} to={path}>
                  <Icon aria-hidden="true" className="shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
