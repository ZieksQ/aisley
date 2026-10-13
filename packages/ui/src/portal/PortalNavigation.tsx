'use client'

import { createContext, useContext, type ReactNode } from 'react'

export const PortalNavigationContext = createContext({ collapsed: false, onNavigate: () => {} })

export type PortalNavItem = {
  label: string
  path: string
  icon: ReactNode
  active?: boolean
  beta?: boolean
}
export type PortalNavGroup = { id: string; label?: string; items: PortalNavItem[] }
export type PortalLinkProps = {
  to: string
  className: string
  onClick: () => void
  'aria-current': 'page' | undefined
  children: ReactNode
}

export function PortalNavigation({ label, groups, renderLink }: {
  label: string
  groups: PortalNavGroup[]
  renderLink: (props: PortalLinkProps) => ReactNode
}) {
  const { collapsed, onNavigate } = useContext(PortalNavigationContext)
  return (
    <nav aria-label={label} className="portal-nav">
      {groups.filter((group) => group.items.length > 0).map((group) => (
        <div className="portal-nav-group" key={group.id} role="group" aria-label={group.label}>
          {group.label && <p className="portal-nav-heading">{group.label}</p>}
          {group.items.map((item) => (
            <div className="portal-nav-item" key={item.path}>
              {renderLink({
                to: item.path,
                className: `portal-nav-link${item.active ? ' is-active' : ''}`,
                onClick: onNavigate,
                'aria-current': item.active ? 'page' : undefined,
                children: <>
                  <span className="portal-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="portal-nav-label">{item.label}</span>
                  {item.beta && <span className="portal-nav-beta">Beta</span>}
                </>,
              })}
              {collapsed && <span className="portal-nav-tooltip" aria-hidden="true">{item.label}{item.beta ? ' (Beta)' : ''}</span>}
            </div>
          ))}
        </div>
      ))}
    </nav>
  )
}
