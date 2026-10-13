'use client'

import type { ReactNode } from 'react'
import { LuLogOut, LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu'
import { aisleyLogo, aisleyLogoWithTitle } from '../brand'
import { PortalNavigationContext } from './PortalNavigation'
import { usePortalSidebar } from './usePortalSidebar'

export type PortalShellProps = {
  role: 'admin' | 'seller' | 'logistics'
  title: string
  routeKey: string
  navigation: ReactNode
  actions?: ReactNode
  account: { name: string; email?: string; avatar: ReactNode }
  onLogout: () => void
  signingOut: boolean
  policyBaseUrl?: string
  children: ReactNode
}

export function PortalShell({ role, title, routeKey, navigation, actions, account, onLogout, signingOut, policyBaseUrl, children }: PortalShellProps) {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen, sidebar, trigger } = usePortalSidebar(role, routeKey)
  const navigationId = `${role}-navigation`
  const roleLabel = role[0].toUpperCase() + role.slice(1)
  return (
    <PortalNavigationContext.Provider value={{ collapsed, onNavigate: () => setMobileOpen(false) }}>
      <div className={`portal-shell${collapsed ? ' is-collapsed' : ''}`} data-role={role}>
        <a className="portal-skip" href="#portal-content">Skip to content</a>
        <aside
          aria-label={`${roleLabel} sidebar`}
          aria-modal={mobileOpen || undefined}
          className={`portal-sidebar${mobileOpen ? ' is-open' : ''}`}
          id={navigationId}
          ref={sidebar}
          role={mobileOpen ? 'dialog' : undefined}
        >
          <div className="portal-brand-row">
            <div className="portal-brand">
              <img className="portal-logo-full" src={aisleyLogoWithTitle} alt="Aisley" />
              <img className="portal-logo-mark" src={aisleyLogo} alt="Aisley" />
              <span className="portal-role">{roleLabel} workspace</span>
            </div>
            <button
              aria-controls={navigationId}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
              className="portal-icon-button portal-desktop-toggle"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              {collapsed ? <LuPanelLeftOpen aria-hidden="true" /> : <LuPanelLeftClose aria-hidden="true" />}
            </button>
            <button aria-controls={navigationId} aria-expanded={mobileOpen} aria-label="Close sidebar" className="portal-icon-button portal-mobile-close" onClick={() => setMobileOpen(false)} type="button">
              <LuPanelLeftClose aria-hidden="true" />
            </button>
          </div>
          <div className="portal-navigation-scroll">{navigation}</div>
          <footer className="portal-sidebar-footer">
            <div className="portal-account" title={account.name}>
              {account.avatar}
              <div className="portal-account-copy"><p>{account.name}</p><p>{account.email}</p></div>
            </div>
            <button aria-label={signingOut ? 'Signing out…' : 'Sign out'} className="portal-signout" disabled={signingOut} onClick={onLogout} title="Sign out" type="button">
              <LuLogOut aria-hidden="true" /><span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
            {policyBaseUrl && <nav aria-label="Policy links" className="portal-policy-links">
              <a href={`${policyBaseUrl}/policies/terms_of_service`} rel="noreferrer" target="_blank">Terms</a>
              <a href={`${policyBaseUrl}/policies/privacy_policy`} rel="noreferrer" target="_blank">Privacy</a>
            </nav>}
          </footer>
        </aside>
        {mobileOpen && <button aria-label="Close sidebar overlay" className="portal-backdrop" onClick={() => setMobileOpen(false)} type="button" tabIndex={-1} />}
        <div className="portal-workspace" inert={mobileOpen || undefined}>
          <header className="portal-toolbar">
            <div className="portal-toolbar-context">
              <button aria-controls={navigationId} aria-expanded={mobileOpen} aria-label="Open sidebar" className="portal-icon-button portal-mobile-toggle" onClick={() => setMobileOpen(true)} ref={trigger} type="button">
                <LuPanelLeftOpen aria-hidden="true" />
              </button>
              <span className="portal-toolbar-role">{roleLabel}</span>
              <span className="portal-toolbar-divider" aria-hidden="true">/</span>
              <h1>{title}</h1>
            </div>
            <div className="portal-toolbar-actions">{actions}</div>
          </header>
          <main className="portal-content" id="portal-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </PortalNavigationContext.Provider>
  )
}
